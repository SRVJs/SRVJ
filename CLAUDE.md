# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

SRVJ is a browser-based diagram editor / whiteboard (Draw.io-style flow editor with Excalidraw and Miro flavour) built with Vue 3, Vite, TypeScript, Vue Flow, Pinia, and UnoCSS. It ships as a **pre-rendered static site** (vite-ssg) with an authenticated backend that stores **projects → diagrams**. The app is four pages: a public marketing **Home** (`/`), a **Dashboard** of projects (`/dashboard`), a **Project** page listing its diagrams (`/projects/:projectId`), and the **Editor** canvas (`/editor/:diagramId`).

`AGENTS.md` holds repo contribution rules (commit/PR style, a "show changes before editing" permission policy, and an allow/deny list); `README.md` is the user-facing feature tour. This file is the architecture map — read it alongside those.

## Commands

This project uses **pnpm** (npm's installer trips over the existing pnpm store layout). Run from the project root.

```bash
pnpm install
pnpm dev          # Vite dev server (prints local URL, e.g. http://localhost:5173)
pnpm type-check   # vue-tsc --noEmit  (strict; this is the only "lint")
pnpm build        # vue-tsc --noEmit, then vite-ssg build (static pre-render per route)
pnpm preview      # serve the production build
```

There is **no test suite and no ESLint/Prettier config**. `pnpm type-check` (or `pnpm build`) is the gate — `tsconfig.json` is strict with `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, and `noFallthroughCasesInSwitch`, so unused imports/vars fail the build. There is no single-test command (no tests exist).

## Architecture

### Static generation + client-only editor
`main.ts` boots via **`ViteSSG`** (not `createApp`): it owns the app + router, pre-renders each route in `src/router/index.ts` to static HTML at build time, then hydrates in the browser. Only the **static** routes are pre-rendered (`/` → `index.html`, `/dashboard` → `dashboard.html`); the param routes (`/projects/:id`, `/editor/:id`) render client-side only. Vue Flow is **DOM-only** and cannot run in the Node render pass, so `EditorView.vue` wraps the whole editor in **`ClientOnly.vue`** — its `#fallback` slot renders a real, crawler-visible SEO shell during SSG and the first client paint, and the live editor swaps in `onMounted`. `useSeo` sets per-route `<head>` tags via `@unhead/vue` (`noindex: true` on the app pages; only Home is indexed). **Any new browser-API code (localStorage, `window`, Vue Flow) must sit behind `ClientOnly` or an `onMounted`/guard**, or it breaks the build's Node render. The Home/Dashboard/Project pages contain no Vue Flow and SSG-render directly; the `AuthDialog` they mount stays inert during SSG because its content is gated behind `v-if="open"` (`open` starts `false`).

`EditorView.vue` is the editor composition root: it reads `:diagramId` from the route, and in `onMounted` (after `auth.init()`) branches — **with** an id + token it loads/saves via the backend (`useDiagramSync`), **otherwise** it falls back to the local-only canvas (`useDiagramPersistence`), whose `load()` runs **synchronously before mount** so Vue Flow's `fit-view-on-init` sees restored nodes. Dashboard/Project views gate their data fetch on `auth.isAuthenticated` (no router guards — they render a "sign in" panel when signed out). Signing in **from the Home page** redirects to `/dashboard` (handled in `AuthDialog`/`AuthMenu` by checking `route.name === 'home'`); signing in elsewhere stays put.

### The Pinia store is the single source of truth; Vue Flow runs *controlled*
`src/stores/diagram.ts` owns nodes, edges, selection, and undo/redo history. `DiagramCanvas.vue` binds `:nodes`/`:edges` from the store and feeds every Vue Flow event back into it:

`VueFlow @nodes-change/@edges-change` → `store.onNodesChange/onEdgesChange` → `applyNodeChanges/applyEdgeChanges` rewrite `store.nodes/edges` → bound back into `:nodes/:edges`.

So **the store's node objects *are* Vue Flow's processed `GraphNode`s.** Domain types (`DiagramNode`, `DiagramEdge` in `src/types/diagram.ts`) are deliberately plain/serialisable and are cast across the Vue Flow boundary with `as unknown as GraphNode[]`.

### Mutation gotcha: replace, don't mutate in place
Vue Flow only re-renders when the node array / node object **reference changes**. A store action that mutates `node.data.x` in place will update state but **will not re-render the node**. Always rebuild:

```ts
this.nodes = this.nodes.map((n) =>
  n.id === id ? { ...n, data: { ...n.data, label } } : n,
)
```

`updateNodeColor`, `updateNodeLabel`, the fill/stroke/opacity updaters, and the crow's-foot table-field actions all follow this — match it for any new node-data mutation.

### Undo/redo
`commit()` deep-clones the current diagram onto a `past` stack (capped at `MAX_HISTORY` = 50) and clears `future`. **Mutating actions call `commit()` first.** The high-frequency change handlers (`onNodesChange`/`onEdgesChange`) intentionally do **not** commit; instead a node drag is bracketed by one `store.commit()` on `@node-drag-start`. Selection is **derived** from each element's `.selected` flag (kept in sync by `applyNodeChanges`), not stored as a separate list.

### One custom node renders everything
A single Vue Flow node type, `custom` → `CustomNode.vue`, renders all shapes and flow variants. `node.data` carries `shape`, `variant`, `color`, `fillStyle`, `strokeStyle`, `strokeWidth`, `opacity`, `label`, and (tables only) `fields`. Shapes span classic flow (`rectangle`/`ellipse`/`diamond`/`sticky`/`text`) **and ERD**: Chen-notation stamps (`entity`, `weak-entity`, `relationship`, `weak-relationship`, `attribute`, `key-attribute`, `multivalued-attribute`, `derived-attribute`) plus a crow's-foot `table` with inline-editable `ErdField` rows (PK/FK toggles, add/remove). New shapes are created blank and open straight into inline label editing: `store.addNode` records the new id in `editNodeId`, and the freshly-mounted `CustomNode` claims it once via `store.takeEditNode(id)`. Edges use one `custom` type (`CustomEdge.vue`) — a straight line with an inline-editable label and an `ArrowClosed` marker.

### Tools & interaction model live outside Pinia
`src/composables/useEditorTool.ts` holds the active tool and style defaults (`activeColor`/`activeFillStyle`/`activeStrokeStyle`/`activeStrokeWidth`/`activeOpacity`) as **module-level refs** (not store state) so `NodePalette.vue` and `DiagramCanvas.vue` share one source. The active tool is `'select' | 'connect' | ShapeTool` (a `{ shape, variant }` object):

- **Shape tools** → `DiagramCanvas.vue` draws to create: capture-phase pointer handlers track a drag rectangle and call `store.addNode` on release (a sub-threshold drag drops a default-sized node). The palette also supports HTML drag-and-drop onto the canvas (`handleDrop`).
- **`connect`** (Arrow tool) → click a source node then a target; `onNodeClick` calls `store.connectNodes(source, target)`.
- **`select`** → normal Vue Flow selection/drag/marquee. Hold **space** to temporarily pan.

`useDarkMode` and `useSketchMode` use the same module-level-ref pattern and toggle a class on `<html>` (`.dark`, `.sketch-mode`), persisting the choice. `useKeyboardShortcuts` wires global Delete / Ctrl+Z / Ctrl+A / `V` (select) / Esc.

### Multi-anchor connection handles
`src/utils/handles.ts` is the shared contract for connection points: every node renders several **invisible** handles per side (centre + two offsets — `1px`, `pointer-events:none`, see `.handle-side` in `style.css`). `CustomNode` renders them via `nodeHandleDescriptors()`; the store's `connectNodes` picks the facing sides and distributes successive edges across anchors with `nextAnchorOnSide` so arrows fan out instead of stacking. Handle id index 0 keeps the bare side name (`top`) so edges saved before multi-anchor still resolve.

### Persistence — two paths, one snapshot shape
Both paths read/write the store's `DiagramSnapshot` (`{ version, nodes, edges }`); only the backing store differs, chosen at mount by whether the editor URL carries a diagram id + a token:
- **Local** (`useDiagramPersistence`): `load()` restores a snapshot synchronously on startup; a debounced (`AUTOSAVE_DELAY` = 500ms) deep watcher auto-saves to `localStorage`. This is the signed-out / no-id fallback.
- **Backend** (`useDiagramSync`): `load()` GETs `/diagrams/:id` and `applySnapshot`s it; the same debounced watcher PATCHes the whole snapshot back. A `ready` flag gates the first save so the initial GET doesn't immediately echo back as a PATCH. (CRDT/real-time merging is handled server-side; the client only ships whole snapshots.)

Snapshots carry `DIAGRAM_VERSION`; `normalizeNode` backfills defaults so legacy/imported diagrams stay valid. `localStorage` access goes through the never-throws `src/utils/storage.ts` wrapper. Keys live in `src/utils/constants.ts`: `srvj:diagram`, `srvj:theme`, `srvj:sketch`, `srvj:auth-token`. JSON export/import is in `src/utils/exportImport.ts`. The editor toolbar's **Share** button stamps a `?room=<uuid>` query onto the editor URL (the collaboration room id) and copies the link.

### Auth + projects backend
`src/stores/auth.ts` + `src/utils/api.ts` talk to the SRVJ backend at `API_BASE_URL` (`VITE_API_URL` env var). `apiFetch` attaches the bearer token, sends credentials, unwraps the standard `ApiEnvelope`, throws `ApiError` (with `status`), and on a `401` **transparently refreshes the access token once and retries** (the auth store registers its `refresh` via `registerTokenRefresher`, keeping `api.ts` free of store imports). The **editor canvas** stays usable signed out (local-only); **projects/diagrams require a session**.

The projects layer mirrors the auth pattern: `src/utils/projectsApi.ts` holds typed wrappers over the REST endpoints (`/projects`, `/projects/:id/diagrams`, `/diagrams/:id`), taking the token as an argument so the module stays store-free; `src/stores/projects.ts` (Pinia) owns the dashboard list, the open project, and its diagrams, pulling the token from the auth store per call. Types are in `src/types/project.ts`. **If the backend's route shape differs, `projectsApi.ts` is the single place to change it.**

## Conventions

- **`@/` aliases `src/`** (configured in both `vite.config.ts` and `tsconfig.json`).
- **Auto-imports** (`vite.config.ts`): Vue, Pinia, and Vue Router APIs plus anything in `src/composables` and `src/stores` are auto-imported; components in `src/components` and `src/views` are auto-registered. `src/auto-imports.d.ts` and `src/components.d.ts` are **generated — never edit them by hand**. (Existing code still imports explicitly; either style works.)
- **Icons** are pure-CSS via UnoCSS `presetIcons`: use class names like `i-mdi-trash-can-outline`, `i-carbon-flow`. Icons referenced **dynamically** (string-built class names) must be added to `safelist` in `uno.config.ts`, or they won't be generated.
- **Styling** is UnoCSS utilities (Wind/Tailwind-compatible) directly in templates; `dark:` variants use the `.dark` class. Keep business logic in the store/composables — templates stay declarative.
