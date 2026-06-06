# AI 이미지 생성 통합 가이드 (간호사 시뮬레이터)

> **사용법**: 번호 순서대로 한 줄씩 복사 → AI(DALL-E/Midjourney/Gemini Imagen)에 붙여넣기 → 결과를 저(Claude)에게 전송. 파일명 정확하게.

---

## 공통 설정

| 항목 | 값 |
|------|-----|
| **포맷** | WebP 권장 (PNG 도 OK) |
| **브랜드 컬러** | Primary: `#7fa881` (sage green) · Background: `#eef2f5` |
| **스타일** | Medical illustration / clean / Apple HIG 톤 |
| **금지** | 잔혹/혐오, 실제 환자 식별 얼굴, 정치적 상징 |
| **저작권** | DALL-E / Midjourney 생성물 = 상업적 사용 OK (제3자 콘텐츠 회피) |

---

## 섹션 A. 앱 아이콘 & 스플래시 (출시 필수, 8개)

### 1. Play Store 메인 아이콘 (512×512 PNG)
파일명: `icon-store-512.png`
```
Square app icon design, 512x512 pixels, soft rounded square with sage green gradient (#9ec0a0 to #7fa881).
Center: white stethoscope curved into "S" shape + small medical cross.
Subtle drop shadow for depth. Flat modern design (iOS 17 / Material 3 style).
No text. No photo realism. Vector-clean.
```

### 2. Android Adaptive Icon Foreground (432×432 PNG, 투명 배경)
파일명: `icon-adaptive-foreground.png`
```
Adaptive icon foreground layer, 432x432 pixels, transparent background.
Centered (200x200 safe zone) white stethoscope curved as "S" with tiny medical cross.
No background. No padding to edges (center 50% only). Vector.
```

### 3. iOS App Icon (1024×1024 PNG, 라운드 X)
파일명: `icon-ios-1024.png`
```
iOS app icon, 1024x1024 pixels, full square (no rounded corners — iOS applies them).
Sage green gradient background (#9ec0a0 top → #7fa881 bottom).
Centered white stethoscope motif curved into "S" + small white medical cross.
Subtle inner shadow for depth. Clean, premium feel. No text.
```

### 4. Splash 스크린 (1080×1920 PNG)
파일명: `splash-1080x1920.png`
```
Mobile splash screen 1080x1920 portrait. Background: solid #eef2f5 light beige-gray.
Center vertical: 200px sage green rounded square icon (same stethoscope mark)
+ below it "간호사 시뮬레이터" in Pretendard bold dark text + tagline below "한국 간호 학습 + 임상 시뮬".
Lots of negative space, calming, premium app feel.
```

### 5. Splash 스크린 다크 (1080×1920 PNG)
파일명: `splash-1080x1920-dark.png`
```
Same as #4 but dark background #161b27, lighter sage primary #aacaa9 for icon,
text in #ecedf0.
```

### 6. Favicon 32×32 (PNG)
파일명: `favicon-32.png`
```
32x32 pixel favicon. Sage green (#7fa881) rounded square with simplified white "S" stethoscope curve.
Crisp at small size, no fine details.
```

### 7. Apple Touch Icon 180×180 (PNG)
파일명: `apple-touch-180.png`
```
Apple touch icon 180x180, full square. Same design as #3 but lower resolution.
Sage green background, white stethoscope-S mark, no rounded corners.
```

### 8. Open Graph 소셜 미리보기 (1200×630 PNG)
파일명: `og-1200x630.png`
```
Open Graph image 1200x630 landscape. Background sage gradient #eef2f5 to #d8e4d9.
Left side (40%): large stethoscope-S mark in sage green.
Right side (60%): "간호사 시뮬레이터" Pretendard 80pt bold dark text +
"국시 + NCLEX-RN 무료 학습 앱" subtitle 32pt #64748b.
Clean, premium, Korean tech startup style.
```

