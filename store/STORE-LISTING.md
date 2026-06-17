# Chrome Web Store — Listing Kit

Everything you need to paste into the Developer Dashboard submission form.

## Assets (ready to upload)

| Field | File | Spec |
|-------|------|------|
| Store icon | `../assets/icon128.png` | 128×128 PNG ✅ |
| Screenshot 1 | `screenshot-popup.png` | 1280×800 PNG ✅ |
| Screenshot 2 | `screenshot-settings.png` | 1280×800 PNG ✅ |
| Packaged icons | `../assets/icon{16,32,48,128}.png` | wired into manifest ✅ |

> Optional extras the store allows: a 440×280 "small promo tile" and a 1400×560 "marquee".
> Say the word and I'll generate those too.

## Name
AI Tab Organizer

## Summary (≤132 chars)
Group hundreds of open tabs into clean, color-coded Chrome groups with one click — powered by AI (free Gemini, OpenAI, or Claude).

## Category
Productivity

## Description
Drowning in tabs? AI Tab Organizer reads every tab in your window and sorts them
into tidy, color-coded Chrome tab groups — by topic and project, not just by site —
in a single click.

• One click to organize — no manual dragging
• Bring your own AI: Google Gemini (free tier), OpenAI, or Anthropic Claude
• Or run fully offline with no key — groups by website
• Live progress, and the job keeps running even if you close the popup
• Optional collapse to tuck groups away; pinned tabs left alone by default
• Light & dark mode, clean modern design

Your API key is stored locally in your browser and is sent only to the AI provider
you choose. The extension never sends your data anywhere else.

## Single purpose (required field)
This extension has one purpose: to automatically organize the user's open browser
tabs into Chrome tab groups using AI categorization.

## Permission justifications (required)
- **tabs** — Needed to read the titles and URLs of open tabs so they can be
  categorized, and to move them into groups.
- **tabGroups** — Needed to create the native Chrome tab groups and set each
  group's name and color.
- **storage** — Stores the user's chosen provider, API key, and preferences
  locally, and tracks in-progress job status.
- **host permissions** (api.anthropic.com, api.openai.com,
  generativelanguage.googleapis.com) — Needed to send tab titles/URLs to the
  AI provider the user selected, to receive the grouping.

## Data usage disclosures (Privacy tab)
- The extension collects **no analytics** and has **no backend server**.
- Tab titles and URLs are sent to the user-selected AI provider **only** to
  compute groupings. They are not stored or logged by the extension.
- The API key is stored locally via `chrome.storage` and transmitted only to
  the selected provider's API.
- Check: "I do not sell or transfer user data to third parties" (the AI provider
  call is the disclosed processing, not a sale).

> ⚠️ A **privacy policy URL is required** because the extension handles an API key
> and sends tab data to a third-party API. Host a short policy (GitHub Pages /
> Gist works) stating the bullets above. I can draft the full policy text on request.

## Pre-submission checklist
- [ ] Zip the extension folder (exclude `store/` and the `.svg`/`.md` source files if you like).
- [ ] Upload store icon + both screenshots.
- [ ] Fill single-purpose + permission justifications above.
- [ ] Add privacy policy URL.
- [ ] Pay the one-time $5 developer registration fee (if not already).
