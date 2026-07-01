<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import ClientOnly from '@/components/ClientOnly.vue'
import DiagramToolbar from '@/components/DiagramToolbar.vue'
import DiagramCanvas from '@/components/DiagramCanvas.vue'
import NodePalette from '@/components/NodePalette.vue'
import { useDiagramPersistence } from '@/composables/useDiagramPersistence'
import { useDiagramSync } from '@/composables/useDiagramSync'
import { useDiagramCollab } from '@/composables/useDiagramCollab'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useDarkMode } from '@/composables/useDarkMode'
import { useSketchMode } from '@/composables/useSketchMode'
import { useSeo } from '@/composables/useSeo'
import { useAppFonts } from '@/composables/useAppFonts'
import { useAuthStore } from '@/stores/auth'
import { COLLAB_WS_URL } from '@/utils/constants'
import '@/vue-flow-styles'

useSeo({ title: 'Editor | SRVJ', noindex: true })
useAppFonts()

const route = useRoute()
const auth = useAuthStore()
// The diagram's public `site_id` from the URL; the editor loads/saves it.
const diagramId = computed(() => {
  const id = route.params.diagramId
  return typeof id === 'string' && id ? id : null
})

// Persistence paths, chosen at mount:
//  • live collab — a real-time Yjs session (Hocuspocus) is the *only* writer of
//    a backend diagram; the REST `PATCH /diagram/:id` autosave is never used.
//  • REST read   — when collab isn't configured, the diagram still loads (GET)
//    but is read-only (no autosave).
//  • local-only  — signed out / no id, persisted to localStorage.
const localPersistence = useDiagramPersistence()
const sync = useDiagramSync(() => diagramId.value)
const collab = useDiagramCollab(() => diagramId.value)

const { init: initDarkMode } = useDarkMode()
const { init: initSketchMode } = useSketchMode()

// Register global Delete / Ctrl+Z / Ctrl+A keyboard shortcuts.
useKeyboardShortcuts()

// Restore the local-only canvas synchronously (no-op during SSG) so Vue Flow's
// `fit-view-on-init` sees restored nodes. The backend path loads async after
// auth is validated below.
if (!diagramId.value) localPersistence.load()

onMounted(async () => {
  initDarkMode()
  initSketchMode()

  await auth.init()

  if (diagramId.value && auth.token) {
    // The live collaboration session (CRDT) is the only writer for a backend
    // diagram — we never PATCH /diagram/:id. If collab isn't configured, just
    // load the saved diagram read-only (GET); no autosave.
    if (COLLAB_WS_URL && (await collab.connect())) return
    await sync.load()
  } else {
    localPersistence.start()
  }
})

onBeforeUnmount(() => collab.destroy())
</script>

<template>
  <div class="flex h-screen w-screen flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
    <ClientOnly>
      <DiagramToolbar />

      <main class="relative min-h-0 flex-1">
        <NodePalette />
        <DiagramCanvas />
      </main>

      <!-- Pre-rendered (static) shell: real, crawler-visible content shown
           during SSG and while Vue Flow boots in the browser. -->
      <template #fallback>
        <main
          class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 text-center"
        >
          <div class="i-carbon-flow text-6xl text-indigo-400" aria-hidden="true" />
          <h1 class="text-3xl font-bold text-slate-800 dark:text-slate-100">
            SRVJ — Diagram editor
          </h1>
          <p class="text-sm text-slate-400">Loading the editor…</p>
        </main>
      </template>
    </ClientOnly>
  </div>
</template>