---

## 섹션 B. Play Store 스크린샷 (8장, 1080×1920)

> **목적**: 다운로드 결정. 텍스트 오버레이로 가치 즉시 전달.

### 9. 스크린샷 1 — 메인 히어로
파일명: `store-screen-1-hero.png`
```
Korean nursing exam study app screenshot mockup 1080x1920 portrait.
iPhone-style mockup frame. Top 1/3: bold Korean headline "국시 + NCLEX 2,200 문제 무료" in sage on white.
Below: app screenshot showing main menu with three big cards (풀이/시뮬레이션/훈련).
Bottom: small tagline "광고 거의 없음 · 회원가입 없음".
Clean, premium, Notion-app aesthetic.
```

### 10. 스크린샷 2 — 임상 시뮬레이션
파일명: `store-screen-2-sim.png`
```
1080x1920 screenshot mockup. Headline "실제 듀티처럼 — 35편 시뮬레이션".
Below: app showing an episode card with patient narrative + 4 choice buttons +
HP/평판 게이지. Bottom: "약물·V/S·우선순위 결정 연습".
Sage accent. Korean.
```

### 11. 스크린샷 3 — NCLEX 영문
파일명: `store-screen-3-nclex.png`
```
1080x1920 screenshot. Headline (English): "NCLEX-RN Practice — 2,200 Questions Free".
App showing NCLEX category list + a sample MCQ question in English.
Subtitle: "MCQ · SATA · Priority — UWorld-level depth".
Sage palette. International feel.
```

### 12. 스크린샷 4 — 약점 분석
파일명: `store-screen-4-weakness.png`
```
1080x1920 mockup. Headline "내 약점을 자동으로 — AI 학습 분석".
App showing dashboard with category-by-category accuracy bars + "가장 약한 토픽 TOP 5".
Sage accents on weak/strong indicators.
```

### 13. 스크린샷 5 — 이미지 문제
파일명: `store-screen-5-images.png`
```
1080x1920 mockup. Headline "ECG · 청진 · 산과 — 시각 자료 83+".
Show clinical SVG (e.g., ECG strip) + question "이 리듬은?" + 4 choices.
Sage palette, medical aesthetic.
```

### 14. 스크린샷 6 — 약물 드릴
파일명: `store-screen-6-drugs.png`
```
1080x1920 mockup. Headline "핵심 약물 50종 — 작용·부작용·모니터".
App showing drug drill question "Furosemide 의 주요 부작용은?" + choices + rationale preview.
```

### 15. 스크린샷 7 — 배지·기록
파일명: `store-screen-7-badges.png`
```
1080x1920 mockup. Headline "꾸준한 학습 = 성취 배지".
App showing badge collection grid (7 badges unlocked, some locked).
Streak banner "🔥 14일 연속" at top. Achievement modal preview.
```

### 16. 스크린샷 8 — 무료 + 프리미엄 옵션
파일명: `store-screen-8-pricing.png`
```
1080x1920 mockup. Headline "지금은 모두 무료 — 프리미엄 ₩4,900 곧 출시".
Show premium page with monthly/yearly pricing cards + 6 feature list.
Sage palette, premium feel.
```

---

## 섹션 C. 임상 이미지 (36개, 학습 임팩트 큰 순)

> 모두 800×600 (4:3) WebP. 의학 일러스트 스타일. 흰 배경.

### 17. ECG — Normal Sinus Rhythm
파일명: `ecg-nsr.webp`
```
Medical illustration of ECG strip showing Normal Sinus Rhythm.
Clean educational style, white background, monochrome dark blue waveform.
Pink grid lines (1mm small / 5mm large pattern).
4-5 cardiac cycles visible. P wave + QRS + T wave each clearly defined.
No labels. 800x600 landscape.
```

