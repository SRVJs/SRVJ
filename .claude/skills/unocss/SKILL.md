---
name: unocss
description: Author and edit UnoCSS styling correctly in this Vue 3 portfolio — shortcuts, dark-mode (class) theming, icon presets, attributify, and the custom theme (colors, animations, keyframes, safelist). Use when adding/changing utility classes, icons, shortcuts, animations, or anything in uno.config.ts.
---

# UnoCSS for this project

This repo styles with **UnoCSS** (Tailwind-compatible utilities) configured in `uno.config.ts`. Use this skill when writing or reviewing classes, icons, shortcuts, or animations so changes match the existing setup instead of inventing Tailwind-isms that aren't enabled here.

Always read `uno.config.ts` before assuming a token, shortcut, or icon collection exists.

## Enabled presets

```
presetUno({ dark: 'class' })   // core Tailwind-like utilities; dark mode via .dark class
presetAttributify()            // attribute-mode utilities, e.g. <div text="xl gray-500">
presetIcons()                  // pure-CSS icons from installed @iconify-json/* collections
```

- **Dark mode is class-based** (`dark: 'class'`), toggled by `src/composables/useTheme.ts`. Always pair light styles with `dark:` variants — `bg-white dark:bg-[#1a1a1a]`. Never assume `prefers-color-scheme`.
- **Attributify is on**, so both `class="text-xl text-gray-500"` and `text="xl gray-500"` are valid. Match the surrounding component's style; don't mix modes within one element.

## Shortcuts (use these instead of re-typing class soups)

Defined in `uno.config.ts` → `shortcuts`:

| Shortcut | Purpose |
|----------|---------|
| `border-base` | Theme-aware subtle border |
| `bg-base` | Card/surface background (white / `#1a1a1a`) |
| `bg-canvas` | Page background (gray:15 / `#111`) |
| `icon-btn` | Dimmed icon that brightens on hover |
| `social-link` | Full styled social button (border, blur, hover lift, dark variants) |
| `social-icon` | `h-5 w-5` icon sizing inside social-link |

When you need one of these patterns, use the shortcut. If you find yourself repeating a long class string across components, add a new shortcut here rather than duplicating it.

## Icons (`presetIcons`)

- Syntax: `i-<collection>:<name>` or `i-<collection>-<name>` (e.g. `i-logos:vue`, `i-mdi-github`).
- A collection only works if its package is installed. Installed (`@iconify-json/*`): `carbon`, `circle-flags`, `codicon`, `logos`, `mdi`, `nonicons`, `oui`, `ri`, `skill-icons`, `solar`. To use another collection, add the matching `@iconify-json/<name>` dev dependency first.
- **Dynamic icon names** (classes built at runtime, e.g. from `src/utils/icons.ts` mapped over project tags) are NOT seen by the UnoCSS scanner. They must be listed in the `safelist` array in `uno.config.ts`, or they won't be generated. When adding a tech tag/icon that's chosen dynamically, add its `i-...` class to `safelist`.
- Browse names at https://icones.js.org.

## Theme tokens, colors & animations

In `uno.config.ts` → `theme`:
- **Custom color**: `whiteMode` (`#202020`) → use as `text-whiteMode`, `bg-whiteMode`, etc.
- **Animations**: `drift-one`…`drift-five` (ambient background drift), `project-rise`, `project-tab`. Apply with `animate-drift-one`, `animate-project-rise`, etc. Reuse these for entrance/ambient motion instead of inline `<style>` keyframes.
- To add motion, add a `keyframes` entry plus a matching `animation` entry, then reference it via `animate-<name>`. Keep durations/easing consistent with the existing drift/project animations.

## Conventions & gotchas

- Prefer utility classes over `<style>` blocks (the codebase is utility-first).
- Arbitrary values use bracket syntax: `bg-[#1a1a1a]`, `shadow-[0_14px_32px_rgba(0,0,0,0.1)]`, `w-[42px]`.
- Opacity shorthands used here: `op30`/`op100` (opacity), `gray/20` and `gray:15` (color with alpha). Stay consistent with neighbors.
- No `tailwind.config` — there is no `@apply`; compose via shortcuts.
- After editing `uno.config.ts`, the Vite dev server picks up changes on save; for production confirm with `npm run build`.
- Don't hardcode a color that exists as a token/shortcut; don't introduce a one-off color when `bg-base`/`bg-canvas`/`border-base` already express the intent.

## When asked to add a reusable style

1. Check if an existing shortcut already covers it.
2. If repeated ≥2 places, add a shortcut in `uno.config.ts`.
3. If it's a dynamic icon, add it to `safelist`.
4. Always provide `dark:` variants for any color/background/border.
