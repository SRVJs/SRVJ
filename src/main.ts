import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// Vue Flow core + addon styles
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import '@vue-flow/node-resizer/dist/style.css'

// UnoCSS: reset first, then generated utilities
import '@unocss/reset/tailwind.css'
import 'virtual:uno.css'

// App-level custom styles (kept minimal)
import './style.css'

createApp(App).use(createPinia()).use(router).mount('#app')