### 18. ECG — ST Elevation MI (STEMI)
파일명: `ecg-stemi.webp`
```
Medical illustration of ECG strip showing acute STEMI.
Clear ST segment elevation (1-2mm above baseline) after QRS.
Hyperacute T waves. Clean educational style.
White background, dark blue waveform, pink grid (1mm/5mm).
800x600 landscape.
```

### 19. ECG — Ventricular Tachycardia
파일명: `ecg-vtach.webp`
```
Medical illustration of ECG strip showing monomorphic Ventricular Tachycardia.
Wide bizarre QRS, regular, ~180 bpm. No P waves.
Clean style, white background, dark blue trace, pink grid.
800x600 landscape.
```

### 20. ECG — Ventricular Fibrillation
파일명: `ecg-vfib.webp`
```
Medical illustration of ECG strip showing Ventricular Fibrillation.
Chaotic, irregular, no discernible QRS. Coarse VF.
White background, dark blue, pink grid. 800x600.
```

### 21. ECG — Atrial Fibrillation
파일명: `ecg-afib.webp`
```
Medical illustration of ECG strip showing Atrial Fibrillation.
No P waves, irregular R-R intervals, narrow QRS, fibrillatory baseline.
White background, dark blue, pink grid. 800x600 landscape.
```

### 22. ECG — Supraventricular Tachycardia
파일명: `ecg-svt.webp`
```
ECG strip showing SVT: narrow QRS, regular rhythm, ~180-200 bpm.
P waves often buried in T or absent. White bg, dark blue. 800x600.
```

### 23. ECG — Asystole
파일명: `ecg-asystole.webp`
```
ECG strip showing asystole: flat line with very minor baseline noise.
Confirm in 2 leads concept. White bg, dark blue. 800x600.
```

### 24. CXR — Pneumonia (RLL)
파일명: `cxr-pneumonia.webp`
```
Chest X-ray (PA view) showing right lower lobe pneumonia consolidation.
Black background, light gray lungs, dense opacity in RLL with air bronchograms.
Red arrow pointing to consolidation. Educational textbook style. 800x800.
```

### 25. CXR — Pneumothorax (Left)
파일명: `cxr-pneumothorax.webp`
```
Chest X-ray showing left-sided pneumothorax.
Visible pleural line, absent lung markings lateral to it, partial lung collapse.
Black bg, gray anatomy. Red arrow at pleural edge. 800x800.
```

### 26. CXR — Pleural Effusion (Right)
파일명: `cxr-effusion.webp`
```
Chest X-ray showing right pleural effusion.
Blunting of costophrenic angle, meniscus sign at the lateral chest wall.
Educational illustration style. 800x800.
```

### 27. CXR — Cardiomegaly
파일명: `cxr-cardiomegaly.webp`
```
Chest X-ray showing cardiomegaly with cardiothoracic ratio >0.5.
Enlarged cardiac silhouette dominating mediastinum.
Black bg, gray anatomy. 800x800.
```

### 28. 청진 — Crackles (하부 폐)
파일명: `ausc-crackles.webp`
```
Anatomical chest illustration, posterior view, beige skin tone.
4 lung zones marked (RUL, LUL, RLL, LLL) as circles.
Lower zones (RLL, LLL) highlighted in red-orange = abnormal.
Upper zones in muted blue = normal.
Label "Crackles (lower)" below. Clean medical style. 800x600.
```

### 29. 청진 — Wheeze (하부)
파일명: `ausc-wheeze.webp`
```
Same chest illustration as #28. Lower lung zones highlighted in red-orange.
Label "Wheeze (lower)". 800x600.
```

### 30. 청진 — Wheeze (전반적)
파일명: `ausc-wheeze-diffuse.webp`
```
Same chest illustration. ALL 4 zones in red-orange.
Label "Diffuse wheeze — severe asthma/anaphylaxis". 800x600.
```

### 31. 청진 — Stridor (상기도)
파일명: `ausc-stridor.webp`
```
Chest + neck anatomical illustration. Upper airway (larynx area) highlighted in red.
Label "Stridor (upper airway)". Beige skin. 800x600.
```

