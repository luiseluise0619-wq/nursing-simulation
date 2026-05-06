# Nurse Simulator · 간호사 시뮬레이터

A free bilingual (KO/EN) PWA for nursing study — randomized board-style questions plus a survival "shift" mode with bosses and combos.

[![PWA](https://img.shields.io/badge/PWA-installable-6366f1)](#install)
[![License](https://img.shields.io/badge/license-Educational%20Use-blue)](#license)

## Features

- **90+ randomized questions** across 8 nursing-board subjects (Fundamentals, Adult, Maternal, Pediatric, Community, Psychiatric, Management, Health Laws)
- **Bilingual KO/EN** — full UI and content translation, instant toggle, persisted preference
- **Survival shift mode** — 20 events per shift with 3 boss encounters (Code Blue, VIP, Mass Casualty), combo system, and 10 daily ward flavor events
- **Training mode** — pick any of the 8 subjects and grind randomized questions with rationale feedback
- **Lifetime stats** — total solved, best combo, best reputation, duties completed
- **Offline-first PWA** — installable on iOS/Android/desktop, works without network after first load
- **Zero backend** — pure static site, all state in `localStorage`

## Demo

Open `index.html` in any modern browser (Chrome, Safari, Edge, Firefox).

## Deploy

This is a static site. Deploy anywhere that serves files over HTTPS.

### GitHub Pages (free)

```bash
git push origin main
# Repo settings → Pages → Source: main / root
```

Your app will be live at `https://<username>.github.io/<repo>/`.

### Vercel / Netlify / Cloudflare Pages

Drop the repo in. No build step required. Set the publish directory to `/`.

### Self-hosted

Any static-file server works:

```bash
npx serve .
# or
python3 -m http.server 8000
```

> **Important**: PWA service worker only registers under `https://` (or `http://localhost`). When opened directly via `file://`, the app still works but offline caching is disabled.

## Install (PWA)

- **Mobile**: open the deployed URL → browser menu → "Add to Home Screen"
- **Desktop Chrome**: address-bar install icon (▾)
- **iOS Safari**: Share → "Add to Home Screen"

## Pre-launch checklist

Before publishing to a store or wide audience:

- [ ] **Generate PNG icons** (192×192 and 512×512). The current `icons/icon.svg` works for most modern PWAs but iOS Safari prefers PNG. Use any SVG-to-PNG converter (rsvg-convert, Inkscape, online tools).
- [ ] **Have the medical content reviewed** by a licensed RN/MD. The first-launch disclaimer covers educational-use liability but professional review reduces risk.
- [ ] **Privacy policy** (required if you add analytics/ads). The current build collects nothing remote.
- [ ] **Set canonical domain** in `<meta property="og:url">` after deciding the production URL.
- [ ] **Bump version** in `manifest.json` and `service-worker.js` (`CACHE_NAME`) when shipping updates so users get the new shell.
- [ ] **Test offline flow** — install the PWA, kill network, reload — should still launch.
- [ ] **Test both languages** end-to-end (menu → quiz → survival → boss → endings).

## File map

```
.
├── index.html          # App shell, all CSS, mobile meta, disclaimer modal
├── script.js           # Game logic, i18n, 93 questions + 10 flavors + 3 bosses
├── manifest.json       # PWA manifest
├── service-worker.js   # Offline cache (cache-first)
├── icons/icon.svg      # App icon (gradient + medical cross)
├── main.js             # Optional Electron desktop wrapper (not used for web)
├── package.json        # Electron dev dependency only
└── README.md
```

## Development notes

- **No build step.** Edit files, refresh.
- **Adding a question**: define a generator returning `{ baseId, categoryKey, part, emoji, title, desc, choices }` where each `choice` has `text`, `effect: { hp, rep }`, `log`. Wrap content in `loc(ko, en)`. Register in the `clinicalGenerators` array.
- **Adding a UI string**: add to the `T` object with `ko` and `en` keys, then call `t("yourKey")`.
- **i18n filter**: questions match by `categoryKey` ("fundamentals", "adult", "maternal", "pediatric", "community", "psych", "management", "law") so both languages share the same filter.
- **Service worker**: bump `CACHE_NAME` to invalidate the cache on deploy.

## Disclaimer

This app is provided **solely as an educational aid** for nursing study. It must not be used to guide actual clinical decision-making. All clinical actions must follow your licensed clinician's judgment and your institution's protocols. Questions and rationales are based on general guidelines and accuracy is not guaranteed. **Seek qualified medical help immediately in any emergency.**

## License

Educational use only. Not for resale. © 2025.
