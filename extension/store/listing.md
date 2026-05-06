# CloudOS extension — store listing copy

Reference copy for Chrome Web Store and Firefox Add-ons (AMO)
submissions. Update this file when the extension version changes so the
two listings stay in sync.

## Identity

- **Name:** `CloudOS`
- **Short name (Chrome ≤ 45 chars):** `CloudOS`
- **Category:** Productivity
- **Languages:** English (en)
- **Price:** Free
- **Source repository:** <https://github.com/yowanda/cloudos>
- **Privacy policy URL:** <https://github.com/yowanda/cloudos/blob/main/docs/EXTENSION_PRIVACY.md>
- **Support / homepage URL:** <https://github.com/yowanda/cloudos>

## Summary (250 chars)

> Open your self-hosted CloudOS desktop in every new tab. Optional
> history bridge lets the in-app /recent slash command pull from your
> real browser history — gated behind a per-origin permission, off by
> default.

## Short description (132 chars — Chrome Web Store)

> Open your self-hosted CloudOS desktop in every new tab. Optional,
> opt-in browser-history bridge for the /recent slash command.

## Detailed description (Chrome / Firefox)

> CloudOS is a self-hostable "browser as an operating system" web app.
> This extension is the companion that wires CloudOS into your browser:
>
> • **New-tab override.** Point the extension at your CloudOS instance
>   (any URL — self-hosted, localhost, or a hosted deployment) and every
>   new tab opens directly to your desktop. Choose between a clean
>   redirect or an embedded iframe.
>
> • **Optional history bridge.** Off by default. When you turn it on
>   (and grant per-origin permission for your CloudOS URL), the
>   extension exposes `chrome.history.search` to your CloudOS instance
>   over `window.postMessage`. The CloudOS `/recent` slash command then
>   shows your real browser history without you having to paste URLs.
>   The service worker double-checks the request origin before
>   answering, so a third-party site can never trick the bridge into
>   leaking your history.
>
> • **No backend, no analytics, no telemetry.** The extension is a
>   front-end shim around a CloudOS instance you control. It never
>   sends data anywhere except to the URL you chose. Source code is on
>   GitHub.
>
> Configure everything from the options page — there is no popup. Click
> the toolbar icon to open settings.
>
> See the privacy policy:
> https://github.com/yowanda/cloudos/blob/main/docs/EXTENSION_PRIVACY.md

## Permission justifications (Chrome Web Store reviewer notes)

The Chrome Web Store dashboard asks you to justify each permission in a
dropdown. Paste these answers verbatim:

### `storage`

> Used to persist three values via `chrome.storage.sync`: the user's
> CloudOS instance URL, the new-tab embed mode (redirect or iframe),
> and an off-by-default boolean for the history bridge. No other state
> is stored.

### `history`

> Used by the optional history bridge so the user's CloudOS instance
> can show recent history inside the app's `/recent` slash command.
> `chrome.history.search` is only called from the background service
> worker after (a) the user has enabled the bridge in options, (b) the
> request originated from the configured CloudOS origin, and (c) the
> origin verification in the service worker confirms the sender's
> origin matches the saved URL. The result is sent only back to that
> origin.

### `scripting`

> Used to register the small bridge content script
> (`content/bridge.js`) at runtime via
> `chrome.scripting.registerContentScripts`. The script is registered
> only for the user's saved CloudOS origin and only after the user has
> granted host permission for that origin. We use runtime registration
> (rather than a static `content_scripts` entry) so the bridge tracks
> whichever URL the user has saved, instead of being hard-coded to one
> domain.

### Host permission (`<all_urls>` declared as optional)

> The extension does not know in advance which URL the user will pick
> for their CloudOS instance. The `optional_host_permissions: ["<all_urls>"]`
> declaration lets the options page call
> `chrome.permissions.request({origins: ["<saved-url>/*"]})` so the
> browser shows a permission prompt scoped to a single origin (the one
> the user typed). At runtime the extension never requests broader
> access than the user's chosen URL.

### Remote code

> No remote code is executed. All scripts and HTML are bundled in the
> extension package. There is no `eval`, no remote `<script>`, no
> dynamic `import()` of external modules.

## Single-purpose statement (Chrome Web Store)

> The single purpose of this extension is to integrate a user-chosen
> CloudOS instance into the browser: replacing the new-tab page with
> the CloudOS desktop and optionally exposing browser history to that
> instance for the in-app /recent slash command.

## Data usage disclosures (Chrome Web Store)

Tick on the developer dashboard:

- ✓ This extension handles **Web history** (only when bridge is enabled).
- ✓ This extension handles **Website content** (only the configured
  CloudOS origin, via the bridge content script).

Untick everything else — no PII, no auth info, no financial info, no
location, no health info, no user activity beyond the bridge call,
no personal communications.

Certifications (tick all):

- ✓ I do not sell or transfer user data to third parties for purposes
  unrelated to the item's single purpose.
- ✓ I do not use or transfer user data for purposes unrelated to the
  item's single purpose.
- ✓ I do not use or transfer user data to determine creditworthiness or
  for lending purposes.

## Promotional assets

| Asset | File | Where it's used |
| ----- | ---- | --------------- |
| Store icon | `../icons/icon-128.png` (also at `logo-128.png`) | Chrome Web Store + AMO icon |
| Small promotional tile | `promo-tile-440x280.png` | Chrome Web Store store-listing tile |
| Screenshot 1 | `screenshot-1-bridge-active.png` (1280×800) | First gallery screenshot — shows test page with bridge active and `/recent` JSON response |
| Screenshot 2 | `screenshot-2-options-bridge-on.png` (1280×800) | Second gallery screenshot — shows the options page with bridge enabled |

The promo tile source is `promo-tile-440x280.svg` — re-render with
`rsvg-convert -w 440 -h 280 promo-tile-440x280.svg > promo-tile-440x280.png`
if you change it.

## Firefox AMO notes

Firefox's Add-ons review process is stricter about new-tab overrides.
Highlights for the AMO reviewer comment field:

- The new-tab override is opt-in: on first install the extension shows
  a "Welcome to CloudOS" setup card on the first new tab. Until the
  user types a URL there is no redirect.
- Firefox 128+ is the minimum supported version
  (`browser_specific_settings.gecko.strict_min_version: "128.0"`)
  because dynamic content-script registration via
  `browser.scripting.registerContentScripts` requires it.
- Source-code submission: zip up the entire `extension/` directory,
  excluding `node_modules/` and `dist/`. Build instructions:
  `pnpm install && pnpm --filter @cloudos/extension build`.