### 32. 청진 — 정상
파일명: `ausc-normal.webp`
```
Same chest illustration as #28. All 4 zones in calm sage green.
Label "Normal — clear all zones". 800x600.
```

### 33. FHR — Late Deceleration
파일명: `fhr-late.webp`
```
Fetal heart rate monitoring strip (1080x400 wide landscape ratio, but resize to 800x400).
Top: FHR (baseline 140 bpm, dips occurring AFTER uterine contraction peaks — late decel pattern).
Bottom: uterine contractions (rhythmic bumps).
Pink grid, dark blue tracing. White background.
```

### 34. FHR — Early Deceleration
파일명: `fhr-early.webp`
```
Fetal HR strip. Decelerations MIRROR contractions (start with contraction, end with contraction). Mirror image pattern.
800x400 landscape, pink grid, dark blue trace.
```

### 35. FHR — Variable Deceleration
파일명: `fhr-variable.webp`
```
Fetal HR strip. Abrupt V or U shaped decelerations, variable timing/depth relative to contractions.
800x400 landscape.
```

### 36. FHR — Accelerations
파일명: `fhr-accel.webp`
```
Fetal HR strip. Reassuring accelerations — 15 bpm rise above baseline for ≥15 sec.
Healthy reactive pattern. 800x400 landscape.
```

### 37. 동공 — Fixed Dilated
파일명: `pupil-fixed-dilated.webp`
```
Close-up illustration of two human eyes side by side. Beige skin tone.
Both pupils 8mm bilateral, fully dilated, unresponsive (no light reaction).
Iris brown. Clean medical educational style, white background. 800x400.
```

### 38. 동공 — Pinpoint
파일명: `pupil-pinpoint.webp`
```
Same two-eye close-up. Both pupils constricted to 1-2mm pinpoint.
Suggests opioid intoxication or pontine lesion.
800x400 landscape.
```

### 39. 동공 — Anisocoria
파일명: `pupil-anisocoria.webp`
```
Same two-eye close-up. LEFT pupil 8mm dilated, RIGHT pupil 3mm normal.
Asymmetric. Suggests transtentorial herniation on left side.
800x400 landscape.
```

### 40. 상처 — Stage 2 압창
파일명: `wound-stage2.webp`
```
Medical educational illustration of Stage 2 pressure ulcer on the sacral region.
Cross-section view showing partial thickness skin loss (epidermis + dermis).
Shallow open ulcer or fluid-filled blister.
NOT photorealistic (avoid disturbing imagery). Textbook style.
Beige skin tone. 800x600.
```

### 41. 상처 — Stage 3 압창
파일명: `wound-stage3.webp`
```
Medical illustration Stage 3 pressure ulcer (sacrum).
Cross-section: full thickness skin loss, subcutaneous fat exposed, but no muscle/bone.
Granulation tissue visible. Educational textbook style. 800x600.
```

### 42. 상처 — Stage 4 압창
파일명: `wound-stage4.webp`
```
Medical illustration Stage 4 pressure ulcer (heel).
Cross-section showing full thickness with muscle, tendon, or bone exposed.
Slough or eschar may be present. Educational style. 800x600.
```

### 43. 상처 — Infected
파일명: `wound-infected.webp`
```
Medical illustration of an infected wound.
Surrounding erythema, purulent yellow discharge, swelling.
Cross-section style, educational, not photoreal. 800x600.
```

### 44. 9의 법칙 (Rule of Nines)
파일명: `rule-of-nines.webp`
```
Adult human body diagram (anterior + posterior side by side).
Labeled with % body surface area: Head 9%, each arm 9%, anterior trunk 18%,
posterior trunk 18%, each leg 18%, perineum 1%.
Clean medical chart style, white bg, sage and orange accents. 800x600.
```

