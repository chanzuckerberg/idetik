// create links to each example directory (subirectory of this dir)
import { readdirSync } from 'fs';

// start when the document is ready
document.addEventListener('DOMContentLoaded', () => {
  const examples = readdirSync(__dirname, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  const container = document.getElementById('examples');
  examples.forEach((example) => {
    const link = document.createElement('a');
    link.href = `${example}/index.html`;
    link.textContent = example;
    container?.appendChild(link);
    container?.appendChild(document.createElement('br'));
  });
});
