import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateExamplesManifest } from './generate-examples-manifest.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function injectExamplesNavigation() {
  let isDev = false;

  return {
    name: 'inject-examples-navigation',
    configResolved(config) {
      isDev = config.command === 'serve';
    },
    configureServer(server) {
      // Watch for changes to example HTML files and regenerate manifest
      if (isDev) {
        const chokidar = server.watcher;
        chokidar.add(resolve(__dirname, 'examples/*/index.html'));
        
        chokidar.on('change', (path) => {
          // Only watch actual example directories, not the generated main index.html
          if (path.includes('/examples/') && 
              path.endsWith('/index.html') && 
              !path.includes('/dist/') &&
              !path.endsWith('/examples/index.html')) {
            console.log('Example HTML file changed, regenerating manifest...');
            try {
              generateExamplesManifest();
              console.log('Manifest regenerated successfully');
            } catch (error) {
              console.error('Failed to regenerate manifest:', error);
            }
          }
        });
      }

      // Serve navigation files in development mode
      server.middlewares.use('/navigation.css', (_req, res, next) => {
        try {
          const css = readFileSync(resolve(__dirname, 'examples/navigation.css'), 'utf-8');
          res.setHeader('Content-Type', 'text/css');
          res.end(css);
        } catch (error) {
          next(error);
        }
      });


      server.middlewares.use('/examples-manifest.json', (_req, res, next) => {
        try {
          const manifest = readFileSync(resolve(__dirname, 'examples/examples-manifest.json'), 'utf-8');
          res.setHeader('Content-Type', 'application/json');
          res.end(manifest);
        } catch (error) {
          next(error);
        }
      });

      // Serve the main examples page dynamically to avoid file watching issues
      server.middlewares.use('/examples/', (_req, res, next) => {
        try {
          const html = readFileSync(resolve(__dirname, 'examples/index.html'), 'utf-8');
          res.setHeader('Content-Type', 'text/html');
          res.end(html);
        } catch (error) {
          next(error);
        }
      });
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        // Navigation injection is now handled by the main examples/index.html page using iframes
        // Individual example pages run clean without navigation injection
        return html;
      }
    }
  };
}

export default injectExamplesNavigation;
