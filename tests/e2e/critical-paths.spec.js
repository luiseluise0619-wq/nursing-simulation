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
            // addInitScript 는 새로고침마다 다시 실행된다. 무조건 덮어쓰면 리로드 후
            // 저장 상태를 검증하는 테스트가 항상 초기값을 보게 되므로, 없을 때만 심는다.
            if (!localStorage.getItem("nurseSim:v1")) {
                localStorage.setItem("nurseSim:v1", JSON.stringify({
                    accepted: { version: "1.0", at: Date.now() },
                    onboarded: true,
                    settings: { lang: "ko", examMode: "korean", theme: "dark", sound: false },
                }));
            }
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

// 상단바(진행률·상태)는 모드마다 갱신돼야 한다. renderKorCard 처럼 updateStats 호출을
// 빠뜨리거나 라벨/배지 목록에서 누락되면 학습 내내 "진행도 0% · 대기"로 멈춘다.
const TOPBAR_MODES = [
    ["약물 드릴", [['[data-action="setMenuTab"][data-tab="study"]'], ['[data-action="renderDrillMenu"]'],
                 ['[data-action="renderDrugDrill"]'], ['[data-action="startDrugDrill"]']]],
    ["이미지 문제", [['[data-action="setMenuTab"][data-tab="study"]'], ['[data-action="renderDrillMenu"]'],
                 ['[data-action="renderImageQuizMenu"]'], ['[data-action="startImageQuiz"][data-bucket="__all__"]']]],
    ["트리아지", [['[data-action="setMenuTab"][data-tab="study"]'], ['[data-action="renderDrillMenu"]'],
                ['[data-action="startTriage"]']]],
    ["인계 듣기", [['[data-action="setMenuTab"][data-tab="study"]'], ['[data-action="renderDrillMenu"]'],
                ['[data-action="startHandoff"]'], ['[data-action="startHandoffRandom"]']]],
];
test.describe("상단바 모드 반영", () => {
    for (const [name, steps] of TOPBAR_MODES) {
        test(`${name} — 진행률·상태가 대기로 멈추지 않는다`, async ({ page }) => {
            await seedLegalAccepted(page);
            await page.goto("/");
            await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });
            for (const [sel] of steps) await page.click(sel);
            await expect(page.locator("#progress-text")).not.toHaveText("진행도");
            await expect(page.locator("#inventory-bar")).not.toContainText("대기");
        });
    }
});

// 하위 페이지에서 빠져나갈 수 없으면 사용자는 앱을 껐다 켜야 한다.
// 대시보드는 탈출 버튼이 아예 없었고, 약관 보기는 첫 실행용 동의 게이트를 재사용해
// "동의 체크 → 동의하고 시작하기"를 다시 거쳐야만 나올 수 있었다.
test.describe("화면 탈출 경로", () => {
    test.beforeEach(async ({ page }) => {
        await seedLegalAccepted(page);
        await page.goto("/");
        await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });
    });

    test("대시보드에서 메인 메뉴로 돌아갈 수 있다", async ({ page }) => {
        await page.click('[data-action="setMenuTab"][data-tab="my"]');
        await page.click('[data-action="renderDashboard"]');
        await expect(page.locator(".scene-title")).toContainText("대시보드");
        await page.locator('[data-action="returnToMenu"]:visible').first().click();
        await expect(page.locator("h1.menu-title-v2")).toBeVisible();
    });

    test("약관 보기는 재동의 없이 닫을 수 있다", async ({ page }) => {
        await page.click("#kebab-btn");
        await page.click('[data-action="openSettings"]');
        await page.evaluate(() => document.querySelectorAll("details.settings-acc").forEach(d => { d.open = true; }));
        await page.click('[data-action="showLegal"]');
        // 읽기 전용 — 동의 체크박스와 동의 버튼이 없어야 한다
        await expect(page.locator("#legal-consent-check")).toHaveCount(0);
        await expect(page.locator(".legal-accept-btn")).toHaveCount(0);
        await page.locator('[data-action="returnToMenu"]:visible').first().click();
        await expect(page.locator("h1.menu-title-v2")).toBeVisible();
    });
});

