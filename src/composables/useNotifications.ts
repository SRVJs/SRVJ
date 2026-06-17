import { ref } from 'vue'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import { API_BASE_URL } from '@/utils/constants'

/**
 * TEST-ONLY notifications harness for the SSE endpoints:
 *   GET  /notification/stream   — Server-Sent Events feed
 *   POST /notification/publish  — body { title, message }
 *
 * The stream is consumed with `fetch` + a `ReadableStream` reader (not the
 * native `EventSource`) so the bearer access token can ride along in an
 * `Authorization` header — `EventSource` can't set request headers. Events are
 * parsed from the raw `text/event-stream` body by splitting on the blank-line
 * record separator. State is module-level (mirroring `useDarkMode`/
 * `useEditorTool`) so every caller shares one live connection.
 */

export interface NotificationItem {
  /** Server notification id (falls back to the SSE `id:` / a generated one). */
  id: string
  type?: string
  title: string
  message: string
  /** Epoch ms — server `createdAt` when present, else client receive time. */
  receivedAt: number
}

export type NotificationStatus = 'idle' | 'connecting' | 'open' | 'error'

const notifications = ref<NotificationItem[]>([])
const status = ref<NotificationStatus>('idle')
const unread = ref(0)
const lastError = ref<string | null>(null)
const loadingList = ref(false)

let controller: AbortController | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
/** Set while a connection is wanted; cleared by `disconnect` to stop retries. */
let active = false

/** Append a parsed notification, newest first, and bump the unread counter. */
function push(item: NotificationItem) {
  notifications.value = [item, ...notifications.value].slice(0, 50)
  unread.value += 1
}

/** The notification object shape returned by /publish, /list, and the stream. */
interface RawNotification {
  id?: string
  type?: string
  title?: string
  message?: string
  createdAt?: string
}

/** Normalise a server notification object into a display item. */
function toItem(raw: RawNotification, fallbackId = ''): NotificationItem {
  const created = raw.createdAt ? Date.parse(raw.createdAt) : NaN
  return {
    id: raw.id || fallbackId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: raw.type,
    title: raw.title ?? 'Notification',
    message: raw.message ?? '',
    receivedAt: Number.isNaN(created) ? Date.now() : created,
  }
}

/** Turn one raw SSE record (the text between blank lines) into an item. */
function parseRecord(record: string): NotificationItem | null {
  let sseId = ''
  const dataLines: string[] = []
  for (const rawLine of record.split('\n')) {
    const line = rawLine.replace(/\r$/, '')
    if (line.startsWith(':')) continue // comment / heartbeat
    if (line.startsWith('id:')) sseId = line.slice(3).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''))
  }
  if (dataLines.length === 0) return null

  const data = dataLines.join('\n')
  try {
    // The stream emits a notification object: { id, userId, type, title,
    // message, createdAt }. Unwrap an { data } envelope if one is present.
    const raw = JSON.parse(data) as Record<string, unknown>
    const obj = (raw && typeof raw.data === 'object' ? raw.data : raw) as RawNotification
    return toItem(obj, sseId)
  } catch {
    // Non-JSON payload — keep the raw text as the message.
    return { id: sseId || `${Date.now()}`, title: 'Notification', message: data, receivedAt: Date.now() }
  }
}

/** Read the stream body to completion, emitting an item per SSE record. */
async function readStream(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // Records are separated by a blank line (\n\n, tolerate \r\n\r\n). The last
    // chunk is a possibly-incomplete record, so keep it in the buffer.
    const records = buffer.split(/\r?\n\r?\n/)
    buffer = records.pop() ?? ''
    for (const record of records) {
      const item = parseRecord(record)
      if (item) push(item)
    }
  }
}

async function connect() {
  if (!API_BASE_URL || status.value === 'open' || status.value === 'connecting') return
  active = true
  status.value = 'connecting'
  lastError.value = null
  controller = new AbortController()

  const token = useAuthStore().token
  try {
    const res = await fetch(`${API_BASE_URL}/notification/stream`, {
      headers: {
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      signal: controller.signal,
    })
    if (!res.ok || !res.body) throw new Error(`stream responded ${res.status}`)
    status.value = 'open'
    await readStream(res.body)
    // Stream ended cleanly (server closed) — fall through to reconnect.
    throw new Error('stream closed')
  } catch (err) {
    if ((err as Error).name === 'AbortError' || !active) {
      status.value = 'idle'
      return
    }
    status.value = 'error'
    lastError.value = (err as Error).message
    // Test-grade backoff: retry every 3s while still wanted.
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      void connect()
    }, 3000)
  }
}

function disconnect() {
  active = false
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  controller?.abort()
  controller = null
  status.value = 'idle'
}

/** GET the existing notifications and seed the feed (newest first). */
async function fetchList() {
  if (!API_BASE_URL) return
  loadingList.value = true
  try {
    const data = await apiFetch<RawNotification[]>('/notification/list', {
      token: useAuthStore().token,
    })
    const items = (Array.isArray(data) ? data : []).map((n) => toItem(n))
    items.sort((a, b) => b.receivedAt - a.receivedAt)
    notifications.value = items.slice(0, 50)
  } catch (err) {
    lastError.value = err instanceof Error ? err.message : 'Failed to load notifications'
  } finally {
    loadingList.value = false
  }
}

/** POST a test notification to the publish endpoint. */
async function publish(payload: { title: string; message: string }) {
  await apiFetch('/notification/publish', {
    method: 'POST',
    body: payload,
    token: useAuthStore().token,
  })
}

function markAllRead() {
  unread.value = 0
}

function clear() {
  notifications.value = []
  unread.value = 0
}

export function useNotifications() {
  return {
    notifications,
    status,
    unread,
    lastError,
    loadingList,
    connect,
    disconnect,
    fetchList,
    publish,
    markAllRead,
    clear,
  }
}
