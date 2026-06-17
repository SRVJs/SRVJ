import rough from 'roughjs'
import type { Drawable } from 'roughjs/bin/core'
import type { FillStyle, NodeColor, NodeShape, StrokeStyle, StrokeWidth } from '@/types/diagram'
import { nodeColors } from '@/utils/colors'

// DOM-free generator: turns shape requests into SVG path data we render as
// plain <path> elements (no canvas / no document needed, so it is SSG-safe).
const generator = rough.generator()

/** One rendered <path>: its data plus the stroke/fill rough chose for it. */
export interface RoughPath {
  d: string
  stroke: string
  strokeWidth: number
  fill?: string
}

const STROKE_PX: Record<StrokeWidth, number> = { thin: 1.4, medium: 2.2, thick: 3.6 }

/** Shapes rendered hand-drawn with rough.js in sketch mode. Others stay CSS / bespoke. */
const ROUGH_SHAPES = new Set<NodeShape>([
  'rectangle',
  'ellipse',
  'diamond',
  'entity',
  'relationship',
  'attribute',
  'weak-entity',
  'weak-relationship',
  'key-attribute',
  'multivalued-attribute',
  'derived-attribute',
])

export function isRoughShape(shape: NodeShape): boolean {
  return ROUGH_SHAPES.has(shape)
}

/** Stable per-node seed so a shape keeps the same wobble across re-renders/resizes. */
function seedFromId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return Math.abs(h) % 2 ** 31
}

export interface RoughOptions {
  shape: NodeShape
  width: number
  height: number
  color: NodeColor
  fillStyle: FillStyle
  strokeStyle: StrokeStyle
  strokeWidth: StrokeWidth
  dark: boolean
  id: string
}

function diamondPoints(w: number, h: number, inset = 0): [number, number][] {
  return [
    [w / 2, inset],
    [w - inset, h / 2],
    [w / 2, h - inset],
    [inset, h / 2],
  ]
}

/**
 * Build the hand-drawn SVG paths for a shape at a given pixel size. The shape is
 * drawn in the box `0,0 → width,height`; the rendering SVG uses a matching
 * viewBox so the strokes line up 1:1 with the node element.
 */
export function roughPaths(o: RoughOptions): RoughPath[] {
  const w = o.width
  const h = o.height
  if (w < 2 || h < 2) return []

  const hex = nodeColors(o.color, o.dark)
  const dash =
    o.strokeStyle === 'dashed' ? [10, 8] : o.strokeStyle === 'dotted' ? [2, 7] : undefined

  const base = {
    seed: seedFromId(o.id),
    roughness: 1.25,
    bowing: 1,
    stroke: hex.stroke,
    strokeWidth: STROKE_PX[o.strokeWidth],
    fill: o.fillStyle === 'solid' ? hex.fill : undefined,
    fillStyle: 'solid',
    ...(dash ? { strokeLineDash: dash } : {}),
  }
  // Inner (double-border) outlines are never filled.
  const outline = { ...base, fill: undefined }

  const inset = 7
  const drawables: Drawable[] = []
  switch (o.shape) {
    case 'ellipse':
    case 'attribute':
    case 'key-attribute':
      drawables.push(generator.ellipse(w / 2, h / 2, w, h, base))
      break
    case 'multivalued-attribute':
      drawables.push(generator.ellipse(w / 2, h / 2, w, h, base))
      drawables.push(generator.ellipse(w / 2, h / 2, w - 2 * inset, h - 2 * inset, outline))
      break
    case 'derived-attribute':
      drawables.push(generator.ellipse(w / 2, h / 2, w, h, { ...base, strokeLineDash: [8, 8] }))
      break
    case 'diamond':
    case 'relationship':
      drawables.push(generator.polygon(diamondPoints(w, h), base))
      break
    case 'weak-relationship':
      drawables.push(generator.polygon(diamondPoints(w, h), base))
      drawables.push(generator.polygon(diamondPoints(w, h, inset), outline))
      break
    case 'weak-entity':
      drawables.push(generator.rectangle(0, 0, w, h, base))
      drawables.push(generator.rectangle(inset, inset, w - 2 * inset, h - 2 * inset, outline))
      break
    default:
      // rectangle, entity, input / output variants
      drawables.push(generator.rectangle(0, 0, w, h, base))
  }

  return drawables.flatMap((d) => generator.toPaths(d))
}
