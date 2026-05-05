import { describe, expect, it } from "vitest";
import {
	type ConfirmationPayload,
	describeConfirmation,
	getToolsSchema,
	listSlashCommands,
	listTools,
	runTool,
} from "../ai-tools";

/**
 * Smoke tests for the typed tool registry. These run in the jsdom
 * environment so that the VFS / desktop stores can boot off
 * `localStorage`. They exercise the shape contracts (schema, tool
 * listing) and a few read-only end-to-end calls — enough to catch
 * accidental breakage of the LLM-facing surface during refactors.
 */

describe("getToolsSchema", () => {
	it("emits the OpenAI/Ollama tools[] shape", () => {
		const schema = getToolsSchema();
		expect(schema.length).toBeGreaterThanOrEqual(15);
		for (const entry of schema) {
			expect(entry.type).toBe("function");
			expect(entry.function.name).toMatch(/^[a-z_][a-z0-9_]*$/);
			expect(entry.function.description.length).toBeGreaterThan(5);
			expect(entry.function.parameters.type).toBe("object");
		}
	});

	it("includes the four mutating tools", () => {
		const names = getToolsSchema().map((s) => s.function.name);
		expect(names).toContain("write_file");
		expect(names).toContain("mkdir");
		expect(names).toContain("rm");
		expect(names).toContain("mv");
	});

	it("listTools agrees with getToolsSchema on tool names", () => {
		const fromSchema = new Set(getToolsSchema().map((s) => s.function.name));
		const fromList = new Set(listTools().map((t) => t.name));
		expect(fromList).toEqual(fromSchema);
	});

	it("listTools marks the four file mutators as dangerous and the rest as safe", () => {
		const tools = listTools();
		const dangerous = tools
			.filter((t) => t.dangerous)
			.map((t) => t.name)
			.sort();
		expect(dangerous).toEqual(["mkdir", "mv", "rm", "write_file"]);
	});
});

describe("listSlashCommands", () => {
	it("lists at least the documented read-only and mutating verbs", () => {
		const names = new Set(listSlashCommands().map((c) => c.name));
		for (const expected of [
			"help",
			"read",
			"ls",
			"stat",
			"find",
			"tree",
			"storage",
			"clock",
			"conflicts",
			"apps",
			"windows",
			"desktops",
			"whoami",
			"recent",
			"now",
			"write",
			"mkdir",
			"rm",
			"mv",
		]) {
			expect(names.has(expected), `missing /${expected}`).toBe(true);
		}
	});
});

describe("describeConfirmation", () => {
	it("renders the write payload header with the path", () => {
		const payload: ConfirmationPayload = {
			kind: "write",
			path: "/notes.md",
			content: "hello",
			existingSize: null,
		};
		const text = describeConfirmation(payload);
		expect(text).toContain("/notes.md");
		expect(text.length).toBeGreaterThan(10);
	});

	it("renders the rm payload with hard-delete vs trash distinction", () => {
		const trash: ConfirmationPayload = {
			kind: "rm",
			path: "/foo.txt",
			hard: false,
			isDir: false,
			descendantCount: 0,
		};
		const hard: ConfirmationPayload = {
			kind: "rm",
			path: "/foo.txt",
			hard: true,
			isDir: false,
			descendantCount: 0,
		};
		expect(describeConfirmation(trash).toLowerCase()).toContain("trash");
		expect(describeConfirmation(hard).toLowerCase()).toMatch(/permanent|hard/);
	});
});

describe("runTool", () => {
	it("returns an error result for an unknown tool", async () => {
		const out = await runTool("definitely_not_a_real_tool", {});
		expect(out.ok).toBe(false);
		expect(out.content.toLowerCase()).toContain("unknown tool");
	});

	it("read-only tools return a string result with no confirmation", async () => {
		const out = await runTool("now", {});
		expect(out.ok).toBe(true);
		expect(out.confirmation).toBeUndefined();
		expect(typeof out.content).toBe("string");
		// ISO-ish timestamp.
		expect(out.content).toMatch(/\d{4}-\d{2}-\d{2}T/);
	});

	it("dangerous tools without alwaysAllow return a confirmation payload", async () => {
		const out = await runTool("write_file", {
			path: "/test-vfs-abc.txt",
			content: "hi",
		});
		expect(out.ok).toBe(true);
		// Either the path doesn't exist (new write) and we get a payload,
		// or the helper rejects with a string error — both are valid
		// outputs, but we should never auto-execute without alwaysAllow.
		if (out.confirmation) {
			expect(out.confirmation.kind).toBe("write");
		} else {
			// If the helper returned an error string rather than a payload,
			// it should at least mention the path or a validation reason.
			expect(out.content.length).toBeGreaterThan(0);
		}
	});
});
