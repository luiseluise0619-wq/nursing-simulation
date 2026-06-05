# E2E 테스트 (Playwright)

실 브라우저 자동화로 핵심 사용자 경로 검증.

## 설치

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

## 실행

```bash
# 헤드리스 (CI 용)
npm run test:e2e

# UI 모드 (디버깅, 시각적 확인)
npm run test:e2e:ui
```

`playwright.config.js`의 `webServer` 가 자동으로 `python3 -m http.server 8000` 실행.

## 커버하는 경로 (6개)

1. 첫 진입 — 메인 메뉴 노출
2. 학습 탭 → 풀이 → 과목별 풀이 진입
3. 듀티 시뮬레이션 — 시프트 picker → 게임 진입
4. 케밥 메뉴 → 테마 전환
5. NCLEX 모드 활성화 → 메뉴 노출
6. 이미지 문제 모음 시작

## 3가지 viewport (반응형 검증)

- mobile-portrait (390 × 844) — iPhone 14
- tablet (768 × 1024) — iPad
- desktop (1280 × 800)

`playwright.config.js` 의 `projects` 정의.

## 사용자가 보고 싶은 시나리오 추가

`tests/e2e/critical-paths.spec.js` 에 새 `test()` 추가.

```js
test("새 시나리오", async ({ page }) => {
    await seedLegalAccepted(page);
    await page.goto("/");
    // ...
});
```

## CI 통합 (선택)

GitHub Actions 예시:
```yml
- run: npm install
- run: npx playwright install --with-deps chromium
- run: npm run test:e2e
```
