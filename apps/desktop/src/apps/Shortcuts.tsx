import { Component, For, Show, createSignal, onCleanup, onMount } from "solid-js";
import {
  formatBinding,
  listShortcuts,
  resetAllShortcuts,
  resetShortcut,
  setShortcutBinding,
  subscribeShortcuts,
  type ShortcutBinding,
  type ShortcutView,
} from "../core/shortcut-manager";
import { notify } from "../stores/notification-store";

const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta", "OS", "AltGraph", "ContextMenu"]);

const Shortcuts: Component<{ windowId: string }> = () => {
  const [items, setItems] = createSignal<ShortcutView[]>(listShortcuts());
  const [recordingId, setRecordingId] = createSignal<string | null>(null);
  const [recordingPreview, setRecordingPreview] = createSignal<ShortcutBinding | null>(null);
  const [filter, setFilter] = createSignal("");

  const refresh = () => setItems(listShortcuts());

  onMount(() => {
    refresh();
    const unsub = subscribeShortcuts(refresh);
    onCleanup(unsub);
  });

  const startRecord = (id: string) => {
    setRecordingId(id);
    setRecordingPreview(null);
  };

  const cancelRecord = () => {
    setRecordingId(null);
    setRecordingPreview(null);
  };

  const handleRecordKey = (e: KeyboardEvent) => {
    if (!recordingId()) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") {
      cancelRecord();
      return;
    }
    if (MODIFIER_KEYS.has(e.key)) {
      setRecordingPreview({
        key: "",
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey,
      });
      return;
    }
    const binding: ShortcutBinding = {
      key: e.key,
      ctrl: e.ctrlKey,
      alt: e.altKey,
      shift: e.shiftKey,
      meta: e.metaKey,
    };
    const id = recordingId();
    if (!id) return;
    const result = setShortcutBinding(id, binding);
    if (!result.ok) {
      if (result.reason === "duplicate") {
        notify({
          title: "Shortcut conflict",
          message: `Already used by "${result.conflict}"`,
          type: "warning",
          icon: "⌨️",
        });
      } else if (result.reason === "locked") {
        notify({ title: "Locked", message: "This shortcut cannot be remapped", type: "error", icon: "🔒" });
      } else {
        notify({ title: "Invalid", message: "Pick a non-modifier key", type: "warning", icon: "⌨️" });
      }
      return;
    }
    notify({
      title: "Shortcut updated",
      message: formatBinding(binding),
      type: "success",
      icon: "⌨️",
    });
    cancelRecord();
    refresh();
  };

  const filtered = () => {
    const q = filter().toLowerCase().trim();
    if (!q) return items();
    return items().filter((s) => s.description.toLowerCase().includes(q));
  };

  return (
    <div
      class="flex flex-col h-full text-os-text text-xs select-none"
      tabIndex={0}
      onKeyDown={handleRecordKey}
    >
      {/* Header */}
      <div class="flex items-center gap-2 px-3 py-2 border-b border-os-border">
        <input
          type="text"
          placeholder="Search shortcuts..."
          value={filter()}
          onInput={(e) => setFilter(e.currentTarget.value)}
          class="flex-1 px-3 py-1.5 rounded-md bg-os-surface border border-os-border focus:outline-none focus:border-os-accent"
        />
        <button
          class="px-3 py-1.5 rounded bg-os-surface border border-os-border hover:bg-os-surface-hover transition-colors"
          onClick={() => {
            resetAllShortcuts();
            refresh();
            notify({ title: "Reset", message: "All shortcuts restored to defaults", type: "info", icon: "↩️" });
          }}
        >
          Reset all
        </button>
      </div>

      {/* List */}
      <div class="flex-1 overflow-y-auto">
        <Show when={filtered().length > 0} fallback={
          <div class="flex items-center justify-center h-full text-os-text-muted">
            No shortcuts match
          </div>
        }>
          <For each={filtered()}>
            {(s) => (
              <div class="flex items-center gap-3 px-3 py-2 border-b border-os-border/50 hover:bg-os-surface-hover/30 transition-colors">
                <div class="flex-1 min-w-0">
                  <div class="truncate">{s.description}</div>
                  <Show when={s.locked}>
                    <div class="text-[10px] text-os-text-muted">Locked (system)</div>
                  </Show>
                </div>

                <Show when={recordingId() === s.id} fallback={
                  <button
                    class="px-2.5 py-1 rounded border border-os-border bg-os-surface min-w-[120px] text-center font-mono text-[11px]"
                    classList={{
                      "opacity-50 cursor-not-allowed": s.locked,
                      "hover:bg-os-surface-hover hover:border-os-accent transition-colors": !s.locked,
                    }}
                    disabled={s.locked}
                    onClick={() => !s.locked && startRecord(s.id)}
                    title={s.locked ? "System shortcut" : "Click to set new binding"}
                  >
                    {formatBinding(s.current)}
                  </button>
                }>
                  <div class="px-2.5 py-1 rounded border border-os-accent bg-os-accent/10 min-w-[120px] text-center font-mono text-[11px] text-os-accent animate-pulse">
                    <Show when={recordingPreview()} fallback="Press keys...">
                      {(p) => formatBinding(p())}
                    </Show>
                  </div>
                  <button
                    class="px-2 py-1 rounded text-[10px] hover:bg-os-surface-hover transition-colors"
                    onClick={cancelRecord}
                    title="Cancel"
                  >
                    Esc
                  </button>
                </Show>

                <button
                  class="px-2 py-1 rounded text-[10px] transition-colors disabled:opacity-30"
                  classList={{
                    "hover:bg-os-surface-hover": s.isCustom,
                  }}
                  disabled={!s.isCustom}
                  onClick={() => {
                    resetShortcut(s.id);
                    refresh();
                  }}
                  title="Reset to default"
                >
                  ↩︎
                </button>
              </div>
            )}
          </For>
        </Show>
      </div>

      {/* Footer */}
      <div class="px-3 py-2 border-t border-os-border text-[10px] text-os-text-muted">
        Click a binding and press the new key combination. Press Esc to cancel.
      </div>
    </div>
  );
};

export default Shortcuts;
