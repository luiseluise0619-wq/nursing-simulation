# Nurse Simulator · 간호사 시뮬레이터

A free bilingual (KO/EN) PWA for nursing study — 934 randomized board-style questions (158 SVG image-based) plus a survival "shift" mode with bosses, combos, and image-based clinical scenarios. **v4.3 — soft neumorphic / sage-green design.**

[![PWA](https://img.shields.io/badge/PWA-installable-6366f1)](#install)
[![License](https://img.shields.io/badge/license-Educational%20Use-blue)](#license)

## Features

- **934 randomized clinical questions** (776 text + **158 image-based** SVG questions covering ECG strips, anatomy, scales, positioning, respiratory patterns, breath sounds, urine sediment, RBC morphology, IV complications, BP cuff sizing, traction, isolette, Babinski/Kernig, jaundice, clubbing, cyanosis, AED, GCS, oxygen devices, restraints, ABG, bladder scan, Ishihara, dermatomes, Chvostek/Trousseau, MI radiation, labor stages, murmur grading, abuse cycle, fetal monitoring strips, PPE types, pregnant positioning, ostomy sites, blanchable test, apnea test, and procedure visuals) across 8 nursing-board subjects, including **NCLEX-style** delegation, HIPAA, and drug calculation questions
- **Image questions appear in survival mode too** — clinical scenarios in shift mode include ECG strips, scoring scales, anatomy diagrams (~15% of events)
- **Bilingual KO/EN** — full UI and content translation, instant toggle, persisted preference
- **Survival shift mode** — 20 events per shift with 3 boss encounters (Code Blue, VIP, Mass Casualty), combo system, and **30 daily ward flavor events**
- **13 narrative endings** — happy / sad / bittersweet / easter-egg branches based on accuracy, bosses, key story choices
- **Training mode** — 8 subjects + **subtopic filter** (e.g., within Adult Nursing, drill only "Cardiovascular" or "Endocrine")
- **🧠 Spaced Repetition (SRS Leitner 5-box)** — proper Leitner scheduling (immediate / 1 day / 3 days / 7 days / 14 days). Correct → box +1, wrong → box 1. Only due cards shown.
- **🔁 Wrong-answer review (오답노트)** — wrong answers auto-saved; review on demand; mastered ones auto-removed
- **⭐ Bookmarks** — star any question during quiz to revisit later
- **⏱️ Timed Mock Exam** — 30 questions in 30 minutes with countdown timer
- **🖼️ Image-based questions** — inline SVG ECG strips, anatomical diagrams, position diagrams. No external images, fully offline.
- **Lifetime stats** — total solved, best combo, best reputation, duties completed (persisted)
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

## Known limitations & roadmap

Honest list of what's missing — useful as backlog, also useful for setting expectations with users:

**Content**
- 508 questions covers most Korean Boards topics; **still below commercial bank apps (1,000–5,000)**. Continue adding ~50/year.
- No "5-year past exam" verbatim coverage — questions are *style* equivalents, not exact reproductions of past Korean Boards items.
- Rationales are short; deeper references (e.g., journal citation, image, table) are not provided.
- A few answers reflect **traditional board teaching** (MI MONA, glaucoma miotic, pancreatitis meperidine) where modern guidelines have evolved. Kept aligned with current Korean Boards answer keys.

**Study tools (shipped)**
- ✅ **Wrong-answer review (오답노트)** — auto-tracked, review on demand, mastered ones auto-removed
- ✅ **Bookmarks** — star any question during quiz, review starred later
- ✅ **Timed exam mode** — 30 questions × 30 minutes with countdown timer
- ✅ **Spaced repetition (SRS Leitner)** — proper 5-box scheduling (0/1/3/7/14 days). Correct → up a box, wrong → box 1.
- ✅ **Subtopic filter** — pick a category, then drill into a specific `part` (e.g., Adult → Cardiovascular only)
- ✅ **Image-based questions** — 75 SVG image questions (ECG, pressure ulcer, triage, anatomy, positioning, reflexes, scales, drug calc)

**Platform**
- ✅ **PNG icons** — favicon-32, favicon-64, icon-192, icon-512, icon-512-maskable, apple-touch-icon
- ✅ **Capacitor config** included (`capacitor.config.json`); wrap as native iOS/Android app
- ❌ **No analytics** (intentional for v3, but means no insight into which questions confuse users)
- ❌ **No accounts / cloud sync** — switching device loses progress
- ❌ **No social features** (share scores, leaderboard)

**Production polish**
- 🟡 Privacy policy, terms of service text — required by Play/App Store; not included.
- 🟡 Medical content review by licensed RN/MD recommended before mass distribution (current disclaimer covers educational use).
- 🟡 Production OG/Twitter card image (currently uses SVG icon, may not render on all platforms).

**Suggested roadmap**
1. **v1.1**: Add wrong-answer review + bookmark/flag — 1 week
2. **v1.2**: Spaced repetition (Leitner-style buckets in localStorage) — 1 week
3. **v1.3**: Timed exam mode (mock NCLEX/Boards) — 3 days
4. **v1.4**: 50 more questions, including image-based via SVG — 2 weeks
5. **v1.5**: Capacitor wrap → Play Store TestFlight → public — 1-2 weeks
6. **v2.0**: Optional cloud sync (Supabase free tier), spaced repetition with cloud backup

## Native app build (Capacitor)

To wrap as a native iOS/Android app for Play Store / App Store:

```bash
# 1. Install Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android

# 2. Initialize (run once)
npx cap init "Nurse Simulator" com.yourname.nursesim --web-dir=.

# 3. Add platforms
npx cap add ios
npx cap add android

# 4. Sync your web assets into native projects
npx cap sync

# 5. Open in native IDE
npx cap open ios       # Xcode (macOS only)
npx cap open android   # Android Studio
```

Build/sign/publish from Xcode or Android Studio. For ads, integrate `@capacitor-community/admob`. For IAP, integrate `@capacitor-community/in-app-purchases`.

**Required before store submission:**
- Privacy policy URL (the app collects no remote data, but Stores require a published policy)
- Terms of service URL
- Medical disclaimer (already in app — first-launch modal)
- Optional: medical professional review sign-off

## Medical-review export

To send all questions to a clinician for review:

```bash
node tools/export-questions.js > questions-for-review.csv
```

The CSV contains every question in both KO and EN (24 columns including question text, all 4 choices with correct flag, rationale, image flag, and blank `review_status`/`reviewer_notes` columns). Open in Excel/Numbers/Sheets, distribute to RN/MD reviewers.

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
