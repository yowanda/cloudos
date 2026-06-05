/* eslint-disable no-undef */
/**
 * CloudOS service worker — offline-first shell, network-first APIs.
 *
 * Caching strategy:
 *
 *   - Navigation requests (HTML, the `/` shell)
 *       network-first with a fallback to the cached `/` shell so the
 *       desktop boots even with no connectivity.
 *
 *   - Static assets (`*.js`, `*.css`, `*.svg`, `*.png`, `*.webmanifest`)
 *       stale-while-revalidate — serve from cache instantly, refresh
 *       in the background.
 *
 *   - API requests (`/api/`, `/auth/`, `/ws/`)
 *       network-only — never cached.
 *
 *   - Everything else
 *       network-only with no cache.
 *
 * Cache name includes build timestamp; bumping purges old cache on deploy.
 */

// Cache version includes timestamp for automatic cache busting
const CACHE_VERSION = "cloudos-shell-v3-" + (self.__BUILD_HASH__ || Date.now());
const SHELL_URLS = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      // Best-effort precache; if any URL is missing on first load we
      // still want install to succeed.
      await Promise.allSettled(SHELL_URLS.map((u) => cache.add(u)));
      self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isApi(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/ws/")
  );
}

function isStaticAsset(url) {
  if (url.pathname.startsWith("/assets/")) return true;
  return /\.(?:js|mjs|css|svg|png|jpg|jpeg|webp|woff2?|ttf|webmanifest|ico)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never cache POST/PUT/PATCH/DELETE

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // cross-origin: pass-through

  if (isApi(url)) {
    return; // network-only — let it fall through to default handling
  }

  if (req.mode === "navigate") {
    // Network-first for the shell HTML, fallback to cached `/` if offline.
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_VERSION);
          cache.put("/", fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cache = await caches.open(CACHE_VERSION);
          const cached = (await cache.match("/")) ?? (await cache.match("/index.html"));
          if (cached) return cached;
          return new Response("CloudOS is offline and no cached shell is available.", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          });
        }
      })(),
    );
    return;
  }

  if (isStaticAsset(url)) {
    // Stale-while-revalidate
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_VERSION);
        const cached = await cache.match(req);
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
            return res;
          })
          .catch(() => cached);
        return cached ?? fetchPromise;
      })(),
    );
    return;
  }

  // Default: just hit the network.
});
