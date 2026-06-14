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

/** The active tool: either the selection cursor or a shape to draw. */
export type ActiveTool = 'select' | ShapeTool

// Shared module-level state so the palette and canvas agree on the tool.
const activeTool = ref<ActiveTool>('select')
const activeColor = ref<NodeColor>('slate')
const activeFillStyle = ref<FillStyle>(DEFAULT_FILL_STYLE)
const activeStrokeStyle = ref<StrokeStyle>(DEFAULT_STROKE_STYLE)
const activeStrokeWidth = ref<StrokeWidth>(DEFAULT_STROKE_WIDTH)
const activeOpacity = ref<number>(DEFAULT_OPACITY)

export function useEditorTool() {
  const isSelectTool = computed(() => activeTool.value === 'select')

  function setTool(tool: ActiveTool) {
    activeTool.value = tool
  }

  function resetTool() {
    activeTool.value = 'select'
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
    return current !== 'select' && current.shape === tool.shape && current.variant === tool.variant
  }

  return {
    activeTool,
    activeColor,
    activeFillStyle,
    activeStrokeStyle,
    activeStrokeWidth,
    activeOpacity,
    isSelectTool,
    setTool,
    resetTool,
    setColor,
    setFillStyle,
    setStrokeStyle,
    setStrokeWidth,
    setOpacity,
    isActive,
  }
}
