import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for the desktop frontend.
 *
 * Tests live under `src/**\/__tests__/*.test.ts(x)`. We default to the
 * `jsdom` environment so test files can touch `localStorage`,
 * `document`, and other browser-only APIs without manual stubbing —
 * the bulk of CloudOS state is persisted through `window.localStorage`
 * and a node-only environment would fail to load most of it.
 */
export default defineConfig({
	plugins: [solid()],
	test: {
		environment: "jsdom",
		globals: false,
		include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
		coverage: {
			reporter: ["text", "lcov"],
		},
	},
});