// 저장소 validate 가 국시 7과목만 옮겨 담아, 그 외 카테고리로 푼 기록이 다음 load 에서
// 사라졌다. 일일 챌린지는 한 문항이 매번 유실됐고, NCLEX 는 아예 통계에 남지 않았다.
test.describe("학습 기록 보존", () => {
    test("일일 챌린지 10문항이 모두 집계된다", async ({ page }) => {
        await seedLegalAccepted(page);
        await page.goto("/");
        await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });
        await page.click('[data-action="startDailyChallenge"]');
        for (let i = 0; i < 10; i++) {
            const c = page.locator("#choice-list .choice-btn:not([disabled])").first();
            if (await c.count() === 0) break;
            await c.click();
            const next = page.locator("#feedback-zone .choice-btn.primary").first();
            if (await next.count() && await next.isVisible()) await next.click();
        }
        const solved = await page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem("nurseSim:v1") || "{}");
            return Object.values(d.stats || {}).reduce((s, v) => s + (v.solved || 0), 0);
        });
        expect(solved).toBe(10);
    });

    test("국시 외 카테고리 기록이 새로고침 후에도 남는다", async ({ page }) => {
        await seedLegalAccepted(page);
        await page.goto("/");
        await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });
        // NCLEX client need 처럼 CATEGORIES 밖의 카테고리를 직접 심는다
        await page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem("nurseSim:v1") || "{}");
            d.stats = d.stats || {};
            d.stats["Physiological Integrity"] = { solved: 7, correct: 5 };
            localStorage.setItem("nurseSim:v1", JSON.stringify(d));
        });
        await page.reload();
        await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });
        const kept = await page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem("nurseSim:v1") || "{}");
            return (d.stats || {})["Physiological Integrity"] || null;
        });
        expect(kept).toEqual({ solved: 7, correct: 5 });
        // 대시보드에도 노출돼야 한다 — 기록만 남고 안 보이면 의미가 없다
        await page.click('[data-action="setMenuTab"][data-tab="my"]');
        await page.click('[data-action="renderDashboard"]');
        await expect(page.locator(".dashboard-grid")).toContainText("Physiological Integrity");
    });
});

test("저장 데이터가 새로고침을 왕복해도 온전하다", async ({ page }) => {
    // validate() 가 필드를 하나라도 빠뜨리면 그 기능은 "세션 안에서만 동작"하게 된다.
    // 실제로 통계(국시 외 과목)와 배지 마일스톤 카운터가 그렇게 사라지고 있었다.
    await seedLegalAccepted(page);
    await page.goto("/");
    await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });
    const rich = {
        accepted: { version: "1.0", at: 1700000000000 }, onboarded: true, firstActionDone: true,
        settings: { lang: "ko", examMode: "korean", theme: "dark", sound: false, haptics: true, tts: false },
        stats: { "성인간호학": { solved: 12, correct: 9 }, "Physiological Integrity": { solved: 5, correct: 4 } },
        bookmarks: { bm1: { type: "kor", label: "L", ts: 1700000000000 } },
        bestCombo: 11, mockBest: 88, handoffBest: 77, triageBest: 66,
        scenarios: { sc1: { bestHp: 90, bestRep: 20, completed: true } },
        episodes: { ep1: { completed: true, at: 1700000000000 } },
        episodeProgress: { ep2: { step: 3, hp: 80, rep: 10 } },
        streak: { count: 4, best: 9, lastDate: "2026-08-20", freezeUsedAt: null },
        daily: { "2026-08-20": { completed: true, correct: 8 } },
        achievements: { unlocked: [{ id: "first-step", at: 1700000000000 }], lastChecked: 1,
                        hintUsedCount: 2, graduatedCount: 1, counters: { perfectSets: 1, imageCorrect: 4 } },
        perks: { unlocked: ["p1"] },
        referral: { myCode: "ABC123", invitedBy: "XYZ123", invitesSent: 2,
                    bonusGranted: true, bonusAwardedOnce: true, bonusAwardedDate: "2026-08-20" },
        persona: { discipline: "nclex", year: null, choseAt: 1700000000000 },
        notifyOptIn: true,
    };
    await page.evaluate(d => localStorage.setItem("nurseSim:v1", JSON.stringify(d)), rich);
    await page.reload();
    await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem("nurseSim:v1") || "{}"));
    // defaults() 가 국시 7과목을 0 으로 채워두므로, 심어둔 항목만 확인한다
    expect(after.stats["성인간호학"]).toEqual({ solved: 12, correct: 9 });
    expect(after.stats["Physiological Integrity"]).toEqual({ solved: 5, correct: 4 });
    // 앱이 부팅 시 nightStudy 같은 항목을 추가할 수 있으므로, 심어둔 값의 보존만 본다
    expect(after.achievements.counters.perfectSets).toBe(1);
    expect(after.achievements.counters.imageCorrect).toBe(4);
    expect(after.referral.invitedBy).toBe("XYZ123");
    expect(after.episodeProgress).toEqual(rich.episodeProgress);
    expect(after.streak.best).toBe(9);
    expect(after.bookmarks).toEqual(rich.bookmarks);
});

