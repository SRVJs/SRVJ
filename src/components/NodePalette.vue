<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDiagramStore } from '@/stores/diagram'
import { useEditorTool, type ShapeTool } from '@/composables/useEditorTool'
import type { FillStyle, NodeColor, StrokeStyle, StrokeWidth } from '@/types/diagram'

const store = useDiagramStore()
const {
  hasSelection,
  selectionColor,
  selectionFillStyle,
  selectionStrokeStyle,
  selectionStrokeWidth,
  selectionOpacity,
} = storeToRefs(store)
const {
  activeColor,
  activeFillStyle,
  activeStrokeStyle,
  activeStrokeWidth,
  activeOpacity,
  isSelectTool,
  setTool,
  resetTool,
  setColor,
  setFillStyle,
  setStrokeStyle,
  setStrokeWidth,
  setOpacity,
  isActive,
} = useEditorTool()

interface Tool extends ShapeTool {
  key: string
  label: string
  icon: string
}

const tools: Tool[] = [
  { key: 'rectangle', label: 'Rectangle', icon: 'i-mdi-rectangle-outline', shape: 'rectangle', variant: 'default' },
  { key: 'ellipse', label: 'Ellipse', icon: 'i-mdi-ellipse-outline', shape: 'ellipse', variant: 'default' },
  { key: 'diamond', label: 'Diamond', icon: 'i-mdi-rhombus-outline', shape: 'diamond', variant: 'default' },
  { key: 'sticky', label: 'Sticky note', icon: 'i-mdi-sticky-note-outline', shape: 'sticky', variant: 'default' },
  { key: 'text', label: 'Text', icon: 'i-mdi-format-text', shape: 'text', variant: 'default' },
  { key: 'input', label: 'Input node', icon: 'i-mdi-import', shape: 'rectangle', variant: 'input' },
  { key: 'output', label: 'Output node', icon: 'i-mdi-export', shape: 'rectangle', variant: 'output' },
]

const swatches: { key: NodeColor; class: string }[] = [
  { key: 'slate', class: 'bg-white border border-slate-300' },
  { key: 'blue', class: 'bg-sky-300' },
  { key: 'green', class: 'bg-emerald-300' },
  { key: 'yellow', class: 'bg-amber-300' },
  { key: 'red', class: 'bg-rose-300' },
  { key: 'violet', class: 'bg-violet-300' },
]

// Sticky notes default to yellow (Miro-style) unless a colour was chosen.
function colorFor(tool: Tool): NodeColor {
  if (tool.shape === 'sticky' && activeColor.value === 'slate') return 'yellow'
  return activeColor.value
}

function pickTool(tool: Tool) {
  setTool({ shape: tool.shape, variant: tool.variant })
}

function onDragStart(event: DragEvent, tool: Tool) {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData(
    'application/diagram-node',
    JSON.stringify({ variant: tool.variant, shape: tool.shape, color: colorFor(tool) }),
  )
}

function pickColor(color: NodeColor) {
  setColor(color)
  // If nodes are selected, recolour them immediately (Excalidraw behaviour).
  if (store.selectedNodeIds.length > 0) store.updateNodeColor(color)
}

// ----- Style controls (fill / stroke / opacity) --------------------------
// Each control follows the colour pattern: update the active-tool default,
// and if any nodes are selected, apply the change to the selection too.

const fillOptions: { value: FillStyle; label: string; icon: string }[] = [
  { value: 'solid', label: 'Solid fill', icon: 'i-mdi-square-rounded' },
  { value: 'transparent', label: 'Transparent', icon: 'i-mdi-square-rounded-outline' },
]

const strokeStyleOptions: { value: StrokeStyle; label: string; icon: string }[] = [
  { value: 'solid', label: 'Solid', icon: 'i-mdi-minus' },
  { value: 'dashed', label: 'Dashed', icon: 'i-mdi-dots-horizontal' },
  { value: 'dotted', label: 'Dotted', icon: 'i-mdi-dots-grid' },
]

const strokeWidthOptions: { value: StrokeWidth; label: string; bar: string }[] = [
  { value: 'thin', label: 'Thin', bar: 'h-[1.5px]' },
  { value: 'medium', label: 'Medium', bar: 'h-[2.5px]' },
  { value: 'thick', label: 'Thick', bar: 'h-[4px]' },
]

// What the controls should display: the shared value across the current
// selection (if any), otherwise the active-tool default.
const currentFill = computed<FillStyle>(() => selectionFillStyle.value ?? activeFillStyle.value)
const currentStrokeStyle = computed<StrokeStyle>(
  () => selectionStrokeStyle.value ?? activeStrokeStyle.value,
)
const currentStrokeWidth = computed<StrokeWidth>(
  () => selectionStrokeWidth.value ?? activeStrokeWidth.value,
)
const currentOpacity = computed<number>(() => selectionOpacity.value ?? activeOpacity.value)

function pickFillStyle(value: FillStyle) {
  setFillStyle(value)
  if (store.selectedNodeIds.length > 0) store.updateNodeFillStyle(value)
}

function pickStrokeStyle(value: StrokeStyle) {
  setStrokeStyle(value)
  if (store.selectedNodeIds.length > 0) store.updateNodeStrokeStyle(value)
}

function pickStrokeWidth(value: StrokeWidth) {
  setStrokeWidth(value)
  if (store.selectedNodeIds.length > 0) store.updateNodeStrokeWidth(value)
}

function onOpacityInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  setOpacity(value)
  if (store.selectedNodeIds.length > 0) store.updateNodeOpacity(value)
}
</script>

