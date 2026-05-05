import { Component, For, createSignal, createEffect, onCleanup, Show } from "solid-js";
import { isMobile } from "../stores/viewport-store";

interface Widget {
  id: string;
  title: string;
  icon: string;
  width: number;
  height: number;
  component: Component;
}

const ClockWidget: Component = () => {
  const [time, setTime] = createSignal(new Date());

  createEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    onCleanup(() => clearInterval(timer));
  });

  return (
    <div class="flex flex-col items-center justify-center h-full">
      <div class="text-3xl font-extralight text-os-text">
        {time().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
      <div class="text-[10px] text-os-text-muted mt-1">
        {time().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
      </div>
    </div>
  );
};

const WeatherWidget: Component = () => {
  return (
    <div class="flex flex-col items-center justify-center h-full gap-1">
      <span class="text-3xl">🌤️</span>
      <div class="text-xl font-light text-os-text">24°C</div>
      <div class="text-[10px] text-os-text-muted">Partly Cloudy</div>
      <div class="text-[9px] text-os-text-muted/50">Jakarta, ID</div>
    </div>
  );
};

const SystemWidget: Component = () => {
  const [cpu, setCpu] = createSignal(23);
  const [ram, setRam] = createSignal(45);
  const [disk, setDisk] = createSignal(62);

  createEffect(() => {
    const timer = setInterval(() => {
      setCpu(Math.floor(Math.random() * 30 + 10));
      setRam(Math.floor(Math.random() * 20 + 35));
    }, 3000);
    onCleanup(() => clearInterval(timer));
  });

  const Bar: Component<{ label: string; value: number; color: string }> = (props) => (
    <div class="flex items-center gap-2">
      <span class="text-[10px] text-os-text-muted w-8">{props.label}</span>
      <div class="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all duration-500" style={{ width: `${props.value}%`, background: props.color }} />
      </div>
      <span class="text-[10px] text-os-text-muted w-7 text-right">{props.value}%</span>
    </div>
  );

  return (
    <div class="flex flex-col justify-center h-full gap-2 px-1">
      <p class="text-[10px] text-os-text-muted font-medium">System Monitor</p>
      <Bar label="CPU" value={cpu()} color="#6366f1" />
      <Bar label="RAM" value={ram()} color="#22c55e" />
      <Bar label="Disk" value={disk()} color="#f59e0b" />
    </div>
  );
};

const QuickNotesWidget: Component = () => {
  const [note, setNote] = createSignal(localStorage.getItem("cloudos_quicknote") ?? "");

  const handleInput = (val: string) => {
    setNote(val);
    localStorage.setItem("cloudos_quicknote", val);
  };

  return (
    <div class="flex flex-col h-full">
      <p class="text-[10px] text-os-text-muted font-medium mb-1">Quick Notes</p>
      <textarea
        class="flex-1 bg-transparent text-os-text text-[11px] resize-none focus:outline-none placeholder:text-os-text-muted/30 leading-relaxed"
        placeholder="Type a quick note..."
        value={note()}
        onInput={(e) => handleInput(e.currentTarget.value)}
      />
    </div>
  );
};

const availableWidgets: Widget[] = [
  { id: "clock", title: "Clock", icon: "🕐", width: 160, height: 80, component: ClockWidget },
  { id: "weather", title: "Weather", icon: "🌤️", width: 140, height: 120, component: WeatherWidget },
  { id: "system", title: "System", icon: "📊", width: 200, height: 100, component: SystemWidget },
  { id: "quicknotes", title: "Notes", icon: "📝", width: 180, height: 120, component: QuickNotesWidget },
];

export const DesktopWidgets: Component = () => {
  const [activeWidgets, setActiveWidgets] = createSignal(["clock", "weather", "system"]);

  // Widgets are hidden on mobile — they sit fixed-position next to
  // window content where on a 360 px viewport they'd cover the entire
  // app surface.
  return (
    <Show when={!isMobile()}>
      <div class="absolute top-12 right-3 z-[5] flex flex-col gap-2 pointer-events-auto">
        <For each={activeWidgets()}>
          {(widgetId) => {
            const widget = availableWidgets.find((w) => w.id === widgetId);
            if (!widget) return null;
            return (
              <div
                class="rounded-2xl bg-os-window/80 backdrop-blur-xl border border-os-border/50 p-3 shadow-lg"
                style={{ width: `${widget.width}px`, height: `${widget.height}px` }}
              >
                <widget.component />
              </div>
            );
          }}
        </For>
      </div>
    </Show>
  );
};

export { availableWidgets };
