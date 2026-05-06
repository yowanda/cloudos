import {
  type ExtensionSettings,
  loadSettings,
  normaliseUrl,
  saveSettings,
} from "../shared/storage";

const urlInput = byId<HTMLInputElement>("cloudos-url");
const embedSelect = byId<HTMLSelectElement>("embed-mode");
const saveButton = byId<HTMLButtonElement>("save-url");
const openButton = byId<HTMLButtonElement>("open-newtab");
const urlStatus = byId<HTMLDivElement>("url-status");
const historyToggle = byId<HTMLInputElement>("history-toggle");
const grantHostButton = byId<HTMLButtonElement>("grant-host");
const historyStatus = byId<HTMLDivElement>("history-status");
const extVersion = byId<HTMLSpanElement>("ext-version");

void main();

async function main(): Promise<void> {
  extVersion.textContent = `v${chrome.runtime.getManifest().version}`;
  const settings = await loadSettings();
  applySettingsToForm(settings);

  saveButton.addEventListener("click", () => {
    void onSave();
  });
  urlInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void onSave();
    }
  });
  openButton.addEventListener("click", () => {
    void onOpenNewTab();
  });
  historyToggle.addEventListener("change", () => {
    void saveSettings({ historyBridgeEnabled: historyToggle.checked });
    setStatus(
      historyStatus,
      historyToggle.checked ? "ok" : "ok",
      historyToggle.checked
        ? "History bridge enabled. Don't forget to grant host permission below."
        : "History bridge disabled.",
    );
  });
  grantHostButton.addEventListener("click", () => {
    void onGrantHost();
  });
}

function applySettingsToForm(settings: ExtensionSettings): void {
  urlInput.value = settings.cloudosUrl;
  embedSelect.value = settings.embedMode;
  historyToggle.checked = settings.historyBridgeEnabled;
}

async function onSave(): Promise<void> {
  const url = normaliseUrl(urlInput.value);
  if (!url) {
    setStatus(
      urlStatus,
      "err",
      "That doesn't look like a valid URL — try https://cloudos.example.com",
    );
    return;
  }
  const embedMode: ExtensionSettings["embedMode"] =
    embedSelect.value === "iframe" ? "iframe" : "redirect";
  await saveSettings({ cloudosUrl: url, embedMode });
  urlInput.value = url;
  setStatus(urlStatus, "ok", `Saved. New tabs will now open ${url}.`);
}

async function onOpenNewTab(): Promise<void> {
  const settings = await loadSettings();
  if (!settings.cloudosUrl) {
    setStatus(urlStatus, "err", "Save a URL first, then click Open new tab.");
    return;
  }
  await chrome.tabs.create({ url: settings.cloudosUrl });
}

async function onGrantHost(): Promise<void> {
  const settings = await loadSettings();
  if (!settings.cloudosUrl) {
    setStatus(historyStatus, "err", "Save your CloudOS URL first.");
    return;
  }
  let origin: string;
  try {
    origin = `${new URL(settings.cloudosUrl).origin}/*`;
  } catch {
    setStatus(historyStatus, "err", "Stored URL is malformed; re-save it above.");
    return;
  }
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (granted) {
    setStatus(
      historyStatus,
      "ok",
      `Host permission granted for ${origin}. The bridge content script will load on next page visit.`,
    );
  } else {
    setStatus(
      historyStatus,
      "err",
      "Permission denied. The bridge will be inactive for this origin.",
    );
  }
}

function setStatus(node: HTMLElement, kind: "ok" | "err", message: string): void {
  node.textContent = message;
  node.classList.remove("ok", "err");
  node.classList.add(kind);
}

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`missing #${id}`);
  }
  return node as T;
}
