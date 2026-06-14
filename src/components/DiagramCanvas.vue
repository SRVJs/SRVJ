<script setup lang="ts">
import { computed, markRaw, ref } from 'vue'
import { storeToRefs } from 'pinia'
import {
  VueFlow,
  useVueFlow,
  ConnectionMode,
  MarkerType,
  SelectionMode,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@vue-flow/core'

// Block self-loops — a node should never connect to itself (Excalidraw rule).
function isValidConnection(connection: Connection): boolean {
  return connection.source !== connection.target
}
import { Background } from '@vue-flow/background'
import { useDiagramStore } from '@/stores/diagram'
import { useDarkMode } from '@/composables/useDarkMode'
import { useEditorTool } from '@/composables/useEditorTool'
import type { NewNodeOptions } from '@/types/diagram'
import CustomNode from './CustomNode.vue'
import ZoomBar from './ZoomBar.vue'

const store = useDiagramStore()
const { nodes, edges } = storeToRefs(store)
const { isDark } = useDarkMode()
// Slightly dimmer dots in dark mode so they don't overpower the canvas.
const dotColor = computed(() => (isDark.value ? '#475569' : '#cbd5e1'))
const {
  activeTool,
  activeColor,
  activeFillStyle,
  activeStrokeStyle,
  activeStrokeWidth,
  activeOpacity,
  isSelectTool,
  resetTool,
} = useEditorTool()

// Bundle the current style defaults into the options for a new node, so the
// shape the user is about to create inherits the palette settings.
function currentStyleDefaults() {
  return {
    color: activeColor.value,
    fillStyle: activeFillStyle.value,
    strokeStyle: activeStrokeStyle.value,
    strokeWidth: activeStrokeWidth.value,
    opacity: activeOpacity.value,
  }
}

// Register the single custom node implementation. `markRaw` prevents Vue from
// making the component definition itself reactive.
const nodeTypes = {
  custom: markRaw(CustomNode),
}

const { screenToFlowCoordinate, onConnect } = useVueFlow()

// Only fit-view on init when we actually loaded a saved diagram. Otherwise
// Vue Flow fires fitView the moment the user creates their first node and
// zooms in onto that single shape — a confusing surprise.
const fitViewOnInit = store.nodes.length > 0

onConnect((connection: Connection) => store.onConnect(connection))

function handleNodesChange(changes: NodeChange[]) {
  store.onNodesChange(changes)
}

function handleEdgesChange(changes: EdgeChange[]) {
  store.onEdgesChange(changes)
}

// Snapshot before a drag so the whole move is a single undoable step.
function handleNodeDragStart() {
  store.commit()
}

// ---- Draw-to-create (Excalidraw-style) --------------------------------------
const wrapperRef = ref<HTMLElement | null>(null)
const isDrawing = ref(false)
const startPt = ref({ x: 0, y: 0 })
const currPt = ref({ x: 0, y: 0 })

const previewStyle = computed(() => {
  const el = wrapperRef.value
  if (!isDrawing.value || !el) return { display: 'none' }
  const rect = el.getBoundingClientRect()
  return {
    left: `${Math.min(startPt.value.x, currPt.value.x) - rect.left}px`,
    top: `${Math.min(startPt.value.y, currPt.value.y) - rect.top}px`,
    width: `${Math.abs(currPt.value.x - startPt.value.x)}px`,
    height: `${Math.abs(currPt.value.y - startPt.value.y)}px`,
  }
})

function onPointerDown(event: PointerEvent) {
  // Only draw when a shape tool is active and the press starts on the canvas.
  if (isSelectTool.value || event.button !== 0) return
  if (!(event.target as HTMLElement).closest('.vue-flow__pane')) return
  event.preventDefault()
  event.stopPropagation()
  startPt.value = { x: event.clientX, y: event.clientY }
  currPt.value = { x: event.clientX, y: event.clientY }
  isDrawing.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (!isDrawing.value) return
  currPt.value = { x: event.clientX, y: event.clientY }
}

function onPointerUp() {
  if (!isDrawing.value) return
  isDrawing.value = false
  const tool = activeTool.value
  if (tool === 'select') return

  const start = screenToFlowCoordinate({ x: startPt.value.x, y: startPt.value.y })
  const end = screenToFlowCoordinate({ x: currPt.value.x, y: currPt.value.y })
  const width = Math.abs(end.x - start.x)
  const height = Math.abs(end.y - start.y)

  const base = { shape: tool.shape, variant: tool.variant, ...currentStyleDefaults() }
  if (width < 12 || height < 12) {
    // Treated as a click → drop a default-sized node at the point.
    store.addNode({ ...base, position: { x: start.x, y: start.y } })
  } else {
    store.addNode({
      ...base,
      position: { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) },
      width,
      height,
    })
  }
  resetTool() // back to the select cursor, like Excalidraw
}

// ---- Drag & drop from the palette -------------------------------------------
function handleDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function handleDrop(event: DragEvent) {
  const raw = event.dataTransfer?.getData('application/diagram-node')
  if (!raw) return
  let payload: NewNodeOptions
  try {
    payload = JSON.parse(raw) as NewNodeOptions
  } catch {
    return
  }
  const position = screenToFlowCoordinate({ x: event.clientX, y: event.clientY })
  // Drop payload supplies shape/variant/color; the rest of the active style
  // defaults (fill, stroke, opacity) come from the editor tool refs.
  store.addNode({ ...currentStyleDefaults(), ...payload, position })
}
</script>

<template>
  <div
    ref="wrapperRef"
    class="relative h-full w-full"
    :class="isSelectTool ? '' : 'cursor-crosshair'"
    @dragover="handleDragOver"
    @drop="handleDrop"
    @pointerdown.capture="onPointerDown"
    @pointermove.capture="onPointerMove"
    @pointerup.capture="onPointerUp"
  >
    <VueFlow
      :nodes="nodes"
      :edges="edges"
      :node-types="nodeTypes"
      :default-edge-options="{ type: 'straight', markerEnd: MarkerType.ArrowClosed }"
      :connection-mode="ConnectionMode.Loose"
      :connection-radius="160"
      :is-valid-connection="isValidConnection"
      :min-zoom="0.2"
      :max-zoom="4"
      :delete-key-code="null"
      :selection-key-code="isSelectTool ? true : null"
      :selection-mode="SelectionMode.Partial"
      :pan-on-drag="isSelectTool ? [1, 2] : false"
      :nodes-draggable="isSelectTool"
      :elements-selectable="isSelectTool"
      :fit-view-on-init="fitViewOnInit"
      class="diagram-flow"
      @nodes-change="handleNodesChange"
      @edges-change="handleEdgesChange"
      @node-drag-start="handleNodeDragStart"
    >
      <Background :gap="22" :size="1.2" :pattern-color="dotColor" />
      <ZoomBar />

      <template v-if="nodes.length === 0">
        <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div class="text-center text-slate-400 dark:text-slate-500">
            <span class="i-carbon-flow mx-auto mb-2 block text-4xl" aria-hidden="true" />
            <p class="text-base font-medium">Your canvas is empty</p>
            <p class="mt-1 text-sm">
              Pick a shape from the toolbox, then drag on the canvas to draw it.
            </p>
          </div>
        </div>
      </template>
    </VueFlow>

    <!-- Live preview while drawing a new shape (dashed, Excalidraw-style). -->
    <div
      v-show="isDrawing"
      class="pointer-events-none absolute z-20 rounded-md border-[1.5px] border-dashed border-indigo-400 bg-indigo-400/5"
      :style="previewStyle"
    />
  </div>
</template>