// 라이트 테마는 다크 우선 설계에서 자주 방치돼, 흰 배경에 흰 글씨 같은 사고가 난다.
// 실제로 "오류 신고" 버튼이 1.06:1(사실상 안 보임), 정답 보기 텍스트가 3.56:1 이었다.
function contrastRatio(fg, bg) {
    const parse = s => {
        const nums = (s.match(/-?\d*\.?\d+(e-?\d+)?/g) || []).map(Number);
        if (/^color\(/.test(s)) return nums.slice(0, 3).map(v => Math.round(Math.max(0, Math.min(1, v)) * 255));
        return nums.slice(0, 3);
    };
    const lum = ([r, g, b]) => {
        const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const [a, z] = [lum(parse(fg)), lum(parse(bg))].sort((p, q) => q - p);
    return (a + 0.05) / (z + 0.05);
}
for (const theme of ["light", "dark", "amoled"]) {
    test(`${theme} 테마 — 핵심 텍스트가 WCAG AA 대비를 만족한다`, async ({ page }) => {
        await page.addInitScript(t => {
            localStorage.setItem("nurseSim:v1", JSON.stringify({
                accepted: { version: "1.0", at: Date.now() }, onboarded: true,
                settings: { lang: "ko", examMode: "korean", theme: t, sound: false },
            }));
            sessionStorage.setItem("nurseSim:cbIntroSeen", "1");
        }, theme);
        await page.goto("/");
        await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });
        await page.click('[data-action="setMenuTab"][data-tab="study"]');
        await page.click('[data-action="renderPracticeMenu"]');
        await page.click('[data-action="renderSubjectStudyMenu"]');
        await page.click('[data-action="renderKorMenu"]');
        await page.click('[data-action="startKorQuiz"][data-arg="__all__"]');
        await page.locator("#kor-choices .choice-btn").first().click();
        await expect(page.locator("#kor-choices .correct-flash")).toHaveCount(1);
        const samples = await page.evaluate(() => {
            const effBg = el => {
                let n = el;
                while (n) {
                    const bg = getComputedStyle(n).backgroundColor;
                    if (bg && !/rgba?\(0,\s*0,\s*0,\s*0\)|transparent/.test(bg)) return bg;
                    n = n.parentElement;
                }
                return getComputedStyle(document.body).backgroundColor;
            };
            const pick = (label, sel) => {
                const el = document.querySelector(sel);
                if (!el) return null;
                const cs = getComputedStyle(el);
                return { label, fg: cs.color, bg: effBg(el), size: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight) };
            };
            return [
                pick("정답 보기", "#kor-choices .correct-flash"),
                pick("오답 보기", "#kor-choices .wrong-flash"),
                pick("문제 본문", ".scene-desc"),
                pick("면책 바", ".app-disclaimer"),
                pick("오류신고 버튼", ".disclaimer-link"),
            ].filter(Boolean);
        });
        for (const s of samples) {
            const large = s.size >= 24 || (s.size >= 18.66 && s.weight >= 700);
            const need = large ? 3.0 : 4.5;
            const r = contrastRatio(s.fg, s.bg);
            expect(r, `${theme} · ${s.label} (${r.toFixed(2)}:1, 기준 ${need})`).toBeGreaterThanOrEqual(need);
        }
    });
}

