import { Idetik, ImageLayer, OmeZarrImageSource, OrthographicCamera, Region } from '@';
import { PanZoomControls } from '@/objects/cameras/controls';
import { generateAwsAuthHeaders, type AwsCredentials, type S3Config } from './aws_auth';

// Status display helper
function updateStatus(message: string, type: 'status' | 'success' | 'error' = 'status') {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.innerHTML = `<span class="${type}">${message}</span>`;
  }
  console.log(`[${type}]`, message);
}

async function main() {
  try {
    updateStatus('Initializing...');

    // S3 bucket and key
    const bucket = 'czi-dynamic-cell-atlas';
    const key = 'allencell-dynamic-nuc-morph/baseline_colonies_fov_timelapse_dataset/20200323_06_medium/raw.ome.zarr/';

    // TODO: In production, fetch credentials from your backend
    // Example: const credentials = await fetch('/api/aws-credentials').then(r => r.json());
    const credentials: AwsCredentials = {
      accessKeyId: 'YOUR_ACCESS_KEY_ID',
      secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
      sessionToken: 'YOUR_SESSION_TOKEN',
    };

    const config: S3Config = {
      region: 'us-east-1',
      service: 's3',
    };

    // Construct S3 HTTPS URL from bucket, key, and region
    // Note: us-east-1 can use the legacy format without region in the domain
    const s3Url = config.region === 'us-east-1'
      ? `https://${bucket}.s3.amazonaws.com/${key}`
      : `https://${bucket}.s3.${config.region}.amazonaws.com/${key}`;

    updateStatus('Generating AWS authentication headers...');
    const headers = await generateAwsAuthHeaders('GET', s3Url, credentials, config);
    updateStatus('Authentication headers generated ✓');
    console.log('Generated headers:', headers);
    console.log('Requesting URL:', s3Url);

    updateStatus('Loading OME-Zarr metadata from S3...');

    // Test the connection - first try without auth to see if it's public
    try {
      const testUrl = `${s3Url}.zattrs`;
      console.log('Testing public access to:', testUrl);
      const publicResponse = await fetch(testUrl);
      console.log('Public test response status:', publicResponse.status);

      if (publicResponse.ok) {
        console.log('Bucket is publicly accessible! Using without authentication.');
        // Remove headers for public access
        delete headers.Authorization;
        delete headers['X-Amz-Date'];
        delete headers['X-Amz-Content-Sha256'];
        delete headers['X-Amz-Security-Token'];
      } else {
        console.log('Testing with authentication headers...');
        const testResponse = await fetch(testUrl, { headers });
        console.log('Auth test response status:', testResponse.status);
        console.log('Test response headers:', Object.fromEntries(testResponse.headers.entries()));
        if (!testResponse.ok) {
          const errorText = await testResponse.text();
          console.error('Test fetch failed:', errorText);
          throw new Error(`Failed to fetch .zattrs: ${testResponse.status} ${testResponse.statusText}`);
        }
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      throw error;
    }

    const source = new OmeZarrImageSource(s3Url, undefined, {
      overrides: {
        headers,
      },
    });

    // Open the source to load metadata
    const loader = await source.open();
    updateStatus('OME-Zarr metadata loaded ✓');

    // Get image dimensions from the loader
    const shape = loader.shape;
    const axes = loader.axes;

    console.log('Image shape:', shape);
    console.log('Image axes:', axes);

    // Find x and y dimensions
    const xIndex = axes.findIndex(a => a.name === 'x');
    const yIndex = axes.findIndex(a => a.name === 'y');

    if (xIndex === -1 || yIndex === -1) {
      throw new Error('Could not find x and y dimensions in the data');
    }

    const width = shape[xIndex];
    const height = shape[yIndex];

    // Set up viewport based on actual data dimensions
    const left = 0;
    const right = Math.min(width, 1024);
    const top = 0;
    const bottom = Math.min(height, 1024);

    updateStatus(`Image dimensions: ${width}x${height}`);

    // Build region based on actual axes
    const region: Region = axes.map((axis) => {
      if (axis.name === 'x') {
        return { dimension: 'x', index: { type: 'interval', start: left, stop: right } };
      } else if (axis.name === 'y') {
        return { dimension: 'y', index: { type: 'interval', start: top, stop: bottom } };
      } else {
        // For other dimensions, show the first index
        return { dimension: axis.name, index: { type: 'point', value: 0 } };
      }
    });

    updateStatus('Creating image layer...');
    const channelProps = [{ contrastLimits: [0, 255] as [number, number] }];
    const imageLayer = new ImageLayer({ source, region, channelProps });
    const camera = new OrthographicCamera(left, right, top, bottom);
    updateStatus('Image layer created ✓');

    updateStatus('Starting renderer...');
    new Idetik({
      canvas: document.querySelector<HTMLCanvasElement>('#canvas')!,
      viewports: [
        {
          camera,
          cameraControls: new PanZoomControls(camera),
          layers: [imageLayer],
        },
      ],
    }).start();

    updateStatus(
      `Successfully loaded and rendered S3 data!<br><code>${s3Url}</code><br>Dimensions: ${width}x${height}`,
      'success'
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    updateStatus(`Error: ${errorMessage}`, 'error');
    console.error('Failed to load S3 data:', error);
  }
}

main();
