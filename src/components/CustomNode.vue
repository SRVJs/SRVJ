<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { Handle, Position, type NodeProps } from '@vue-flow/core'
import { NodeResizer, type OnResize } from '@vue-flow/node-resizer'
import type { DiagramNodeData, NodeColor, StrokeStyle, StrokeWidth } from '@/types/diagram'
import { useDiagramStore } from '@/stores/diagram'

const props = defineProps<NodeProps<DiagramNodeData>>()
const store = useDiagramStore()

const editing = ref(false)
const draft = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
// Briefly true for nodes that were just created via the palette / draw —
// drives the Excalidraw-style scale-in animation. Stays unset for nodes
// restored from a snapshot or recreated by undo/redo, so those don't pop.
const justCreated = ref(false)

interface ColorStyle {
  fill: string
  border: string
  text: string
  sticky: string // solid Miro-style sticky fill + readable text
}

// Excalidraw-like pastel palette (light + dark variants baked in).
const colorStyles: Record<NodeColor, ColorStyle> = {
  slate: {
    fill: 'bg-white dark:bg-slate-800',
    border: 'border-slate-300 dark:border-slate-500',
    text: 'text-slate-700 dark:text-slate-100',
    sticky: 'bg-slate-200 text-slate-800 dark:bg-slate-300 dark:text-slate-900',
  },
  blue: {
    fill: 'bg-sky-100 dark:bg-sky-500/20',
    border: 'border-sky-400 dark:border-sky-400/70',
    text: 'text-sky-900 dark:text-sky-100',
    sticky: 'bg-sky-200 text-sky-900 dark:bg-sky-300 dark:text-sky-950',
  },
  green: {
    fill: 'bg-emerald-100 dark:bg-emerald-500/20',
    border: 'border-emerald-400 dark:border-emerald-400/70',
    text: 'text-emerald-900 dark:text-emerald-100',
    sticky: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-300 dark:text-emerald-950',
  },
  yellow: {
    fill: 'bg-amber-100 dark:bg-amber-500/20',
    border: 'border-amber-400 dark:border-amber-400/70',
    text: 'text-amber-900 dark:text-amber-100',
    sticky: 'bg-amber-200 text-amber-900 dark:bg-amber-300 dark:text-amber-950',
  },
  red: {
    fill: 'bg-rose-100 dark:bg-rose-500/20',
    border: 'border-rose-400 dark:border-rose-400/70',
    text: 'text-rose-900 dark:text-rose-100',
    sticky: 'bg-rose-200 text-rose-900 dark:bg-rose-300 dark:text-rose-950',
  },
  violet: {
    fill: 'bg-violet-100 dark:bg-violet-500/20',
    border: 'border-violet-400 dark:border-violet-400/70',
    text: 'text-violet-900 dark:text-violet-100',
    sticky: 'bg-violet-200 text-violet-900 dark:bg-violet-300 dark:text-violet-950',
  },
}

const shape = computed(() => props.data.shape)
const palette = computed(() => colorStyles[props.data.color])

// Text nodes are pure labels — no fill, no border, no handles.
const connectable = computed(() => shape.value !== 'text')

// Four handles, one per side. In ConnectionMode.Loose any handle can act as
// source OR target, so the user can drag an edge from any side of any node
// and drop it on any side of any other node — Excalidraw/Miro style.
const sideHandles = [
  { id: 'top', position: Position.Top, cls: 'handle-top' },
  { id: 'right', position: Position.Right, cls: 'handle-right' },
  { id: 'bottom', position: Position.Bottom, cls: 'handle-bottom' },
  { id: 'left', position: Position.Left, cls: 'handle-left' },
] as const

// Literal lookup maps (UnoCSS only generates classes it can scan as static
// strings — building these via template interpolation wouldn't work).
const STROKE_WIDTH_CLASS: Record<StrokeWidth, string> = {
  thin: 'border',
  medium: 'border-2',
  thick: 'border-4',
}

const STROKE_STYLE_CLASS: Record<StrokeStyle, string> = {
  solid: 'border-solid',
  dashed: 'border-dashed',
  dotted: 'border-dotted',
}

// Per-shape background classes (includes a `shape-*` hook used by sketch CSS).
const shapeClasses = computed(() => {
  const c = palette.value
  const transparent = props.data.fillStyle === 'transparent'
  const sw = STROKE_WIDTH_CLASS[props.data.strokeWidth]
  const ss = STROKE_STYLE_CLASS[props.data.strokeStyle]
  switch (shape.value) {
    case 'ellipse':
      return ['shape-ellipse', 'rounded-[50%]', sw, ss, transparent ? '' : c.fill, c.border]
    case 'diamond':
      return ['shape-diamond', 'rotate-45 rounded-lg', sw, ss, transparent ? '' : c.fill, c.border]
    case 'sticky':
      // Sticky has no border in its solid look; "transparent" hides the fill.
      return ['shape-sticky', 'rounded-md shadow-lg', transparent ? '' : c.sticky]
    case 'text':
      return ['shape-text', 'border-0 bg-transparent']
    default:
      return ['shape-rectangle', 'rounded-xl', sw, ss, transparent ? '' : c.fill, c.border]
  }
})

