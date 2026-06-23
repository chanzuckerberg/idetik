import { defineConfig } from 'vitepress'

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
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/chanzuckerberg/idetik' },
    ],
  },
})
