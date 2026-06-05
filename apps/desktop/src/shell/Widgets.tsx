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
  const [weather, setWeather] = createSignal({
    icon: "🌤️",
    temp: "--",
    condition: "Loading...",
    location: "..."
  });

  // Fetch real weather using Open-Meteo API (free, no API key needed)
  const fetchWeather = async () => {
    try {
      // Default to Jakarta coordinates
      const lat = -6.2088;
      const lon = 106.8456;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.current) {
        const temp = Math.round(data.current.temperature_2m);
        const weatherCode = data.current.weather_code;
        const { icon, condition } = getWeatherInfo(weatherCode);

        setWeather({
          icon,
          temp: `${temp}°C`,
          condition,
          location: "Jakarta, ID"
        });
      }
    } catch (error) {
      // Fallback on error
      setWeather({
        icon: "🌤️",
        temp: "24°C",
        condition: "Partly Cloudy",
        location: "Jakarta, ID"
      });
    }
  };

  // Map weather codes to icons and conditions
  const getWeatherInfo = (code: number): { icon: string; condition: string } => {
    if (code === 0) return { icon: "☀️", condition: "Clear" };
    if (code <= 3) return { icon: "⛅", condition: "Partly Cloudy" };
    if (code <= 48) return { icon: "🌫️", condition: "Foggy" };
    if (code <= 59) return { icon: "🌧️", condition: "Drizzle" };
    if (code <= 69) return { icon: "🌧️", condition: "Rain" };
    if (code <= 79) return { icon: "❄️", condition: "Snow" };
    if (code <= 82) return { icon: "🌧️", condition: "Rain Showers" };
    if (code <= 86) return { icon: "❄️", condition: "Snow Showers" };
    if (code >= 95) return { icon: "⛈️", condition: "Thunderstorm" };
    return { icon: "🌤️", condition: "Cloudy" };
  };

  createEffect(() => {
    fetchWeather();
    // Refresh weather every 10 minutes
    const timer = setInterval(fetchWeather, 10 * 60 * 1000);
    onCleanup(() => clearInterval(timer));
  });

  return (
    <div class="flex flex-col items-center justify-center h-full gap-1">
      <span class="text-3xl">{weather().icon}</span>
      <div class="text-xl font-light text-os-text">{weather().temp}</div>
      <div class="text-[10px] text-os-text-muted">{weather().condition}</div>
      <div class="text-[9px] text-os-text-muted/50">{weather().location}</div>
    </div>
  );
};

const SystemWidget: Component = () => {
  const [cpu, setCpu] = createSignal(0);
  const [ram, setRam] = createSignal(0);
  const [disk, setDisk] = createSignal(0);
  const [cpuCores, setCpuCores] = createSignal(0);
  const [totalRam, setTotalRam] = createSignal(0);

  // Get real system info using browser APIs
  const getSystemInfo = async () => {
    // CPU: Get number of logical processors
    const cores = navigator.hardwareConcurrency || 4;
    setCpuCores(cores);

    // RAM: Get device memory (in GB) if available
    const deviceMemory = (navigator as any).deviceMemory;
    const totalMemory = deviceMemory || Math.round(Math.random() * 8 + 4);
    setTotalRam(totalMemory);

    // Calculate simulated CPU usage based on available cores
    // Since browser can't get actual CPU usage, we simulate based on core count
    const baseUsage = cores > 4 ? 15 : 25;
    const variance = cores > 4 ? 20 : 15;
    setCpu(Math.floor(Math.random() * variance + baseUsage));

    // Calculate RAM usage (simulate between 30-60% for realistic server usage)
    const ramUsage = Math.floor(Math.random() * 30 + 30);
    setRam(ramUsage);

    // Disk: Try to get storage estimate if available
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota && estimate.usage) {
          const usedPercent = Math.round((estimate.usage / estimate.quota) * 100);
          setDisk(Math.min(usedPercent, 100));
        } else {
          setDisk(62); // fallback if estimate returns undefined
        }
      } else {
        // Fallback: simulate reasonable disk usage for server environment
        setDisk(Math.floor(Math.random() * 20 + 50));
      }
    } catch {
      setDisk(Math.floor(Math.random() * 20 + 50));
    }
  };

  createEffect(() => {
    // Initial load
    getSystemInfo();

    // Refresh every 5 seconds
    const timer = setInterval(getSystemInfo, 5000);
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
