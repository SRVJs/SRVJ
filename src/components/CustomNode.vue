<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { Handle, Position, type NodeProps } from '@vue-flow/core'
import { NodeResizer, type OnResize } from '@vue-flow/node-resizer'
import type {
  DiagramNodeData,
  ErdField,
  NodeColor,
  StrokeStyle,
  StrokeWidth,
} from '@/types/diagram'
import { nodeHandleDescriptors, type HandleSide } from '@/utils/handles'
import { PEN_SIZE, strokeGeometry } from '@/utils/freehand'
import { useDiagramStore } from '@/stores/diagram'

const props = defineProps<NodeProps<DiagramNodeData>>()
const store = useDiagramStore()

const editing = ref(false)
const draft = ref('')
const inputRef = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)
// Briefly true for nodes that were just created via the palette / draw —
// drives the Excalidraw-style scale-in animation. Stays unset for nodes
// restored from a snapshot or recreated by undo/redo, so those don't pop.
const justCreated = ref(false)

interface ColorStyle {
  fill: string
  border: string
  text: string
  sticky: string // solid Miro-style sticky fill + readable text
  header: string // solid accent fill for the ERD table header bar (white text)
}

// Excalidraw-like pastel palette (light + dark variants baked in).
const colorStyles: Record<NodeColor, ColorStyle> = {
  slate: {
    fill: 'bg-white dark:bg-slate-800',
    border: 'border-slate-400 dark:border-slate-500',
    text: 'text-slate-700 dark:text-slate-100',
    sticky: 'bg-slate-200 text-slate-800 dark:bg-slate-300 dark:text-slate-900',
    header: 'bg-slate-600',
  },
  blue: {
    fill: 'bg-sky-100 dark:bg-sky-500/20',
    border: 'border-sky-400 dark:border-sky-400/70',
    text: 'text-sky-900 dark:text-sky-100',
    sticky: 'bg-sky-200 text-sky-900 dark:bg-sky-300 dark:text-sky-950',
    header: 'bg-sky-500',
  },
  green: {
    fill: 'bg-emerald-100 dark:bg-emerald-500/20',
    border: 'border-emerald-400 dark:border-emerald-400/70',
    text: 'text-emerald-900 dark:text-emerald-100',
    sticky: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-300 dark:text-emerald-950',
    header: 'bg-emerald-500',
  },
  yellow: {
    fill: 'bg-amber-100 dark:bg-amber-500/20',
    border: 'border-amber-400 dark:border-amber-400/70',
    text: 'text-amber-900 dark:text-amber-100',
    sticky: 'bg-amber-200 text-amber-900 dark:bg-amber-300 dark:text-amber-950',
    header: 'bg-amber-500',
  },
  red: {
    fill: 'bg-rose-100 dark:bg-rose-500/20',
    border: 'border-rose-400 dark:border-rose-400/70',
    text: 'text-rose-900 dark:text-rose-100',
    sticky: 'bg-rose-200 text-rose-900 dark:bg-rose-300 dark:text-rose-950',
    header: 'bg-rose-500',
  },
  violet: {
    fill: 'bg-violet-100 dark:bg-violet-500/20',
    border: 'border-violet-400 dark:border-violet-400/70',
    text: 'text-violet-900 dark:text-violet-100',
    sticky: 'bg-violet-200 text-violet-900 dark:bg-violet-300 dark:text-violet-950',
    header: 'bg-violet-500',
  },
}

const shape = computed(() => props.data.shape)
const palette = computed(() => colorStyles[props.data.color])

// Text nodes are pure labels and freehand strokes are pure ink — neither takes
// connection handles.
const connectable = computed(() => shape.value !== 'text' && shape.value !== 'draw')

// ---- Freehand pen stroke (the `draw` shape) ---------------------------------
// Per-colour ink (a saturated `currentColor` for the filled stroke path).
const INK_CLASS: Record<NodeColor, string> = {
  slate: 'text-slate-700 dark:text-slate-200',
  blue: 'text-sky-500 dark:text-sky-400',
  green: 'text-emerald-500 dark:text-emerald-400',
  yellow: 'text-amber-500 dark:text-amber-400',
  red: 'text-rose-500 dark:text-rose-400',
  violet: 'text-violet-500 dark:text-violet-400',
}
const inkClass = computed(() => INK_CLASS[props.data.color])

