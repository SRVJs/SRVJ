<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import ClientOnly from '@/components/ClientOnly.vue'
import DiagramCanvas from '@/components/DiagramCanvas.vue'
import { useDiagramPersistence } from '@/composables/useDiagramPersistence'
import { useEditorTool } from '@/composables/useEditorTool'
import { useDarkMode } from '@/composables/useDarkMode'
import { useSketchMode } from '@/composables/useSketchMode'
import { useSeo } from '@/composables/useSeo'
import { useAppFonts } from '@/composables/useAppFonts'
import { useDiagramStore } from '@/stores/diagram'
import { DEMO_STORAGE_KEY } from '@/utils/constants'
import '@/vue-flow-styles'

/**
 * Public, sign-in-free **pen-only** demo of the editor: the freehand pen is the
 * only tool (no palette, no shape/arrow tools), and every stroke is persisted to
 * localStorage under {@link DEMO_STORAGE_KEY} so the doodle survives a reload.
 *
 * Vue Flow is DOM-only, so the canvas is wrapped in `ClientOnly`. It's `noindex`.
 */
useSeo({ title: 'Demo | SRVJ Diagram Editor', path: '/app/demo', noindex: true })
useAppFonts()

const store = useDiagramStore()
const { canUndo, canRedo } = storeToRefs(store)
const { setTool } = useEditorTool()
const { init: initDarkMode, setForcedTheme } = useDarkMode()
const { init: initSketchMode } = useSketchMode()
const persistence = useDiagramPersistence(DEMO_STORAGE_KEY)

// Lock the editor to the pen. Set before mount so the canvas boots in draw mode.
setTool('draw')
// Restore any saved doodle synchronously so `fit-view-on-init` sees the strokes.
persistence.load()

onMounted(() => {
  initDarkMode()
  initSketchMode()
  // Demo is white-mode only — force light regardless of the saved preference.
  setForcedTheme('light')
  // Re-assert the pen in case anything reset the shared tool ref while mounting.
  setTool('draw')
  persistence.start()
})

// Release the light lock so the rest of the app honours the user's theme again.
onBeforeUnmount(() => setForcedTheme(null))
</script>

<template>
  <div class="flex h-screen w-screen flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
    <ClientOnly>
      <!-- Slim, pen-only toolbar -->
      <header
        class="flex items-center gap-3 border-b border-slate-200 bg-white/85 px-4 py-2 backdrop-blur dark:border-slate-700 dark:bg-slate-800/85"
      >
        <img src="/logo-mark.png" alt="" width="44" height="36" class="h-9 w-11 rounded-lg shadow-sm" />
        <span
          class="ml-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
        > demo
        </span>

        <span class="ml-2 h-6 w-px bg-slate-200 dark:bg-slate-700" />

        <!-- Pen (the only, always-active tool) -->
        <span
          title="Pen — drag on the canvas to draw"
          class="flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-300 bg-indigo-50 text-xl text-indigo-600 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300"
        >
          <span class="i-mdi-pencil-outline" aria-hidden="true" />
        </span>

        <span class="h-6 w-px bg-slate-200 dark:bg-slate-700" />

        <button
          type="button"
          title="Undo"
          :disabled="!canUndo"
          class="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-700"
          @click="store.undo()"
        >
          <span class="i-ri-arrow-go-back-line" aria-hidden="true" />
        </button>
        <button
          type="button"
          title="Redo"
          :disabled="!canRedo"
          class="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-700"
          @click="store.redo()"
        >
          <span class="i-ri-arrow-go-forward-line" aria-hidden="true" />
        </button>
        <button
          type="button"
          title="Clear canvas"
          class="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          @click="store.reset()"
        >
          <span class="i-mdi-trash-can-outline" aria-hidden="true" />
        </button>

        <div class="ml-auto flex items-center gap-2">
          <RouterLink
            to="/"
            class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 no-underline transition-colors hover:bg-slate-100"
          >
            Back to home
          </RouterLink>
        </div>
      </header>

      <main class="relative min-h-0 flex-1">
        <DiagramCanvas />
      </main>

      <!-- Pre-rendered (static) SSG shell. -->
      <template #fallback>
        <main
          class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 text-center"
        >
          <div class="i-mdi-pencil-outline text-6xl text-indigo-400" aria-hidden="true" />
          <h1 class="text-3xl font-bold text-slate-800 dark:text-slate-100">SRVJ — Pen demo</h1>
          <p class="text-sm text-slate-400">Loading the canvas…</p>
        </main>
      </template>
    </ClientOnly>
  </div>
</template>
