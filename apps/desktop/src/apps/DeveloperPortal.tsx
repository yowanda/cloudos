import {
	type Component,
	For,
	Show,
	createMemo,
	createResource,
	createSignal,
	onMount,
} from "solid-js";
import { token } from "../stores/auth-store";
import { notify } from "../stores/notification-store";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api/v1";

type Tab = "submit" | "mine" | "admin";

interface Submission {
	id: string;
	app_id: string;
	submitted_by: string;
	manifest: Record<string, unknown>;
	status: "pending" | "approved" | "rejected";
	reviewer_id?: string | null;
	review_note?: string;
	created_at: string;
	updated_at: string;
}

interface WhoAmI {
	admin: boolean;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...((init.headers as Record<string, string>) ?? {}),
	};
	const t = token();
	if (t) headers.Authorization = `Bearer ${t}`;
	const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
	const text = await res.text();
	const data = text ? JSON.parse(text) : null;
	if (!res.ok) {
		const msg =
			(data && typeof data === "object" && "error" in data
				? (data as { error?: string }).error
				: undefined) ?? `HTTP ${res.status}`;
		throw new Error(msg);
	}
	return data as T;
}

const sampleManifest = `{
  "id": "com.example.myapp",
  "name": "My App",
  "version": "1.0.0",
  "icon": "🚀",
  "description": "Tagline that shows up in the App Store",
  "author": "Your Name",
  "category": "Productivity",
  "permissions": ["notifications"],
  "entry": {
    "type": "iframe-url",
    "url": "https://example.com/myapp/index.html"
  },
  "window": { "width": 480, "height": 360, "resizable": true }
}`;

