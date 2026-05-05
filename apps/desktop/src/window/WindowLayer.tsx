import { Component, For } from "solid-js";
import { currentDesktopWindows } from "../stores/window-store";
import Window from "./Window";

export const WindowLayer: Component = () => {
  return (
    <div class="absolute inset-0 z-10 pointer-events-none">
      <For each={currentDesktopWindows()}>
        {(win) => (
          <div class="pointer-events-auto">
            <Window config={win} />
          </div>
        )}
      </For>
    </div>
  );
};
