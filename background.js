// AI Tab Organizer — service worker
// Reads open tabs, asks an LLM to categorize them, applies Chrome tab groups.
// Provider is selectable in Settings: nano | gemini | openai | anthropic | domain.

const VALID_COLORS = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"];

const DEFAULT_MODELS = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
  gemini: "gemini-2.5-flash"
};

// On-device Gemini Nano (Chrome built-in `LanguageModel`) has a small context window,
// so it's only used for modest tab counts; larger windows should use a cloud provider.
const NANO_MAX_TABS = 200;

// JSON schema used as Nano's responseConstraint to force valid grouping output.
const GROUP_SCHEMA = {
  type: "object",
  properties: {
    groups: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          color: { type: "string", enum: VALID_COLORS },
          tabs: { type: "array", items: { type: "integer" } }
        },
        required: ["name", "color", "tabs"]
      }
    }
  },
  required: ["groups"]
};

// Persist progress to storage so it survives the popup closing.
// The popup reads this on open and subscribes to chrome.storage.onChanged.
async function setStatus(patch) {
  const prev = (await chrome.storage.local.get("status")).status || {};
  await chrome.storage.local.set({ status: { ...prev, ...patch } });
}

async function getStatus() {
  return (await chrome.storage.local.get("status")).status || null;
}

async function getSettings() {
  return chrome.storage.sync.get({
    provider: "nano",
    apiKey: "",
    model: "",
    includePinned: false,
    collapse: false
  });
}

// Compact a tab to keep the prompt lean (matters a lot with hundreds of tabs).
function compactTab(t) {
  const title = (t.title || "(no title)").slice(0, 80);
  let where = t.url || "";
  try {
    const u = new URL(t.url);
    where = u.hostname.replace(/^www\./, "") + u.pathname.slice(0, 40);
  } catch (_) {}
  return `${title} — ${where}`;
}

function buildPrompt(tabs) {
  const list = tabs.map((t, i) => `${i}: ${compactTab(t)}`).join("\n");
  const maxGroups = tabs.length > 120 ? 12 : 9;
  return (
`You are organizing a user's open browser tabs into a small set of logical groups.

Rules:
- Return ONLY a JSON object, no prose, in this exact shape:
  {"groups":[{"name":"Short Name","color":"blue","tabs":[0,2,5]}]}
- "color" MUST be one of: ${VALID_COLORS.join(", ")}.
- Use 3 to ${maxGroups} groups. Names must be short (1-3 words).
- Group by topic/purpose/project, not just by domain.
- Every tab index from 0 to ${tabs.length - 1} must appear in exactly one group.

Tabs:
${list}`
  );
}

// Pull the first {...} JSON object out of a model response (handles stray prose / code fences).
function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("No JSON found in model response.");
  return JSON.parse(text.slice(start, end + 1));
}

// ---- Provider calls: each returns the raw text the model produced ----

async function callAnthropic(prompt, apiKey, model) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODELS.anthropic,
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data.content || []).map((c) => c.text || "").join("");
}

async function callOpenAI(prompt, apiKey, model) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODELS.openai,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 8000,
      response_format: { type: "json_object" }
    })
  });
  if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data.choices && data.choices[0] && data.choices[0].message.content) || "";
}

async function callGemini(prompt, apiKey, model) {
  const m = model || DEFAULT_MODELS.gemini;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
        temperature: 0.2,
        thinkingConfig: { thinkingBudget: 0 } // no "thinking" — pure classification, keeps JSON intact
      }
    })
  });
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const cand = data.candidates && data.candidates[0];
  if (cand && cand.finishReason === "MAX_TOKENS") {
    throw new Error("Too many tabs for one request — the model ran out of room. Try fewer tabs or a different provider.");
  }
  return (cand && cand.content && (cand.content.parts || []).map((p) => p.text || "").join("")) || "";
}

// Chrome built-in Gemini Nano — on-device, free, no API key.
// `LanguageModel` is exposed to the extension service worker in Chrome 138+.
async function nanoReady() {
  try {
    return typeof LanguageModel !== "undefined" && (await LanguageModel.availability()) === "available";
  } catch (_) {
    return false;
  }
}

async function callNano(prompt, tabCount) {
  if (typeof LanguageModel === "undefined") {
    throw new Error("Chrome built-in AI isn't available here. Update Chrome (138+) and enable it in Settings, or pick another provider.");
  }
  if (tabCount > NANO_MAX_TABS) {
    throw new Error(`On-device Gemini Nano handles up to ~${NANO_MAX_TABS} tabs. For ${tabCount} tabs, switch to Google Gemini (cloud) in Settings.`);
  }
  const status = await LanguageModel.availability();
  if (status === "downloadable" || status === "downloading") {
    throw new Error("The on-device model is still downloading. Open Settings to finish it, then try again.");
  }
  if (status !== "available") throw new Error("Gemini Nano is unavailable on this device.");

  const session = await LanguageModel.create({
    expectedOutputs: [{ type: "text", languages: ["en"] }]
  });
  try {
    return await session.prompt(prompt, { responseConstraint: GROUP_SCHEMA });
  } finally {
    try { session.destroy(); } catch (_) {}
  }
}

