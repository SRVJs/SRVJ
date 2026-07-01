import { useHead } from '@unhead/vue'

/**
 * Inter (base UI font, `--font-ui`) + Architects Daughter (sketch-mode
 * hand-drawn text, `--font-hand`) — see `src/style.css`. Loaded only by the
 * app-shell routes that render them (Dashboard, Editor, Demo, Invite,
 * Reset-password, 404). Home ships its own marketing typefaces and must not
 * pay for these render-blocking requests.
 */
export function useAppFonts() {
  useHead({
    link: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Architects+Daughter&family=Inter:wght@400;500;600;700&display=swap',
      },
    ],
  })
}
