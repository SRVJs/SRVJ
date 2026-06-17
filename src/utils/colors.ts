import type { NodeColor } from '@/types/diagram'

/**
 * Concrete hex/rgba colours for the shape palette, used wherever we draw with a
 * real colour string instead of a Tailwind class — i.e. the rough.js hand-drawn
 * shapes and the perfect-freehand pen strokes. Mirrors the Tailwind classes in
 * `CustomNode`'s `colorStyles` (light + dark variants) so the two rendering
 * paths look identical.
 */
export interface ColorHexes {
  /** Stroke / border colour (also the pen ink colour). */
  stroke: string
  /** Solid fill colour for the shape body. */
  fill: string
  /** Solid Miro-style sticky fill. */
  sticky: string
}

const LIGHT: Record<NodeColor, ColorHexes> = {
  slate: { stroke: '#64748b', fill: '#ffffff', sticky: '#e2e8f0' },
  blue: { stroke: '#38bdf8', fill: '#e0f2fe', sticky: '#bae6fd' },
  green: { stroke: '#34d399', fill: '#d1fae5', sticky: '#a7f3d0' },
  yellow: { stroke: '#f59e0b', fill: '#fef3c7', sticky: '#fde68a' },
  red: { stroke: '#fb7185', fill: '#ffe4e6', sticky: '#fecdd3' },
  violet: { stroke: '#a78bfa', fill: '#ede9fe', sticky: '#ddd6fe' },
}

const DARK: Record<NodeColor, ColorHexes> = {
  slate: { stroke: '#94a3b8', fill: '#2a2a2a', sticky: '#cbd5e1' },
  blue: { stroke: '#7dd3fc', fill: 'rgba(14,165,233,0.18)', sticky: '#7dd3fc' },
  green: { stroke: '#6ee7b7', fill: 'rgba(16,185,129,0.18)', sticky: '#6ee7b7' },
  yellow: { stroke: '#fcd34d', fill: 'rgba(245,158,11,0.18)', sticky: '#fcd34d' },
  red: { stroke: '#fda4af', fill: 'rgba(244,63,94,0.18)', sticky: '#fda4af' },
  violet: { stroke: '#c4b5fd', fill: 'rgba(139,92,246,0.18)', sticky: '#c4b5fd' },
}

/** Resolve the concrete colours for a palette colour in the current theme. */
export function nodeColors(color: NodeColor, dark: boolean): ColorHexes {
  return (dark ? DARK : LIGHT)[color]
}
