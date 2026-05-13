# 📱 폰에서 5분 안에 사용하기

> 코드 수정 없이 그대로 출시하는 방법.

---

## ✅ 가장 빠른 길 (5분, 무료, 영구)

### 1️⃣ GitHub Pages 켜기 (한 번만)

PC에서 GitHub.com 가서:

1. 저장소 페이지 → **Settings** 탭
2. 왼쪽 메뉴 → **Pages**
3. **Source** = `Deploy from a branch`
4. **Branch** = `claude/add-questions-improve-design-vWPx2` (현재 브랜치)
5. **Folder** = `/ (root)`
6. **Save** 클릭
7. 1-2분 기다리면 페이지 위쪽에 초록색 박스로:

   ```
   ✅ Your site is live at
   https://luiseluise0619-wq.github.io/nursing-simulation/
   ```

   이 URL이 **앱의 영구 주소**입니다.

### 2️⃣ 폰에서 열기

#### iPhone (Safari)
1. 위 URL을 Safari에 입력
2. 페이지가 열리면 하단 **공유 버튼** (네모+위 화살표)
3. 스크롤 → **"홈 화면에 추가"**
4. 앱 이름 확인 후 **추가** → 끝

#### Android (Chrome)
1. 위 URL을 Chrome에 입력
2. 우측 상단 **⋮** 메뉴
3. **"앱 설치"** 또는 **"홈 화면에 추가"**
4. **설치** → 끝

### 3️⃣ 완료
- 홈 화면에 앱 아이콘 등장
- 풀스크린 앱처럼 작동
- 인터넷 끊겨도 작동
- 코드 수정·푸시할 때마다 자동 업뎃

---

## 🔄 새 문제 추가했을 때

```bash
# 1. PC에서
npm run release          # 자동 버전 갱신
git add -A
git commit -m "+30 문제"
git push

# 2. 끝!
# 사용자 폰에서 앱 다음 실행 시 자동 업데이트
```

---

## ⚠️ 주의사항

### 첫 접속 시 인터넷 필수
앱을 처음 열 때만 인터넷 필요. 그 후 오프라인 작동.

### iPhone은 Safari만
iOS는 PWA 설치를 Safari로만 허용. Chrome iOS도 안 됨 (Apple 정책).

### URL 공유법
링크를 카톡·메시지로 친구에게 보내면, 친구도 위 단계로 설치.

### 개인 데이터 위치
오답노트·즐겨찾기·SRS 카드 → **각 폰의 브라우저에 저장**.
앱 삭제 시 데이터 삭제. 백업: 앱 안 "설정 → 백업 내보내기".

---

## 🧪 다른 호스팅 옵션

GitHub Pages가 답답하다면:

### Netlify (드래그&드롭)
1. https://netlify.com 가입 (무료)
2. 메인 화면에 **폴더 통째로 드래그**
3. 즉시 URL 발급

### Vercel
1. GitHub 연동 → 자동 배포
2. https://vercel.com

### Cloudflare Pages
1. GitHub 연동 → 자동 배포
2. https://pages.cloudflare.com
3. **무제한 트래픽 무료**

모두 무료, 하나만 선택하면 됩니다.

---

## 📦 ZIP 파일 직접 받고 싶다면

GitHub 저장소 페이지 → 초록색 **Code** 버튼 → **Download ZIP**.
저장소 전체가 ZIP으로 다운로드됨 (코드 + 이 문서들 포함).

압축 풀고 `index.html`을 더블클릭하면 PC 브라우저에서 작동.
하지만 **폰에서 작동하려면 위의 호스팅 단계가 필요**합니다.

---

## 🆘 안 될 때

### "사이트에 연결할 수 없음"
- GitHub Pages 활성화 확인 (Settings → Pages)
- 활성화 후 1-2분 대기

### "홈 화면에 추가" 메뉴가 없음
- iPhone: Safari 사용 중인지 확인 (Chrome 안 됨)
- Android: Chrome이 아니면 안 될 수 있음

### 옛 버전이 계속 보임
- 앱 완전 종료 후 재실행
- 또는 폰에서 앱 삭제 후 다시 "홈 화면에 추가"

### 오프라인에서 안 됨
- 첫 접속 시 인터넷 있어야 캐시됨
- 앱을 한 번 끝까지 열어보면 모든 자산 캐시 완료
