import { defineConfig } from 'vitepress'
import typedocSidebar from '../docs/api/typedoc-sidebar.json' with { type: 'json' }

export default defineConfig({
  title: 'Idetik',
  description: 'A library for creating interactive viewers for large bioimaging data',

  srcDir: 'docs',
  appearance: false,

  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' }]],

  vite: {
    server: { port: 5174 },
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
      '/api/': [
        { text: 'API Reference', link: '/api/' },
        ...typedocSidebar,
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/chanzuckerberg/idetik' },
    ],

    footer: {
      message: 'Released under the MIT License',
    },
  },
})
