# iOS 빌드 가이드 (간호사 시뮬레이터)

iOS 앱을 추가/빌드하는 절차입니다. **macOS** 환경에서만 가능합니다.
저장소에는 이미 Capacitor iOS 설정(`capacitor.config.json` 의 `ios` 키, Apple PWA 메타 태그, safe-area-inset CSS)이 준비되어 있으니, macOS 머신에서 아래 명령만 실행하면 됩니다.

## 사전 준비

- macOS 13 이상 (Ventura · Sonoma · Sequoia)
- Xcode 15+ (App Store 에서 설치)
- Xcode Command Line Tools: `xcode-select --install`
- CocoaPods: `sudo gem install cocoapods` 또는 `brew install cocoapods`
- Node.js 18+
- **Apple Developer Program 가입 (연 $99 / ₩129,000)** — App Store 출시에 필수

## iOS 플랫폼 추가

```bash
# 의존성 설치 + 웹 빌드
npm install
npm run build:web

# iOS 플랫폼 추가 (최초 1회)
npx cap add ios

# 웹 자산을 iOS 프로젝트로 복사
npx cap sync ios

# Xcode 열기
npx cap open ios
```

## Xcode 설정

1. **Signing & Capabilities** 탭:
   - Team: 본인 Apple Developer Team 선택
   - Bundle Identifier: `com.luiseluise0619.nursingsim` (Apple Developer 포털에 등록 필요)
   - Automatically manage signing: 체크
2. **General** 탭:
   - Display Name: `간호사 시뮬레이터`
   - Version: `1.0.0` · Build: `1`
   - Deployment Target: iOS 14.0 이상 권장
   - Device Orientation: Portrait 만 (또는 회전 허용 결정)
3. **Info.plist**: `NSUserTrackingUsageDescription` 등 광고/추적 동의 문구 (AdMob 사용 시)

## App Store 제출 체크리스트

- [ ] 앱 아이콘 1024x1024 PNG (투명도 없음)
- [ ] 스크린샷 (필수 사이즈):
  - 6.7" (iPhone 15 Pro Max) — 1290 × 2796
  - 6.1" (iPhone 14/15) — 1179 × 2556 (선택)
  - 5.5" (iPhone 8 Plus) — 1242 × 2208 (구형 deprecation 예정)
- [ ] 앱 설명 (한국어 · 영어) — 4000자 이내
- [ ] 키워드 — 100자 이내 (콤마 구분)
- [ ] 개인정보 처리방침 URL — `privacy.html` 호스팅 URL
- [ ] 지원 URL · 마케팅 URL
- [ ] **App Privacy 영양 정보**:
  - 수집 데이터: 없음 (모두 로컬 저장) — 또는 사용 분석(Plausible) 추가 시 명시
  - 추적 데이터: AdMob 사용 시 광고용 ID 명시
- [ ] **연령 등급**: 4+ (의료/교육 콘텐츠는 일반 콘텐츠로 분류)
- [ ] In-App Purchase / 광고 사용 여부 신고
- [ ] 심사용 데모 계정 (필요 시) — 본 앱은 로컬만 사용하므로 불필요

## 자주 막히는 곳

- Bundle ID 충돌: Apple Developer 포털에서 먼저 App ID 생성 후 Xcode 에서 매칭
- CocoaPods 오류: `cd ios/App && pod install --repo-update`
- 빌드 후 흰 화면: `npx cap sync ios` 누락 또는 `webDir` 경로 확인
- 메타데이터 거부: Korean App Store 등록 시 한국어 설명/스크린샷 필수

## 업데이트 시

```bash
npm run build:web
npx cap sync ios
npx cap open ios
# Xcode 에서 Build Number 증가 후 Archive → Distribute App
```
