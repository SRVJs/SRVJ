import { getStroke } from 'perfect-freehand'
import type { StrokeWidth } from '@/types/diagram'

/** A 2D point used for freehand strokes (serialisable). */
export interface Pt {
  x: number
  y: number
}

/**
 * Base stroke diameter (in flow units) for each stroke-width preset. These map
 * the palette's thin/medium/thick onto a perfect-freehand `size`.
 */
export const PEN_SIZE: Record<StrokeWidth, number> = {
  thin: 5,
  medium: 8,
  thick: 14,
}

// Tuned for a natural ink-pen feel (tapered ends, lightly smoothed).
const STROKE_OPTIONS = {
  thinning: 0.6,
  smoothing: 0.5,
  streamline: 0.5,
  simulatePressure: true,
} as const

/** Turn perfect-freehand's outline points into an SVG path `d` (a filled blob). */
function outlineToPath(outline: number[][]): string {
  if (outline.length === 0) return ''
  const d: (string | number)[] = ['M', outline[0][0], outline[0][1], 'Q']
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i]
    const [x1, y1] = outline[(i + 1) % outline.length]
    d.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
  }
  d.push('Z')
  return d.join(' ')
}

/** Geometry of a finished freehand stroke: its SVG path + outline bounds. */
export interface StrokeGeometry {
  /** SVG path data for the filled stroke. */
  d: string
  /** Outline bounding box (in the same coordinate space as the input points). */
  minX: number
  minY: number
  width: number
  height: number
}

/**
 * Build the filled SVG path + outline bounds for a freehand stroke. Deterministic
 * for a given set of points (no randomness), so the canvas preview, the saved
 * node size, and the rendered node all agree.
 */
export function strokeGeometry(points: Pt[], size: number): StrokeGeometry {
  const outline = getStroke(
    points.map((p) => [p.x, p.y]),
    { size, ...STROKE_OPTIONS },
  ) as number[][]

  if (outline.length === 0) {
    return { d: '', minX: 0, minY: 0, width: 1, height: 1 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of outline) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }

  return {
    d: outlineToPath(outline),
    minX,
    minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  }
}
