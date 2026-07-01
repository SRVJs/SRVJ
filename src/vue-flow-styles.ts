// Vue Flow core + addon styles, imported only by the routes that render the
// canvas (Editor, Demo). Importing these from `main.ts` would ship editor CSS
// into the shared entry chunk loaded by every route, including the marketing
// Home page, which never renders Vue Flow.
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import '@vue-flow/node-resizer/dist/style.css'
