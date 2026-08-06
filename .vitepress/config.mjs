import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitepress'
import typedocSidebar from '../docs/api/typedoc-sidebar.json' with { type: 'json' }

function getLatestVersion() {
  try {
    const tag = execSync("git tag --list 'v*' --sort=-v:refname", { encoding: 'utf-8' })
      .split('\n')[0]
      .trim()
    if (tag) return tag.replace(/^v/, '')
  } catch {
    // fall through to package.json
  }
  return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')).version
}

export default defineConfig({
  title: 'Idetik',
  description: 'A library for creating interactive viewers for large bioimaging data',

  srcDir: 'docs',
  appearance: false,

  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' }]],

  vite: {
    server: { port: 5174 },
    define: {
      __IDETIK_VERSION__: JSON.stringify(getLatestVersion()),
    },
  },

  themeConfig: {
    logo: '/icon.svg',

    search: {
      provider: 'local',
    },

    nav: [
      { text: 'Manual', link: '/guide/getting-started' },
      { text: 'API Reference', link: '/api/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
          ],
        },
      ],
      '/api/': typedocSidebar,
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/chanzuckerberg/idetik' },
    ],

    footer: {
      message: 'Released under the MIT License',
    },
  },
})
