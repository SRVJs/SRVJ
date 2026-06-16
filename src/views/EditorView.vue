<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import ClientOnly from '@/components/ClientOnly.vue'
import DiagramToolbar from '@/components/DiagramToolbar.vue'
import DiagramCanvas from '@/components/DiagramCanvas.vue'
import NodePalette from '@/components/NodePalette.vue'
import { useDiagramPersistence } from '@/composables/useDiagramPersistence'
import { useDiagramSync } from '@/composables/useDiagramSync'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useDarkMode } from '@/composables/useDarkMode'
import { useSketchMode } from '@/composables/useSketchMode'
import { useSeo } from '@/composables/useSeo'
import { useAuthStore } from '@/stores/auth'

useSeo({ title: 'Editor — SRVJ', noindex: true })

const route = useRoute()
const auth = useAuthStore()
// The diagram's public `site_id` from the URL; the editor loads/saves it.
const diagramId = computed(() => {
  const id = route.params.diagramId
  return typeof id === 'string' && id ? id : null
})

// Backend sync when a diagram id is in the URL; otherwise a local-only canvas
// persisted to localStorage (the editor stays usable signed out).
const localPersistence = useDiagramPersistence()
const sync = useDiagramSync(() => diagramId.value)

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
    await sync.load()
    sync.start()
  } else {
    localPersistence.start()
  }
})
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
