import { Component, Show, createSignal } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { WindowConfig, SnapZone } from "@cloudos/shared";
import { getAppComponent } from "../core/app-registry";
import {
  closeWindow,
  focusWindow,
  minimizeWindow,
  maximizeWindow,
  moveWindow,
  resizeWindow,
  snapWindow,
} from "../stores/window-store";
import { hideContextMenu } from "../stores/contextmenu-store";
import { setStartMenuOpen } from "../stores/startmenu-store";

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const Window: Component<{ config: WindowConfig }> = (props) => {
  let headerRef!: HTMLDivElement;

  const handleMouseDown = (e: MouseEvent) => {
    e.stopPropagation();
    hideContextMenu();
    setStartMenuOpen(false);
    focusWindow(props.config.id);
  };

  const handleDragStart = (e: MouseEvent) => {
    if (!props.config.draggable) return;
    e.preventDefault();
    focusWindow(props.config.id);

    const startX = e.clientX - props.config.bounds.x;
    const startY = e.clientY - props.config.bounds.y;

    const onMove = (ev: MouseEvent) => {
      const newX = ev.clientX - startX;
      const newY = Math.max(0, ev.clientY - startY);

      moveWindow(props.config.id, newX, newY);

      // Snap detection
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const margin = 8;

      if (ev.clientX <= margin && ev.clientY <= margin) {
        snapWindow(props.config.id, "top-left");
      } else if (ev.clientX >= vw - margin && ev.clientY <= margin) {
        snapWindow(props.config.id, "top-right");
      } else if (ev.clientX <= margin && ev.clientY >= vh - margin) {
        snapWindow(props.config.id, "bottom-left");
      } else if (ev.clientX >= vw - margin && ev.clientY >= vh - margin) {
        snapWindow(props.config.id, "bottom-right");
      } else if (ev.clientX <= margin) {
        snapWindow(props.config.id, "left");
      } else if (ev.clientX >= vw - margin) {
        snapWindow(props.config.id, "right");
      }
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const handleResize = (dir: ResizeDir, e: MouseEvent) => {
    if (!props.config.resizable) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startBounds = { ...props.config.bounds };

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const b = { ...startBounds };

      if (dir.includes("e")) b.width = startBounds.width + dx;
      if (dir.includes("w")) { b.x = startBounds.x + dx; b.width = startBounds.width - dx; }
      if (dir.includes("s")) b.height = startBounds.height + dy;
      if (dir.includes("n")) { b.y = startBounds.y + dy; b.height = startBounds.height - dy; }

      resizeWindow(props.config.id, b);
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const resizeHandles: { dir: ResizeDir; class: string; cursor: string }[] = [
    { dir: "n", class: "top-0 left-2 right-2 h-1", cursor: "ns-resize" },
    { dir: "s", class: "bottom-0 left-2 right-2 h-1", cursor: "ns-resize" },
    { dir: "e", class: "top-2 right-0 bottom-2 w-1", cursor: "ew-resize" },
    { dir: "w", class: "top-2 left-0 bottom-2 w-1", cursor: "ew-resize" },
    { dir: "ne", class: "top-0 right-0 w-3 h-3", cursor: "nesw-resize" },
    { dir: "nw", class: "top-0 left-0 w-3 h-3", cursor: "nwse-resize" },
    { dir: "se", class: "bottom-0 right-0 w-3 h-3", cursor: "nwse-resize" },
    { dir: "sw", class: "bottom-0 left-0 w-3 h-3", cursor: "nesw-resize" },
  ];

  return (
    <div
      class="absolute rounded-xl overflow-hidden shadow-2xl transition-shadow"
      classList={{
        "ring-1 ring-os-accent/50 shadow-os-accent/10": props.config.focused,
        "ring-1 ring-os-border": !props.config.focused,
        hidden: props.config.state === "minimized",
      }}
      style={{
        left: `${props.config.bounds.x}px`,
        top: `${props.config.bounds.y}px`,
        width: `${props.config.bounds.width}px`,
        height: `${props.config.bounds.height}px`,
        "z-index": props.config.zIndex,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Title Bar */}
      <div
        ref={headerRef}
        class="flex items-center h-8 px-3 gap-2 bg-os-window-title border-b border-os-border select-none"
        onMouseDown={handleDragStart}
        onDblClick={() => maximizeWindow(props.config.id)}
      >
        <span class="text-sm">{props.config.icon}</span>
        <span class="flex-1 text-xs font-medium text-os-text truncate">{props.config.title}</span>

        {/* Window Controls */}
        <div class="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
          <Show when={props.config.minimizable}>
            <button
              class="w-3 h-3 rounded-full bg-os-warning hover:brightness-110 transition-all"
              onClick={() => minimizeWindow(props.config.id)}
              title="Minimize"
            />
          </Show>
          <Show when={props.config.maximizable}>
            <button
              class="w-3 h-3 rounded-full bg-os-success hover:brightness-110 transition-all"
              onClick={() => maximizeWindow(props.config.id)}
              title="Maximize"
            />
          </Show>
          <Show when={props.config.closable}>
            <button
              class="w-3 h-3 rounded-full bg-os-danger hover:brightness-110 transition-all"
              onClick={() => closeWindow(props.config.id)}
              title="Close"
            />
          </Show>
        </div>
      </div>

      {/* Content */}
      <div class="bg-os-window overflow-auto" style={{ height: `calc(100% - 32px)` }}>
        {(() => {
          const AppComp = getAppComponent(props.config.appId);
          if (AppComp) {
            return <Dynamic component={AppComp} windowId={props.config.id} />;
          }
          return (
            <div class="p-4 text-sm text-os-text-muted">
              <p>{props.config.title}</p>
              <p class="text-xs mt-1 opacity-50">App: {props.config.appId}</p>
            </div>
          );
        })()}
      </div>

      {/* Resize Handles */}
      <Show when={props.config.resizable && props.config.state === "normal"}>
        {resizeHandles.map((h) => (
          <div
            class={`absolute ${h.class} z-10`}
            style={{ cursor: h.cursor }}
            onMouseDown={(e) => handleResize(h.dir, e)}
          />
        ))}
      </Show>
    </div>
  );
};

export default Window;
