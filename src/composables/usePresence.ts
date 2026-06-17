import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import * as Y from 'yjs'
import type { WebsocketProvider } from 'y-websocket'
import { CRDT_WS_URL } from '@/utils/constants'
import type { PresenceCursor, PresencePeer, PresenceUser } from '@/utils/presence'

/**
 * Live collaboration presence over the Yjs *awareness* CRDT. Every client in a
 * room publishes its {@link PresenceUser identity} + cursor position; this
 * composable exposes the *other* clients' cursors reactively and a setter to
 * broadcast the local one.
 *
 * Transport is `y-websocket` ({@link CRDT_WS_URL}); when no room id or no server
 * URL is configured the editor stays single-player and this is inert. Because
 * `y-websocket` touches browser globals, the provider is created lazily (and the
 * module dynamically imported) so the SSG/Node render pass never instantiates it
 * — the editor already lives behind `ClientOnly`, but this keeps it self-safe.
 *
 * @param roomId   The collaboration channel (room uuid, falling back to diagram id).
 * @param identity The local user's reactive identity (owner ⇒ black "owner" cursor).
 */
export function usePresence(
  roomId: Ref<string | null>,
  identity: Ref<PresenceUser | null>,
) {
  /** Remote peers with a live cursor (self excluded). */
  const peers = ref<PresencePeer[]>([])
  /** Whether the websocket transport is currently connected. */
  const connected = ref(false)

  let doc: Y.Doc | null = null
  let provider: WebsocketProvider | null = null
  let cursor: PresenceCursor | null = null

  /** Mirror the awareness map into `peers`, dropping ourselves and the empty. */
  function syncPeers() {
    if (!provider) return
    const { awareness } = provider
    const self = awareness.clientID
    const next: PresencePeer[] = []
    awareness.getStates().forEach((state, clientId) => {
      if (clientId === self) return
      const user = state.user as PresenceUser | undefined
      if (!user) return
      next.push({
        clientId,
        user,
        cursor: (state.cursor as PresenceCursor | null) ?? null,
      })
    })
    peers.value = next
  }

  async function connect() {
    const room = roomId.value
    if (!room || !CRDT_WS_URL || !identity.value) return

    // Dynamic import keeps y-websocket (and its `WebSocket` use) out of any
    // non-browser module-evaluation pass.
    const { WebsocketProvider } = await import('y-websocket')
    // Guard against a teardown / room change that happened while importing.
    if (roomId.value !== room || provider) return

    doc = new Y.Doc()
    provider = new WebsocketProvider(CRDT_WS_URL, room, doc)

    provider.on('status', ({ status }: { status: string }) => {
      connected.value = status === 'connected'
    })
    provider.awareness.on('change', syncPeers)

    // Seed our identity + last-known cursor immediately.
    provider.awareness.setLocalState({ user: identity.value, cursor })
    syncPeers()
  }

  function disconnect() {
    provider?.awareness.setLocalState(null)
    provider?.destroy()
    doc?.destroy()
    provider = null
    doc = null
    connected.value = false
    peers.value = []
  }

  /** Broadcast the local cursor (flow coords), or `null` when it leaves canvas. */
  function setCursor(next: PresenceCursor | null) {
    cursor = next
    if (!identity.value) return
    provider?.awareness.setLocalStateField('cursor', next)
  }

  // Re-publish identity whenever it changes (e.g. owner status resolves after a
  // projects fetch, or the user signs in mid-session).
  watch(
    identity,
    (user) => {
      if (user) provider?.awareness.setLocalStateField('user', user)
    },
    { deep: true },
  )

  // Reconnect when the room changes (Share stamps a fresh `?room=`).
  watch(
    roomId,
    () => {
      disconnect()
      void connect()
    },
    { immediate: true },
  )

  onBeforeUnmount(disconnect)

  return { peers, connected, setCursor }
}
