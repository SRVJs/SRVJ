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
  ErdField,
  ErdFieldKey,
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
import { ANCHORS_PER_SIDE, anchorId, handleSide, type HandleSide } from '@/utils/handles'
import { PEN_SIZE, strokeGeometry, type Pt } from '@/utils/freehand'
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
const SHAPES = new Set<NodeShape>([
  'rectangle',
  'ellipse',
  'diamond',
  'sticky',
  'text',
  'draw',
  'entity',
  'relationship',
  'attribute',
  'weak-entity',
  'weak-relationship',
  'key-attribute',
  'multivalued-attribute',
  'derived-attribute',
  'table',
])
const FIELD_KEYS = new Set<ErdFieldKey>(['', 'PK', 'FK'])

/** A fresh crow's-foot table starts with an id primary key + a name field. */
function defaultFields(): ErdField[] {
  return [
    { id: createId('field'), name: 'id', key: 'PK' },
    { id: createId('field'), name: 'name', key: '' },
  ]
}

/** Sanitise an arbitrary value into a valid field-row list. */
function normalizeFields(value: unknown): ErdField[] {
  if (!Array.isArray(value)) return defaultFields()
  const fields = value
    .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
    .map((f) => ({
      id: typeof f.id === 'string' ? f.id : createId('field'),
      name: typeof f.name === 'string' ? f.name : '',
      key: FIELD_KEYS.has(f.key as ErdFieldKey) ? (f.key as ErdFieldKey) : '',
    }))
  return fields.length > 0 ? fields : defaultFields()
}
/** Sanitise an arbitrary value into a valid freehand point list. */
function normalizePoints(value: unknown): Pt[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((p): p is { x: number; y: number } =>
      !!p && typeof p === 'object' && typeof (p as Pt).x === 'number' && typeof (p as Pt).y === 'number',
    )
    .map((p) => ({ x: p.x, y: p.y }))
}

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
    case 'attribute':
    case 'key-attribute':
    case 'multivalued-attribute':
    case 'derived-attribute':
      return { width: '184px', height: '112px' }
    case 'diamond':
    case 'relationship':
    case 'weak-relationship':
      return { width: '150px', height: '150px' }
    case 'sticky':
      return { width: '160px', height: '160px' }
    case 'table':
      // Fixed width; height grows with the field rows.
      return { width: '220px', height: 'auto', minWidth: '160px' }
    case 'text':
      // Auto-size to the typed content (Excalidraw-style) — the node footprint
      // grows with the text instead of sitting inside a fixed-size rectangle.
      return { width: 'auto', height: 'auto', minWidth: '24px', minHeight: '24px' }
    case 'draw':
      // Freehand strokes always supply their own measured size; this is only a
      // fallback for an (unexpected) draw node missing a style.
      return { width: '120px', height: '120px' }
    default:
      // rectangle + weak-entity
      return { width: '176px', height: '72px' }
  }
}

