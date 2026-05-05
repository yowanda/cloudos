import { Component, For, createSignal, Show, createMemo } from "solid-js";
import { notify } from "../stores/notification-store";
import {
  addReview,
  deleteReview,
  ratingFor,
  reviews,
  reviewsFor,
  updateReview,
  type AppRatingStats,
} from "../stores/reviews-store";
import { user } from "../stores/auth-store";

interface StoreApp {
  id: string;
  name: string;
  icon: string;
  author: string;
  description: string;
  category: string;
  installed: boolean;
}

const sampleApps: StoreApp[] = [
  { id: "com.cloudos.weather", name: "Weather", icon: "🌤️", author: "CloudOS", description: "Real-time weather forecasts and 7-day outlook with hourly precipitation, wind, and UV index.", category: "Utilities", installed: false },
  { id: "com.cloudos.music", name: "Music Player", icon: "🎵", author: "CloudOS", description: "Play your music library with playlists, shuffle, and gapless playback.", category: "Media", installed: false },
  { id: "com.cloudos.photos", name: "Photos", icon: "📸", author: "CloudOS", description: "Photo gallery, basic editor, albums, and cloud sync.", category: "Media", installed: false },
  { id: "com.cloudos.todo", name: "Todo List", icon: "✅", author: "CloudOS", description: "Task management with projects, due dates, and reminders.", category: "Productivity", installed: false },
  { id: "com.cloudos.calendar", name: "Calendar", icon: "📅", author: "CloudOS", description: "Schedule meetings, set reminders, and view upcoming events.", category: "Productivity", installed: false },
  { id: "com.cloudos.chat", name: "Chat", icon: "💬", author: "CloudOS", description: "Direct messaging and group chat with reactions and threads.", category: "Social", installed: false },
  { id: "com.cloudos.maps", name: "Maps", icon: "🗺️", author: "CloudOS", description: "Navigation, search, and offline maps for any destination.", category: "Utilities", installed: false },
  { id: "com.cloudos.clock", name: "Clock", icon: "⏰", author: "CloudOS", description: "World clock, alarms, timer, and stopwatch.", category: "Utilities", installed: false },
  { id: "com.cloudos.paint", name: "Paint", icon: "🎨", author: "CloudOS", description: "Drawing, painting, and image editing with brushes and layers.", category: "Creative", installed: false },
  { id: "com.cloudos.video", name: "Video Player", icon: "🎬", author: "CloudOS", description: "Play videos in all formats with subtitle and chapter support.", category: "Media", installed: false },
  { id: "com.cloudos.pdf", name: "PDF Reader", icon: "📕", author: "CloudOS", description: "View, search, and annotate PDF documents.", category: "Productivity", installed: false },
  { id: "com.cloudos.contacts", name: "Contacts", icon: "📇", author: "CloudOS", description: "Address book with groups, vcard import/export, and quick share.", category: "Social", installed: false },
];

const categories = ["All", "Productivity", "Media", "Utilities", "Social", "Creative"];

interface StarsProps {
  value: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (v: number) => void;
}

const Stars: Component<StarsProps> = (props) => {
  const [hover, setHover] = createSignal(0);
  const sz = () => (props.size === "lg" ? "text-base" : props.size === "md" ? "text-sm" : "text-[11px]");
  return (
    <div class="inline-flex items-center gap-0.5">
      <For each={[1, 2, 3, 4, 5]}>
        {(i) => {
          const display = () => (hover() > 0 ? hover() : props.value);
          const filled = () => display() >= i;
          const half = () => !filled() && display() >= i - 0.5;
          return (
            <button
              type="button"
              class={`${sz()} leading-none transition-colors`}
              classList={{
                "text-yellow-400": filled() || half(),
                "text-os-text-muted/40": !filled() && !half(),
                "cursor-pointer hover:scale-110": !!props.interactive,
                "cursor-default": !props.interactive,
              }}
              disabled={!props.interactive}
              onMouseEnter={() => props.interactive && setHover(i)}
              onMouseLeave={() => props.interactive && setHover(0)}
              onClick={() => props.interactive && props.onChange?.(i)}
            >
              {filled() ? "★" : half() ? "☆" : "☆"}
            </button>
          );
        }}
      </For>
    </div>
  );
};