// 정식 국시 280문항은 한국 시장의 핵심 콘텐츠인데 채점 결과를 아무 데도 남기지 않았다.
// 과목별 정답률에도, 오답노트(간격 반복)에도 들어가지 않아 "풀어도 아무 일도 안 일어나는" 상태였다.
test.describe("국시 학습 기록", () => {
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

    test("정답·오답이 과목별 통계와 오답노트에 남는다", async ({ page }) => {
        for (let i = 0; i < 4; i++) {
            const n = await page.locator("#kor-choices .choice-btn").count();
            if (!n) break;
            await page.locator("#kor-choices .choice-btn").nth(n - 1).click(); // 대체로 오답
            const next = page.locator('[data-action="korQuizNext"]');
            if (await next.count() && await next.isVisible()) await next.click();
        }
        const state = await page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem("nurseSim:v1") || "{}");
            return {
                solved: Object.values(d.stats || {}).reduce((s, v) => s + (v.solved || 0), 0),
                wrong: (d.wrongQueue || []).length,
                sampleHasChoices: (d.wrongQueue || [])[0] ? ((d.wrongQueue[0].choices || []).length >= 2) : false,
            };
        });
        expect(state.solved).toBe(4);
        expect(state.wrong).toBeGreaterThan(0);
        // 복습 화면이 렌더되려면 보기가 함께 저장돼 있어야 한다
        expect(state.sampleHasChoices).toBe(true);
    });

    test("국시 오답이 복습 화면에서 5지선다로 열린다", async ({ page }) => {
        for (let i = 0; i < 4; i++) {
            const n = await page.locator("#kor-choices .choice-btn").count();
            if (!n) break;
            await page.locator("#kor-choices .choice-btn").nth(n - 1).click();
            const next = page.locator('[data-action="korQuizNext"]');
            if (await next.count() && await next.isVisible()) await next.click();
        }
        await page.locator('[data-action="returnToMenu"]:visible').first().click();
        await page.waitForSelector("h1.menu-title-v2");
        await page.click('[data-action="setMenuTab"][data-tab="my"]');
        await page.click('[data-action="reviewWrongAnswers"]');
        await expect(page.locator("#choice-list .choice-btn")).toHaveCount(5);
    });

    test("보기를 연타해도 한 번만 채점된다", async ({ page }) => {
        const first = page.locator("#kor-choices .choice-btn").first();
        await first.click({ force: true });
        await first.click({ force: true }).catch(() => {});
        await first.click({ force: true }).catch(() => {});
        const solved = await page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem("nurseSim:v1") || "{}");
            return Object.values(d.stats || {}).reduce((s, v) => s + (v.solved || 0), 0);
        });
        expect(solved).toBe(1);
    });
});

test("변조된 저장소가 대시보드를 망가뜨리지 못한다", async ({ page }) => {
    // 국시 외 카테고리를 보존하도록 완화한 뒤, 조작된 localStorage 가 수백 줄을
    // 밀어넣을 수 있게 됐다. 이름 길이·개수 상한으로 막는다.
    await page.addInitScript(() => {
        const big = "가".repeat(3000);
        const stats = { [big]: { solved: 5, correct: 3 } };
        for (let i = 0; i < 300; i++) stats["cat" + i] = { solved: 1, correct: 1 };
        localStorage.setItem("nurseSim:v1", JSON.stringify({
            accepted: { version: "1.0", at: Date.now() }, onboarded: true,
            settings: { lang: "ko", examMode: "korean", theme: "dark", sound: false }, stats,
        }));
        sessionStorage.setItem("nurseSim:cbIntroSeen", "1");
    });
    await page.goto("/");
    await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });
    await page.click('[data-action="setMenuTab"][data-tab="my"]');
    await page.click('[data-action="renderDashboard"]');
    const rows = await page.locator(".dashboard-row").count();
    expect(rows).toBeLessThanOrEqual(30);
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflowX).toBeLessThanOrEqual(1);
});

