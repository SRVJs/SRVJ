<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useDiagramStore } from '@/stores/diagram'
import { useDarkMode } from '@/composables/useDarkMode'
import { useSketchMode } from '@/composables/useSketchMode'
import { downloadDiagram, parseDiagram, readFileAsText } from '@/utils/exportImport'
import ToolbarButton from './ToolbarButton.vue'
import AuthMenu from './AuthMenu.vue'

const store = useDiagramStore()
const { canUndo, canRedo, hasSelection, selectedCount, nodeCount, edgeCount } = storeToRefs(store)
const { isDark, toggle: toggleDark } = useDarkMode()
const { isSketch, toggle: toggleSketch } = useSketchMode()

const fileInput = ref<HTMLInputElement | null>(null)

function exportJson() {
  downloadDiagram(store.snapshot, `srvj-diagram-${Date.now()}.json`)
}

function triggerImport() {
  fileInput.value?.click()
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const text = await readFileAsText(file)
    const snapshot = parseDiagram(text)
    store.loadSnapshot(snapshot)
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Failed to import diagram.')
  } finally {
    input.value = ''
  }
}

function confirmReset() {
  if (store.nodeCount === 0 && store.edgeCount === 0) return
  if (window.confirm('Clear the entire canvas? This can be undone with Ctrl+Z.')) {
    store.reset()
  }
}
</script>

<template>
  <header
    class="relative z-20 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 bg-white/85 px-3 py-2 backdrop-blur dark:border-slate-700 dark:bg-slate-900/85 sm:px-4"
  >
    <div class="mr-1 flex shrink-0 items-center">
      <img src="/favicon.png" alt="SRVJ" class="h-12 w-14 rounded-lg shadow-sm" />
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <span class="hidden h-6 w-px bg-slate-200 dark:bg-slate-700 sm:block" />

      <ToolbarButton label="Undo" icon="i-ri-arrow-go-back-line" :disabled="!canUndo" @click="store.undo()" />
      <ToolbarButton label="Redo" icon="i-ri-arrow-go-forward-line" :disabled="!canRedo" @click="store.redo()" />

      <span class="hidden h-6 w-px bg-slate-200 dark:bg-slate-700 sm:block" />

      <ToolbarButton
        :label="selectedCount > 1 ? `Delete (${selectedCount})` : 'Delete'"
        icon="i-mdi-trash-can-outline"
        variant="danger"
        :disabled="!hasSelection"
        @click="store.deleteSelected()"
      />

      <span class="hidden h-6 w-px bg-slate-200 dark:bg-slate-700 sm:block" />

      <ToolbarButton label="Export" icon="i-solar-download-minimalistic-linear" @click="exportJson" />
      <ToolbarButton label="Import" icon="i-solar-upload-minimalistic-linear" @click="triggerImport" />
      <ToolbarButton label="Reset" icon="i-codicon-clear-all" variant="danger" @click="confirmReset" />
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="application/json,.json"
      class="hidden"
      @change="onFileSelected"
    />

    <div class="ml-auto flex flex-wrap items-center justify-end gap-2 sm:gap-3">
      <span class="hidden items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 sm:flex">
        <span class="i-oui-node text-sm" aria-hidden="true" />
        {{ nodeCount }} nodes
        <span class="i-nonicons-git-merge-16 ml-1 text-sm" aria-hidden="true" />
        {{ edgeCount }} edges
      </span>

      <button
        type="button"
        :aria-pressed="isSketch"
        title="Toggle hand-drawn (sketch) mode"
        class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium shadow-sm transition-colors"
        :class="
          isSketch
            ? 'border-indigo-500 bg-indigo-500 text-white hover:bg-indigo-600'
            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
        "
        @click="toggleSketch"
      >
        <span class="i-mdi-draw" aria-hidden="true" />
        <span class="hidden lg:inline">Sketch</span>
      </button>

      <button
        type="button"
        :aria-pressed="isDark"
        aria-label="Toggle dark mode"
        title="Toggle dark mode"
        class="inline-flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-base shadow-sm hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
        @click="toggleDark"
      >
        <span
          :class="isDark ? 'i-solar-moon-bold text-indigo-300' : 'i-solar-sun-2-bold text-amber-500'"
          aria-hidden="true"
        />
      </button>

      <span class="hidden h-6 w-px bg-slate-200 dark:bg-slate-700 sm:block" />

      <AuthMenu />
    </div>
  </header>
</template>