function buildNode(options: NewNodeOptions): DiagramNode {
  const variant = options.variant ?? DEFAULT_VARIANT
  const shape = options.shape ?? DEFAULT_SHAPE
  const style =
    // Tables always auto-size their height to the field rows — never lock a
    // dragged pixel height (it would clip the lower rows + the "+ field" button).
    options.width && options.height && shape !== 'table'
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
      // Sticky notes are always a solid filled note; everything else follows the
      // chosen fill (transparent by default, Excalidraw-style).
      fillStyle: shape === 'sticky' ? 'solid' : (options.fillStyle ?? DEFAULT_FILL_STYLE),
      strokeStyle: options.strokeStyle ?? DEFAULT_STROKE_STYLE,
      strokeWidth: options.strokeWidth ?? DEFAULT_STROKE_WIDTH,
      opacity: clampOpacity(options.opacity ?? DEFAULT_OPACITY),
      // Crow's-foot tables carry editable field rows; other shapes don't.
      ...(shape === 'table' ? { fields: options.fields ?? defaultFields() } : {}),
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
    // Tables must keep an auto height (so every row + the add button show);
    // keep any custom width but never a locked pixel height for them. Freehand
    // strokes always keep their measured pixel size (the path scales to fit it).
    style:
      shape === 'table'
        ? { ...defaultStyle('table'), ...(node.style?.width ? { width: node.style.width } : {}) }
        : node.style?.width
          ? node.style
          : defaultStyle(shape),
    data: {
      label: typeof data.label === 'string' ? data.label : '',
      variant: VARIANTS.has(data.variant) ? data.variant : DEFAULT_VARIANT,
      shape,
      color: COLORS.has(data.color) ? data.color : DEFAULT_COLOR,
      fillStyle: FILL_STYLES.has(data.fillStyle) ? data.fillStyle : DEFAULT_FILL_STYLE,
      strokeStyle: STROKE_STYLES.has(data.strokeStyle) ? data.strokeStyle : DEFAULT_STROKE_STYLE,
      strokeWidth: STROKE_WIDTHS.has(data.strokeWidth) ? data.strokeWidth : DEFAULT_STROKE_WIDTH,
      opacity: clampOpacity(data.opacity),
      // Only tables keep a `fields` array; backfill it so legacy/imported
      // tables stay valid, and strip it from non-table shapes.
      ...(shape === 'table' ? { fields: normalizeFields(data.fields) } : {}),
      // Only freehand strokes keep a `points` array.
      ...(shape === 'draw' ? { points: normalizePoints(data.points) } : {}),
    },
  }
}

/** Deep clone helper that keeps snapshots independent of live reactive state. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** Centre point of a node, from its position + (best-effort) rendered size. */
function nodeCenter(node: DiagramNode): { x: number; y: number } {
  const w = parseFloat(node.style?.width ?? '') || 160
  const h = parseFloat(node.style?.height ?? '') || 80
  return { x: node.position.x + w / 2, y: node.position.y + h / 2 }
}

/**
 * Choose the source/target sides that face each other, so an arrow drawn by the
 * connector tool runs between the two shapes rather than from a fixed corner.
 */
function facingSides(source: DiagramNode, target: DiagramNode): {
  sourceSide: HandleSide
  targetSide: HandleSide
} {
  const a = nodeCenter(source)
  const b = nodeCenter(target)
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceSide: 'right', targetSide: 'left' }
      : { sourceSide: 'left', targetSide: 'right' }
  }
  return dy >= 0
    ? { sourceSide: 'bottom', targetSide: 'top' }
    : { sourceSide: 'top', targetSide: 'bottom' }
}

/**
 * Pick the next free anchor on a node's side so multiple arrows spread across
 * the side instead of stacking on its centre. Counts edges already touching the
 * node on that side (either end) and steps round-robin through the anchors.
 */