test("오답노트가 상한을 넘겨 저장돼도 로드 시 잘린다", async ({ page }) => {
    // 오답 항목은 문제 스냅샷을 통째로 들고 있어 개당 1KB 안팎이다. addWrong 은 200개로
    // 자르지만 백업 복원·변조로 들어온 값에는 그 상한이 걸리지 않았다.
    await page.addInitScript(() => {
        localStorage.setItem("nurseSim:v1", JSON.stringify({
            accepted: { version: "1.0", at: Date.now() }, onboarded: true,
            settings: { lang: "ko", examMode: "korean", theme: "dark", sound: false },
            wrongQueue: Array.from({ length: 250 }, (_, i) => ({
                id: "w" + i, baseId: "b" + i, category: "성인간호학", part: "1", title: "T" + i, desc: "D",
                choices: [{ text: "A", correct: true }, { text: "B" }], ts: Date.now(),
                box: 1, interval: 1, repetitions: 0, easeFactor: 2.5, nextDue: Date.now() - 1000,
            })),
        }));
        sessionStorage.setItem("nurseSim:cbIntroSeen", "1");
    });
    await page.goto("/");
    await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });
    const n = await page.evaluate(() => (JSON.parse(localStorage.getItem("nurseSim:v1") || "{}").wrongQueue || []).length);
    expect(n).toBe(200);
    // 잘린 뒤에도 복습이 정상 동작해야 한다
    await page.click('[data-action="setMenuTab"][data-tab="my"]');
    await page.click('[data-action="reviewWrongAnswers"]');
    await expect(page.locator("#choice-list .choice-btn").first()).toBeVisible();
});

// 백업·복원은 GDPR 사용자 권리(열람·이전) 기능이라 조용히 깨지면 안 된다.
test.describe("데이터 백업·복원", () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            if (!localStorage.getItem("nurseSim:v1")) {
                localStorage.setItem("nurseSim:v1", JSON.stringify({
                    accepted: { version: "1.0", at: Date.now() }, onboarded: true,
                    settings: { lang: "ko", examMode: "korean", theme: "dark", sound: false },
                    stats: { "성인간호학": { solved: 9, correct: 7 } }, mockBest: 71,
                }));
            }
            sessionStorage.setItem("nurseSim:cbIntroSeen", "1");
        });
        await page.goto("/");
        await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });
        await page.click("#kebab-btn");
        await page.click('[data-action="openSettings"]');
        await page.evaluate(() => document.querySelectorAll("details.settings-acc").forEach(d => { d.open = true; }));
    });

    test("백업이 파싱 가능한 JSON 으로 내려받아진다", async ({ page }) => {
        const [download] = await Promise.all([
            page.waitForEvent("download", { timeout: 10000 }),
            page.click('[data-action="exportData"]'),
        ]);
        const fsPath = await download.path();
        const parsed = JSON.parse(require("fs").readFileSync(fsPath, "utf8"));
        const payload = parsed.data || parsed;
        expect(payload.stats["성인간호학"]).toEqual({ solved: 9, correct: 7 });
        expect(download.suggestedFilename()).toMatch(/\.json$/);
    });

    test("깨진 파일을 복원해도 앱이 죽지 않고 기존 데이터가 유지된다", async ({ page }) => {
        page.on("dialog", d => d.accept());
        const os = require("os"), path = require("path"), fs = require("fs");
        const bad = path.join(os.tmpdir(), "nurse-bad-backup.json");
        fs.writeFileSync(bad, "{not json");
        await page.click('[data-action="triggerImportData"]');
        await page.setInputFiles("#import-file-input", bad);
        await page.waitForTimeout(800);
        const state = await page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem("nurseSim:v1") || "{}");
            return { mockBest: d.mockBest, alive: !!document.querySelector(".settings-card, h1.menu-title-v2") };
        });
        expect(state.mockBest).toBe(71);   // 기존 값 보존
        expect(state.alive).toBe(true);
    });
});