const opacityValue = computed(() => props.data.opacity / 100)

const labelClasses = computed(() => {
  if (shape.value === 'sticky') return `${palette.value.sticky} bg-transparent dark:bg-transparent`
  if (shape.value === 'text') return `${palette.value.text} text-base`
  return palette.value.text
})

const variantBadge = computed(() => {
  if (props.data.variant === 'input') return 'Input'
  if (props.data.variant === 'output') return 'Output'
  return ''
})

// ---- Resize (mouse-driven, persisted to the store) --------------------------
function onResizeStart() {
  store.commit()
}

function onResize({ params }: OnResize) {
  store.setNodeRect(props.id, {
    x: params.x,
    y: params.y,
    width: params.width,
    height: params.height,
  })
}

// ---- Inline label editing ---------------------------------------------------
async function startEditing() {
  if (editing.value) return // already editing — don't discard the in-progress draft
  draft.value = props.data.label
  editing.value = true
  await nextTick()
  inputRef.value?.focus()
  inputRef.value?.select()
}

function commitEditing() {
  if (!editing.value) return
  // Allow clearing to empty — a node isn't forced to carry a word.
  store.updateNodeLabel(props.id, draft.value.trim())
  editing.value = false
}

function cancelEditing() {
  editing.value = false
}

// A just-created node opens straight into editing so you can type its name,
// and plays a brief scale-in animation.
onMounted(() => {
  if (store.takeEditNode(props.id)) {
    justCreated.value = true
    startEditing()
  }
})
</script>

<template>
  <div
    class="relative flex h-full w-full items-center justify-center"
    :class="{ 'node-pop': justCreated }"
    title="Double-click to edit"
    @dblclick.stop="startEditing"
  >
    <!-- Suppress the resize frame on text shapes while typing — otherwise its
         line / corner squares look like a box around the text. -->
    <NodeResizer
      v-if="props.selected && !(shape === 'text' && editing)"
      :min-width="60"
      :min-height="36"
      :node-id="props.id"
      @resize-start="onResizeStart"
      @resize="onResize"
    />

    <template v-if="connectable">
      <Handle
        v-for="h in sideHandles"
        :key="h.id"
        :id="h.id"
        type="source"
        :position="h.position"
        :class="['handle-side', h.cls]"
      />
    </template>

    <!-- The drawn shape (fill / border) sits behind the label. The dashed
         text-selection outline is suppressed while editing so typing feels
         box-less. -->
    <div
      class="diagram-shape absolute inset-0 transition-shadow duration-150"
      :class="[
        ...shapeClasses,
        props.selected && !(shape === 'text' && editing) ? 'is-selected' : '',
      ]"
      :style="{ opacity: opacityValue }"
    />

    <!-- Label overlay, always upright (even on a rotated diamond).
         Text shapes use zero padding + auto-width so the typed content drives
         the node's footprint (Excalidraw-style); all other shapes get the
         usual centred padded label. -->
    <div
      class="relative z-10 flex flex-col"
      :class="
        shape === 'text'
          ? 'items-start'
          : 'max-w-full items-center px-3 py-1.5 text-center'
      "
      :style="{ opacity: opacityValue }"
    >
      <span
        v-if="variantBadge"
        class="mb-0.5 text-[10px] font-semibold uppercase tracking-wider opacity-60"
        :class="labelClasses"
      >
        {{ variantBadge }}
      </span>

      <input
        v-if="editing"
        ref="inputRef"
        v-model="draft"
        type="text"
        :size="shape === 'text' ? Math.max(draft.length || 4, 4) : undefined"
        class="text-sm font-semibold outline-none"
        :class="[
          labelClasses,
          shape === 'text'
            // Borderless / transparent so typing a text shape feels like
            // writing directly on the canvas — no input box around it.
            // `size` attribute drives width so the input grows with content.
            ? 'border-0 bg-transparent px-0 py-0 text-left'
            : 'w-full rounded-md border border-indigo-300 bg-white/90 px-1.5 py-0.5 text-center text-slate-900 focus:border-indigo-500 dark:bg-slate-900/90 dark:text-slate-100',
        ]"
        @keydown.enter.prevent="commitEditing"
        @keydown.esc.prevent="cancelEditing"
        @blur="commitEditing"
      />
      <div
        v-else
        class="cursor-text select-none break-words text-sm font-semibold leading-snug"
        :class="[labelClasses, shape === 'text' ? '' : 'min-h-[1.25rem]']"
      >
        {{ props.data.label }}
      </div>
    </div>

  </div>
</template>
