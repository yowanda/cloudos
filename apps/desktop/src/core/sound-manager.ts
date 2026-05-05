import { createSignal } from "solid-js";

export type SoundName =
  | "open"
  | "close"
  | "minimize"
  | "maximize"
  | "focus"
  | "notify"
  | "success"
  | "warning"
  | "error"
  | "click"
  | "lock"
  | "unlock";

const STORAGE_KEY = "cloudos:sound";

interface SoundConfig {
  enabled: boolean;
  volume: number; // 0..1
}

function loadConfig(): SoundConfig {
  if (typeof window === "undefined") return { enabled: true, volume: 0.4 };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { enabled: true, volume: 0.4 };
    const p = JSON.parse(raw) as Partial<SoundConfig>;
    return {
      enabled: p.enabled !== false,
      volume:
        typeof p.volume === "number" ? Math.max(0, Math.min(1, p.volume)) : 0.4,
    };
  } catch {
    return { enabled: true, volume: 0.4 };
  }
}

const initial = loadConfig();
const [enabled, setEnabledInternal] = createSignal(initial.enabled);
const [volume, setVolumeInternal] = createSignal(initial.volume);

export const soundEnabled = enabled;
export const soundVolume = volume;

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ enabled: enabled(), volume: volume() }),
    );
  } catch {
    // ignore quota errors
  }
}

export function setSoundEnabled(v: boolean) {
  setEnabledInternal(v);
  persist();
}

export function setSoundVolume(v: number) {
  const clamped = Math.max(0, Math.min(1, v));
  setVolumeInternal(clamped);
  persist();
}

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioContext) return audioContext;
  type ACFactory = typeof AudioContext;
  const w = window as unknown as {
    AudioContext?: ACFactory;
    webkitAudioContext?: ACFactory;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioContext = new Ctor();
    return audioContext;
  } catch {
    return null;
  }
}

interface ToneStep {
  freq: number;
  /** Start time offset from sound trigger (seconds). */
  offset: number;
  /** Duration of the tone (seconds). */
  duration: number;
  type?: OscillatorType;
  /** Gain multiplier 0..1 relative to master volume. */
  gain?: number;
  /** Optional pitch glide target. */
  glideTo?: number;
}

const sounds: Record<SoundName, ToneStep[]> = {
  open: [
    { freq: 660, offset: 0, duration: 0.06 },
    { freq: 990, offset: 0.045, duration: 0.08 },
  ],
  close: [
    { freq: 660, offset: 0, duration: 0.06 },
    { freq: 330, offset: 0.045, duration: 0.08 },
  ],
  minimize: [
    { freq: 800, offset: 0, duration: 0.07, glideTo: 300, gain: 0.8 },
  ],
  maximize: [
    { freq: 400, offset: 0, duration: 0.07, glideTo: 900, gain: 0.8 },
  ],
  focus: [{ freq: 1200, offset: 0, duration: 0.025, gain: 0.35 }],
  notify: [
    { freq: 880, offset: 0, duration: 0.07 },
    { freq: 1320, offset: 0.06, duration: 0.1 },
  ],
  success: [
    { freq: 660, offset: 0, duration: 0.07 },
    { freq: 880, offset: 0.06, duration: 0.07 },
    { freq: 1320, offset: 0.12, duration: 0.1 },
  ],
  warning: [
    { freq: 600, offset: 0, duration: 0.08 },
    { freq: 600, offset: 0.12, duration: 0.08 },
  ],
  error: [
    { freq: 220, offset: 0, duration: 0.08, type: "square", gain: 0.55 },
    { freq: 165, offset: 0.07, duration: 0.1, type: "square", gain: 0.55 },
  ],
  click: [{ freq: 1000, offset: 0, duration: 0.012, gain: 0.3 }],
  lock: [
    { freq: 880, offset: 0, duration: 0.08 },
    { freq: 440, offset: 0.07, duration: 0.1 },
  ],
  unlock: [
    { freq: 440, offset: 0, duration: 0.08 },
    { freq: 880, offset: 0.07, duration: 0.1 },
  ],
};

export function playSound(name: SoundName) {
  if (!enabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {
      /* ignore */
    });
  }

  const master = volume();
  if (master <= 0) return;

  const seq = sounds[name];
  const start = ctx.currentTime;

  for (const step of seq) {
    const osc = ctx.createOscillator();
    osc.type = step.type ?? "sine";
    const t0 = start + step.offset;
    const t1 = t0 + step.duration;
    osc.frequency.setValueAtTime(step.freq, t0);
    if (step.glideTo) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, step.glideTo),
        t1,
      );
    }

    const gain = ctx.createGain();
    const peak = master * (step.gain ?? 1) * 0.3;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t1);

    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }
}

/**
 * Resume the AudioContext on first user gesture. Browsers block playback
 * until a user-initiated event has interacted with the AudioContext.
 */
export function attachAudioUnlock() {
  if (typeof window === "undefined") return;
  let unlocked = false;
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    const ctx = getAudioContext();
    if (ctx?.state === "suspended") {
      ctx.resume().catch(() => {
        /* ignore */
      });
    }
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}
