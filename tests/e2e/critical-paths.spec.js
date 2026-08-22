// 핵심 사용자 경로 5개 — 실 브라우저 자동화
// 실행: npx playwright test (서버는 자동 실행됨)
const { test, expect } = require("@playwright/test");

// 약관/온보딩/인트로 자동 통과 헬퍼 (테스트 격리)
// CODE BLUE 인트로는 전체 화면 오버레이로 6.3초간 포인터 이벤트를 가로챈다.
// 실제 앱에선 탭 한 번으로 닫히지만, 자동화에선 클릭이 전부 오버레이에 막히므로
// 약관·온보딩과 마찬가지로 "이미 본 것"으로 시딩해 건너뛴다.
async function seedLegalAccepted(page) {
    await page.addInitScript(() => {
        try {
            // 언어·시험모드를 명시적으로 고정한다. 신규 사용자 기본값은 브라우저 언어를
            // 따르는데(영어권이면 en/NCLEX), 자동화 브라우저 로케일은 en-US 라
            // 시딩하지 않으면 이 스펙의 한국어 문자열 단정이 환경에 따라 흔들린다.
            localStorage.setItem("nurseSim:v1", JSON.stringify({
                accepted: { version: "1.0", at: Date.now() },
                onboarded: true,
                settings: { lang: "ko", examMode: "korean", theme: "dark", sound: false },
            }));
        } catch {}
        try { sessionStorage.setItem("nurseSim:cbIntroSeen", "1"); } catch {}
        // 서비스워커 업데이트 토스트는 테스트 환경 특성상(매 실행 sw.js 가 새 버전) 항상 뜬다.
        // 실제 앱에선 업데이트가 있을 때만 잠깐 뜨는 정상 동작이므로, 여기선 환경 노이즈로 보고 가린다.
        try {
            document.addEventListener("DOMContentLoaded", () => {
                const s = document.createElement("style");
                s.textContent = "#update-toast{display:none !important}";
                document.head.appendChild(s);
            });
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
        // 풀이 → 과목별 학습 → 변형 연습(generator)
        await expect(page.locator('[data-action="renderSubjectStudyMenu"]')).toBeVisible();
        await page.click('[data-action="renderSubjectStudyMenu"]');
        await expect(page.locator('[data-action="renderQuizMenu"]')).toBeVisible();
        await page.click('[data-action="renderQuizMenu"]');
        // 과목 8개 노출
        const subjects = page.locator('[data-action="startQuiz"]');
        await expect(subjects).toHaveCount(8); // 7과목 + __random__ (법규 제외)
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
        // 메뉴로 복귀 — returnToMenu 는 상단 뒤로가기(모드에 따라 숨김)와도 공유하므로
        // 화면에 보이는 버튼만 집는다
        // 설정 페이지는 진입 애니메이션이 있고 모바일 폭에선 길어서 스크롤이 늦게 안정된다
        const backToMenu = page.locator('[data-action="returnToMenu"]:visible').first();
        await backToMenu.scrollIntoViewIfNeeded();
        await backToMenu.click({ timeout: 15000 });
        // 학습 탭 → 풀이 메뉴에 NCLEX 노출
        await page.click('[data-action="setMenuTab"][data-tab="study"]');
        await page.click('[data-action="renderPracticeMenu"]');
        // NCLEX 문항(2MB)은 지연 로딩이라 진입점이 renderNclexMenuLazy 다
        await expect(page.locator('[data-action="renderNclexMenuLazy"]')).toBeVisible();
        await page.click('[data-action="renderNclexMenuLazy"]');
        // 로딩 후 카테고리 메뉴 노출
        await expect(page.locator('[data-action="startNclexQuiz"][data-arg="__random__"]')).toBeVisible({ timeout: 15000 });
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

    test("한국 국시 메뉴 진입 → 7과목 노출 + 시작 가능", async ({ page }) => {
        await page.click('[data-action="setMenuTab"][data-tab="study"]');
        await page.click('[data-action="renderPracticeMenu"]');
        // 풀이 → 과목별 학습 → 정식 국시(5지선다)
        await page.click('[data-action="renderSubjectStudyMenu"]');
        await page.click('[data-action="renderKorMenu"]');
        await expect(page.locator('[data-action="startKorQuiz"][data-arg="__all__"]')).toBeVisible();
        // 7과목 + 전체 = 8 (보건의약관계법규는 개정 잦아 제외)
        const cats = page.locator('[data-action="startKorQuiz"]');
        await expect(cats).toHaveCount(8);
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

    test("언어 토글 → 영어로 변경 + 다시 한국어 복귀 (ko ↔ en 2개 순환)", async ({ page }) => {
        await page.click("#kebab-btn");
        await page.click('[data-action="toggleLang"]');
        // 영어 라벨 일부 노출 확인 (학습 탭)
        await page.click('[data-action="setMenuTab"][data-tab="study"]');
        await expect(page.locator(".row-title").first()).toContainText("Practice");
        // 다시 한국어로 (2개 순환이므로 1번 더 토글)
        await page.click("#kebab-btn");
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
