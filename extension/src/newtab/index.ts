import {
  type ExtensionSettings,
  loadSettings,
  normaliseUrl,
  saveSettings,
} from "../shared/storage";

const root = document.getElementById("app");
if (!root) {
  throw new Error("missing #app root");
}
const app = root;

void main();

async function main(): Promise<void> {
  const settings = await loadSettings();
  if (!settings.cloudosUrl) {
    renderSetup();
    return;
  }
  if (settings.embedMode === "iframe") {
    renderIframe(settings.cloudosUrl);
    return;
  }
  // Default redirect mode: replace the new-tab URL so back-button doesn't
  // bounce the user back to the placeholder page.
  window.location.replace(settings.cloudosUrl);
}

function renderIframe(url: string): void {
  app.innerHTML = "";
  const host = document.createElement("div");
  host.id = "frame-host";
  const frame = document.createElement("iframe");
  frame.src = url;
  frame.referrerPolicy = "no-referrer";
  frame.title = "CloudOS";
  host.appendChild(frame);
  app.appendChild(host);
}

function renderSetup(): void {
  app.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "setup";

  const card = document.createElement("div");
  card.className = "setup-card";

  const heading = document.createElement("h1");
  heading.textContent = "Welcome to CloudOS";
  card.appendChild(heading);

  const intro = document.createElement("p");
  intro.textContent =
    "Point this new-tab page at your CloudOS instance and we'll open it for you on every new tab. You can switch to embedded-iframe mode and toggle the history bridge from the options page.";
  card.appendChild(intro);

  const label = document.createElement("label");
  label.htmlFor = "cloudos-url";
  label.textContent = "CloudOS URL";
  card.appendChild(label);

  const input = document.createElement("input");
  input.id = "cloudos-url";
  input.type = "url";
  input.placeholder = "https://cloudos.your-domain.com";
  input.autocomplete = "off";
  input.spellcheck = false;
  card.appendChild(input);

  const error = document.createElement("div");
  error.className = "error";
  error.hidden = true;
  card.appendChild(error);

  const actions = document.createElement("div");
  actions.className = "setup-actions";

  const save = document.createElement("button");
  save.type = "button";
  save.className = "primary";
  save.textContent = "Save & open";
  actions.appendChild(save);

  const openOptions = document.createElement("button");
  openOptions.type = "button";
  openOptions.className = "secondary";
  openOptions.textContent = "More options…";
  actions.appendChild(openOptions);

  card.appendChild(actions);

  const hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent =
    "Tip: localhost addresses work too (e.g. http://localhost:4100). Use the options page to allow extra origins for the optional /recent history bridge.";
  card.appendChild(hint);

  wrap.appendChild(card);
  app.appendChild(wrap);

  input.focus();

  save.addEventListener("click", () => {
    void persistAndGo(input.value, error);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void persistAndGo(input.value, error);
    }
  });
  openOptions.addEventListener("click", () => {
    if (chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  });
}

async function persistAndGo(raw: string, error: HTMLElement): Promise<void> {
  const url = normaliseUrl(raw);
  if (!url) {
    error.textContent = "Please enter a full URL like https://cloudos.example.com";
    error.hidden = false;
    return;
  }
  error.hidden = true;
  const patch: Partial<ExtensionSettings> = { cloudosUrl: url };
  await saveSettings(patch);
  window.location.replace(url);
}
