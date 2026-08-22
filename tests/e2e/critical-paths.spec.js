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

// =========================================================================
// 차별화 기능 — 심전도 판독 · 주사 부위 짚기 · AI 학습 튜터
// 경쟁 시험앱에 없는 기능이라 회귀 시 타격이 크다. 실브라우저에서만 검증 가능한
// 요소(canvas 실제 렌더, SVG 히트 영역, 네트워크 실패 폴백)를 다룬다.
// =========================================================================
test.describe("심전도 판독", () => {
    test.beforeEach(async ({ page }) => {
        await seedLegalAccepted(page);
        await page.goto("/");
        await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });
        await page.click('[data-action="setMenuTab"][data-tab="study"]');
        await page.click('[data-action="renderDrillMenu"]');
        await page.click('[data-action="startEcgQuiz"]');
    });

    test("임상용지 위에 파형이 실제로 그려지고 5지선다로 판독한다", async ({ page }) => {
        const canvas = page.locator("#ecg-canvas");
        await expect(canvas).toBeVisible();

        // 캔버스가 부모 폭을 채우고 세로가 붕괴하지 않아야 한다 (레이아웃 전 렌더 회귀 방지)
        const box = await canvas.boundingBox();
        expect(box.width).toBeGreaterThan(200);
        expect(box.height).toBeGreaterThan(100);

        // 흰 종이만 있고 파형이 없는 상태를 걸러낸다 — 어두운 픽셀이 실제로 존재해야 함
        const inkRatio = await page.evaluate(() => {
            const c = document.getElementById("ecg-canvas");
            const ctx = c.getContext("2d");
            const d = ctx.getImageData(0, 0, c.width, c.height).data;
            let ink = 0;
            for (let i = 0; i < d.length; i += 4) {
                if (d[i] < 90 && d[i + 1] < 90 && d[i + 2] < 90) ink++;
            }
            return ink / (d.length / 4);
        });
        expect(inkRatio).toBeGreaterThan(0.001);

        // 5지선다 → 답하면 정답 표시와 해설이 뜬다
        const choices = page.locator("#ecg-choices .choice-btn");
        await expect(choices).toHaveCount(5);
        await choices.first().click();
        await expect(page.locator("#ecg-feedback")).toBeVisible();
        await expect(page.locator("#ecg-choices .correct-flash")).toHaveCount(1);
        await expect(page.locator('[data-action="ecgQuizNext"]')).toBeVisible();
    });

    test("순수 학습 모드라 HP·평판·근무 배지가 뜨지 않는다", async ({ page }) => {
        await expect(page.locator("#hp-gauge")).toHaveClass(/hidden/);
        await expect(page.locator("#rep-gauge")).toHaveClass(/hidden/);
        await expect(page.locator("#inventory-bar")).not.toContainText("근무");
    });
});

test.describe("주사 부위 짚기", () => {
    test.beforeEach(async ({ page }) => {
        await seedLegalAccepted(page);
        await page.goto("/");
        await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });
        await page.click('[data-action="setMenuTab"][data-tab="study"]');
        await page.click('[data-action="renderDrillMenu"]');
        await page.click('[data-action="startSiteQuiz"]');
    });

    test("인체 도식의 부위를 탭하면 정답 위치가 표시된다", async ({ page }) => {
        await expect(page.locator(".body-svg")).toBeVisible();
        const hits = page.locator(".site-hit");
        await expect(hits).toHaveCount(4);
        await hits.first().click();
        await expect(page.locator("#site-feedback")).toBeVisible();
        // 정답 부위는 항상 하나 강조된다 (오답을 골랐어도 정답 위치를 알려줘야 학습이 된다)
        await expect(page.locator(".site-zone.site-correct")).toHaveCount(1);
    });

    test("터치 타깃이 손가락 크기(44px)에 가깝다", async ({ page }) => {
        const box = await page.locator(".site-hit").first().boundingBox();
        expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(40);
    });
});

test.describe("AI 학습 튜터", () => {
    test.beforeEach(async ({ page }) => {
        await seedLegalAccepted(page);
        await page.goto("/");
        await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });
        await page.click('[data-action="setMenuTab"][data-tab="study"]');
        await page.click('[data-action="renderTutor"]');
    });

    test("전송 고지와 무료 질문 잔여 횟수를 입력 전에 보여준다", async ({ page }) => {
        await expect(page.locator("#tutor-input")).toBeVisible();
        // 외부 AI 전송은 개인정보 고지 대상 — 입력하기 전에 보여야 한다
        await expect(page.locator(".tutor-privacy")).toBeVisible();
        await expect(page.locator("#tutor-quota")).toContainText("5");
    });

    test("서버가 실패해도 앱이 죽지 않고 안내로 폴백한다", async ({ page }) => {
        // API 키 미설정 등으로 /api/tutor 가 실패하는 실제 상황을 재현
        await page.route("**/api/tutor", route => route.fulfill({ status: 500, body: "{}" }));
        await page.fill("#tutor-input", "심부전 환자에게 반좌위를 취하는 이유는?");
        await page.click('[data-action="tutorAsk"]');
        await expect(page.locator("#tutor-answer")).toBeVisible();
        await expect(page.locator("#tutor-answer")).toContainText("다시 시도");
        // 실패한 질문은 무료 횟수를 소모하지 않아야 한다
        await expect(page.locator("#tutor-quota")).toContainText("5");
    });

    test("답변은 근거로 삼은 문항 번호와 함께 표시된다", async ({ page }) => {
        await page.route("**/api/tutor", route =>
            route.fulfill({ status: 200, contentType: "application/json",
                body: JSON.stringify({ answer: "반좌위는 정맥 환류를 줄여 폐 울혈을 완화합니다. [출처: #kor-001]" }) }));
        await page.fill("#tutor-input", "심부전 환자에게 반좌위를 취하는 이유는?");
        await page.click('[data-action="tutorAsk"]');
        await expect(page.locator(".tutor-reply")).toContainText("정맥 환류");
        await expect(page.locator(".tutor-src")).toContainText("#kor-");
        await expect(page.locator("#tutor-quota")).toContainText("4");
    });
});

test.describe("국시 풀이 화면", () => {
    test.beforeEach(async ({ page }) => {
        await seedLegalAccepted(page);
        await page.goto("/");
        await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });
        await page.click('[data-action="setMenuTab"][data-tab="study"]');
        await page.click('[data-action="renderPracticeMenu"]');
        await page.click('[data-action="renderSubjectStudyMenu"]');
        await page.click('[data-action="renderKorMenu"]');
        await page.click('[data-action="startKorQuiz"][data-arg="__all__"]');
    });

    test("상단바가 국시 모드로 갱신된다 (진행률·상태가 대기로 멈추지 않음)", async ({ page }) => {
        await expect(page.locator("#progress-text")).toContainText("국시");
        await expect(page.locator("#inventory-bar")).not.toContainText("대기");
    });

    test("정답 표시 배지가 보기 텍스트를 가리지 않는다", async ({ page }) => {
        await page.locator("#kor-choices .choice-btn").first().click();
        const marked = page.locator("#kor-choices .correct-flash");
        await expect(marked).toHaveCount(1);
        // 배지(우측 26px + 여백)가 앉을 자리를 확보했는지 — 확보 못 하면 긴 보기의 끝 글자가 잘린다
        const pr = await marked.evaluate(el => parseFloat(getComputedStyle(el).paddingRight));
        expect(pr).toBeGreaterThanOrEqual(48);
    });
});
