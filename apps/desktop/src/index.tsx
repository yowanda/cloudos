import { render } from "solid-js/web";
import App from "./App";
import "./index.css";
import { installViewportListener } from "./stores/viewport-store";

const root = document.getElementById("root");

if (!root) throw new Error("Root element not found");

// Wire up the viewport store before the first render so initial
// layout decisions (e.g. mobile-vs-desktop window chrome) match the
// device on first paint.
installViewportListener();

render(() => <App />, root);

// Register the service worker so the shell + static assets are available
// offline on subsequent loads. The SW lives at /sw.js (Vite serves files
// from public/ at the root). Skipped when:
//   - the platform doesn't support service workers
//   - we're running on the Vite dev server (HMR + the SW's caching get in
//     each other's way; production-only registration keeps DX clean).
if (
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  import.meta.env.PROD
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => {
        // Non-fatal — the app still works without offline support.
        console.warn("[CloudOS] service worker registration failed:", err);
      });
  });
}
