const providerEl = document.getElementById("provider");
const keyEl = document.getElementById("key");
const modelEl = document.getElementById("model");
const pinnedEl = document.getElementById("pinned");
const collapseEl = document.getElementById("collapse");
const savedEl = document.getElementById("saved");
const keyHelpEl = document.getElementById("keyhelp");
const nanoBox = document.getElementById("nanobox");
const nanoStatus = document.getElementById("nanostatus");
const nanoDl = document.getElementById("nanodl");
const nanoReqs = document.getElementById("nanoreqs");

const KEY_HELP = {
  nano:
    "Runs entirely on your device — free, private, and works offline. No API key needed. Requires Chrome 138+ with the built-in AI model. Best for up to ~200 tabs; use a cloud provider for very large windows.",
  gemini:
    'FREE tier. Get a key at <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a> (default model: gemini-2.5-flash; or try gemini-flash-latest).',
  openai:
    'Paid (cheap). Get a key at <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com/api-keys</a> (default model: gpt-4o-mini).',
  anthropic:
    'Paid (cheap). Get a key at <a href="https://console.anthropic.com/settings/keys" target="_blank">console.anthropic.com</a> (default model: claude-haiku-4-5).',
  domain: "No key needed — tabs are grouped by their website domain, fully offline and free."
};

function setNano(kind, text, showDownload) {
  nanoStatus.className = "nanostatus " + kind;
  nanoStatus.textContent = text;
  nanoDl.hidden = !showDownload;
}

// Reflect the on-device model state. Returns the raw availability string.
async function refreshNano() {
  if (typeof LanguageModel === "undefined") {
    setNano("bad", "Not supported in this browser — needs Chrome 138+ with built-in AI", false);
    nanoReqs.open = true;
    return "unsupported";
  }
  let avail;
  try {
    avail = await LanguageModel.availability();
  } catch (_) {
    setNano("bad", "Not available on this device", false);
    return "unsupported";
  }
  if (avail === "available") setNano("ok", "Ready — on-device, no key needed", false);
  else if (avail === "downloadable") setNano("warn", "Model not downloaded yet", true);
  else if (avail === "downloading") setNano("warn", "Model downloading…", false);
  else setNano("bad", "Unavailable on this device — enable it in chrome://flags or pick another provider", false);
  nanoReqs.open = avail !== "available"; // expand the steps unless it's ready
  return avail;
}

function refreshHelp() {
  const p = providerEl.value;
  keyHelpEl.innerHTML = KEY_HELP[p] || "";
  const noKey = p === "domain" || p === "nano";
  keyEl.disabled = noKey;
  modelEl.disabled = noKey;
  nanoBox.hidden = p !== "nano";
  nanoReqs.hidden = p !== "nano";
  if (p === "nano") refreshNano();
}

providerEl.addEventListener("change", refreshHelp);

chrome.storage.sync
  .get({ provider: "nano", apiKey: "", model: "", includePinned: false, collapse: false, configured: false })
  .then(async (s) => {
    providerEl.value = s.provider;
    keyEl.value = s.apiKey;
    modelEl.value = s.model;
    pinnedEl.checked = s.includePinned;
    collapseEl.checked = s.collapse;

    // First run (never saved): default to Nano if available, else Gemini.
    if (!s.configured) {
      const avail = await refreshNano();
      providerEl.value = (avail === "available" || avail === "downloadable" || avail === "downloading") ? "nano" : "gemini";
    }
    refreshHelp();
  });

nanoDl.addEventListener("click", async () => {
  if (typeof LanguageModel === "undefined") return;
  nanoDl.disabled = true;
  setNano("warn", "Starting download…", false);
  try {
    const session = await LanguageModel.create({
      expectedOutputs: [{ type: "text", languages: ["en"] }],
      monitor(m) {
        m.addEventListener("downloadprogress", (e) => {
          setNano("warn", `Downloading… ${Math.round((e.loaded || 0) * 100)}%`, false);
        });
      }
    });
    session.destroy();
    setNano("ok", "Ready — on-device, no key needed", false);
  } catch (e) {
    setNano("bad", "Download failed: " + (e.message || e), true);
    nanoDl.disabled = false;
  }
});

document.getElementById("save").addEventListener("click", () => {
  chrome.storage.sync
    .set({
      provider: providerEl.value,
      apiKey: keyEl.value.trim(),
      model: modelEl.value.trim(),
      includePinned: pinnedEl.checked,
      collapse: collapseEl.checked,
      configured: true
    })
    .then(() => {
      savedEl.classList.add("show");
      setTimeout(() => savedEl.classList.remove("show"), 1800);
    });
});

// Show / hide the API key.
const toggleKey = document.getElementById("toggleKey");
toggleKey.addEventListener("click", () => {
  const showing = keyEl.type === "text";
  keyEl.type = showing ? "password" : "text";
  toggleKey.setAttribute("aria-label", showing ? "Show API key" : "Hide API key");
});
