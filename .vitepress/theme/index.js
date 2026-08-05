import DefaultTheme from 'vitepress/theme'
import VersionBadge from './VersionBadge.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('VersionBadge', VersionBadge)
  },
}
