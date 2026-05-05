import { Component, createSignal } from "solid-js";

const Browser: Component<{ windowId: string }> = () => {
  const [url, setUrl] = createSignal("https://example.com");
  const [loadedUrl, setLoadedUrl] = createSignal("https://example.com");

  const navigate = () => {
    let target = url();
    if (!target.startsWith("http")) target = `https://${target}`;
    setUrl(target);
    setLoadedUrl(target);
  };

  return (
    <div class="h-full flex flex-col bg-os-window overflow-hidden">
      {/* URL bar */}
      <div class="flex items-center gap-2 px-2 py-1.5 bg-os-window-title border-b border-os-border">
        <button class="px-2 py-1 rounded hover:bg-os-surface-hover text-sm" onClick={() => setLoadedUrl(loadedUrl())}>
          🔄
        </button>
        <input
          type="text"
          value={url()}
          onInput={(e) => setUrl(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") navigate(); }}
          class="flex-1 px-3 py-1 text-xs rounded-lg bg-os-surface border border-os-border text-os-text focus:outline-none focus:border-os-accent"
          placeholder="Enter URL..."
        />
        <button class="px-3 py-1 rounded bg-os-accent text-white text-xs hover:bg-os-accent-hover" onClick={navigate}>
          Go
        </button>
      </div>

      {/* Content */}
      <iframe
        src={loadedUrl()}
        class="flex-1 w-full border-0 bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        title="Browser"
      />
    </div>
  );
};

export default Browser;
