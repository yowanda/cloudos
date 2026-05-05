import { Component, For, Show, createSignal } from "solid-js";

interface Track {
  id: number;
  title: string;
  artist: string;
  duration: string;
  album: string;
}

const demoTracks: Track[] = [
  { id: 1, title: "Sunset Boulevard", artist: "CloudOS Radio", duration: "3:42", album: "Ambient" },
  { id: 2, title: "Digital Rain", artist: "Synthwave", duration: "4:15", album: "Neon Dreams" },
  { id: 3, title: "Ocean Breeze", artist: "Nature Sounds", duration: "5:30", album: "Relaxation" },
  { id: 4, title: "City Lights", artist: "Lofi Beats", duration: "3:28", album: "Study Music" },
  { id: 5, title: "Moonrise", artist: "Ambient", duration: "6:12", album: "Night Sky" },
  { id: 6, title: "Coffee Shop", artist: "Jazz Vibes", duration: "4:45", album: "Morning" },
  { id: 7, title: "Thunder Storm", artist: "Nature Sounds", duration: "7:00", album: "Relaxation" },
  { id: 8, title: "Pixel Dreams", artist: "Chiptune", duration: "2:58", album: "Retro" },
];

const MediaPlayer: Component<{ windowId: string }> = () => {
  const [currentTrack, setCurrentTrack] = createSignal<Track | null>(null);
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [progress, setProgress] = createSignal(35);
  const [volume, setVolume] = createSignal(75);

  const play = (track: Track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
    setProgress(0);
  };

  return (
    <div class="flex flex-col h-full bg-gradient-to-b from-[#1a1a2e] to-[#16213e] text-white overflow-hidden">
      {/* Track List */}
      <div class="flex-1 overflow-y-auto">
        <div class="px-4 py-3">
          <h2 class="text-sm font-semibold mb-3">Library</h2>
          <div class="space-y-0.5">
            <For each={demoTracks}>
              {(track) => (
                <div
                  class="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                  classList={{
                    "bg-os-accent/20": currentTrack()?.id === track.id,
                    "hover:bg-white/5": currentTrack()?.id !== track.id,
                  }}
                  onClick={() => play(track)}
                >
                  <div class="w-8 h-8 rounded bg-white/10 flex items-center justify-center text-sm">
                    {currentTrack()?.id === track.id && isPlaying() ? "🔊" : "🎵"}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-medium truncate">{track.title}</p>
                    <p class="text-[10px] text-white/40">{track.artist}</p>
                  </div>
                  <span class="text-[10px] text-white/30">{track.duration}</span>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>

      {/* Now Playing Bar */}
      <div class="border-t border-white/10 bg-[#0f0f1a] px-4 py-3">
        <Show when={currentTrack()} fallback={
          <p class="text-center text-xs text-white/30">Select a track to play</p>
        }>
          {(track) => (
            <>
              {/* Progress bar */}
              <div class="w-full h-1 bg-white/10 rounded-full mb-3 cursor-pointer" onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setProgress(((e.clientX - rect.left) / rect.width) * 100);
              }}>
                <div class="h-full bg-os-accent rounded-full transition-all" style={{ width: `${progress()}%` }} />
              </div>

              <div class="flex items-center gap-3">
                {/* Track info */}
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-medium truncate">{track().title}</p>
                  <p class="text-[10px] text-white/40">{track().artist}</p>
                </div>

                {/* Controls */}
                <div class="flex items-center gap-3">
                  <button class="text-sm hover:text-os-accent transition-colors">⏮</button>
                  <button
                    class="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#0f0f1a] hover:scale-105 transition-transform"
                    onClick={() => setIsPlaying(!isPlaying())}
                  >
                    {isPlaying() ? "⏸" : "▶"}
                  </button>
                  <button class="text-sm hover:text-os-accent transition-colors">⏭</button>
                </div>

                {/* Volume */}
                <div class="flex items-center gap-1 w-20">
                  <span class="text-[10px]">🔊</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume()}
                    onInput={(e) => setVolume(parseInt(e.currentTarget.value))}
                    class="w-full h-1 accent-os-accent"
                  />
                </div>
              </div>
            </>
          )}
        </Show>
      </div>
    </div>
  );
};

export default MediaPlayer;
