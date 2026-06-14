import type {
  FillStyle,
  NodeColor,
  NodeShape,
  NodeVariant,
  StrokeStyle,
  StrokeWidth,
} from '@/types/diagram'

/** Schema version of a serialised diagram. Bump when the shape changes. */
export const DIAGRAM_VERSION = 3

/** localStorage key under which the diagram is auto-saved. */
export const STORAGE_KEY = 'srvj:diagram'

/** localStorage key for the dark-mode preference. */
export const THEME_STORAGE_KEY = 'srvj:theme'

/** localStorage key for the hand-drawn (sketch) mode preference. */
export const SKETCH_STORAGE_KEY = 'srvj:sketch'

/** Debounce delay (ms) for auto-saving to localStorage. */
export const AUTOSAVE_DELAY = 500

/** Maximum number of states kept in the undo history. */
export const MAX_HISTORY = 50

/** Defaults applied to any node missing fields (e.g. legacy saved data). */
export const DEFAULT_VARIANT: NodeVariant = 'default'
export const DEFAULT_SHAPE: NodeShape = 'rectangle'
export const DEFAULT_COLOR: NodeColor = 'slate'
export const DEFAULT_FILL_STYLE: FillStyle = 'solid'
export const DEFAULT_STROKE_STYLE: StrokeStyle = 'solid'
export const DEFAULT_STROKE_WIDTH: StrokeWidth = 'medium'
export const DEFAULT_OPACITY = 100
