---
name: frontend-review
description: Review frontend changes in this Vue 3 / Vue Flow / Pinia / UnoCSS codebase for correctness, store/Vue Flow reactivity pitfalls, type safety, and project conventions. Use when the user asks to review, audit, or sanity-check Vue components, the diagram store, composables, or UnoCSS templates — or after a non-trivial change to files under `src/`.
---

# frontend-review

Review the current frontend diff (or a named set of files) against this project's architecture and conventions. Produce a short, prioritised report — not a rewrite.

## Scope

Trigger this skill when:
- The user asks to review, audit, or sanity-check frontend code.
- A change touches `src/components/**`, `src/views/**`, `src/stores/**`, `src/composables/**`, or `uno.config.ts` / `vite.config.ts`.
- The user wants a pre-commit pass on Vue/TS/UnoCSS work.

Skip when the change is purely non-frontend (docs, tooling, CI).

## How to run the review

1. **Get the diff.** Default to `git diff` against the merge base with `main`. If the working tree is clean, fall back to the last commit (`git show`). If the user names specific files, restrict to those.
2. **Read whole files, not just hunks**, for any file with non-trivial changes — reactivity and store-coupling bugs hide outside the diff window.
3. **Run the gate**: `pnpm type-check`. This is the only lint in the project; surface any error before stylistic feedback.
4. **Report findings** grouped by severity (see *Output* below). Be concrete — cite `file:line` and quote the offending snippet.

## What to look for

Tie every finding to a concrete rule. The checks below come from `CLAUDE.md` and the codebase's actual patterns.

### Store + Vue Flow reactivity (highest-signal)
- **In-place mutation of a node** (`node.data.x = …`, `node.label = …`) inside a store action. Vue Flow only re-renders on reference change — actions must rebuild via `this.nodes.map(n => n.id === id ? { ...n, data: { ...n.data, … } } : n)`. Match `updateNodeColor` / `updateNodeLabel`.
- **Mutating actions that skip `commit()`.** Any action that changes nodes/edges in a user-visible way should call `commit()` first so undo/redo works. The intentional exceptions are the high-frequency change handlers (`onNodesChange`, `onEdgesChange`) and the per-drag `commit()` on `@node-drag-start` — flag deviations from that pattern.
- **Selection state stored separately** instead of derived from `.selected`. Selection is derived; don't add a parallel list.
- **Bypassing the controlled flow** — components writing to nodes/edges directly instead of going through store actions, or templates binding to anything other than `store.nodes` / `store.edges`.

### Types and the Vue Flow boundary
- Domain types in `src/types/diagram.ts` must stay plain/serialisable. Flag Vue Flow-only fields (e.g. `GraphNode` internals) leaking into `DiagramNode` / `DiagramEdge`.
- The `as unknown as GraphNode[]` cast belongs only at the Vue Flow boundary in `DiagramCanvas.vue`. Flag the cast appearing elsewhere.
- `tsconfig.json` is strict (`noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`). Unused imports/vars **fail the build** — flag them even if they look harmless.

### Custom node + new shapes
- All shapes go through the single `custom` → `CustomNode.vue` type. New shape variants should extend `node.data` + the `CustomNode` renderer, not introduce a second Vue Flow node type.
- Newly-created nodes that should open in inline edit must record their id via `store.addNode` → `editNodeId` and be claimed via `store.takeEditNode(id)` exactly once.

### Composables and active state
- Tool/colour/dark-mode/sketch-mode state belongs in module-level refs inside `src/composables/*`, not in the Pinia store. Flag new tool-like state being added to the store.
- `useDarkMode` / `useSketchMode` toggle a class on `<html>` and persist via the storage wrapper — new global toggles should follow the same pattern.

### Persistence
- All `localStorage` access must go through `src/utils/storage.ts` (never-throws wrapper). Flag raw `localStorage.getItem/setItem`.
- Storage keys must come from `src/utils/constants.ts` (`srvj:diagram`, `srvj:theme`, `srvj:sketch`) — no inline string keys.
- Snapshot shape changes need a `DIAGRAM_VERSION` bump and a `normalizeNode` update so legacy diagrams keep loading.

### Conventions
- Imports use the `@/` alias for `src/`.
- Icons are UnoCSS `presetIcons` classes (`i-mdi-…`, `i-carbon-…`). **Dynamically-built icon class names must be in `safelist` in `uno.config.ts`** or they won't be generated — this is a frequent silent bug, check for it.
- Styling stays as UnoCSS utilities in templates; `dark:` variants use the `.dark` class. Business logic belongs in the store/composables, not templates.
- Never hand-edit `src/auto-imports.d.ts` or `src/components.d.ts` — they are generated.

### General frontend hygiene (lower priority unless severe)
- Event listeners / `ResizeObserver` / `requestAnimationFrame` registered without cleanup in `onUnmounted`.
- `watch` with a deep object source but no `{ flush: 'post' }` when DOM measurement is involved.
- Accessibility regressions on interactive elements (missing role/aria, click-only handlers on non-buttons).
- Obvious perf traps: per-render array allocations in hot paths (e.g. `computed` that returns a fresh object every tick and is fed back into Vue Flow).

## Output

Keep the report tight. Use this structure:

```
## Frontend review

**Gate:** pnpm type-check — pass | fail (paste first error)

### Blockers
- `path/to/file.vue:NN` — <one-line problem>. Fix: <one-line action>.

### Should fix
- …

### Nits
- …

### Looks good
- <1–3 bullets calling out solid choices, so the user knows what to keep>
```

Rules:
- No finding without `file:line` and a concrete fix.
- If there are no Blockers, say so explicitly — don't pad Should-fix to fill space.
- Don't apply fixes. This skill reviews; the user can follow up with `/simplify` or ask for edits.
- Don't restate the diff back to the user.
