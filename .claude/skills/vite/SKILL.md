---
name: vite
description: Work with the Vite build/dev setup in this Vue 3 portfolio — plugins (vue, auto-import, components, UnoCSS, custom sitemap), the auto-import system, dev vs build commands, and the Netlify/Docker output. Use when editing vite.config.ts, adding plugins, debugging build/dev/HMR issues, or configuring auto-imports, sitemap, or deploy output.
---

# Vite for this project

Build tooling is **Vite 5** configured in `vite.config.ts`. Use this skill when touching the build/dev pipeline so changes fit the existing plugin chain and auto-import conventions.

Always read `vite.config.ts` before assuming a plugin or alias exists.

## Commands

```bash
npm run dev          # Vite dev server at http://localhost:5173 (HMR)
npm run build        # vue-tsc type-check (run-p) + vite build, then copies _dist_redirects → dist/_redirects
npm run build-only   # vite build, skips type-check (faster; use to isolate type vs build errors)
npm run type-check   # vue-tsc --build --force only
npm run preview      # serve the production dist/ locally
```

There is no test suite. The `build` script also runs the type-checker in parallel via `npm-run-all2` (`run-p`), so a type error fails the build — use `build-only` to confirm a bundling issue independent of types.

## Plugin chain (order matters)

In `vite.config.ts` → `plugins`, in this order:

1. **`vue()`** — `@vitejs/plugin-vue`, SFC support (`<script setup>`).
2. **`Components()`** — `unplugin-vue-components`. Auto-imports any component in `src/components/` by filename — **no import statement needed**. Generates `components.d.ts`.
3. **`AutoImport({...})`** — `unplugin-auto-import`. Auto-imports APIs from `vue`, `vue/macros`, `@vueuse/core`, and every composable in `src/composables/`. `vueTemplate: true` makes them usable in `<template>` too. Generates `auto-imports.d.ts`.
4. **`UnoCSS()`** — must come with the UnoCSS preset config in `uno.config.ts` (see the `unocss` skill).
5. **`sitemapPlugin()`** — custom local plugin (see below).

When adding a plugin, place it sensibly in this chain (e.g. transforms before UnoCSS). After changing auto-import sources, the generated `.d.ts` files refresh on next dev/build — if types look stale, restart the dev server.

## Auto-imports — the #1 gotcha

- **Do NOT write** `import { ref, computed, onMounted } from 'vue'` — they're auto-imported. Same for `@vueuse/core` helpers and anything exported from `src/composables/`.
- **Do NOT import** components that live in `src/components/` — reference them directly in templates.
- Redundant explicit imports are not an error but are non-idiomatic here; remove them.
- To auto-import from a new source, add it to `AutoImport({ imports: [...] })` or add the folder to `dirs`. To auto-import components from another folder, configure `Components({ dirs: [...] })`.
- The generated `auto-imports.d.ts` and `components.d.ts` are what give the IDE/TS types — don't hand-edit them.

## Custom sitemap plugin

`sitemapPlugin()` is defined inline in `vite.config.ts`:
- **Dev**: serves `/sitemap.xml` via middleware (generated on each request).
- **Build**: `closeBundle()` writes `dist/sitemap.xml`.
- Source of truth is `sitemapEntries` and `siteUrl` from `src/utils/site.ts`. To add/remove a sitemap URL or change `changefreq`/`priority`, edit `src/utils/site.ts`, not the plugin.
- `lastmod` is stamped at build time (`new Date().toISOString()`).

## Build output & deployment

- Output goes to `dist/`.
- **Netlify SPA routing**: `build` copies `_dist_redirects` → `dist/_redirects`. If you add routes that need server-side fallback, that file is the place. `build-only` does NOT copy it — use full `build` for a deploy-accurate bundle.
- **Docker**: multi-stage Dockerfile runs `npm run build` in the builder stage and serves `dist/` via Nginx; dev stage runs `vite --host`.

## Conventions & gotchas

- No `resolve.alias` is configured — imports are relative or from `node_modules`. If you want an `@/` alias, add it to both `vite.config.ts` (`resolve.alias`) and `tsconfig` paths to keep TS happy.
- Env vars must be prefixed `VITE_` to reach client code (`import.meta.env.VITE_*`). Used by `src/utils/spotify.ts` (Spotify API).
- Dev server is `http://localhost:5173`. If a build error mentions a missing auto-import type, it's usually a stale `.d.ts` — re-run dev/build.
- Keep `vite.config.ts` minimal; project-specific data (routes, sitemap, projects) lives under `src/utils/`, not in the config.