<template>
  <aside
    class="pointer-events-auto absolute left-4 top-4 z-10 flex max-h-[calc(100vh-6rem)] w-[96px] flex-col items-center gap-1.5 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white/85 p-2 shadow-xl backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-800/85"
  >
    <!-- Select / cursor tool -->
    <button
      type="button"
      title="Select & move (V)"
      aria-label="Select tool"
      class="flex h-11 w-11 items-center justify-center rounded-xl border text-xl transition-colors active:scale-95"
      :class="
        isSelectTool
          ? 'border-indigo-300 bg-indigo-50 text-indigo-600 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300'
          : 'border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
      "
      @click="resetTool"
    >
      <span class="i-mdi-cursor-default-outline" aria-hidden="true" />
    </button>

    <span class="my-0.5 h-px w-9 bg-slate-200 dark:bg-slate-700" />

    <button
      v-for="tool in tools"
      :key="tool.key"
      type="button"
      draggable="true"
      :title="`${tool.label} — click to pick, then drag on the canvas to draw`"
      :aria-label="tool.label"
      :aria-pressed="isActive(tool)"
      class="flex h-11 w-11 items-center justify-center rounded-xl border text-xl transition-colors active:scale-95"
      :class="
        isActive(tool)
          ? 'border-indigo-300 bg-indigo-50 text-indigo-600 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300'
          : 'border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
      "
      @click="pickTool(tool)"
      @dragstart="onDragStart($event, tool)"
    >
      <span :class="tool.icon" aria-hidden="true" />
    </button>

    <span class="my-1 h-px w-9 bg-slate-200 dark:bg-slate-700" />

    <span class="px-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
      {{ hasSelection ? 'Fill' : 'Color' }}
    </span>

    <div class="grid grid-cols-2 gap-1.5">
      <button
        v-for="swatch in swatches"
        :key="swatch.key"
        type="button"
        :title="swatch.key"
        :aria-label="`Colour ${swatch.key}`"
        class="h-6 w-6 rounded-full ring-offset-1 ring-offset-white transition-transform hover:scale-110 dark:ring-offset-slate-800"
        :class="[
          swatch.class,
          (selectionColor ?? activeColor) === swatch.key ? 'ring-2 ring-indigo-500' : '',
        ]"
        @click="pickColor(swatch.key)"
      />
    </div>

    <!-- Fill style (solid / transparent) -->
    <span class="my-1 h-px w-9 bg-slate-200 dark:bg-slate-700" />
    <span class="px-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
      Fill
    </span>
    <div class="grid grid-cols-2 gap-1">
      <button
        v-for="opt in fillOptions"
        :key="opt.value"
        type="button"
        :title="opt.label"
        :aria-label="opt.label"
        :aria-pressed="currentFill === opt.value"
        class="flex h-7 w-7 items-center justify-center rounded-md border text-base transition-colors"
        :class="
          currentFill === opt.value
            ? 'border-indigo-300 bg-indigo-50 text-indigo-600 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300'
            : 'border-transparent text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
        "
        @click="pickFillStyle(opt.value)"
      >
        <span :class="opt.icon" aria-hidden="true" />
      </button>
    </div>

    <!-- Stroke style (solid / dashed / dotted) -->
    <span class="my-1 h-px w-9 bg-slate-200 dark:bg-slate-700" />
    <span class="px-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
      Stroke
    </span>
    <div class="grid grid-cols-3 gap-0.5">
      <button
        v-for="opt in strokeStyleOptions"
        :key="opt.value"
        type="button"
        :title="opt.label"
        :aria-label="`Stroke ${opt.label}`"
        :aria-pressed="currentStrokeStyle === opt.value"
        class="flex h-6 w-6 items-center justify-center rounded-md border text-sm transition-colors"
        :class="
          currentStrokeStyle === opt.value
            ? 'border-indigo-300 bg-indigo-50 text-indigo-600 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300'
            : 'border-transparent text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
        "
        @click="pickStrokeStyle(opt.value)"
      >
        <span :class="opt.icon" aria-hidden="true" />
      </button>
    </div>

    <!-- Stroke width (thin / medium / thick) -->
    <span class="px-1 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
      Width
    </span>
    <div class="grid grid-cols-3 gap-0.5">
      <button
        v-for="opt in strokeWidthOptions"
        :key="opt.value"
        type="button"
        :title="opt.label"
        :aria-label="`Stroke width ${opt.label}`"
        :aria-pressed="currentStrokeWidth === opt.value"
        class="flex h-6 w-6 items-center justify-center rounded-md border transition-colors"
        :class="
          currentStrokeWidth === opt.value
            ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/15'
            : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'
        "
        @click="pickStrokeWidth(opt.value)"
      >
        <span
          class="w-4 rounded-sm bg-slate-600 dark:bg-slate-200"
          :class="opt.bar"
          aria-hidden="true"
        />
      </button>
    </div>

    <!-- Opacity slider -->
    <span class="my-1 h-px w-9 bg-slate-200 dark:bg-slate-700" />
    <span class="px-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
      Opacity
    </span>
    <div class="flex w-full flex-col items-center gap-0.5 px-1">
      <input
        type="range"
        min="10"
        max="100"
        step="5"
        :value="currentOpacity"
        :aria-label="`Opacity ${currentOpacity}%`"
        class="h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-indigo-500 dark:bg-slate-700"
        @input="onOpacityInput"
      />
      <span class="text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
        {{ currentOpacity }}%
      </span>
    </div>
  </aside>
</template>
