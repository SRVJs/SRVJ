import { useHead } from '@unhead/vue'
import { SITE_URL } from '@/utils/constants'

interface SeoOptions {
  /** Document title for the route. */
  title: string
  /** Path of the canonical URL (e.g. `/`). Omit for routes with no stable
   *  canonical (e.g. per-user pages, the 404 page) — no canonical link or
   *  `og:url` is emitted rather than silently defaulting to the site root. */
  path?: string
  /** When true, emit `noindex, nofollow` (e.g. the 404 page). */
  noindex?: boolean
}

/**
 * Per-route `<head>` management, rendered into the static HTML by `vite-ssg`
 * (via `@unhead/vue`) and kept reactive on the client. Sets the title, the
 * canonical link, and the robots directive; the shared social/Open Graph tags
 * live in `index.html`.
 */
export function useSeo({ title, path, noindex = false }: SeoOptions) {
  useHead({
    title,
    link: path ? [{ rel: 'canonical', href: `${SITE_URL}${path}` }] : [],
    meta: [
      { name: 'robots', content: noindex ? 'noindex, nofollow' : 'index, follow' },
      { property: 'og:title', content: title },
      ...(path ? [{ property: 'og:url', content: `${SITE_URL}${path}` }] : []),
    ],
  })
}
