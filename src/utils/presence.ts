/**
 * Shared types and helpers for live collaboration presence (the named cursors
 * of everyone in a room). Identity is broadcast over the Yjs *awareness*
 * protocol; the owner is rendered as a black cursor labelled "owner", while
 * every other collaborator gets a stable colour derived from their id.
 */

/** Cursor position, in **flow coordinates** so it's zoom/pan-independent. */
export interface PresenceCursor {
  x: number
  y: number
}

/** A collaborator's identity, broadcast alongside their cursor. */
export interface PresenceUser {
  /** Stable id (the backend user id, or a per-tab uuid for guests). */
  id: string
  /** Display name shown on the cursor label ("owner" for the project owner). */
  name: string
  /** Cursor + label colour (hex). The owner's is black. */
  color: string
  /** Whether this user owns the project/diagram. */
  isOwner: boolean
}

/** Full awareness state a peer publishes. `cursor` is `null` off-canvas. */
export interface PresenceState {
  user: PresenceUser
  cursor: PresenceCursor | null
}

/** A remote peer, as rendered by the cursor overlay. */
export interface PresencePeer extends PresenceState {
  /** Yjs awareness client id — stable for the life of the connection. */
  clientId: number
}

/** The owner's cursor is always solid black (matches the requested design). */
export const OWNER_COLOR = '#1e1e1e'
export const OWNER_LABEL = 'owner'

/**
 * Distinct, high-contrast cursor colours for sub-users — mirrors the editor's
 * named palette (see {@link file://src/utils/colors.ts}) so the room feels of a
 * piece with the canvas. A user's colour is picked deterministically from their
 * id, so they keep the same colour across reconnects and on every other screen.
 */
const PEER_COLORS = [
  '#0ea5e9', // sky
  '#10b981', // emerald
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
] as const

/** Deterministic colour for a sub-user, hashed from their id. */
export function peerColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return PEER_COLORS[hash % PEER_COLORS.length]
}