### 45. AED — 성인 패드 위치
파일명: `aed-adult.webp`
```
Anatomical anterior torso illustration of adult.
Two AED pads marked: upper right chest (below clavicle) + lower left chest (lateral, below pectoral).
Pads with cable. Beige skin. White bg. Label "Adult AED placement". 800x800.
```

### 46. AED — 소아 패드 위치
파일명: `aed-child.webp`
```
Anterior torso illustration of small child.
AED pads in sandwich position: one on center chest (sternum) + one on center back.
Beige skin. White bg. Label "Pediatric AED placement (sandwich)". 800x800.
```

### 47. 자궁저 — 28주
파일명: `fundal-28.webp`
```
Pregnant woman lateral profile illustration showing fundal height at 28 weeks gestation.
Fundus at level marked above umbilicus. Beige skin, side view. Clean medical style.
800x600.
```

### 48~52. 자궁저 — 30, 32, 36, 40주 (4 추가)
파일명: `fundal-30.webp`, `fundal-32.webp`, `fundal-36.webp`, `fundal-40.webp`
```
Same as #47 but fundus at respective gestation level:
- 30주: 3cm above umbilicus
- 32주: 1/3 between umbilicus and xiphoid
- 36주: at xiphoid
- 40주: just below xiphoid (lightening may be visible)
```

### 53. GCS — 낮은 의식
파일명: `glasgow-low.webp`
```
Medical infographic illustration of GCS components.
Three columns: Eye (E1-4), Verbal (V1-5), Motor (M1-6).
Lower scores highlighted in red. Educational style.
Brief Korean labels: 개안/언어/운동. 800x600.
```

### 54. 피부 — Cyanosis (청색증)
파일명: `skin-cyanosis.webp`
```
Close-up illustration of patient lips + fingertips showing peripheral cyanosis.
Bluish discoloration. Beige base skin tone with blue-purple tint on extremities.
Educational textbook style, not photoreal. 800x600.
```

### 55. 피부 — Pallor (창백)
파일명: `skin-pallor.webp`
```
Illustration of patient palm and face showing severe pallor.
Pale beige, almost white. Adjacent comparison with normal skin tone.
Educational style. 800x600.
```

### 56. 피부 — Jaundice (황달)
파일명: `skin-jaundice.webp`
```
Close-up illustration of patient eyes (showing yellow sclera) and skin (jaundiced beige with yellow tint).
Educational textbook style. 800x600.
```

### 57. 피부 — Mottled (얼룩덜룩)
파일명: `skin-mottled.webp`
```
Close-up of patient extremity (e.g., infant leg or adult arm) showing mottled appearance —
reticular blue-purple pattern suggesting poor perfusion.
Educational style, beige + purple-blue mottling. 800x600.
```

### 58. 소변 — Dark (어두운 — 탈수/간)
파일명: `urine-dark.webp`
```
Medical illustration of urine sample in clear container.
Side-by-side: dark amber/cola-colored urine (left) vs normal yellow urine (right).
White lab background. Labels in subtle font. 800x400.
```

### 59. 소변 — Foamy (거품뇨, 단백뇨)
파일명: `urine-foamy.webp`
```
Same comparison style as #58. Left: foamy urine with bubbles suggesting proteinuria.
Right: normal clear yellow. 800x400.
```

### 60~62. AED 사용 단계 (선택적, 3장)
파일명: `aed-step1.webp`, `aed-step2.webp`, `aed-step3.webp`
```
3-panel comic-style illustration of CPR + AED sequence.
1: 의식 확인 + 119 신고
2: 가슴 압박 시작
3: AED 도착 → 패드 부착 → 분석 → 충격
Clean line art, sage accent colors, white bg. Each 800x800.
```

---

## 섹션 D. 빈 상태 일러스트 (앱 내, 6개)

