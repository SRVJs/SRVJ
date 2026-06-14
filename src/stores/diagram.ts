import { defineStore } from 'pinia'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type GraphEdge,
  type GraphNode,
  type NodeChange,
} from '@vue-flow/core'
import type {
  DiagramEdge,
  DiagramNode,
  DiagramSnapshot,
  FillStyle,
  NewNodeOptions,
  NodeColor,
  NodeRect,
  NodeShape,
  NodeVariant,
  StrokeStyle,
  StrokeWidth,
} from '@/types/diagram'
import { createId } from '@/utils/id'
import {
  DEFAULT_COLOR,
  DEFAULT_FILL_STYLE,
  DEFAULT_OPACITY,
  DEFAULT_SHAPE,
  DEFAULT_STROKE_STYLE,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_VARIANT,
  DIAGRAM_VERSION,
  MAX_HISTORY,
} from '@/utils/constants'

interface DiagramState {
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  /** Stack of past snapshots for undo. */
  past: DiagramSnapshot[]
  /** Stack of undone snapshots for redo. */
  future: DiagramSnapshot[]
  /** Id of a freshly-created node that should open in label-edit mode. */
  editNodeId: string | null
}

const VARIANTS = new Set<NodeVariant>(['default', 'input', 'output'])
const SHAPES = new Set<NodeShape>(['rectangle', 'ellipse', 'diamond', 'sticky', 'text'])
const COLORS = new Set<NodeColor>(['slate', 'blue', 'green', 'yellow', 'red', 'violet'])
const FILL_STYLES = new Set<FillStyle>(['solid', 'transparent'])
const STROKE_STYLES = new Set<StrokeStyle>(['solid', 'dashed', 'dotted'])
const STROKE_WIDTHS = new Set<StrokeWidth>(['thin', 'medium', 'thick'])

function clampOpacity(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return DEFAULT_OPACITY
  return Math.max(0, Math.min(100, Math.round(value)))
}

/** Default rendered size for each shape (the node is resizable from here). */
function defaultStyle(shape: NodeShape): Record<string, string> {
  switch (shape) {
    case 'ellipse':
      return { width: '184px', height: '112px' }
    case 'diamond':
      return { width: '150px', height: '150px' }
    case 'sticky':
      return { width: '160px', height: '160px' }
    case 'text':
      // Auto-size to the typed content (Excalidraw-style) — the node footprint
      // grows with the text instead of sitting inside a fixed-size rectangle.
      return { width: 'auto', height: 'auto', minWidth: '24px', minHeight: '24px' }
    default:
      return { width: '176px', height: '72px' }
  }
}

function buildNode(options: NewNodeOptions): DiagramNode {
  const variant = options.variant ?? DEFAULT_VARIANT
  const shape = options.shape ?? DEFAULT_SHAPE
  const style =
    options.width && options.height
      ? { width: `${Math.round(options.width)}px`, height: `${Math.round(options.height)}px` }
      : defaultStyle(shape)
  return {
    id: createId('node'),
    type: 'custom',
    position: options.position ?? {
      x: 160 + Math.random() * 220,
      y: 140 + Math.random() * 140,
    },
    style,
    data: {
      // Start blank — the node opens straight into label editing so you can
      // type its name. No placeholder "Node" / "Input" / "Output" word.
      label: options.label ?? '',
      variant,
      shape,
      color: options.color ?? DEFAULT_COLOR,
      fillStyle: options.fillStyle ?? DEFAULT_FILL_STYLE,
      strokeStyle: options.strokeStyle ?? DEFAULT_STROKE_STYLE,
      strokeWidth: options.strokeWidth ?? DEFAULT_STROKE_WIDTH,
      opacity: clampOpacity(options.opacity ?? DEFAULT_OPACITY),
    },
  }
}

