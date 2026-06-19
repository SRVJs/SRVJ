import { ref } from 'vue'
import { apiFetchEnvelope } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import { API_BASE_URL } from '@/utils/constants'

/**
 * Notifications feed backed by the SSE endpoints:
 *   GET  /notification/stream   — Server-Sent Events feed
 *   GET  /notification/list     — existing notifications (seeds the feed)
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

/** Server pagination metadata returned alongside the notifications page. */
export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

/** How many notifications to request per page (and per "load more"). */
const PAGE_LIMIT = 5

const notifications = ref<NotificationItem[]>([])
const status = ref<NotificationStatus>('idle')
const unread = ref(0)
const lastError = ref<string | null>(null)
const loadingList = ref(false)
/** True while a "load more" (next page) fetch is in flight. */
const loadingMore = ref(false)
/** Last page successfully loaded, and whether the server has more after it. */
const page = ref(1)
const hasNextPage = ref(false)

let controller: AbortController | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
/** Set while a connection is wanted; cleared by `disconnect` to stop retries. */
let active = false

/** Append a parsed notification, newest first, and bump the unread counter. */
function push(item: NotificationItem) {
  notifications.value = [item, ...notifications.value].slice(0, 50)
  unread.value += 1
}

/** The notification object shape returned by /list and the stream. */
interface RawNotification {
  id?: string
  type?: string
  title?: string
  message?: string
  createdAt?: string
}

/** Find the notifications array under any of the common keys (or a bare array). */
function pickArray(value: unknown): RawNotification[] {
  if (Array.isArray(value)) return value as RawNotification[]
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    for (const key of ['data', 'items', 'notifications', 'results', 'rows', 'list']) {
      if (Array.isArray(obj[key])) return obj[key] as RawNotification[]
    }
  }
  return []
}

/** Find the `pagination` object in the first candidate that has one. */
function pickPagination(...candidates: unknown[]): Pagination | undefined {
  for (const c of candidates) {
    if (c && typeof c === 'object') {
      const p = (c as Record<string, unknown>).pagination
      if (p && typeof p === 'object') return p as Pagination
    }
  }
  return undefined
}

/**
 * GET one page of notifications (newest first) and map it to display items.
 * Reads the whole envelope so `pagination` is found whether the server returns
 * it as a sibling of `data` (`{ data: [...], pagination }`) or nested inside it
 * (`{ data: { data: [...], pagination } }`).
 */
async function fetchPage(p: number): Promise<{ items: NotificationItem[]; pagination?: Pagination }> {
  const envelope = await apiFetchEnvelope<unknown>(
    `/notification/list?page=${p}&limit=${PAGE_LIMIT}`,
    { token: useAuthStore().token },
  )
  const list = pickArray(envelope.data)
  const pagination = pickPagination(envelope, envelope.data)
  return { items: list.map((n) => toItem(n)), pagination }
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

/** GET the first page of notifications (limit {@link PAGE_LIMIT}) and seed the feed. */
async function fetchList() {
  if (!API_BASE_URL) return
  loadingList.value = true
  try {
    const { items, pagination } = await fetchPage(1)
    notifications.value = items
    page.value = pagination?.page ?? 1
    hasNextPage.value = pagination?.hasNextPage ?? false
  } catch (err) {
    lastError.value = err instanceof Error ? err.message : 'Failed to load notifications'
  } finally {
    loadingList.value = false
  }
}

/**
 * Fetch the next page and append it to the feed (infinite scroll). No-op when a
 * load is already running or the server has no further pages. New items are
 * deduped by id so a live SSE push doesn't show twice.
 */
async function loadMore() {
  if (!API_BASE_URL || loadingList.value || loadingMore.value || !hasNextPage.value) return
  loadingMore.value = true
  try {
    const next = page.value + 1
    const { items, pagination } = await fetchPage(next)
    const seen = new Set(notifications.value.map((n) => n.id))
    notifications.value = [...notifications.value, ...items.filter((n) => !seen.has(n.id))]
    page.value = pagination?.page ?? next
    hasNextPage.value = pagination?.hasNextPage ?? false
  } catch (err) {
    lastError.value = err instanceof Error ? err.message : 'Failed to load notifications'
  } finally {
    loadingMore.value = false
  }
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
    loadingMore,
    hasNextPage,
    connect,
    disconnect,
    fetchList,
    loadMore,
    markAllRead,
    clear,
  }
}
