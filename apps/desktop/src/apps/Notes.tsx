import { Component, createSignal } from "solid-js";

const Notes: Component<{ windowId: string }> = () => {
  const [content, setContent] = createSignal("# My Notes\n\nStart typing here...\n");

  return (
    <div class="h-full flex flex-col bg-[#fffbe6] overflow-hidden">
      <div class="flex items-center h-8 px-3 bg-[#f5f0d0] border-b border-[#e5d99d] text-xs text-[#8a7e42]">
        <span>📒 Quick Notes</span>
      </div>
      <textarea
        value={content()}
        onInput={(e) => setContent(e.currentTarget.value)}
        class="flex-1 p-4 bg-transparent text-[#3d3200] text-sm resize-none focus:outline-none leading-relaxed font-[Georgia,serif]"
        placeholder="Type your notes..."
        spellcheck={false}
      />
    </div>
  );
};

export default Notes;
