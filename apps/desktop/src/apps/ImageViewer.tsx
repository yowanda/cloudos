import { Component, For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { getEntry } from "../vfs/vfs";
import { getVfsDragPath, isAcceptableDrop } from "../core/drag-drop";
import { notify } from "../stores/notification-store";

/**
 * Cross-window signal so File Manager can hand off an image to the viewer
 * without us threading window data through openWindow. The viewer reads it
 * once on mount and clears it.
 */
const [pendingOpen, setPendingOpen] = createSignal<{ src: string; name: string; siblings?: string[] } | null>(null);

export function openImageInViewer(opts: { src: string; name: string; siblings?: string[] }) {
  setPendingOpen(opts);
}

const IMAGE_MIME_PREFIXES = ["image/"];

function isImageMime(mime: string | undefined) {
  if (!mime) return false;
  return IMAGE_MIME_PREFIXES.some((p) => mime.startsWith(p));
}

interface ImageItem {
  src: string;
  name: string;
}

const ImageViewer: Component<{ windowId: string }> = () => {
  const [items, setItems] = createSignal<ImageItem[]>([]);
  const [activeIdx, setActiveIdx] = createSignal(0);
  const [zoom, setZoom] = createSignal(1);
  const [rotation, setRotation] = createSignal(0);
  const [pan, setPan] = createSignal({ x: 0, y: 0 });
  const [slideshow, setSlideshow] = createSignal(false);
  const [urlInput, setUrlInput] = createSignal("");

  let slideshowTimer: ReturnType<typeof setInterval> | null = null;

  const active = createMemo(() => items()[activeIdx()] ?? null);

  const reset = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  const addItem = (item: ImageItem) => {
    setItems((prev) => {
      const next = [...prev, item];
      return next;
    });
    setActiveIdx(items().length - 1);
    reset();
  };

  // On mount: if File Manager queued an image, load it (and any siblings).
  onMount(() => {
    const pending = pendingOpen();
    if (!pending) return;
    setPendingOpen(null);

    if (pending.siblings && pending.siblings.length > 0) {
      const fromSiblings: ImageItem[] = pending.siblings.flatMap((p) => {
        const e = getEntry(p);
        if (!e || e.isDir) return [];
        if (!isImageMime(e.mimeType)) return [];
        const src = e.content ?? "";
        if (!src) return [];
        return [{ src, name: e.name }];
      });
      const idx = fromSiblings.findIndex((i) => i.name === pending.name);
      setItems(fromSiblings);
      setActiveIdx(Math.max(0, idx));
    } else {
      addItem({ src: pending.src, name: pending.name });
    }
    reset();
  });

  const next = () => {
    if (items().length === 0) return;
    setActiveIdx((i) => (i + 1) % items().length);
    reset();
  };
  const prev = () => {
    if (items().length === 0) return;
    setActiveIdx((i) => (i - 1 + items().length) % items().length);
    reset();
  };

  // Slideshow timer
  createEffect(() => {
    if (slideshowTimer) {
      clearInterval(slideshowTimer);
      slideshowTimer = null;
    }
    if (slideshow() && items().length > 1) {
      slideshowTimer = setInterval(next, 3000);
    }
  });
  onCleanup(() => {
    if (slideshowTimer) clearInterval(slideshowTimer);
  });

  // Keyboard shortcuts when window focused
  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case "ArrowRight": next(); break;
        case "ArrowLeft": prev(); break;
        case "+": case "=": setZoom((z) => Math.min(z * 1.2, 8)); break;
        case "-": setZoom((z) => Math.max(z / 1.2, 0.1)); break;
        case "0": reset(); break;
        case "r": case "R": setRotation((r) => (r + 90) % 360); break;
        case " ": setSlideshow((s) => !s); e.preventDefault(); break;
      }
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  // Drag from host or from another CloudOS window (FileManager)
  const [isDragOver, setIsDragOver] = createSignal(false);
  const onDragOver = (e: DragEvent) => {
    if (!isAcceptableDrop(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };
  const onDragLeave = (e: DragEvent) => {
    if (e.currentTarget === e.target) setIsDragOver(false);
    else if (!e.relatedTarget || !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };
  const onDrop = (e: DragEvent) => {
    setIsDragOver(false);
    // 1. internal drag — VFS path
    const vfsPath = getVfsDragPath(e);
    if (vfsPath) {
      e.preventDefault();
      const entry = getEntry(vfsPath);
      if (!entry || entry.isDir) {
        notify({ title: "Can't open", message: `${vfsPath} is not a file`, type: "warning", icon: "🖼️" });
        return;
      }
      if (!isImageMime(entry.mimeType)) {
        notify({ title: "Not an image", message: `${entry.name} (${entry.mimeType})`, type: "warning", icon: "🖼️" });
        return;
      }
      const src = entry.content ?? "";
      if (src) addItem({ src, name: entry.name });
      return;
    }
    // 2. external — OS files
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    e.preventDefault();
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const reader = new FileReader();
      reader.onload = () => {
        addItem({ src: reader.result as string, name: file.name });
      };
      reader.readAsDataURL(file);
    }
  };

  // Mouse wheel: zoom in/out
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setZoom((z) => Math.min(Math.max(z * factor, 0.1), 8));
  };

  // Drag to pan
  let panStart: { x: number; y: number; px: number; py: number } | null = null;
  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    panStart = { x: e.clientX, y: e.clientY, px: pan().x, py: pan().y };
  };
  const onMouseMove = (e: MouseEvent) => {
    if (!panStart) return;
    setPan({
      x: panStart.px + (e.clientX - panStart.x),
      y: panStart.py + (e.clientY - panStart.y),
    });
  };
  const onMouseUp = () => { panStart = null; };

  const fromUrl = () => {
    const u = urlInput().trim();
    if (!u) return;
    addItem({ src: u, name: u.split("/").pop() ?? u });
    setUrlInput("");
  };

  const transform = () =>
    `translate(${pan().x}px, ${pan().y}px) scale(${zoom()}) rotate(${rotation()}deg)`;

  const isSvgString = (s: string) => s.trim().startsWith("<svg");

  return (
    <div
      class="h-full flex flex-col bg-[#0d0d0d] text-os-text relative"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <Show when={isDragOver()}>
        <div class="pointer-events-none absolute inset-0 z-50 bg-os-accent/15 border-4 border-dashed border-os-accent flex items-center justify-center">
          <div class="text-sm text-white bg-os-accent/80 px-4 py-2 rounded">
            Drop image to add
          </div>
        </div>
      </Show>
      {/* Toolbar */}
      <div class="flex items-center gap-1 px-2 py-1 border-b border-os-border text-[11px] flex-shrink-0">
        <button
          class="px-2 py-1 rounded hover:bg-os-surface-hover transition-colors disabled:opacity-30"
          onClick={prev}
          disabled={items().length < 2}
          title="Previous (←)"
        >‹</button>
        <span class="px-2 text-os-text-muted min-w-[60px] text-center">
          {items().length > 0 ? `${activeIdx() + 1} / ${items().length}` : "0 / 0"}
        </span>
        <button
          class="px-2 py-1 rounded hover:bg-os-surface-hover transition-colors disabled:opacity-30"
          onClick={next}
          disabled={items().length < 2}
          title="Next (→)"
        >›</button>

        <div class="w-px h-5 bg-os-border mx-1" />

        <button
          class="px-2 py-1 rounded hover:bg-os-surface-hover transition-colors"
          onClick={() => setZoom((z) => Math.max(z / 1.2, 0.1))}
          title="Zoom out (-)"
        >−</button>
        <span class="px-2 text-os-text-muted min-w-[48px] text-center">{Math.round(zoom() * 100)}%</span>
        <button
          class="px-2 py-1 rounded hover:bg-os-surface-hover transition-colors"
          onClick={() => setZoom((z) => Math.min(z * 1.2, 8))}
          title="Zoom in (+)"
        >+</button>
        <button
          class="px-2 py-1 rounded hover:bg-os-surface-hover transition-colors"
          onClick={reset}
          title="Reset (0)"
        >100%</button>

        <div class="w-px h-5 bg-os-border mx-1" />

        <button
          class="px-2 py-1 rounded hover:bg-os-surface-hover transition-colors"
          onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
          title="Rotate left"
        >↺</button>
        <button
          class="px-2 py-1 rounded hover:bg-os-surface-hover transition-colors"
          onClick={() => setRotation((r) => (r + 90) % 360)}
          title="Rotate right (R)"
        >↻</button>

        <div class="w-px h-5 bg-os-border mx-1" />

        <button
          class="px-2 py-1 rounded transition-colors"
          classList={{
            "bg-os-accent/20 text-os-accent-hover": slideshow(),
            "hover:bg-os-surface-hover": !slideshow(),
          }}
          disabled={items().length < 2}
          onClick={() => setSlideshow(!slideshow())}
          title="Slideshow (Space)"
        >▶ Slideshow</button>

        <div class="flex-1" />

        <input
          type="text"
          placeholder="Open URL..."
          class="bg-os-surface border border-os-border rounded px-2 py-1 text-[11px] w-40 focus:outline-none focus:border-os-accent"
          value={urlInput()}
          onInput={(e) => setUrlInput(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") fromUrl(); }}
        />
        <button
          class="px-2 py-1 rounded hover:bg-os-surface-hover transition-colors"
          onClick={fromUrl}
          title="Open URL"
        >Open</button>
      </div>

      {/* Stage */}
      <div
        class="flex-1 relative overflow-hidden flex items-center justify-center select-none"
        style={{ "background-image": "linear-gradient(45deg, #1a1a1a 25%, transparent 25%), linear-gradient(-45deg, #1a1a1a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1a1a 75%), linear-gradient(-45deg, transparent 75%, #1a1a1a 75%)", "background-size": "20px 20px", "background-position": "0 0, 0 10px, 10px -10px, -10px 0px" }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <Show when={active()} fallback={
          <div class="flex flex-col items-center gap-2 text-os-text-muted text-sm pointer-events-none">
            <span class="text-5xl">🖼️</span>
            <p>Drop an image, paste a URL, or open one from File Manager</p>
            <p class="text-[11px] opacity-50">PNG · JPG · GIF · WebP · SVG</p>
          </div>
        }>
          {(item) => (
            <Show
              when={isSvgString(item().src)}
              fallback={
                <img
                  src={item().src}
                  alt={item().name}
                  draggable={false}
                  class="max-w-full max-h-full object-contain transition-transform"
                  style={{ transform: transform(), cursor: panStart ? "grabbing" : "grab" }}
                />
              }
            >
              <div
                class="transition-transform"
                style={{ transform: transform(), cursor: panStart ? "grabbing" : "grab" }}
                innerHTML={item().src}
              />
            </Show>
          )}
        </Show>
      </div>

      {/* Filmstrip */}
      <Show when={items().length > 1}>
        <div class="flex items-center gap-1 px-2 py-1 border-t border-os-border overflow-x-auto flex-shrink-0">
          <For each={items()}>
            {(item, i) => (
              <button
                class="flex-shrink-0 w-12 h-12 rounded border-2 overflow-hidden transition-colors"
                classList={{
                  "border-os-accent": activeIdx() === i(),
                  "border-os-border hover:border-os-accent/50": activeIdx() !== i(),
                }}
                onClick={() => { setActiveIdx(i()); reset(); }}
                title={item.name}
              >
                <Show when={!isSvgString(item.src)} fallback={<div class="w-full h-full bg-white text-[8px] flex items-center justify-center">SVG</div>}>
                  <img src={item.src} class="w-full h-full object-cover" />
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Status */}
      <div class="flex items-center justify-between px-3 py-1 border-t border-os-border text-[10px] text-os-text-muted flex-shrink-0">
        <span class="truncate">{active()?.name ?? "—"}</span>
        <span>
          {Math.round(zoom() * 100)}% · {rotation()}°
          <Show when={slideshow()}><span class="ml-2 text-os-accent">● slideshow</span></Show>
        </span>
      </div>
    </div>
  );
};

export default ImageViewer;
