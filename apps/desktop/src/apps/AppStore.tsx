import { Component, For, createSignal, Show } from "solid-js";
import { notify } from "../stores/notification-store";

interface StoreApp {
  id: string;
  name: string;
  icon: string;
  author: string;
  description: string;
  category: string;
  rating: number;
  installed: boolean;
}

const sampleApps: StoreApp[] = [
  { id: "com.cloudos.weather", name: "Weather", icon: "🌤️", author: "CloudOS", description: "Real-time weather forecasts", category: "Utilities", rating: 4.5, installed: false },
  { id: "com.cloudos.music", name: "Music Player", icon: "🎵", author: "CloudOS", description: "Play your music library", category: "Media", rating: 4.2, installed: false },
  { id: "com.cloudos.photos", name: "Photos", icon: "📸", author: "CloudOS", description: "Photo gallery & editor", category: "Media", rating: 4.7, installed: false },
  { id: "com.cloudos.todo", name: "Todo List", icon: "✅", author: "CloudOS", description: "Task management app", category: "Productivity", rating: 4.3, installed: false },
  { id: "com.cloudos.calendar", name: "Calendar", icon: "📅", author: "CloudOS", description: "Schedule & events", category: "Productivity", rating: 4.1, installed: false },
  { id: "com.cloudos.chat", name: "Chat", icon: "💬", author: "CloudOS", description: "Messaging & communication", category: "Social", rating: 4.4, installed: false },
  { id: "com.cloudos.maps", name: "Maps", icon: "🗺️", author: "CloudOS", description: "Navigation & directions", category: "Utilities", rating: 4.0, installed: false },
  { id: "com.cloudos.clock", name: "Clock", icon: "⏰", author: "CloudOS", description: "World clock, alarms, timer", category: "Utilities", rating: 4.6, installed: false },
  { id: "com.cloudos.paint", name: "Paint", icon: "🎨", author: "CloudOS", description: "Drawing & painting app", category: "Creative", rating: 3.9, installed: false },
  { id: "com.cloudos.video", name: "Video Player", icon: "🎬", author: "CloudOS", description: "Play videos in all formats", category: "Media", rating: 4.3, installed: false },
  { id: "com.cloudos.pdf", name: "PDF Reader", icon: "📕", author: "CloudOS", description: "View & annotate PDFs", category: "Productivity", rating: 4.5, installed: false },
  { id: "com.cloudos.contacts", name: "Contacts", icon: "📇", author: "CloudOS", description: "Address book", category: "Social", rating: 4.0, installed: false },
];

const categories = ["All", "Productivity", "Media", "Utilities", "Social", "Creative"];

const AppStore: Component<{ windowId: string }> = () => {
  const [apps, setApps] = createSignal(sampleApps);
  const [selectedCategory, setSelectedCategory] = createSignal("All");
  const [searchQuery, setSearchQuery] = createSignal("");

  const filteredApps = () => {
    let result = apps();
    if (selectedCategory() !== "All") {
      result = result.filter((a) => a.category === selectedCategory());
    }
    if (searchQuery()) {
      const q = searchQuery().toLowerCase();
      result = result.filter((a) => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
    }
    return result;
  };

  const handleInstall = (appId: string) => {
    setApps((prev) => prev.map((a) => a.id === appId ? { ...a, installed: !a.installed } : a));
    const app = apps().find((a) => a.id === appId);
    if (app) {
      notify({
        title: app.installed ? `${app.name} Installed` : `${app.name} Uninstalled`,
        message: app.installed ? "App is ready to use" : "App has been removed",
        type: app.installed ? "success" : "info",
        icon: app.icon,
      });
    }
  };

  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    let stars = "★".repeat(full);
    if (half) stars += "½";
    return stars;
  };

  return (
    <div class="flex h-full text-xs overflow-hidden">
      {/* Sidebar */}
      <div class="w-36 border-r border-os-border p-2 flex-shrink-0">
        <p class="text-[10px] text-os-text-muted uppercase tracking-wider mb-2 px-2">Categories</p>
        <For each={categories}>
          {(cat) => (
            <button
              class="w-full text-left px-2 py-1.5 rounded-md transition-colors"
              classList={{
                "bg-os-accent/20 text-os-accent-hover": selectedCategory() === cat,
                "hover:bg-os-surface-hover text-os-text": selectedCategory() !== cat,
              }}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          )}
        </For>
      </div>

      {/* Main */}
      <div class="flex-1 flex flex-col overflow-hidden">
        {/* Search */}
        <div class="px-4 py-2 border-b border-os-border">
          <input
            type="text"
            placeholder="Search apps..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="w-full px-3 py-1.5 rounded-lg bg-os-surface border border-os-border text-os-text text-xs focus:outline-none focus:border-os-accent"
          />
        </div>

        {/* App Grid */}
        <div class="flex-1 overflow-y-auto p-4">
          <div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            <For each={filteredApps()}>
              {(app) => (
                <div class="flex flex-col p-3 rounded-xl border border-os-border hover:border-os-accent/30 transition-colors bg-os-surface/30">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-2xl">{app.icon}</span>
                    <div class="flex-1 min-w-0">
                      <p class="font-medium text-os-text truncate">{app.name}</p>
                      <p class="text-[10px] text-os-text-muted">{app.author}</p>
                    </div>
                  </div>
                  <p class="text-os-text-muted mb-2 line-clamp-2">{app.description}</p>
                  <div class="flex items-center justify-between mt-auto">
                    <span class="text-yellow-400 text-[10px]">{renderStars(app.rating)} {app.rating}</span>
                    <button
                      class="px-3 py-1 rounded-lg text-[10px] font-medium transition-colors"
                      classList={{
                        "bg-os-accent text-white hover:bg-os-accent-hover": !app.installed,
                        "bg-os-surface border border-os-border text-os-text-muted hover:bg-os-danger hover:text-white hover:border-os-danger": app.installed,
                      }}
                      onClick={() => handleInstall(app.id)}
                    >
                      {app.installed ? "Uninstall" : "Install"}
                    </button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppStore;
