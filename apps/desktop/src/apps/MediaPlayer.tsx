import { Component, For, Show, createSignal, createEffect, onCleanup } from "solid-js";

type MediaKind = "audio" | "video";
type RepeatMode = "off" | "all" | "one";

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  kind: MediaKind;
  src: string;
  poster?: string;
  /** human-readable duration estimate; replaced once metadata loads */
  duration?: string;
}

const sampleTracks: Track[] = [
  {
    id: "audio-1",
    title: "SoundHelix Song 1",
    artist: "T. Schürger",
    album: "SoundHelix",
    kind: "audio",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  },
  {
    id: "audio-2",
    title: "SoundHelix Song 5",
    artist: "T. Schürger",
    album: "SoundHelix",
    kind: "audio",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
  },
  {
    id: "audio-3",
    title: "SoundHelix Song 7",
    artist: "T. Schürger",
    album: "SoundHelix",
    kind: "audio",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
  },
  {
    id: "video-1",
    title: "Big Buck Bunny",
    artist: "Blender Foundation",
    album: "Sample Videos",
    kind: "video",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    poster: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg",
  },
  {
    id: "video-2",
    title: "Elephants Dream",
    artist: "Blender Foundation",
    album: "Sample Videos",
    kind: "video",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    poster: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg",
  },
  {
    id: "video-3",
    title: "Sintel",
    artist: "Blender Foundation",
    album: "Sample Videos",
    kind: "video",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
    poster: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg",
  },
];

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const MediaPlayer: Component<{ windowId: string }> = () => {
  const [playlist, setPlaylist] = createSignal<Track[]>([...sampleTracks]);
  const [currentIndex, setCurrentIndex] = createSignal<number>(-1);
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [currentTime, setCurrentTime] = createSignal(0);
  const [duration, setDuration] = createSignal(0);
  const [volume, setVolume] = createSignal(0.7);
  const [muted, setMuted] = createSignal(false);
  const [shuffle, setShuffle] = createSignal(false);
  const [repeat, setRepeat] = createSignal<RepeatMode>("off");
  const [filter, setFilter] = createSignal<"all" | "audio" | "video">("all");
  const [search, setSearch] = createSignal("");
  const [playOrder, setPlayOrder] = createSignal<number[]>([]);

  let mediaEl: HTMLAudioElement | HTMLVideoElement | undefined;

  const currentTrack = () => {
    const idx = currentIndex();
    if (idx < 0) return null;
    return playlist()[idx] ?? null;
  };

  const filteredPlaylist = () => {
    const f = filter();
    const q = search().toLowerCase().trim();
    return playlist().filter((t) => {
      if (f !== "all" && t.kind !== f) return false;
      if (q && !`${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(q)) return false;
      return true;
    });
  };

  const buildShuffleOrder = () => {
    const len = playlist().length;
    const order = Array.from({ length: len }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    setPlayOrder(order);
  };

  const playTrack = (track: Track) => {
    const idx = playlist().findIndex((t) => t.id === track.id);
    if (idx < 0) return;
    setCurrentIndex(idx);
    setIsPlaying(true);
    queueMicrotask(() => mediaEl?.play().catch(() => setIsPlaying(false)));
  };

  const togglePlay = () => {
    if (!mediaEl || currentIndex() < 0) return;
    if (mediaEl.paused) {
      setIsPlaying(true);
      mediaEl.play().catch(() => setIsPlaying(false));
    } else {
      setIsPlaying(false);
      mediaEl.pause();
    }
  };

  const seek = (pct: number) => {
    if (!mediaEl) return;
    const d = duration();
    if (!d) return;
    mediaEl.currentTime = (pct / 100) * d;
  };

  const stepIndex = (dir: 1 | -1) => {
    const len = playlist().length;
    if (len === 0) return;
    if (shuffle()) {
      let order = playOrder();
      if (order.length !== len) {
        buildShuffleOrder();
        order = playOrder();
      }
      const pos = order.indexOf(currentIndex());
      const nextPos = (pos + dir + order.length) % order.length;
      setCurrentIndex(order[nextPos]);
    } else {
      const next = (currentIndex() + dir + len) % len;
      setCurrentIndex(next);
    }
    setIsPlaying(true);
    queueMicrotask(() => mediaEl?.play().catch(() => setIsPlaying(false)));
  };

  const handleEnded = () => {
    if (repeat() === "one") {
      if (mediaEl) {
        mediaEl.currentTime = 0;
        mediaEl.play().catch(() => setIsPlaying(false));
      }
      return;
    }
    if (repeat() === "all") {
      stepIndex(1);
      return;
    }
    // off: stop at end of playlist
    const len = playlist().length;
    if (currentIndex() < len - 1) {
      stepIndex(1);
    } else {
      setIsPlaying(false);
    }
  };

  // Sync volume/muted to element
  createEffect(() => {
    if (!mediaEl) return;
    mediaEl.volume = volume();
    mediaEl.muted = muted();
  });

  // Re-shuffle when shuffle toggled or playlist size changes
  createEffect(() => {
    if (shuffle()) buildShuffleOrder();
  });

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const added: Track[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const isVideo = f.type.startsWith("video/");
      const isAudio = f.type.startsWith("audio/");
      if (!isVideo && !isAudio) continue;
      const url = URL.createObjectURL(f);
      added.push({
        id: `local-${Date.now()}-${i}`,
        title: f.name.replace(/\.[^.]+$/, ""),
        artist: "Local file",
        album: "Local",
        kind: isVideo ? "video" : "audio",
        src: url,
      });
    }
    if (added.length > 0) {
      setPlaylist([...playlist(), ...added]);
    }
  };

  onCleanup(() => {
    // Revoke any blob: URLs we created
    for (const t of playlist()) {
      if (t.src.startsWith("blob:")) URL.revokeObjectURL(t.src);
    }
  });

  const onTimeUpdate = () => {
    if (!mediaEl) return;
    setCurrentTime(mediaEl.currentTime);
  };

  const onLoadedMetadata = () => {
    if (!mediaEl) return;
    setDuration(mediaEl.duration || 0);
  };

  const onPlay = () => setIsPlaying(true);
  const onPause = () => setIsPlaying(false);

  const repeatIcon = () => (repeat() === "one" ? "🔂" : repeat() === "all" ? "🔁" : "↻");
  const cycleRepeat = () =>
    setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"));

  return (
    <div class="flex flex-col h-full bg-gradient-to-b from-[#1a1a2e] to-[#16213e] text-white overflow-hidden">
      {/* Top: Media canvas + Library */}
      <div class="flex-1 flex min-h-0">
        {/* Library sidebar */}
        <div class="w-60 border-r border-white/10 flex flex-col">
          <div class="p-3 border-b border-white/10 flex items-center gap-2">
            <input
              type="text"
              placeholder="Search..."
              value={search()}
              onInput={(e) => setSearch(e.currentTarget.value)}
              class="flex-1 px-2 py-1 text-[11px] rounded bg-white/5 border border-white/10 placeholder:text-white/30 focus:outline-none focus:border-os-accent"
            />
            <label class="px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer text-[11px]" title="Add files">
              +
              <input
                type="file"
                accept="audio/*,video/*"
                multiple
                class="hidden"
                onChange={(e) => handleFiles(e.currentTarget.files)}
              />
            </label>
          </div>
          <div class="flex border-b border-white/10 text-[11px]">
            <For each={[
              { v: "all" as const, label: "All" },
              { v: "audio" as const, label: "Audio" },
              { v: "video" as const, label: "Video" },
            ]}>
              {(opt) => (
                <button
                  class="flex-1 py-1.5 transition-colors"
                  classList={{
                    "bg-white/10": filter() === opt.v,
                    "hover:bg-white/5": filter() !== opt.v,
                  }}
                  onClick={() => setFilter(opt.v)}
                >
                  {opt.label}
                </button>
              )}
            </For>
          </div>
          <div class="flex-1 overflow-y-auto">
            <Show when={filteredPlaylist().length > 0} fallback={
              <div class="p-3 text-center text-[11px] text-white/40">No tracks</div>
            }>
              <For each={filteredPlaylist()}>
                {(track) => (
                  <div
                    class="flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors"
                    classList={{
                      "bg-os-accent/30": currentTrack()?.id === track.id,
                      "hover:bg-white/5": currentTrack()?.id !== track.id,
                    }}
                    onDblClick={() => playTrack(track)}
                    onClick={() => playTrack(track)}
                  >
                    <span class="text-sm">{track.kind === "video" ? "🎬" : "🎵"}</span>
                    <div class="flex-1 min-w-0">
                      <p class="text-[11px] font-medium truncate">{track.title}</p>
                      <p class="text-[9px] text-white/40 truncate">{track.artist}</p>
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>

        {/* Media canvas */}
        <div
          class="flex-1 flex items-center justify-center min-h-0 relative"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer?.files ?? null);
          }}
        >
          <Show when={currentTrack()} fallback={
            <div class="text-white/30 text-xs text-center px-6">
              <div class="text-3xl mb-2 opacity-50">🎬</div>
              Pick a track from the library, or drop an audio/video file here.
            </div>
          }>
            {(t) => (
              <Show
                when={t().kind === "video"}
                fallback={
                  <>
                    <audio
                      ref={(el) => (mediaEl = el)}
                      src={t().src}
                      preload="metadata"
                      onTimeUpdate={onTimeUpdate}
                      onLoadedMetadata={onLoadedMetadata}
                      onPlay={onPlay}
                      onPause={onPause}
                      onEnded={handleEnded}
                    />
                    <div class="text-center px-8">
                      <div class="text-7xl mb-4 select-none">🎵</div>
                      <p class="text-base font-semibold">{t().title}</p>
                      <p class="text-xs text-white/50">{t().artist} · {t().album}</p>
                    </div>
                  </>
                }
              >
                <video
                  ref={(el) => (mediaEl = el)}
                  src={t().src}
                  poster={t().poster}
                  preload="metadata"
                  class="max-w-full max-h-full"
                  onTimeUpdate={onTimeUpdate}
                  onLoadedMetadata={onLoadedMetadata}
                  onPlay={onPlay}
                  onPause={onPause}
                  onEnded={handleEnded}
                  onClick={togglePlay}
                />
              </Show>
            )}
          </Show>
        </div>
      </div>

      {/* Now Playing Bar */}
      <div class="border-t border-white/10 bg-[#0f0f1a] px-4 py-3 flex-shrink-0">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-[10px] text-white/50 w-10 text-right">{formatTime(currentTime())}</span>
          <div
            class="flex-1 h-1 bg-white/10 rounded-full cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              seek(((e.clientX - rect.left) / rect.width) * 100);
            }}
          >
            <div
              class="h-full bg-os-accent rounded-full"
              style={{ width: `${duration() > 0 ? (currentTime() / duration()) * 100 : 0}%` }}
            />
          </div>
          <span class="text-[10px] text-white/50 w-10">{formatTime(duration())}</span>
        </div>

        <div class="flex items-center gap-3">
          <div class="flex-1 min-w-0">
            <Show when={currentTrack()} fallback={
              <p class="text-[11px] text-white/30">Nothing playing</p>
            }>
              {(t) => (
                <>
                  <p class="text-[11px] font-medium truncate">{t().title}</p>
                  <p class="text-[10px] text-white/40 truncate">{t().artist}</p>
                </>
              )}
            </Show>
          </div>

          <div class="flex items-center gap-2">
            <button
              class="text-xs hover:text-os-accent transition-colors disabled:opacity-30"
              classList={{ "text-os-accent": shuffle() }}
              onClick={() => setShuffle(!shuffle())}
              title="Shuffle"
            >
              🔀
            </button>
            <button
              class="text-sm hover:text-os-accent transition-colors disabled:opacity-30"
              disabled={currentIndex() < 0}
              onClick={() => stepIndex(-1)}
              title="Previous"
            >
              ⏮
            </button>
            <button
              class="w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#0f0f1a] hover:scale-105 transition-transform disabled:opacity-30 disabled:hover:scale-100"
              disabled={currentIndex() < 0}
              onClick={togglePlay}
            >
              {isPlaying() ? "⏸" : "▶"}
            </button>
            <button
              class="text-sm hover:text-os-accent transition-colors disabled:opacity-30"
              disabled={currentIndex() < 0}
              onClick={() => stepIndex(1)}
              title="Next"
            >
              ⏭
            </button>
            <button
              class="text-xs hover:text-os-accent transition-colors"
              classList={{ "text-os-accent": repeat() !== "off" }}
              onClick={cycleRepeat}
              title={`Repeat: ${repeat()}`}
            >
              {repeatIcon()}
            </button>
          </div>

          <div class="flex items-center gap-1 w-24">
            <button class="text-[10px]" onClick={() => setMuted(!muted())} title="Mute">
              {muted() || volume() === 0 ? "🔇" : "🔊"}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(volume() * 100)}
              onInput={(e) => {
                setVolume(parseInt(e.currentTarget.value, 10) / 100);
                if (muted()) setMuted(false);
              }}
              class="w-full h-1 accent-os-accent"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaPlayer;
