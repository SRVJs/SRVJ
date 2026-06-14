<script setup lang="ts">
import { onMounted } from 'vue'
import DiagramToolbar from '@/components/DiagramToolbar.vue'
import DiagramCanvas from '@/components/DiagramCanvas.vue'
import NodePalette from '@/components/NodePalette.vue'
import { useDiagramPersistence } from '@/composables/useDiagramPersistence'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useDarkMode } from '@/composables/useDarkMode'
import { useSketchMode } from '@/composables/useSketchMode'

const persistence = useDiagramPersistence()
const { init: initDarkMode } = useDarkMode()
const { init: initSketchMode } = useSketchMode()

// Register global Delete / Ctrl+Z / Ctrl+A keyboard shortcuts.
useKeyboardShortcuts()

// Restore the saved diagram synchronously, before DiagramCanvas mounts —
// so Vue Flow's `fit-view-on-init` sees the loaded nodes immediately and
// doesn't fire later when the user creates their first shape (which would
// otherwise auto-zoom onto that single node).
persistence.load()

onMounted(() => {
  initDarkMode()
  initSketchMode()
  persistence.start() // begin debounced auto-save
})
</script>

<template>
  <div class="flex h-screen w-screen flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
    <DiagramToolbar />
    <main class="relative min-h-0 flex-1">
      <NodePalette />
      <DiagramCanvas />
    </main>
  </div>
</template>
