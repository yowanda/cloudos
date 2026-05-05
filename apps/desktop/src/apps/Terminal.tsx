import { Component, createSignal, onMount, For } from "solid-js";

interface HistoryEntry {
  input: string;
  output: string;
}

const Terminal: Component<{ windowId: string }> = () => {
  const [history, setHistory] = createSignal<HistoryEntry[]>([]);
  const [input, setInput] = createSignal("");
  const [cwd, setCwd] = createSignal("~");
  let inputRef!: HTMLInputElement;
  let scrollRef!: HTMLDivElement;

  const username = "user@cloudos";

  onMount(() => {
    setHistory([{
      input: "",
      output: "CloudOS Terminal v0.1.0\nType 'help' for available commands.\n",
    }]);
    inputRef?.focus();
  });

  const executeCommand = (cmd: string) => {
    const parts = cmd.trim().split(/\s+/);
    const command = parts[0]?.toLowerCase() ?? "";
    let output = "";

    switch (command) {
      case "help":
        output = "Available commands:\n  help      - Show this help\n  echo      - Print text\n  clear     - Clear terminal\n  date      - Show current date\n  whoami    - Show username\n  pwd       - Print working directory\n  uname     - System information\n  neofetch  - System info (fancy)\n  ls        - List files (demo)\n  cat       - Read file (demo)";
        break;
      case "echo":
        output = parts.slice(1).join(" ");
        break;
      case "clear":
        setHistory([]);
        setInput("");
        return;
      case "date":
        output = new Date().toString();
        break;
      case "whoami":
        output = "user";
        break;
      case "pwd":
        output = "/home/user";
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
                        Memory: ∞`;
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
      case "":
        break;
      default:
        output = `${command}: command not found. Type 'help' for available commands.`;
    }

    setHistory((prev) => [...prev, { input: cmd, output }]);
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

  return (
    <div
      class="h-full flex flex-col bg-[#0d1117] font-mono text-[13px] text-[#c9d1d9] overflow-hidden"
      onClick={() => inputRef?.focus()}
    >
      <div ref={scrollRef} class="flex-1 overflow-y-auto p-3 space-y-1">
        <For each={history()}>
          {(entry) => (
            <div>
              {entry.input && (
                <div class="flex gap-1">
                  <span class="text-[#58a6ff]">{username}</span>
                  <span class="text-[#8b949e]">:</span>
                  <span class="text-[#7ee787]">{cwd()}</span>
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
          <span class="text-[#7ee787]">{cwd()}</span>
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