const AppStore: Component<{ windowId: string }> = () => {
  const [apps, setApps] = createSignal(sampleApps);
  const [selectedCategory, setSelectedCategory] = createSignal("All");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [openAppId, setOpenAppId] = createSignal<string | null>(null);

  // review form state
  const [reviewRating, setReviewRating] = createSignal(0);
  const [reviewText, setReviewText] = createSignal("");
  const [editingId, setEditingId] = createSignal<string | null>(null);

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
    setApps((prev) => prev.map((a) => (a.id === appId ? { ...a, installed: !a.installed } : a)));
    const app = apps().find((a) => a.id === appId);
    if (app) {
      notify({
        title: !app.installed ? `${app.name} Installed` : `${app.name} Uninstalled`,
        message: !app.installed ? "App is ready to use" : "App has been removed",
        type: !app.installed ? "success" : "info",
        icon: app.icon,
      });
    }
  };

  const openApp = (appId: string) => {
    setOpenAppId(appId);
    setReviewRating(0);
    setReviewText("");
    setEditingId(null);
  };

  const closeApp = () => {
    setOpenAppId(null);
    setEditingId(null);
  };

  const detailApp = createMemo(() => apps().find((a) => a.id === openAppId()) ?? null);
  // re-run when reviews() changes
  const detailStats = createMemo<AppRatingStats | null>(() => {
    const id = openAppId();
    void reviews();
    return id ? ratingFor(id) : null;
  });
  const detailReviews = createMemo(() => {
    const id = openAppId();
    void reviews();
    return id ? reviewsFor(id) : [];
  });

  const submitReview = () => {
    const id = openAppId();
    if (!id) return;
    if (reviewRating() < 1) {
      notify({ title: "Pick a rating", message: "Tap 1–5 stars before submitting", type: "warning", icon: "⭐" });
      return;
    }
    const author = user()?.username ?? user()?.email?.split("@")[0] ?? "Guest";
    const editId = editingId();
    if (editId) {
      updateReview(editId, { rating: reviewRating(), text: reviewText() });
      notify({ title: "Review updated", message: detailApp()?.name ?? "", type: "success", icon: "✏️" });
    } else {
      addReview({ appId: id, author, rating: reviewRating(), text: reviewText() });
      notify({ title: "Review posted", message: detailApp()?.name ?? "", type: "success", icon: "⭐" });
    }
    setReviewRating(0);
    setReviewText("");
    setEditingId(null);
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
          <div class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            <For each={filteredApps()}>
              {(app) => {
                const stats = createMemo<AppRatingStats>(() => {
                  void reviews();
                  return ratingFor(app.id);
                });
                return (
                  <div
                    class="flex flex-col p-3 rounded-xl border border-os-border hover:border-os-accent/30 transition-colors bg-os-surface/30 cursor-pointer"
                    onClick={() => openApp(app.id)}
                  >
                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-2xl">{app.icon}</span>
                      <div class="flex-1 min-w-0">
                        <p class="font-medium text-os-text truncate">{app.name}</p>
                        <p class="text-[10px] text-os-text-muted">{app.author}</p>
                      </div>
                    </div>
                    <p class="text-os-text-muted mb-2 line-clamp-2">{app.description}</p>
                    <div class="flex items-center justify-between mt-auto gap-2">
                      <div class="flex items-center gap-1 min-w-0">
                        <Stars value={stats().average} size="sm" />
                        <span class="text-[10px] text-os-text-muted">
                          {stats().count > 0 ? `${stats().average.toFixed(1)} (${stats().count})` : "No reviews"}
                        </span>
                      </div>
                      <button
                        class="px-3 py-1 rounded-lg text-[10px] font-medium transition-colors flex-shrink-0"
                        classList={{
                          "bg-os-accent text-white hover:bg-os-accent-hover": !app.installed,
                          "bg-os-surface border border-os-border text-os-text-muted hover:bg-os-danger hover:text-white hover:border-os-danger": app.installed,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInstall(app.id);
                        }}
                      >
                        {app.installed ? "Uninstall" : "Install"}
                      </button>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      <Show when={detailApp()}>
        {(app) => (
          <div
            class="absolute inset-0 z-20 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={closeApp}
          >
            <div
              class="w-full max-w-2xl max-h-full overflow-hidden rounded-xl bg-os-window border border-os-border shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div class="flex items-start gap-3 p-4 border-b border-os-border">
                <span class="text-4xl">{app().icon}</span>
                <div class="flex-1 min-w-0">
                  <h2 class="text-base font-semibold">{app().name}</h2>
                  <p class="text-[11px] text-os-text-muted">{app().author} · {app().category}</p>
                  <div class="flex items-center gap-2 mt-1">
                    <Stars value={detailStats()?.average ?? 0} size="md" />
                    <span class="text-[11px] text-os-text-muted">
                      {detailStats()?.count
                        ? `${detailStats()?.average.toFixed(1)} from ${detailStats()?.count} review${(detailStats()?.count ?? 0) === 1 ? "" : "s"}`
                        : "No reviews yet"}
                    </span>
                  </div>
                </div>
                <button
                  class="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors flex-shrink-0"
                  classList={{
                    "bg-os-accent text-white hover:bg-os-accent-hover": !app().installed,
                    "bg-os-surface border border-os-border hover:bg-os-danger hover:text-white hover:border-os-danger": app().installed,
                  }}
                  onClick={() => handleInstall(app().id)}
                >
                  {app().installed ? "Uninstall" : "Install"}
                </button>
                <button class="text-os-text-muted hover:text-os-text px-1" onClick={closeApp}>✕</button>
              </div>

              {/* Body */}
              <div class="flex-1 overflow-y-auto p-4 space-y-4">
                <p class="text-os-text">{app().description}</p>

                {/* Rating histogram */}
                <Show when={(detailStats()?.count ?? 0) > 0}>
                  <div class="space-y-1">
                    <For each={[5, 4, 3, 2, 1] as const}>
                      {(n) => {
                        const stats = detailStats();
                        const count = stats?.histogram[n] ?? 0;
                        const total = stats?.count ?? 0;
                        const pct = total > 0 ? (count / total) * 100 : 0;
                        return (
                          <div class="flex items-center gap-2">
                            <span class="w-6 text-[10px] text-os-text-muted">{n}★</span>
                            <div class="flex-1 h-1.5 rounded-full bg-os-surface overflow-hidden">
                              <div class="h-full bg-yellow-400" style={{ width: `${pct}%` }} />
                            </div>
                            <span class="w-8 text-right text-[10px] text-os-text-muted">{count}</span>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </Show>

                {/* Write review form */}
                <div class="rounded-lg border border-os-border p-3">
                  <p class="text-[11px] text-os-text-muted mb-2">{editingId() ? "Edit your review" : "Write a review"}</p>
                  <div class="flex items-center gap-2 mb-2">
                    <Stars value={reviewRating()} size="lg" interactive onChange={setReviewRating} />
                    <span class="text-[10px] text-os-text-muted">{reviewRating() > 0 ? `${reviewRating()}/5` : "Tap a star"}</span>
                  </div>
                  <textarea
                    value={reviewText()}
                    onInput={(e) => setReviewText(e.currentTarget.value)}
                    placeholder="Share your thoughts (optional)"
                    class="w-full h-20 resize-none px-2 py-1.5 rounded bg-os-surface border border-os-border text-xs focus:outline-none focus:border-os-accent"
                  />
                  <div class="flex justify-end gap-2 mt-2">
                    <Show when={editingId()}>
                      <button
                        class="px-3 py-1.5 rounded text-[11px] hover:bg-os-surface-hover transition-colors"
                        onClick={() => {
                          setEditingId(null);
                          setReviewRating(0);
                          setReviewText("");
                        }}
                      >
                        Cancel
                      </button>
                    </Show>
                    <button
                      class="px-3 py-1.5 rounded bg-os-accent text-white text-[11px] hover:bg-os-accent-hover transition-colors disabled:opacity-30"
                      disabled={reviewRating() < 1}
                      onClick={submitReview}
                    >
                      {editingId() ? "Save" : "Post"}
                    </button>
                  </div>
                </div>

                {/* Reviews list */}
                <div class="space-y-2">
                  <p class="text-[11px] text-os-text-muted">Reviews</p>
                  <Show when={detailReviews().length > 0} fallback={
                    <p class="text-[11px] text-os-text-muted">Be the first to leave a review.</p>
                  }>
                    <For each={detailReviews()}>
                      {(r) => {
                        const isMine = () =>
                          r.author === (user()?.username ?? user()?.email?.split("@")[0] ?? "Guest");
                        return (
                          <div class="rounded-lg border border-os-border p-3">
                            <div class="flex items-center justify-between mb-1">
                              <div class="flex items-center gap-2">
                                <Stars value={r.rating} size="sm" />
                                <span class="text-[11px] font-medium">{r.author}</span>
                              </div>
                              <Show when={isMine()}>
                                <div class="flex items-center gap-1">
                                  <button
                                    class="text-[10px] px-2 py-0.5 rounded hover:bg-os-surface-hover transition-colors"
                                    onClick={() => {
                                      setEditingId(r.id);
                                      setReviewRating(r.rating);
                                      setReviewText(r.text);
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    class="text-[10px] px-2 py-0.5 rounded hover:bg-os-danger/20 hover:text-os-danger transition-colors"
                                    onClick={() => deleteReview(r.id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </Show>
                            </div>
                            <Show when={r.text}>
                              <p class="text-os-text whitespace-pre-wrap">{r.text}</p>
                            </Show>
                            <p class="text-[10px] text-os-text-muted mt-1">
                              {new Date(r.timestamp).toLocaleString()}
                            </p>
                          </div>
                        );
                      }}
                    </For>
                  </Show>
                </div>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
};

export default AppStore;
