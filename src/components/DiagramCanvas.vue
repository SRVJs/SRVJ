<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
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
import { PEN_SIZE, strokeGeometry } from '@/utils/freehand'
import type { NewNodeOptions } from '@/types/diagram'
import { usePresence } from '@/composables/usePresence'
import { useRoomIdentity } from '@/composables/useRoomIdentity'
import CustomNode from './CustomNode.vue'
import CustomEdge from './CustomEdge.vue'
import ZoomBar from './ZoomBar.vue'
import ContextMenu, { type MenuItem } from './ContextMenu.vue'
import PresenceCursors from './PresenceCursors.vue'

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
  activeCardinality,
  isSelectTool,
  isConnectTool,
  isDrawTool,
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

// Single custom edge type — straight line with an inline-editable label.
const edgeTypes = {
  custom: markRaw(CustomEdge),
}

const { screenToFlowCoordinate, viewport, onConnect, onNodeClick } = useVueFlow()

// ---- Live collaboration cursors (CRDT presence) -----------------------------
// Everyone in a room broadcasts their cursor over Yjs awareness. The room is the
// shared `?room=` id (Share button), falling back to the diagram id so opening
// the same `/editor/:id` already puts collaborators in one channel. The local
// user's cursor is published in flow coords; remote peers render via the overlay.
const route = useRoute()
const roomId = computed<string | null>(() => {
  const room = route.query.room
  if (typeof room === 'string' && room) return room
  const id = route.params.diagramId
  return typeof id === 'string' && id ? id : null
})
const diagramId = computed(() => {
  const id = route.params.diagramId
  return typeof id === 'string' && id ? id : null
})
const { identity, ensureOwnershipResolved } = useRoomIdentity(diagramId)
const { peers: roomPeers, setCursor } = usePresence(roomId, identity)

// Throttle cursor broadcasts to one per animation frame (awareness floods fast).
let cursorRaf = 0
function broadcastCursor(event: PointerEvent) {
  if (!roomId.value || cursorRaf) return
  const { clientX, clientY } = event
  cursorRaf = requestAnimationFrame(() => {
    cursorRaf = 0
    setCursor(screenToFlowCoordinate({ x: clientX, y: clientY }))
  })
}

function onPointerLeave() {
  if (cursorRaf) {
    cancelAnimationFrame(cursorRaf)
    cursorRaf = 0
  }
  setCursor(null)
}

// ---- Arrow / connector tool -------------------------------------------------
// With the arrow tool active, click a source node then a target node to draw an
// arrow between them. The pending source is cleared on a blank-canvas click, on
// Escape, or when the tool is switched off.
const connectSource = ref<string | null>(null)

onNodeClick(({ node }) => {
  if (!isConnectTool.value) return
  if (!connectSource.value) {
    connectSource.value = node.id
    return
  }
  store.connectNodes(connectSource.value, node.id, activeCardinality.value)
  connectSource.value = null
})

watch(isConnectTool, (on) => {
  if (!on) connectSource.value = null
})

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

// ---- Hold-space to pan (Figma/Excalidraw-style) -----------------------------
// While the space bar is held, the canvas enters a temporary "hand" mode:
// dragging anywhere pans the viewport (even with a shape tool active) and
// drawing/selection are suppressed so the drag never creates or moves a node.
const isSpacePanning = ref(false)

// Don't hijack the space bar when a control is focused — space still needs to
// type into fields and activate focused buttons/links for keyboard users.
function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'button' ||
    tag === 'a' ||
    tag === 'select' ||
    target.isContentEditable ||
    target.getAttribute('role') === 'button'
  )
}

function onKeyDown(event: KeyboardEvent) {
  // Escape leaves the arrow tool (and drops any pending source).
  if (event.code === 'Escape' && isConnectTool.value) {
    connectSource.value = null
    resetTool()
    return
  }
  if (event.code !== 'Space' || event.repeat) return
  if (isInteractiveTarget(event.target)) return
  // Stop the page from scrolling while space is used to pan.
  event.preventDefault()
  isSpacePanning.value = true
}

