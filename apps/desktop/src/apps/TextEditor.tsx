import { Component, createSignal } from "solid-js";

const TextEditor: Component<{ windowId: string }> = () => {
  const [content, setContent] = createSignal("// Welcome to CloudOS Editor\n// Start typing...\n\nfunction hello() {\n  console.log('Hello, CloudOS!');\n}\n\nhello();\n");
  const [fileName, setFileName] = createSignal("untitled.js");
  const [modified, setModified] = createSignal(false);
  const [lineCount, setLineCount] = createSignal(9);

  const handleInput = (value: string) => {
    setContent(value);
    setModified(true);
    setLineCount(value.split("\n").length);
  };

  const lines = () => Array.from({ length: lineCount() }, (_, i) => i + 1);

  return (
    <div class="h-full flex flex-col bg-[#1e1e2e] text-[13px] font-mono overflow-hidden">
      {/* Tab bar */}
      <div class="flex items-center h-8 bg-[#181825] border-b border-[#313244] px-2">
        <div class="flex items-center gap-1 px-3 py-1 bg-[#1e1e2e] rounded-t text-[#cdd6f4] text-xs border border-b-0 border-[#313244]">
          <span>📜</span>
          <span>{fileName()}</span>
          {modified() && <span class="w-2 h-2 rounded-full bg-os-accent ml-1" />}
        </div>
      </div>

      {/* Editor area */}
      <div class="flex-1 flex overflow-hidden">
        {/* Line numbers */}
        <div class="w-12 flex-shrink-0 bg-[#181825] text-[#6c7086] text-right py-2 pr-3 select-none overflow-hidden">
          {lines().map((n) => (
            <div class="h-[20px] leading-[20px]">{n}</div>
          ))}
        </div>

        {/* Code area */}
        <textarea
          value={content()}
          onInput={(e) => handleInput(e.currentTarget.value)}
          class="flex-1 bg-transparent text-[#cdd6f4] p-2 resize-none focus:outline-none leading-[20px] overflow-auto"
          spellcheck={false}
          style={{ "tab-size": "2" }}
        />
      </div>

      {/* Status bar */}
      <div class="flex items-center h-6 px-3 bg-[#181825] border-t border-[#313244] text-[10px] text-[#6c7086] gap-4">
        <span>JavaScript</span>
        <span>UTF-8</span>
        <span>Ln {lineCount()}</span>
        <span class="ml-auto">{modified() ? "Modified" : "Saved"}</span>
      </div>
    </div>
  );
};

export default TextEditor;
