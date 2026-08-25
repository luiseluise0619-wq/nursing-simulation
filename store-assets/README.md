# Play Store 업로드용 자산

Play Console 업로드 시 사용. **PNG 원본** 유지 (Play Console PNG 필수).
앱 내 사용은 `images/` 폴더의 WebP 사용.

## 필수 자산 (Play Console)

| Play Console 항목 | 요구 규격 | 파일 | 실제 |
|---|---|---|---|
| 앱 아이콘 | 정확히 512×512 PNG | `icon-store-512.png` | 512×512 ✅ |
| 그래픽 이미지 (feature graphic) | 정확히 1024×500 PNG | `feature-graphic-1024x500.png` | 1024×500 ✅ |
| 스마트폰 스크린샷 (2~8장) | 320~3840px, 최대 2:1 | `screenshot-01`~`06` | 1080×1920 ✅ |
| 적응형 아이콘 (foreground) | — | `icon-adaptive-foreground.png` | 1024×1024 |

> `icon-store-512.png` 은 이름과 달리 1024×1024 였다. Play Console 은 앱 아이콘을
> **정확히 512×512** 로만 받으므로 512 로 맞췄고, 1024 원본은
> `icon-store-1024.png` 로 보존했다.

## 스토어 스크린샷 (실제 앱 화면 캡처, 1080×1920)

순서대로 업로드하면 NCLEX → 성과 → 국시 → 차별화 기능 흐름이 된다.

| 파일 | 화면 | 보여주는 것 |
|---|---|---|
| `screenshot-01-home.png` | 홈 (영어/NCLEX 모드) | 첫인상 · 진입 동선 |
| `screenshot-02-nclex.png` | NCLEX 문제 풀이 | 2,200문항 · client need 분류 |
| `screenshot-03-dashboard.png` | 학습 대시보드 | 국시 7과목 + NCLEX 4영역 정답률 |
| `screenshot-04-kor.png` | 한국 국시 5지선다 | 국내 시장 핵심 |
| `screenshot-05-ecg.png` | 심전도 판독 | 경쟁 앱에 없는 기능 |
| `screenshot-06-sim.png` | 듀티 시뮬레이션 | 문제은행이 아닌 시뮬레이터라는 정체성 |

재생성: 앱을 `localhost:8000` 에 띄운 뒤 Playwright 로 540×960 · DPR 2 캡처
(= 1080×1920). 통계는 시연용 값을 시드해서 빈 화면이 나오지 않게 한다.

### 구버전 스크린샷 (768×1376)
`screenshot-drug-drill` / `screenshot-premium` / `screenshot-badges-14d` /
`screenshot-badges-week` — 규격은 통과하지만 핵심 기능이 안 보여 위 6장을 우선한다.

## 권장 아이콘 변형 (선택)
- `app-icon-stethoscope.png` — 청진기 + 십자 (그린 배경)
- `app-icon-stethoscope-2.png` — 청진기 변형
- `app-icon-monogram.png` — "S" 모노그램 (대안 디자인)

## 스플래시 화면
- `splash-light.png` — 라이트 모드용
- `splash-dark.png` — 다크 모드용

## 마케팅
- `share-card-career.png` — 카카오톡/SNS 공유용 카드
