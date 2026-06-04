# AI 이미지 생성 가이드

다른 AI(DALL-E / Midjourney / Stable Diffusion / Gemini Imagen / Sora)에게 보낼 프롬프트 템플릿.

## 공통 설정

| 항목 | 값 |
|------|---|
| **크기** | 800 × 600 (4:3) 또는 1024 × 768 |
| **포맷** | WebP (가장 작음) 또는 PNG |
| **스타일** | Medical illustration / clean / educational / 한국 의료환경 톤 |
| **배경** | 흰색 또는 매우 옅은 회색 (라이트모드 호환) |
| **금지** | 잔혹/혐오 표현, 실제 환자 식별 가능 얼굴 |

## 파일 명명 규칙

- `ecg-vtach.webp` (ECG 카테고리)
- `wound-stage3.webp` (상처)
- `cxr-pneumonia.webp` (영상)
- 모두 **소문자** + **하이픈** + WebP

## 카테고리별 프롬프트 예시

### 🫀 ECG (총 7개)
```
Medical illustration of an ECG strip showing [패턴명].
Clean educational style, white background, monochrome dark blue waveform,
pink grid lines (1mm / 5mm pattern), no labels, 800x600 landscape.
```

| 파일 | 패턴 |
|------|------|
| ecg-nsr.webp | Normal Sinus Rhythm (정상 동율동) |
| ecg-stemi.webp | ST elevation MI (ST 상승) |
| ecg-vtach.webp | Ventricular Tachycardia (V-tach) |
| ecg-vfib.webp | Ventricular Fibrillation (V-fib) |
| ecg-afib.webp | Atrial Fibrillation (no P waves, irregular RR) |
| ecg-svt.webp | Supraventricular Tachycardia (narrow QRS, 150-220 bpm) |
| ecg-asystole.webp | Asystole (flat line) |

### 🫁 청진 / Auscultation (5개)
```
Anatomical chest illustration showing posterior view with 4 lung zones (RUL, LUL, RLL, LLL).
Highlight [부위] in red/orange (abnormal). Clean medical style, beige skin tone.
Label "[음 이름]" below. 800x600.
```

| 파일 | 위치 |
|------|------|
| ausc-crackles.webp | 하부 폐 (RLL, LLL) crackles 표시 |
| ausc-wheeze.webp | 하부 폐 wheeze 표시 |
| ausc-wheeze-diffuse.webp | 4개 zone 모두 wheeze |
| ausc-stridor.webp | 상기도 / 인후부 강조 |
| ausc-normal.webp | 4개 zone 모두 청색 (정상) |

### 🤰 산과 / Obstetrics — FHR (4개)
```
Medical fetal heart rate (FHR) tracing strip showing [패턴].
Top: FHR (baseline 140 bpm, scale 60-220).
Bottom: uterine contractions.
Clean white background, pink grid. 800x400 wide landscape.
```

| 파일 | 패턴 |
|------|------|
| fhr-late.webp | Late deceleration (수축 후 하강) |
| fhr-early.webp | Early deceleration (수축과 동기화) |
| fhr-variable.webp | Variable deceleration (V/U 모양) |
| fhr-accel.webp | Accelerations (15bpm 15초 상승) |

### 👁️ 동공 / Pupil (3개)
```
Close-up illustration of human eyes showing pupil [상태].
Beige skin tone, clean medical educational style, white background, 800x400 wide.
```

| 파일 | 상태 |
|------|------|
| pupil-fixed-dilated.webp | 양측 산동 8mm, 무반응 |
| pupil-pinpoint.webp | 양측 축동 1-2mm |
| pupil-anisocoria.webp | 한쪽 8mm 한쪽 3mm (부동) |

### 🔥 상처 / Wound (5개)
```
Medical illustration of [stage] pressure ulcer on sacrum/heel.
Educational textbook style, NOT photorealistic (avoid disturbing imagery).
Cross-section showing skin layers affected. Beige skin tone. 800x600.
```

