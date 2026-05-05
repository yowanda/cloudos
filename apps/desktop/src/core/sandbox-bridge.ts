import { hasPermission, type AppManifest } from "./app-manifest";
import { notify } from "../stores/notification-store";
import {
  closeWindow,
  focusWindow,
  maximizeWindow,
  minimizeWindow,
  windowStore,
} from "../stores/window-store";
import { createFile, getEntry, listDir } from "../vfs/vfs";

export interface IPCCall {
  type: "ipc.call";
  id: string;
  method: string;
  params?: unknown;
}

export interface IPCResult {
  type: "ipc.result";
  id: string;
  result: unknown;
}

export interface IPCError {
  type: "ipc.error";
  id: string;
  error: string;
}

export interface SandboxContext {
  manifest: AppManifest;
  windowId: string;
}

function deny(method: string, perm: string): never {
  throw new Error(`Permission denied: ${method} requires '${perm}'`);
}

async function dispatch(ctx: SandboxContext, method: string, params: unknown): Promise<unknown> {
  const { manifest, windowId } = ctx;
  switch (method) {
    case "ping":
      return { ok: true, ts: Date.now() };

    case "manifest":
      return manifest;

    case "notify": {
      if (!hasPermission(manifest.id, "notifications")) deny(method, "notifications");
      const p = params as {
        title?: string;
        message?: string;
        type?: "info" | "success" | "warning" | "error";
        icon?: string;
      };
      notify({
        title: p?.title ?? manifest.name,
        message: p?.message ?? "",
        type: p?.type ?? "info",
        icon: p?.icon ?? manifest.icon,
      });
      return { ok: true };
    }

    case "windows.close":
      if (!hasPermission(manifest.id, "windows")) deny(method, "windows");
      closeWindow(windowId);
      return { ok: true };

    case "windows.minimize":
      if (!hasPermission(manifest.id, "windows")) deny(method, "windows");
      minimizeWindow(windowId);
      return { ok: true };

    case "windows.maximize":
      if (!hasPermission(manifest.id, "windows")) deny(method, "windows");
      maximizeWindow(windowId);
      return { ok: true };

    case "windows.focus":
      if (!hasPermission(manifest.id, "windows")) deny(method, "windows");
      focusWindow(windowId);
      return { ok: true };

    case "windows.list":
      if (!hasPermission(manifest.id, "windows")) deny(method, "windows");
      return windowStore.windows.map((w) => ({
        id: w.id,
        appId: w.appId,
        title: w.title,
        state: w.state,
      }));

    case "vfs.list": {
      if (!hasPermission(manifest.id, "files.read")) deny(method, "files.read");
      const p = params as { path?: string };
      const dir = p?.path ?? "/";
      return listDir(dir).map((e) => ({
        name: e.name,
        path: e.path,
        isDir: e.isDir,
        size: e.size,
        mimeType: e.mimeType,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      }));
    }

    case "vfs.read": {
      if (!hasPermission(manifest.id, "files.read")) deny(method, "files.read");
      const p = params as { path?: string };
      if (!p?.path) throw new Error("vfs.read requires { path }");
      const entry = getEntry(p.path);
      if (!entry || entry.isDir) throw new Error("File not found: " + p.path);
      return entry.content ?? "";
    }

    case "vfs.exists": {
      if (!hasPermission(manifest.id, "files.read")) deny(method, "files.read");
      const p = params as { path?: string };
      if (!p?.path) throw new Error("vfs.exists requires { path }");
      return !!getEntry(p.path);
    }

    case "vfs.write": {
      if (!hasPermission(manifest.id, "files.write")) deny(method, "files.write");
      const p = params as { path?: string; content?: string };
      if (!p?.path) throw new Error("vfs.write requires { path, content }");
      // Split into parent + name; create directly under parent
      const lastSlash = p.path.lastIndexOf("/");
      const parent = lastSlash === 0 ? "/" : p.path.slice(0, lastSlash);
      const name = p.path.slice(lastSlash + 1);
      if (!name) throw new Error("vfs.write: empty filename");
      const existing = getEntry(p.path);
      if (existing && existing.isDir) throw new Error("Cannot overwrite directory: " + p.path);
      // Recreate atomically: createFile overwrites map entry of same path
      createFile(parent, name, p.content ?? "");
      return { ok: true };
    }

    case "clipboard.read": {
      if (!hasPermission(manifest.id, "clipboard.read")) deny(method, "clipboard.read");
      try {
        return await navigator.clipboard.readText();
      } catch (e) {
        throw new Error("Clipboard read failed: " + (e instanceof Error ? e.message : String(e)));
      }
    }

    case "clipboard.write": {
      if (!hasPermission(manifest.id, "clipboard.write")) deny(method, "clipboard.write");
      const p = params as { text?: string };
      try {
        await navigator.clipboard.writeText(p?.text ?? "");
        return { ok: true };
      } catch (e) {
        throw new Error("Clipboard write failed: " + (e instanceof Error ? e.message : String(e)));
      }
    }

    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

export function attachSandbox(iframe: HTMLIFrameElement, ctx: SandboxContext) {
  const handler = (event: MessageEvent) => {
    if (event.source !== iframe.contentWindow) return;
    const msg = event.data as IPCCall | undefined;
    if (!msg || msg.type !== "ipc.call" || typeof msg.id !== "string") return;

    const respond = (out: IPCResult | IPCError) => {
      iframe.contentWindow?.postMessage(out, "*");
    };

    void (async () => {
      try {
        const result = await dispatch(ctx, msg.method, msg.params);
        respond({ type: "ipc.result", id: msg.id, result });
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        respond({ type: "ipc.error", id: msg.id, error });
      }
    })();
  };

  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}

export const SDK_BOOTSTRAP = String.raw`
<script>
(function () {
  var pending = new Map();
  var nextId = 0;
  function call(method, params) {
    var id = String(++nextId);
    return new Promise(function (resolve, reject) {
      pending.set(id, { resolve: resolve, reject: reject });
      window.parent.postMessage({ type: "ipc.call", id: id, method: method, params: params }, "*");
    });
  }
  window.addEventListener("message", function (e) {
    var d = e.data;
    if (!d || (d.type !== "ipc.result" && d.type !== "ipc.error")) return;
    var p = pending.get(d.id);
    if (!p) return;
    pending.delete(d.id);
    if (d.type === "ipc.result") p.resolve(d.result);
    else p.reject(new Error(d.error));
  });
  window.cloudos = {
    notify: function (opts) { return call("notify", opts); },
    windows: {
      close: function () { return call("windows.close"); },
      minimize: function () { return call("windows.minimize"); },
      maximize: function () { return call("windows.maximize"); },
      focus: function () { return call("windows.focus"); },
      list: function () { return call("windows.list"); },
    },
    vfs: {
      list: function (path) { return call("vfs.list", { path: path }); },
      read: function (path) { return call("vfs.read", { path: path }); },
      write: function (path, content) { return call("vfs.write", { path: path, content: content }); },
      exists: function (path) { return call("vfs.exists", { path: path }); },
    },
    clipboard: {
      read: function () { return call("clipboard.read"); },
      write: function (text) { return call("clipboard.write", { text: text }); },
    },
    manifest: function () { return call("manifest"); },
    ping: function () { return call("ping"); },
  };
  document.dispatchEvent(new CustomEvent("cloudos:ready"));
})();
</script>
`;