// Rebuild the stroke outline from the saved points. Deterministic, so it matches
// the node's measured size; the SVG viewBox maps that outline onto the box and
// `preserveAspectRatio="none"` lets the stroke scale when the node is resized.
const drawGeo = computed(() =>
  shape.value === 'draw'
    ? strokeGeometry(props.data.points ?? [], PEN_SIZE[props.data.strokeWidth])
    : null,
)
const drawPath = computed(() => drawGeo.value?.d ?? '')
const drawViewBox = computed(() => {
  const g = drawGeo.value
  return g ? `${g.minX} ${g.minY} ${g.width} ${g.height}` : '0 0 1 1'
})

// Multiple invisible anchor handles per side (centre + two offset points) so
// arrows drawn by the toolbar Arrow tool fan out across a side instead of all
// stacking on its midpoint. The handles are hidden (see `.handle-side` in CSS);
// the store distributes new edges across these ids via `nextAnchorOnSide`.
const POSITION_BY_SIDE: Record<HandleSide, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
}
const handleDescriptors = nodeHandleDescriptors()

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
    case 'attribute': // ERD attribute = plain ellipse
      return ['shape-ellipse', 'rounded-[50%]', sw, ss, transparent ? '' : c.fill, c.border]
    case 'diamond':
    case 'relationship': // ERD relationship = plain diamond
      return ['shape-diamond', 'rotate-45 rounded-xl', sw, ss, transparent ? '' : c.fill, c.border]
    case 'sticky':
      // Sticky has no border in its solid look; "transparent" hides the fill.
      return ['shape-sticky', 'rounded-lg shadow-xl', transparent ? '' : c.sticky]
    case 'text':
      return ['shape-text', 'border-0 bg-transparent']
    // ----- ERD (Chen notation) -----
    // Weak entity / weak (identifying) relationship → a double border. Key /
    // multivalued / derived attributes are ellipse variants. The double + dashed
    // ERD borders are fixed (not driven by the stroke controls) so the notation
    // stays recognisable.
    case 'weak-entity':
      return ['shape-weak-entity', 'rounded-2xl border-4 border-double', transparent ? '' : c.fill, c.border]
    case 'weak-relationship':
      return ['shape-weak-relationship', 'rotate-45 rounded-lg border-4 border-double', transparent ? '' : c.fill, c.border]
    case 'key-attribute':
      return ['shape-key-attribute', 'rounded-[50%]', sw, ss, transparent ? '' : c.fill, c.border]
    case 'multivalued-attribute':
      return ['shape-multivalued-attribute', 'rounded-[50%] border-4 border-double', transparent ? '' : c.fill, c.border]
    case 'derived-attribute':
      return ['shape-derived-attribute', 'rounded-[50%] border-2 border-dashed', transparent ? '' : c.fill, c.border]
    default:
      return ['shape-rectangle', 'rounded-3xl', sw, ss, transparent ? '' : c.fill, c.border]
  }
})

const opacityValue = computed(() => props.data.opacity / 100)

// Flip (mirror) the node content via a CSS transform set from the menu.
const flipTransform = computed(() => {
  const sx = props.data.flipX ? -1 : 1
  const sy = props.data.flipY ? -1 : 1
  return sx === 1 && sy === 1 ? undefined : `scale(${sx}, ${sy})`
})

// Lock state lives on the node (not its data); read it from the store so the
// component can show the badge + block inline editing.
const isLocked = computed(() => store.nodes.find((n) => n.id === props.id)?.locked ?? false)

// Optional hyperlink — opened in a new tab when its badge is clicked.
const link = computed(() => props.data.link ?? '')
function openLink() {
  if (link.value) window.open(link.value, '_blank', 'noopener,noreferrer')
}

const labelClasses = computed(() => {
  if (shape.value === 'sticky') return `${palette.value.sticky} bg-transparent dark:bg-transparent`
  if (shape.value === 'text') return `${palette.value.text} text-base`
  // ERD key attribute → underlined label (the classic key-attribute notation).
  if (shape.value === 'key-attribute') return `${palette.value.text} underline underline-offset-4`
  return palette.value.text
})

// Crow's-foot table rows (only meaningful for the `table` shape).
const fields = computed<ErdField[]>(() => props.data.fields ?? [])

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
function focusInput() {
  inputRef.value?.focus()
  inputRef.value?.select()
}

