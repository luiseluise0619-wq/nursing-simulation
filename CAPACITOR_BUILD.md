# 📱 Capacitor 모바일 빌드 가이드

> 안드로이드 2~3주 출시 / iOS 4~6주 출시 목표

PWA 코드를 변경 없이 네이티브 앱으로 패키징하는 단계별 가이드.

---

## 사전 준비

### 필요한 계정·도구
- [ ] **Google Play Console 계정** ($25 일회성, 즉시 발급)
- [ ] **Apple Developer Program** ($99/년, 1~3일 승인) — iOS 출시 시
- [ ] **Node.js 20+** 설치 확인 (`node -v`)
- [ ] **Android Studio** 설치 (https://developer.android.com/studio)
- [ ] **Xcode** (Mac 필수, iOS 빌드 시)

---

## 1단계: Capacitor 설치 (10분)

```bash
cd /path/to/nursing-simulation

# Capacitor core + CLI
npm install --save @capacitor/core @capacitor/cli
npm install --save @capacitor/android @capacitor/ios

# AdMob 플러그인 (현재 부활 광고용)
npm install --save @capacitor-community/admob

# 로컬 알림 플러그인 (일일 챌린지 알림용)
npm install --save @capacitor/local-notifications

# 앱 정보·상태바·키보드 (공식 플러그인)
npm install --save @capacitor/app @capacitor/status-bar @capacitor/keyboard
```

---

## 2단계: capacitor.config.json 생성

루트에 다음 파일을 만드세요:

```json
{
  "appId": "com.luiseluise0619.nursingsimulator",
  "appName": "간호사 시뮬레이터",
  "webDir": ".",
  "bundledWebRuntime": false,
  "server": {
    "androidScheme": "https"
  },
  "android": {
    "backgroundColor": "#eef2f5"
  },
  "ios": {
    "contentInset": "automatic"
  },
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 1200,
      "backgroundColor": "#7fa881",
      "showSpinner": false
    },
    "AdMob": {
      "appId": "ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX",
      "testingDevices": [],
      "initializeForTesting": false
    },
    "LocalNotifications": {
      "smallIcon": "ic_notification",
      "iconColor": "#7fa881"
    }
  }
}
```

⚠️ `appId`는 Play Store / App Store 등록 후 변경 불가. 신중히 결정.
⚠️ `AdMob.appId`는 AdMob 콘솔 등록 후 받은 ID 로 교체.

---

## 3단계: 아이콘·스플래시 생성

### 아이콘 PNG 생성 (icon.svg → PNG)
온라인 변환기 사용:
- https://cloudconvert.com/svg-to-png (300dpi 권장)
- 또는 ImageMagick: `magick icon.svg -density 300 -resize 1024x1024 icon-1024.png`

필요한 크기:
```
icon-192.png   (192×192)
icon-512.png   (512×512)
icon-1024.png  (1024×1024)  ← Play Store 필수
```

`build/` 폴더에 저장 (manifest.json이 이미 참조 중).

### 스플래시 생성 (선택)
```bash
npm install --save-dev @capacitor/assets

# build/ 아래에 icon-only.png (1024×1024), splash.png (2732×2732) 준비 후:
npx capacitor-assets generate --iconBackgroundColor "#7fa881" \
  --iconBackgroundColorDark "#1a1f2b" \
  --splashBackgroundColor "#eef2f5" \
  --splashBackgroundColorDark "#1a1f2b"
```

---

## 4단계: 안드로이드 빌드

### 프로젝트 추가
```bash
npx cap add android
npx cap sync android
```

### Android Studio 열기
```bash
npx cap open android
```

### 빌드 설정 (Android Studio 안에서)
- File → Project Structure → Modules → app
- compileSdkVersion: 35 (최신)
- targetSdkVersion: 34 (Play Store 요구사항)
- minSdkVersion: 24 (Android 7.0+, 한국 점유율 99%)

### 서명 키 생성 (1회만)
```bash
keytool -genkey -v -keystore nursingsim.keystore \
  -alias nursingsim -keyalg RSA -keysize 2048 -validity 10000
```
⚠️ **이 파일과 비밀번호를 절대 잃지 마세요!** Play Store 업데이트 못 함.
백업: Google Drive / Notion / 종이 인쇄까지.

### 릴리즈 AAB 빌드
Android Studio → Build → Generate Signed Bundle / APK → AAB 선택
→ keystore 입력 → release 빌드 → 출력 파일: `app-release.aab`

---

## 5단계: iOS 빌드 (Mac 필수)

### 프로젝트 추가
```bash
npx cap add ios
npx cap sync ios
npx cap open ios
```

### Xcode 안에서
- 좌측 사이드바 → App 클릭
- Signing & Capabilities → Team 선택 (Apple Developer 계정)
- Bundle Identifier: `com.luiseluise0619.nursingsimulator` (capacitor.config 와 동일)

### TestFlight 업로드
- Product → Archive
- Distribute App → App Store Connect → Upload
- App Store Connect 에서 TestFlight 탭 → 빌드 활성화
- 내부 테스터 100명 / 외부 테스터 10,000명 모집 가능

---

## 6단계: 스토어 등록

### Play Store
1. https://play.google.com/console 접속
2. "앱 만들기" → 이름·언어·무료 선택
3. **AAB 업로드** (앞서 만든 `app-release.aab`)
4. **스토어 등록정보**:
   - 짧은 설명·긴 설명 → `STORE_LISTING.md` 복사
   - 스크린샷 8장 (1080×1920) — 모바일에서 직접 캡처
   - 아이콘 512×512
   - Feature graphic 1024×500
5. **콘텐츠 등급**: 설문 응답 (만 15세+)
6. **데이터 보안**: 설문 응답 (`STORE_LISTING.md` 표 참고)
7. **개인정보·약관 URL**:
   - 개인정보: `https://luiseluise0619-wq.github.io/nursing-simulation/privacy.html`
   - 약관: `https://luiseluise0619-wq.github.io/nursing-simulation/terms.html`
   - ⚠️ GitHub Pages 활성화 필요 (Settings → Pages → main branch)
8. **출시**: 정식 출시 (Production) 또는 내부 테스트 → 점진 출시

심사 기간: **1~3일** (의료 카테고리는 더 길 수 있음)

### App Store (iOS)
1. https://appstoreconnect.apple.com 접속
2. 앱 추가 → Bundle ID 선택 (Capacitor 빌드에서 등록)
3. 스토어 정보 입력 (Play Store 와 거의 동일)
4. TestFlight 빌드 활성화 후 정식 심사 제출

심사 기간: **1~3주** (Apple 더 까다로움). 첫 거절 흔함:
- 흔한 거절 사유: 의료 면책 부족, 광고 처리 미흡, 미완성 기능
- 대응: 의료 면책 강조, 광고는 부활용만 명시

---

## 7단계: 빌드 검증 체크리스트

빌드 전 확인:
- [ ] `manifest.json` icon 경로가 모두 존재
- [ ] `index.html` 의 CSP가 알림·결제 차단하지 않음
- [ ] Storage 전체 초기화 후 첫 실행이 정상 작동
- [ ] 오프라인 모드(비행기 모드)에서 정상 작동
- [ ] 다크 모드 / 라이트 모드 양쪽 다 OK
- [ ] 한자/영어 폰트가 깨지지 않음 (Pretendard 폴백 OK)
- [ ] AdMob 테스트 광고가 표시됨
- [ ] 알림 권한 요청이 정상 작동
- [ ] 화면 회전 시 깨지지 않음 (manifest "orientation": "portrait" 설정됨)

---

## ⚠️ 출시 후 흔한 문제

| 문제 | 해결 |
|---|---|
| Play Store "데이터 보안" 거부 | AdMob 사용 시 광고 ID 수집 명시 필수 |
| Apple 첫 심사 거절 | 의료 면책을 onboarding 첫 화면에 강조 |
| AdMob 광고가 안 나옴 | 정식 광고 ID 미입력 (현재 테스트 ID) |
| 알림이 안 옴 | iOS는 backgroud notification 별도 권한 필요 |
| 한글이 깨짐 | Pretendard CDN 차단 시 시스템 폰트 폴백 |
| 첫 실행 시 흰 화면 | service worker 캐시 미인식 (1회 새로고침) |

---

## 📅 예상 일정 (솔로 개발자 기준)

| 작업 | 소요 시간 |
|---|---|
| Capacitor 설치·설정 | 1일 |
| 아이콘·스플래시 생성 | 1일 |
| 안드로이드 빌드 + 테스트 | 2~3일 |
| Play Store 등록·심사 | 3~5일 (심사 1~3일 포함) |
| **안드로이드 출시 합계** | **약 2주** |
| iOS 빌드 (Mac 필요) | 2~3일 |
| TestFlight 테스트 | 1주 |
| App Store 심사 | 1~3주 |
| **iOS 출시 합계** | **약 4~6주** |

---

## 🚀 출시 직후 모니터링

- [ ] Play Console 실시간 통계 (다운로드·크래시·평점)
- [ ] Plausible Analytics (페이지뷰·체류시간)
- [ ] AdMob 콘솔 (광고 노출·수익)
- [ ] GitHub Issues (오류 신고)
- [ ] 인스타·틱톡 DM (사용자 피드백)

**첫 일주일**: 매일 1번씩 모든 채널 확인 + 즉시 핫픽스 가능한 상태 유지.
