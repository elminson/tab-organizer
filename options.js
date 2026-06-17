const providerEl = document.getElementById("provider");
const keyEl = document.getElementById("key");
const modelEl = document.getElementById("model");
const pinnedEl = document.getElementById("pinned");
const collapseEl = document.getElementById("collapse");
const savedEl = document.getElementById("saved");
const keyHelpEl = document.getElementById("keyhelp");

const KEY_HELP = {
  gemini:
    'FREE tier. Get a key at <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a> (default model: gemini-2.5-flash; or try gemini-flash-latest).',
  openai:
    'Paid (cheap). Get a key at <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com/api-keys</a> (default model: gpt-4o-mini).',
  anthropic:
    'Paid (cheap). Get a key at <a href="https://console.anthropic.com/settings/keys" target="_blank">console.anthropic.com</a> (default model: claude-haiku-4-5).',
  domain: "No key needed — tabs are grouped by their website domain, fully offline and free."
};

function refreshHelp() {
  keyHelpEl.innerHTML = KEY_HELP[providerEl.value] || "";
  const noKey = providerEl.value === "domain";
  keyEl.disabled = noKey;
  modelEl.disabled = noKey;
}

providerEl.addEventListener("change", refreshHelp);

chrome.storage.sync
  .get({ provider: "gemini", apiKey: "", model: "", includePinned: false, collapse: false })
  .then((s) => {
    providerEl.value = s.provider;
    keyEl.value = s.apiKey;
    modelEl.value = s.model;
    pinnedEl.checked = s.includePinned;
    collapseEl.checked = s.collapse;
    refreshHelp();
  });

document.getElementById("save").addEventListener("click", () => {
  chrome.storage.sync
    .set({
      provider: providerEl.value,
      apiKey: keyEl.value.trim(),
      model: modelEl.value.trim(),
      includePinned: pinnedEl.checked,
      collapse: collapseEl.checked
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
