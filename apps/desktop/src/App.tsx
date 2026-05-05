import { Component } from "solid-js";
import Desktop from "./shell/Desktop";
import Taskbar from "./shell/Taskbar";
import Dock from "./shell/Dock";
import { WindowLayer } from "./window/WindowLayer";
import { ContextMenuLayer } from "./shell/ContextMenu";
import { StartMenu } from "./shell/StartMenu";

const App: Component = () => {
  return (
    <div class="relative w-full h-full overflow-hidden bg-os-bg">
      <Desktop />
      <WindowLayer />
      <StartMenu />
      <ContextMenuLayer />
      <Taskbar />
      <Dock />
    </div>
  );
};

export default App;
