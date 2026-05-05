# CloudOS Apps — Manifests, Sandbox, IPC

CloudOS supports two kinds of apps:

1. **Builtin apps** — Solid components registered via `registerAppComponent(appId, Component)` and shipped with the desktop bundle.
2. **Manifest apps** — Sandboxed iframe apps described by an `AppManifest`, installable at runtime, communicating with the OS via a `postMessage` IPC bridge.

This document describes the manifest format and the IPC API.

---

## Manifest format

```ts
interface AppManifest {
  id: string;            // reverse-DNS, unique, e.g. "com.acme.demo"
  name: string;
  version: string;
  icon: string;          // emoji or URL
  description?: string;
  author?: string;
  category?: string;
  permissions: AppPermission[];
  entry: AppEntry;
  window?: {
    width?: number;
    height?: number;
    resizable?: boolean;
    minWidth?: number;
    minHeight?: number;
  };
}

type AppPermission =
  | "notifications"
  | "files.read"
  | "files.write"
  | "windows"
  | "clipboard.read"
  | "clipboard.write";

type AppEntry =
  | { type: "builtin" }                  // Builtin Solid component (registered separately)
  | { type: "iframe"; html: string }     // Inline HTML, sandboxed via srcdoc
  | { type: "iframe-url"; url: string }; // External URL, sandboxed via src
```

### Sandbox attributes

- `iframe`: `sandbox="allow-scripts"` — script execution but no same-origin cookies, top-frame nav, popups, or form submission.
- `iframe-url`: `sandbox="allow-scripts allow-forms allow-same-origin"` — slightly looser (the page is on its own origin, so `allow-same-origin` is OK).

Sandboxed apps can only talk to the OS through the injected `window.cloudos` SDK, which uses `postMessage` to a parent-side bridge. Each call is permission-checked against the manifest.

### Installing manifests

```ts
import { installManifest, uninstallManifest } from "core/app-manifest";

installManifest(myManifest);    // persisted to localStorage["cloudos:manifests:installed"]
uninstallManifest("com.acme.demo");
```

Builtin demo manifests (`registerBuiltinManifest`) are not persisted and are automatically registered by the bundle.

---

## IPC protocol

The OS injects a small bootstrap script at the top of every `iframe`-type manifest that exposes a global `window.cloudos` object. All methods return Promises.

```js
await window.cloudos.ping();                            // { ok: true, ts: number }
await window.cloudos.manifest();                        // returns the live AppManifest
await window.cloudos.notify({ title, message, type, icon });
await window.cloudos.windows.close();
await window.cloudos.windows.minimize();
await window.cloudos.windows.maximize();
await window.cloudos.windows.focus();
await window.cloudos.windows.list();                    // [{id, appId, title, state}]
await window.cloudos.vfs.list("/");                     // VFSEntry[]
await window.cloudos.vfs.read("/path/to/file.txt");     // string
await window.cloudos.vfs.write("/foo.txt", "hello");
await window.cloudos.vfs.exists("/foo.txt");
await window.cloudos.clipboard.read();                  // string
await window.cloudos.clipboard.write(text);
```

The bootstrap fires a `cloudos:ready` event on `document` once the SDK is wired up. Apps can `await` it to ensure the bridge is ready before sending calls:

```html
<script>
  document.addEventListener("cloudos:ready", async () => {
    await window.cloudos.notify({ title: "Hello" });
  });
</script>
```

### Wire format (advanced)

Calls and responses are JSON-serializable messages exchanged via `postMessage`:

```ts
// Renderer ➜ Parent
{ type: "ipc.call", id: string, method: string, params?: unknown }

// Parent ➜ Renderer
{ type: "ipc.result", id: string, result: unknown }
{ type: "ipc.error",  id: string, error: string }
```

The `id` correlates a call with its response. Methods that violate manifest permissions reject with `Permission denied: <method> requires '<perm>'`.

---

## Demo apps

Two builtin demo manifests ship with CloudOS:

- `com.cloudos.demos.hello` — buttons for `notify`, `vfs.list`, `vfs.write`, and `windows.close`. Permissions: `notifications`, `files.read`, `files.write`, `windows`.
- `com.cloudos.demos.stopwatch` — a working stopwatch using `clipboard.write` to copy the current time. Permissions: `clipboard.write`.

Both appear in the Start Menu. Use them as a template for your own iframe apps.
