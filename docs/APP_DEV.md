# Building third-party apps

CloudOS supports two flavours of apps:

1. **Built-in apps** — SolidJS components compiled into the desktop bundle
   (everything under `apps/desktop/src/apps/`). These are used for system
   apps (Files, Settings, Terminal, etc.).
2. **Manifest apps** — declarative `AppManifest` documents that describe a
   sandboxed iframe. These are runtime-installable, talk to the OS via a
   `postMessage` IPC bridge, and are the recommended path for third-party
   developers.

This guide focuses on **manifest apps**. The full IPC wire format is
documented in [`APPS.md`](./APPS.md); start there for the protocol details
and read this guide for the developer workflow.

## Hello world manifest

Save this as `hello-manifest.json`:

```json
{
  "id": "com.example.hello",
  "name": "Hello",
  "version": "1.0.0",
  "icon": "👋",
  "description": "Greets the user.",
  "author": "you@example.com",
  "category": "Demo",
  "permissions": ["notifications"],
  "entry": {
    "type": "iframe",
    "html": "<button id='go'>Greet</button><script>document.getElementById('go').onclick=async()=>{await window.cloudos.notify('Hello','from inside the sandbox')}</script>"
  },
  "window": { "width": 320, "height": 200 }
}
```

## Installing at runtime

```ts
import { installManifest } from "@/core/app-manifest";

const manifestText = await fetch("/hello-manifest.json").then((r) => r.text());
installManifest(JSON.parse(manifestText));
```

Once installed, the manifest persists in `localStorage["cloudos:manifests:installed"]`
and shows up in the Start Menu, Spotlight, and the App Store.

## Available APIs (`window.cloudos.*`)

The SDK is auto-injected into your iframe. Each call returns a Promise:

| API                        | Permission needed       | Returns                      |
| -------------------------- | ----------------------- | ---------------------------- |
| `cloudos.ping()`           | none                    | `"pong"`                     |
| `cloudos.notify(t, m)`     | `notifications`         | `void`                       |
| `cloudos.windows.list()`   | `windows`               | `WindowInfo[]`               |
| `cloudos.windows.close(id)`| `windows`               | `void`                       |
| `cloudos.windows.minimize` | `windows`               | `void`                       |
| `cloudos.windows.focus(id)`| `windows`               | `void`                       |
| `cloudos.vfs.list(path)`   | `files.read`            | `VFSEntry[]`                 |
| `cloudos.vfs.read(path)`   | `files.read`            | `string`                     |
| `cloudos.vfs.write(p, c)`  | `files.write`           | `void`                       |
| `cloudos.vfs.exists(path)` | `files.read`            | `boolean`                    |
| `cloudos.clipboard.read()` | `clipboard.read`        | `string`                     |
| `cloudos.clipboard.write(s)`| `clipboard.write`      | `void`                       |
| `cloudos.manifest()`       | none                    | your own `AppManifest`       |

If a call throws `Permission denied`, either your manifest didn't declare
the required permission, or the user explicitly denied it at runtime.

## Permission model

Permissions are gated in **two stages**:

1. **Manifest declaration** — your app must list every permission it
   might use in its `permissions` array. The bridge silently rejects any
   undeclared permission, so users can audit installed apps before
   running them.
2. **Runtime grant** — the *first* time your app actually calls a method
   that needs a permission, CloudOS shows the user a system-modal prompt
   asking to **Allow** or **Deny**. The decision is persisted in
   `localStorage` (key `cloudos:permissions:v1`) and reused for every
   later call.

Users can revisit grants in **Settings → Apps → Permissions** and switch
any permission to *Allow*, *Ask* (re-prompt next use), or *Deny*.
Permissions are also wiped when the app is uninstalled, so a fresh
install of the same id starts with no implicit grants.

## Sandbox model

- **Inline HTML (`type: "iframe"`)** — runs in
  `sandbox="allow-scripts"`. No `same-origin` access; no cookies; no
  storage outside what CloudOS exposes.
- **External URL (`type: "iframe-url"`)** — runs in
  `sandbox="allow-scripts allow-same-origin"`. Use this for static-hosted
  apps you control (e.g. a Vite-built bundle on your CDN).

Both modes communicate exclusively via `postMessage`. The bridge in
[`apps/desktop/src/core/sandbox-bridge.ts`](../apps/desktop/src/core/sandbox-bridge.ts)
validates every call against your manifest's permission list.

## Window options

```jsonc
{
  "window": {
    "width":     520,
    "height":    420,
    "resizable": true,
    "minWidth":  300,
    "minHeight": 200
  }
}
```

These are passed to `openWindow()` whenever the user launches the app.

## Local dev loop

Manifest apps don't need a build step — they're declarative JSON. A typical
loop:

1. Edit your `manifest.json` and inline HTML.
2. In the desktop, open the dev console:
   ```js
   import("./core/app-manifest").then(({ installManifest }) =>
     installManifest(JSON.parse(prompt("Paste manifest JSON")))
   );
   ```
3. Reload the desktop (`Ctrl+R`) — your app reappears in the Start Menu.

For `iframe-url` apps, set up Caddy or `pnpm dev` to host your static
bundle, then point `entry.url` at it.

## Built-in app development

If you'd rather extend the desktop directly, add a SolidJS component under
`apps/desktop/src/apps/`. Wire it in `apps/desktop/src/apps/index.ts`:

```ts
import MyApp from "./MyApp";
import { registerApp } from "../core/app-registry";

registerApp({
  id: "com.cloudos.myapp",
  name: "My App",
  icon: "🚀",
  component: MyApp,
});
```

Built-ins get full access to all stores, the VFS, the window manager, and
all internal APIs — no permission checks. Use them sparingly: most apps
should be manifest apps to keep the trust boundary clear.

## Distribution

For now, manifest distribution is manual (paste JSON in the install hook).
A first-class App Store with curated/signed manifests is on the roadmap
(see [`docs/ROADMAP.md`](./ROADMAP.md)).

## Examples

Two demo manifests ship with the desktop:

- `com.cloudos.demos.hello` — buttons exercising every IPC method.
- `com.cloudos.demos.stopwatch` — uses `clipboard.write` to copy a
  recorded time.

Source: [`apps/desktop/src/manifests/index.ts`](../apps/desktop/src/manifests/index.ts).
