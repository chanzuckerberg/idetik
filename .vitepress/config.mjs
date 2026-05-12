import { defineConfig } from 'vitepress'
import path from 'path'
import { readdirSync, existsSync, readFileSync } from 'fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = dirname(fileURLToPath(import.meta.url))

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
}

function reloadOnExampleRebuildPlugin() {
  const previewDir = path.resolve(__dirname, '../docs/public/_example-preview')
  return {
    name: 'reload-on-example-rebuild',
    configureServer(server) {
      server.watcher.add(previewDir)
      server.watcher.on('change', (file) => {
        if (file.startsWith(previewDir)) server.ws.send({ type: 'full-reload' })
      })
    }
  }
}

// VitePress registers its HTML middleware before Vite's static file middleware,
// so directory requests to /_example-preview/ get caught by VitePress's 404
// handler instead of being served as index.html. enforce:'pre' runs this first.
function servePreviewPlugin() {
  const previewDir = path.resolve(__dirname, '../docs/public/_example-preview')
  return {
    name: 'serve-example-preview',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const base = server.config.base?.replace(/\/$/, '') ?? ''
        let url = req.url?.split('?')[0] ?? ''
        if (url.startsWith(base)) url = url.slice(base.length)
        if (!url.startsWith('/_example-preview')) return next()
        let urlPath = url.slice('/_example-preview'.length)
        if (!urlPath || urlPath.endsWith('/')) urlPath = (urlPath || '') + 'index.html'
        const filePath = path.resolve(previewDir, urlPath.slice(1))
        if (!filePath.startsWith(previewDir) || !existsSync(filePath)) return next()
        const mime = MIME[path.extname(filePath)] ?? 'application/octet-stream'
        res.setHeader('Content-Type', mime)
        res.end(readFileSync(filePath))
      })
    }
  }
}

function getExampleSidebarItems() {
  const examplesDir = path.resolve(__dirname, '../examples')
  return readdirSync(examplesDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && existsSync(path.resolve(examplesDir, e.name, 'index.html')))
    .map(e => {
      const html = readFileSync(path.resolve(examplesDir, e.name, 'index.html'), 'utf-8')
      const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      return { text: match?.[1] ?? e.name, link: `/_example-preview/#${e.name}/`, target: '_blank' }
    })
    .sort((a, b) => a.text.localeCompare(b.text))
}

export default defineConfig({
  title: 'Idetik',
  description: 'A library for creating interactive viewers for large bioimaging data',

  srcDir: 'docs',

  vite: {
    plugins: [reloadOnExampleRebuildPlugin(), servePreviewPlugin()],
    server: { port: 5174 },
  },

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Examples', link: '/examples/' },
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
        ],
      },
      {
        text: 'Examples',
        items: [
          { text: 'Overview', link: '/examples/' },
          ...getExampleSidebarItems(),
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/chanzuckerberg/idetik' },
    ],
  },
})
