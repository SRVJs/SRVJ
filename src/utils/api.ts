import { API_BASE_URL } from './constants'
import type { ApiEnvelope } from '@/types/auth'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string | null
  skipAuthRefresh?: boolean
}

type TokenRefresher = () => Promise<string | null>

let tokenRefresher: TokenRefresher | null = null
let refreshInFlight: Promise<string | null> | null = null

export function registerTokenRefresher(refresher: TokenRefresher | null): void {
  tokenRefresher = refresher
}

function refreshToken(): Promise<string | null> {
  if (!tokenRefresher) return Promise.resolve(null)
  if (!refreshInFlight) {
    refreshInFlight = tokenRefresher()
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

async function rawFetchEnvelope<T>(
  path: string,
  method: string,
  body: unknown,
  token: string | null | undefined,
): Promise<ApiEnvelope<T>> {
  const isMultipart = typeof FormData !== 'undefined' && body instanceof FormData

  const headers: Record<string, string> = {}
  if (body !== undefined && !isMultipart) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : isMultipart ? (body as FormData) : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Network error — please check your connection and try again.', 0)
  }

  let envelope: ApiEnvelope<T> | null = null
  try {
    envelope = (await response.json()) as ApiEnvelope<T>
  } catch {
    envelope = null
  }

  const explicitlyFailed = envelope?.success === false || envelope?.error === true
  if (!response.ok || !envelope || explicitlyFailed) {
    throw new ApiError(
      envelope?.message ?? `Request failed (${response.status})`,
      response.status,
    )
  }

  return envelope
}

/** Run `op`, and on a single 401 transparently refresh the token and retry once. */
async function withRefresh<R>(
  token: string | null | undefined,
  skipAuthRefresh: boolean,
  op: (token: string | null | undefined) => Promise<R>,
): Promise<R> {
  try {
    return await op(token)
  } catch (error) {
    const canRetry = error instanceof ApiError && error.status === 401 && token != null && !skipAuthRefresh
    if (!canRetry) throw error

    const freshToken = await refreshToken()
    if (!freshToken) throw error

    return op(freshToken)
  }
}

/** The common case: unwrap and return just the envelope's `data` payload. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, skipAuthRefresh = false } = options
  const envelope = await withRefresh(token, skipAuthRefresh, (t) =>
    rawFetchEnvelope<T>(path, method, body, t),
  )
  return envelope.data
}

/**
 * Like {@link apiFetch} but returns the *whole* envelope, so callers can read
 * sibling fields (e.g. `pagination`) that live next to `data` rather than inside it.
 */
export async function apiFetchEnvelope<T>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const { method = 'GET', body, token, skipAuthRefresh = false } = options
  return withRefresh(token, skipAuthRefresh, (t) => rawFetchEnvelope<T>(path, method, body, t))
}
