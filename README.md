# 간호사 시뮬레이터 🏥

한국 간호사 국가고시 학습을 위한 임상 시뮬레이션 + 문제풀이 하이브리드 앱.
**Electron 데스크톱 · PWA · 모바일** 어느 환경에서도 동작합니다.

> ⚠️ **학습 보조 도구입니다.** 실제 임상 의사결정은 면허 의료인과 공식 가이드라인을 따르세요.

---

## 주요 기능

| 모드 | 설명 |
| --- | --- |
| 🩺 실전 듀티 | HP/평판 기반 생존 모드. 스토리 비트 6개가 듀티 진행 중 자동 발동 |
| 📚 트레이닝 | 국시 8과목 × 29개 generator 무한 랜덤 출제 |
| 📝 모의고사 | 30문제 / 30분 타이머. 채점표 + 오답 자동 누적 |
| 🎯 일일 챌린지 | 날짜 시드 기반 매일 10문제, 같은 날 동일 셋 |
| 🎙️ 인계 시뮬 | TTS 음성 인계 100명 풀에서 세션당 10명 출제. 키워드 채점 |
| 🚑 트리아지 | 5명 환자에 1~5순위 매기기. 7개 케이스 |
| 📋 시나리오 챔버 | 멀티스텝 임상 의사결정 6개 시나리오 |
| 📝 오답노트 | 모든 모드 오답 자동 누적, 정답 시 큐에서 제거 |
| 📊 대시보드 | 과목별 정답률·콤보·출제 경향 차트·PDF 출력 |

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

- **모든 데이터는 사용자 기기 안에서만 처리됩니다.** 외부 서버 통신 없음.
- 저장 위치: 브라우저 `localStorage` (키 `nurseSim:v1`).
- 저장 항목: 학습 통계, 오답 노트, 사운드/테마 설정, 일일 챌린지 기록, 최고 콤보, 모의고사 최고점.
- 대시보드 "통계 초기화" 버튼으로 전체 삭제 가능.

---

## 라이선스

MIT. 자세한 내용 + 의료 학습 면책 고지는 [LICENSE](./LICENSE) 참고.

---

## 기여

PR / 이슈 환영합니다. 컨텐츠 추가 시 의료적 정확성을 위해 참고한 출처(가이드라인·교과서)를 PR 본문에 적어주세요.