### 63. 오답노트 0건
파일명: `empty-no-wrong.png`
```
Friendly minimalist illustration, 400x400, transparent background.
Notebook with green checkmark + small celebrating sparkles.
Sage green primary (#7fa881) + soft beige accent. Modern flat style (Linear app aesthetic).
No text. No human figure.
```

### 64. 북마크 0건
파일명: `empty-no-bookmarks.png`
```
400x400 transparent. Empty bookmark/star outline with sage hint of color.
Minimal, friendly, "yet to start" feel. Flat modern.
```

### 65. 약점 분석 데이터 부족
파일명: `empty-no-data.png`
```
400x400 transparent. Stylized bar chart with all bars at 0 + small upward arrow indicating future growth.
Sage primary. Encouraging mood. Flat minimal.
```

### 66. 검색 결과 없음
파일명: `empty-no-search.png`
```
400x400. Magnifying glass with question mark inside. Soft sage outline.
Friendly "not found" feel.
```

### 67. 이미지 문제 없음
파일명: `empty-no-images.png`
```
400x400. Empty image frame with small camera icon. Sage outline.
"Will be added" feel.
```

### 68. 리더보드 빈 기록
파일명: `empty-no-records.png`
```
400x400. Trophy outline with subtle sparkles. Sage + gold accent.
"Make your first record" mood.
```

---

## 섹션 E. 온보딩 슬라이드 (5장, 1080×1920)

### 69. 온보딩 1 — 환영
파일명: `onboard-1-welcome.png`
```
1080x1920 portrait illustration. Top: friendly nurse character (stylized, modern flat) holding clipboard.
Background: sage green soft gradient. Bottom 1/3 reserved for text (don't add text).
"Welcome — let's start the duty" feel. Modern Korean app illustration style.
```

### 70. 온보딩 2 — 시뮬레이션 모드
파일명: `onboard-2-simulation.png`
```
1080x1920. Hospital ward scene with stylized patient bed + monitors + IV pole.
Flat modern illustration. Sage palette. Bottom 1/3 empty for text.
"Real duty practice" mood.
```

### 71. 온보딩 3 — NCLEX 듀얼
파일명: `onboard-3-nclex.png`
```
1080x1920. Two flags or symbols side by side: 🇰🇷 + 🇺🇸 with bridge between.
"Dual exam preparation" theme. Books/stethoscope motif.
Modern flat sage palette. Bottom text area empty.
```

### 72. 온보딩 4 — 약점 분석
파일명: `onboard-4-analytics.png`
```
1080x1920. Stylized analytics dashboard floating with growth chart + lightbulb (insight icon).
"Find your weak spots" theme. Sage accents.
```

### 73. 온보딩 5 — 출발
파일명: `onboard-5-start.png`
```
1080x1920. Nurse character at hospital door, looking forward with confident pose.
Morning light/optimism mood. Sage palette.
"Start your first duty" feel.
```

---

## 섹션 F. 마케팅 — 인스타그램 콘텐츠 (8장)

### 74. 인스타 릴스 커버 1 (1080×1920)
파일명: `insta-reel-cover-1.png`
```
1080x1920 vertical reel cover. Top text "간호사 국시 무료 앱" big bold Korean.
Center: phone mockup showing app menu. Bottom: small "@간호사시뮬레이터".
Sage + cream palette. Korean Gen-Z app aesthetic (similar to Toss/Karrot style).
```

### 75. 인스타 릴스 커버 2 — NCLEX
파일명: `insta-reel-cover-2.png`
```
1080x1920. Top: "NCLEX 2,200 문제 무료". Center: stethoscope + American flag accent.
Bottom: app handle. Same sage + cream Korean Gen-Z app style.
```

### 76. 인스타 포스트 정사각 1 — 통계
파일명: `insta-post-stats.png`
```
1080x1080 square. Title "왜 만들었나" Korean.
List with sage check marks:
✓ 한국 국시 1,000+ 문제
✓ NCLEX 2,200 문제
✓ 35편 임상 시뮬
✓ 광고 거의 없음
✓ 회원가입 없음
✓ 무료
Sage on cream, premium feel.
```