const DeveloperPortal: Component<{ windowId: string }> = () => {
	const [tab, setTab] = createSignal<Tab>("submit");
	const [manifestText, setManifestText] = createSignal(sampleManifest);
	const [submitErr, setSubmitErr] = createSignal("");
	const [submitting, setSubmitting] = createSignal(false);

	const [whoami] = createResource(async () => {
		try {
			return await api<WhoAmI>("/dev/whoami");
		} catch {
			return { admin: false } as WhoAmI;
		}
	});

	const [mine, { refetch: refetchMine }] = createResource(async () => {
		return await api<Submission[]>("/dev/submissions/mine");
	});

	const [adminPending, { refetch: refetchAdmin }] = createResource(
		() => (whoami()?.admin ? "load" : null),
		async () => {
			return await api<Submission[]>("/dev/admin/submissions?status=pending");
		},
	);

	onMount(() => {
		refetchMine();
	});

	const isAdmin = () => !!whoami()?.admin;

	const submit = async () => {
		setSubmitErr("");
		let parsed: unknown;
		try {
			parsed = JSON.parse(manifestText());
		} catch (e) {
			setSubmitErr(`Invalid JSON: ${(e as Error).message}`);
			return;
		}
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			setSubmitErr("Manifest must be a JSON object");
			return;
		}
		setSubmitting(true);
		try {
			await api<Submission>("/dev/submissions", {
				method: "POST",
				body: JSON.stringify({ manifest: parsed }),
			});
			notify({
				title: "Submission received",
				message: "Your app is now pending review.",
				type: "success",
			});
			setTab("mine");
			refetchMine();
		} catch (e) {
			setSubmitErr((e as Error).message);
		} finally {
			setSubmitting(false);
		}
	};

	const approve = async (s: Submission) => {
		const note =
			window.prompt("Optional approval note (visible to the developer):", "") ??
			"";
		try {
			await api(`/dev/admin/submissions/${s.id}/approve`, {
				method: "POST",
				body: JSON.stringify({ note }),
			});
			notify({
				title: "Approved",
				message: `${s.app_id} is now published.`,
				type: "success",
			});
			refetchAdmin();
			refetchMine();
		} catch (e) {
			notify({
				title: "Approve failed",
				message: (e as Error).message,
				type: "error",
			});
		}
	};

	const reject = async (s: Submission) => {
		const note =
			window.prompt("Reason for rejection (shown to the developer):", "") ?? "";
		if (!note.trim()) {
			notify({
				title: "Rejection cancelled",
				message: "A reason is required.",
				type: "info",
			});
			return;
		}
		try {
			await api(`/dev/admin/submissions/${s.id}/reject`, {
				method: "POST",
				body: JSON.stringify({ note }),
			});
			notify({
				title: "Rejected",
				message: s.app_id,
				type: "info",
			});
			refetchAdmin();
			refetchMine();
		} catch (e) {
			notify({
				title: "Reject failed",
				message: (e as Error).message,
				type: "error",
			});
		}
	};

	const tabs = createMemo<{ id: Tab; label: string; show: boolean }[]>(() => [
		{ id: "submit", label: "Submit", show: true },
		{ id: "mine", label: "My submissions", show: true },
		{ id: "admin", label: "Admin review", show: isAdmin() },
	]);

	return (
		<div class="flex h-full text-xs bg-os-bg text-os-text">
			{/* Sidebar */}
			<div class="w-40 border-r border-os-border p-2 flex-shrink-0">
				<p class="text-[10px] text-os-text-muted uppercase tracking-wider mb-2 px-2">
					Developer
				</p>
				<For each={tabs().filter((t) => t.show)}>
					{(t) => (
						<button
							type="button"
							class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-left"
							classList={{
								"bg-os-accent/20 text-os-accent-hover": tab() === t.id,
								"hover:bg-os-surface-hover text-os-text": tab() !== t.id,
							}}
							onClick={() => setTab(t.id)}
						>
							<span>{t.label}</span>
						</button>
					)}
				</For>
				<Show when={isAdmin()}>
					<p class="text-[10px] text-os-text-muted mt-3 px-2">
						You are signed in as an administrator.
					</p>
				</Show>
			</div>

			{/* Content */}
			<div class="flex-1 p-4 overflow-y-auto">
				<Show when={tab() === "submit"}>
					<h2 class="text-sm font-semibold mb-2">Submit a new app</h2>
					<p class="text-os-text-muted mb-3 leading-relaxed">
						Paste your <code>AppManifest</code> JSON below. See{" "}
						<a
							class="text-os-accent hover:underline"
							href="https://github.com/yowanda/cloudos/blob/main/docs/APPS.md"
							target="_blank"
							rel="noreferrer"
						>
							docs/APPS.md
						</a>{" "}
						for the full schema. Required keys: <code>id</code>,{" "}
						<code>name</code>, <code>version</code>, <code>icon</code>,{" "}
						<code>entry</code>.
					</p>
					<textarea
						class="w-full h-72 font-mono text-[11px] p-2 rounded-md bg-os-surface border border-os-border focus:outline-none focus:border-os-accent resize-y"
						value={manifestText()}
						spellcheck={false}
						onInput={(e) => setManifestText(e.currentTarget.value)}
					/>
					<Show when={submitErr()}>
						<p class="mt-2 text-os-danger text-[11px]">{submitErr()}</p>
					</Show>
					<div class="mt-3 flex items-center gap-2">
						<button
							type="button"
							class="px-3 py-1.5 rounded-md bg-os-accent text-white hover:bg-os-accent-hover disabled:opacity-50"
							onClick={submit}
							disabled={submitting()}
						>
							{submitting() ? "Submitting…" : "Submit for review"}
						</button>
						<button
							type="button"
							class="px-3 py-1.5 rounded-md bg-os-surface border border-os-border hover:bg-os-surface-hover"
							onClick={() => setManifestText(sampleManifest)}
						>
							Reset to sample
						</button>
					</div>
				</Show>

				<Show when={tab() === "mine"}>
					<div class="flex items-center justify-between mb-3">
						<h2 class="text-sm font-semibold">My submissions</h2>
						<button
							type="button"
							class="px-2 py-1 rounded-md bg-os-surface border border-os-border hover:bg-os-surface-hover"
							onClick={() => refetchMine()}
						>
							Refresh
						</button>
					</div>
					<Show
						when={!mine.loading}
						fallback={<p class="text-os-text-muted">Loading…</p>}
					>
						<Show
							when={mine() && (mine()?.length ?? 0) > 0}
							fallback={
								<p class="text-os-text-muted">
									No submissions yet — submit your first app from the Submit
									tab.
								</p>
							}
						>
							<ul class="flex flex-col gap-2">
								<For each={mine()}>{(s) => <SubmissionCard s={s} />}</For>
							</ul>
						</Show>
					</Show>
				</Show>

				<Show when={tab() === "admin" && isAdmin()}>
					<div class="flex items-center justify-between mb-3">
						<h2 class="text-sm font-semibold">Pending submissions</h2>
						<button
							type="button"
							class="px-2 py-1 rounded-md bg-os-surface border border-os-border hover:bg-os-surface-hover"
							onClick={() => refetchAdmin()}
						>
							Refresh
						</button>
					</div>
					<Show
						when={!adminPending.loading}
						fallback={<p class="text-os-text-muted">Loading…</p>}
					>
						<Show
							when={adminPending() && (adminPending()?.length ?? 0) > 0}
							fallback={
								<p class="text-os-text-muted">
									Nothing waiting for review right now.
								</p>
							}
						>
							<ul class="flex flex-col gap-2">
								<For each={adminPending()}>
									{(s) => (
										<SubmissionCard s={s}>
											<div class="flex items-center gap-2 mt-2">
												<button
													type="button"
													class="px-2 py-1 rounded-md bg-os-accent text-white hover:bg-os-accent-hover"
													onClick={() => approve(s)}
												>
													Approve & publish
												</button>
												<button
													type="button"
													class="px-2 py-1 rounded-md bg-os-danger text-white hover:opacity-90"
													onClick={() => reject(s)}
												>
													Reject
												</button>
											</div>
										</SubmissionCard>
									)}
								</For>
							</ul>
						</Show>
					</Show>
				</Show>
			</div>
		</div>
	);
};

