import '@milkdown/crepe/theme/common/style.css'
import './theme/hope.css'
import './styles.css'

import { createApp } from 'vue'

import App from './App.vue'
import { initTheme } from './theme/runtime'
import { themeKey } from './theme/useTheme'

// Antes de montar: tokens inyectados y tema activo, sin parpadeo.
const theme = initTheme()

createApp(App).provide(themeKey, theme).mount('#app')
