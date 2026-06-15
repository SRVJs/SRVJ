import { API_BASE_URL } from './constants'
import type { ApiEnvelope } from '@/types/auth'

/**
 * Error thrown by {@link apiFetch} for any non-successful request. `status` is
 * the HTTP status (or `0` for a network/transport failure) so callers can
 * branch on `401` to clear a stale session.
 */
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
  /**
   * Request payload. A `FormData` is sent as-is (multipart — the browser sets
   * its own `Content-Type` boundary); anything else is JSON-serialised.
   */
  body?: unknown
  /** Bearer access token attached as `Authorization: Bearer <token>`. */
  token?: string | null
  /**
   * Opt out of the automatic refresh-and-retry on 401. Set for the auth
   * endpoints themselves (`/auth/refresh`, `/auth/login`) so a failed refresh
   * can't recurse into another refresh.
   */
  skipAuthRefresh?: boolean
}

/**
 * Callback that exchanges the httpOnly refresh cookie for a fresh access token,
 * returning the new token (or `null` if the session can no longer be renewed).
 * The auth store registers its `refresh` action here via
 * {@link registerTokenRefresher}, keeping {@link apiFetch} free of store imports.
 */
type TokenRefresher = () => Promise<string | null>

let tokenRefresher: TokenRefresher | null = null
/** De-duped in-flight refresh, so concurrent 401s trigger a single refresh. */
let refreshInFlight: Promise<string | null> | null = null

/** Register the callback {@link apiFetch} uses to renew an expired token. */
export function registerTokenRefresher(refresher: TokenRefresher | null): void {
  tokenRefresher = refresher
}

/** Run the refresher at most once concurrently; callers share the result. */
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

/** Issue the request and unwrap the {@link ApiEnvelope}; throws on failure. */
async function rawFetch<T>(path: string, method: string, body: unknown, token: string | null | undefined): Promise<T> {
  const isMultipart = typeof FormData !== 'undefined' && body instanceof FormData

  const headers: Record<string, string> = {}
  // Let the browser set `Content-Type` (with boundary) for multipart bodies.
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

  if (!response.ok || !envelope?.success) {
    throw new ApiError(
      envelope?.message ?? `Request failed (${response.status})`,
      response.status,
    )
  }

  return envelope.data
}

/**
 * Thin fetch wrapper around the SRVJ backend. Attaches the bearer token, sends
 * credentials (so the httpOnly refresh cookie rides along where same-site),
 * unwraps the standard {@link ApiEnvelope}, and throws {@link ApiError} on any
 * failure — including the raw-HTML error pages the backend occasionally
 * returns, which would otherwise blow up `response.json()`.
 *
 * When an authenticated request comes back `401` (expired access token), it
 * transparently calls the registered {@link TokenRefresher}, then retries the
 * request once with the fresh token. Only if the refresh fails does the `401`
 * propagate (clearing the session upstream).
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, skipAuthRefresh = false } = options

  try {
    return await rawFetch<T>(path, method, body, token)
  } catch (error) {
    const canRetry = error instanceof ApiError && error.status === 401 && token != null && !skipAuthRefresh
    if (!canRetry) throw error

    const freshToken = await refreshToken()
    if (!freshToken) throw error

    return rawFetch<T>(path, method, body, freshToken)
  }
}
