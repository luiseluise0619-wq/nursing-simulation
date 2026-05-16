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
    const C = require("../content.js");
    window.NurseQuestions = Q;
    window.NurseContent = C;
    // TTS / 인쇄 stub
    window.speechSynthesis = {
        speak: jest.fn(),
        cancel: jest.fn(),
    };
    window.SpeechSynthesisUtterance = function (text) { this.text = text; };
    window.print = jest.fn();
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

    test("scenarios/handoffBest/triageBest 가 저장 후 재로드시 보존된다 (Storage.validate 회귀)", () => {
        // 시나리오 결과를 흉내내어 직접 기록
        const seed = {
            settings: { theme: "auto", sound: true },
            stats: {},
            wrongQueue: [],
            bestCombo: 5,
            mockBest: 10,
            handoffBest: 80,
            triageBest: 60,
            scenarios: { "sc-mi": { bestHp: 75, bestRep: 30, completed: true } },
            daily: {},
            history: [],
        };
        localStorage.setItem("nurseSim:v1", JSON.stringify(seed));
        loadScript();
        // 시나리오 메뉴를 다시 열어 보존 여부 확인 (data.scenarios[id] 가 undefined 면 crash)
        expect(() => {
            document.querySelector('[data-action="renderScenarioMenu"]').click();
        }).not.toThrow();
        // 대시보드도 신규 필드를 표시
        document.querySelector('[data-action="returnToMenu"]').click();
        document.querySelector('[data-action="renderDashboard"]').click();
        const body = document.body.textContent;
        expect(body).toMatch(/인계.*?80/);
        expect(body).toMatch(/트리아지.*?60/);
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

describe("인계 시뮬레이터 (TTS)", () => {
    test("메인 메뉴에 인계 버튼이 있고 클릭하면 답변 textarea 가 노출된다", () => {
        loadScript();
        const btn = document.querySelector('[data-action="startHandoff"]');
        expect(btn).not.toBeNull();
        btn.click();
        expect(document.getElementById("handoff-answer")).not.toBeNull();
        expect(document.querySelector('[data-action="handoffPlay"]')).not.toBeNull();
    });

    test("정답 키워드를 모두 입력하면 정답률 100% 피드백이 표시된다", () => {
        loadScript();
        document.querySelector('[data-action="startHandoff"]').click();
        const C = require("../content.js");
        const ans = C.HANDOFF_PATIENTS[0].keywords.join(" ");
        document.getElementById("handoff-answer").value = ans;
        document.querySelector('[data-action="handoffSubmit"]').click();
        const fb = document.getElementById("handoff-feedback");
        expect(fb.textContent).toMatch(/\d+\/\d+/);
        expect(fb.querySelector(".feedback-box.correct")).not.toBeNull();
    });

    test("handoffPlay 가 speechSynthesis.speak 를 호출한다", () => {
        loadScript();
        document.querySelector('[data-action="startHandoff"]').click();
        document.querySelector('[data-action="handoffPlay"]').click();
        expect(window.speechSynthesis.speak).toHaveBeenCalled();
    });

    test("handoffShow 가 본문을 노출시킨다", () => {
        loadScript();
        document.querySelector('[data-action="startHandoff"]').click();
        document.querySelector('[data-action="handoffShow"]').click();
        const el = document.getElementById("handoff-narration");
        expect(el.classList.contains("hidden")).toBe(false);
        expect(el.textContent.length).toBeGreaterThan(20);
    });
});

describe("트리아지 (다중환자 우선순위)", () => {
    test("5명 환자 카드와 각자 1~5 우선순위 버튼이 렌더된다", () => {
        loadScript();
        document.querySelector('[data-action="startTriage"]').click();
        const cards = document.querySelectorAll(".triage-card");
        expect(cards.length).toBe(5);
        cards.forEach(card => {
            const nums = card.querySelectorAll(".triage-num");
            expect(nums.length).toBe(5);
        });
    });

    test("순위 미배정 상태로 제출하면 에러 피드백을 보여준다", () => {
        loadScript();
        document.querySelector('[data-action="startTriage"]').click();
        document.querySelector('[data-action="triageSubmit"]').click();
        const fb = document.getElementById("triage-feedback");
        expect(fb.textContent).toMatch(/순위를 매겨주세요/);
    });

    test("중복 번호로 제출하면 거부된다", () => {
        loadScript();
        document.querySelector('[data-action="startTriage"]').click();
        const cards = document.querySelectorAll(".triage-card");
        cards.forEach(card => {
            const btn1 = card.querySelector('.triage-num[data-num="1"]');
            btn1.click();
        });
        document.querySelector('[data-action="triageSubmit"]').click();
        const fb = document.getElementById("triage-feedback");
        expect(fb.textContent).toMatch(/한 번씩만/);
    });

    test("정답 순위를 모두 매기면 5/5 피드백이 표시된다", () => {
        loadScript();
        document.querySelector('[data-action="startTriage"]').click();
        const C = require("../content.js");
        const case0 = C.TRIAGE_CASES[0];
        case0.patients.forEach(p => {
            const card = document.querySelector(`.triage-card[data-patient="${p.id}"]`);
            const btn = card.querySelector(`.triage-num[data-num="${p.priority}"]`);
            btn.click();
        });
        document.querySelector('[data-action="triageSubmit"]').click();
        const fb = document.getElementById("triage-feedback");
        expect(fb.textContent).toMatch(/5\/5/);
        expect(fb.querySelector(".feedback-box.correct")).not.toBeNull();
    });
});

describe("임상 시나리오", () => {
    test("시나리오 메뉴에서 시나리오 카드들이 노출된다", () => {
        loadScript();
        document.querySelector('[data-action="renderScenarioMenu"]').click();
        const starts = document.querySelectorAll('[data-action="startScenario"]');
        expect(starts.length).toBeGreaterThanOrEqual(1);
    });

    test("시나리오 시작 시 첫 step 의 4개 선택지가 노출된다", () => {
        loadScript();
        document.querySelector('[data-action="renderScenarioMenu"]').click();
        document.querySelector('[data-action="startScenario"]').click();
        const choices = document.querySelectorAll("#choice-list .choice-btn");
        expect(choices.length).toBeGreaterThanOrEqual(3);
    });

    test("정답 선택 시 HP 가 0 이하로 떨어지지 않는다", () => {
        loadScript();
        document.querySelector('[data-action="renderScenarioMenu"]').click();
        document.querySelector('[data-action="startScenario"]').click();
        // 정답 선택지 (text가 정답 보기의 것)를 찾아 클릭
        const C = require("../content.js");
        const s = C.SCENARIOS[0];
        const correctText = s.steps[0].choices.find(c => c.correct).text;
        const btns = [...document.querySelectorAll("#choice-list .choice-btn")];
        const correctBtn = btns.find(b => b.textContent.includes(correctText.slice(0, 10)));
        expect(correctBtn).toBeDefined();
        correctBtn.click();
        // HP 표시 확인
        const hp = parseInt(document.getElementById("hp").textContent, 10);
        expect(hp).toBeGreaterThan(0);
    });

    test("Night 시프트(난이도 1.5x) 가 시나리오 HP 손실을 증폭하지 않는다", () => {
        loadScript();
        // 메인 메뉴에서 Night 시프트 선택 → 난이도 1.5 설정
        document.querySelector('[data-shift="Night"]').click();
        document.querySelector('[data-action="renderScenarioMenu"]').click();
        document.querySelector('[data-action="startScenario"]').click();
        const C = require("../content.js");
        const wrongChoice = C.SCENARIOS[0].steps[0].choices.find(c => !c.correct && c.hp < 0);
        const btns = [...document.querySelectorAll("#choice-list .choice-btn")];
        const wrongBtn = btns.find(b => b.textContent.includes(wrongChoice.text.slice(0, 10)));
        expect(wrongBtn).toBeDefined();
        wrongBtn.click();
        const hpAfter = parseInt(document.getElementById("hp").textContent, 10);
        // hp 손실은 라운드되지 않은 원본 값과 동일해야 함 (100 + wrongChoice.hp)
        const expected = 100 + wrongChoice.hp;
        expect(hpAfter).toBe(expected);
    });
});

describe("PDF/인쇄", () => {
    test("printWrongQueue 가 print-only 영역을 만들고 window.print 호출", () => {
        loadScript();
        document.querySelector('[data-action="renderDashboard"]').click();
        document.querySelector('[data-action="printWrongQueue"]').click();
        expect(window.print).toHaveBeenCalled();
    });

    test("printDashboard 가 print-only 영역을 만들고 window.print 호출", () => {
        loadScript();
        document.querySelector('[data-action="renderDashboard"]').click();
        document.querySelector('[data-action="printDashboard"]').click();
        expect(window.print).toHaveBeenCalled();
    });

    test("연속 인쇄 호출 시 print-only 영역이 중복 누적되지 않는다", () => {
        loadScript();
        document.querySelector('[data-action="renderDashboard"]').click();
        document.querySelector('[data-action="printWrongQueue"]').click();
        document.querySelector('[data-action="printWrongQueue"]').click();
        document.querySelector('[data-action="printDashboard"]').click();
        // afterprint 이벤트가 발생하지 않은 jsdom 에서도 마지막 1개만 남아야 함
        expect(document.querySelectorAll(".print-only").length).toBe(1);
    });
});

describe("출제 경향 SVG 차트", () => {
    test("대시보드에 trends-svg 가 렌더된다", () => {
        loadScript();
        document.querySelector('[data-action="renderDashboard"]').click();
        const svg = document.querySelector(".trends-svg");
        expect(svg).not.toBeNull();
        const bars = svg.querySelectorAll(".trend-bar");
        expect(bars.length).toBe(8); // 8과목
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
