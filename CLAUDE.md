# CLAUDE.md

This file guides Claude Code's behavior in this repository.
Based on [Karpathy's LLM coding observations](https://github.com/forrestchang/andrej-karpathy-skills).

---

## 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

- **State assumptions explicitly** — If uncertain, ask rather than guess.
- **Present multiple interpretations** when the request is ambiguous.
- **Push back** if a simpler approach exists.
- **Stop when confused** — name what's unclear and ask.

## 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If 200 lines could be 50, rewrite it.

**Test:** Would a senior engineer say this is overcomplicated? If yes, simplify.

## 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style (Korean comments OK, 4-space indent, no semicolons in JSON).
- If you notice unrelated dead code, **mention it, don't delete it**.
- Remove imports/vars/functions that *your* changes orphaned. Leave pre-existing
  dead code alone unless asked.

**Test:** Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

Define success criteria. Loop until verified.

| Instead of... | Transform to... |
|---|---|
| "Add validation" | "Write tests for invalid inputs, then make them pass" |
| "Fix the bug" | "Write a test that reproduces it, then make it pass" |
| "Refactor X" | "Ensure tests pass before and after" |

For multi-step tasks, state a brief plan with verification steps.

---

## Project-Specific (간호사 시뮬레이터)

### Stack
- **Static PWA** (no build framework): `index.html` + `script.js` + `styles.css`
- **Capacitor 7** wraps for Android (`webDir: "www"`)
- **AdMob** rewarded ads only (no banner/interstitial)
- **i18n**: ko / en / fil / es (`i18n.js`)
- **Storage**: `localStorage` key `nurseSim:v1`, validated via `Storage.validate()`

### Build Pipeline
```bash
npm run build:web        # root → www/ 동기화
npm run sync:android     # build:web + npx cap sync android
npm test                 # Jest 2,436개
npm run launch:check     # 출시 27개 점검
npm run launch:ready     # build + test + check 통합
```

### Hard Rules
- **Run `npm test` after every script.js / styles.css change.** Don't skip.
- **Bump SW cache version** (`sw.js` `CACHE = "nurse-sim-vN"`) when changing
  any precached file. Forces existing user re-cache.
- **Sync www/** after script/style/i18n changes: `npm run build:web`.
- **AdMob policy**: never call `Ads.showRewarded()` without explicit user click
  (button → handler). No auto-trigger.
- **Medical content**: AHA / KNCA / NPSG / NPIAP / USPSTF sources only.
  Never invent dosages, half-lives, or guidelines.
- **Korean exam date**: hardcoded in `KOREAN_EXAM_BASE`. Auto-advances year
  after 4 days post-exam (`getKoreanExamDate()`).

### File Layout
```
script.js              # ~7,500 lines, main game logic
content.js             # NurseQuestions (scenarios)
kor-content.js         # Korean exam 320 questions
nclex-content.js       # NCLEX 2,200 questions (lazy-loaded, 2MB)
i18n.js                # 4-language strings
images/                # 50 SVG + 20 WebP clinical illustrations
images/image-map.js    # CLINICAL_IMAGE_MAP key → file path
store-assets/          # Play Console PNG uploads (icons, splash, screenshots)
tests/                 # Jest unit + integration (2,436 tests)
tests/e2e/             # Playwright critical paths
android/               # Capacitor Android project
www/                   # build output (gitignored, generated)
sw.js                  # Service Worker, bump version when changing
vercel.json            # Vercel static deploy from root
scripts/launch-check.js # Pre-release auditor
```

### Don't Touch Unless Asked
- `nclex-content.js` / `kor-content.js` content (medical accuracy critical)
- `images/` files (already curated 50 SVG + 20 WebP)
- `android/app/build.gradle` signing config
- `capacitor.config.json` AdMob app ID
- `privacy.html` (must reflect AdMob status accurately for Play Console)

### Style Conventions
- Korean comments OK in domain logic. English comments OK in infra/utility.
- No JSDoc unless explicitly requested.
- No new test files for trivial CSS-only changes.
- Inline SVG for icons (no external icon library).
- Use existing CSS custom properties (`var(--primary)` etc.), don't introduce
  hardcoded hex colors.

### When in Doubt
Run `npm run launch:check` — if it reports 27/27, the codebase is launchable.
Failures point to exactly what's broken.
