import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import VersionBadge from './VersionBadge.vue'
import GitHubStars from './GitHubStars.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'nav-bar-content-after': () => h(GitHubStars),
    })
  },
  enhanceApp({ app }) {
    app.component('VersionBadge', VersionBadge)
  },
}
