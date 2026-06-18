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
const LABELS = { nano: "Chrome AI (on-device)", gemini: "Gemini", openai: "OpenAI", anthropic: "Claude", domain: "domain grouping (no key)" };

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

/* ---------------- Tab search (local, no AI, no storage) ---------------- */
const qEl = document.getElementById("q");
const qClear = document.getElementById("qclear");
const resultsEl = document.getElementById("results");

// Chrome tab-group color name -> hex (for the dot next to each result).
const GROUP_HEX = {
  grey: "#9aa0a6", blue: "#1a73e8", red: "#d93025", yellow: "#f9ab00", green: "#1e8e3e",
  pink: "#d01884", purple: "#9334e6", cyan: "#007b83", orange: "#fa903e",
};

let tabIndex = []; // [{id, windowId, title, url, groupName, groupColor}]
let selIndex = -1;

async function buildIndex() {
  const [tabs, groups] = await Promise.all([
    chrome.tabs.query({ currentWindow: true }),
    chrome.tabGroups.query({}).catch(() => []),
  ]);
  const gmap = new Map(groups.map((g) => [g.id, g]));
  tabIndex = tabs.map((t) => {
    const g = t.groupId != null && t.groupId !== -1 ? gmap.get(t.groupId) : null;
    return {
      id: t.id,
      windowId: t.windowId,
      title: t.title || "(untitled)",
      url: t.url || "",
      groupName: g ? g.title || "" : "",
      groupColor: g ? GROUP_HEX[g.color] || "#9aa0a6" : "",
    };
  });
}

function esc(s) {
  return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function highlight(text, terms) {
  const safe = terms.filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!safe.length) return esc(text);
  const re = new RegExp("(" + safe.join("|") + ")", "ig");
  return (text || "")
    .split(re)
    .map((part, i) => (i % 2 ? "<mark>" + esc(part) + "</mark>" : esc(part)))
    .join("");
}

function prettyUrl(u) {
  try {
    const x = new URL(u);
    return x.hostname.replace(/^www\./, "") + (x.pathname === "/" ? "" : x.pathname);
  } catch (_) {
    return u;
  }
}

function activate(tab) {
  chrome.tabs.update(tab.id, { active: true });
  chrome.windows.update(tab.windowId, { focused: true });
  window.close();
}

function renderResults() {
  const q = qEl.value.trim();
  qClear.hidden = q.length === 0;
  if (!q) {
    resultsEl.hidden = true;
    resultsEl.innerHTML = "";
    selIndex = -1;
    return;
  }
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = tabIndex
    .filter((t) => {
      const hay = (t.title + " " + t.url + " " + t.groupName).toLowerCase();
      return terms.every((term) => hay.includes(term));
    })
    .slice(0, 60);

  resultsEl.hidden = false;
  if (!matches.length) {
    resultsEl.innerHTML = `<li class="res-empty">No matching tabs</li>`;
    selIndex = -1;
    return;
  }
  selIndex = 0;
  resultsEl.innerHTML = matches
    .map(
      (t, i) => `
      <li class="res${i === 0 ? " sel" : ""}" role="option" data-i="${i}">
        ${t.groupColor ? `<span class="dot" style="background:${t.groupColor}"></span>` : `<span class="dot" style="background:transparent;box-shadow:none"></span>`}
        <span class="meta">
          <span class="rt">${highlight(t.title, terms)}</span>
          <span class="ru">${highlight(prettyUrl(t.url), terms)}</span>
        </span>
        ${t.groupName ? `<span class="grp">${esc(t.groupName)}</span>` : ""}
      </li>`
    )
    .join("");
  resultsEl._matches = matches;
}

function moveSel(delta) {
  const items = [...resultsEl.querySelectorAll(".res")];
  if (!items.length) return;
  items[selIndex]?.classList.remove("sel");
  selIndex = (selIndex + delta + items.length) % items.length;
  items[selIndex].classList.add("sel");
  items[selIndex].scrollIntoView({ block: "nearest" });
}

let qTimer = null;
qEl.addEventListener("input", () => {
  clearTimeout(qTimer);
  qTimer = setTimeout(renderResults, 70);
});
qEl.addEventListener("focus", buildIndex);
qEl.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") { e.preventDefault(); moveSel(1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); moveSel(-1); }
  else if (e.key === "Enter") {
    const m = resultsEl._matches;
    if (m && m[selIndex]) activate(m[selIndex]);
  } else if (e.key === "Escape") {
    if (qEl.value) { qEl.value = ""; renderResults(); }
  }
});
resultsEl.addEventListener("click", (e) => {
  const li = e.target.closest(".res");
  if (!li) return;
  const m = resultsEl._matches;
  const i = Number(li.dataset.i);
  if (m && m[i]) activate(m[i]);
});
qClear.addEventListener("click", () => { qEl.value = ""; renderResults(); qEl.focus(); });
buildIndex(); // warm the index on open

const opts = document.getElementById("opts");
opts.addEventListener("click", () => chrome.runtime.openOptionsPage());
opts.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  }
});
