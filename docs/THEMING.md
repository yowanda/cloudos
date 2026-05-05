# Theming guide

CloudOS uses Tailwind CSS v4 with a small set of CSS variables that drive
the entire UI. To change the look-and-feel of the desktop you only need to
update those variables and (optionally) the Tailwind theme config.

## Where the design tokens live

All tokens are defined in [`apps/desktop/src/theme/tokens.css`](../apps/desktop/src/theme/tokens.css)
(and consumed via `apps/desktop/tailwind.config.ts`).

The runtime store [`apps/desktop/src/stores/theme-store.ts`](../apps/desktop/src/stores/theme-store.ts)
applies them dynamically:

| Token / class       | Purpose                                |
| ------------------- | -------------------------------------- |
| `--os-bg`           | Page background behind the desktop     |
| `--os-window`       | Window chrome / panel background       |
| `--os-surface`      | Sub-panels, list rows                  |
| `--os-surface-hover`| Hover state on surfaces                |
| `--os-border`       | Border / divider color                 |
| `--os-text`         | Default text color                     |
| `--os-text-muted`   | Secondary / hint text                  |
| `--os-accent`       | Primary brand color (buttons, focus)   |
| `--os-accent-hover` | Hover state on accent                  |
| `--os-success`      | Green badges / success toasts          |
| `--os-warning`      | Amber badges / warning states          |
| `--os-danger`       | Red badges / error states / revoke     |

## Built-in palettes

The Settings → Appearance page lets the user switch between light and dark
themes plus 9 accent presets. Wallpapers live in
[`apps/desktop/src/apps/Settings.tsx`](../apps/desktop/src/apps/Settings.tsx)
and are stored as CSS gradient strings.

## Authoring a new theme

1. Pick base colors (background, surface, text). Use OKLCH or HSL for easy
   tuning.
2. Add a new entry to the `THEMES` map in `theme-store.ts`:
   ```ts
   const THEMES: Record<ThemeName, ThemeTokens> = {
     // ...
     "ocean-night": {
       "--os-bg":      "#021024",
       "--os-window":  "#0a1d3a",
       "--os-surface": "#11264e",
       "--os-text":    "#e6efff",
       "--os-accent":  "#3eb0ff",
       // ...
     },
   };
   ```
3. Add a button to the Appearance settings page so users can switch.
4. Run `pnpm turbo build` and verify nothing dropped contrast below WCAG
   AA — Tailwind's `oklch()` utilities help here.

## Custom wallpapers

Wallpapers are gradients or image URLs. Add an entry to the `wallpapers`
array in `Settings.tsx`:

```ts
const wallpapers = [
  // ...
  {
    name:    "Aurora",
    value:   "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
    preview: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
  },
];
```

For raster wallpapers, host the image somewhere reachable and use:

```ts
{
  name:    "Mountain",
  value:   "url('https://cdn.example.com/wallpapers/mountain.jpg') center/cover",
  preview: "url('...')",
}
```

## Per-app theming

Apps that want to opt out of the global accent should use the same tokens
but locally redeclare:

```tsx
<div style={{ "--os-accent": "#22d3ee" }}>
  {/* this subtree gets its own accent without affecting siblings */}
</div>
```

CSS custom properties cascade through the SolidJS render tree, so nothing
extra is needed.

## Manifest-app theming

Sandboxed manifest apps have their own iframe document and do **not**
inherit CloudOS tokens. If you want a manifest app to feel native:

1. Read the active accent on demand:
   ```js
   const accent = await window.cloudos.config?.accent?.();
   ```
   (This API is on the roadmap; for now duplicate the style locally.)
2. Or, listen for `theme-change` postMessage events and re-render. See
   [`docs/APPS.md`](./APPS.md) for IPC details.

## Light vs dark detection

`theme-store.ts` exposes a `theme()` signal returning `"light" | "dark" |
"system"`. The third option binds to the OS-level
`prefers-color-scheme` media query and live-updates when the user toggles
their system theme.

## Accessibility checklist

- Maintain at least 4.5:1 contrast for body text (`--os-text` on `--os-bg`)
  and 3:1 for large text or UI elements.
- Don't rely on color alone — use icons or text labels alongside
  semantic colors (success / warning / danger).
- Honor `prefers-reduced-motion` for window animations: most transitions
  in `Window.tsx` already short-circuit when the user opts out.
