import { beforeEach, describe, expect, it } from "vitest";
import {
	isMobile,
	isTablet,
	isTouchOrSmall,
	setViewportWidth,
	viewportWidth,
} from "../viewport-store";

/**
 * The viewport store is a tiny piece of UI plumbing but the breakpoint
 * constants are baked into a lot of layout decisions across the shell
 * (Window auto-fullscreen, Dock visibility, Taskbar collapsing) so we
 * pin the boundaries with explicit tests. The store is module-level
 * state, so each test resets it via `setViewportWidth(...)`.
 */
describe("viewport-store", () => {
	beforeEach(() => {
		// Reset to a desktop-y default before each test so order doesn't
		// matter.
		setViewportWidth(1280);
	});

	it("treats < 640px as mobile", () => {
		setViewportWidth(360);
		expect(isMobile()).toBe(true);
		expect(isTablet()).toBe(false);
		expect(isTouchOrSmall()).toBe(true);
		expect(viewportWidth()).toBe(360);
	});

	it("treats 640..<1024 as tablet", () => {
		setViewportWidth(800);
		expect(isMobile()).toBe(false);
		expect(isTablet()).toBe(true);
		expect(isTouchOrSmall()).toBe(true);
	});

	it("treats >= 1024 as desktop", () => {
		setViewportWidth(1280);
		expect(isMobile()).toBe(false);
		expect(isTablet()).toBe(false);
		expect(isTouchOrSmall()).toBe(false);
	});

	it("uses < (strict) for the mobile boundary at 640", () => {
		// Exactly at 640 is *not* mobile per the constants.
		setViewportWidth(640);
		expect(isMobile()).toBe(false);
		expect(isTablet()).toBe(true);
	});

	it("uses < (strict) for the tablet upper boundary at 1024", () => {
		setViewportWidth(1024);
		expect(isTablet()).toBe(false);
		expect(isTouchOrSmall()).toBe(false);
	});

	it("clamps just below the 640 boundary as mobile", () => {
		setViewportWidth(639);
		expect(isMobile()).toBe(true);
	});
});
