import { Component, Show, createSignal, onMount } from "solid-js";
import {
  isLocked,
  isAuthenticated,
  user,
  authLoading,
  authError,
  login,
  register,
  restoreSession,
} from "../stores/auth-store";

const LockScreen: Component = () => {
  const [mode, setMode] = createSignal<"login" | "register">("login");
  const [email, setEmail] = createSignal("");
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [time, setTime] = createSignal(new Date());

  onMount(() => {
    restoreSession();
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (mode() === "login") {
      await login(email(), password());
    } else {
      await register(email(), username(), password());
    }
  };

  const formatTime = () =>
    time().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const formatDate = () =>
    time().toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

  return (
    <Show when={isLocked()}>
      <div class="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] backdrop-blur-xl">
        {/* Clock */}
        <div class="text-center mb-10">
          <div class="text-7xl font-extralight text-white/90 tracking-wide">
            {formatTime()}
          </div>
          <div class="text-lg text-white/50 mt-2">{formatDate()}</div>
        </div>

        {/* Avatar */}
        <div class="w-20 h-20 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center text-3xl mb-4">
          {isAuthenticated() && user()
            ? user()!.username.charAt(0).toUpperCase()
            : "👤"}
        </div>

        <Show when={isAuthenticated() && user()}>
          <p class="text-white/70 text-sm mb-6">{user()!.username}</p>
        </Show>

        {/* Auth Form */}
        <form
          onSubmit={handleSubmit}
          class="w-72 flex flex-col gap-3"
        >
          <input
            type="email"
            placeholder="Email"
            value={email()}
            onInput={(e) => setEmail(e.currentTarget.value)}
            class="px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/40 transition-colors"
            autocomplete="email"
          />

          <Show when={mode() === "register"}>
            <input
              type="text"
              placeholder="Username"
              value={username()}
              onInput={(e) => setUsername(e.currentTarget.value)}
              class="px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/40 transition-colors"
              autocomplete="username"
            />
          </Show>

          <input
            type="password"
            placeholder="Password"
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
            class="px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/40 transition-colors"
            autocomplete="current-password"
          />

          <Show when={authError()}>
            <p class="text-red-400 text-xs text-center">{authError()}</p>
          </Show>

          <button
            type="submit"
            disabled={authLoading()}
            class="px-4 py-2.5 rounded-xl bg-os-accent text-white text-sm font-medium hover:bg-os-accent-hover transition-colors disabled:opacity-50"
          >
            {authLoading()
              ? "..."
              : mode() === "login"
                ? "Sign In"
                : "Create Account"}
          </button>

          <button
            type="button"
            onClick={() => setMode(mode() === "login" ? "register" : "login")}
            class="text-white/40 text-xs text-center hover:text-white/60 transition-colors"
          >
            {mode() === "login"
              ? "Don't have an account? Register"
              : "Already have an account? Sign In"}
          </button>
        </form>
      </div>
    </Show>
  );
};

export default LockScreen;
