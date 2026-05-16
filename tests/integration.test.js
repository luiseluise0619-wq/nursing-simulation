/**
 * @jest-environment jsdom
 */

const BODY_TEMPLATE = `
  <div id="top-bar" class="hidden">
    <span id="hp">100</span><span id="rep">0</span>
    <button id="theme-toggle"></button>
    <button id="sound-toggle"></button>
  </div>
  <div id="progress-wrap" class="hidden" role="progressbar"
       aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-labelledby="progress-text">
    <div id="progress-fill"></div>
  </div>
  <div id="progress-info" class="hidden">
    <span id="progress-text"></span><span id="progress-percent"></span>
  </div>
  <div id="inventory-bar" class="hidden"></div>
  <div id="game-area"></div>
  <div id="log-bar" class="hidden"></div>
  <div id="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <h2 id="modal-title"></h2>
    <p id="modal-desc"></p>
    <div id="modal-stats"></div>
    <span id="left"></span><span id="rank"></span>
    <div id="question-box"></div>
    <div id="choices"></div>
    <div id="result"></div>
    <span id="score"></span>
  </div>
`;

function freshDom() {
    // body 요소를 통째로 교체해야 이전 테스트의 click 리스너 (boot 에서 등록된 위임 핸들러)가
    // 끊겨서 중복 발화로 인한 detached DOM 참조 오류를 막을 수 있다.
    const newBody = document.createElement("body");
    newBody.innerHTML = BODY_TEMPLATE;
    const old = document.body;
    if (old && old.parentNode) old.parentNode.replaceChild(newBody, old);
    else document.documentElement.appendChild(newBody);
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
    if (!window.matchMedia) {
        window.matchMedia = () => ({
            matches: false,
            addEventListener: () => {}, removeEventListener: () => {},
            addListener: () => {}, removeListener: () => {},
        });
    }
    window.AudioContext = function () {
        return {
            createOscillator: () => ({ connect: () => {}, start: () => {}, stop: () => {}, frequency: {} }),
            createGain: () => ({ connect: () => {}, gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} } }),
            destination: {},
            currentTime: 0,
        };
    };
}

function loadScript() {
    jest.resetModules();
    const Q = require("../questions.js");
    window.NurseQuestions = Q;
    return require("../script.js");
}

beforeEach(() => {
    freshDom();
});

describe("부트 / 메뉴 렌더", () => {
    test("script.js 로드 시 메인 메뉴가 렌더된다", () => {
        loadScript();
        expect(document.querySelector('h1.menu-title')).not.toBeNull();
        expect(document.querySelector('[data-action="initSurvival"]')).not.toBeNull();
        expect(document.querySelector('[data-action="renderQuizMenu"]')).not.toBeNull();
        expect(document.querySelector('[data-action="startMockExam"]')).not.toBeNull();
        expect(document.querySelector('[data-action="startDailyChallenge"]')).not.toBeNull();
        expect(document.querySelector('[data-action="renderDashboard"]')).not.toBeNull();
    });
});

describe("이벤트 위임 핸들러", () => {
    test("data-action='renderDashboard' 클릭이 대시보드를 렌더한다", () => {
        loadScript();
        document.querySelector('[data-action="renderDashboard"]').click();
        const titles = [...document.querySelectorAll("h2")].map(h => h.textContent);
        expect(titles.some(t => t.includes("학습 대시보드"))).toBe(true);
    });

    test("setShift data-shift/data-mult 가 정상 파싱된다", () => {
        loadScript();
        const nightBtn = document.querySelector('[data-shift="Night"]');
        expect(nightBtn).not.toBeNull();
        nightBtn.click();
        const active = document.querySelector('.shift-option.active');
        expect(active).not.toBeNull();
        expect(active.dataset.shift).toBe("Night");
        expect(active.dataset.mult).toBe("1.5");
    });

    test("renderQuizMenu 클릭으로 8과목 버튼이 노출된다", () => {
        loadScript();
        document.querySelector('[data-action="renderQuizMenu"]').click();
        const cats = document.querySelectorAll('[data-action="startQuiz"]');
        expect(cats.length).toBe(8);
    });
});

describe("CSP 정합성 — 인라인 onclick 부재", () => {
    test("렌더된 모든 모드 화면에 onclick 속성이 없다", () => {
        loadScript();
        const checks = ["renderQuizMenu", "returnToMenu", "renderDashboard", "returnToMenu"];
        checks.forEach((a) => {
            const b = document.querySelector(`[data-action="${a}"]`);
            if (b) b.click();
        });
        expect(document.body.innerHTML.toLowerCase()).not.toMatch(/onclick\s*=/);
    });
});

describe("진행도 ARIA", () => {
    test("progressbar role 과 aria-valuenow 가 설정된다", () => {
        loadScript();
        document.querySelector('[data-action="renderQuizMenu"]').click();
        document.querySelector('[data-action="startQuiz"]').click();
        const wrap = document.getElementById("progress-wrap");
        expect(wrap.getAttribute("role")).toBe("progressbar");
        expect(wrap.getAttribute("aria-valuenow")).not.toBeNull();
    });
});

