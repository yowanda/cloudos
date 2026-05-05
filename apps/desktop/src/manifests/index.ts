import { registerBuiltinManifest, type AppManifest } from "../core/app-manifest";

const helloHtml = `
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 1rem; background: linear-gradient(135deg, #667eea, #764ba2); color: white; min-height: 100vh; box-sizing: border-box; }
  button { padding: 0.5rem 1rem; border: 0; border-radius: 8px; background: rgba(255,255,255,0.2); color: white; cursor: pointer; backdrop-filter: blur(10px); margin-right: 0.5rem; margin-bottom: 0.5rem; }
  button:hover { background: rgba(255,255,255,0.3); }
  pre { background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 8px; overflow: auto; font-size: 12px; max-height: 200px; }
  h1 { margin: 0 0 0.5rem; font-size: 1.25rem; }
  p { margin: 0 0 1rem; opacity: 0.85; font-size: 13px; }
</style>
<h1>👋 Hello from a sandboxed app</h1>
<p>This page runs inside an iframe with <code>sandbox="allow-scripts"</code>. It can only talk to the OS through <code>window.cloudos.*</code>.</p>
<div>
  <button id="ping">Ping OS</button>
  <button id="notify">Send Notification</button>
  <button id="ls">List /</button>
  <button id="write">Write demo file</button>
  <button id="close">Close window</button>
</div>
<pre id="out">(no output)</pre>
<script>
  function ready() { return new Promise(function (r) { document.addEventListener("cloudos:ready", r, { once: true }); }); }
  ready().then(async function () {
    var out = document.getElementById("out");
    function show(v) { out.textContent = typeof v === "string" ? v : JSON.stringify(v, null, 2); }
    document.getElementById("ping").onclick = function () { window.cloudos.ping().then(show); };
    document.getElementById("notify").onclick = function () {
      window.cloudos.notify({ title: "Hello", message: "From the sandbox 👋", type: "success" }).then(show);
    };
    document.getElementById("ls").onclick = function () { window.cloudos.vfs.list("/").then(show).catch(function (e) { show("Error: " + e.message); }); };
    document.getElementById("write").onclick = function () {
      window.cloudos.vfs.write("/sandbox-hello.txt", "Hello, world! Written at " + new Date().toISOString())
        .then(function () { show("Wrote /sandbox-hello.txt"); })
        .catch(function (e) { show("Error: " + e.message); });
    };
    document.getElementById("close").onclick = function () { window.cloudos.windows.close(); };
  });
</script>
`;

const stopwatchHtml = `
<style>
  body { font-family: system-ui, sans-serif; margin:0; padding:0; height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#0f172a; color:white; }
  .time { font-size: 3.5rem; font-variant-numeric: tabular-nums; font-weight: 600; letter-spacing: 0.05em; margin-bottom: 1rem; }
  .row button { padding: 0.5rem 1.25rem; margin: 0 0.25rem; background: #6366f1; color: white; border: 0; border-radius: 8px; cursor: pointer; font-size: 14px; }
  .row button.secondary { background: #334155; }
  .row button:hover { filter: brightness(1.1); }
</style>
<div class="time" id="t">0.000s</div>
<div class="row">
  <button id="toggle">Start</button>
  <button id="reset" class="secondary">Reset</button>
  <button id="copy" class="secondary">Copy</button>
</div>
<script>
  var running = false, start = 0, elapsed = 0, raf = null;
  var t = document.getElementById("t"), toggle = document.getElementById("toggle"),
      reset = document.getElementById("reset"), copy = document.getElementById("copy");
  function fmt(ms) { return (ms/1000).toFixed(3) + "s"; }
  function tick() { t.textContent = fmt(elapsed + (running ? Date.now() - start : 0)); raf = running ? requestAnimationFrame(tick) : null; }
  toggle.onclick = function () { if (running) { elapsed += Date.now() - start; running = false; toggle.textContent = "Start"; } else { start = Date.now(); running = true; toggle.textContent = "Pause"; tick(); } };
  reset.onclick = function () { running = false; elapsed = 0; toggle.textContent = "Start"; t.textContent = fmt(0); };
  copy.onclick = function () {
    document.addEventListener("cloudos:ready", function once(){}, { once: true });
    if (window.cloudos && window.cloudos.clipboard) {
      window.cloudos.clipboard.write(t.textContent).catch(function () {});
    }
  };
</script>
`;

export const demoManifests: AppManifest[] = [
  {
    id: "com.cloudos.demos.hello",
    name: "Sandbox Hello",
    version: "1.0.0",
    icon: "👋",
    description: "Demo of the sandboxed iframe app + postMessage IPC bridge.",
    author: "CloudOS Demos",
    category: "Developer",
    permissions: ["notifications", "files.read", "files.write", "windows"],
    entry: { type: "iframe", html: helloHtml },
    window: { width: 520, height: 420, resizable: true, minWidth: 360, minHeight: 280 },
  },
  {
    id: "com.cloudos.demos.stopwatch",
    name: "Stopwatch",
    version: "1.0.0",
    icon: "⏱",
    description: "Sandboxed stopwatch demo using window.cloudos.clipboard.",
    author: "CloudOS Demos",
    category: "Utilities",
    permissions: ["clipboard.write"],
    entry: { type: "iframe", html: stopwatchHtml },
    window: { width: 360, height: 240, resizable: true, minWidth: 280, minHeight: 200 },
  },
];

export function registerDemoManifests() {
  for (const m of demoManifests) registerBuiltinManifest(m);
}
