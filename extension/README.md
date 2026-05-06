# @cloudos/extension

A Chromium / Firefox MV3 browser extension that overrides the new-tab page
with your CloudOS desktop and (optionally) bridges the browser's history into
the in-app `/recent` slash command.

```
extension/
├── biome.json            # spaces, double quotes, recommended rules
├── icons/icon.svg        # source artwork (rasterised at build time)
├── package.json          # @cloudos/extension
├── scripts/build.mjs     # esbuild bundler + tiny zip writer
├── src/
│   ├── manifest.template.json   # MV3 manifest, with __VERSION__ placeholder
│   ├── newtab/                  # chrome_url_overrides.newtab page
│   ├── options/                 # options_ui page
│   ├── background/              # MV3 service worker (history bridge)
│   ├── content/                 # content script that talks to CloudOS pages
│   └── shared/                  # storage helpers + message envelope types
└── tsconfig.json
```

## Build

```bash
# From the repo root:
pnpm install
pnpm turbo build              # builds desktop + extension
# Or just the extension:
pnpm --filter @cloudos/extension build
```

The build produces:

- `extension/dist/` — an unpacked extension you can load directly into Chrome
  via `chrome://extensions` → "Load unpacked".
- `extension/dist/cloudos-extension.zip` — a ready-to-upload archive for the
  Chrome Web Store / Firefox AMO.

Icons are rasterised from `extension/icons/icon.svg` using whichever of
ImageMagick (`magick`, `convert`) or `rsvg-convert` is on `PATH`. If none is
available the build emits 1×1 transparent PNGs and prints a warning so the
manifest still loads under unpacked development mode — install `librsvg2-bin`
to get real icons:

```bash
sudo apt-get install -y librsvg2-bin    # Debian / Ubuntu
brew install librsvg                     # macOS
```

## Sideloading

### Chrome / Edge / Brave / Arc / any Chromium-based browser

1. Run `pnpm --filter @cloudos/extension build`.
2. Open `chrome://extensions`.
3. Toggle **Developer mode** on (top-right).
4. Click **Load unpacked**, pick `extension/dist/`.
5. Open a new tab — you'll see the setup card. Paste your CloudOS URL and hit
   **Save & open**.

### Firefox (115+)

Firefox doesn't allow `chrome_url_overrides.newtab` for unsigned MV3
extensions, so for development:

1. Run `pnpm --filter @cloudos/extension build`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…**, pick `extension/dist/manifest.json`.
4. Visit `about:preferences#home` → set **Homepage and new windows** to your
   CloudOS URL (Firefox treats the new-tab override as an opt-in setting).

For production you'll need to sign the zip via [AMO][amo] and distribute it
that way.

[amo]: https://addons.mozilla.org/

## Configuration

| Setting | Where | Default |
| ------- | ----- | ------- |
| CloudOS URL | Options → "CloudOS URL" | _empty_ — first new tab shows the setup card |
| New-tab behaviour | Options → "New tab behaviour" | `Redirect` (replaces the new-tab URL with your CloudOS instance) |
| History bridge | Options → "Browser history bridge" | Off |

The settings live in `chrome.storage.sync` so they roam with your browser
profile. Switch to **Embed in iframe** if your CloudOS instance does not set
`X-Frame-Options: deny` and you'd rather keep the literal new-tab URL in the
URL bar.

## History bridge for `/recent`

When you enable the bridge **and** grant the host permission for your
CloudOS origin, a content script is injected into that origin. Any window
running CloudOS can then post a request to read your recent browser
history:

```ts
// Inside CloudOS:
const id = crypto.randomUUID();
window.postMessage(
  { type: "cloudos:ext:get-history", id, limit: 50 },
  window.location.origin,
);
window.addEventListener("message", function once(event) {
  if (event.data?.type !== "cloudos:ext:get-history:result") return;
  if (event.data.id !== id) return;
  window.removeEventListener("message", once);
  if (event.data.ok) {
    console.log(event.data.items); // HistoryItem[]
  } else {
    console.warn(event.data.error);
  }
});
```

The service worker enforces that the requesting tab's origin matches the
saved CloudOS URL before answering. If the bridge is disabled or the origins
don't line up, the response is `{ ok: false, error: "…" }` so the page can
fall back to the in-app `/recent` (which lists CloudOS app launches).

If the extension isn't installed at all, `window.postMessage` simply has no
listener and the request times out — CloudOS already handles that case in
its own `/recent` implementation.

## Releasing

```bash
pnpm --filter @cloudos/extension build      # produces dist/cloudos-extension.zip
```

Bump the `version` field in `extension/package.json`, rebuild, and upload
`dist/cloudos-extension.zip` to:

- [Chrome Web Store](https://chrome.google.com/webstore/devconsole/) — the
  manifest's `chrome_url_overrides.newtab` is allowed without review caveats.
- [Firefox AMO](https://addons.mozilla.org/developers/) — sign the same zip
  and distribute the signed `.xpi`.

## Permissions rationale

| Permission | Why | Optional? |
| ---------- | --- | --------- |
| `storage` | Persist the user's CloudOS URL and feature toggles. | No — required by the new-tab page. |
| `history` | Power the optional `/recent` bridge. | Effectively yes — only used when the toggle is on. |
| `<all_urls>` (host) | Listed under `optional_host_permissions`; only requested at runtime when the user clicks **Grant host permission**. | Yes — opt-in per origin. |

The extension does not collect telemetry, does not phone home, and never
forwards browsing history off the device. The full source is in this monorepo.
