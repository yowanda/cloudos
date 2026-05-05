import { Component, For, Show, createSignal, onCleanup, onMount } from "solid-js";
import {
  listDir,
  createFile,
  createDir,
  renameEntry,
  moveEntry,
  formatSize,
  moveToTrash,
  listTrash,
  restoreFromTrash,
  permanentDelete,
  emptyTrash,
  subscribeTrash,
  getEntry,
  type VFSEntry,
  type TrashEntry,
} from "../vfs/vfs";
import { showContextMenu } from "../stores/contextmenu-store";
import { openWindow } from "../stores/window-store";
import { notify } from "../stores/notification-store";
import ShareDialog from "../shell/ShareDialog";
import { openImageInViewer } from "./ImageViewer";

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
  const [sharingEntry, setSharingEntry] = createSignal<VFSEntry | null>(null);
  // Drag-to-move source path (when set, indicates an internal drag is in flight)
  const [dragSrc, setDragSrc] = createSignal<string | null>(null);
  // Folder path currently being hovered as a drop target during an internal drag
  const [dropTargetPath, setDropTargetPath] = createSignal<string | null>(null);
  // Right-side preview / Quick Look pane
  const [previewOpen, setPreviewOpen] = createSignal(false);

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
      return;
    }
    if (entry.mimeType.startsWith("image/")) {
      // Build a sibling list of all images in the same directory so Image
      // Viewer can offer prev/next + slideshow without re-querying the VFS.
      const parent = entry.path.substring(0, entry.path.lastIndexOf("/")) || "/";
      const siblings = listDir(parent)
        .filter((e) => !e.isDir && e.mimeType.startsWith("image/"))
        .map((e) => e.path);
      openImageInViewer({ src: entry.content ?? "", name: entry.name, siblings });
      openWindow({
        appId: "com.cloudos.imageviewer",
        title: entry.name,
        icon: "🖼️",
        width: 720,
        height: 560,
      });
      return;
    }
    if (entry.mimeType.startsWith("text/") || entry.mimeType === "application/json") {
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
      const items = [
        { label: "Open", icon: "📂", action: () => handleDoubleClick(entry) },
        { label: "Rename", icon: "✏️", action: () => { setRenamingPath(entry.path); setRenameValue(entry.name); } },
      ];
      if (!entry.isDir) {
        items.push({
          label: "Share...",
          icon: "🔗",
          action: () => setSharingEntry(entry),
        });
      }
      items.push({ separator: true, label: "", action: () => {} } as never);
      items.push({
        label: "Move to Trash",
        icon: "🗑️",
        action: () => {
          moveToTrash(entry.path);
          refresh();
          notify({ title: "Moved to Trash", message: entry.name, type: "info", icon: "🗑️" });
        },
      });
      showContextMenu(e.clientX, e.clientY, items);
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

  // Drag handlers for moving items within the file manager.
  const handleEntryDragStart = (e: DragEvent, entry: VFSEntry) => {
    if (inTrash()) return;
    e.dataTransfer?.setData("application/x-cloudos-vfs-path", entry.path);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    setDragSrc(entry.path);
  };
  const handleEntryDragEnd = () => {
    setDragSrc(null);
    setDropTargetPath(null);
  };
  const handleFolderDragOver = (e: DragEvent, folderPath: string) => {
    if (!dragSrc()) return; // not an internal drag
    if (folderPath === dragSrc()) return; // can't drop on self
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    setDropTargetPath(folderPath);
  };
  const handleFolderDrop = (e: DragEvent, folderPath: string) => {
    const src = e.dataTransfer?.getData("application/x-cloudos-vfs-path");
    if (!src) return; // external (file upload) — handled by parent
    e.preventDefault();
    e.stopPropagation();
    setDragSrc(null);
    setDropTargetPath(null);
    if (src === folderPath) return;
    const result = moveEntry(src, folderPath);
    if (result) {
      refresh();
      const name = src.split("/").pop() ?? src;
      notify({ title: "Moved", message: `${name} → ${folderPath}`, type: "success", icon: "↗️" });
    } else {
      notify({ title: "Move failed", message: "Name collision or invalid target", type: "warning", icon: "⚠️" });
    }
  };

  const previewEntry = () => {
    const p = selectedPath();
    if (!p || inTrash()) return null;
    return getEntry(p) ?? null;
  };

  const renderPreview = (entry: VFSEntry) => {
    const mime = entry.mimeType;
    const content = entry.content ?? "";
    if (entry.isDir) {
      const children = listDir(entry.path);
      return (
        <div class="text-[11px] text-os-text-muted">
          Directory containing {children.length} item{children.length === 1 ? "" : "s"}.
        </div>
      );
    }
    if (mime.startsWith("image/")) {
      // Inline preview for SVG; otherwise show placeholder (no blob storage yet).
      if (mime === "image/svg+xml" && content) {
        return <div class="bg-white p-2 rounded" innerHTML={content} />;
      }
      return (
        <div class="flex items-center justify-center h-32 bg-os-surface rounded text-3xl">🖼️</div>
      );
    }
    if (mime.startsWith("video/")) {
      return (
        <div class="flex items-center justify-center h-32 bg-os-surface rounded text-3xl">🎬</div>
      );
    }
    if (mime.startsWith("audio/")) {
      return (
        <div class="flex items-center justify-center h-20 bg-os-surface rounded text-3xl">🎵</div>
      );
    }
    if (mime.startsWith("text/") || mime === "application/json") {
      return (
        <pre class="text-[10px] leading-tight bg-os-surface rounded p-2 max-h-64 overflow-auto whitespace-pre-wrap break-words">
          {content || "(empty file)"}
        </pre>
      );
    }
    return <div class="text-[11px] text-os-text-muted">No preview available for {mime}.</div>;
  };

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
                "ring-1 ring-os-accent ring-offset-1 ring-offset-os-bg": dropTargetPath() === item.path,
              }}
              onClick={() => navigate(item.path)}
              onDragOver={(e) => handleFolderDragOver(e, item.path)}
              onDragLeave={() => setDropTargetPath((p) => (p === item.path ? null : p))}
              onDrop={(e) => handleFolderDrop(e, item.path)}
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

          {/* Quick Look toggle */}
          <button
            class="px-2 py-1 rounded transition-colors"
            classList={{
              "bg-os-accent/20 text-os-accent-hover": previewOpen(),
              "hover:bg-os-surface-hover": !previewOpen(),
            }}
            onClick={() => setPreviewOpen(!previewOpen())}
            title={previewOpen() ? "Hide preview" : "Show preview (Quick Look)"}
          >
            👁️
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
                // Binary-ish MIME types (images, audio, video, pdfs) need to be
                // stored as data URLs so the viewer apps can render them; text
                // files use plain text so editors stay usable.
                const t = file.type;
                if (
                  t.startsWith("image/") ||
                  t.startsWith("audio/") ||
                  t.startsWith("video/") ||
                  t === "application/pdf"
                ) {
                  reader.readAsDataURL(file);
                } else {
                  reader.readAsText(file);
                }
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
                    draggable={true}
                    class="flex flex-col items-center gap-1 p-2 rounded-lg cursor-pointer transition-colors"
                    classList={{
                      "bg-os-accent/20 ring-1 ring-os-accent/30": selectedPath() === entry.path,
                      "hover:bg-os-surface-hover": selectedPath() !== entry.path && dropTargetPath() !== entry.path,
                      "ring-2 ring-os-accent": dropTargetPath() === entry.path && entry.isDir,
                      "opacity-50": dragSrc() === entry.path,
                    }}
                    onClick={(e) => { e.stopPropagation(); setSelectedPath(entry.path); }}
                    onDblClick={() => handleDoubleClick(entry)}
                    onContextMenu={(e) => handleContextMenu(e, entry)}
                    onDragStart={(e) => handleEntryDragStart(e, entry)}
                    onDragEnd={handleEntryDragEnd}
                    onDragOver={(e) => entry.isDir && handleFolderDragOver(e, entry.path)}
                    onDragLeave={() => setDropTargetPath((p) => (p === entry.path ? null : p))}
                    onDrop={(e) => entry.isDir && handleFolderDrop(e, entry.path)}
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
                    draggable={true}
                    class="flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors"
                    classList={{
                      "bg-os-accent/20": selectedPath() === entry.path,
                      "hover:bg-os-surface-hover": selectedPath() !== entry.path && dropTargetPath() !== entry.path,
                      "ring-1 ring-os-accent ring-inset": dropTargetPath() === entry.path && entry.isDir,
                      "opacity-50": dragSrc() === entry.path,
                    }}
                    onClick={(e) => { e.stopPropagation(); setSelectedPath(entry.path); }}
                    onDblClick={() => handleDoubleClick(entry)}
                    onContextMenu={(e) => handleContextMenu(e, entry)}
                    onDragStart={(e) => handleEntryDragStart(e, entry)}
                    onDragEnd={handleEntryDragEnd}
                    onDragOver={(e) => entry.isDir && handleFolderDragOver(e, entry.path)}
                    onDragLeave={() => setDropTargetPath((p) => (p === entry.path ? null : p))}
                    onDrop={(e) => entry.isDir && handleFolderDrop(e, entry.path)}
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

      {/* Preview / Quick Look pane */}
      <Show when={previewOpen()}>
        <div class="w-64 border-l border-os-border flex flex-col overflow-hidden flex-shrink-0">
          <div class="flex items-center justify-between px-3 py-1.5 border-b border-os-border">
            <span class="text-[11px] uppercase tracking-wider text-os-text-muted">Preview</span>
            <button
              class="px-1 rounded hover:bg-os-surface-hover transition-colors text-os-text-muted"
              onClick={() => setPreviewOpen(false)}
              title="Close preview"
            >
              ✕
            </button>
          </div>
          <Show when={previewEntry()} fallback={
            <div class="flex flex-col items-center justify-center flex-1 text-os-text-muted gap-2 text-[11px] px-4 text-center">
              <span class="text-3xl opacity-40">👁️</span>
              <span>Select a file or folder to preview it.</span>
            </div>
          }>
            {(entry) => (
              <div class="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                <div class="flex flex-col items-center gap-2 pb-2 border-b border-os-border">
                  <span class="text-4xl"><FileIcon entry={entry()} /></span>
                  <span class="text-[11px] font-medium break-all text-center">{entry().name}</span>
                </div>
                <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[10px]">
                  <span class="text-os-text-muted">Type</span>
                  <span class="break-all">{entry().isDir ? "Folder" : entry().mimeType}</span>
                  <Show when={!entry().isDir}>
                    <span class="text-os-text-muted">Size</span>
                    <span>{formatSize(entry().size)}</span>
                  </Show>
                  <span class="text-os-text-muted">Path</span>
                  <span class="break-all">{entry().path}</span>
                  <span class="text-os-text-muted">Modified</span>
                  <span>{new Date(entry().updatedAt).toLocaleString()}</span>
                </div>
                <div class="text-[10px] uppercase tracking-wider text-os-text-muted">Contents</div>
                {renderPreview(entry())}
              </div>
            )}
          </Show>
        </div>
      </Show>

      <Show when={sharingEntry()}>
        {(entry) => (
          <ShareDialog
            filePath={entry().path}
            fileName={entry().name}
            onClose={() => setSharingEntry(null)}
          />
        )}
      </Show>
    </div>
  );
};

export default FileManager;
