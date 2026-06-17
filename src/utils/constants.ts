import type {
  FillStyle,
  NodeColor,
  NodeShape,
  NodeVariant,
  StrokeStyle,
  StrokeWidth,
} from '@/types/diagram'

export const SITE_URL = 'https://srvj.elrefai.me'
export const SITE_NAME = 'SRVJ'
export const SITE_DESCRIPTION =
  'SRVJ is a free, browser-based diagram editor and whiteboard'
export const DIAGRAM_VERSION = 3
export const STORAGE_KEY = 'srvj:diagram'
export const THEME_STORAGE_KEY = 'srvj:theme'
export const SKETCH_STORAGE_KEY = 'srvj:sketch'
export const AUTH_TOKEN_STORAGE_KEY = 'srvj:auth-token'

/**
 * Base URL of the SRVJ backend (all auth/user endpoints live under it).
 * Override per-environment with a `VITE_API_URL` env var.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL as string | undefined

/**
 * Google OAuth **web** client ID, used to render the Google Identity Services
 * sign-in popup / One Tap card. Set it via `VITE_GOOGLE_CLIENT_ID`; when absent,
 * the auth dialog falls back to the server-redirect Google button.
 */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

/**
 * WebSocket URL of the CRDT (Yjs / y-websocket) presence + sync server. Live
 * collaboration cursors connect here, joining a channel named after the room
 * (or the diagram id). Set it via `VITE_CRDT_WS_URL` (e.g. `wss://crdt.srvj…`);
 * when absent, presence is disabled and the editor is single-player.
 */
export const CRDT_WS_URL = import.meta.env.VITE_CRDT_WS_URL as string | undefined
export const AUTOSAVE_DELAY = 500
export const MAX_HISTORY = 50
export const DEFAULT_VARIANT: NodeVariant = 'default'
export const DEFAULT_SHAPE: NodeShape = 'rectangle'
export const DEFAULT_COLOR: NodeColor = 'slate'
// Excalidraw-style: new shapes are outline-only (the canvas shows through).
// Sticky notes are forced solid at creation (see `buildNode`).
export const DEFAULT_FILL_STYLE: FillStyle = 'transparent'
export const DEFAULT_STROKE_STYLE: StrokeStyle = 'solid'
export const DEFAULT_STROKE_WIDTH: StrokeWidth = 'medium'
export const DEFAULT_OPACITY = 100