/** Backfill defaults so legacy / imported nodes always have a complete shape. */
function normalizeNode(node: DiagramNode): DiagramNode {
  const data = node.data ?? ({} as DiagramNode['data'])
  const shape = SHAPES.has(data.shape) ? data.shape : DEFAULT_SHAPE
  return {
    ...node,
    type: 'custom',
    selected: false,
    style: node.style?.width ? node.style : defaultStyle(shape),
    data: {
      label: typeof data.label === 'string' ? data.label : '',
      variant: VARIANTS.has(data.variant) ? data.variant : DEFAULT_VARIANT,
      shape,
      color: COLORS.has(data.color) ? data.color : DEFAULT_COLOR,
      fillStyle: FILL_STYLES.has(data.fillStyle) ? data.fillStyle : DEFAULT_FILL_STYLE,
      strokeStyle: STROKE_STYLES.has(data.strokeStyle) ? data.strokeStyle : DEFAULT_STROKE_STYLE,
      strokeWidth: STROKE_WIDTHS.has(data.strokeWidth) ? data.strokeWidth : DEFAULT_STROKE_WIDTH,
      opacity: clampOpacity(data.opacity),
    },
  }
}

/** Deep clone helper that keeps snapshots independent of live reactive state. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export const useDiagramStore = defineStore('diagram', {
  state: (): DiagramState => ({
    nodes: [],
    edges: [],
    past: [],
    future: [],
    editNodeId: null,
  }),

  getters: {
    snapshot: (state): DiagramSnapshot => ({
      version: DIAGRAM_VERSION,
      nodes: clone(state.nodes),
      edges: clone(state.edges),
    }),

    canUndo: (state): boolean => state.past.length > 0,
    canRedo: (state): boolean => state.future.length > 0,
    nodeCount: (state): number => state.nodes.length,
    edgeCount: (state): number => state.edges.length,

    // Selection is derived from each element's `selected` flag, which Vue Flow
    // keeps in sync via `applyNodeChanges` / `applyEdgeChanges`.
    selectedNodeIds: (state): string[] =>
      state.nodes.filter((n) => n.selected).map((n) => n.id),
    selectedEdgeIds: (state): string[] =>
      state.edges.filter((e) => e.selected).map((e) => e.id),

    selectedCount(): number {
      return this.selectedNodeIds.length + this.selectedEdgeIds.length
    },
    hasSelection(): boolean {
      return this.selectedCount > 0
    },

    /** Shared colour of the current node selection, or null when mixed/empty. */
    selectionColor(state): NodeColor | null {
      const selected = state.nodes.filter((n) => n.selected)
      if (selected.length === 0) return null
      const colors = new Set(selected.map((n) => n.data.color))
      return colors.size === 1 ? [...colors][0] : null
    },

    selectionFillStyle(state): FillStyle | null {
      const selected = state.nodes.filter((n) => n.selected)
      if (selected.length === 0) return null
      const set = new Set(selected.map((n) => n.data.fillStyle))
      return set.size === 1 ? [...set][0] : null
    },

    selectionStrokeStyle(state): StrokeStyle | null {
      const selected = state.nodes.filter((n) => n.selected)
      if (selected.length === 0) return null
      const set = new Set(selected.map((n) => n.data.strokeStyle))
      return set.size === 1 ? [...set][0] : null
    },

    selectionStrokeWidth(state): StrokeWidth | null {
      const selected = state.nodes.filter((n) => n.selected)
      if (selected.length === 0) return null
      const set = new Set(selected.map((n) => n.data.strokeWidth))
      return set.size === 1 ? [...set][0] : null
    },

    /** Shared opacity (0-100) of the current node selection, or null when mixed/empty. */
    selectionOpacity(state): number | null {
      const selected = state.nodes.filter((n) => n.selected)
      if (selected.length === 0) return null
      const set = new Set(selected.map((n) => n.data.opacity))
      return set.size === 1 ? [...set][0] : null
    },
  },

  actions: {
    /** Capture the current diagram onto the undo stack before a mutation. */
    commit() {
      this.past.push({
        version: DIAGRAM_VERSION,
        nodes: clone(this.nodes),
        edges: clone(this.edges),
      })
      if (this.past.length > MAX_HISTORY) this.past.shift()
      this.future = []
    },

    /** Replace the live diagram with the given snapshot (no history push). */
    applySnapshot(snapshot: DiagramSnapshot) {
      this.nodes = clone(snapshot.nodes).map(normalizeNode)
      // Every edge renders through CustomEdge (straight line + editable label).
      this.edges = clone(snapshot.edges).map((e) => ({ ...e, type: 'custom', selected: false }))
    },

    // ---- Vue Flow change handlers (controlled flow) -----------------------
    // Vue Flow's change helpers are typed against its internal `GraphNode` /
    // `GraphEdge` shapes; our store keeps plain serialisable objects, so we
    // cast across that boundary.

    onNodesChange(changes: NodeChange[]) {
      this.nodes = applyNodeChanges(
        changes,
        this.nodes as unknown as GraphNode[],
      ) as unknown as DiagramNode[]
      // Vue Flow's `applyNodeChanges` only writes a `position` change onto a
      // node it recognises as a fully-processed GraphNode (one carrying
      // `computedPosition`). Our store nodes are deliberately plain/serialisable
      // and never carry it, so drag positions are dropped here — the node moves
      // on screen (Vue Flow's internal copy) but the store keeps the creation
      // position. The next array rebuild (recolour, restyle, undo, …) then
      // snaps the node back. Persist the new position ourselves to fix that.
      for (const change of changes) {
        if (change.type !== 'position' || !change.position) continue
        const node = this.nodes.find((n) => n.id === change.id)
        if (node) node.position = { ...change.position }
      }
    },

    onEdgesChange(changes: EdgeChange[]) {
      this.edges = applyEdgeChanges(
        changes,
        this.edges as unknown as GraphEdge[],
      ) as unknown as DiagramEdge[]
    },

    onConnect(connection: Connection) {
      // Reject self-loops outright — a node can't connect to itself.
      if (connection.source === connection.target) return
      this.commit()
      this.edges = addEdge(
        { ...connection, animated: false, type: 'custom', label: '' },
        this.edges as unknown as GraphEdge[],
      ) as unknown as DiagramEdge[]
    },

    /** Set (or clear) the text label on an edge — used by CustomEdge editing. */
    updateEdgeLabel(id: string, label: string) {
      const edge = this.edges.find((e) => e.id === id)
      if (!edge || (edge.label ?? '') === label) return
      this.commit()
      // Replace the edge object so Vue Flow's controlled render picks it up.
      this.edges = this.edges.map((e) => (e.id === id ? { ...e, label } : e))
    },

    // ---- Node operations --------------------------------------------------

    addNode(options: NewNodeOptions = {}) {
      this.commit()
      const node = buildNode(options)
      this.nodes.push(node)
      // Flag it so its component opens straight into label editing on mount.
      this.editNodeId = node.id
    },

    /** One-shot claim of the pending auto-edit node id (clears it). */
    takeEditNode(id: string): boolean {
      if (this.editNodeId !== id) return false
      this.editNodeId = null
      return true
    },

    updateNodeLabel(id: string, label: string) {
      const node = this.nodes.find((n) => n.id === id)
      if (!node || node.data.label === label) return
      this.commit()
      // Replace the node object (not an in-place mutation) so Vue Flow's
      // controlled render picks up the new label — same pattern as recolour.
      this.nodes = this.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label } } : n,
      )
    },

    /** Apply a new position + size to a node (used while resizing). */
    setNodeRect(id: string, rect: NodeRect) {
      const node = this.nodes.find((n) => n.id === id)
      if (!node) return
      node.position = { x: rect.x, y: rect.y }
      node.style = {
        ...(node.style ?? {}),
        width: `${Math.round(rect.width)}px`,
        height: `${Math.round(rect.height)}px`,
      }
    },

    /** Recolour the given node ids (defaults to the current selection). */
    updateNodeColor(color: NodeColor, ids?: string[]) {
      const targetIds = ids ?? this.selectedNodeIds
      if (targetIds.length === 0) return
      this.commit()
      const set = new Set(targetIds)
      this.nodes = this.nodes.map((n) =>
        set.has(n.id) ? { ...n, data: { ...n.data, color } } : n,
      )
    },

    updateNodeFillStyle(fillStyle: FillStyle, ids?: string[]) {
      const targetIds = ids ?? this.selectedNodeIds
      if (targetIds.length === 0) return
      this.commit()
      const set = new Set(targetIds)
      this.nodes = this.nodes.map((n) =>
        set.has(n.id) ? { ...n, data: { ...n.data, fillStyle } } : n,
      )
    },

    updateNodeStrokeStyle(strokeStyle: StrokeStyle, ids?: string[]) {
      const targetIds = ids ?? this.selectedNodeIds
      if (targetIds.length === 0) return
      this.commit()
      const set = new Set(targetIds)
      this.nodes = this.nodes.map((n) =>
        set.has(n.id) ? { ...n, data: { ...n.data, strokeStyle } } : n,
      )
    },

    updateNodeStrokeWidth(strokeWidth: StrokeWidth, ids?: string[]) {
      const targetIds = ids ?? this.selectedNodeIds
      if (targetIds.length === 0) return
      this.commit()
      const set = new Set(targetIds)
      this.nodes = this.nodes.map((n) =>
        set.has(n.id) ? { ...n, data: { ...n.data, strokeWidth } } : n,
      )
    },

    /** Apply opacity (0-100) to the given node ids (defaults to current selection). */
    updateNodeOpacity(opacity: number, ids?: string[]) {
      const targetIds = ids ?? this.selectedNodeIds
      if (targetIds.length === 0) return
      const clamped = clampOpacity(opacity)
      this.commit()
      const set = new Set(targetIds)
      this.nodes = this.nodes.map((n) =>
        set.has(n.id) ? { ...n, data: { ...n.data, opacity: clamped } } : n,
      )
    },

    // ---- Selection --------------------------------------------------------

    clearSelection() {
      this.nodes.forEach((n) => {
        if (n.selected) n.selected = false
      })
      this.edges.forEach((e) => {
        if (e.selected) e.selected = false
      })
    },

    selectAll() {
      this.nodes = this.nodes.map((n) => ({ ...n, selected: true }))
      this.edges = this.edges.map((e) => ({ ...e, selected: true }))
    },

    // ---- Deletion ---------------------------------------------------------

    /** Delete every selected node + edge (and edges touching deleted nodes). */
    deleteSelected() {
      const selectedNodes = new Set(this.nodes.filter((n) => n.selected).map((n) => n.id))
      const hasSelectedEdges = this.edges.some((e) => e.selected)
      if (selectedNodes.size === 0 && !hasSelectedEdges) return
      this.commit()
      this.nodes = this.nodes.filter((n) => !n.selected)
      this.edges = this.edges.filter(
        (e) => !e.selected && !selectedNodes.has(e.source) && !selectedNodes.has(e.target),
      )
    },

    // ---- History ----------------------------------------------------------

    undo() {
      const previous = this.past.pop()
      if (!previous) return
      this.future.push({
        version: DIAGRAM_VERSION,
        nodes: clone(this.nodes),
        edges: clone(this.edges),
      })
      this.nodes = clone(previous.nodes)
      this.edges = clone(previous.edges)
    },

    redo() {
      const next = this.future.pop()
      if (!next) return
      this.past.push({
        version: DIAGRAM_VERSION,
        nodes: clone(this.nodes),
        edges: clone(this.edges),
      })
      this.nodes = clone(next.nodes)
      this.edges = clone(next.edges)
    },

    // ---- Bulk operations --------------------------------------------------

    reset() {
      if (this.nodes.length === 0 && this.edges.length === 0) return
      this.commit()
      this.nodes = []
      this.edges = []
    },

    loadSnapshot(snapshot: DiagramSnapshot, recordHistory = true) {
      if (recordHistory) this.commit()
      this.applySnapshot(snapshot)
    },
  },
})
