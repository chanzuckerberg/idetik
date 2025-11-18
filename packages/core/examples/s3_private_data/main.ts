/**
 * Example: Loading private S3 OME-Zarr data with AWS authentication
 *
 * This example demonstrates how to use idetik with private S3 data that requires
 * AWS authentication. The AuthenticatedFetchStore generates fresh AWS Signature V4
 * headers for each file request.
 *
 * IMPORTANT: These credentials are temporary and for demonstration only.
 * In production, credentials should come from a secure backend service.
 */

import {
  Idetik,
  WebGLRenderer,
  OrthographicCamera,
  PanZoomControls,
  Viewport,
  ChunkedImageLayer,
  OmeZarrImageSource,
  type AwsCredentials,
  type AwsConfig,
} from "@idetik/core";

// AWS credentials (temporary, expires in a few hours)
// In production, fetch these from a secure backend endpoint
// IMPORTANT: Replace these placeholder values with real credentials to test
const AWS_CREDENTIALS: AwsCredentials = {
  accessKeyId: 'YOUR_ACCESS_KEY_ID',
  secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
  sessionToken: 'YOUR_SESSION_TOKEN',
};

const AWS_CONFIG: AwsConfig = {
  region: 'us-east-1',
  service: 's3',
};

// Private S3 OME-Zarr dataset URL
// Replace with your own private S3 bucket URL
const S3_URL = 'https://your-bucket.s3.amazonaws.com/path/to/your/data.ome.zarr/';

const statusElement = document.getElementById('status')!;

function updateStatus(message: string, type: 'status' | 'success' | 'error' = 'status') {
  statusElement.innerHTML = `<div class="${type}">${message}</div>`;
}

async function main() {
  try {
    updateStatus('🔐 Initializing with AWS credentials...');

    // Create OmeZarrImageSource with authentication
    // This will use AuthenticatedFetchStore which generates fresh AWS signatures
    // for each file request (metadata, chunks, etc.)
    const source = new OmeZarrImageSource(S3_URL, undefined, {
      credentials: AWS_CREDENTIALS,
      awsConfig: AWS_CONFIG,
    });

    updateStatus('📥 Loading OME-Zarr metadata from private S3...');

    // Open the OME-Zarr - this will make authenticated requests for metadata files
    const loader = await source.open();

    updateStatus('✅ Metadata loaded! Setting up visualization...', 'success');

    // Setup idetik
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const renderer = new WebGLRenderer(canvas);

    const camera = new OrthographicCamera();
    const controls = new PanZoomControls(camera, canvas);

    const viewport = new Viewport({
      renderer,
      camera,
      controls,
      canvas,
    });

    const idetik = new Idetik({
      viewports: [viewport],
      camera,
      controls,
    });

    // Create image layer
    const layer = new ChunkedImageLayer({
      loader,
      name: "Authenticated S3 Data",
    });

    viewport.addLayer(layer);

    // Set initial view
    const shape = loader.arrays[0].shape;
    camera.left = 0;
    camera.right = shape[shape.length - 1];
    camera.bottom = 0;
    camera.top = shape[shape.length - 2];
    camera.updateProjectionMatrix();

    // Start rendering
    idetik.render();

    updateStatus(
      '✅ Success!<br>' +
      '• All file requests authenticated with AWS Signature V4<br>' +
      '• Fresh signatures generated per request<br>' +
      '• Worker threads also use authenticated requests<br>' +
      `• Image shape: ${shape.join(' × ')}`,
      'success'
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    updateStatus(`❌ Error: ${errorMessage}<br><br>Note: Credentials may have expired`, 'error');
  }
}

main();