async function aiGroup(tabs, provider, apiKey, model) {
  const prompt = buildPrompt(tabs);
  let text;
  if (provider === "nano") text = await callNano(prompt, tabs.length);
  else if (provider === "openai") text = await callOpenAI(prompt, apiKey, model);
  else if (provider === "gemini") text = await callGemini(prompt, apiKey, model);
  else text = await callAnthropic(prompt, apiKey, model);

  const parsed = extractJson(text);
  if (!Array.isArray(parsed.groups)) throw new Error("Model response missing 'groups' array.");
  return parsed.groups;
}

// Offline fallback: group by registrable-ish domain.
function domainGroup(tabs) {
  const buckets = {};
  tabs.forEach((t, i) => {
    let label = "Other";
    try {
      const host = new URL(t.url).hostname.replace(/^www\./, "");
      const parts = host.split(".");
      label = (parts.length >= 2 ? parts[parts.length - 2] : host) || "Other";
      label = label.charAt(0).toUpperCase() + label.slice(1);
    } catch (_) {}
    (buckets[label] = buckets[label] || []).push(i);
  });
  return Object.entries(buckets).map(([name, idx], gi) => ({
    name,
    color: VALID_COLORS[gi % VALID_COLORS.length],
    tabs: idx
  }));
}

async function applyGroups(groups, tabs, collapse, onProgress) {
  let applied = 0;
  const total = groups.length;
  for (const [gi, g] of groups.entries()) {
    const tabIds = (g.tabs || []).map((i) => tabs[i] && tabs[i].id).filter((x) => x != null);
    if (tabIds.length) {
      const groupId = await chrome.tabs.group({ tabIds });
      const color = VALID_COLORS.includes(g.color) ? g.color : VALID_COLORS[gi % VALID_COLORS.length];
      await chrome.tabGroups.update(groupId, {
        title: g.name || `Group ${gi + 1}`,
        color,
        collapsed: !!collapse
      });
      applied++;
    }
    if (onProgress) onProgress(gi + 1, total);
  }
  return applied;
}

async function organizeTabs() {
  const { provider, apiKey, model, includePinned, collapse } = await getSettings();
  await setStatus({ phase: "reading", current: 0, total: 0 });
  const win = await chrome.windows.getCurrent();
  let tabs = await chrome.tabs.query({ windowId: win.id });
  if (!includePinned) tabs = tabs.filter((t) => !t.pinned);
  if (!tabs.length) return { count: 0, groups: 0, mode: "none" };

  // Resolve the effective provider. Nano is keyless; if it was chosen (e.g. as the
  // default) but this browser can't run it, fall back to domain grouping rather than error.
  let effProvider = provider;
  if (provider === "nano" && !(await nanoReady())) effProvider = "domain";

  const keyless = effProvider === "domain" || effProvider === "nano";

  let groups;
  let mode;
  if (effProvider === "domain" || (!keyless && !apiKey)) {
    groups = domainGroup(tabs);
    mode = "domain";
  } else {
    await setStatus({ phase: "thinking", provider: effProvider, count: tabs.length });
    groups = await aiGroup(tabs, effProvider, apiKey, model);
    mode = effProvider;
  }

  const applied = await applyGroups(groups, tabs, collapse, (current, total) =>
    setStatus({ phase: "applying", current, total })
  );
  return { count: tabs.length, groups: applied, mode };
}

// Runs the whole job in the service worker. Survives the popup closing —
// progress and the final result are written to chrome.storage.local.
async function runOrganize() {
  await setStatus({ running: true, phase: "reading", startedAt: Date.now(), result: null, error: null });
  try {
    const result = await organizeTabs();
    await setStatus({ running: false, phase: "done", result, finishedAt: Date.now() });
  } catch (err) {
    await setStatus({ running: false, phase: "error", error: String(err.message || err), finishedAt: Date.now() });
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return;
  if (msg.action === "organize") {
    getStatus().then((s) => {
      if (s && s.running) {
        sendResponse({ started: false, already: true });
      } else {
        runOrganize(); // fire-and-forget; keeps running even if the popup closes
        sendResponse({ started: true });
      }
    });
    return true;
  }
  if (msg.action === "getStatus") {
    getStatus().then((s) => sendResponse({ status: s }));
    return true;
  }
});
