# 간호사 시뮬레이터 — 출시 작업 완전 가이드

> Play Store 출시까지 7-10일. 이 문서 그대로 따라하시면 됩니다.

---

## 📋 전체 일정

| Day | 작업 | 소요 시간 |
|-----|------|----------|
| 1 | AdMob 가입 + 실 광고 ID 발급 | 1시간 + 심사 24-48h |
| 2 | Keystore 생성 + Toss 핸들 설정 | 1시간 |
| 3 | 코드에 실 ID 적용 + AAB 빌드 | 2시간 |
| 4 | Play Console 등록 + 메타데이터 입력 | 3시간 |
| 5 | 스크린샷 8장 정성 제작 | 4시간 |
| 6 | AAB 업로드 + 내부 테스트 | 1시간 + 심사 3-7일 |
| 7-13 | 임상 베타 (현직 간호사 1명) | 동시 진행 |
| 14 | 프로덕션 트랙 전환 → 출시 🎉 | — |

---

## Day 1 — AdMob 가입 + 실 ID 발급

### 1.1 AdMob 가입 (15분)

1. https://admob.google.com/ 접속
2. 본인 Google 계정 로그인
3. "시작하기" → 국가: **한국**
4. **세금 정보 입력**:
   - 거주국: 한국
   - 사업 유형: 개인 또는 사업자
   - 결제 받을 한국 은행 계좌 정보 (수익 100$ 이상 모이면 입금)
5. 약관 동의 → 가입 완료

### 1.2 앱 등록 (5분)

1. AdMob 대시보드 → "앱" → **"앱 추가"**
2. **"아직 Play Store / App Store에 게시되지 않았습니다"** 선택
3. 정보 입력:
   - **앱 이름**: `간호사 시뮬레이터`
   - **플랫폼**: `Android`
4. 사용자 측정 기능: 사용 안 함 (나중에 켜도 됨)
5. 등록 완료
6. **AdMob App ID 복사** (이런 형식): `ca-app-pub-1234567890123456~1234567890`
   - 메모장에 저장 (3곳에 사용)

### 1.3 보상형 광고 단위 2개 생성 (15분)

1. 등록한 앱 클릭 → **"광고 단위"** → **"광고 단위 추가"**

#### 단위 1 — 부활 광고
- 광고 형식: **보상형 (Rewarded)**
- 광고 단위 이름: `간호사시뮬-부활`
- 보상 설정:
  - 금액: `1`
  - 항목: `HP_REVIVE`
- 빈도 제한: 없음
- 생성 → **단위 ID 복사** (`ca-app-pub-XXXX/XXXX` 형식)

#### 단위 2 — 힌트 광고
- 광고 형식: **보상형 (Rewarded)**
- 이름: `간호사시뮬-힌트`
- 보상 금액 `1` / 항목 `HINT_REVEAL`
- 생성 → **단위 ID 복사**

### 1.4 결과 확인

메모장에 3가지 저장됐는지:
- ✅ App ID: `ca-app-pub-...~...`
- ✅ 부활 단위 ID: `ca-app-pub-.../...`
- ✅ 힌트 단위 ID: `ca-app-pub-.../...`

⏳ Google AdMob 심사 24-48시간 대기 (그동안 Day 2~5 진행)

---

## Day 2 — Keystore 생성 + Toss 핸들

### 2.1 JDK 설치 확인

```bash
java -version
```

미설치 시:
```bash
# Mac
brew install openjdk

# Windows: https://adoptium.net/ 다운로드
```

### 2.2 Keystore 생성 (10분)

