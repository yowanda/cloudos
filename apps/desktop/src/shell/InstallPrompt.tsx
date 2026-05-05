import {
	type Component,
	Show,
	createSignal,
	onCleanup,
	onMount,
} from "solid-js";
import { isMobile } from "../stores/viewport-store";

/**
 * `BeforeInstallPromptEvent` isn't in the standard TS DOM lib yet, so
 * we hand-roll the minimal shape we need. Chromium fires this when
 * the PWA install criteria are met (manifest + SW registered + the
 * user has interacted with the page).
 */
interface BeforeInstallPromptEvent extends Event {
	readonly platforms: string[];
	prompt(): Promise<void>;
	readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const STORAGE_KEY = "cloudos:install-prompt:dismissed-at";
const SUPPRESS_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Tiny banner shown above the taskbar inviting the user to install
 * the CloudOS PWA. Lifecycle:
 *   1. Listen for `beforeinstallprompt` and stash the event.
 *   2. Show a banner once we have it AND the user hasn't dismissed
 *      it within the past week.
 *   3. On click "Install", call `prompt()` and wait for `userChoice`.
 *   4. On "Not now", record the timestamp so we don't keep nagging.
 *
 * On iOS Safari the `beforeinstallprompt` event is never fired, so
 * the banner simply never appears there — that's by design; iOS
 * users add to home screen via the share sheet, which we cannot
 * trigger programmatically.
 */
const InstallPrompt: Component = () => {
	const [evt, setEvt] = createSignal<BeforeInstallPromptEvent | null>(null);
	const [dismissed, setDismissed] = createSignal(suppressed());

	function suppressed(): boolean {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return false;
			const at = Number.parseInt(raw, 10);
			if (Number.isNaN(at)) return false;
			return Date.now() - at < SUPPRESS_MS;
		} catch {
			return false;
		}
	}

	const onBeforeInstall = (e: Event) => {
		e.preventDefault();
		setEvt(e as BeforeInstallPromptEvent);
	};
	const onInstalled = () => {
		setEvt(null);
		try {
			localStorage.setItem(STORAGE_KEY, String(Date.now()));
		} catch {}
	};

	onMount(() => {
		window.addEventListener("beforeinstallprompt", onBeforeInstall);
		window.addEventListener("appinstalled", onInstalled);
	});
	onCleanup(() => {
		window.removeEventListener("beforeinstallprompt", onBeforeInstall);
		window.removeEventListener("appinstalled", onInstalled);
	});

	const install = async () => {
		const e = evt();
		if (!e) return;
		try {
			await e.prompt();
			const choice = await e.userChoice;
			if (choice.outcome === "dismissed") dismissNow();
		} finally {
			setEvt(null);
		}
	};

	const dismissNow = () => {
		setDismissed(true);
		try {
			localStorage.setItem(STORAGE_KEY, String(Date.now()));
		} catch {}
	};

	return (
		<Show when={evt() && !dismissed()}>
			<dialog
				open
				class="absolute z-[9999] left-1/2 -translate-x-1/2 bottom-3 px-4 py-2 rounded-xl bg-os-window border border-os-border shadow-2xl flex items-center gap-3 text-xs m-0"
				classList={{
					"max-w-[90vw]": isMobile(),
					"max-w-md": !isMobile(),
				}}
				aria-label="Install CloudOS"
			>
				<span class="text-2xl">☁️</span>
				<div class="flex-1 leading-snug">
					<p class="font-semibold text-os-text">Install CloudOS</p>
					<p class="text-os-text-muted">
						Add to your device for full-screen offline access.
					</p>
				</div>
				<button
					type="button"
					class="px-3 py-1.5 rounded-md bg-os-accent text-white hover:bg-os-accent-hover"
					onClick={install}
				>
					Install
				</button>
				<button
					type="button"
					class="px-2 py-1.5 rounded-md text-os-text-muted hover:bg-os-surface-hover"
					onClick={dismissNow}
					aria-label="Dismiss"
				>
					Not now
				</button>
			</dialog>
		</Show>
	);
};

export default InstallPrompt;
