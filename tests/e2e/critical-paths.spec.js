// 핵심 사용자 경로 5개 — 실 브라우저 자동화
// 실행: npx playwright test (서버는 자동 실행됨)
const { test, expect } = require("@playwright/test");

// 약관/온보딩 자동 통과 헬퍼 (테스트 격리)
async function seedLegalAccepted(page) {
    await page.addInitScript(() => {
        try {
            localStorage.setItem("nurseSim:v1", JSON.stringify({
                accepted: { version: "1.0", at: Date.now() },
                onboarded: true,
            }));
        } catch {}
    });
}

test.describe("핵심 경로", () => {
    test.beforeEach(async ({ page }) => {
        await seedLegalAccepted(page);
        await page.goto("/");
        await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });
    });

    test("1) 첫 진입 — 메인 메뉴 노출", async ({ page }) => {
        await expect(page.locator("h1.menu-title-v2")).toBeVisible();
        await expect(page.locator('[data-action="initSurvival"]')).toBeVisible();
        await expect(page.locator('[data-action="startDailyChallenge"]')).toBeVisible();
    });

    test("2) 학습 탭 → 풀이 메뉴 → 과목별 풀이 진입", async ({ page }) => {
        await page.click('[data-action="setMenuTab"][data-tab="study"]');
        await expect(page.locator('[data-action="renderPracticeMenu"]')).toBeVisible();
        await page.click('[data-action="renderPracticeMenu"]');
        await expect(page.locator('[data-action="renderQuizMenu"]')).toBeVisible();
        await page.click('[data-action="renderQuizMenu"]');
        // 과목 8개 노출
        const subjects = page.locator('[data-action="startQuiz"]');
        await expect(subjects).toHaveCount(9); // 8 + __random__
    });

    test("3) 듀티 시뮬레이션 — 시프트 picker → 게임 진입", async ({ page }) => {
        await page.click('[data-action="initSurvival"]');
        await expect(page.locator('[data-action="pickShift"][data-shift="Day"]')).toBeVisible();
        await page.click('[data-action="pickShift"][data-shift="Day"]');
        await expect(page.locator(".scene-card")).toBeVisible({ timeout: 5000 });
    });

    test("4) 케밥 메뉴 → 테마 전환", async ({ page }) => {
        await page.click("#kebab-btn");
        await expect(page.locator("#kebab-menu")).toBeVisible();
        await page.click('[data-action="toggleTheme"]');
        // 테마 변경됨 (data-theme 속성)
        const theme = await page.locator("html").getAttribute("data-theme");
        expect(["dark", "amoled", "light"]).toContain(theme);
    });

    test("5) NCLEX 모드 전환 → NCLEX 메뉴 진입", async ({ page }) => {
        // 설정 페이지 진입
        await page.click("#kebab-btn");
        await page.click('[data-action="openSettings"]');
        await expect(page.locator(".scene-title")).toContainText("설정");
        // NCLEX 모드 활성화
        await page.click('[data-action="setExamMode"][data-mode="nclex"]');
        // 메뉴로 복귀
        await page.click('[data-action="returnToMenu"]');
        // 학습 탭 → 풀이 메뉴에 NCLEX 노출
        await page.click('[data-action="setMenuTab"][data-tab="study"]');
        await page.click('[data-action="renderPracticeMenu"]');
        await expect(page.locator('[data-action="renderNclexMenu"]')).toBeVisible();
    });
});

test.describe("이미지 문제 모음 (학습 가치)", () => {
    test.beforeEach(async ({ page }) => {
        await seedLegalAccepted(page);
        await page.goto("/");
        await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });
    });

    test("이미지 카테고리 자동 분류 후 풀이 시작 가능", async ({ page }) => {
        await page.click('[data-action="setMenuTab"][data-tab="study"]');
        await page.click('[data-action="renderDrillMenu"]');
        await page.click('[data-action="renderImageQuizMenu"]');
        // 전체 무작위 버튼 항상 노출
        await expect(page.locator('[data-action="startImageQuiz"][data-bucket="__all__"]')).toBeVisible();
        // 시작
        await page.click('[data-action="startImageQuiz"][data-bucket="__all__"]');
        await expect(page.locator("#image-quiz-choices")).toBeVisible({ timeout: 5000 });
    });
});