```bash
# Mac/Linux
keytool -genkey -v \
  -keystore ~/nursingsim.keystore \
  -alias nursingsim \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

**입력 정보**:
- 비밀번호: 강력한 것 (대소문자+숫자+기호 16자 이상)
- 이름: 본인 이름 (영문)
- 조직 단위: (공백 OK)
- 조직: (공백 OK)
- 시/도: 본인 거주지 (예: Seoul)
- 국가 코드: **KR**

⚠️ **중요**:
- `nursingsim.keystore` 파일 + 비밀번호 → **USB 백업 필수**
- 분실 시 앱 영영 업데이트 불가 (사용자 재설치도 안 됨)
- 이 keystore 는 평생 동일하게 사용

### 2.3 keystore.properties 설정 (5분)

```bash
cd /home/user/nursing-simulation/android
cat > keystore.properties << EOF
storeFile=/Users/본인이름/nursingsim.keystore
storePassword=설정한비밀번호
keyAlias=nursingsim
keyPassword=설정한비밀번호
EOF
```

⚠️ 이 파일은 `.gitignore`에 이미 포함됨 (절대 GitHub 에 올라가지 않음).

### 2.4 Toss 후원 핸들 설정 (10분)

1. Toss 앱 설치 (이미 있으면 패스)
2. Toss 앱 → 프로필 → **"내 받기 링크"**
3. 핸들 설정 (예: `nursesim2026`)
   - `toss.me/nursesim2026` URL 생성됨
4. 코드 수정 — `script.js` 약 5102번째 줄:
   ```javascript
   const TOSS_HANDLE = "본인_toss_핸들";  // 예: "nursesim2026"
   ```

---

## Day 3 — 코드에 실 ID 적용 + AAB 빌드

### 3.1 AdMob 실 ID 교체 (3곳)

#### 위치 1: `capacitor.config.json`
```json
{
  "plugins": {
    "AdMob": {
      "appId": "ca-app-pub-실제ID~실제숫자"
    }
  }
}
```

#### 위치 2: `android/app/src/main/AndroidManifest.xml`
```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-실제ID~실제숫자"/>
```

#### 위치 3: `script.js`
```javascript
const ADS_UNITS = {
    rewarded: "ca-app-pub-실제ID/실제부활단위ID",
};
```

### 3.2 버전 정보 설정

`android/app/build.gradle`:
```gradle
defaultConfig {
    applicationId "com.luiseluise0619.nursingsim"
    versionCode 1
    versionName "1.0.0"
    ...
}
```

### 3.3 빌드 + 동기화

```bash
cd /home/user/nursing-simulation
npm run build:web
npx cap sync android
npx cap open android   # Android Studio 자동 열림
```

### 3.4 AAB 생성 (Android Studio 안에서)

1. 메뉴: **`Build`** → **`Generate Signed Bundle / APK...`**
2. **`Android App Bundle`** 선택 → Next
3. Key store path: `~/nursingsim.keystore` 선택
4. 비밀번호 + alias (`nursingsim`) 입력
5. Build type: **`release`**
6. Finish
7. 완료 알림 → "Locate" 클릭
8. AAB 파일 경로 확인:
   ```
   /home/user/nursing-simulation/android/app/release/app-release.aab
   ```

### 3.5 결과
- ✅ `app-release.aab` (50-200MB)

---

## Day 4 — Play Console 등록 + 메타데이터

### 4.1 Play Console 가입 (30분)

1. https://play.google.com/console 접속
2. Google 계정 로그인
3. **$25 일회성 등록비 결제** (한국 카드 OK)
4. 본인 정보 입력:
   - 이름 (실명)
   - 이메일
   - 휴대폰
   - 거주국: 대한민국
   - 사업 유형: 개인 또는 사업자
5. 약관 동의

### 4.2 새 앱 생성 (5분)

1. **"앱 만들기"** 클릭
2. 입력:
   - **앱 이름**: `간호사 시뮬레이터`
   - **기본 언어**: `한국어 - 한국어`
   - **앱 또는 게임**: `앱`
   - **무료 또는 유료**: `무료`
3. 선언:
   - ✅ 개발자 프로그램 정책 준수
   - ✅ 미국 수출 법 준수

### 4.3 짧은 설명 (80자)

```
한국 간호사 국가고시 + NCLEX-RN 무료. 35편 임상 시뮬레이션. 듀티처럼 공부.
```

### 4.4 자세한 설명 (4,000자, 복붙)

```
🩺 간호사 시뮬레이터 — 국시 + NCLEX 무료 학습

졸업한 선배가 만든 무료 간호 학습 앱입니다.
교과서 외우기 지친 분들, 듀티처럼 돌면서 임상 감각 익히고 싶은 분들을 위해.

