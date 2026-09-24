import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import VersionBadge from './VersionBadge.vue'
import GettingStartedViewer from './GettingStartedViewer.vue'
import LiveExamples from './components/examples/LiveExamples.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'home-features-after': () => h(LiveExamples),
    })
  },
  enhanceApp({ app }) {
    app.component('VersionBadge', VersionBadge)
    app.component('GettingStartedViewer', GettingStartedViewer)
  },
}