test.describe("에피소드 진행·이어하기", () => {
    test("중단한 에피소드가 홈 이어하기 카드로 복구된다", async ({ page }) => {
        // 에피소드는 문제 풀이 통계를 남기지 않아, 에피소드만 시작한 사용자가
        // "신규"로 판정되면서 홈이 빈 상태로 렌더돼 이어하기 카드가 사라졌었다.
        await seedLegalAccepted(page);
        await page.goto("/");
        await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });
        await page.click('[data-action="setMenuTab"][data-tab="study"]');
        await page.click('[data-action="renderSimMenu"]');
        await page.click('[data-action="renderCaseMenu"]');
        await page.click('[data-action="renderEpisodeMenu"]');
        await page.locator('[data-action="startEpisode"]').first().click();

        // 에피소드는 autoAdvance — 다음 스텝의 보기가 살아날 때까지 기다린다
        for (let i = 0; i < 2; i++) {
            await page.locator("#choice-list .choice-btn:not([disabled])").first().click();
            await page.waitForFunction(() => {
                const b = [...document.querySelectorAll("#choice-list .choice-btn")];
                return b.length > 0 && b.some(x => !x.disabled);
            }, { timeout: 8000 });
        }
        const saved = await page.evaluate(() => {
            const d = JSON.parse(localStorage.getItem("nurseSim:v1") || "{}");
            const k = Object.keys(d.episodeProgress || {})[0];
            return k ? d.episodeProgress[k] : null;
        });
        expect(saved).not.toBeNull();
        expect(saved.step).toBeGreaterThan(0);

        // 중단 → 홈 탭
        await page.locator('[data-action="returnToMenu"]:visible').first().click();
        await page.waitForSelector("h1.menu-title-v2");
        await page.click('[data-action="setMenuTab"][data-tab="home"]');
        await expect(page.locator(".resume-card")).toBeVisible();

        // 이어하기 → 확인 화면 → 저장된 HP/평판 그대로 복구
        await page.click(".resume-card");
        await expect(page.locator('[data-action="episodeResume"]')).toBeVisible();
        await page.click('[data-action="episodeResume"]');
        await expect(page.locator("#hp")).toHaveText(String(saved.hp));
        await expect(page.locator("#rep")).toHaveText(String(saved.rep));
    });
});

// 게임 중 상단바 가로 넘침 회귀 방지
// 서바이벌처럼 HP/평판 게이지가 함께 뜨는 화면에서 뒤로+게이지2+아이콘4 가
// 한 줄에 들어가지 못해 문서 전체가 가로로 밀리던 버그(557px)를 막는다.
test.describe("게임 화면 가로 넘침", () => {
    const WIDTHS = [320, 360, 390, 412, 430, 480, 540, 559, 560, 600, 768];
    test("서바이벌 진행 중 어떤 폭에서도 가로 스크롤이 생기지 않는다", async ({ page }) => {
        await seedLegalAccepted(page);
        await page.goto("/");
        await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });
        await page.click('[data-action="initSurvival"]');
        const shift = page.locator('[data-action="pickShift"]').first();
        if (await shift.count()) { await shift.click(); }
        await page.waitForSelector("#top-bar:not(.hidden)", { timeout: 8000 });

        for (const w of WIDTHS) {
            await page.setViewportSize({ width: w, height: 800 });
            const m = await page.evaluate(() => ({
                scrollW: document.documentElement.scrollWidth,
                inner: window.innerWidth,
            }));
            expect(m.scrollW, `viewport ${w}px 에서 가로 넘침`).toBeLessThanOrEqual(m.inner + 1);
        }
    });

    test("좁은 폭에서도 뒤로·설정·케밥은 계속 눌러야 한다", async ({ page }) => {
        await seedLegalAccepted(page);
        await page.goto("/");
        await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });
        await page.click('[data-action="initSurvival"]');
        const shift = page.locator('[data-action="pickShift"]').first();
        if (await shift.count()) { await shift.click(); }
        await page.waitForSelector("#top-bar:not(.hidden)", { timeout: 8000 });
        await page.setViewportSize({ width: 320, height: 800 });

        // 상단바에 남은 버튼은 전부 화면 안에 있고 터치 가능한 크기여야 한다
        const bad = await page.evaluate(() => {
            const vw = window.innerWidth;
            return [...document.querySelectorAll("#top-bar button")]
                .filter(b => b.getBoundingClientRect().width > 0)
                .filter(b => {
                    const r = b.getBoundingClientRect();
                    return r.right > vw + 1 || r.left < -1 || r.width < 40 || r.height < 40;
                })
                .map(b => b.id || b.className);
        });
        expect(bad).toEqual([]);

        // 테마/사운드는 케밥 메뉴로 접히지만 여전히 접근 가능해야 한다
        await page.click('[data-action="toggleKebab"]');
        await expect(page.locator('#kebab-menu [data-action="toggleTheme"]')).toBeVisible();
        await expect(page.locator('#kebab-menu [data-action="toggleSound"]')).toBeVisible();
    });
});

