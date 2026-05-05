import { Component, createSignal, onMount, For, Show } from "solid-js";
import { createStore, produce } from "solid-js/store";

interface HistoryEntry {
  input: string;
  output: string;
}

interface Tab {
  id: number;
  title: string;
  history: HistoryEntry[];
  cwd: string;
}

let tabId = 0;

function createTab(): Tab {
  return {
    id: ++tabId,
    title: `Terminal ${tabId}`,
    history: [{ input: "", output: "CloudOS Terminal v0.1.0\nType 'help' for available commands.\n" }],
    cwd: "~",
  };
}

const Terminal: Component<{ windowId: string }> = () => {
  const [tabs, setTabs] = createStore<Tab[]>([createTab()]);
  const [activeTabId, setActiveTabId] = createSignal(tabs[0].id);
  const [input, setInput] = createSignal("");
  let inputRef!: HTMLInputElement;
  let scrollRef!: HTMLDivElement;

  const username = "user@cloudos";

  const activeTab = () => tabs.find((t) => t.id === activeTabId())!;

  onMount(() => inputRef?.focus());

  const executeCommand = (cmd: string) => {
    const parts = cmd.trim().split(/\s+/);
    const command = parts[0]?.toLowerCase() ?? "";
    let output = "";

    switch (command) {
      case "help":
        output = "Available commands:\n  help      - Show this help\n  echo      - Print text\n  clear     - Clear terminal\n  date      - Show current date\n  whoami    - Show username\n  pwd       - Print working directory\n  uname     - System information\n  neofetch  - System info (fancy)\n  ls        - List files (demo)\n  cat       - Read file (demo)\n  cd        - Change directory (demo)\n  history   - Show command history\n  uptime    - Show uptime";
        break;
      case "echo":
        output = parts.slice(1).join(" ");
        break;
      case "clear":
        setTabs(
          (t) => t.id === activeTabId(),
          "history",
          [],
        );
        setInput("");
        return;
      case "date":
        output = new Date().toString();
        break;
      case "whoami":
        output = "user";
        break;
      case "pwd":
        output = activeTab().cwd === "~" ? "/home/user" : activeTab().cwd;
        break;
      case "uname":
        output = parts[1] === "-a"
          ? "CloudOS 0.1.0 Browser x86_64 CloudOS"
          : "CloudOS";
        break;
      case "neofetch":
        output = `       ╭──────────╮
       │ CloudOS  │    user@cloudos
       │  ☁️  OS  │    -----------
       │          │    OS: CloudOS 0.1.0
       ╰──────────╯    Host: Browser
                        Kernel: SolidJS
                        Shell: cloudsh 0.1
                        Terminal: WebTerminal
                        CPU: Your Browser
                        Memory: ${Math.round(performance.memory?.usedJSHeapSize / 1024 / 1024 || 0)}MB`;
        break;
      case "ls":
        output = "Documents  Downloads  Pictures  Music  Videos  Desktop";
        break;
      case "cat":
        if (parts[1]) {
          output = `cat: ${parts[1]}: connect to backend for real file access`;
        } else {
          output = "cat: missing file operand";
        }
        break;
      case "cd":
        if (parts[1]) {
          const target = parts[1] === "~" ? "~" : parts[1] === ".." ? "~" : parts[1];
          setTabs((t) => t.id === activeTabId(), "cwd", target);
          output = "";
        } else {
          setTabs((t) => t.id === activeTabId(), "cwd", "~");
          output = "";
        }
        break;
      case "history":
        output = activeTab().history
          .filter((h) => h.input)
          .map((h, i) => `  ${i + 1}  ${h.input}`)
          .join("\n") || "(empty)";
        break;
      case "uptime":
        const secs = Math.floor(performance.now() / 1000);
        const mins = Math.floor(secs / 60);
        const hrs = Math.floor(mins / 60);
        output = `up ${hrs}h ${mins % 60}m ${secs % 60}s`;
        break;
      case "":
        break;
      default:
        output = `${command}: command not found. Type 'help' for available commands.`;
    }

    setTabs(
      (t) => t.id === activeTabId(),
      "history",
      produce((h: HistoryEntry[]) => h.push({ input: cmd, output })),
    );
    setInput("");

    requestAnimationFrame(() => {
      scrollRef?.scrollTo(0, scrollRef.scrollHeight);
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      executeCommand(input());
    }
  };

  const addTab = () => {
    const tab = createTab();
    setTabs(produce((t: Tab[]) => t.push(tab)));
    setActiveTabId(tab.id);
  };

  const closeTab = (id: number) => {
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex((t) => t.id === id);
    setTabs(produce((t: Tab[]) => t.splice(idx, 1)));
    if (activeTabId() === id) {
      setActiveTabId(tabs[Math.max(0, idx - 1)]?.id ?? tabs[0].id);
    }
  };

  return (
    <div
      class="h-full flex flex-col bg-[#0d1117] font-mono text-[13px] text-[#c9d1d9] overflow-hidden"
      onClick={() => inputRef?.focus()}
    >
      {/* Tab Bar */}
      <div class="flex items-center bg-[#161b22] border-b border-[#30363d] text-xs min-h-[28px]">
        <For each={tabs}>
          {(tab) => (
            <div
              class="flex items-center gap-1 px-3 py-1.5 cursor-pointer border-r border-[#30363d] max-w-[150px] transition-colors"
              classList={{
                "bg-[#0d1117] text-[#c9d1d9]": activeTabId() === tab.id,
                "text-[#8b949e] hover:bg-[#1c2128]": activeTabId() !== tab.id,
              }}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span class="truncate">{tab.title}</span>
              <Show when={tabs.length > 1}>
                <button
                  class="ml-1 text-[10px] text-[#8b949e] hover:text-white rounded hover:bg-white/10 w-4 h-4 flex items-center justify-center"
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                >
                  ×
                </button>
              </Show>
            </div>
          )}
        </For>
        <button
          class="px-2 py-1 text-[#8b949e] hover:text-white hover:bg-[#1c2128] transition-colors"
          onClick={addTab}
          title="New tab"
        >
          +
        </button>
      </div>

      {/* Terminal Content */}
      <div ref={scrollRef} class="flex-1 overflow-y-auto p-3 space-y-1">
        <For each={activeTab().history}>
          {(entry) => (
            <div>
              {entry.input && (
                <div class="flex gap-1">
                  <span class="text-[#58a6ff]">{username}</span>
                  <span class="text-[#8b949e]">:</span>
                  <span class="text-[#7ee787]">{activeTab().cwd}</span>
                  <span class="text-[#8b949e]">$</span>
                  <span class="ml-1">{entry.input}</span>
                </div>
              )}
              {entry.output && (
                <pre class="whitespace-pre-wrap text-[#8b949e] mt-0.5">{entry.output}</pre>
              )}
            </div>
          )}
        </For>

        {/* Active prompt */}
        <div class="flex gap-1 items-center">
          <span class="text-[#58a6ff]">{username}</span>
          <span class="text-[#8b949e]">:</span>
          <span class="text-[#7ee787]">{activeTab().cwd}</span>
          <span class="text-[#8b949e]">$</span>
          <input
            ref={inputRef}
            type="text"
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            class="flex-1 ml-1 bg-transparent text-[#c9d1d9] focus:outline-none caret-[#58a6ff]"
            spellcheck={false}
            autocomplete="off"
          />
        </div>
      </div>
    </div>
  );
};

export default Terminal;