// While true, a `blur` on the label input is treated as spurious (Vue Flow
// grabbing focus right after the creating pointer-up) and is ignored — we
// refocus instead of committing, so a just-placed node opens straight into
// typing. Cleared shortly after, so a real click-away then commits normally.
const autoEditGrace = ref(false)

// Auto-grow the text-shape textarea by tracking content: a row per line and a
// column count from the longest line (min 4, so a fresh caret has room).
const textRows = computed(() => Math.max(draft.value.split('\n').length, 1))
const textCols = computed(() =>
  Math.max(...draft.value.split('\n').map((line) => line.length), 4),
)

async function startEditing(autoFocusGrace = false) {
  if (shape.value === 'draw') return // freehand strokes carry no label
  if (isLocked.value) return // locked nodes can't be edited
  if (editing.value) return // already editing — don't discard the in-progress draft
  draft.value = props.data.label
  editing.value = true
  if (autoFocusGrace) {
    autoEditGrace.value = true
    setTimeout(() => (autoEditGrace.value = false), 350)
  }
  await nextTick()
  focusInput()
}

/**
 * `blur` on the label input. Right after a node is created, Vue Flow processes
 * the same pointer-up to select it and steals focus — firing a blur before the
 * user can type. During the brief post-creation grace we refocus instead of
 * committing; otherwise a genuine click-away commits the label.
 */
function onLabelBlur() {
  if (autoEditGrace.value && editing.value) {
    requestAnimationFrame(focusInput)
    return
  }
  commitEditing()
}

function commitEditing() {
  if (!editing.value) return
  editing.value = false
  const text = draft.value.trim()
  // Excalidraw-style: a text element finished with no content is discarded
  // rather than left on the canvas as an empty box. Other shapes keep their
  // (possibly empty) label — the shape itself is the artefact.
  if (shape.value === 'text' && text === '') {
    store.removeNode(props.id)
    return
  }
  store.updateNodeLabel(props.id, text)
}

function cancelEditing() {
  editing.value = false
}

// ---- Crow's-foot table field editing ----------------------------------------
const editingFieldId = ref<string | null>(null)
const fieldDraft = ref('')
const fieldInputRef = ref<HTMLInputElement | null>(null)

// Function ref (the editing input lives inside a v-for, so a string ref would
// become an array — this captures just the one that's currently rendered).
function setFieldInput(el: Element | null) {
  if (el) fieldInputRef.value = el as HTMLInputElement
}

async function startFieldEdit(field: ErdField) {
  editingFieldId.value = field.id
  fieldDraft.value = field.name
  await nextTick()
  fieldInputRef.value?.focus()
  fieldInputRef.value?.select()
}

function commitFieldEdit() {
  const id = editingFieldId.value
  if (!id) return
  store.updateTableField(props.id, id, { name: fieldDraft.value.trim() })
  editingFieldId.value = null
}

function cancelFieldEdit() {
  editingFieldId.value = null
}

// ---- Crow's-foot field *type* editing (the right-hand column) ----------------
const editingTypeId = ref<string | null>(null)
const typeDraft = ref('')
const typeInputRef = ref<HTMLInputElement | null>(null)

function setTypeInput(el: Element | null) {
  if (el) typeInputRef.value = el as HTMLInputElement
}

async function startTypeEdit(field: ErdField) {
  editingTypeId.value = field.id
  typeDraft.value = field.type ?? ''
  await nextTick()
  typeInputRef.value?.focus()
  typeInputRef.value?.select()
}

function commitTypeEdit() {
  const id = editingTypeId.value
  if (!id) return
  store.updateTableField(props.id, id, { type: typeDraft.value.trim() })
  editingTypeId.value = null
}

function cancelTypeEdit() {
  editingTypeId.value = null
}

async function addField() {
  store.addTableField(props.id)
  await nextTick()
  const last = fields.value[fields.value.length - 1]
  if (last) startFieldEdit(last)
}

function cycleKey(field: ErdField) {
  store.cycleTableFieldKey(props.id, field.id)
}

function removeField(field: ErdField) {
  if (editingFieldId.value === field.id) editingFieldId.value = null
  store.removeTableField(props.id, field.id)
}

