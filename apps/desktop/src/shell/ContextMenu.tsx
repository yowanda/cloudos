import { Component, For, Show } from "solid-js";
import { contextMenu, hideContextMenu, type MenuItem } from "../stores/contextmenu-store";

const ContextMenuItem: Component<{ item: MenuItem }> = (props) => {
  if (props.item.separator) {
    return <div class="h-px bg-os-border my-1" />;
  }

  return (
    <button
      class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-os-text hover:bg-os-accent hover:text-white rounded-md transition-colors text-left disabled:opacity-40 disabled:pointer-events-none"
      disabled={props.item.disabled}
      onClick={() => {
        props.item.action?.();
        hideContextMenu();
      }}
    >
      {props.item.icon && <span class="text-sm w-4">{props.item.icon}</span>}
      <span>{props.item.label}</span>
    </button>
  );
};

export const ContextMenuLayer: Component = () => {
  const menu = contextMenu;

  return (
    <Show when={menu()}>
      {(m) => (
        <>
          <div class="fixed inset-0 z-[99998]" onClick={hideContextMenu} onContextMenu={(e) => e.preventDefault()} />
          <div
            class="fixed z-[99999] min-w-[160px] p-1 rounded-lg bg-os-window backdrop-blur-xl border border-os-border shadow-2xl"
            style={{
              left: `${Math.min(m().x, window.innerWidth - 180)}px`,
              top: `${Math.min(m().y, window.innerHeight - 200)}px`,
            }}
          >
            <For each={m().items}>{(item) => <ContextMenuItem item={item} />}</For>
          </div>
        </>
      )}
    </Show>
  );
};
