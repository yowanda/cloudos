import { Component, For, Show, createSignal, onCleanup, onMount } from "solid-js";
import {
  listDir,
  createFile,
  createDir,
  renameEntry,
  formatSize,
  moveToTrash,
  listTrash,
  restoreFromTrash,
  permanentDelete,
  emptyTrash,
  subscribeTrash,
  type VFSEntry,
  type TrashEntry,
} from "../vfs/vfs";
import { showContextMenu } from "../stores/contextmenu-store";
import { openWindow } from "../stores/window-store";
import { notify } from "../stores/notification-store";

const FileIcon: Component<{ entry: VFSEntry }> = (props) => {
  const icon = () => {
    if (props.entry.isDir) return "📁";
    const ext = props.entry.name.split(".").pop()?.toLowerCase();
    const map: Record<string, string> = {
      txt: "📄", md: "📝", js: "📜", ts: "📜", json: "📋",
      html: "🌐", css: "🎨", png: "🖼️", jpg: "🖼️", gif: "🖼️",
      svg: "🖼️", pdf: "📕", mp3: "🎵", mp4: "🎬",
    };
    return map[ext ?? ""] ?? "📄";
  };

  return <span class="text-2xl">{icon()}</span>;
};

const FileManager: Component<{ windowId: string }> = () => {
  const [currentPath, setCurrentPath] = createSignal("/");
  const [entries, setEntries] = createSignal<VFSEntry[]>([]);
  const [trashEntries, setTrashEntries] = createSignal<TrashEntry[]>(listTrash());
  const [selectedPath, setSelectedPath] = createSignal<string | null>(null);
  const [viewMode, setViewMode] = createSignal<"grid" | "list">("grid");
  const [renamingPath, setRenamingPath] = createSignal<string | null>(null);
  const [renameValue, setRenameValue] = createSignal("");
  const [isDragOver, setIsDragOver] = createSignal(false);

  const inTrash = () => currentPath() === "/Trash";

  const refresh = () => {
    if (inTrash()) {
      setTrashEntries(listTrash());
    } else {
      setEntries(listDir(currentPath()));
    }
  };
  refresh();

  onMount(() => {
    const unsub = subscribeTrash(() => setTrashEntries(listTrash()));
    onCleanup(unsub);
  });

  const navigate = (path: string) => {
    setCurrentPath(path);
    setSelectedPath(null);
    if (path === "/Trash") {
      setTrashEntries(listTrash());
    } else {
      setEntries(listDir(path));
    }
  };

  const goUp = () => {
    const parts = currentPath().split("/").filter(Boolean);
    parts.pop();
    navigate(parts.length ? `/${parts.join("/")}` : "/");
  };

  const handleDoubleClick = (entry: VFSEntry) => {
    if (entry.isDir) {
      navigate(entry.path);
    } else if (entry.mimeType.startsWith("text/") || entry.mimeType === "application/json") {
      openWindow({
        appId: "com.cloudos.editor",
        title: entry.name,
        icon: "📝",
        width: 700,
        height: 500,
      });
    }
  };

  const handleTrashContextMenu = (e: MouseEvent, t?: TrashEntry) => {
    e.preventDefault();
    e.stopPropagation();
    if (t) {
      setSelectedPath(t.entry.path);
      showContextMenu(e.clientX, e.clientY, [
        {
          label: "Restore",
          icon: "↩️",
          action: () => {
            restoreFromTrash(t.entry.path);
            refresh();
            notify({ title: "Restored", message: `${t.entry.name} restored to ${t.originalPath}`, type: "success", icon: "↩️" });
          },
        },
        { separator: true, label: "" },
        {
          label: "Delete Permanently",
          icon: "✕",
          action: () => {
            permanentDelete(t.entry.path);
            refresh();
          },
        },
      ]);
    } else {
      showContextMenu(e.clientX, e.clientY, [
        {
          label: "Empty Trash",
          icon: "🗑️",
          disabled: trashEntries().length === 0,
          action: () => {
            const count = trashEntries().length;
            emptyTrash();
            refresh();
            notify({ title: "Trash Emptied", message: `${count} item(s) permanently deleted`, type: "info", icon: "🗑️" });
          },
        },
      ]);
    }
  };

  const handleContextMenu = (e: MouseEvent, entry?: VFSEntry) => {
    e.preventDefault();
    e.stopPropagation();

    if (entry) {
      setSelectedPath(entry.path);
      showContextMenu(e.clientX, e.clientY, [
        { label: "Open", icon: "📂", action: () => handleDoubleClick(entry) },
        { label: "Rename", icon: "✏️", action: () => { setRenamingPath(entry.path); setRenameValue(entry.name); } },
        { separator: true, label: "" },
        {
          label: "Move to Trash",
          icon: "🗑️",
          action: () => {
            moveToTrash(entry.path);
            refresh();
            notify({ title: "Moved to Trash", message: entry.name, type: "info", icon: "🗑️" });
          },
        },
      ]);
    } else {
      showContextMenu(e.clientX, e.clientY, [
        { label: "New Folder", icon: "📁", action: () => { createDir(currentPath(), "New Folder"); refresh(); } },
        { label: "New File", icon: "📄", action: () => { createFile(currentPath(), "untitled.txt"); refresh(); } },
        { separator: true, label: "" },
        { label: "Refresh", icon: "🔄", action: refresh },
      ]);
    }
  };

  const handleRename = (oldPath: string) => {
    if (renameValue().trim()) {
      renameEntry(oldPath, renameValue().trim());
      refresh();
    }
    setRenamingPath(null);
  };

  const breadcrumbs = () => {
    const parts = currentPath().split("/").filter(Boolean);
    const crumbs = [{ name: "Home", path: "/" }];
    let path = "";
    for (const p of parts) {
      path += `/${p}`;
      crumbs.push({ name: p, path });
    }
    return crumbs;
  };

  const sidebarItems = [
    { name: "Home", path: "/", icon: "🏠" },
    { name: "Desktop", path: "/Desktop", icon: "🖥️" },
    { name: "Documents", path: "/Documents", icon: "📄" },
    { name: "Downloads", path: "/Downloads", icon: "⬇️" },
    { name: "Pictures", path: "/Pictures", icon: "🖼️" },
    { name: "Music", path: "/Music", icon: "🎵" },
    { name: "Videos", path: "/Videos", icon: "🎬" },
  ];

  const formatTimeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  };

  return (
    <div class="flex h-full text-os-text text-xs select-none">
      {/* Sidebar */}
      <div class="w-40 border-r border-os-border p-2 flex-shrink-0 overflow-y-auto">
        <p class="text-[10px] text-os-text-muted uppercase tracking-wider mb-2 px-2">Favorites</p>
        <For each={sidebarItems}>
          {(item) => (
            <button
              class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-left"
              classList={{
                "bg-os-accent/20 text-os-accent-hover": currentPath() === item.path,
                "hover:bg-os-surface-hover text-os-text": currentPath() !== item.path,
              }}
              onClick={() => navigate(item.path)}
            >
              <span class="text-sm">{item.icon}</span>
              <span>{item.name}</span>
            </button>
          )}
        </For>
        <div class="mt-3 pt-2 border-t border-os-border">
          <p class="text-[10px] text-os-text-muted uppercase tracking-wider mb-2 px-2">System</p>
          <button
            class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-left"
            classList={{
              "bg-os-accent/20 text-os-accent-hover": inTrash(),
              "hover:bg-os-surface-hover text-os-text": !inTrash(),
            }}
            onClick={() => navigate("/Trash")}
          >
            <span class="text-sm">🗑️</span>
            <span class="flex-1">Trash</span>
            <Show when={trashEntries().length > 0}>
              <span class="text-[10px] text-os-text-muted">{trashEntries().length}</span>
            </Show>
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div class="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div class="flex items-center gap-2 px-3 py-1.5 border-b border-os-border">
          <button
            class="px-2 py-1 rounded hover:bg-os-surface-hover transition-colors disabled:opacity-30"
            onClick={goUp}
            disabled={currentPath() === "/"}
          >
            ←
          </button>

          {/* Breadcrumb */}
          <div class="flex-1 flex items-center gap-1 overflow-x-auto">
            <For each={breadcrumbs()}>
              {(crumb, i) => (
                <>
                  <Show when={i() > 0}><span class="text-os-text-muted">/</span></Show>
                  <button
                    class="px-1.5 py-0.5 rounded hover:bg-os-surface-hover transition-colors whitespace-nowrap"
                    classList={{ "text-os-accent-hover": crumb.path === currentPath() }}
                    onClick={() => navigate(crumb.path)}
                  >
                    {crumb.name}
                  </button>
                </>
              )}
            </For>
          </div>

          {/* View Toggle */}
          <button
            class="px-2 py-1 rounded hover:bg-os-surface-hover transition-colors"
            onClick={() => setViewMode(viewMode() === "grid" ? "list" : "grid")}
            title={viewMode() === "grid" ? "List view" : "Grid view"}
          >
            {viewMode() === "grid" ? "☰" : "⊞"}
          </button>
        </div>

        {/* Trash banner */}
        <Show when={inTrash()}>
          <div class="flex items-center justify-between px-3 py-1.5 border-b border-os-border bg-os-warning/10 text-[11px]">
            <span class="text-os-text-muted">
              Items in Trash are kept until you empty it. Right-click an item to restore.
            </span>
            <button
              class="px-2 py-0.5 rounded bg-os-danger/20 text-os-danger hover:bg-os-danger/30 transition-colors disabled:opacity-30 disabled:hover:bg-os-danger/20"
              disabled={trashEntries().length === 0}
              onClick={() => {
                const count = trashEntries().length;
                emptyTrash();
                refresh();
                notify({ title: "Trash Emptied", message: `${count} item(s) permanently deleted`, type: "info", icon: "🗑️" });
              }}
            >
              Empty Trash
            </button>
          </div>
        </Show>

        {/* File listing */}
        <div
          class="flex-1 overflow-y-auto p-2 transition-colors"
          classList={{ "bg-os-accent/10 ring-2 ring-inset ring-os-accent/30 rounded-lg": isDragOver() && !inTrash() }}
          onContextMenu={(e) => (inTrash() ? handleTrashContextMenu(e) : handleContextMenu(e))}
          onDragOver={(e) => { if (!inTrash()) { e.preventDefault(); setIsDragOver(true); } }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            if (inTrash()) return;
            e.preventDefault();
            setIsDragOver(false);
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
              for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const reader = new FileReader();
                reader.onload = () => {
                  createFile(currentPath(), file.name, reader.result as string);
                  refresh();
                };
                reader.readAsText(file);
              }
              notify({
                title: "Files Uploaded",
                message: `${files.length} file(s) added to ${currentPath()}`,
                type: "success",
                icon: "📁",
              });
            }
          }}
        >
          {/* Trash view */}
          <Show when={inTrash()}>
            <Show when={trashEntries().length === 0} fallback={
              <div class="flex flex-col gap-1">
                <For each={trashEntries()}>
                  {(t) => (
                    <div
                      class="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors"
                      classList={{
                        "bg-os-accent/20": selectedPath() === t.entry.path,
                        "hover:bg-os-surface-hover": selectedPath() !== t.entry.path,
                      }}
                      onClick={(e) => { e.stopPropagation(); setSelectedPath(t.entry.path); }}
                      onContextMenu={(e) => handleTrashContextMenu(e, t)}
                    >
                      <FileIcon entry={t.entry} />
                      <div class="flex-1 min-w-0">
                        <div class="truncate">{t.entry.name}</div>
                        <div class="text-[10px] text-os-text-muted truncate">from {t.originalPath}</div>
                      </div>
                      <span class="w-20 text-right text-[10px] text-os-text-muted">{formatSize(t.entry.size)}</span>
                      <span class="w-20 text-right text-[10px] text-os-text-muted">{formatTimeAgo(t.deletedAt)}</span>
                      <button
                        class="px-2 py-1 rounded text-[10px] hover:bg-os-success/20 hover:text-os-success transition-colors"
                        title="Restore"
                        onClick={(e) => {
                          e.stopPropagation();
                          restoreFromTrash(t.entry.path);
                          refresh();
                        }}
                      >
                        Restore
                      </button>
                      <button
                        class="px-2 py-1 rounded text-[10px] hover:bg-os-danger/20 hover:text-os-danger transition-colors"
                        title="Delete permanently"
                        onClick={(e) => {
                          e.stopPropagation();
                          permanentDelete(t.entry.path);
                          refresh();
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </For>
              </div>
            }>
              <div class="flex flex-col items-center justify-center h-full text-os-text-muted gap-2">
                <span class="text-4xl opacity-40">🗑️</span>
                <span>Trash is empty</span>
              </div>
            </Show>
          </Show>

          <Show when={!inTrash() && entries().length === 0}>
            <div class="flex items-center justify-center h-full text-os-text-muted">
              This folder is empty
            </div>
          </Show>

          <Show when={!inTrash() && viewMode() === "grid"}>
            <div class="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-1">
              <For each={entries()}>
                {(entry) => (
                  <div
                    class="flex flex-col items-center gap-1 p-2 rounded-lg cursor-pointer transition-colors"
                    classList={{
                      "bg-os-accent/20 ring-1 ring-os-accent/30": selectedPath() === entry.path,
                      "hover:bg-os-surface-hover": selectedPath() !== entry.path,
                    }}
                    onClick={(e) => { e.stopPropagation(); setSelectedPath(entry.path); }}
                    onDblClick={() => handleDoubleClick(entry)}
                    onContextMenu={(e) => handleContextMenu(e, entry)}
                  >
                    <FileIcon entry={entry} />
                    <Show when={renamingPath() === entry.path} fallback={
                      <span class="text-center text-[10px] leading-tight max-w-[72px] break-words">{entry.name}</span>
                    }>
                      <input
                        type="text"
                        value={renameValue()}
                        onInput={(e) => setRenameValue(e.currentTarget.value)}
                        onBlur={() => handleRename(entry.path)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleRename(entry.path); if (e.key === "Escape") setRenamingPath(null); }}
                        class="w-full text-[10px] text-center bg-os-surface border border-os-accent rounded px-1 py-0.5 text-os-text focus:outline-none"
                        autofocus
                      />
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={!inTrash() && viewMode() === "list"}>
            <div class="flex flex-col">
              <div class="flex items-center gap-2 px-3 py-1 text-[10px] text-os-text-muted uppercase border-b border-os-border">
                <span class="flex-1">Name</span>
                <span class="w-16 text-right">Size</span>
                <span class="w-28 text-right">Modified</span>
              </div>
              <For each={entries()}>
                {(entry) => (
                  <div
                    class="flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors"
                    classList={{
                      "bg-os-accent/20": selectedPath() === entry.path,
                      "hover:bg-os-surface-hover": selectedPath() !== entry.path,
                    }}
                    onClick={(e) => { e.stopPropagation(); setSelectedPath(entry.path); }}
                    onDblClick={() => handleDoubleClick(entry)}
                    onContextMenu={(e) => handleContextMenu(e, entry)}
                  >
                    <FileIcon entry={entry} />
                    <span class="flex-1 truncate">{entry.name}</span>
                    <span class="w-16 text-right text-os-text-muted">{formatSize(entry.size)}</span>
                    <span class="w-28 text-right text-os-text-muted">
                      {new Date(entry.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Status Bar */}
        <div class="flex items-center px-3 py-1 border-t border-os-border text-[10px] text-os-text-muted">
          <Show when={inTrash()} fallback={<span>{entries().length} items</span>}>
            <span>{trashEntries().length} items in trash</span>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default FileManager;