### 77. 인스타 포스트 정사각 2 — 무료 강조
파일명: `insta-post-free.png`
```
1080x1080. Center huge text "무료" in sage.
Around it small text "광고는 부활/힌트 광고만 (선택)". 
Subtle sparkles, premium minimal.
```

### 78. 인스타 카루셀 1 — 비교
파일명: `insta-carousel-comparison.png`
```
1080x1080. Comparison table:
Column 1: UWorld $39/month, 2,200 문제
Column 2: 간호사 시뮬레이터, 무료, 2,520 문제
Highlight column 2 in sage. "왜 무료가 더 나음" caption.
```

### 79. 인스타 스토리 1 (1080×1920, 풀화면)
파일명: `insta-story-1.png`
```
1080x1920 story. Big text top "오늘 듀티 한 번 돌아볼래?".
Background app menu screenshot. Sage swipe-up sticker location bottom.
Friendly casual tone.
```

### 80. 카카오톡 공유 카드 (1200×630)
파일명: `kakao-share-1200x630.png`
```
1200x630 share card. Sage gradient background.
Left: app icon. Right: "간호사 시뮬레이터 — 국시 + NCLEX 무료" Korean Pretendard bold.
Below: "다운로드 받기 →" small CTA.
```

### 81. 네이버 카페 게시용 (800×600)
파일명: `naver-cafe-post.png`
```
800x600 horizontal. Korean cafe post style.
Title: "졸업한 선배가 만든 무료 간호 국시 앱".
Below: app menu screenshot + 3 highlight bullet points.
Friendly homemade vibe, not corporate.
```

---

## 섹션 G. 추가 (선택, 출시 후)

### 82~89. 캐릭터 일러스트 (8명 환자 캐릭터)
파일명: `character-1.png` ~ `character-8.png`
```
스타일: 모던 한국 일러스트 (예: 토스/당근마켓 캐릭터)
크기: 400x400 정사각, 투명 배경
- character-1: 50대 남성 환자 (심혈관)
- character-2: 70대 여성 환자 (당뇨)
- character-3: 25세 여성 산모
- character-4: 5세 아동 (소아)
- character-5: 15세 청소년
- character-6: 40대 정신과 환자
- character-7: 응급실 외상 환자
- character-8: 호스피스 환자
모두 친근하고 존엄성 있는 표현. 의료적 디테일 일부 (휠체어, 침대, IV 등).
```

---

## 섹션 H. 우선순위 (학습 + 마케팅 임팩트)

### 🥇 출시 전 필수 (8개) — 다 만들고 보내주세요
1, 3, 4, 8, 9, 10, 11, 17

### 🥈 출시 직후 강력 추천 (15개)
2, 7, 12-16, 18-21, 28-32

### 🥉 시간 나면 (나머지 60+)
온보딩, 캐릭터, 추가 임상 이미지

---

## 라이선스 & 저작권 주의

- DALL-E 3 / Midjourney / Gemini Imagen 생성물 = 상업 OK
- 절대 회피: 디즈니/마블 캐릭터, 실제 유명인 얼굴, 다른 앱 UI 그대로 모방
- 의료 정확성은 본인 검토 책임 (특히 ECG/CXR — AI 가 실수 가능)

---

## 워크플로

```
1. 위 프롬프트 #1 복사
2. AI(DALL-E/Midjourney/Gemini)에 입력
3. 생성된 이미지를 파일명에 맞게 저장 (예: icon-store-512.png)
4. 저(Claude)에게 파일 전송
5. images/ 폴더에 자동 배치 + image-map.js 매핑 자동 추가
6. 다음 프롬프트 반복

전부 모이면:
  npm run build:web → 자동 적용
  npm run build:preview → 검토용
```
