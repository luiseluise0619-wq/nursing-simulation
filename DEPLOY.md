# 📱 폰 출시 가이드 — 5분 안에 배포

이 앱을 친구·환자·학생들이 휴대폰에서 사용할 수 있게 만드는 방법.

---

## 🚀 가장 빠른 길 — GitHub Pages (무료, 5분)

### 1단계: GitHub에 코드 push 확인
이 가이드를 읽고 있다면 이미 GitHub에 있는 상태일 겁니다.
없다면 [GitHub Desktop](https://desktop.github.com/) 다운로드 후 push.

### 2단계: GitHub Pages 켜기

1. GitHub 저장소 페이지 열기
2. 상단 **Settings** 탭 클릭
3. 왼쪽 메뉴에서 **Pages** 찾기
4. **Source** 섹션:
   - **Deploy from a branch** 선택
   - **Branch**: `main` (또는 현재 브랜치 이름)
   - **Folder**: `/ (root)`
   - **Save** 클릭
5. 1~2분 기다리면 페이지 위쪽에 URL 표시됨:
   ```
   ✅ Your site is live at https://<username>.github.io/<repo-name>/
   ```

### 3단계: 휴대폰에서 설치

#### 📱 iPhone (Safari 사용)
1. 위 URL을 Safari에서 열기 (Chrome 말고 **반드시 Safari**)
2. 하단 **공유** 버튼 (네모 + 위 화살표)
3. 스크롤 다운 → **"홈 화면에 추가"** 선택
4. 이름 확인 후 **"추가"** 탭
5. 홈 화면에 앱 아이콘 등장 — 탭하면 풀스크린 앱처럼 작동

#### 🤖 Android (Chrome 사용)
1. 위 URL을 Chrome에서 열기
2. 우측 상단 **⋮ (더보기)** 메뉴
3. **"앱 설치"** 또는 **"홈 화면에 추가"** 선택
4. **"설치"** 확인
5. 홈 화면 + 앱 서랍에 추가됨

---

## 🔄 사용자 자동 업데이트 — 어떻게 작동하나

```
[당신: 문제 추가 후]
  ↓
npm run release          ◄── 한 줄!
git add -A
git commit -m "+50 문제"
git push
  ↓ (1-2분 후 GitHub Pages 자동 배포)
  ↓
[모든 사용자의 폰]
앱 열기 → 백그라운드에서 새 버전 감지 → 다음 실행 시 자동 적용
```

### `npm run release`가 하는 일
1. `script.js`와 `index.html` 내용으로 SHA256 해시 계산
2. `service-worker.js`의 `CACHE_NAME`을 새 해시로 갱신
3. `package.json`의 버전 번호 증가
4. → 사용자 브라우저가 새 버전 감지 가능

**⚠️ 주의**: 이 명령어를 실행하지 않고 push하면 사용자는 **옛 버전을 계속 봅니다**.

---

## 📊 PWA의 장단점

### 장점 ✅
- 즉시 배포 (앱스토어 심사 없음)
- 모든 OS 지원 (iOS / Android / 데스크톱)
- 무료
- 자동 업데이트
- 오프라인 작동
- 주소 공유 가능

### 단점 ❌
- 앱스토어에서 검색 안 됨 (직접 URL 공유 필요)
- 푸시 알림 제한 (iOS 16.4+ 만 부분 지원)
- 광고 수익화 제한
- "앱 같지만" 일부 제한 (예: 백그라운드 작업)

---

## 🏪 네이티브 앱 (App Store / Play Store) — 본격 출시

### 필요 조건
| 항목 | iOS | Android |
|---|---|---|
| 개발 OS | Mac만 | Mac/Windows/Linux |
| 도구 | Xcode (무료) | Android Studio (무료) |
| 스토어 계정 | Apple Developer ($99/년) | Google Play Console ($25 1회) |
| 심사 기간 | 1~2주 | 1~3일 |
| 거부율 | 높음 | 낮음 |

### 빌드 단계 (Capacitor)

```bash
# 한 번만: Capacitor 설치
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android

# 한 번만: 플랫폼 추가
npx cap add ios       # iOS 폴더 생성
npx cap add android   # Android 폴더 생성

# 코드 수정할 때마다
npx cap sync          # 웹 코드를 네이티브 폴더에 복사

# IDE에서 빌드 / 실행
npx cap open ios      # Xcode 열림 → ▶️ Run
npx cap open android  # Android Studio 열림 → ▶️ Run
```

### 스토어 제출 전 체크리스트

- [ ] **PNG 아이콘** 1024x1024 (앱스토어용)
- [ ] **개인정보 처리방침 URL** (필수)
- [ ] **이용약관 URL** (필수)
- [ ] **앱 스크린샷** 5~10개 (각 화면 비율별)
- [ ] **앱 설명문** (한국어/영어)
- [ ] **연령 등급** 설정 (의료앱은 17+ 권장)
- [ ] **의료 면책 조항** (이미 앱 내 모달로 있음)
- [ ] **테스트 계정** (스토어 심사용 — 필요 시)

---

## 🆘 자주 묻는 질문

### Q. PWA 설치 후 인터넷 끊겨도 작동하나요?
**A. 네**. 처음 한 번 페이지를 열었다면 모든 자산이 캐시됩니다. 비행기 모드에서도 작동.

### Q. 사용자 데이터(오답노트, 즐겨찾기)는 어디 저장되나요?
**A. 휴대폰의 브라우저 `localStorage`**. 앱을 삭제하면 데이터도 사라집니다. 백업하려면 앱 안의 "설정 → 백업 내보내기" 사용.

### Q. iPhone에서 PWA가 Safari 외 브라우저로는 설치 안 되나요?
**A. 네, iOS는 Safari만 PWA 설치 지원**. Chrome iOS도 안 됨. Apple 정책.

### Q. 코드 push했는데 사용자 폰에서는 옛날 버전이 보여요
**A. `npm run release`를 안 하셨거나, 사용자가 아직 앱을 열지 않았기 때문**. 사용자가 앱을 다시 열고 새로고침하면 새 버전이 자동 적용됩니다. 빠르게 강제하려면 `service-worker.js`를 수동으로 수정해도 OK.

### Q. GitHub Pages가 무료인데 한계는?
**A. 한 달 100GB 트래픽, 1GB 저장소까지 무료**. 일반 사용자 수만 명까지는 충분. 그 이상은 Cloudflare Pages·Vercel·Netlify (모두 더 큰 무료 한도 제공).

### Q. 광고로 수익화하려면?
**A. PWA 단독으로는 어려움**. Capacitor로 감싸 네이티브 앱으로 만든 후 AdMob 통합 필요. 또는 별도 후원·구독 모델 (Buy Me a Coffee 등 링크).

---

## 🎯 권장 출시 전략

| 단계 | 시기 | 행동 |
|---|---|---|
| **1. 베타** | 지금 즉시 | PWA → 친구 5-10명에게 URL 공유 |
| **2. 콘텐츠** | 1-2주 후 | 피드백 받아 문제 수정·추가 |
| **3. 의료 검수** | 1개월 후 | RN/MD에게 CSV 검수 의뢰 (`tools/export-questions.js`) |
| **4. 정식** | 2-3개월 후 | Capacitor → Android Play Store (심사 빠름) |
| **5. iOS** | 4-6개월 후 | App Store 도전 (개발자 계정 + 의료앱 심사 까다로움) |

이 가이드대로 따르면 **오늘 안에 PWA 출시 가능**, 그리고 사용자 누적되면 자연스럽게 네이티브로 진화할 수 있습니다. 💚
