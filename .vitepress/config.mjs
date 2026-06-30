import { defineConfig } from 'vitepress'
import typedocSidebar from '../docs/api/typedoc-sidebar.json' with { type: 'json' }

export default defineConfig({
  title: 'Idetik',
  description: 'A library for creating interactive viewers for large bioimaging data',

  srcDir: 'docs',

  vite: {
    server: { port: 5174 },
  },

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/' },
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
  },
})