test.describe("한국 국시 정적 문제 (320+)", () => {
    test.beforeEach(async ({ page }) => {
        await seedLegalAccepted(page);
        await page.goto("/");
        await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });
    });

    test("한국 국시 메뉴 진입 → 8과목 노출 + 시작 가능", async ({ page }) => {
        await page.click('[data-action="setMenuTab"][data-tab="study"]');
        await page.click('[data-action="renderPracticeMenu"]');
        await page.click('[data-action="renderKorMenu"]');
        await expect(page.locator('[data-action="startKorQuiz"][data-arg="__all__"]')).toBeVisible();
        // 8 카테고리 버튼 노출 (전체 + 8 = 9)
        const cats = page.locator('[data-action="startKorQuiz"]');
        await expect(cats).toHaveCount(9);
        // 5지선다 시작
        await page.click('[data-action="startKorQuiz"][data-arg="__all__"]');
        const choices = page.locator("#kor-choices .choice-btn");
        await expect(choices).toHaveCount(5);
    });
});

test.describe("약물 드릴 (50종)", () => {
    test.beforeEach(async ({ page }) => {
        await seedLegalAccepted(page);
        await page.goto("/");
        await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });
    });

    test("약물 드릴 시작 → 4지선다 보기 노출", async ({ page }) => {
        await page.click('[data-action="setMenuTab"][data-tab="study"]');
        await page.click('[data-action="renderDrillMenu"]');
        await page.click('[data-action="renderDrugDrill"]');
        await page.click('[data-action="startDrugDrill"]');
        const choices = page.locator("#drug-drill-choices .choice-btn");
        await expect(choices).toHaveCount(4);
    });
});

test.describe("케밥 메뉴 (UX)", () => {
    test.beforeEach(async ({ page }) => {
        await seedLegalAccepted(page);
        await page.goto("/");
        await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });
    });

    test("케밥 → 4 옵션 (테마/사운드/언어/설정)", async ({ page }) => {
        await page.click("#kebab-btn");
        const menu = page.locator("#kebab-menu");
        await expect(menu).toBeVisible();
        await expect(menu.locator('[data-action="toggleTheme"]')).toBeVisible();
        await expect(menu.locator('[data-action="toggleSound"]')).toBeVisible();
        await expect(menu.locator('[data-action="toggleLang"]')).toBeVisible();
        await expect(menu.locator('[data-action="openSettings"]')).toBeVisible();
    });

    test("언어 토글 → 영어로 변경 + 다시 한국어 복귀", async ({ page }) => {
        await page.click("#kebab-btn");
        await page.click('[data-action="toggleLang"]');
        // 영어 라벨 일부 노출 확인 (학습 탭)
        await page.click('[data-action="setMenuTab"][data-tab="study"]');
        await expect(page.locator(".row-title").first()).toContainText("Practice");
        // 다시 한국어로
        await page.click("#kebab-btn");
        await page.click('[data-action="toggleLang"]');
        await page.click('[data-action="toggleLang"]');
        await page.click('[data-action="toggleLang"]');
        await page.click('[data-action="setMenuTab"][data-tab="study"]');
        await expect(page.locator(".row-title").first()).toContainText("풀이");
    });
});

test.describe("데이터 컨트롤 (GDPR)", () => {
    test.beforeEach(async ({ page }) => {
        await seedLegalAccepted(page);
        await page.goto("/");
        await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });
    });

    test("설정 → 내 데이터 페이지 진입 + 백업 버튼 노출", async ({ page }) => {
        await page.click("#kebab-btn");
        await page.click('[data-action="openSettings"]');
        await page.click('[data-action="renderDataControl"]');
        await expect(page.locator(".scene-title")).toContainText("내 데이터");
        await expect(page.locator('[data-action="exportData"]')).toBeVisible();
        await expect(page.locator('[data-action="exportErrLog"]')).toBeVisible();
    });
});
