# CloudOS browser extension — privacy policy

_Last updated: 2026-05-06. Applies to **CloudOS** browser extension v0.1.x._

This privacy policy describes what data the CloudOS browser extension does
(and does not) collect, store, and transmit. It is written for a Chrome
Web Store / Firefox Add-ons listing, and for users sideloading the
extension from source.

> **TL;DR:** the extension is a thin shim over a CloudOS instance the user
> chooses themselves. It does not have a backend, does not run analytics,
> does not telemeter, and does not transmit any browsing data to a third
> party. All settings live in `chrome.storage.sync` (per-account browser
> sync). Browser history is only read on user-initiated requests, only
> from the configured CloudOS origin, and only after the user has
> explicitly enabled the bridge and granted host permission for that
> origin.

## What the extension is

CloudOS (https://github.com/yowanda/cloudos) is a self-hostable
"browser-as-an-OS" web app. The browser extension is a small companion
that:

1. Replaces the browser's new-tab page with the user's CloudOS instance,
   either by redirecting to it or by embedding it in an `<iframe>`.
2. Exposes an opt-in `chrome.history.search` bridge so the CloudOS
   `/recent` slash command can show your real browser history inside the
   web app.

Both behaviours are configured by the user from the extension's options
page. The extension has no backend.

## Data the extension stores

The following keys are written to `chrome.storage.sync`, which Chrome
syncs across devices on the user's Google account (or stays local on
Firefox if Sync is off). Nothing leaves the user's browser unless the
user pastes a URL pointing at a remote CloudOS instance.

| Key | Type | Purpose |
| --- | ---- | ------- |
| `cloudosUrl` | `string` | The URL the user wants the new-tab page to open. |
| `embedMode` | `"redirect" \| "iframe"` | Whether to navigate to the URL or embed it in an iframe inside the extension's new-tab page. |
| `historyBridgeEnabled` | `boolean` | Whether the optional history bridge is on. Defaults to `false`. |

There is no other persisted state. There is no user account, no email
address, no password, no telemetry token.

## Browser permissions and why we need them

| Permission | What it lets us do | When we use it |
| ---------- | ------------------ | -------------- |
| `storage` | Read and write `chrome.storage.sync` | Save the three keys above. Read them when rendering the new-tab page or answering a history-bridge request. |
| `history` | Call `chrome.history.search()` | **Only** in the background service worker, **only** when answering a history-bridge request from the configured CloudOS origin. The result is sent back to that origin — never to a third party. |
| `scripting` | Call `chrome.scripting.registerContentScripts()` at runtime | Inject the small bridge script (`content/bridge.js`) into pages on the user's CloudOS origin only — **after** the user has enabled the bridge and granted host permission. |
| `optional_host_permissions: ["<all_urls>"]` | Lets the options page request a per-origin permission via `chrome.permissions.request({origins: [<saved-url>/*]})` | Because the user can choose any URL for their CloudOS instance, the extension does not declare a fixed host permission. Instead it asks for permission **only** for the exact origin the user typed in, at the moment they click "Grant host permission". The `<all_urls>` placeholder is the API's required type — at runtime we always narrow it to a single origin. |

Permissions we deliberately do **not** request:

- `tabs`, `cookies`, `webRequest`, `webNavigation`, `bookmarks`,
  `downloads`, `identity`, `geolocation`, `clipboardRead`,
  `clipboardWrite`, `nativeMessaging`, `unlimitedStorage`, `notifications`.

## What data the extension transmits

- **To your configured CloudOS origin only**, when you click a button on
  that page that uses the bridge: the response of
  `chrome.history.search()` (URL, title, last visit timestamp, visit
  count) for the search you requested. Sender origin is verified before
  the response is sent — a different origin pretending to talk to the
  service worker is rejected with
  `"request origin does not match the configured CloudOS URL"`.
- **To no other party.** There are no analytics calls, error reporters,
  tracking pixels, ad networks, or "phone home" pings. The extension's
  `host_permissions` are limited to your CloudOS origin (after grant).

## Data the extension does not collect

We do not collect or transmit:

- Browsing history of pages outside your CloudOS origin
- Form data, passwords, cookies, or input keystrokes
- Personally identifiable information (name, email, phone)
- Device fingerprints, IP addresses, or location
- Anything used for advertising, profiling, or analytics

## Third parties

The extension uses **no third-party services**. There is no SDK, no
remote font, no remote stylesheet, no analytics. Every asset (icons,
scripts, HTML) ships inside the extension package and runs locally.

## How to inspect what we do

The extension is open source under the MIT licence:
<https://github.com/yowanda/cloudos/tree/main/extension>. The
service-worker and content-script source is small enough to read in
under five minutes:

- `extension/src/background/service-worker.ts` — the only place
  `chrome.history.search` is called.
- `extension/src/content/bridge.ts` — the only content script.
- `extension/src/manifest.template.json` — declared permissions.

You can inspect what `chrome.storage.sync` holds by visiting the
extension's options page or by running
`chrome.storage.sync.get(console.log)` in the service-worker DevTools
console.

## Children

The extension is intended for general audiences but does not collect
information from any user, including children under 13.

## Changes to this policy

Material changes to data-handling will result in a new version of the
extension and an updated `Last updated` date at the top of this file.
The change history is preserved in git.

## Contact

File an issue at <https://github.com/yowanda/cloudos/issues>. There is
no separate email channel.
