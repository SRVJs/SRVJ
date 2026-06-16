import { GOOGLE_CLIENT_ID } from '@/utils/constants'

/**
 * Thin wrapper over Google Identity Services (GIS). It lazily injects Google's
 * `gsi/client` script, initialises it with the configured web client ID, and
 * exposes the two ways to surface the sign-in popup the user expects:
 *
 *  - `renderButton` paints Google's official "Sign in with Google" button,
 *    which opens the account-chooser popup on click;
 *  - `prompt` shows the floating One Tap card (the account list from the
 *    screenshot) on top of the page.
 *
 * Both hand back a Google **ID token** (`credential`, a JWT) via the callback
 * passed to {@link init}; the caller exchanges it with the SRVJ backend for a
 * session token. All of this is client-only — calling on the server is a no-op.
 */

const GIS_SRC = 'https://accounts.google.com/gsi/client'

/** The single field we use off the GIS credential callback. */
interface CredentialResponse {
  credential: string
}

interface GoogleIdApi {
  initialize(config: {
    client_id: string
    callback: (response: CredentialResponse) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
    use_fedcm_for_prompt?: boolean
  }): void
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void
  prompt(): void
  cancel(): void
  disableAutoSelect(): void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } }
  }
}

/** De-duped script load, shared across every `useGoogleAuth()` caller. */
let scriptPromise: Promise<void> | null = null

function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google sign-in needs a browser.'))
  if (window.google?.accounts?.id) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null // allow a retry on the next attempt
      reject(new Error('Failed to load Google sign-in.'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

export function useGoogleAuth() {
  /** Whether a client ID is configured — gates the whole GIS path. */
  const isConfigured = Boolean(GOOGLE_CLIENT_ID)

  /** Load + initialise GIS, wiring `onCredential` to the returned ID token. */
  async function init(onCredential: (credential: string) => void): Promise<void> {
    if (!isConfigured) throw new Error('Missing VITE_GOOGLE_CLIENT_ID')
    await loadGisScript()
    window.google!.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID as string,
      callback: (response) => onCredential(response.credential),
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: true,
    })
  }

  /** Paint Google's official sign-in button into `el`. */
  function renderButton(el: HTMLElement, options: Record<string, unknown> = {}): void {
    window.google?.accounts.id.renderButton(el, {
      type: 'standard',
      theme: 'filled_black',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: 336,
      ...options,
    })
  }

  /** Show the floating One Tap account-chooser card. */
  function prompt(): void {
    window.google?.accounts.id.prompt()
  }

  /** Dismiss the One Tap card (e.g. when the dialog closes). */
  function cancel(): void {
    window.google?.accounts.id.cancel()
  }

  return { isConfigured, init, renderButton, prompt, cancel }
}