function statusBadge(status: Submission["status"]): {
	label: string;
	cls: string;
} {
	switch (status) {
		case "approved":
			return { label: "Approved", cls: "bg-emerald-500/20 text-emerald-400" };
		case "rejected":
			return { label: "Rejected", cls: "bg-os-danger/20 text-os-danger" };
		default:
			return { label: "Pending", cls: "bg-amber-500/20 text-amber-400" };
	}
}

const SubmissionCard: Component<{
	s: Submission;
	children?: import("solid-js").JSX.Element;
}> = (props) => {
	const m = () => props.s.manifest;
	const get = (k: string) => {
		const v = m()?.[k];
		return typeof v === "string" ? v : "";
	};
	const badge = () => statusBadge(props.s.status);
	return (
		<li class="rounded-md border border-os-border bg-os-surface p-3">
			<div class="flex items-start justify-between gap-2">
				<div class="min-w-0">
					<p class="font-semibold truncate">
						<span class="mr-1">{get("icon") || "📦"}</span>
						{get("name") || props.s.app_id}
						<span class="text-os-text-muted ml-2 font-normal">
							v{get("version") || "?"}
						</span>
					</p>
					<p class="text-[11px] text-os-text-muted truncate">
						<code>{props.s.app_id}</code>
					</p>
				</div>
				<span
					class={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide ${badge().cls}`}
				>
					{badge().label}
				</span>
			</div>
			<Show when={get("description")}>
				<p class="text-[11px] mt-1 leading-snug">{get("description")}</p>
			</Show>
			<Show when={props.s.review_note}>
				<p class="text-[11px] mt-2 text-os-text-muted">
					<span class="font-semibold">Reviewer note:</span>{" "}
					{props.s.review_note}
				</p>
			</Show>
			{props.children}
		</li>
	);
};

export default DeveloperPortal;
