# 🗂️ AI Tab Organizer

A Chrome extension that groups all your open tabs into Chrome's native tab groups
with one click — categorized by AI (Claude).

Got 100 tabs? Click the icon → it reads every tab, asks Claude to sort them into
logical groups (by topic/project, not just domain), and applies colored Chrome tab
groups automatically.

## Install (takes ~1 minute)

1. Open Chrome and go to `chrome://extensions`
2. Turn on **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this folder: `tab-organizer`
5. The 🗂️ icon appears in your toolbar. Pin it if you like.

## Pick a provider + key (Settings)

Click the icon → **Settings (API key)** (or right-click → Options), choose a provider:

| Provider | Cost | Default model | Get a key |
|----------|------|---------------|-----------|
| **Google Gemini** | **Free tier** | `gemini-2.5-flash` | https://aistudio.google.com/apikey |
| **OpenAI** | Cheap (paid) | `gpt-4o-mini` | https://platform.openai.com/api-keys |
| **Anthropic** | Cheap (paid) | `claude-haiku-4-5` | https://console.anthropic.com/settings/keys |
| **None** | Free, no key | — | groups by website domain, fully offline |

Paste the key, Save. Optionally override the model. The key is stored locally
(`chrome.storage.sync`) and is sent only to that provider's API.

> Want truly free + AI? Pick **Gemini** and grab a free AI Studio key.

## Use

Click the icon → **Organize my tabs**. Done. It groups the tabs in the current
window. Pinned tabs are left alone unless you enable that in Settings.

Re-click anytime to re-organize after you've opened more tabs.

## What it costs

It uses `claude-haiku-4-5` (cheap + fast). Organizing 100 tabs is a single small
request — fractions of a cent per run.

## How it works

- `manifest.json` — MV3 config, requests `tabs` + `tabGroups` permissions.
- `background.js` — reads tabs, calls the Claude API directly from the browser
  (`anthropic-dangerous-direct-browser-access`), parses the returned JSON, and
  applies groups via `chrome.tabs.group` + `chrome.tabGroups.update`.
- `popup.html/js` — the button + status.
- `options.html/js` — stores your API key.

## Troubleshooting

- **"Claude API 401"** → wrong/missing API key. Re-check Settings.
- **"Claude API 400 ... model"** → update the `MODEL` constant in `background.js`.
- **Nothing groups** → make sure you have more than ~2 non-pinned tabs open.

## Disclaimer

This extension is provided **"as is", without warranty of any kind**, express or implied.
The author is **not responsible or liable** for any use of this extension, for the grouping
decisions returned by third-party AI providers, for any data you choose to send to those
providers, or for any loss, damage, cost, or disruption arising from its use. You use it
**at your own risk** and are solely responsible for complying with the terms and pricing of
whichever AI provider you configure. See `LICENSE` for full terms.
