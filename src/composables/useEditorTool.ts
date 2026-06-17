import { computed, ref } from 'vue'
import type {
  FillStyle,
  NodeColor,
  NodeShape,
  NodeVariant,
  StrokeStyle,
  StrokeWidth,
} from '@/types/diagram'
import {
  DEFAULT_FILL_STYLE,
  DEFAULT_OPACITY,
  DEFAULT_STROKE_STYLE,
  DEFAULT_STROKE_WIDTH,
} from '@/utils/constants'

/** A shape-creation tool (what gets drawn when you drag on the canvas). */
export interface ShapeTool {
  shape: NodeShape
  variant: NodeVariant
}

/**
 * The active tool:
 *  - `select`  → the selection cursor
 *  - `connect` → the arrow/connector tool (click a source node, then a target)
 *  - `draw`    → the freehand pen (drag on the canvas to ink a stroke)
 *  - `ShapeTool` → a shape to draw
 */
export type ActiveTool = 'select' | 'connect' | 'draw' | ShapeTool

// Shared module-level state so the palette and canvas agree on the tool.
const activeTool = ref<ActiveTool>('select')
const activeColor = ref<NodeColor>('slate')
const activeFillStyle = ref<FillStyle>(DEFAULT_FILL_STYLE)
const activeStrokeStyle = ref<StrokeStyle>(DEFAULT_STROKE_STYLE)
const activeStrokeWidth = ref<StrokeWidth>(DEFAULT_STROKE_WIDTH)
const activeOpacity = ref<number>(DEFAULT_OPACITY)

export function useEditorTool() {
  const isSelectTool = computed(() => activeTool.value === 'select')
  const isConnectTool = computed(() => activeTool.value === 'connect')
  const isDrawTool = computed(() => activeTool.value === 'draw')

  function setTool(tool: ActiveTool) {
    activeTool.value = tool
  }

  function resetTool() {
    activeTool.value = 'select'
  }

  /** Toggle the arrow/connector tool on/off (off falls back to select). */
  function toggleConnect() {
    activeTool.value = activeTool.value === 'connect' ? 'select' : 'connect'
  }

  /** Toggle the freehand pen on/off (off falls back to select). */
  function toggleDraw() {
    activeTool.value = activeTool.value === 'draw' ? 'select' : 'draw'
  }

  function setColor(color: NodeColor) {
    activeColor.value = color
  }

  function setFillStyle(value: FillStyle) {
    activeFillStyle.value = value
  }

  function setStrokeStyle(value: StrokeStyle) {
    activeStrokeStyle.value = value
  }

  function setStrokeWidth(value: StrokeWidth) {
    activeStrokeWidth.value = value
  }

  function setOpacity(value: number) {
    activeOpacity.value = Math.max(0, Math.min(100, Math.round(value)))
  }

  /** True when `tool` is the currently active shape tool. */
  function isActive(tool: ShapeTool): boolean {
    const current = activeTool.value
    // `select` / `connect` are string modes — only object tools carry a shape.
    return (
      typeof current !== 'string' &&
      current.shape === tool.shape &&
      current.variant === tool.variant
    )
  }

  return {
    activeTool,
    activeColor,
    activeFillStyle,
    activeStrokeStyle,
    activeStrokeWidth,
    activeOpacity,
    isSelectTool,
    isConnectTool,
    isDrawTool,
    setTool,
    resetTool,
    toggleConnect,
    toggleDraw,
    setColor,
    setFillStyle,
    setStrokeStyle,
    setStrokeWidth,
    setOpacity,
    isActive,
  }
}
