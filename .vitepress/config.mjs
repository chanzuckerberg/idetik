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

const headingRegex = /<h(\d*).*?>(.*?<a.*? href="#.*?".*?>.*?<\/a>)<\/h\1>/gi
const headingContentRegex = /(.*?)<a class="header-anchor" href="#(.*?)".*?>.*?<\/a>/i

function* splitPageIntoSections(html) {
  const result = html.split(headingRegex)
  result.shift()
  let parentTitles = []
  const clearHtmlTags = (str) => str.replace(/<[^>]*>/g, '')
  for (let i = 0; i < result.length; i += 3) {
    const level = Number.parseInt(result[i]) - 1
    const heading = result[i + 1]
    const headingResult = headingContentRegex.exec(heading)
    const title = clearHtmlTags(headingResult?.[1] ?? '').trim()
    const anchor = headingResult?.[2] ?? ''
    const content = result[i + 2]
    if (!title || !content) continue
    let titles = parentTitles.slice(0, level)
    titles[level] = title
    titles = titles.filter(Boolean)
    yield { anchor, titles, text: clearHtmlTags(content) }
    if (level === 0) {
      parentTitles = [title]
    } else {
      parentTitles[level] = title
    }
  }
}

export default defineConfig({
  title: 'Idetik',
  description: 'A library for creating interactive viewers for large bioimaging data',

  srcDir: 'docs',
  appearance: false,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
      },
    ],
  ],

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
      options: {
        miniSearch: {
          // Replaces VitePress's default section splitter, which derives each
          // section's anchor from the FIRST link in a heading. API member
          // headings contain type links (e.g. "state" links to LayerState),
          // which made sections collide on the linked type's anchor. This
          // version anchors on the permalink (.header-anchor) instead.
          _splitIntoSections: (_file, html) => splitPageIntoSections(html),
        },
      },
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