| 파일 | 단계 |
|------|------|
| wound-stage2.webp | Stage 2 (표피·진피 손실, 얕은 궤양) |
| wound-stage3.webp | Stage 3 (전층 두께, 피하조직 노출) |
| wound-stage4.webp | Stage 4 (근막·근육·뼈 노출) |
| wound-infected.webp | 감염 (purulent 분비, 발적, 부종) |
| rule-of-nines.webp | 9의 법칙 인체도 (각 부위 %) |

### 📷 영상 / Imaging (4개)
```
Chest X-ray showing [질환]. Standard PA view, anatomical clarity,
black background with light gray lungs. Label key findings with arrow.
800x800 square.
```

| 파일 | 소견 |
|------|------|
| cxr-pneumonia.webp | 우하엽 consolidation (밝게) |
| cxr-pneumothorax.webp | 좌측 폐 collapse + 흉막선 |
| cxr-effusion.webp | 우측 흉수 (blunting) |
| cxr-cardiomegaly.webp | 심장 비대 (CTR > 0.5) |

### 🩹 AED (2개)
```
Anatomical illustration of [adult/child] torso showing AED pad placement.
2 pads marked clearly. Beige skin tone, white background, 800x800.
```

| 파일 | 대상 |
|------|------|
| aed-adult.webp | 성인: 우상흉부 + 좌하측흉부 |
| aed-child.webp | 소아: 흉골 중앙 + 등 중앙 (sandwich) |

### 🌡️ 피부 / Skin (4개)
```
Medical close-up illustration of skin showing [증상].
Educational textbook style, white background, 800x600.
```

| 파일 | 증상 |
|------|------|
| skin-cyanosis.webp | 입술/손가락 청색증 |
| skin-pallor.webp | 창백한 손바닥/얼굴 |
| skin-jaundice.webp | 황달 (눈 흰자위 + 피부) |
| skin-mottled.webp | 얼룩덜룩 (저관류) |

### 💧 소변 (2개)
```
Medical illustration of urine sample in clear container showing [상태].
Side-by-side with normal (yellow) for comparison. White background, 800x400.
```

| 파일 | 상태 |
|------|------|
| urine-dark.webp | 진한 갈색/콜라색 (탈수·간) |
| urine-foamy.webp | 거품 (단백뇨) |

## 사용 워크플로

1. **AI에 위 프롬프트 복붙** (예: ChatGPT + DALL-E, Midjourney, Gemini Imagen)
2. **생성된 이미지를 위 이름으로 저장** (`ecg-vtach.webp` 등)
3. **나(Claude)에게 전송** → `images/` 폴더에 자동 배치
4. **`images/image-map.js`** 의 주석된 매핑 라인 해제 (`// "ecg:vtach": "images/ecg-vtach.webp",` → 주석 제거)
5. **빌드**:
   ```
   npm run build:web
   npm run build:preview
   ```
6. **자동 적용** — 비트맵 있으면 SVG 대신 노출, 없으면 자동 SVG 폴백

## 권장 우선순위 (가장 학습 임팩트 큰 순)

1. **ECG 7개** — 시각적 패턴 인식 핵심
2. **CXR 4개** — 영상의학 직관 학습
3. **상처 5개** — Stage 분류 핵심
4. **FHR 4개** — 산과 패턴 인식
5. **동공 3개** — 신경학적 평가
6. **AED 2개** — 응급처치 기본
7. **청진 5개** — 위치 인식
8. **피부 4개** — 시각 사정
9. **소변 2개** — 가장 후순위

총 36개 (모두 만들면 풍부함 ★★★★★)

## 라이선스 주의

- DALL-E / Midjourney 생성 이미지는 일반적으로 상업적 사용 OK
- 단, 사람 얼굴은 가능한 모호하게 (사실적 환자 얼굴 X)
- 의료 정확성은 본인이 검토 책임
