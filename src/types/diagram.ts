import type { XYPosition } from '@vue-flow/core'

/**
 * Connection role of a node — controls which handles are rendered.
 *  - `input`   → only a source handle (a starting point of a flow)
 *  - `output`  → only a target handle (an end point of a flow)
 *  - `default` → both handles
 */
export type NodeVariant = 'default' | 'input' | 'output'

/**
 * Geometric shape of a node — a merge of Excalidraw shapes, Miro objects and
 * ERD notation.
 *  - `rectangle` / `ellipse` / `diamond` → classic flow shapes (also serve as
 *    ERD entity / attribute / relationship)
 *  - `sticky` → a Miro-style sticky note (solid fill, no border)
 *  - `text`   → a borderless text label (no fill, no handles)
 *  - `draw`   → a freehand pen stroke (an SVG path built from `data.points`;
 *    no fill, no border, no handles, no label)
 *  - ERD (Chen notation): `weak-entity` (double-border rectangle),
 *    `weak-relationship` (double-border diamond), `key-attribute` (ellipse,
 *    underlined label), `multivalued-attribute` (double-border ellipse),
 *    `derived-attribute` (dashed-border ellipse)
 *  - ERD (relational): `table` → a crow's-foot entity table with field rows
 */
export type NodeShape =
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'sticky'
  | 'text'
  | 'draw'
  | 'entity'
  | 'relationship'
  | 'attribute'
  | 'weak-entity'
  | 'weak-relationship'
  | 'key-attribute'
  | 'multivalued-attribute'
  | 'derived-attribute'
  | 'table'

/** Key role of a crow's-foot table field. */
export type ErdFieldKey = '' | 'PK' | 'FK'

/** A single row in a crow's-foot ERD `table` node. */
export interface ErdField {
  id: string
  name: string
  key: ErdFieldKey
}

/** Named fill colour drawn from a fixed Excalidraw-like palette. */
export type NodeColor = 'slate' | 'blue' | 'green' | 'yellow' | 'red' | 'violet'

/** Background fill mode — solid (use palette fill) or transparent (no fill). */
export type FillStyle = 'solid' | 'transparent'

/** Border line style. */
export type StrokeStyle = 'solid' | 'dashed' | 'dotted'

/** Border thickness preset (mapped to pixel widths in CSS). */
export type StrokeWidth = 'thin' | 'medium' | 'thick'

/** Data payload carried by every diagram node. */
export interface DiagramNodeData {
  label: string
  variant: NodeVariant
  shape: NodeShape
  color: NodeColor
  fillStyle: FillStyle
  strokeStyle: StrokeStyle
  strokeWidth: StrokeWidth
  /** Whole-node opacity, 0-100. */
  opacity: number
  /** Field rows — only used by the crow's-foot `table` shape. */
  fields?: ErdField[]
  /**
   * Freehand pen points — only used by the `draw` shape. Coordinates are
   * relative to the node's top-left, so the stroke moves/resizes with the node.
   */
  points?: { x: number; y: number }[]
}

/**
 * A diagram node. Intentionally a *plain* shape (decoupled from Vue Flow's
 * heavy `GraphNode` type) so it stays serialisable and cheap to type-check.
 * Vue Flow accepts these objects directly as its `:nodes` input.
 */
export interface DiagramNode {
  id: string
  type: 'custom'
  position: XYPosition
  data: DiagramNodeData
  selected?: boolean
  /** Inline size applied to the node element (e.g. `{ width: '176px', height: '72px' }`). */
  style?: Record<string, string>
  /** Extra class on the Vue Flow node element (e.g. `vf-draw-node` for pen strokes). */
  class?: string
}

/** Rectangle reported by the node resizer (top-left origin + size). */
export interface NodeRect {
  x: number
  y: number
  width: number
  height: number
}

/** A diagram edge (plain, serialisable shape). */
export interface DiagramEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  type?: string
  animated?: boolean
  selected?: boolean
  label?: string
}

/** Options accepted when creating a new node. */
export interface NewNodeOptions {
  variant?: NodeVariant
  shape?: NodeShape
  color?: NodeColor
  fillStyle?: FillStyle
  strokeStyle?: StrokeStyle
  strokeWidth?: StrokeWidth
  opacity?: number
  label?: string
  fields?: ErdField[]
  position?: XYPosition
  /** Explicit size (e.g. when drawn by dragging). Falls back to a shape default. */
  width?: number
  height?: number
}

/** Serialisable snapshot of a whole diagram (used for persistence + export). */
export interface DiagramSnapshot {
  version: number
  nodes: DiagramNode[]
  edges: DiagramEdge[]
}

export type { XYPosition }
