import { Component, For, Show, createSignal } from "solid-js";
import {
  desktopStore,
  desktops,
  currentDesktopId,
  switchDesktop,
  addDesktop,
  removeDesktop,
  renameDesktop,
  switchOverlayVisible,
  currentDesktop,
} from "../stores/desktop-store";
import { reassignWindowsFromDesktop, windowStore } from "../stores/window-store";

const MAX_DESKTOPS = 9;

function windowCountForDesktop(id: number) {
  return windowStore.windows.filter((w) => w.desktopId === id).length;
}

export const WorkspaceTrayButton: Component = () => {
  const [open, setOpen] = createSignal(false);
  const [renamingId, setRenamingId] = createSignal<number | null>(null);
  const [renameValue, setRenameValue] = createSignal("");

  const handleAdd = (e: MouseEvent) => {
    e.stopPropagation();
    if (desktops().length >= MAX_DESKTOPS) return;
    const id = addDesktop();
    switchDesktop(id, { silent: true });
  };

  const handleRemove = (e: MouseEvent, id: number) => {
    e.stopPropagation();
    if (desktops().length <= 1) return;
    removeDesktop(id, (removed, target) => reassignWindowsFromDesktop(removed, target));
  };

  const handleRenameStart = (id: number, name: string) => {
    setRenamingId(id);
    setRenameValue(name);
  };

  const handleRenameCommit = () => {
    const id = renamingId();
    if (id !== null) {
      renameDesktop(id, renameValue());
    }
    setRenamingId(null);
  };

  return (
    <div class="relative">
      <button
        class="flex items-center gap-1 px-2 h-7 rounded-md text-[11px] text-os-text-muted hover:text-os-text hover:bg-os-surface-hover transition-colors"
        title="Workspaces"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" />
          <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" />
          <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" />
          <rect x="9" y="9" width="5.5" height="5.5" rx="1" />
        </svg>
        <span>{currentDesktop().name}</span>
      </button>

      <Show when={open()}>
        <div
          class="fixed inset-0 z-[9990]"
          onClick={() => {
            setOpen(false);
            setRenamingId(null);
          }}
        />
        <div
          class="absolute top-9 right-0 w-64 z-[9991] rounded-lg bg-os-window border border-os-border shadow-2xl backdrop-blur-xl p-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="flex items-center justify-between px-2 py-1 mb-1">
            <span class="text-[10px] uppercase tracking-wider text-os-text-muted font-semibold">Workspaces</span>
            <button
              class="text-os-text-muted hover:text-os-accent text-sm leading-none disabled:opacity-30 disabled:hover:text-os-text-muted"
              title="New workspace"
              onClick={handleAdd}
              disabled={desktops().length >= MAX_DESKTOPS}
            >
              +
            </button>
          </div>
          <div class="flex flex-col gap-0.5 max-h-72 overflow-y-auto">
            <For each={desktops()}>
              {(d, idx) => (
                <div
                  class="group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors"
                  classList={{
                    "bg-os-accent/15 text-os-accent-hover": d.id === currentDesktopId(),
                    "hover:bg-os-surface-hover text-os-text": d.id !== currentDesktopId(),
                  }}
                  onClick={() => {
                    if (renamingId() !== d.id) {
                      switchDesktop(d.id, { silent: true });
                      setOpen(false);
                    }
                  }}
                  onDblClick={() => handleRenameStart(d.id, d.name)}
                >
                  <span class="text-[10px] w-5 text-center text-os-text-muted">{idx() + 1}</span>
                  <Show
                    when={renamingId() === d.id}
                    fallback={
                      <span class="flex-1 text-xs truncate" title="Double-click to rename">
                        {d.name}
                      </span>
                    }
                  >
                    <input
                      type="text"
                      class="flex-1 text-xs bg-os-surface border border-os-accent/40 rounded px-1 py-0.5 outline-none text-os-text"
                      value={renameValue()}
                      autofocus
                      onClick={(e) => e.stopPropagation()}
                      onInput={(e) => setRenameValue(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameCommit();
                        else if (e.key === "Escape") setRenamingId(null);
                      }}
                      onBlur={handleRenameCommit}
                    />
                  </Show>
                  <span class="text-[10px] text-os-text-muted">
                    {windowCountForDesktop(d.id)}w
                  </span>
                  <Show when={desktops().length > 1}>
                    <button
                      class="opacity-0 group-hover:opacity-100 text-os-text-muted hover:text-os-danger text-xs leading-none transition-opacity"
                      title="Remove workspace"
                      onClick={(e) => handleRemove(e, d.id)}
                    >
                      ✕
                    </button>
                  </Show>
                </div>
              )}
            </For>
          </div>
          <div class="border-t border-os-border mt-2 pt-2 px-2 text-[10px] text-os-text-muted leading-relaxed">
            <p>Ctrl+Alt+→ / ← to switch</p>
            <p>Ctrl+Alt+1…{Math.min(desktops().length, 9)} to jump</p>
          </div>
        </div>
      </Show>
    </div>
  );
};

export const WorkspaceOverlay: Component = () => {
  return (
    <Show when={switchOverlayVisible()}>
      <div class="fixed inset-0 z-[99980] flex items-center justify-center pointer-events-none">
        <div class="px-6 py-4 rounded-2xl bg-os-window/90 border border-os-border backdrop-blur-xl shadow-2xl flex items-center gap-3 animate-fade-in">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" class="text-os-accent">
            <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" />
            <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" />
            <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" />
            <rect x="9" y="9" width="5.5" height="5.5" rx="1" />
          </svg>
          <div class="flex flex-col">
            <span class="text-[10px] uppercase tracking-wider text-os-text-muted">Workspace</span>
            <span class="text-sm font-semibold text-os-text">{currentDesktop().name}</span>
          </div>
          <div class="flex gap-1 ml-2">
            <For each={desktops()}>
              {(d) => (
                <div
                  class="w-2 h-2 rounded-full"
                  classList={{
                    "bg-os-accent": d.id === currentDesktopId(),
                    "bg-os-text-muted/40": d.id !== currentDesktopId(),
                  }}
                />
              )}
            </For>
          </div>
        </div>
      </div>
    </Show>
  );
};