✨ 핵심 콘텐츠

• 한국 간호사 국가고시 정적 문제 320+ (8과목)
• NCLEX-RN 영문 문제 2,200 (UWorld 동등량, MCQ+SATA+Priority)
• 35편 임상 시뮬레이션 (정신/소아/응급/산과/내과/외과/노인/호스피스)
• 약물 드릴 50종 (작용·부작용·모니터링)
• 이미지 문제 83개 (ECG / 청진 / 산과 / 신경)
• 무한 생성 문제 (8과목 통합 랜덤)

🎮 게임처럼 학습

• HP·평판 시스템 — 듀티 시뮬레이션
• 35편 캠페인 모드 (10-15단계 스토리)
• 인계 시뮬 + 트리아지 + 코드블루
• 일일 챌린지 + 연속 학습 보상
• 약점 분석 자동 (어디서 자주 틀리는지)
• 배지 컬렉션 + 성취 시스템

🌐 한국 + NCLEX 듀얼 모드

• 한국 국시 5지선다 (KNCA / 대한간호협회 출처 인용)
• NCLEX-RN 영문 (AHA / ACOG / USPSTF / NPSG 출처)
• 영어 / 필리핀어 / 스페인어 UI 지원

💚 진짜 무료

• 회원가입 X
• 학습 데이터 외부 전송 X
• 광고는 부활/힌트 보상형만 (선택적)
• 광고 없이도 모든 기능 사용 가능
• 프리미엄은 출시 1.5 부터 (광고 제거 + 추가 콘텐츠)

🔒 개인정보 보호

• 모든 학습 데이터는 사용자 기기 안에만 저장
• 외부 서버 통신 없음 (광고 / 익명 통계 제외)
• 익명 사용 통계 (Plausible — 개인정보 X)
• 언제든 데이터 백업·이전·삭제 가능 (GDPR 호환)

⚠️ 면책 고지

이 앱은 학습 보조 도구이며 실제 임상 결정 도구가 아닙니다. 실제 임상에서는 면허를 가진 의료인의 판단 + 공식 가이드라인(KDCA, ACLS, AHA 등) + 의료기관 프로토콜을 따르세요.

👨‍⚕️ 권장 대상

• 간호학과 재학생 (1-4학년)
• 국시 준비생 / 재시험자
• NCLEX-RN 응시 예정자 (한국 → 미국 진출)
• 임상 감각 유지하고 싶은 신규 간호사
• 만 15세 이상 권장 (일부 민감 콘텐츠 ⚠️ 라벨)

📧 피드백 / 오류 신고

앱 내 "오류 신고" 버튼 또는 GitHub Issues로 보내주세요.
임상 오류 발견 시 즉시 수정합니다.

🌟 후원

지금은 모두 무료입니다. 도움됐다면 Toss로 작은 후원으로 응원해주세요. 모든 후원은 콘텐츠 검수, 디자인, 서버에 100% 사용됩니다.

