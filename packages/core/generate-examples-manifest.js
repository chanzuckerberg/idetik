/* eslint-env node */
/* global process */

import { readdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function generateMainIndex(examples, examplesDir) {
  // Redirect to the first example instead of showing a landing page
  const firstExample = examples[0];
  const redirectPath = firstExample ? firstExample.path : '/points/';

  const indexHTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Idetik Examples</title>
    <meta http-equiv="refresh" content="0; url=${redirectPath}">
    <script>
      // Fallback redirect if meta refresh doesn't work
      window.location.href = '${redirectPath}';
    </script>
  </head>
  <body>
    <p>Redirecting to examples...</p>
  </body>
</html>`;

  const indexPath = resolve(examplesDir, 'index.html');
  writeFileSync(indexPath, indexHTML);
  console.log('Generated main index.html');
}

function generateExamplesManifest() {
  const examplesDir = resolve(__dirname, 'examples');
  const entries = readdirSync(examplesDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name !== 'dist');

  // discover examples: any directory with an index.html file
  const examples = entries
    .filter(entry => {
      const htmlPath = resolve(examplesDir, entry.name, 'index.html');
      return existsSync(htmlPath);
    })
    .map(entry => {
      const htmlPath = resolve(examplesDir, entry.name, 'index.html');
      const htmlContent = readFileSync(htmlPath, 'utf-8');
      const title = getExampleTitle(htmlContent, entry.name);

      return {
        id: entry.name,
        title: title,
        path: `/${entry.name}/`,
        directory: entry.name
      };
    });

  examples.sort((a, b) => a.title.localeCompare(b.title));
  const manifest = {
    generated: new Date().toISOString(),
    examples: examples
  };
  const manifestPath = resolve(examplesDir, 'examples-manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  generateMainIndex(examples, examplesDir);

  console.log(`Generated manifest with ${examples.length} examples:`);
  examples.forEach(example => {
    console.log(`  - ${example.title} (${example.id})`);
  });

  return manifest;
}

function getExampleTitle(htmlContent, dirName) {
  const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
  const htmlTitle = titleMatch ? titleMatch[1].trim() : null;

  if (!htmlTitle) {
    throw new Error(`No <title> found in HTML content of example directory: ${dirName}`);
  }

  return htmlTitle;
}

// run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateExamplesManifest();
}

export { generateExamplesManifest };
