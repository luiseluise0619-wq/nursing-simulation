# 간호사 시뮬레이터 🏥

한국 간호사 국가고시 학습을 위한 임상 시뮬레이션 + 문제풀이 하이브리드 앱.
**Electron 데스크톱 · PWA · 모바일** 어느 환경에서도 동작합니다.

> ⚠️ **BETA — RN 감수 진행 중.** 학습 보조 도구이며, 실제 임상 의사결정은 면허 의료인과 공식 가이드라인을 따르세요.
> 의료 컨텐츠 출처는 [SOURCES.md](./SOURCES.md) 참고. 의학적 오류 발견 시 GitHub Issues 로 제보 부탁드립니다.

---

## 주요 기능 (v1.1)

| 모드 | 설명 |
| --- | --- |
| 🩺 실전 듀티 | HP/평판 기반 생존 모드 + **광고 시청 부활** 가능 |
| 📚 트레이닝 | 국시 8과목 × **77개 generator** 무한 랜덤 출제 (실제 국시 비율 ±3pp) |
| 📝 모의고사 | 30문제 / 30분 타이머. 채점표 + 오답 자동 누적 |
| 🎯 일일 챌린지 | 날짜 시드 기반 매일 10문제 |
| 🎙️ 인계 시뮬 | TTS 음성 인계 100명 풀, 키워드 채점 |
| 🚑 트리아지 | 5명 환자 1~5순위 매기기 (10 케이스) |
| 📋 시나리오 챔버 | 멀티스텝 임상 의사결정 11 시나리오 |
| 📖 에피소드 | **30개 듀티 에피소드 (351 단계)** — 외과/소아/ICU/정신/CCU/재활/가정전문간호 등 |
| 📝 오답노트 (**Leitner 5박스 SRS**) | 1d → 3d → 7d → 14d → 30d 간격 반복 학습 |
| ⭐ 북마크 | 문제별 즐겨찾기, 별표만 모아보기 |
| 🗓 위클리 리포트 | 7일 학습 통계 + 결과 카드 다운로드 |
| 📊 대시보드 | 과목별 정답률·콤보·출제 경향 차트·PDF 출력 |

### 임상 시각자료 (v1.2 신규)
- **자체 제작 SVG 6종**: ECG strip(7가지 리듬) / 욕창 단계도 / 체위 인체도 / 9의 법칙 / 태아심음·자궁수축 strip / 동공 사정
- 모두 외부 자원 0 · 저작권 안전 · 라이트/다크 모드 호환