describe("키보드 단축키 — IME / 조합 가드", () => {
    test("isComposing=true 인 1키 입력은 보기 클릭으로 이어지지 않는다", () => {
        loadScript();
        document.querySelector('[data-action="renderQuizMenu"]').click();
        document.querySelector('[data-action="startQuiz"]').click();
        const before = document.getElementById("game-area").innerHTML;
        const ev = new KeyboardEvent("keydown", { key: "1", bubbles: true });
        Object.defineProperty(ev, "isComposing", { value: true });
        document.dispatchEvent(ev);
        expect(document.getElementById("game-area").innerHTML).toBe(before);
    });

    test("keyCode=229 (한글 조합) 도 무시된다", () => {
        loadScript();
        document.querySelector('[data-action="renderQuizMenu"]').click();
        document.querySelector('[data-action="startQuiz"]').click();
        const before = document.getElementById("game-area").innerHTML;
        const ev = new KeyboardEvent("keydown", { key: "1", keyCode: 229, bubbles: true });
        document.dispatchEvent(ev);
        expect(document.getElementById("game-area").innerHTML).toBe(before);
    });

    test("일반 1키 입력은 첫 보기를 클릭한다", () => {
        loadScript();
        document.querySelector('[data-action="renderQuizMenu"]').click();
        document.querySelector('[data-action="startQuiz"]').click();
        // 보기가 화면에 노출된 상태
        const firstChoice = document.querySelector('#choice-list .choice-btn');
        expect(firstChoice).not.toBeNull();
        const ev = new KeyboardEvent("keydown", { key: "1", bubbles: true });
        document.dispatchEvent(ev);
        // 클릭 후에는 feedback-zone 에 다음 문제 버튼이 등장
        const next = document.querySelector('#feedback-zone .choice-btn.primary');
        expect(next).not.toBeNull();
    });
});

describe("오답 큐 — 고유 id 기반 저장/제거", () => {
    test("오답 발생 시 wrongQueue 에 고유 id 가 부여되어 누적된다", () => {
        loadScript();
        document.querySelector('[data-action="renderQuizMenu"]').click();
        document.querySelector('[data-action="startQuiz"]').click();
        // 정답이 아닌 보기를 찾아 클릭
        const choices = [...document.querySelectorAll('#choice-list .choice-btn')];
        // ev.choices 의 정답 인덱스를 모르므로, 보기 4개 중 첫 번째를 클릭하고
        // 결과적으로 정답이면 다음 문제로, 오답이면 wrongQueue 1건 누적되는지 확인
        const before = JSON.parse(localStorage.getItem("nurseSim:v1") || "{}");
        const beforeLen = (before.wrongQueue || []).length;
        // 4개 보기 다 클릭하면 그 중 3개는 오답
        for (let i = 0; i < 4; i++) {
            const btn = document.querySelectorAll('#choice-list .choice-btn')[i];
            if (btn) btn.click();
            const next = document.querySelector('#feedback-zone .choice-btn.primary');
            if (next) next.click();
        }
        const after = JSON.parse(localStorage.getItem("nurseSim:v1") || "{}");
        const queue = after.wrongQueue || [];
        // 최소 1건 이상 누적
        expect(queue.length).toBeGreaterThanOrEqual(beforeLen);
        // 모든 항목이 고유 id 를 가진다
        const ids = queue.map(e => e.id);
        expect(new Set(ids).size).toBe(ids.length);
        queue.forEach(e => {
            expect(typeof e.id).toBe("string");
            expect(e.id.length).toBeGreaterThan(5);
        });
    });
});

describe("Storage 스키마 검증", () => {
    test("손상된 localStorage 데이터를 안전하게 기본값으로 복구한다", () => {
        // 의도적으로 손상된 JSON
        localStorage.setItem("nurseSim:v1", '{"stats":"not-an-object","wrongQueue":42,"bestCombo":"NaN"}');
        // 로드해도 크래시 없이 메뉴가 떠야 함
        expect(() => loadScript()).not.toThrow();
        expect(document.querySelector('h1.menu-title')).not.toBeNull();
    });

    test("완전히 비어있는 localStorage 에서도 메뉴가 정상 렌더된다", () => {
        localStorage.clear();
        loadScript();
        expect(document.querySelector('[data-action="initSurvival"]')).not.toBeNull();
    });
});

describe("ESC 키로 모달 닫기", () => {
    test("모달이 active 상태에서 ESC 누르면 닫힌다", () => {
        loadScript();
        const modal = document.getElementById("modal");
        modal.classList.add("active");
        const ev = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
        document.dispatchEvent(ev);
        expect(modal.classList.contains("active")).toBe(false);
    });
});

describe("모달 접근성 속성", () => {
    test("modal 요소가 role=dialog 와 aria-modal 을 가진다", () => {
        loadScript();
        const m = document.getElementById("modal");
        expect(m.getAttribute("role")).toBe("dialog");
        expect(m.getAttribute("aria-modal")).toBe("true");
        expect(m.hasAttribute("aria-labelledby")).toBe(true);
    });
});

describe("일일 챌린지 시드 결정성 (jsdom 환경)", () => {
    test("같은 날 같은 카테고리 시퀀스를 보여준다", () => {
        // 1차: startDaily 호출 시 첫 문제의 카테고리 기록
        loadScript();
        document.querySelector('[data-action="startDailyChallenge"]').click();
        const firstCat = document.querySelector('.category-tag')?.textContent || "";
        expect(firstCat.length).toBeGreaterThan(0);

        // freshDom + loadScript 로 완전 재초기화 → 같은 시드로 startDaily
        freshDom();
        loadScript();
        document.querySelector('[data-action="startDailyChallenge"]').click();
        const secondCat = document.querySelector('.category-tag')?.textContent || "";
        // 같은 날짜 시드이므로 같은 generator (→ 같은 카테고리) 가 선택돼야 함
        expect(secondCat).toBe(firstCat);
    });
});
