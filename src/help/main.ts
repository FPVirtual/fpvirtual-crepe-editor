// Página de ayuda (ayuda.html): no carga el editor, solo tema, marca y textos.
import '../styles.css'
import './help.css'

import { createApp } from 'vue'

import { initTheme } from '../theme/runtime'
import { themeKey } from '../theme/useTheme'
import HelpApp from './HelpApp.vue'

const theme = initTheme()

createApp(HelpApp).provide(themeKey, theme).mount('#app')
