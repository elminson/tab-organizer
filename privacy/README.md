# Privacy policy — hosting guide

The Chrome Web Store rejected v1.0.0 because the privacy-policy URL didn't lead to a
**valid, dedicated privacy-policy page** ("Owner sites are not considered valid privacy
policies"). `index.html` in this folder IS that page. Host it and use its URL.

## Before hosting
- Open `index.html` and replace **REPLACE_WITH_YOUR_EMAIL** (two spots) with a real
  contact email.

## Fastest valid host: GitHub Pages (free, gives a real https page)
1. Create a public repo, e.g. `tab-organizer-privacy`.
2. Add `index.html` (this file's sibling) to the repo root.
3. Repo **Settings → Pages → Source: Deploy from a branch → main / root → Save**.
4. Wait ~1 min. Your URL is `https://YOUR_USERNAME.github.io/tab-organizer-privacy/`.
5. Open it to confirm it shows the policy.

## Put the URL in the dashboard
Developer Dashboard → your item → **Privacy** tab → **Privacy policy** field → paste the
exact Pages URL above (the one that opens the policy directly) → Save → Submit for review.

## Re-submission checklist
- [ ] Placeholder email replaced.
- [ ] URL opens directly to the policy page (not a homepage / redirect / 404).
- [ ] Data-usage disclosures on the Privacy tab still checked (Web history,
      Authentication information) and all three certifications ticked.