#간호사 #간호국시 #NCLEX #간호학과 #임상시뮬레이션 #간호사시뮬레이터 #국시준비
```

### 4.5 카테고리 + 태그

- **카테고리**: `교육`
- **태그 (5개)**: `간호사`, `간호학과`, `국가고시`, `NCLEX`, `의료`

### 4.6 콘텐츠 등급 설문 (15분)

1. **"콘텐츠 등급"** 탭
2. 이메일 등록
3. 카테고리 선택: **`참고/Education`**
4. 설문 답변:
   - 폭력: **없음**
   - 성적 콘텐츠: **없음**
   - 욕설: **없음**
   - 사용자 상호작용 / 공유: **없음**
   - 약물/술 묘사: **있음 - 교육적** (마약류 폐기 절차 등)
   - 자해/자살 묘사: **있음 - 교육적** (정신간호 시나리오, ⚠️ 라벨 명시)
   - 디지털 구매: **없음**
   - 개인정보 수집: **있음 - 광고 ID 만 (AdMob)**
5. 제출 → 결과 자동 산출 (보통 **3+** 또는 **7+** 받음)

### 4.7 데이터 보안 설문 (20분)

1. **"앱 콘텐츠" → "데이터 보안"** 탭
2. 답변:
   - 사용자에게 데이터 수집/공유? **예** (광고 ID)
   - 데이터 암호화? **예** (HTTPS)
   - 사용자가 삭제 요청 가능? **예** (앱 내 데이터 컨트롤)
   - 위치 정보: **없음**
   - 개인 정보: **없음** (학습 데이터만, 이름·이메일 X)
   - 금융 정보: **없음**
   - 광고 ID: **있음** (AdMob 보상형 광고)
3. 제출

### 4.8 대상 연령 + 가족 정책

- 대상 연령: **만 13세 이상** (자해·임종 일부 포함 — ⚠️ 라벨)

---

## Day 5 — 스크린샷 정성 제작

### 5.1 필수 자산

| 항목 | 크기 | 개수 | 우선순위 |
|------|-----|------|---------|
| **앱 아이콘** | 512×512 PNG | 1 | 🥇 필수 |
| **피쳐 그래픽** | 1024×500 PNG | 1 | 🥇 필수 |
| **스마트폰 스크린샷** | 1080×1920 PNG | 4-8 | 🥇 필수 (4장 최소) |
| 태블릿 7" | 1024×600 PNG | 1-2 | 🥉 선택 |
| 태블릿 10" | 1600×2560 PNG | 1-2 | 🥉 선택 |

### 5.2 만드는 법 — 옵션 A: AI (가장 빠름, 추천)

`images/PROMPTS_ALL.md` 의 #1, #8, #9-16 사용:

#### 아이콘 (Bing Image Creator, DALL-E 3, 무료)
```
512x512 app icon, sage green (#7fa881) rounded square background,
white stethoscope curved as "S" + small medical cross center,
soft shadow, flat modern design (iOS 17 style), no text.
```

#### 피쳐 그래픽 1024x500 (Ideogram, 한국어 정확)
```
1024x500 horizontal banner. Sage green gradient background.
Left side: app icon (stethoscope mark). Center text:
"간호사 시뮬레이터" Pretendard bold 80pt + below
"국시 + NCLEX 무료" 32pt.
Right side: phone mockup showing app menu. Clean modern.
```

#### 스크린샷 8장
- 폰 화면 캡쳐 → Figma 무료 또는 Canva 에서 텍스트 오버레이
- 각 화면 위 1/3에 큰 한국어 헤드라인:
  1. "국시 + NCLEX 2,200 문제 무료"
  2. "실제 듀티처럼 — 35편 시뮬레이션"
  3. "NCLEX-RN Practice Free"
  4. "내 약점을 자동 분석"
  5. "ECG · 청진 · 산과 — 83+ 이미지"
  6. "핵심 약물 50종"
  7. "꾸준한 학습 = 성취 배지"
  8. "광고 거의 없음 · 회원가입 없음"

### 5.3 만드는 법 — 옵션 B: Figma 직접 (4시간)

1. Figma 무료 가입 → https://figma.com
2. "Phone Frame" 무료 템플릿 검색
3. 본인 폰에서 앱 실 스크린샷 캡쳐 → 프레임에 끼우기
4. 헤드라인 텍스트 추가 (Pretendard Bold)
5. 8장 → 1080×1920 PNG export

### 5.4 만드는 법 — 옵션 C: Canva 빠른 (2시간)

1. Canva 무료 → https://canva.com
2. "Mobile App Screenshot" 템플릿 선택
3. 본인 폰 실 캡쳐 삽입
4. 텍스트 + 배경 커스터마이즈
5. 1080×1920 다운로드

### 5.5 업로드

Play Console → "메인 스토어 등록정보" → 각 항목에 업로드:
- 앱 아이콘 (자동 표시되는 칸)
- 피쳐 그래픽 (자동 표시)
- 휴대전화 스크린샷 (드래그 4-8장)

---

## Day 6 — GitHub Pages + AAB 업로드 + 내부 테스트

### 6.1 GitHub Pages 활성화 (개인정보 처리방침 호스팅)

1. https://github.com/luiseluise0619-wq/nursing-simulation 접속
2. **Settings** 탭 → 좌측 **Pages**
3. **Build and deployment** → Source: `Deploy from a branch`
4. Branch: 가장 안정적 브랜치 (예: `claude/app-rating-branch-report-ESRfZ` 또는 `main`)
5. Folder: `/ (root)`
6. **Save**
7. 5분 대기 → 초록색 메시지 확인:
   ```
   ✅ Your site is live at https://luiseluise0619-wq.github.io/nursing-simulation/
   ```
8. 다음 URL 접속 확인 (Play Console 에 등록할 것들):
   - `https://luiseluise0619-wq.github.io/nursing-simulation/privacy.html`
   - `https://luiseluise0619-wq.github.io/nursing-simulation/terms.html`

### 6.2 Play Console에 URL 등록

- **개인정보 처방침 URL**: `https://luiseluise0619-wq.github.io/nursing-simulation/privacy.html`
- **마케팅 URL**: `https://luiseluise0619-wq.github.io/nursing-simulation/`
- **지원 URL**: (선택) GitHub Issues 페이지

### 6.3 AAB 업로드 (내부 테스트 트랙)

1. Play Console → 본인 앱 → **테스트 → 내부 테스트**
2. **"새 출시 만들기"**
3. AAB 파일 드래그 → `app-release.aab` 업로드
4. **출시 노트** (한국어):
```
첫 출시. 한국 간호사 국시 + NCLEX-RN 무료 학습.
35편 임상 시뮬레이션 + 2,520 정적 문제 + 약물 드릴.
모든 기능 무료, 광고는 부활/힌트 보상형만.
오류 신고는 앱 내 "오류 신고" 버튼.
```

### 6.4 내부 테스터 추가

1. **"테스터"** 탭
2. **"이메일 목록 만들기"**:
   ```
   본인@gmail.com
   친구1@gmail.com
   친구2@gmail.com
   ```
3. 저장 → **"테스트 링크 복사"**
4. 링크 클릭 → 본인 폰에서 앱 설치 → 작동 확인

### 6.5 Bug 발견 시

- 코드 수정 → `versionCode` +1 (1→2→3...)
- 빌드 → 새 AAB → 내부 테스트 트랙에 업로드 (덮어쓰기)
- 1-2시간 후 자동 배포

---

## Day 7-13 — 임상 베타 (병행)

### 7.1 베타 리뷰어 모집

**대상**: 현직 간호사 1명 (3년차 이상 권장)

**연락 경로**:
1. 학교 선후배 — 카톡 DM
2. 인스타 간호사 인플루언서 — 정중한 DM
3. 카카오톡 "간호사 모임" 오픈채팅 (검색)
4. 본인 학과 교수님 추천

### 7.2 요청 메시지 템플릿

```
안녕하세요!

간호 학습 앱을 만들었는데 출시 전 임상 검수 부탁드리고 싶어서 연락 드립니다.

📱 무료 간호 학습 앱 (한국 국시 + NCLEX 듀얼)
- 35편 임상 시뮬레이션
- 정적 문제 2,520개 (한국 + NCLEX)
- 약물 드릴 + 이미지 문제

부탁드리고 싶은 것: 1주일 동안 사용해보시고 임상적으로 잘못된 곳이 있으면 알려주시기.
보상:
- 출시 후 "임상 자문" 크레딧
- 무제한 무료 사용
- 작은 후원 (5만원) — 후원이라 시간 보상 차원

테스트 링크: [Play Console 내부 테스트 링크]
오류 신고: 앱 내 "오류 신고" 버튼 (자동으로 GitHub Issues 로 전송됨)

가능하실까요? 답변 기다리겠습니다.
```

### 7.3 베타 진행 (7일)

매일 확인:
1. 앱 내 오류 신고가 GitHub Issues 로 자동 전송됨
2. Issues 페이지 확인 → 코드 수정 → 새 AAB 업로드
3. 베타 리뷰어에게 "수정 완료" 알림

---

## Day 14 — 프로덕션 트랙 전환 → 출시!

### 14.1 내부 테스트 안정 확인

체크리스트:
- [ ] 7일 이상 크래시 없음
- [ ] 임상 베타 리뷰어 합격 (또는 주요 오류 모두 수정)
- [ ] 본인 폰에서 모든 모드 동작 확인

### 14.2 프로덕션 트랙 전환

1. Play Console → **테스트 → 폐쇄형 테스트** 건너뛰고 바로:
2. **프로덕션**
3. **"새 출시 만들기"**
4. 동일 AAB 사용 (또는 최신 버전)
5. 출시 노트 동일 또는 업데이트
6. **"검토 요청"**

### 14.3 Google 검토 대기

- **첫 출시**: 3-7일 (간혹 더 오래)
- 검토 통과 알림 이메일 받으면 → **출시 자동 시작**
- 검토 거부 시 → 사유 확인 → 수정 → 재제출

---

## 📊 출시 직후 (Day 15-44)

### 8.1 매일 5분 체크

| 대시보드 | URL | 확인 사항 |
|---------|-----|---------|
| **Play Console** | play.google.com/console | 다운로드 / 평점 / 신고 |
| **AdMob** | admob.google.com | 수익 (₩) |
| **GitHub Issues** | github.com/.../issues | 오류 신고 |

### 8.2 마케팅 (제로 예산 7가지)

매일 1가지씩:

1. **네이버 간호학과 카페 5곳** 직접 게시
   - 검색: "간호학과", "간호 국시 준비", "신규 간호사"
   - 톤: "졸업한 선배가 만든 무료 앱입니다"
   - 게시 글 예시:
     ```
     안녕하세요! 졸업한 선배가 만든 무료 간호 국시 앱 공유합니다.

     광고 거의 없고 회원가입 없습니다.
     - 한국 국시 320+ + NCLEX 2,200 문제
     - 35편 임상 시뮬레이션
     - 약물/이미지 문제

     Play Store: [본인 앱 링크]
     도움 되셨으면 좋겠습니다 🙏
     ```

2. **카카오톡 오픈채팅**
   - 검색: "국시 준비"
   - 가입 → 자연스럽게 1회 공유

3. **인스타 릴스 5개** (월 1개씩 5개월)
   - 7-15초, 큰 자막
   - 임상 케이스 → "당신은 어떻게?" → 앱 화면
   - 해시태그: `#간호학과 #국시 #NCLEX #간호사`

4. **유튜브 쇼츠** (인스타 영상 재활용)

5. **간호사 인플루언서 DM 30명** → 1-2명 자발 소개

6. **간호학과 교수님 메일** ("수업 자료로 활용 제안")

7. **티스토리/네이버 블로그** ("간호 국시 무료 앱" SEO)

### 8.3 첫 30일 KPI (현실치)

| 지표 | 비관 | 현실 | 낙관 |
|------|-----|-----|-----|
| 누적 다운로드 | 30 | 200 | 800 |
| MAU | 10 | 50 | 200 |
| 평점 | 3.5 | 4.2 | 4.7 |
| 리뷰 수 | 1 | 5 | 20 |
| AdMob 수익 | ₩500 | ₩5,000 | ₩50,000 |
| Toss 후원 | ₩0 | ₩10,000 | ₩100,000 |

---

## 🆘 자주 막히는 곳 (FAQ)

### Q1: AAB 업로드 시 "키 일치하지 않음"
- 동일 keystore 로 서명한 AAB 만 업로드 가능
- 다른 keystore 사용 시 → **새 앱으로 등록**해야 함
- Play App Signing 키 재설정은 Google 정책 위반 가능성

### Q2: AdMob 광고 안 나옴
- 신규 앱은 첫 24시간 광고 fill rate 매우 낮음 (정상)
- 1주 후에도 안 나오면 → AdMob 정책 위반 확인 (특히 테스트 ID 출시)

### Q3: Play Console 검토 거부 사유
- **콘텐츠 등급 불일치** → 재설문
- **개인정보 처방침 URL 접속 실패** → GitHub Pages 활성화 확인
- **앱 크래시 발견** → 내부 테스트로 재디버깅
- **민감 콘텐츠 미신고** → 자해/임종 콘텐츠 ⚠️ 라벨 명시
- **메타데이터 부정확** → 설명에 과장 X (예: "1위" / "공식" 등)

### Q4: 첫 100명이 모이지 않을 때
- 출시 자체로는 다운로드 X (당연)
- 마케팅 1순위 4개 반드시 실행 (네이버 / 카카오톡 / 인스타 / 유튜브)
- 첫 30일은 데이터 수집 + 학습 기간
- 마케팅 미실행 시 다운로드 0-30 가능

### Q5: 평점이 낮을 때 (3.5 이하)
- 1-2개 별점 1은 정상 (스팸, 오해)
- 인앱 리뷰 프롬프트 이미 코드에 있음 (만족 사용자만 호출)
- 부정 리뷰엔 즉시 답글 ("죄송합니다, 개선하겠습니다")
- 진짜 오류면 1주 내 수정 후 재배포

### Q6: 임상 베타 리뷰어가 없을 때
- 본인이 가능한 만큼 검수 → 출시 → 사용자 신고로 점진 개선
- 베타 부재가 출시 막는 차단 사유는 아님
- 출시 후 1-2명만 자발 신고 보내도 의미 있음

---

## 📅 출시 후 30-90일 로드맵

### 30일 후
- 사용자 100+ 도달 시 → iOS 빌드 시작 (Mac 필요)
- 두 번째 콘텐츠 업데이트 (사용자 요청 반영)

### 60일 후
- 영문 콘텐츠 강화 (Filipino NCLEX 시장 진출)
- Toss 후원 10명+ 도달 시 본격 프리미엄 결제 검토 (RevenueCat $0/월 시작)

### 90일 후 (MAU 500+)
- 백엔드 도입 검토 (Firebase 무료 티어)
- 임상 자문 영입 (월 30만원~)
- iOS 동시 운영

### 90일 후 (MAU 100 미만)
- 마케팅 재점검 — 인플루언서 1명 협업 시도
- 또는 부업/포트폴리오로 KEEP (지속 운영만)

---

## ✅ 최종 출시 직전 체크리스트

```
□ AdMob App ID 발급 완료
□ AdMob Rewarded 단위 ID 발급 완료
□ 코드 3곳 AdMob 실 ID 교체 (capacitor.config.json + AndroidManifest.xml + script.js)
□ script.js TOSS_HANDLE 본인 핸들 교체
□ Keystore 생성 + 비밀번호 USB 백업 완료
□ keystore.properties 작성 완료
□ android/app/build.gradle versionCode + versionName 설정
□ AAB 빌드 성공 (signed release)
□ 내부 테스트 1주일 + 본인 폰 작동 확인
□ 임상 베타 1명 시청 완료 (또는 본인 검수)
□ GitHub Pages 활성화 + privacy.html 접속 가능
□ Play Console $25 결제 + 본인 정보 입력
□ 메타데이터 입력 (한국어, 4000자 설명)
□ 스크린샷 8장 + 피쳐 그래픽 + 앱 아이콘 업로드
□ 개인정보 처방침 URL 등록
□ 콘텐츠 등급 설문 완료
□ 데이터 보안 설문 완료
□ 내부 테스트 → 프로덕션 트랙 전환
□ Google 검토 요청
□ 검토 통과 → 출시 🎉
□ Day 15+ 마케팅 1순위 4개 실행 시작
```

---

## 💡 마지막 조언

### 완벽 추구 X. 출시가 먼저.

- 첫 출시는 90% 완성도면 충분
- 부족한 건 사용자 피드백 보고 채우기
- "이거 더 다듬고 출시" → 영원히 출시 X
- 1.0 → 1.1 빠른 업데이트로 점진 개선

### Real artists ship.
— Steve Jobs

### 출시 X = 가치 0
콘텐츠 2,520문제도, 35편 시뮬레이션도, S 등급 코드도 — **사용자 없으면 모두 0**.

---

## 📞 막힐 때

- **코드 / 빌드 문제**: 저(Claude) 다시 호출
- **AdMob 문제**: https://support.google.com/admob
- **Play Console 문제**: https://support.google.com/googleplay/android-developer
- **친한 안드로이드 개발자** (가장 빠름)

---

**행운을 빕니다 🍀**

이 가이드를 따라 출시까지 7-10일.
2주 후엔 Play Store 에 본인 앱이 올라가 있을 거예요.