// 서비스워커 — 최초 설치와 실제 업데이트를 구분해야 한다
// (구버전은 activate 마다 NEW_VERSION 을 보내 첫 방문자에게 "새 버전 준비됨"이 떴다)
test.describe("PWA 업데이트 알림", () => {
    test("최초 설치에서는 업데이트 토스트를 띄우지 않는다", async ({ page, context }) => {
        // seedLegalAccepted 는 업데이트 토스트를 CSS 로 숨기므로 여기선 쓰지 않는다
        await context.clearCookies();
        await page.goto("/");
        await page.waitForTimeout(3000);
        const visible = await page.evaluate(() => {
            const el = document.getElementById("update-toast");
            return el ? !el.classList.contains("hidden") : false;
        });
        expect(visible, "첫 방문에 업데이트 토스트가 뜨면 안 된다").toBe(false);
    });

    test("이전 버전 캐시가 있으면 업데이트로 보고 알린 뒤 옛 캐시를 지운다", async ({ page }) => {
        await page.goto("/");
        await page.waitForTimeout(2500);
        // 옛 버전 캐시를 심고 SW 를 다시 설치시킨다
        await page.evaluate(async () => {
            const c = await caches.open("nurse-sim-v0-test");
            await c.put("/marker", new Response("x"));
            const r = await navigator.serviceWorker.getRegistration();
            if (r) await r.unregister();
        });
        await page.reload();
        await page.waitForTimeout(3500);
        const keys = await page.evaluate(() => caches.keys());
        expect(keys, "옛 캐시는 정리되어야 한다").not.toContain("nurse-sim-v0-test");
        const visible = await page.evaluate(() => {
            const el = document.getElementById("update-toast");
            return el ? !el.classList.contains("hidden") : false;
        });
        expect(visible, "실제 업데이트에서는 알려야 한다").toBe(true);
    });

    test("오프라인에서도 앱이 뜨고 학습 기록이 저장된다", async ({ page, context }) => {
        await seedLegalAccepted(page);
        await page.goto("/");
        await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });
        await page.waitForTimeout(2000);           // SW 캐싱 완료 대기
        await context.setOffline(true);
        try {
            await page.reload();
            await expect(page.locator("h1.menu-title-v2")).toBeVisible({ timeout: 8000 });
            const stored = await page.evaluate(() => !!localStorage.getItem("nurseSim:v1"));
            expect(stored).toBe(true);
        } finally { await context.setOffline(false); }
    });
});

// 터치 타깃 최소 크기 (WCAG 2.2 2.5.8 — 24x24 CSS px)
test.describe("접근성 — 터치 타깃", () => {
    test("주요 화면의 조작 요소가 모두 24px 이상이다", async ({ page }) => {
        await seedLegalAccepted(page);
        await page.goto("/");
        await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });

        const SCREENS = ["home", "study", "my"];
        const tooSmall = [];
        for (const tab of SCREENS) {
            await page.click(`[data-action="setMenuTab"][data-tab="${tab}"]`);
            await page.waitForTimeout(250);
            const bad = await page.evaluate((t) => {
                return [...document.querySelectorAll('button,a[href],[role="button"]')]
                    .filter(el => {
                        const r = el.getBoundingClientRect();
                        return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24);
                    })
                    .map(el => `${t}:${el.className || el.tagName}:${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
            }, tab);
            tooSmall.push(...bad);
        }
        expect(tooSmall).toEqual([]);
    });

    test("키보드만으로 주 CTA 에 도달하고 포커스가 보인다", async ({ page }) => {
        await seedLegalAccepted(page);
        await page.goto("/");
        await page.waitForSelector("h1.menu-title-v2", { timeout: 8000 });

        let reachedCta = false;
        let focusVisible = false;
        for (let i = 0; i < 12; i++) {
            await page.keyboard.press("Tab");
            const f = await page.evaluate(() => {
                const el = document.activeElement;
                if (!el || el === document.body) return null;
                const cs = getComputedStyle(el);
                return {
                    action: el.dataset ? el.dataset.action : "",
                    ring: (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0)
                        || (cs.boxShadow && cs.boxShadow !== "none"),
                };
            });
            if (!f) continue;
            if (f.action === "initSurvival") reachedCta = true;
            if (f.ring) focusVisible = true;
        }
        expect(reachedCta, "키보드로 주 CTA 에 도달해야 한다").toBe(true);
        expect(focusVisible, "포커스 표시가 보여야 한다").toBe(true);
    });
});
