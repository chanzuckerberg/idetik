import { defineConfig } from 'vitepress'
import path from 'path'
import { readdirSync, existsSync, readFileSync } from 'fs'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
}

function servePreviewPlugin() {
  const previewDir = path.resolve(__dirname, '../docs/public/_example-preview')
  return {
    name: 'serve-example-preview',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/_example-preview')) return next()
        let urlPath = req.url.split('?')[0].slice('/_example-preview'.length)
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
      return { text: match?.[1] ?? e.name, link: `/_example-preview/${e.name}/` }
    })
    .sort((a, b) => a.text.localeCompare(b.text))
}

export default defineConfig({
  title: 'Idetik',
  description: 'A library for creating interactive viewers for large bioimaging data',
  base: '/idetik/',
  srcDir: 'docs',

  vite: {
    plugins: [servePreviewPlugin()],
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
        items: getExampleSidebarItems(),
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/chanzuckerberg/idetik' },
    ],
  },
})