### 디자인
- **Soft Neumorphic Sage** — 단일 sage(#7fa881) 단색 + 5종 뉴모피즘 그림자
- 그라디언트 0건 · Pretendard 폰트 · 3탭 메인 메뉴 (홈/학습/내 기록)
- 라이트/다크 모드 · WCAG AA 대비

기타: 키보드 단축키, WebAudio 효과음, 한국어 IME 가드, ARIA 접근성, CSP `script-src 'self'`, 외부 호출 0.

기타: 다크 모드, 키보드 단축키, WebAudio 효과음, 한국어 IME 가드, 콤보·HP 게이지 시각화, ARIA 접근성, CSP `script-src 'self'`.

---

## 빠른 시작

### 1. 브라우저에서 바로 실행 (가장 빠름)

```bash
git clone <repo-url>
cd nursing-simulation
# Python 이 있다면 (어디서나):
python3 -m http.server 5173
# Node 가 있다면:
npx serve .
```

`http://localhost:5173/` 접속.

### 2. Electron 데스크톱 앱으로 실행

```bash
npm install
npm start          # → Electron 윈도우(450×800) 가 열립니다
```

### 3. 모바일 (PWA 설치)

위 1번처럼 `https://` 호스팅 후 (예: GitHub Pages·Cloudflare Pages·Netlify) 모바일 Safari/Chrome 에서 접속:

- **iOS**: Safari → 공유 → "홈 화면에 추가"
- **Android**: Chrome → 메뉴 → "앱 설치"

`manifest.json` 과 `sw.js` 가 오프라인 캐싱·standalone 모드를 자동 처리합니다.

### 4. 즉시 출시 — GitHub Pages 베타 (5분)

1. GitHub repo 의 **Settings → Pages**
2. **Source**: `Deploy from a branch`
3. **Branch**: `main` (또는 현재 브랜치), folder `/ (root)`
4. **Save** → 약 1분 후 `https://<user>.github.io/<repo>/` 에서 PWA 접속 가능

호스팅 비용 0원 · HTTPS 자동 · CDN 자동.

---

## 데스크톱 앱 만들기 (배포용 .dmg / .exe / .AppImage)

### 사전 준비

```bash
npm install --save-dev electron-builder
```

### `package.json` 에 build 설정 추가

```json
{
  "scripts": {
    "start": "electron .",
    "test": "jest",
    "pack:mac":   "electron-builder --mac --x64 --arm64",
    "pack:win":   "electron-builder --win --x64",
    "pack:linux": "electron-builder --linux AppImage"
  },
  "build": {
    "appId": "com.nursesim.app",
    "productName": "간호사 시뮬레이터",
    "directories": { "output": "dist" },
    "files": [
      "main.js", "index.html", "styles.css",
      "script.js", "questions.js", "content.js",
      "manifest.json", "package.json"
    ],
    "mac":   { "category": "public.app-category.education", "target": ["dmg"] },
    "win":   { "target": ["nsis"] },
    "linux": { "category": "Education", "target": ["AppImage"] }
  }
}
```

### 빌드 실행

```bash
npm run pack:mac     # macOS .dmg → dist/
npm run pack:win     # Windows .exe (NSIS) → dist/
npm run pack:linux   # Linux .AppImage → dist/
```

> **아이콘 추가**: `build/icon.png` (1024×1024), `build/icon.icns` (mac), `build/icon.ico` (win) 을 두면 자동으로 사용됩니다.
> 없으면 일렉트론 기본 아이콘으로 빌드됩니다.

### 코드 서명 (정식 배포 시)

- **macOS**: Apple Developer ID + notarization. `electron-builder` 의 `afterSign` 훅으로 `notarize.js` 호출. 연 99 USD.
- **Windows**: EV Code Signing 인증서 (DigiCert/Sectigo). 연 200~400 USD. 없으면 SmartScreen 경고 표시.
- **Linux**: 서명 불필요.

자세히: <https://www.electron.build/code-signing>

---

## 모바일 앱으로 만들기 (네이티브 패키징)

PWA로 충분하지 않다면 두 가지 옵션:

### 옵션 A — Capacitor (권장)

웹 코드 그대로 iOS/Android 네이티브로 래핑.

```bash
npm install --save-dev @capacitor/cli @capacitor/core @capacitor/ios @capacitor/android
npx cap init "간호사 시뮬" com.nursesim.app --web-dir=.
npx cap add ios
npx cap add android
npx cap sync
npx cap open ios       # Xcode 가 열립니다
npx cap open android   # Android Studio 가 열립니다
```

이후 각 IDE 에서 앱스토어/플레이스토어 배포 절차.

### 옵션 B — PWA Builder (가장 빠름)

`https://www.pwabuilder.com/` 에 호스팅된 URL 만 입력하면 .apk / .ipa 가 자동 생성됩니다 (5분 소요).

---

## 개발

### 디렉토리 구조

```
nursing-simulation/
├── index.html             UI 마크업
├── styles.css             테마 토큰 + 모드 카드 + 게이지
├── script.js              게임 로직 (단일 파일, ~2000줄)
├── questions.js           29개 문제 generator (UMD)
├── content.js             인계 100명 + 트리아지 7 + 시나리오 6 + 스토리 비트 6 (UMD)
├── main.js                Electron 진입점
├── manifest.json          PWA 매니페스트
├── sw.js                  서비스 워커 (cache-first)
├── tests/                 Jest 테스트 (단위 + jsdom 통합)
└── .github/workflows/     CI
```

### 명령어

```bash
npm install        # 의존성 설치 (Electron + Jest + jest-environment-jsdom)
npm start          # Electron 앱 실행
npm test           # 690개 테스트 실행 (단위 + 통합)
npm run test:watch # 파일 변경 감지 모드
```

### 컨텐츠 추가

- **문제 generator**: `questions.js` 의 `allGenerators` 배열에 함수 추가. 정답 선택지는 `correct: true` 플래그 필수.
- **인계 환자**: `content.js` 의 `HANDOFF_PATIENTS` 에 객체 추가. 키워드는 narration 본문에 등장해야 함 (테스트 자동 검증).
- **트리아지 케이스**: `TRIAGE_CASES` 에 환자 5명 + priority 1~5 + rationale.
- **시나리오**: `SCENARIOS` 에 intro + 3~5 steps × 3~4 choices.

테스트가 invariant (정답 1개, 키워드 본문 등장, 우선순위 유일성 등) 를 자동 검증하므로 추가 시 `npm test` 로 즉시 확인하세요.

---

## 키보드 단축키

| 키 | 동작 |
| --- | --- |
| `1` `2` `3` `4` | 보기 선택 |
| `Space` / `Enter` | 다음 문제 |
| `T` | 테마 전환 (라이트/다크/자동) |
| `M` | 사운드 토글 |
| `ESC` | 모달 닫기 |

한국어 IME 조합 중에는 자동 차단됩니다.

---

## 데이터·프라이버시

- **모든 데이터는 사용자 기기 안에서만 처리됩니다.** 외부 서버 통신 0건.
- 저장 위치: 브라우저 `localStorage` (키 `nurseSim:v1`).
- 저장 항목: 학습 통계, 오답 노트, 북마크, 사운드/테마 설정, 일일 챌린지 기록, 최고 콤보, 모의고사 최고점.
- 대시보드 "통계 초기화" 버튼으로 전체 삭제 가능. 백업/복원도 지원.

## 컨텐츠 출처

본 시뮬레이터의 1,800+ 결정 포인트는 다음 표준 자료에 기반합니다:
- 한국 간호사 국가시험 출제기준 (국시원 2024)
- AHA ACLS/BLS · ACOG · KDIGO · SCCM · GOLD · GINA · ADA 가이드라인
- 한국 법령 9건 (의료법 · 감염병관리법 · 마약류관리법 · 정신건강복지법 · 혈액관리법 등)
- 표준 한국 간호학 교과서 8과목 (수문사·현문사)

전체 목록: [SOURCES.md](./SOURCES.md)

## 솔직한 한계

- **정식 RN/MD 감수 전 베타.** 의학적 오류 가능성 0% 보장 불가.
- 시각 자료는 자체 제작 SVG 다이어그램만 — 실제 의료 영상(X-ray/CT) 미포함.
- 한국 의료 시스템 기준. 타국 가이드라인과 다를 수 있음.
- 모든 결정 포인트는 교육 목적. **실제 환자에게 그대로 적용하지 마세요.**

---

## 라이선스

MIT. 자세한 내용 + 의료 학습 면책 고지는 [LICENSE](./LICENSE) 참고.

---

## 기여

PR / 이슈 환영합니다. 컨텐츠 추가 시 의료적 정확성을 위해 참고한 출처(가이드라인·교과서)를 PR 본문에 적어주세요.