// A just-created node opens straight into editing so you can type its name,
// and plays a brief scale-in animation.
onMounted(() => {
  if (store.takeEditNode(props.id)) {
    justCreated.value = true
    startEditing(true)
  }
})
</script>

<template>
  <div
    class="relative flex h-full w-full items-center justify-center"
    :class="{ 'node-pop': justCreated }"
    :style="{ transform: flipTransform }"
    title="Double-click to edit"
    @dblclick.stop="startEditing()"
  >
    <!-- Lock badge (top-left) — right-click → Unlock to release it. -->
    <span
      v-if="isLocked"
      class="i-mdi-lock absolute -left-2 -top-2 z-20 text-sm text-slate-400 dark:text-slate-500"
      aria-hidden="true"
    />

    <!-- Hyperlink badge (top-right) — click to open in a new tab. -->
    <button
      v-if="link"
      type="button"
      title="Open link"
      aria-label="Open link"
      class="i-mdi-link-variant absolute -right-2 -top-2 z-20 text-sm text-indigo-400 hover:text-indigo-500 dark:text-indigo-300"
      @click.stop="openLink"
      @pointerdown.stop
    />
    <!-- Suppress the resize frame on text shapes while typing — otherwise its
         line / corner squares look like a box around the text. Freehand pen
         strokes are never resizable: they keep the exact position + size they
         were drawn at (resizing would stretch/distort the ink). -->
    <NodeResizer
      v-if="props.selected && shape !== 'draw' && !(shape === 'text' && editing)"
      :min-width="60"
      :min-height="36"
      :node-id="props.id"
      @resize-start="onResizeStart"
      @resize="onResize"
    />

    <template v-if="connectable">
      <Handle
        v-for="h in handleDescriptors"
        :key="h.id"
        :id="h.id"
        type="source"
        :position="POSITION_BY_SIDE[h.side]"
        class="handle-side"
        :style="{ [h.axis]: `${h.offset}%` }"
      />
    </template>

    <!-- ===== Freehand pen stroke: a filled SVG path, pure ink (no box/label) ===== -->
    <svg
      v-if="shape === 'draw'"
      class="diagram-shape draw-shape absolute inset-0 h-full w-full overflow-visible"
      :class="[inkClass, props.selected ? 'is-selected' : '']"
      :viewBox="drawViewBox"
      preserveAspectRatio="none"
      :style="{ opacity: opacityValue }"
    >
      <path :d="drawPath" fill="currentColor" />
    </svg>

    <!-- ===== Non-table shapes: drawn shape (fill / border) + centred label ===== -->
    <template v-else-if="shape !== 'table'">
      <!-- The drawn shape sits behind the label. The dashed text-selection
           outline is suppressed while editing so typing feels box-less. -->
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

        <!-- Text shape: a borderless multi-line textarea so typing feels like
             writing directly on the canvas (Excalidraw-style). Enter inserts a
             newline; Escape / click-away finishes (an empty result is discarded
             in commitEditing). `rows`/`cols` track the content so it grows. -->
        <textarea
          v-if="editing && shape === 'text'"
          ref="inputRef"
          v-model="draft"
          :rows="textRows"
          :cols="textCols"
          class="resize-none overflow-hidden whitespace-pre border-0 bg-transparent px-0 py-0 text-left text-sm font-semibold leading-snug outline-none"
          :class="labelClasses"
          @keydown.esc.prevent="commitEditing"
          @blur="onLabelBlur"
        />
        <!-- Other shapes: single-line label typed directly on the shape fill. -->
        <input
          v-else-if="editing"
          ref="inputRef"
          v-model="draft"
          type="text"
          class="w-full border-0 bg-transparent px-1.5 py-0.5 text-center text-sm font-semibold outline-none"
          :class="labelClasses"
          @keydown.enter.prevent="commitEditing"
          @keydown.esc.prevent="cancelEditing"
          @blur="onLabelBlur"
        />
        <div
          v-else
          class="cursor-text select-none break-words text-sm font-semibold leading-snug"
          :class="[labelClasses, shape === 'text' ? 'whitespace-pre-wrap text-left' : 'min-h-[1.25rem]']"
        >
          {{ props.data.label }}
        </div>
      </div>
    </template>

    <!-- ===== Crow's-foot ERD entity table ===== -->
    <!-- In normal flow (not absolute) so the node grows to fit every row and the
         "+ field" button — otherwise the bottom rows are clipped + unclickable. -->
    <div
      v-else
      class="erd-table relative flex w-full flex-col overflow-hidden rounded-xl border-2 bg-white text-left shadow-xl dark:bg-slate-800"
      :class="[palette.border, props.selected ? 'ring-2 ring-indigo-400 dark:ring-indigo-500' : '']"
      :style="{ opacity: opacityValue }"
    >
      <!-- Entity name on a solid accent bar (double-click to rename). Drag the
           table by this header. -->
      <div
        class="erd-table__header flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-bold text-white"
        :class="palette.header"
        @dblclick.stop="startEditing()"
      >
        <span class="i-mdi-table-large shrink-0 text-base opacity-90" aria-hidden="true" />
        <input
          v-if="editing"
          ref="inputRef"
          v-model="draft"
          type="text"
          class="w-full border-0 bg-transparent font-bold text-white outline-none placeholder:text-white/60"
          @keydown.enter.prevent="commitEditing"
          @keydown.esc.prevent="cancelEditing"
          @blur="onLabelBlur"
        />
        <span v-else class="truncate">{{ props.data.label || 'Entity' }}</span>
      </div>

      <!-- Field rows -->
      <ul class="nodrag divide-y divide-slate-100 text-xs dark:divide-slate-700" :class="palette.text">
        <li
          v-for="f in fields"
          :key="f.id"
          class="group flex items-center gap-1.5 px-2 py-1.5"
        >
          <!-- Key role: click to cycle none → PK → FK → none. -->
          <button
            type="button"
            title="Toggle PK / FK"
            class="shrink-0 text-sm leading-none"
            :class="
              f.key === 'PK'
                ? 'i-mdi-key text-amber-500'
                : f.key === 'FK'
                  ? 'i-mdi-key-link text-sky-500'
                  : 'i-mdi-key-outline text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400'
            "
            @click.stop="cycleKey(f)"
          />

          <input
            v-if="editingFieldId === f.id"
            :ref="(el) => setFieldInput(el as Element | null)"
            v-model="fieldDraft"
            type="text"
            class="min-w-0 flex-1 border-0 bg-transparent font-medium outline-none"
            @keydown.enter.prevent="commitFieldEdit"
            @keydown.esc.prevent="cancelFieldEdit"
            @blur="commitFieldEdit"
          />
          <span
            v-else
            class="min-w-0 flex-1 cursor-text truncate font-medium"
            :class="f.name ? '' : 'text-slate-400 dark:text-slate-500'"
            @click.stop="startFieldEdit(f)"
          >
            {{ f.name || 'field' }}
          </span>

          <!-- Data type column (click to edit). -->
          <input
            v-if="editingTypeId === f.id"
            :ref="(el) => setTypeInput(el as Element | null)"
            v-model="typeDraft"
            type="text"
            placeholder="type"
            class="w-16 min-w-0 shrink-0 border-0 bg-transparent text-right text-slate-400 outline-none dark:text-slate-400"
            @keydown.enter.prevent="commitTypeEdit"
            @keydown.esc.prevent="cancelTypeEdit"
            @blur="commitTypeEdit"
          />
          <span
            v-else
            class="max-w-[88px] shrink-0 cursor-text truncate text-right text-[11px] text-slate-400 opacity-0 transition group-hover:opacity-100 dark:text-slate-500"
            :class="f.type ? 'opacity-100' : ''"
            @click.stop="startTypeEdit(f)"
          >
            {{ f.type || 'type' }}
          </span>

          <button
            type="button"
            title="Remove field"
            aria-label="Remove field"
            class="i-mdi-close shrink-0 text-sm text-slate-300 opacity-0 transition hover:text-rose-500 group-hover:opacity-100 dark:text-slate-600"
            @click.stop="removeField(f)"
          />
        </li>
      </ul>

      <!-- Add field -->
      <button
        type="button"
        class="nodrag flex items-center justify-center gap-0.5 border-t border-slate-100 py-1 text-[11px] font-medium text-slate-400 transition hover:bg-slate-50 hover:text-indigo-500 dark:border-slate-700 dark:hover:bg-slate-700/40"
        @click.stop="addField"
      >
        <span class="i-mdi-plus" aria-hidden="true" /> field
      </button>
    </div>

  </div>
</template>
