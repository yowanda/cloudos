import { createSignal } from "solid-js";

/**
 * Viewport-size store for responsive shell decisions.
 *
 * Two breakpoints: < 640 px is "mobile" (full-screen single-window
 * shell, no drag handles, taskbar collapses to icon-only), 640–1024 px
 * is "tablet" (multi-window allowed but UI chrome still compact),
 * 1024 px+ is "desktop" (current behaviour).
 *
 * Updated reactively on `resize` / `orientationchange` so any consumer
 * that calls `isMobile()` / `isTablet()` / `viewportWidth()` inside a
 * Solid effect will re-run automatically.
 *
 * Tests can drive this synchronously via `setViewportWidth(...)`
 * without mounting the DOM.
 */

const MOBILE_MAX = 640;
const TABLET_MAX = 1024;

function detect(): number {
	if (typeof window === "undefined") return 1280;
	return window.innerWidth || 1280;
}

const [width, setWidth] = createSignal(detect());

export const viewportWidth = width;

export function isMobile(): boolean {
	return width() < MOBILE_MAX;
}

export function isTablet(): boolean {
	const w = width();
	return w >= MOBILE_MAX && w < TABLET_MAX;
}

export function isTouchOrSmall(): boolean {
	return width() < TABLET_MAX;
}

/**
 * Manually drive the width — used by unit tests so we don't have to
 * stand up jsdom resize plumbing.
 */
export function setViewportWidth(px: number): void {
	setWidth(px);
}

let installed = false;

/**
 * Install the resize listener. Idempotent — safe to call multiple
 * times (e.g. once from boot and once from HMR re-mounts).
 */
export function installViewportListener(): () => void {
	if (typeof window === "undefined" || installed) {
		return () => {};
	}
	installed = true;
	const handler = () => setWidth(window.innerWidth);
	window.addEventListener("resize", handler);
	window.addEventListener("orientationchange", handler);
	// Sync once so any state set before installation is corrected.
	handler();
	return () => {
		window.removeEventListener("resize", handler);
		window.removeEventListener("orientationchange", handler);
		installed = false;
	};
}
