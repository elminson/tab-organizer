const goBtn = document.getElementById("go");
const panelEl = document.getElementById("panel");
const statusEl = document.getElementById("status");
const msgEl = document.getElementById("msg");
const spinnerEl = document.getElementById("spinner");
const dotEl = document.getElementById("dot");
const dotPath = document.getElementById("dotPath");
const barEl = document.getElementById("bar");
const fillEl = document.getElementById("fill");

const CHECK = "M5 13l4 4L19 7";
const CROSS = "M6 6l12 12M18 6L6 18";
const LABELS = { gemini: "Gemini", openai: "OpenAI", anthropic: "Claude", domain: "domain grouping (no key)" };

let ticker = null;
function clearTicker() {
  if (ticker) {
    clearInterval(ticker);
    ticker = null;
  }
}

function provLabel(p) {
  return LABELS[p] || p;
}

function renderRunning(s) {
  panelEl.classList.add("show");
  statusEl.className = "";
  dotEl.classList.remove("ok", "err");
  spinnerEl.style.display = "block";

  let base = "Working…";
  let seconds = false;
  let showBar = false;
  let pct = 0;

  if (s.phase === "reading") {
    base = "Reading your tabs…";
  } else if (s.phase === "thinking") {
    base = `Asking ${provLabel(s.provider)} to sort ${s.count} tabs…`;
    seconds = true;
  } else if (s.phase === "applying") {
    base = `Creating groups ${s.current}/${s.total}`;
    showBar = true;
    pct = s.total ? Math.round((s.current / s.total) * 100) : 0;
  }

  barEl.style.display = showBar ? "block" : "none";
  if (showBar) fillEl.style.width = `${pct}%`;

  const paint = () => {
    if (seconds) {
      const el = Math.max(0, Math.round((Date.now() - (s.startedAt || Date.now())) / 1000));
      msgEl.textContent = `${base} ${el}s`;
    } else {
      msgEl.textContent = base;
    }
  };
  clearTicker();
  paint();
  if (seconds) ticker = setInterval(paint, 1000);
}

function renderDone(s) {
  clearTicker();
  panelEl.classList.add("show");
  spinnerEl.style.display = "none";
  barEl.style.display = "none";
  fillEl.style.width = "0";
  dotEl.classList.remove("ok", "err");

  const r = s.result || {};
  if (r.count === 0) {
    statusEl.className = "";
    msgEl.textContent = "No tabs to organize.";
    return;
  }
  dotPath.setAttribute("d", CHECK);
  dotEl.classList.add("ok");
  statusEl.className = "ok";
  msgEl.textContent = `Grouped ${r.count} tabs into ${r.groups} groups via ${provLabel(r.mode)}.`;
}

function renderError(s) {
  clearTicker();
  panelEl.classList.add("show");
  spinnerEl.style.display = "none";
  barEl.style.display = "none";
  dotEl.classList.remove("ok", "err");
  dotPath.setAttribute("d", CROSS);
  dotEl.classList.add("err");
  statusEl.className = "err";
  msgEl.textContent = s.error || "Something went wrong.";
}

function render(s) {
  if (!s) {
    goBtn.disabled = false;
    return;
  }
  if (s.running) {
    goBtn.disabled = true;
    renderRunning(s);
  } else {
    goBtn.disabled = false;
    if (s.phase === "done") renderDone(s);
    else if (s.phase === "error") renderError(s);
  }
}

// Resume whatever the background worker is doing (or last did).
chrome.runtime.sendMessage({ action: "getStatus" }, (resp) => {
  if (chrome.runtime.lastError) return;
  render(resp && resp.status);
});

// Stay in sync with the background worker, even across popup reopens.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.status) render(changes.status.newValue);
});

goBtn.addEventListener("click", () => {
  goBtn.disabled = true;
  render({ running: true, phase: "reading", startedAt: Date.now() }); // optimistic
  chrome.runtime.sendMessage({ action: "organize" }, (resp) => {
    if (chrome.runtime.lastError) {
      renderError({ error: chrome.runtime.lastError.message });
      goBtn.disabled = false;
    }
    // storage.onChanged drives the rest — works even if this popup closes.
  });
});

const opts = document.getElementById("opts");
opts.addEventListener("click", () => chrome.runtime.openOptionsPage());
opts.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  }
});
