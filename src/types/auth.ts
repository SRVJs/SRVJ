/**
 * Standard response envelope returned by every SRVJ backend endpoint.
 * Successful calls carry `success: true` and a typed `data` payload; handled
 * failures carry `success: false`, `error: true`, and a human `message`.
 */
export interface ApiEnvelope<T> {
  code: number
  status: string
  timestamp?: number | string
  /** Present on auth endpoints; omitted by some others (e.g. `/project*`). A
   * response is only treated as a failure when this is explicitly `false`. */
  success?: boolean
  error?: boolean
  message: string
  data: T
}

/** Authenticated user profile, as returned by `GET /user/me`. */
export interface User {
  id: number
  fullname: string
  email: string
  username: string
  avatar: string
}

/** `data` payload of `POST /auth/login` and `POST /auth/refresh`. */
export interface AuthData {
  /** Short-lived bearer access token (also mirrored into an httpOnly cookie). */
  token: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  fullname: string
  email: string
  password: string
}

/**
 * Fields for `POST /user/update` (multipart). Both are optional so the user can
 * change just their name, just their avatar, or both. `img` is the new avatar
 * file; omit it to keep the current one.
 */
export interface UpdateProfilePayload {
  fullname?: string
  img?: File | null
}
