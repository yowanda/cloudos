import { exportSnapshot } from "../vfs/vfs";
import { listManifests } from "./app-manifest";

export type SearchKind = "file" | "app" | "command";

export interface SearchResult {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  score: number;
  /** Action to run when selected. */
  action: () => void;
}

const builtinApps: { id: string; name: string; icon: string; category: string }[] = [
  { id: "com.cloudos.files", name: "Files", icon: "📁", category: "System" },
  { id: "com.cloudos.terminal", name: "Terminal", icon: "⬛", category: "System" },
  { id: "com.cloudos.editor", name: "Text Editor", icon: "📝", category: "System" },
  { id: "com.cloudos.browser", name: "Browser", icon: "🌐", category: "System" },
  { id: "com.cloudos.settings", name: "Settings", icon: "⚙️", category: "System" },
  { id: "com.cloudos.calculator", name: "Calculator", icon: "🧮", category: "Utilities" },
  { id: "com.cloudos.imageviewer", name: "Image Viewer", icon: "🖼️", category: "Media" },
  { id: "com.cloudos.mediaplayer", name: "Media Player", icon: "🎵", category: "Media" },
  { id: "com.cloudos.notes", name: "Notes", icon: "📒", category: "Productivity" },
  { id: "com.cloudos.appstore", name: "App Store", icon: "🏪", category: "System" },
  { id: "com.cloudos.shortcuts", name: "Shortcuts", icon: "⌨️", category: "System" },
  { id: "com.cloudos.assistant", name: "Assistant", icon: "🤖", category: "Productivity" },
];

function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9_]+/g).filter(Boolean);
}

function matchScore(query: string, candidate: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const c = candidate.toLowerCase();
  if (c === q) return 1000;
  if (c.startsWith(q)) return 500;
  if (c.includes(q)) return 250;
  // token-based
  const qTokens = tokenize(q);
  const cTokens = new Set(tokenize(c));
  let hits = 0;
  for (const t of qTokens) {
    if (cTokens.has(t)) hits++;
    else {
      for (const ct of cTokens) {
        if (ct.startsWith(t)) {
          hits += 0.5;
          break;
        }
      }
    }
  }
  if (hits === 0) return 0;
  return Math.min(200, 50 + hits * 30);
}

export function searchLocal(
  query: string,
  options: { onOpenApp?: (appId: string, name: string, icon: string) => void; onOpenFile?: (path: string, name: string) => void } = {},
): SearchResult[] {
  if (!query.trim()) return [];
  const results: SearchResult[] = [];

  // Apps
  const seen = new Set<string>();
  const allApps = [
    ...builtinApps,
    ...listManifests().map((m) => ({ id: m.id, name: m.name, icon: m.icon, category: m.category ?? "Apps" })),
  ];
  for (const app of allApps) {
    if (seen.has(app.id)) continue;
    seen.add(app.id);
    const titleScore = matchScore(query, app.name);
    if (titleScore > 0) {
      results.push({
        kind: "app",
        id: app.id,
        title: app.name,
        subtitle: app.category,
        icon: app.icon,
        score: titleScore + 100, // boost apps
        action: () => options.onOpenApp?.(app.id, app.name, app.icon),
      });
    }
  }

  // Files (search name + content)
  const entries = exportSnapshot();
  for (const e of entries) {
    if (e.isDir) continue;
    const nameScore = matchScore(query, e.name);
    let contentScore = 0;
    if (e.content) {
      contentScore = matchScore(query, e.content) * 0.5;
    }
    const score = nameScore + contentScore;
    if (score > 0) {
      results.push({
        kind: "file",
        id: e.path,
        title: e.name,
        subtitle: e.path,
        icon: e.isDir ? "📁" : "📄",
        score,
        action: () => options.onOpenFile?.(e.path, e.name),
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 30);
}

// ───── Meilisearch optional remote search ─────

const MEILI_KEY = "cloudos:search:meili";

export interface MeiliConfig {
  baseUrl: string;
  apiKey: string;
  index: string;
}

const defaultMeili: MeiliConfig = {
  baseUrl: "",
  apiKey: "",
  index: "cloudos",
};

export function loadMeiliConfig(): MeiliConfig {
  if (typeof window === "undefined") return { ...defaultMeili };
  try {
    const raw = window.localStorage.getItem(MEILI_KEY);
    if (!raw) return { ...defaultMeili };
    const partial = JSON.parse(raw) as Partial<MeiliConfig>;
    return { ...defaultMeili, ...partial };
  } catch {
    return { ...defaultMeili };
  }
}

export function saveMeiliConfig(cfg: MeiliConfig) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MEILI_KEY, JSON.stringify(cfg));
  } catch {
    // ignore
  }
}

export interface MeiliHit {
  id?: string | number;
  title?: string;
  path?: string;
  content?: string;
  [key: string]: unknown;
}

export async function searchMeili(query: string): Promise<MeiliHit[]> {
  const cfg = loadMeiliConfig();
  if (!cfg.baseUrl || !cfg.index) return [];
  const url = `${cfg.baseUrl.replace(/\/$/, "")}/indexes/${encodeURIComponent(cfg.index)}/search`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
    },
    body: JSON.stringify({ q: query, limit: 20 }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Meilisearch error: HTTP ${res.status} ${text || res.statusText}`);
  }
  const data = (await res.json()) as { hits?: MeiliHit[] };
  return data.hits ?? [];
}