function onKeyUp(event: KeyboardEvent) {
  if (event.code !== 'Space') return
  isSpacePanning.value = false
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  // Pull the project list (if needed) so the owner's cursor resolves to "owner".
  ensureOwnershipResolved()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})

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

// ---- Freehand pen (draw tool) -----------------------------------------------
// While inking, raw pointer positions are collected as client coordinates. The
// live preview is rendered in wrapper-relative pixels (scaled by the current
// zoom so the ink thickness matches the committed stroke); on release the same
// points are converted to flow coordinates and handed to `store.addDrawNode`.
const isInking = ref(false)
const inkClient = ref<{ x: number; y: number }[]>([])

// SVG `d` for the in-progress stroke (empty until at least one point exists).
const inkPath = computed(() => {
  const el = wrapperRef.value
  if (!isInking.value || !el || inkClient.value.length === 0) return ''
  const rect = el.getBoundingClientRect()
  const rel = inkClient.value.map((p) => ({ x: p.x - rect.left, y: p.y - rect.top }))
  const size = PEN_SIZE[activeStrokeWidth.value] * (viewport.value?.zoom ?? 1)
  return strokeGeometry(rel, size).d
})

// CSS colour for the ink preview, mirroring CustomNode's per-colour ink.
const INK_COLOR: Record<string, string> = {
  slate: '#334155',
  blue: '#0ea5e9',
  green: '#10b981',
  yellow: '#f59e0b',
  red: '#f43f5e',
  violet: '#8b5cf6',
}
const inkColor = computed(() => INK_COLOR[activeColor.value] ?? INK_COLOR.slate)

function onPointerDown(event: PointerEvent) {
  // Space-pan takes over the drag entirely — never start drawing.
  if (isSpacePanning.value) return
  // Arrow tool: a click on blank canvas cancels a pending source; never draw.
  // (Clicks that land on a node are left for `onNodeClick` to handle — don't
  // clear the source here or the second click would never complete the arrow.)
  if (isConnectTool.value) {
    if (event.button === 0 && !(event.target as HTMLElement).closest('.vue-flow__node')) {
      connectSource.value = null
    }
    return
  }
  // Only draw when a shape/pen tool is active and the press starts on the canvas.
  if (isSelectTool.value || event.button !== 0) return
  if (!(event.target as HTMLElement).closest('.vue-flow__pane')) return
  event.preventDefault()
  event.stopPropagation()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)

  // Freehand pen: start a fresh stroke and collect points as the pointer moves.
  if (isDrawTool.value) {
    isInking.value = true
    inkClient.value = [{ x: event.clientX, y: event.clientY }]
    return
  }

  startPt.value = { x: event.clientX, y: event.clientY }
  currPt.value = { x: event.clientX, y: event.clientY }
  isDrawing.value = true
}

function onPointerMove(event: PointerEvent) {
  // Share the pointer with the room on every move (hover, drag, or draw).
  broadcastCursor(event)
  if (isInking.value) {
    inkClient.value = [...inkClient.value, { x: event.clientX, y: event.clientY }]
    return
  }
  if (!isDrawing.value) return
  currPt.value = { x: event.clientX, y: event.clientY }
}