function nextAnchorOnSide(edges: DiagramEdge[], nodeId: string, side: HandleSide): string {
  const used = edges.filter(
    (e) =>
      (e.source === nodeId && handleSide(e.sourceHandle) === side) ||
      (e.target === nodeId && handleSide(e.targetHandle) === side),
  ).length
  return anchorId(side, used % ANCHORS_PER_SIDE)
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

    /**
     * Draw an arrow (edge) from one node to another — used by the toolbar
     * arrow/connector tool. Mirrors `onConnect` but is driven by two node ids
     * instead of a dragged handle connection. Picks the handles on the facing
     * sides (now that the draggable connection dots are gone) so the straight
     * edge runs cleanly between the two shapes.
     */
    connectNodes(source: string, target: string) {
      if (source === target) return
      // Don't stack a duplicate arrow in the same direction.
      if (this.edges.some((e) => e.source === source && e.target === target)) return
      const a = this.nodes.find((n) => n.id === source)
      const b = this.nodes.find((n) => n.id === target)
      if (!a || !b) return
      const { sourceSide, targetSide } = facingSides(a, b)
      const sourceHandle = nextAnchorOnSide(this.edges, source, sourceSide)
      const targetHandle = nextAnchorOnSide(this.edges, target, targetSide)
      this.commit()
      this.edges = addEdge(
        { source, target, sourceHandle, targetHandle, animated: false, type: 'custom', label: '' },
        this.edges as unknown as GraphEdge[],
      ) as unknown as DiagramEdge[]
    },

    // ---- Crow's-foot table fields ----------------------------------------
    // All follow the replace-don't-mutate + commit pattern so Vue Flow
    // re-renders the table node and each change is a single undo step.

    addTableField(nodeId: string) {
      const node = this.nodes.find((n) => n.id === nodeId)
      if (!node || node.data.shape !== 'table') return
      this.commit()
      const field: ErdField = { id: createId('field'), name: '', key: '' }
      this.nodes = this.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, fields: [...(n.data.fields ?? []), field] } }
          : n,
      )
    },

    updateTableField(nodeId: string, fieldId: string, patch: Partial<Omit<ErdField, 'id'>>) {
      const node = this.nodes.find((n) => n.id === nodeId)
      if (!node || node.data.shape !== 'table') return
      this.commit()
      this.nodes = this.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                fields: (n.data.fields ?? []).map((f) =>
                  f.id === fieldId ? { ...f, ...patch } : f,
                ),
              },
            }
          : n,
      )
    },

    /** Cycle a field's key role: none → PK → FK → none. */
    cycleTableFieldKey(nodeId: string, fieldId: string) {
      const node = this.nodes.find((n) => n.id === nodeId)
      const field = node?.data.fields?.find((f) => f.id === fieldId)
      if (!field) return
      const next: ErdFieldKey = field.key === '' ? 'PK' : field.key === 'PK' ? 'FK' : ''
      this.updateTableField(nodeId, fieldId, { key: next })
    },

    removeTableField(nodeId: string, fieldId: string) {
      const node = this.nodes.find((n) => n.id === nodeId)
      if (!node || node.data.shape !== 'table') return
      this.commit()
      this.nodes = this.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, fields: (n.data.fields ?? []).filter((f) => f.id !== fieldId) } }
          : n,
      )
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

    /**
     * Create a freehand pen stroke from a list of flow-space points. The points
     * are normalised to the stroke's bounding box (so it moves/resizes as a
     * unit) and the node is positioned + sized to match the rendered outline.
     */
    addDrawNode(options: {
      points: Pt[]
      color: NodeColor
      strokeWidth: StrokeWidth
      opacity: number
    }) {
      if (options.points.length === 0) return
      const size = PEN_SIZE[options.strokeWidth]
      const minX = Math.min(...options.points.map((p) => p.x))
      const minY = Math.min(...options.points.map((p) => p.y))
      const rel = options.points.map((p) => ({ x: p.x - minX, y: p.y - minY }))
      const geo = strokeGeometry(rel, size)

      this.commit()
      const node: DiagramNode = {
        id: createId('node'),
        type: 'custom',
        // Tag the node element so its (invisible) bounding box passes clicks
        // through — only the inked path itself is a hit target (see style.css).
        class: 'vf-draw-node',
        // Top-left of the rendered outline (the outline can extend past the raw
        // points by ~size/2, hence the geo.minX/minY offset).
        position: { x: minX + geo.minX, y: minY + geo.minY },
        style: { width: `${Math.round(geo.width)}px`, height: `${Math.round(geo.height)}px` },
        data: {
          label: '',
          variant: 'default',
          shape: 'draw',
          color: options.color,
          fillStyle: 'transparent',
          strokeStyle: 'solid',
          strokeWidth: options.strokeWidth,
          opacity: clampOpacity(options.opacity),
          points: rel,
        },
      }
      this.nodes.push(node)
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
      this.nodes = this.nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              position: { x: rect.x, y: rect.y },
              style: {
                ...(n.style ?? {}),
                width: `${Math.round(rect.width)}px`,
                height: `${Math.round(rect.height)}px`,
              },
            }
          : n,
      )
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
