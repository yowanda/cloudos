import { Component } from "solid-js";

const ImageViewer: Component<{ windowId: string }> = () => {
  return (
    <div class="h-full flex flex-col items-center justify-center bg-[#0d0d0d] text-os-text-muted text-sm">
      <span class="text-4xl mb-3">🖼️</span>
      <p>Image Viewer</p>
      <p class="text-xs mt-1 opacity-50">Drag & drop an image or open from File Manager</p>
    </div>
  );
};

export default ImageViewer;