function onPointerUp() {
  // Freehand pen: commit the collected stroke as a draw node. The pen tool
  // stays active so you can keep sketching stroke after stroke (Excalidraw-style).
  if (isInking.value) {
    isInking.value = false
    const points = inkClient.value.map((p) =>
      screenToFlowCoordinate({ x: p.x, y: p.y }),
    )
    inkClient.value = []
    store.addDrawNode({
      points,
      color: activeColor.value,
      strokeWidth: activeStrokeWidth.value,
      opacity: activeOpacity.value,
    })
    return
  }

  if (!isDrawing.value) return
  isDrawing.value = false
  const tool = activeTool.value
  // Only shape tools draw — `select` / `connect` are string modes.
  if (typeof tool === 'string') return

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

// ---- Right-click context menu (Excalidraw-style) ----------------------------
const menu = ref<{ x: number; y: number; nodeId: string } | null>(null)

function closeMenu() {
  menu.value = null
}

function onNodeContextMenu({ event, node }: { event: MouseEvent | TouchEvent; node: { id: string } }) {
  if (!(event instanceof MouseEvent)) return
  event.preventDefault()
  // Right-clicking an unselected node selects just it; clicking inside an
  // existing multi-selection keeps the selection so the menu acts on all of it.
  if (!store.nodes.find((n) => n.id === node.id)?.selected) store.selectOnly(node.id)
  menu.value = { x: event.clientX, y: event.clientY, nodeId: node.id }
}

function onSelectionContextMenu({ event }: { event: MouseEvent | TouchEvent }) {
  if (!(event instanceof MouseEvent)) return
  event.preventDefault()
  const id = store.selectedNodeIds[0]
  if (id) menu.value = { x: event.clientX, y: event.clientY, nodeId: id }
}

function onPaneContextMenu(event: MouseEvent | TouchEvent) {
  event.preventDefault()
  closeMenu()
}

const menuGroups = computed<MenuItem[][]>(() => {
  const node = menu.value && store.nodes.find((n) => n.id === menu.value!.nodeId)
  const locked = node?.locked ?? false
  const hasLink = !!node?.data.link
  return [
    [
      { key: 'send-backward', label: 'Send backward', shortcut: '⌘[' },
      { key: 'bring-forward', label: 'Bring forward', shortcut: '⌘]' },
      { key: 'send-to-back', label: 'Send to back', shortcut: '⌘⌥[' },
      { key: 'bring-to-front', label: 'Bring to front', shortcut: '⌘⌥]' },
    ],
    [
      { key: 'flip-h', label: 'Flip horizontal', shortcut: 'Shift+H' },
      { key: 'flip-v', label: 'Flip vertical', shortcut: 'Shift+V' },
    ],
    [
      { key: 'add-link', label: hasLink ? 'Edit link' : 'Add link', shortcut: '⌘K' },
      ...(hasLink ? [{ key: 'copy-link', label: 'Copy link to object' }] : []),
    ],
    [
      { key: 'duplicate', label: 'Duplicate', shortcut: '⌘D' },
      { key: 'lock', label: locked ? 'Unlock' : 'Lock', shortcut: '⌘⇧L' },
    ],
    [{ key: 'delete', label: 'Delete', shortcut: 'Del', danger: true }],
  ]
})

function onMenuSelect(key: string) {
  const id = menu.value?.nodeId
  switch (key) {
    case 'send-backward':
      store.arrangeNodes('backward')
      break
    case 'bring-forward':
      store.arrangeNodes('forward')
      break
    case 'send-to-back':
      store.arrangeNodes('back')
      break
    case 'bring-to-front':
      store.arrangeNodes('front')
      break
    case 'flip-h':
      store.flipNodes('horizontal')
      break
    case 'flip-v':
      store.flipNodes('vertical')
      break
    case 'duplicate':
      store.duplicateSelected()
      break
    case 'lock':
      store.toggleLock()
      break
    case 'delete':
      store.deleteSelected()
      break
    case 'add-link': {
      if (!id) break
      const node = store.nodes.find((n) => n.id === id)
      const url = window.prompt('Link URL', node?.data.link ?? 'https://')
      if (url !== null) store.setNodeLink(id, url.trim())
      break
    }
    case 'copy-link': {
      const node = id ? store.nodes.find((n) => n.id === id) : null
      if (node?.data.link) navigator.clipboard?.writeText(node.data.link).catch(() => {})
      break
    }
  }
  closeMenu()
}
</script>

<template>
  <div
    ref="wrapperRef"
    class="relative h-full w-full"
    :class="isSpacePanning ? 'cursor-grab' : isSelectTool ? '' : 'cursor-crosshair'"
    @dragover="handleDragOver"
    @drop="handleDrop"
    @pointerdown.capture="onPointerDown"
    @pointermove.capture="onPointerMove"
    @pointerup.capture="onPointerUp"
    @pointerleave="onPointerLeave"
  >
    <!-- Hand-drawn wobble filter, referenced by edge paths in sketch mode
         (Ref-2 Excalidraw look). Lives off-screen; only the def matters. -->
    <svg aria-hidden="true" class="pointer-events-none absolute h-0 w-0">
      <defs>
        <filter id="sketch-edge">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.5" />
        </filter>

        <!-- Crow's-foot ERD relationship markers. `auto-start-reverse` lets the
             same marker mirror correctly whether it sits at an edge's start or
             end, so one def serves both ends of a relationship. -->
        <marker
          id="erd-one"
          class="erd-marker"
          viewBox="0 0 14 14"
          refX="13"
          refY="7"
          markerWidth="16"
          markerHeight="16"
          markerUnits="userSpaceOnUse"
          orient="auto-start-reverse"
        >
          <path d="M 8 2 L 8 12" />
        </marker>
        <marker
          id="erd-many"
          class="erd-marker"
          viewBox="0 0 14 14"
          refX="13"
          refY="7"
          markerWidth="18"
          markerHeight="18"
          markerUnits="userSpaceOnUse"
          orient="auto-start-reverse"
        >
          <path d="M 1 7 L 13 2 M 1 7 L 13 7 M 1 7 L 13 12" />
        </marker>
      </defs>
    </svg>

    <VueFlow
      :nodes="nodes"
      :edges="edges"
      :node-types="nodeTypes"
      :edge-types="edgeTypes"
      :default-edge-options="{ type: 'custom', markerEnd: MarkerType.ArrowClosed }"
      :connection-mode="ConnectionMode.Loose"
      :connection-radius="160"
      :is-valid-connection="isValidConnection"
      :min-zoom="0.2"
      :max-zoom="4"
      :delete-key-code="null"
      :selection-key-code="isSelectTool && !isSpacePanning ? true : null"
      :selection-mode="SelectionMode.Partial"
      :pan-on-drag="isSpacePanning ? [0, 1, 2] : isSelectTool || isConnectTool ? [1] : false"
      :nodes-draggable="isSelectTool && !isSpacePanning"
      :elements-selectable="isSelectTool && !isSpacePanning"
      :fit-view-on-init="fitViewOnInit"
      class="diagram-flow"
      @nodes-change="handleNodesChange"
      @edges-change="handleEdgesChange"
      @node-drag-start="handleNodeDragStart"
      @node-context-menu="onNodeContextMenu"
      @selection-context-menu="onSelectionContextMenu"
      @pane-context-menu="onPaneContextMenu"
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

    <!-- Live freehand ink preview, rendered in wrapper-relative pixels while the
         pen tool is dragging (committed to a node on release). -->
    <svg
      v-show="isInking"
      class="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible"
      aria-hidden="true"
    >
      <path :d="inkPath" :fill="inkColor" />
    </svg>

    <!-- Arrow-tool guidance pill (top-centre) while the connector tool is on. -->
     
    <div
      v-if="isConnectTool"
      class="pointer-events-none absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-indigo-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-indigo-700 shadow-md backdrop-blur dark:border-indigo-500/40 dark:bg-slate-800/90 dark:text-indigo-300"
    >
      <span class="i-mdi-ray-start-arrow" aria-hidden="true" />
      {{ connectSource ? 'Click the target shape to connect' : 'Click a shape to start the arrow' }}
      <span class="opacity-60">· Esc to exit</span>
    </div>

    <!-- Live collaboration cursors of everyone else in the room. -->
    <PresenceCursors :peers="roomPeers" :viewport="viewport" />

    <!-- Right-click context menu (z-order / flip / link / duplicate / lock). -->
    <ContextMenu
      v-if="menu"
      :x="menu.x"
      :y="menu.y"
      :groups="menuGroups"
      @select="onMenuSelect"
      @close="closeMenu"
    />
  </div>
</template>
