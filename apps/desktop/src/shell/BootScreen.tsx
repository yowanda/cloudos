import { Component, createSignal, onMount, Show } from "solid-js";

const BootScreen: Component<{ onComplete: () => void }> = (props) => {
  const [progress, setProgress] = createSignal(0);
  const [status, setStatus] = createSignal("Initializing...");
  const [fadeOut, setFadeOut] = createSignal(false);

  const bootSteps = [
    { at: 10, text: "Loading kernel modules..." },
    { at: 25, text: "Mounting file systems..." },
    { at: 40, text: "Starting services..." },
    { at: 55, text: "Initializing window manager..." },
    { at: 70, text: "Loading desktop environment..." },
    { at: 85, text: "Starting system apps..." },
    { at: 95, text: "Almost ready..." },
    { at: 100, text: "Welcome to CloudOS" },
  ];

  onMount(() => {
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 4 + 1;
      if (p > 100) p = 100;
      setProgress(p);

      const step = [...bootSteps].reverse().find((s) => p >= s.at);
      if (step) setStatus(step.text);

      if (p >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setFadeOut(true);
          setTimeout(() => props.onComplete(), 500);
        }, 400);
      }
    }, 60);
  });

  return (
    <div
      class="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-[#0a0a14] transition-opacity duration-500"
      classList={{ "opacity-0": fadeOut() }}
    >
      {/* Logo */}
      <div class="mb-8 flex flex-col items-center">
        <div class="text-5xl mb-3 animate-pulse">☁️</div>
        <h1 class="text-2xl font-light text-white/90 tracking-[0.3em]">CLOUD<span class="font-semibold">OS</span></h1>
        <p class="text-[10px] text-white/30 mt-1 tracking-widest">BROWSER OPERATING SYSTEM</p>
      </div>

      {/* Progress bar */}
      <div class="w-48 h-[2px] bg-white/10 rounded-full overflow-hidden mb-3">
        <div
          class="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-100"
          style={{ width: `${progress()}%` }}
        />
      </div>

      {/* Status text */}
      <p class="text-[11px] text-white/40 h-4">{status()}</p>
    </div>
  );
};

export default BootScreen;
