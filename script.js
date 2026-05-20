// =========================================================================
// 간호사 시뮬레이터 — 메인 게임 로직
// 의존: questions.js (window.NurseQuestions)
// =========================================================================

const MAX_PROGRESS_EVENTS = 20;
const MAX_LOG_ENTRIES = 50;
const RECENT_HISTORY_SIZE = 15;
const MOCK_EXAM_TOTAL = 30;
const MOCK_EXAM_SECONDS = 30 * 60;
const DAILY_CHALLENGE_TOTAL = 10;
const STORAGE_KEY = "nurseSim:v1";
const APP_VERSION = "1.0.0";

const CATEGORIES = [
    "기본간호학", "성인간호학", "모성간호학", "아동간호학",
    "지역사회간호학", "정신간호학", "간호관리학", "보건의약관계법규"
];

const NQ = (typeof window !== "undefined" && window.NurseQuestions)
    || (typeof require !== "undefined" ? require("./questions.js") : null);
const NC = (typeof window !== "undefined" && window.NurseContent)
    || (typeof require !== "undefined" ? require("./content.js") : null);

// =========================================================================
// 상태
// =========================================================================
const gameState = {
    mode: "menu",
    hp: 100, rep: 0,
    eventCount: 0,
    items: [],
    difficulty: 1.0,
    currentShift: "Day",
    quizCategory: null,
    quizSolved: 0, quizCorrect: 0, quizWrong: 0,
    recentIds: [],
    combo: 0, bestCombo: 0,
    // mock
    mockTotal: 0, mockAnswered: 0, mockCorrect: 0, mockDeadlineTs: 0, mockTimerId: null, mockWrong: [],
    // daily
    dailySeed: 0, dailyIndex: 0, dailyCorrect: 0, dailySolved: 0,
    // wrong review
    wrongQueue: [],
    // handoff
    handoffIndex: 0, handoffCorrect: 0, handoffTotal: 0,
    // triage
    triageIndex: 0, triageCorrect: 0, triageTotal: 0, triagePicks: {},
    // scenario
    scenarioId: null, scenarioStep: 0,
};

const UI = {};
function cacheUI() {
    UI.hp = document.getElementById("hp");
    UI.rep = document.getElementById("rep");
    UI.gameArea = document.getElementById("game-area");
    UI.topBar = document.getElementById("top-bar");
    UI.logBar = document.getElementById("log-bar");
    UI.inventory = document.getElementById("inventory-bar");
    UI.modal = document.getElementById("modal");
    UI.progressWrap = document.getElementById("progress-wrap");
    UI.progressFill = document.getElementById("progress-fill");
    UI.progressText = document.getElementById("progress-text");
    UI.progressPercent = document.getElementById("progress-percent");
    UI.progressInfo = document.getElementById("progress-info");
    UI.themeToggle = document.getElementById("theme-toggle");
    UI.soundToggle = document.getElementById("sound-toggle");
    UI.backBtn = document.getElementById("back-btn");
}

// 메뉴/온보딩/약관 화면에선 뒤로 버튼을 숨김, 게임 모드에선 표시
function updateBackButton() {
    if (!UI.backBtn) return;
    const hideOn = ["menu", "quiz_menu", "scenario_menu"];
    const hide = hideOn.includes(gameState.mode);
    UI.backBtn.classList.toggle("hidden", hide);
}

// =========================================================================
// 유틸리티
// =========================================================================
function clamp(n, lo, hi) { return Math.min(Math.max(n, lo), hi); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// 검증된 의료 사실 출처 맵 (CONTENT_VERIFICATION.md 의 30건)
// 정답 해설에 키워드가 매칭되면 자동 출처 표시
const KNOWN_SOURCES = [
    { pattern: /tPA|alteplase/i,                                source: "AHA/ASA 2019 Guidelines (4.5h window)" },
    { pattern: /MgSO4|마그네슘.*독성|Calcium gluconate.*1g/i,  source: "CMQCC/USF Eclampsia Toolkit" },
    { pattern: /고칼륨.*KCL|KCl.*IV.*push|Calcium gluconate.*심근/i, source: "ACEP/EMCrit Hyperkalemia Algorithm" },
    { pattern: /Naegele|네겔/i,                                  source: "Korean OB 표준 (LMP +280일)" },
    { pattern: /9의 법칙|TBSA|Parkland|화상.*면적/i,            source: "StatPearls Rule of Nines + Parkland" },
    { pattern: /Apgar|아프가/i,                                  source: "ACOG Committee Opinion (Apgar)" },
    { pattern: /Heparin.*aPTT|aPTT.*60|aPTT.*70|aPTT.*45-75/i,  source: "AHA Circulation Heparin Guide" },
    { pattern: /Warfarin|INR.*2-3|비타민K.*경구/i,             source: "Mayo/AAFP Warfarin Therapy" },
    { pattern: /Vancomycin|trough.*15-20|red.*man|60분.*주입/i, source: "ASHP/IDSA Vancomycin Consensus" },
    { pattern: /패혈증|sepsis|1-hour bundle|혈액배양.*항생제/i, source: "SCCM Surviving Sepsis Campaign 2021" },
    { pattern: /door-to-balloon|STEMI.*PCI.*90/i,               source: "ACC/AHA STEMI Guidelines" },
    { pattern: /CPR.*100|CPR.*120|CPR.*5cm|CPR.*6cm|BLS/i,     source: "AHA 2025 BLS Guidelines" },
    { pattern: /MMR|BCG|DTaP|HepB|예방접종/i,                  source: "KDCA 예방접종 가이드" },
    { pattern: /결핵.*신고|법정감염병/i,                       source: "감염병예방법 시행규칙" },
    { pattern: /후기하강|late deceleration|좌측위.*산소/i,     source: "Lecturio OB/AWHONN Fetal Monitoring" },
    { pattern: /자궁이완|산후출혈|자궁저부.*마사지/i,         source: "AAFP/OpenStax PPH Management" },
    { pattern: /광선치료|빌리루빈|황달.*신생아/i,             source: "Stanford NICU Phototherapy" },
    { pattern: /무균술|sterile.*field|2\.5cm/i,                source: "Wisconsin AODA Sterile Technique" },
    { pattern: /Dopamine.*5mcg|5mcg\/kg\/min/i,                source: "ACLS Drip Calculations" },
    { pattern: /NTG.*5분|nitroglycerin.*sublingual/i,          source: "Mayo/Cleveland Cardiac" },
    { pattern: /Lispro|식사.*직전.*15분/i,                     source: "Merck/UCSF Insulin Pharmacology" },
    { pattern: /20mL\/kg|소아.*탈수.*bolus/i,                  source: "Merck/UTMB Pediatric Dehydration" },
    { pattern: /망상.*논쟁.*금지|paranoid.*nursing/i,         source: "OpenStax Psychiatric Nursing" },
    { pattern: /START.*분류|triage.*흑색|black.*sieve/i,      source: "AHRQ START Triage" },
    { pattern: /FLACC|NIPS|PAINAD|NRS.*통증/i,                source: "Wisconsin Palliative Care Pain Tools" },
    { pattern: /Doxorubicin.*외삼출|발포제.*차가운|vincristine.*cold/i, source: "ONS Antineoplastic Extravasation Guidelines" },
    { pattern: /HELLP|혈소판.*100.*척추/i,                    source: "ACOG HELLP Bulletin" },
    { pattern: /BEERS|노인.*약물/i,                            source: "AGS Beers Criteria 2023" },
    { pattern: /Just Culture|시스템.*개선/i,                  source: "AHRQ Just Culture Framework" },
    { pattern: /SBAR|인계.*표준/i,                            source: "IHI SBAR Communication" },
];
function lookupSource(text) {
    if (!text) return null;
    for (const { pattern, source } of KNOWN_SOURCES) {
        if (pattern.test(text)) return source;
    }
    return null;
}

// 컨텐츠 검색 인덱스 — 모든 컨텐츠 type 한꺼번에 keyword 검색
let _searchIndex = null;
function buildSearchIndex() {
    if (_searchIndex) return _searchIndex;
    const idx = [];
    // Episodes
    (NC.EPISODES || []).forEach(e => {
        idx.push({
            type: "episode", id: e.id, title: e.title, body: `${e.setting} ${e.title}`,
            action: { name: "startEpisode", arg: e.id },
            label: "에피소드",
        });
        e.steps.forEach((s, i) => {
            idx.push({
                type: "episode_step", id: `${e.id}-${i}`, title: `${e.title} — ${s.title}`,
                body: `${s.title} ${s.narration}`,
                action: { name: "startEpisode", arg: e.id },
                label: "에피소드 단계",
            });
        });
    });
    // Handoff patients
    (NC.HANDOFF_PATIENTS || []).forEach(p => {
        idx.push({
            type: "handoff", id: p.id, title: p.title,
            body: `${p.title} ${p.narration} ${p.keywords.join(" ")}`,
            action: { name: "startHandoff" },
            label: "인계 환자",
        });
    });
    // Scenarios
    (NC.SCENARIOS || []).forEach(s => {
        idx.push({
            type: "scenario", id: s.id, title: s.title,
            body: `${s.title} ${s.intro} ${s.steps.map(st => st.prompt).join(" ")}`,
            action: { name: "renderScenarioMenu" },
            label: "임상 시나리오",
        });
    });
    // Triage cases
    (NC.TRIAGE_CASES || []).forEach(t => {
        idx.push({
            type: "triage", id: t.id, title: t.title,
            body: `${t.title} ${t.patients.map(p => p.desc).join(" ")} ${t.rationale}`,
            action: { name: "startTriage" },
            label: "트리아지",
        });
    });
    // Question generators — 한번 호출해서 카테고리/제목 수집
    (NQ.allGenerators || []).forEach(gen => {
        try {
            const sample = gen();
            idx.push({
                type: "question", id: sample.baseId, title: `${sample.category} · ${sample.title}`,
                body: `${sample.title} ${sample.category} ${sample.part} ${sample.desc}`,
                action: { name: "renderQuizMenu" },
                label: "4지선다 generator",
            });
        } catch {}
    });
    _searchIndex = idx;
    return idx;
}

function renderSearchResults(query) {
    const q = query.trim().toLowerCase();
    const resultsEl = document.getElementById("search-results");
    if (!resultsEl) return;
    if (q.length < 2) { resultsEl.innerHTML = ""; return; }
    const idx = buildSearchIndex();
    const matches = idx.filter(e => e.body.toLowerCase().includes(q) || e.title.toLowerCase().includes(q)).slice(0, 20);
    if (matches.length === 0) {
        resultsEl.innerHTML = `<div class="search-empty">"${escapeHtml(q)}" 결과 없음</div>`;
        return;
    }
    resultsEl.innerHTML = matches.map(m => {
        const arg = m.action.arg ? ` data-arg="${escapeHtml(m.action.arg)}"` : "";
        return `<button class="search-result" data-action="${m.action.name}"${arg}>
          <span class="sr-type">${escapeHtml(m.label)}</span>
          <span class="sr-title">${escapeHtml(m.title)}</span>
        </button>`;
    }).join("");
}
function openSearch() {
    gameState.mode = "search";
    showCoreUI(); updateStats();
    UI.gameArea.innerHTML = `
      <div class="card search-card">
        <h2 class="scene-title">🔍 컨텐츠 검색</h2>
        <input type="search" id="search-input" class="search-input" placeholder="에피소드·환자·시나리오·문제 키워드 (예: 자간증, 흡입화상, MgSO4)" autocomplete="off" aria-label="검색">
        <div id="search-results" class="search-results-list" aria-live="polite"></div>
        <div class="choice-list">
          <button class="choice-btn" data-action="returnToMenu">메인 메뉴</button>
        </div>
      </div>`;
    const input = document.getElementById("search-input");
    if (input) {
        input.focus();
        input.addEventListener("input", (e) => renderSearchResults(e.target.value));
    }
}

// 모드별 라인 아이콘 (24px viewBox, currentColor stroke, 외부 자원 0)
const ICONS = {
    survival:   '<svg class="mc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8 L4 12 a4 4 0 0 0 8 0 V8"/><path d="M12 14 a3 3 0 0 0 3 3 a3 3 0 0 0 3 -3 V11"/><circle cx="18" cy="9" r="2"/></svg>',
    training:   '<svg class="mc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5 a2 2 0 0 1 2 -2 h12 a2 2 0 0 1 2 2 v14 a2 2 0 0 1 -2 2 H6 a2 2 0 0 1 -2 -2 z"/><path d="M8 7 h8 M8 11 h8 M8 15 h5"/></svg>',
    mock:       '<svg class="mc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9 v4 l2.5 2"/><path d="M9 3 h6"/></svg>',
    daily:      '<svg class="mc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
    handoff:    '<svg class="mc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 12 a7 7 0 0 0 14 0"/><path d="M12 19 v3 M9 22 h6"/></svg>',
    triage:     '<svg class="mc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="8" width="14" height="9" rx="1.5"/><path d="M16 11 h3 l3 3 v3 h-6"/><circle cx="7" cy="19" r="1.8"/><circle cx="18" cy="19" r="1.8"/><path d="M7 11 h4 M9 9 v4"/></svg>',
    scenario:   '<svg class="mc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="1.5"/><path d="M9 3 h6 v3 H9 z" fill="currentColor" stroke="none"/><path d="M8 12 l1.5 1.5 L13 10 M8 17 h8"/></svg>',
    episode:    '<svg class="mc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5 a2 2 0 0 1 2 -2 h8 l4 4 v12 a2 2 0 0 1 -2 2 H6 a2 2 0 0 1 -2 -2 z"/><path d="M14 3 v4 h4"/><path d="M8 14 h8 M8 17 h6"/></svg>',
    wrong:      '<svg class="mc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3 h12 v18 l-6 -3 l-6 3 z"/></svg>',
    dash:       '<svg class="mc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20 V10 M10 20 V4 M16 20 V14"/><path d="M3 20 h18"/></svg>',
};

// =========================================================================
// 저장소 (localStorage)
// =========================================================================
const Storage = {
    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return Storage.defaults();
            const parsed = JSON.parse(raw);
            return Storage.validate(parsed);
        } catch {
            return Storage.defaults();
        }
    },
    save(data) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
    },
    defaults() {
        const stats = {};
        CATEGORIES.forEach(c => stats[c] = { solved: 0, correct: 0 });
        return {
            settings: { theme: "auto", sound: true },
            stats,
            wrongQueue: [],
            bestCombo: 0,
            mockBest: 0,
            handoffBest: 0,
            triageBest: 0,
            scenarios: {},     // { scenarioId: { bestHp, bestRep, completed } }
            daily: {},
            history: [],
        };
    },
    // localStorage 변조 시 타입을 보정해 무한루프/렌더 오류를 방지
    validate(raw) {
        const d = Storage.defaults();
        if (!raw || typeof raw !== "object") return d;
        const out = {
            settings: (raw.settings && typeof raw.settings === "object") ? Object.assign(d.settings, raw.settings) : d.settings,
            stats: d.stats,
            wrongQueue: Array.isArray(raw.wrongQueue) ? raw.wrongQueue.filter(e => e && typeof e === "object" && Array.isArray(e.choices)) : [],
            bestCombo: Number.isFinite(raw.bestCombo) ? raw.bestCombo : 0,
            mockBest: Number.isFinite(raw.mockBest) ? raw.mockBest : 0,
            handoffBest: Number.isFinite(raw.handoffBest) ? raw.handoffBest : 0,
            handoffSeen: Array.isArray(raw.handoffSeen) ? raw.handoffSeen.filter(x => typeof x === "string") : [],
            triageBest: Number.isFinite(raw.triageBest) ? raw.triageBest : 0,
            accepted: (raw.accepted && typeof raw.accepted === "object") ? raw.accepted : null,
            onboarded: raw.onboarded === true,
            scenarios: (raw.scenarios && typeof raw.scenarios === "object" && !Array.isArray(raw.scenarios)) ? raw.scenarios : {},
            episodes: (raw.episodes && typeof raw.episodes === "object" && !Array.isArray(raw.episodes)) ? raw.episodes : {},
            errorReports: Array.isArray(raw.errorReports) ? raw.errorReports.filter(e => e && typeof e === "object") : [],
            episodeProgress: (raw.episodeProgress && typeof raw.episodeProgress === "object" && !Array.isArray(raw.episodeProgress)) ? raw.episodeProgress : {},
            daily: (raw.daily && typeof raw.daily === "object") ? raw.daily : {},
            history: Array.isArray(raw.history) ? raw.history : [],
        };
        if (raw.stats && typeof raw.stats === "object") {
            CATEGORIES.forEach(c => {
                const s = raw.stats[c];
                if (s && Number.isFinite(s.solved) && Number.isFinite(s.correct)) out.stats[c] = { solved: s.solved, correct: s.correct };
            });
        }
        return out;
    },
    incrementStat(category, correct) {
        const data = Storage.load();
        if (!data.stats[category]) data.stats[category] = { solved: 0, correct: 0 };
        data.stats[category].solved += 1;
        if (correct) data.stats[category].correct += 1;
        Storage.save(data);
    },
    addWrong(question) {
        const data = Storage.load();
        const entry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            baseId: question.baseId,
            category: question.category,
            part: question.part,
            title: question.title,
            desc: question.desc,
            choices: question.choices.map(c => ({ text: c.text, correct: !!c.correct, log: c.log })),
            ts: Date.now(),
            // SM-2 간소화: 처음엔 즉시 복습 가능
            interval: 0, repetitions: 0, easeFactor: 2.5, nextDue: Date.now(),
        };
        if (data.wrongQueue.length >= 200) data.wrongQueue.shift();
        data.wrongQueue.push(entry);
        Storage.save(data);
        return entry.id;
    },
    // SM-2 알고리즘 (간소화) — quality 0~5 (정답=5, 부분정답=3, 오답=0)
    updateSpacedRepetition(id, quality) {
        const data = Storage.load();
        const item = data.wrongQueue.find(e => e.id === id);
        if (!item) return;
        if (quality < 3) {
            // 오답 → 1일 후 다시
            item.repetitions = 0;
            item.interval = 1;
        } else {
            item.repetitions = (item.repetitions || 0) + 1;
            if (item.repetitions === 1) item.interval = 1;
            else if (item.repetitions === 2) item.interval = 3;
            else item.interval = Math.round((item.interval || 1) * (item.easeFactor || 2.5));
            item.easeFactor = Math.max(1.3, (item.easeFactor || 2.5) + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
        }
        item.nextDue = Date.now() + item.interval * 24 * 60 * 60 * 1000;
        item.lastReviewed = Date.now();
        Storage.save(data);
    },
    removeWrongById(id) {
        const data = Storage.load();
        const idx = data.wrongQueue.findIndex(e => e.id === id);
        if (idx >= 0) {
            data.wrongQueue.splice(idx, 1);
            Storage.save(data);
        }
    },
    clearWrong() {
        const data = Storage.load();
        data.wrongQueue = [];
        Storage.save(data);
    },
    getWrongQueue() { return Storage.load().wrongQueue; },
    getStats() { return Storage.load().stats; },
    getSettings() { return Storage.load().settings; },
    setSettings(s) {
        const data = Storage.load();
        data.settings = Object.assign(data.settings, s);
        Storage.save(data);
    },
    setBestCombo(n) {
        const data = Storage.load();
        if (n > data.bestCombo) { data.bestCombo = n; Storage.save(data); }
    },
    setMockBest(n) {
        const data = Storage.load();
        if (n > data.mockBest) { data.mockBest = n; Storage.save(data); }
    },
    // 사용 약관 / 개인정보 / 면책 — 첫 실행 시 동의 받음
    setAccepted(version) {
        const data = Storage.load();
        data.accepted = { version, at: Date.now() };
        Storage.save(data);
    },
    isAccepted(version) {
        const data = Storage.load();
        return data.accepted && data.accepted.version === version;
    },
    setOnboarded() {
        const data = Storage.load();
        data.onboarded = true;
        Storage.save(data);
    },
    isOnboarded() {
        const data = Storage.load();
        return data.onboarded === true;
    },
    getHandoffSeen() {
        const data = Storage.load();
        return Array.isArray(data.handoffSeen) ? data.handoffSeen : [];
    },
    addHandoffSeen(id) {
        const data = Storage.load();
        if (!Array.isArray(data.handoffSeen)) data.handoffSeen = [];
        if (!data.handoffSeen.includes(id)) data.handoffSeen.push(id);
        Storage.save(data);
    },
    clearHandoffSeen() {
        const data = Storage.load();
        data.handoffSeen = [];
        Storage.save(data);
    },
    setTriageBest(acc) {
        const data = Storage.load();
        if (!Number.isFinite(data.triageBest) || acc > data.triageBest) { data.triageBest = acc; Storage.save(data); }
    },
    setScenarioResult(id, hp, rep, completed) {
        const data = Storage.load();
        const prev = data.scenarios[id] || { bestHp: 0, bestRep: 0, completed: false };
        data.scenarios[id] = {
            bestHp: Math.max(prev.bestHp, hp),
            bestRep: Math.max(prev.bestRep, rep),
            completed: prev.completed || completed,
        };
        Storage.save(data);
    },
    addErrorReport(entry) {
        const data = Storage.load();
        if (!Array.isArray(data.errorReports)) data.errorReports = [];
        data.errorReports.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            ts: Date.now(),
            ...entry,
        });
        if (data.errorReports.length > 200) data.errorReports.shift();
        Storage.save(data);
    },
    getErrorReports() { return Storage.load().errorReports || []; },

    // 에피소드 중간 저장 / 이어하기
    saveEpisodeProgress(id, step, hp, rep) {
        const data = Storage.load();
        if (!data.episodeProgress || typeof data.episodeProgress !== "object") data.episodeProgress = {};
        data.episodeProgress[id] = { step, hp, rep, ts: Date.now() };
        Storage.save(data);
    },
    getEpisodeProgress(id) {
        const data = Storage.load();
        return (data.episodeProgress && data.episodeProgress[id]) || null;
    },
    clearEpisodeProgress(id) {
        const data = Storage.load();
        if (data.episodeProgress && data.episodeProgress[id]) {
            delete data.episodeProgress[id];
            Storage.save(data);
        }
    },

    setEpisodeResult(id, ending, hp, rep) {
        const data = Storage.load();
        if (!data.episodes || typeof data.episodes !== "object") data.episodes = {};
        const prev = data.episodes[id] || { bestEnding: null, bestHp: 0, bestRep: 0, runs: 0 };
        const rank = { bad: 1, ok: 2, good: 3 };
        const prevRank = rank[prev.bestEnding] || 0;
        data.episodes[id] = {
            bestEnding: (rank[ending] || 0) > prevRank ? ending : prev.bestEnding,
            bestHp: Math.max(prev.bestHp, hp),
            bestRep: Math.max(prev.bestRep, rep),
            runs: (prev.runs || 0) + 1,
        };
        Storage.save(data);
    },
    getDaily(dateKey) {
        const data = Storage.load();
        return data.daily[dateKey] || null;
    },
    setDaily(dateKey, state) {
        const data = Storage.load();
        data.daily[dateKey] = state;
        Storage.save(data);
    },
    addHistory(entry) {
        const data = Storage.load();
        data.history.unshift(entry);
        data.history = data.history.slice(0, 20);
        Storage.save(data);
    },
};

// =========================================================================
// 사운드 (WebAudio, 외부 자원 없음)
// =========================================================================
const Sound = {
    ctx: null,
    enabled: true,
    init() {
        if (Sound.ctx) return;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        try { Sound.ctx = new Ctx(); } catch {}
    },
    beep(freq, duration = 0.12, type = "sine", vol = 0.08) {
        if (!Sound.enabled) return;
        Sound.init();
        if (!Sound.ctx) return;
        const ctx = Sound.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        osc.type = type;
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    },
    correct() { Sound.beep(880, 0.1); setTimeout(() => Sound.beep(1320, 0.16), 90); },
    wrong()   { Sound.beep(220, 0.18, "sawtooth", 0.06); setTimeout(() => Sound.beep(160, 0.22, "sawtooth", 0.05), 110); },
    combo(n)  { Sound.beep(660 + n * 60, 0.08, "triangle", 0.07); },
    tick()    { Sound.beep(520, 0.04, "square", 0.04); },
};

// =========================================================================
// 테마
// =========================================================================
function resolvedTheme(t) {
    if (t === "auto" || !t) {
        try { return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }
        catch { return "light"; }
    }
    return t === "dark" ? "dark" : "light";
}
function applyTheme(theme) {
    const r = resolvedTheme(theme);
    document.documentElement.setAttribute("data-theme", r);
    if (UI.themeToggle) UI.themeToggle.textContent = r === "dark" ? "☀️" : "🌙";
}
function toggleTheme() {
    const cur = resolvedTheme(Storage.getSettings().theme);
    const next = cur === "dark" ? "light" : "dark";
    applyTheme(next);
    Storage.setSettings({ theme: next });
}
function toggleSound() {
    Sound.enabled = !Sound.enabled;
    Storage.setSettings({ sound: Sound.enabled });
    if (UI.soundToggle) UI.soundToggle.textContent = Sound.enabled ? "🔊" : "🔇";
}

// =========================================================================
// 로그 / UI 업데이트
// =========================================================================
function addLog(text, type = "") {
    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`.trim();
    entry.textContent = `> ${text}`;
    UI.logBar.prepend(entry);
    while (UI.logBar.childElementCount > MAX_LOG_ENTRIES) {
        UI.logBar.removeChild(UI.logBar.lastChild);
    }
}

function rememberQuestion(baseId) {
    if (!gameState.recentIds.includes(baseId)) gameState.recentIds.push(baseId);
    if (gameState.recentIds.length > RECENT_HISTORY_SIZE) gameState.recentIds.shift();
}
function recentlyUsed(baseId) { return gameState.recentIds.includes(baseId); }

function updateStats() {
    const shownHp = clamp(gameState.hp, 0, 100);
    UI.hp.textContent = shownHp;
    UI.rep.textContent = gameState.rep;
    UI.hp.style.color = shownHp < 30 ? "var(--danger)" : shownHp < 60 ? "var(--warning)" : "var(--success)";
    // HP 게이지 fill + level (라이트→오렌지→빨강 펄스)
    const hpFill = document.getElementById("hp-fill");
    const hpGauge = document.getElementById("hp-gauge");
    if (hpFill) hpFill.style.width = `${shownHp}%`;
    if (hpGauge) hpGauge.dataset.level = shownHp > 60 ? "hi" : shownHp > 30 ? "mid" : "lo";
    // 평판 게이지 fill (-60 ~ +120 범위를 0~100% 로 매핑)
    const repFill = document.getElementById("rep-fill");
    if (repFill) {
        const repPct = clamp(Math.round(((gameState.rep + 60) / 180) * 100), 0, 100);
        repFill.style.width = `${repPct}%`;
    }

    let value = 0, total = 1, label = "진행도";
    if (gameState.mode === "survival") { value = gameState.eventCount; total = MAX_PROGRESS_EVENTS; label = "듀티 진행도"; }
    else if (gameState.mode === "quiz") { value = gameState.quizSolved; total = Math.max(gameState.quizSolved, 1); label = `학습 진행도 · ${gameState.quizCategory || ""}`; }
    else if (gameState.mode === "mock") { value = gameState.mockAnswered; total = gameState.mockTotal; label = "모의고사"; }
    else if (gameState.mode === "daily") { value = gameState.dailySolved; total = DAILY_CHALLENGE_TOTAL; label = "일일 챌린지"; }
    else if (gameState.mode === "wrong_review") { value = gameState.quizSolved; total = Math.max(gameState.wrongQueue.length, 1); label = "오답노트"; }
    else if (gameState.mode === "handoff") { value = gameState.handoffIndex; total = NC.HANDOFF_PATIENTS.length; label = "인계 시뮬레이터"; }
    else if (gameState.mode === "triage") { value = gameState.triageIndex; total = NC.TRIAGE_CASES.length; label = "트리아지"; }
    else if (gameState.mode === "scenario") {
        const s = NC.SCENARIOS.find(x => x.id === gameState.scenarioId);
        value = gameState.scenarioStep; total = s ? s.steps.length : 1; label = `시나리오 · ${s ? s.title : ""}`;
    }
    else if (gameState.mode === "episode") {
        const ep = NC.EPISODES.find(x => x.id === gameState.episodeId);
        value = gameState.episodeStep; total = ep ? ep.steps.length : 1; label = `에피소드 · ${ep ? ep.title : ""}`;
    }

    const progressRaw = total > 0 ? (value / total) * 100 : 0;
    const progress = Math.min(Number.isFinite(progressRaw) ? progressRaw : 0, 100);
    UI.progressFill.style.width = `${progress}%`;
    UI.progressPercent.textContent = `${Math.round(progress)}%`;
    UI.progressText.textContent = label;
    UI.progressWrap.setAttribute("aria-valuenow", String(Math.round(progress)));
    updateBackButton();

    UI.inventory.innerHTML = "";
    const shiftBadge = document.createElement("span");
    shiftBadge.className = "badge accent";
    shiftBadge.textContent = `근무: ${gameState.currentShift}`;
    UI.inventory.appendChild(shiftBadge);

    const statusBadge = document.createElement("span");
    statusBadge.className = "badge";
    statusBadge.textContent = ({
        survival: "상태: 실전 모드", quiz: "상태: 트레이닝", mock: "상태: 모의고사",
        daily: "상태: 일일 챌린지", wrong_review: "상태: 오답 복습", dashboard: "상태: 대시보드",
    })[gameState.mode] || "상태: 대기";
    UI.inventory.appendChild(statusBadge);

    if (gameState.combo >= 2) {
        const b = document.createElement("span");
        b.className = "badge combo combo-flash";
        b.textContent = `🔥 ${gameState.combo} 콤보`;
        UI.inventory.appendChild(b);
    }
    if ((gameState.mode === "quiz" || gameState.mode === "wrong_review" || gameState.mode === "daily") && (gameState.quizCorrect + gameState.quizWrong) > 0) {
        const acc = Math.round((gameState.quizCorrect / Math.max(1, gameState.quizCorrect + gameState.quizWrong)) * 100);
        const b = document.createElement("span");
        b.className = "badge success";
        b.textContent = `정답률 ${acc}% (${gameState.quizCorrect}/${gameState.quizCorrect + gameState.quizWrong})`;
        UI.inventory.appendChild(b);
    }
    if (gameState.mode === "mock") {
        const remain = Math.max(0, Math.ceil((gameState.mockDeadlineTs - Date.now()) / 1000));
        const mm = String(Math.floor(remain / 60)).padStart(2, "0");
        const ss = String(remain % 60).padStart(2, "0");
        const b = document.createElement("span");
        b.className = "badge danger timer-pill";
        b.textContent = `⏰ ${mm}:${ss}`;
        UI.inventory.appendChild(b);
    }
}

function showCoreUI() {
    UI.topBar.classList.remove("hidden");
    UI.logBar.classList.remove("hidden");
    UI.inventory.classList.remove("hidden");
    UI.progressWrap.classList.remove("hidden");
    UI.progressInfo.classList.remove("hidden");
}
function hideCoreUI() {
    UI.topBar.classList.add("hidden");
    UI.logBar.classList.add("hidden");
    UI.inventory.classList.add("hidden");
    UI.progressWrap.classList.add("hidden");
    UI.progressInfo.classList.add("hidden");
}

// =========================================================================
// 문제 풀기
// =========================================================================
function generateClinicalEventByCategory(category = null) {
    const pool = [];
    for (const gen of NQ.allGenerators) {
        const ev = gen();
        if ((!category || ev.category === category) && !recentlyUsed(ev.baseId)) pool.push(ev);
    }
    if (pool.length === 0) {
        gameState.recentIds = [];
        for (const gen of NQ.allGenerators) {
            const ev = gen();
            if (!category || ev.category === category) pool.push(ev);
        }
    }
    const selected = pick(pool);
    rememberQuestion(selected.baseId);
    return selected;
}
function isCorrectChoice(c) { return c && c.correct === true; }

function renderSceneCard(ev, options = {}) {
    const { mode = "survival", questionIndex = null, meta = [] } = options;
    const tag = ev.category ? `<div class="category-tag">[${escapeHtml(ev.category)}] ${escapeHtml(ev.part || "")}</div>` : "";
    const metaRow = meta.length ? `<div class="meta-row">${meta.map(m => `<div class="meta-chip">${escapeHtml(m)}</div>`).join("")}</div>` : "";

    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        ${tag}${metaRow}
        <span class="scene-emoji" aria-hidden="true">${ev.emoji || "🩺"}</span>
        <h2 class="scene-title">${questionIndex !== null ? `[Q${questionIndex}] ` : ""}${escapeHtml(ev.title)}</h2>
        <p class="scene-desc">${escapeHtml(ev.desc)}</p>
        <div class="choice-list" id="choice-list" role="list"></div>
        <div id="feedback-zone" aria-live="polite" aria-atomic="true"></div>
      </div>
    `;

    const listEl = document.getElementById("choice-list");
    ev.choices.forEach((choice, idx) => {
        const btn = document.createElement("button");
        btn.className = "choice-btn";
        btn.dataset.idx = String(idx);
        const hint = document.createElement("span");
        hint.className = "kbd-hint";
        hint.textContent = String(idx + 1);
        btn.appendChild(hint);
        btn.appendChild(document.createTextNode(choice.text));
        btn.onclick = () => dispatchChoice(choice, ev, idx, mode);
        listEl.appendChild(btn);
    });
    updateStats();
}

function dispatchChoice(choice, ev, idx, mode) {
    if (mode === "survival") handleSurvivalChoice(choice);
    else if (mode === "mock") handleMockChoice(choice, ev);
    else if (mode === "daily") handleDailyChoice(choice, ev);
    else if (mode === "wrong_review") handleWrongReviewChoice(choice, ev);
    else if (mode === "scenario") handleScenarioChoice(choice, ev);
    else if (mode === "episode") handleEpisodeChoice(choice, ev);
    else if (mode === "episode_quiz") handleEpisodeQuizChoice(choice, ev);
    else handleQuizChoice(choice, ev);
}

// =========================================================================
// 콤보
// =========================================================================
function bumpCombo() {
    gameState.combo += 1;
    if (gameState.combo > gameState.bestCombo) {
        gameState.bestCombo = gameState.combo;
        Storage.setBestCombo(gameState.bestCombo);
    }
    if (gameState.combo >= 3) Sound.combo(gameState.combo);
    // 콤보 뱃지 burst 애니메이션 재트리거
    requestAnimationFrame(() => {
        const badge = document.querySelector(".badge.combo");
        if (!badge) return;
        badge.classList.remove("burst");
        // 강제 reflow 로 애니메이션 재시작
        void badge.offsetWidth;
        badge.classList.add("burst");
    });
}
function resetCombo() { gameState.combo = 0; }

// =========================================================================
// Survival 모드
// =========================================================================
function setShift(shift, mult, el) {
    gameState.currentShift = shift;
    gameState.difficulty = mult;
    document.querySelectorAll(".shift-option").forEach(o => o.classList.remove("active"));
    if (el) el.classList.add("active");
}
function resetStateForMode() {
    gameState.hp = 100; gameState.rep = 0; gameState.eventCount = 0;
    gameState.items = []; gameState.quizSolved = 0;
    gameState.quizCorrect = 0; gameState.quizWrong = 0;
    gameState.recentIds = []; gameState.combo = 0;
    gameState.mockTotal = 0; gameState.mockAnswered = 0; gameState.mockCorrect = 0;
    gameState.mockDeadlineTs = 0; gameState.mockWrong = [];
    gameState.dailySeed = 0; gameState.dailyIndex = 0;
    gameState.dailyCorrect = 0; gameState.dailySolved = 0;
    gameState.dailyQuestions = null;
    gameState.wrongQueue = [];
    gameState.currentWrongId = null;
    gameState.handoffIndex = 0; gameState.handoffCorrect = 0; gameState.handoffTotal = 0;
    gameState.handoffPool = null;
    gameState.triageIndex = 0; gameState.triageCorrect = 0; gameState.triageTotal = 0;
    gameState.triagePicks = {};
    gameState.scenarioId = null; gameState.scenarioStep = 0;
    gameState.episodeId = null; gameState.episodeStep = 0;
    gameState._quizAnswered = false;
    gameState.firedStoryBeats = [];
}
function initSurvival() {
    resetStateForMode();
    gameState.mode = "survival"; gameState.quizCategory = null;
    gameState.firedStoryBeats = [];
    showCoreUI(); UI.logBar.innerHTML = "";
    addLog("듀티가 시작되었습니다. 첫 판단부터 중요합니다.", "log-important");
    renderSurvivalEvent("intro");
}
function renderSurvivalEvent(eventId) {
    let ev;
    if (eventId === "intro") {
        ev = { baseId: "intro", category: "", title: "듀티의 시작", emoji: "🏥",
            desc: "병동 문이 열리고 특유의 긴장감이 밀려옵니다.\n선임이 한 마디 — \"오늘 듀티 너야. 인계받고 시작해.\"",
            choices: [
                { text: "심호흡하고 인계 핵심부터 정리한다", correct: true, effect: { hp: -4, rep: 6 }, log: "기본기부터 챙겼습니다.", next: "random_hub" },
                { text: "물품부터 챙긴다", effect: { hp: -2, rep: 2, item: "토니켓" }, log: "준비성이 좋습니다.", next: "random_hub" },
            ] };
    } else {
        // 특정 eventCount 시점에 스토리 비트가 있으면 강제 발동 (한 듀티당 1회씩)
        const upcomingCount = gameState.eventCount + 1;
        const beat = NC.SURVIVAL_STORY_BEATS && NC.SURVIVAL_STORY_BEATS.find(b => b.atEvent === upcomingCount && !gameState.firedStoryBeats.includes(b.baseId));
        if (beat) {
            gameState.firedStoryBeats.push(beat.baseId);
            ev = {
                baseId: beat.baseId, category: "스토리", part: `Event ${upcomingCount}`,
                emoji: beat.emoji, title: beat.title, desc: beat.desc,
                choices: beat.choices.map(c => ({ ...c })),
            };
        } else {
            const clinical = Math.random() < 0.85;
            ev = clinical ? generateClinicalEventByCategory(null) : pick([
                { baseId: "rest", title: "잠깐의 휴식", emoji: "☕", desc: "복도 끝 자판기 앞. 잠깐 숨을 돌립니다.",
                  choices: [
                      { text: "물 한 잔 마시고 차트 정리", correct: true, effect: { hp: 15, rep: 1 }, log: "체력을 회복하고 정리도 마쳤습니다." },
                      { text: "동료와 짧게 수다", effect: { hp: 8, rep: 3 }, log: "감정 환기 — 팀 분위기 좋아집니다." },
                      { text: "그냥 패스, 일 계속", effect: { hp: -3, rep: 1 }, log: "체력 소진은 누적됩니다." }
                  ] }
            ]);
        }
        gameState.eventCount += 1;
    }
    renderSceneCard(ev, { mode: "survival", meta: [`난이도: ${gameState.currentShift}`, `누적: ${gameState.eventCount}건`, `콤보: ${gameState.combo}`] });
}
function applyChoiceEffect(choice) {
    if (!choice.effect) return;
    let hpDelta = choice.effect.hp || 0;
    // 시나리오 모드는 큐레이팅된 HP 손실/회복을 그대로 적용 (shift 가중치 미적용)
    if (hpDelta < 0 && gameState.mode !== "scenario") hpDelta = Math.round(hpDelta * gameState.difficulty);
    gameState.hp = clamp(gameState.hp + hpDelta, 0, 100);
    gameState.rep += choice.effect.rep || 0;
    if (choice.effect.item) gameState.items.push(choice.effect.item);
    updateStats();
}
function handleSurvivalChoice(choice) {
    applyChoiceEffect(choice);
    const isCorrect = isCorrectChoice(choice);
    if (isCorrect) { bumpCombo(); Sound.correct(); }
    else { resetCombo(); Sound.wrong(); }
    if (choice.log) addLog(choice.log, isCorrect ? "log-good" : (choice.effect?.rep || 0) < 0 ? "log-bad" : "");
    if (gameState.hp <= 0) return showGameOver("체력 고갈", "번아웃 되었습니다. 환자 안전을 위해 퇴근하세요.");
    if (gameState.rep < -60) return showGameOver("평판 실추", "치명적인 실수 누적으로 투약 사고 위기입니다.");
    if (gameState.eventCount >= MAX_PROGRESS_EVENTS) {
        Storage.addHistory({ mode: "survival", at: Date.now(), hp: gameState.hp, rep: gameState.rep, events: gameState.eventCount, bestCombo: gameState.bestCombo });
        return showGameOver("듀티 무사 완수!", "수고하셨습니다. 당신은 훌륭한 간호사입니다.");
    }
    renderSurvivalEvent(choice.next || "random_hub");
}

// =========================================================================
// Quiz (트레이닝) 모드
// =========================================================================
function renderQuizMenu() {
    gameState.mode = "quiz_menu"; resetStateForMode();
    showCoreUI(); UI.logBar.innerHTML = "";
    addLog("국가고시 8과목 트레이닝 모드입니다.", "log-important");
    updateStats();
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">국가고시 8과목 트레이닝</h2>
        <p class="scene-desc">숫자와 상황이 계속 변하는 무한 랜덤 4지선다 문제를 제공합니다.\n트레이닝 모드에서는 체력이 감소하지 않습니다.</p>
        <div class="choice-list">
          ${CATEGORIES.map(c => `<button class="choice-btn primary" data-action="startQuiz" data-arg="${escapeHtml(c)}">${c}</button>`).join("")}
          <button class="choice-btn center" data-action="returnToMenu">메인 메뉴</button>
        </div>
      </div>`;
}
function startQuiz(category) {
    gameState.mode = "quiz"; gameState.quizCategory = category;
    gameState.quizSolved = 0; gameState.quizCorrect = 0; gameState.quizWrong = 0;
    UI.logBar.innerHTML = ""; addLog(`${category} 풀이를 시작합니다.`, "log-important");
    renderNextQuizQuestion();
}
function renderNextQuizQuestion() {
    renderSceneCard(generateClinicalEventByCategory(gameState.quizCategory), {
        mode: "quiz", questionIndex: gameState.quizSolved + 1,
        meta: [gameState.quizCategory, `해결: ${gameState.quizSolved}`, `정답 ${gameState.quizCorrect} / 오답 ${gameState.quizWrong}`]
    });
}
function renderFeedback(ev, choice, opts = {}) {
    const isCorrect = isCorrectChoice(choice);
    const correctChoice = ev.choices.find(isCorrectChoice);
    document.querySelectorAll("#choice-list .choice-btn").forEach(b => b.disabled = true);
    const fb = document.getElementById("feedback-zone");
    fb.innerHTML = "";
    const box = document.createElement("div");
    box.className = `feedback-box ${isCorrect ? "correct" : "wrong"}`;
    const title = document.createElement("div");
    title.textContent = isCorrect ? "✅ 정답" : `❌ 오답 (정답: ${correctChoice ? correctChoice.text : ""})`;
    const text = document.createElement("div");
    text.style.fontWeight = "normal"; text.style.marginTop = "6px";
    text.textContent = choice.log || "해설이 없습니다.";
    box.appendChild(title); box.appendChild(text);
    // 검증된 출처 자동 표시
    const sourceText = lookupSource(`${ev.title} ${correctChoice ? correctChoice.text : ""} ${correctChoice ? correctChoice.log : ""}`);
    if (sourceText) {
        const src = document.createElement("div");
        src.className = "feedback-source";
        src.textContent = `📚 출처: ${sourceText}`;
        box.appendChild(src);
    } else {
        const noSrc = document.createElement("div");
        noSrc.className = "feedback-source feedback-source-unverified";
        noSrc.textContent = "ⓘ 자가 검증 — 외부 RN 감수 대기 중";
        box.appendChild(noSrc);
    }
    fb.appendChild(box);

    const next = document.createElement("button");
    next.className = "choice-btn primary center";
    next.textContent = opts.nextLabel || "다음 문제";
    next.onclick = opts.onNext;
    fb.appendChild(next);

    if (opts.extraButton) {
        const eb = document.createElement("button");
        eb.className = "choice-btn center";
        eb.textContent = opts.extraButton.label;
        eb.onclick = opts.extraButton.onClick;
        fb.appendChild(eb);
    }
}
function handleQuizChoice(choice, ev) {
    const isCorrect = isCorrectChoice(choice);
    gameState.quizSolved += 1;
    if (isCorrect) {
        gameState.quizCorrect += 1; gameState.rep += 6;
        bumpCombo(); Sound.correct();
        addLog(`[정답] ${choice.log || ""}`, "log-good");
    } else {
        gameState.quizWrong += 1;
        resetCombo(); Sound.wrong();
        Storage.addWrong(ev);
        addLog(`[오답] ${choice.log || ""}`, "log-bad");
    }
    Storage.incrementStat(ev.category, isCorrect);
    updateStats();
    renderFeedback(ev, choice, {
        onNext: () => renderNextQuizQuestion(),
        extraButton: { label: "과목 변경", onClick: renderQuizMenu },
    });
}

// =========================================================================
// 모의고사 (시간제한 + 결과 채점표)
// =========================================================================
function startMockExam() {
    resetStateForMode();
    gameState.mode = "mock";
    gameState._mockEnded = false;
    gameState.mockTotal = MOCK_EXAM_TOTAL;
    gameState.mockAnswered = 0; gameState.mockCorrect = 0; gameState.mockWrong = [];
    gameState.mockDeadlineTs = Date.now() + MOCK_EXAM_SECONDS * 1000;
    showCoreUI(); UI.logBar.innerHTML = "";
    addLog(`모의고사 시작 — ${MOCK_EXAM_TOTAL}문제 / ${MOCK_EXAM_SECONDS / 60}분`, "log-important");
    if (gameState.mockTimerId) clearInterval(gameState.mockTimerId);
    gameState.mockTimerId = setInterval(() => {
        updateStats();
        if (Date.now() >= gameState.mockDeadlineTs) endMockExam("timeout");
    }, 1000);
    renderNextMockQuestion();
}
function renderNextMockQuestion() {
    const ev = generateClinicalEventByCategory(null);
    gameState._lastMockEv = ev;
    renderSceneCard(ev, {
        mode: "mock",
        questionIndex: gameState.mockAnswered + 1,
        meta: [ev.category, `진행 ${gameState.mockAnswered + 1}/${gameState.mockTotal}`]
    });
}
function handleMockChoice(choice, ev) {
    const isCorrect = isCorrectChoice(choice);
    gameState.mockAnswered += 1;
    if (isCorrect) { gameState.mockCorrect += 1; bumpCombo(); Sound.correct(); addLog(`[정답] ${ev.title}`, "log-good"); }
    else { gameState.mockWrong.push(ev); resetCombo(); Sound.wrong(); Storage.addWrong(ev); addLog(`[오답] ${ev.title}`, "log-bad"); }
    Storage.incrementStat(ev.category, isCorrect);
    updateStats();
    renderFeedback(ev, choice, {
        onNext: () => {
            if (gameState.mockAnswered >= gameState.mockTotal) endMockExam("complete");
            else renderNextMockQuestion();
        },
        extraButton: { label: "포기하고 메뉴로", onClick: () => endMockExam("abort") },
    });
}
function endMockExam(reason) {
    if (gameState._mockEnded) return;
    gameState._mockEnded = true;
    if (gameState.mockTimerId) { clearInterval(gameState.mockTimerId); gameState.mockTimerId = null; }
    const total = gameState.mockTotal;
    const correct = gameState.mockCorrect;
    const answered = gameState.mockAnswered;
    const acc = answered > 0 ? Math.round((correct / answered) * 100) : 0;
    Storage.setMockBest(correct);
    Storage.addHistory({ mode: "mock", at: Date.now(), total, answered, correct, accuracy: acc, reason });

    const title = reason === "timeout" ? "⏰ 시간 종료" : reason === "abort" ? "모의고사 중단" : "🏁 모의고사 완료";
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">${title}</h2>
        <p class="scene-desc">총 ${total}문제 중 ${answered}문제 응답 / 정답 ${correct} (정답률 ${acc}%)</p>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="startMockExam">한 번 더</button>
          <button class="choice-btn" data-action="reviewWrongAnswers">오답 복습</button>
          <button class="choice-btn center" data-action="returnToMenu">메인 메뉴</button>
        </div>
      </div>`;
}

// =========================================================================
// 일일 챌린지 (날짜 기반 seeded — 같은 날 같은 generator 시퀀스)
// =========================================================================
function dailySeed(dateKey) {
    let h = 2166136261;
    for (let i = 0; i < dateKey.length; i++) { h ^= dateKey.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h;
}
function seededRng(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function pickDailyGenerators(seed, count) {
    const rng = seededRng(seed);
    const out = [];
    const recentlyPicked = [];
    for (let i = 0; i < count; i++) {
        let idx;
        let attempts = 0;
        do {
            idx = Math.floor(rng() * NQ.allGenerators.length);
            attempts++;
        } while (recentlyPicked.includes(idx) && attempts < 10);
        recentlyPicked.push(idx);
        if (recentlyPicked.length > 5) recentlyPicked.shift();
        out.push(NQ.allGenerators[idx]);
    }
    return out;
}
function startDailyChallenge() {
    resetStateForMode();
    gameState.mode = "daily";
    gameState.dailySolved = 0; gameState.dailyCorrect = 0;
    gameState.dailySeed = dailySeed(todayKey());
    gameState.dailyQuestions = pickDailyGenerators(gameState.dailySeed, DAILY_CHALLENGE_TOTAL);
    showCoreUI(); UI.logBar.innerHTML = "";
    addLog(`오늘의 일일 챌린지 — ${DAILY_CHALLENGE_TOTAL}문제`, "log-important");
    renderNextDailyQuestion();
}
function renderNextDailyQuestion() {
    const gen = gameState.dailyQuestions && gameState.dailyQuestions[gameState.dailySolved];
    const ev = gen ? gen() : generateClinicalEventByCategory(null);
    renderSceneCard(ev, {
        mode: "daily",
        questionIndex: gameState.dailySolved + 1,
        meta: [`일일 챌린지`, `${gameState.dailySolved + 1}/${DAILY_CHALLENGE_TOTAL}`]
    });
}
function handleDailyChoice(choice, ev) {
    const isCorrect = isCorrectChoice(choice);
    gameState.dailySolved += 1; gameState.quizSolved += 1;
    if (isCorrect) { gameState.dailyCorrect += 1; gameState.quizCorrect += 1; bumpCombo(); Sound.correct(); }
    else { gameState.quizWrong += 1; resetCombo(); Sound.wrong(); Storage.addWrong(ev); }
    Storage.incrementStat(ev.category, isCorrect);
    updateStats();
    renderFeedback(ev, choice, {
        onNext: () => {
            if (gameState.dailySolved >= DAILY_CHALLENGE_TOTAL) endDailyChallenge();
            else renderNextDailyQuestion();
        },
    });
}
function endDailyChallenge() {
    const correct = gameState.dailyCorrect;
    Storage.setDaily(todayKey(), { solved: DAILY_CHALLENGE_TOTAL, correct, completed: true, ts: Date.now() });
    Storage.addHistory({ mode: "daily", at: Date.now(), total: DAILY_CHALLENGE_TOTAL, correct, date: todayKey() });
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">일일 챌린지 완료</h2>
        <p class="scene-desc">정답 ${correct}/${DAILY_CHALLENGE_TOTAL}\n오늘의 도전을 마쳤습니다. 내일 다시 도전하세요!</p>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="returnToMenu">메뉴로</button>
        </div>
      </div>`;
}

// =========================================================================
// 오답노트 복습
// =========================================================================
function reviewWrongAnswers() {
    resetStateForMode();
    gameState.mode = "wrong_review";
    const now = Date.now();
    const all = Storage.getWrongQueue();
    // SM-2: 복습 만기된 항목만 (없으면 전체 큐 안내)
    const due = all.filter(q => !q.nextDue || q.nextDue <= now);
    gameState.wrongQueue = due.length > 0 ? due : [];
    gameState._wrongTotalCount = all.length;
    gameState._wrongDueCount = due.length;
    if (all.length > 0 && due.length === 0) {
        const nextDue = Math.min(...all.map(q => q.nextDue || now));
        const hoursToNext = Math.max(0, Math.round((nextDue - now) / (60 * 60 * 1000)));
        UI.gameArea.innerHTML = `
          <div class="scene-card card">
            <h2 class="scene-title">오늘 복습할 게 없어요</h2>
            <p class="scene-desc">${all.length}건 오답 모두 복습 완료 상태.\n다음 복습 만기: 약 ${hoursToNext}시간 후 (spaced repetition).</p>
            <div class="choice-list">
              <button class="choice-btn primary" data-action="reviewWrongForce">그래도 복습할게요</button>
              <button class="choice-btn" data-action="returnToMenu">메인 메뉴</button>
            </div>
          </div>`;
        showCoreUI(); updateStats();
        return;
    }
    if (gameState.wrongQueue.length === 0) {
        UI.gameArea.innerHTML = `
          <div class="scene-card card">
            <h2 class="scene-title">오답노트가 비었습니다</h2>
            <p class="scene-desc">아직 저장된 오답이 없어요. 트레이닝/모의고사에서 문제를 풀면 자동으로 쌓입니다.</p>
            <div class="choice-list">
              <button class="choice-btn primary" data-action="returnToMenu">메인 메뉴</button>
            </div>
          </div>`;
        showCoreUI(); updateStats();
        return;
    }
    showCoreUI(); UI.logBar.innerHTML = "";
    addLog(`오답노트 복습 시작 — ${gameState.wrongQueue.length}건`, "log-important");
    renderNextWrongQuestion();
}
function renderNextWrongQuestion() {
    if (gameState.wrongQueue.length === 0) {
        UI.gameArea.innerHTML = `
          <div class="scene-card card">
            <h2 class="scene-title">오답을 모두 복습했습니다</h2>
            <p class="scene-desc">정답 ${gameState.quizCorrect} / 다시 오답 ${gameState.quizWrong}</p>
            <div class="choice-list">
              <button class="choice-btn primary" data-action="returnToMenu">메인 메뉴</button>
            </div>
          </div>`;
        return;
    }
    const snap = gameState.wrongQueue[0];
    gameState.currentWrongId = snap.id;
    const ev = {
        baseId: snap.baseId, category: snap.category, part: snap.part,
        emoji: "📝", title: snap.title, desc: snap.desc,
        choices: snap.choices.map(c => ({ text: c.text, correct: c.correct, log: c.log })),
    };
    renderSceneCard(ev, {
        mode: "wrong_review",
        questionIndex: gameState.quizSolved + 1,
        meta: ["오답 복습", `남은 ${gameState.wrongQueue.length}건`]
    });
}
function handleWrongReviewChoice(choice, ev) {
    const isCorrect = isCorrectChoice(choice);
    const id = gameState.currentWrongId;
    gameState.quizSolved += 1;
    if (isCorrect) {
        gameState.quizCorrect += 1; bumpCombo(); Sound.correct();
        gameState.wrongQueue.shift();
        // SM-2: 정답이면 다음 만기 연장 (1→3→7→14→30일)
        if (id) Storage.updateSpacedRepetition(id, 5);
    } else {
        gameState.quizWrong += 1; resetCombo(); Sound.wrong();
        const item = gameState.wrongQueue.shift();
        gameState.wrongQueue.push(item);
        if (id) Storage.updateSpacedRepetition(id, 0);
    }
    updateStats();
    renderFeedback(ev, choice, { onNext: () => renderNextWrongQuestion() });
}
function reviewWrongForce() {
    // SM-2 무시 + 전체 큐 즉시 복습
    resetStateForMode();
    gameState.mode = "wrong_review";
    gameState.wrongQueue = Storage.getWrongQueue();
    showCoreUI(); UI.logBar.innerHTML = "";
    addLog(`강제 복습 모드 — ${gameState.wrongQueue.length}건`, "log-important");
    renderNextWrongQuestion();
}

// =========================================================================
// 인계 시뮬레이터 (TTS 인계 + 키워드 채점)
// =========================================================================
const Speech = {
    speak(text, onEnd) {
        try {
            if (typeof window === "undefined" || !window.speechSynthesis) return false;
            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = "ko-KR";
            utter.rate = 1.0;
            if (onEnd) utter.onend = onEnd;
            window.speechSynthesis.speak(utter);
            return true;
        } catch { return false; }
    },
    stop() { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch {} },
    supported() { return typeof window !== "undefined" && !!window.speechSynthesis; },
};

function normalizeKeyword(s) {
    return String(s || "").toLowerCase().replace(/[^\w가-힣]/g, "");
}

const HANDOFF_SESSION_SIZE = 10;

// 100명 풀에서 이번 세션용 환자 N명을 셔플로 선정.
// 이전 세션에서 본 ID는 가급적 제외, 남은 풀이 N 미만이면 seen 을 리셋해 사이클 반복.
function pickHandoffSession(n) {
    const all = NC.HANDOFF_PATIENTS;
    const seen = Storage.getHandoffSeen();
    let pool = all.filter(p => !seen.includes(p.id));
    if (pool.length < n) {
        Storage.clearHandoffSeen();
        pool = all.slice();
        addLog("100명 환자 한 사이클 완료 — 풀을 초기화합니다.", "log-important");
    }
    return shuffle(pool).slice(0, n).map(p => p.id);
}

function startHandoff() {
    resetStateForMode();
    gameState.mode = "handoff";
    gameState.handoffPool = pickHandoffSession(HANDOFF_SESSION_SIZE);
    showCoreUI(); UI.logBar.innerHTML = "";
    addLog(`인계 시뮬레이터 — 100명 풀에서 ${HANDOFF_SESSION_SIZE}명 무작위 출제.`, "log-important");
    renderHandoffPatient();
}

function renderHandoffPatient() {
    if (gameState.handoffIndex >= gameState.handoffPool.length) { endHandoff(); return; }
    const id = gameState.handoffPool[gameState.handoffIndex];
    const p = NC.HANDOFF_PATIENTS.find(x => x.id === id);
    if (!p) { endHandoff(); return; }
    Storage.addHandoffSeen(id);
    const ttsHint = Speech.supported() ? "" : "\n⚠ 이 환경은 음성합성을 지원하지 않습니다. '본문 보기' 로 학습하세요.";
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">[인계 ${gameState.handoffIndex + 1}/${gameState.handoffPool.length}] ${escapeHtml(p.title)}</h2>
        <p class="scene-desc">음성 인계를 듣고 핵심 키워드 ${p.keywords.length}개를 떠올려 답변창에 쉼표/공백으로 구분해 입력하세요.
힌트: ${escapeHtml(p.hint)}${ttsHint}</p>
        <div class="handoff-controls">
          <button class="choice-btn primary" data-action="handoffPlay">▶ 인계 듣기</button>
          <button class="choice-btn" data-action="handoffStop">⏹ 중지</button>
          <button class="choice-btn" data-action="handoffShow">📄 본문 보기</button>
        </div>
        <div id="handoff-narration" class="handoff-narration hidden" aria-live="polite"></div>
        <textarea id="handoff-answer" class="handoff-answer" rows="4" placeholder="기억나는 핵심 키워드를 적으세요" aria-label="인계 답변"></textarea>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="handoffSubmit">제출</button>
          <button class="choice-btn" data-action="returnToMenu">메뉴로</button>
        </div>
        <div id="handoff-feedback" aria-live="polite"></div>
      </div>`;
    updateStats();
}

function handoffPlay() {
    const id = gameState.handoffPool && gameState.handoffPool[gameState.handoffIndex];
    const p = id ? NC.HANDOFF_PATIENTS.find(x => x.id === id) : null;
    if (!p) return;
    const ok = Speech.speak(p.narration);
    if (!ok) handoffShow();
}
function handoffStop() { Speech.stop(); }
function handoffShow() {
    const id = gameState.handoffPool && gameState.handoffPool[gameState.handoffIndex];
    const p = id ? NC.HANDOFF_PATIENTS.find(x => x.id === id) : null;
    if (!p) return;
    const el = document.getElementById("handoff-narration");
    if (!el) return;
    el.textContent = p.narration;
    el.classList.remove("hidden");
}

function handoffSubmit() {
    const id = gameState.handoffPool && gameState.handoffPool[gameState.handoffIndex];
    const p = id ? NC.HANDOFF_PATIENTS.find(x => x.id === id) : null;
    if (!p) return;
    Speech.stop();
    const ans = document.getElementById("handoff-answer").value;
    const tokens = ans.split(/[\s,·•。、]+/).map(normalizeKeyword).filter(Boolean);
    const hits = [], misses = [];
    p.keywords.forEach(k => {
        const n = normalizeKeyword(k);
        const found = tokens.some(t => t.includes(n) || n.includes(t));
        if (found) hits.push(k); else misses.push(k);
    });
    gameState.handoffCorrect += hits.length;
    gameState.handoffTotal += p.keywords.length;
    const fb = document.getElementById("handoff-feedback");
    fb.innerHTML = "";
    const allHit = hits.length === p.keywords.length;
    const box = document.createElement("div");
    box.className = `feedback-box ${allHit ? "correct" : "wrong"}`;
    const head = document.createElement("div");
    head.textContent = `${hits.length}/${p.keywords.length} 키워드 일치`;
    box.appendChild(head);
    const detail = document.createElement("div");
    detail.style.fontWeight = "normal"; detail.style.marginTop = "6px";
    detail.style.whiteSpace = "pre-wrap";
    detail.textContent = `✅ ${hits.join(", ") || "(없음)"}\n❌ 놓침: ${misses.join(", ") || "(없음)"}`;
    box.appendChild(detail);
    fb.appendChild(box);
    if (allHit) { bumpCombo(); Sound.correct(); } else { resetCombo(); Sound.wrong(); }
    const next = document.createElement("button");
    next.className = "choice-btn primary center";
    next.textContent = "다음 환자";
    next.dataset.action = "handoffNext";
    fb.appendChild(next);
}
function handoffNext() {
    gameState.handoffIndex += 1;
    renderHandoffPatient();
}
function endHandoff() {
    Speech.stop();
    const total = gameState.handoffTotal, correct = gameState.handoffCorrect;
    const acc = total ? Math.round(correct / total * 100) : 0;
    Storage.setHandoffBest(acc);
    Storage.addHistory({ mode: "handoff", at: Date.now(), total, correct, accuracy: acc });
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">인계 시뮬레이션 완료</h2>
        <p class="scene-desc">키워드 정확도: ${correct}/${total} (${acc}%)</p>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="startHandoff">다시 시작</button>
          <button class="choice-btn" data-action="returnToMenu">메인 메뉴</button>
        </div>
      </div>`;
}

// =========================================================================
// 트리아지 (다중환자 우선순위)
// =========================================================================
function startTriage() {
    resetStateForMode();
    gameState.mode = "triage";
    showCoreUI(); UI.logBar.innerHTML = "";
    addLog("응급실 트리아지 — 5명 환자에게 1(최우선)~5(후순위)를 매기세요.", "log-important");
    renderTriageCase();
}

function renderTriageCase() {
    const cases = NC.TRIAGE_CASES;
    if (gameState.triageIndex >= cases.length) { endTriage(); return; }
    const c = cases[gameState.triageIndex];
    gameState.triagePicks = {};
    const cards = c.patients.map(p => `
        <div class="triage-card" data-patient="${escapeHtml(p.id)}">
          <div class="triage-card-head">
            <span class="triage-emoji" aria-hidden="true">${p.emoji}</span>
            <span class="triage-desc">${escapeHtml(p.desc)}</span>
          </div>
          <div class="triage-pick" role="radiogroup" aria-label="${escapeHtml(p.desc)} 우선순위">
            ${[1,2,3,4,5].map(n => `<button class="triage-num" data-action="triagePick" data-patient="${escapeHtml(p.id)}" data-num="${n}" aria-label="${n}순위">${n}</button>`).join("")}
          </div>
        </div>`).join("");
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">[케이스 ${gameState.triageIndex + 1}/${cases.length}] ${escapeHtml(c.title)}</h2>
        <p class="scene-desc">각 환자에게 1(최우선)~5(후순위)를 부여하세요. 같은 번호 중복 불가.</p>
        <div class="triage-list">${cards}</div>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="triageSubmit">제출</button>
          <button class="choice-btn" data-action="returnToMenu">메뉴로</button>
        </div>
        <div id="triage-feedback" aria-live="polite"></div>
      </div>`;
    updateStats();
}

function triagePick(target) {
    const pid = target.dataset.patient;
    const n = parseInt(target.dataset.num, 10);
    gameState.triagePicks[pid] = n;
    // 환자 카드 안에서만 active 상태를 갱신 (id 셀렉터 escape 회피)
    const card = target.closest(".triage-card");
    if (!card) return;
    card.querySelectorAll(".triage-num").forEach(b => {
        b.classList.toggle("active", parseInt(b.dataset.num, 10) === n);
    });
}

function triageSubmit() {
    const c = NC.TRIAGE_CASES[gameState.triageIndex];
    const picks = c.patients.map(p => gameState.triagePicks[p.id]);
    const fb = document.getElementById("triage-feedback");
    fb.innerHTML = "";
    if (picks.some(v => !v)) {
        const w = document.createElement("div"); w.className = "feedback-box wrong";
        w.textContent = "모든 환자에게 순위를 매겨주세요.";
        fb.appendChild(w); return;
    }
    if (new Set(picks).size !== 5) {
        const w = document.createElement("div"); w.className = "feedback-box wrong";
        w.textContent = "1~5번을 각 한 번씩만 사용하세요.";
        fb.appendChild(w); return;
    }
    let correct = 0;
    const results = c.patients.map(p => {
        const pick = gameState.triagePicks[p.id];
        const ok = pick === p.priority;
        if (ok) correct++;
        return { p, pick, ok };
    });
    gameState.triageCorrect += correct;
    gameState.triageTotal += c.patients.length;
    const allOk = correct === c.patients.length;
    const box = document.createElement("div");
    box.className = `feedback-box ${allOk ? "correct" : "wrong"}`;
    const head = document.createElement("div");
    head.textContent = `${correct}/${c.patients.length} 정답`;
    box.appendChild(head);
    results.sort((a,b) => a.p.priority - b.p.priority).forEach(r => {
        const row = document.createElement("div");
        row.style.fontWeight = "normal"; row.style.marginTop = "4px";
        row.textContent = `${r.ok ? "✅" : "❌"} 정답 ${r.p.priority} (선택 ${r.pick}) — ${r.p.why}`;
        box.appendChild(row);
    });
    const rationale = document.createElement("div");
    rationale.style.marginTop = "8px"; rationale.style.fontStyle = "italic";
    rationale.textContent = c.rationale;
    box.appendChild(rationale);
    fb.appendChild(box);
    if (allOk) { bumpCombo(); Sound.correct(); } else { resetCombo(); Sound.wrong(); }
    const next = document.createElement("button");
    next.className = "choice-btn primary center";
    next.textContent = "다음 케이스";
    next.dataset.action = "triageNext";
    fb.appendChild(next);
}
function triageNext() { gameState.triageIndex += 1; renderTriageCase(); }
function endTriage() {
    const total = gameState.triageTotal, correct = gameState.triageCorrect;
    const acc = total ? Math.round(correct / total * 100) : 0;
    Storage.setTriageBest(acc);
    Storage.addHistory({ mode: "triage", at: Date.now(), total, correct, accuracy: acc });
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">트리아지 완료</h2>
        <p class="scene-desc">정답률: ${correct}/${total} (${acc}%)</p>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="startTriage">다시 시작</button>
          <button class="choice-btn" data-action="returnToMenu">메인 메뉴</button>
        </div>
      </div>`;
}

// =========================================================================
// 에피소드 (장편 스토리 — 한 듀티 전체)
// =========================================================================
function renderEpisodeMenu() {
    resetStateForMode();
    gameState.mode = "episode_menu";
    showCoreUI(); UI.logBar.innerHTML = "";
    addLog("에피소드 — 한 듀티 전체를 따라가는 장편 스토리.", "log-important");
    updateStats();
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">에피소드</h2>
        <p class="scene-desc">한 듀티 12~15단계의 연결된 스토리. 같은 환자·동료·의사가 계속 등장하고, 각 결정이 HP·평판에 누적됩니다.\n\n결과는 마지막 점수에 따라 좋은/평범/힘든 듀티 엔딩으로 갈립니다.</p>
        <div class="choice-list">
          ${NC.EPISODES.map(e => {
              const prog = Storage.getEpisodeProgress(e.id);
              const pill = prog && prog.step > 0 && prog.step < e.steps.length
                  ? ` <span class="mc-badge" style="position:static;background:var(--warning);">진행 중 ${prog.step}/${e.steps.length}</span>` : "";
              return `<button class="choice-btn primary" data-action="startEpisode" data-arg="${escapeHtml(e.id)}">${escapeHtml(e.title)}${pill}</button>`;
          }).join("")}
          <button class="choice-btn" data-action="returnToMenu">메인 메뉴</button>
        </div>
      </div>`;
}

function startEpisode(target) {
    const id = target.dataset.arg;
    const ep = NC.EPISODES.find(x => x.id === id);
    if (!ep) return;
    // 진행 중인 에피소드가 있으면 이어하기 안내
    const progress = Storage.getEpisodeProgress(id);
    if (progress && progress.step > 0 && progress.step < ep.steps.length) {
        return renderEpisodeResumeChoice(ep, progress);
    }
    beginEpisode(id, 0, 100, 0);
}

function renderEpisodeResumeChoice(ep, progress) {
    gameState.mode = "episode_menu";
    showCoreUI(); updateStats();
    const pctDone = Math.round((progress.step / ep.steps.length) * 100);
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">이어하기? — ${escapeHtml(ep.title)}</h2>
        <p class="scene-desc">진행 중인 에피소드가 있습니다.\nStep ${progress.step + 1}/${ep.steps.length} (${pctDone}% 완료)\nHP ${progress.hp} · 평판 ${progress.rep}</p>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="episodeResume" data-arg="${escapeHtml(ep.id)}">이어하기</button>
          <button class="choice-btn" data-action="episodeRestart" data-arg="${escapeHtml(ep.id)}">처음부터 다시</button>
          <button class="choice-btn" data-action="renderEpisodeMenu">에피소드 목록</button>
        </div>
      </div>`;
}
function episodeResume(target) {
    const id = target.dataset.arg;
    const ep = NC.EPISODES.find(x => x.id === id);
    const progress = Storage.getEpisodeProgress(id);
    if (!ep || !progress) return;
    beginEpisode(id, progress.step, progress.hp, progress.rep);
}
function episodeRestart(target) {
    const id = target.dataset.arg;
    Storage.clearEpisodeProgress(id);
    beginEpisode(id, 0, 100, 0);
}
function beginEpisode(id, step, hp, rep) {
    const ep = NC.EPISODES.find(x => x.id === id);
    if (!ep) return;
    resetStateForMode();
    gameState.mode = "episode";
    gameState.episodeId = id;
    gameState.episodeStep = step;
    gameState.hp = hp; gameState.rep = rep;
    showCoreUI(); UI.logBar.innerHTML = "";
    addLog(`에피소드 ${step === 0 ? "시작" : "이어가기"}: ${ep.title}`, "log-important");
    if (step === 0) {
        addLog(ep.setting);
        if (ep.patients) ep.patients.forEach(p => addLog(`${p.ref} — ${p.desc}`));
        if (ep.cast) addLog(`등장: ${ep.cast}`);
    } else {
        addLog(`Step ${step + 1}/${ep.steps.length} 부터 이어갑니다.`);
    }
    renderEpisodeStep();
}

function renderEpisodeStep() {
    const ep = NC.EPISODES.find(x => x.id === gameState.episodeId);
    if (!ep) return;
    if (gameState.episodeStep >= ep.steps.length) { endEpisode(); return; }
    const step = ep.steps[gameState.episodeStep];
    // 임상 지식 미니 문제가 있으면 먼저 표시, 답 후 행동 선택지로 진행
    if (step.clinicalQuiz && !gameState._quizAnswered) {
        return renderEpisodeQuiz(ep, step);
    }
    gameState._quizAnswered = false;
    const stepNum = gameState.episodeStep + 1;
    const totalSteps = ep.steps.length;
    const ev = {
        baseId: "episode",
        category: ep.title,
        part: `${step.time || ""} · Step ${stepNum}/${totalSteps}`,
        emoji: "📖",
        title: step.title,
        desc: step.narration,
        choices: step.choices.map(c => ({
            text: c.text, correct: !!c.correct,
            effect: { hp: c.hp || 0, rep: c.rep || 0 },
            log: c.log || "",
        })),
    };
    renderSceneCard(ev, {
        mode: "episode",
        questionIndex: stepNum,
        meta: [ep.title, step.time || "", `Step ${stepNum}/${totalSteps}`].filter(Boolean),
    });
}

function renderEpisodeQuiz(ep, step) {
    const stepNum = gameState.episodeStep + 1;
    const totalSteps = ep.steps.length;
    const q = step.clinicalQuiz;
    const ev = {
        baseId: "episode-quiz",
        category: ep.title,
        part: `${step.time || ""} · Step ${stepNum}/${totalSteps} · 🧠 임상 지식`,
        emoji: "🧠",
        title: q.prompt,
        desc: step.narration,
        choices: q.choices.map(c => ({
            text: c.text, correct: !!c.correct,
            effect: { hp: 0, rep: c.correct ? 3 : -1 },
            log: c.log || "",
        })),
    };
    renderSceneCard(ev, {
        mode: "episode_quiz",
        questionIndex: stepNum,
        meta: [ep.title, step.time || "", "임상 지식 체크"],
    });
}

function handleEpisodeQuizChoice(choice, ev) {
    const isCorrect = isCorrectChoice(choice);
    // 지식 문제는 HP/REP 변동 없음 — 통계만 누적 (퀴즈 정답률)
    gameState.rep += isCorrect ? 3 : -1;
    if (isCorrect) { Sound.correct(); addLog(`[지식 정답] ${choice.log}`, "log-good"); }
    else { Sound.wrong(); addLog(`[지식 오답] ${choice.log}`, "log-bad"); }
    gameState.quizCorrect = (gameState.quizCorrect || 0) + (isCorrect ? 1 : 0);
    gameState.quizSolved = (gameState.quizSolved || 0) + 1;
    updateStats();
    renderFeedback(ev, choice, {
        nextLabel: "→ 임상 결정으로",
        onNext: () => {
            gameState._quizAnswered = true;
            renderEpisodeStep();
        },
    });
}

function handleEpisodeChoice(choice, ev) {
    applyChoiceEffect(choice);
    const isCorrect = isCorrectChoice(choice);
    if (isCorrect) { bumpCombo(); Sound.correct(); addLog(`[정답] ${choice.log}`, "log-good"); }
    else { resetCombo(); Sound.wrong(); addLog(`[오답] ${choice.log}`, "log-bad"); }
    renderFeedback(ev, choice, {
        onNext: () => {
            gameState.episodeStep += 1;
            gameState._quizAnswered = false; // 다음 step 의 quiz 다시 활성화
            // 다음 step 으로 진행하면서 자동 저장
            Storage.saveEpisodeProgress(gameState.episodeId, gameState.episodeStep, gameState.hp, gameState.rep);
            renderEpisodeStep();
        },
    });
}

function endEpisode() {
    const ep = NC.EPISODES.find(x => x.id === gameState.episodeId);
    if (!ep) return;
    // ending 분기: HP + rep 가중 점수
    const finalScore = gameState.hp + gameState.rep;
    let endingKey;
    if (finalScore >= 130) endingKey = "good";
    else if (finalScore >= 70) endingKey = "ok";
    else endingKey = "bad";
    const ending = ep.endings[endingKey];
    Storage.addHistory({ mode: "episode", at: Date.now(), id: gameState.episodeId, hp: gameState.hp, rep: gameState.rep, ending: endingKey });
    Storage.setEpisodeResult(gameState.episodeId, endingKey, gameState.hp, gameState.rep);
    Storage.clearEpisodeProgress(gameState.episodeId); // 완수 시 진행 클리어
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">${escapeHtml(ending.title)}</h2>
        <p class="scene-desc">${escapeHtml(ending.body)}</p>
        <hr class="dashboard-divider">
        <p class="scene-desc">최종 HP <strong>${gameState.hp}</strong> · 평판 <strong>${gameState.rep}</strong> · 듀티 종료.</p>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="renderEpisodeMenu">에피소드 목록</button>
          <button class="choice-btn" data-action="returnToMenu">메인 메뉴</button>
        </div>
      </div>`;
}

// =========================================================================
// 임상 시나리오 (멀티스텝, HP/평판 누적)
// =========================================================================
function renderScenarioMenu() {
    resetStateForMode();
    gameState.mode = "scenario_menu";
    showCoreUI(); UI.logBar.innerHTML = "";
    addLog("멀티스텝 임상 시나리오 — 한 환자의 의사결정을 끝까지 따라가세요.", "log-important");
    updateStats();
    const data = Storage.load();
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">임상 시나리오 챔버</h2>
        <p class="scene-desc">한 환자의 입실 → 사정 → 처치 → 평가까지 3~5단계 의사결정을 진행합니다.\n각 결정이 환자 상태(HP)에 누적됩니다.</p>
        <div class="choice-list">
          ${NC.SCENARIOS.map(s => {
              const rec = data.scenarios[s.id];
              const tag = rec?.completed ? ` ✅ 최고 HP ${rec.bestHp}` : "";
              return `<button class="choice-btn primary" data-action="startScenario" data-arg="${escapeHtml(s.id)}">${escapeHtml(s.title)}${tag}</button>`;
          }).join("")}
          <button class="choice-btn" data-action="returnToMenu">메인 메뉴</button>
        </div>
      </div>`;
}

function startScenario(target) {
    const id = target.dataset.arg;
    const s = NC.SCENARIOS.find(x => x.id === id);
    if (!s) return;
    resetStateForMode();
    gameState.mode = "scenario";
    gameState.scenarioId = id;
    gameState.scenarioStep = 0;
    gameState.hp = 100; gameState.rep = 0;
    showCoreUI(); UI.logBar.innerHTML = "";
    addLog(`시나리오 시작: ${s.title}`, "log-important");
    addLog(s.intro);
    renderScenarioStep();
}

function renderScenarioStep() {
    const s = NC.SCENARIOS.find(x => x.id === gameState.scenarioId);
    if (!s) return;
    if (gameState.scenarioStep >= s.steps.length) { endScenario(); return; }
    const step = s.steps[gameState.scenarioStep];
    const ev = {
        baseId: "scenario", category: s.title, part: `Step ${gameState.scenarioStep + 1}/${s.steps.length}`,
        emoji: "📋", title: step.prompt,
        desc: gameState.scenarioStep === 0 ? s.intro : `현재 HP ${gameState.hp} / 평판 ${gameState.rep}`,
        choices: step.choices.map(c => ({
            text: c.text, correct: !!c.correct,
            effect: { hp: c.hp || 0, rep: c.rep || 0 },
            log: c.log || "",
        })),
    };
    renderSceneCard(ev, { mode: "scenario", questionIndex: gameState.scenarioStep + 1, meta: [s.title, `Step ${gameState.scenarioStep + 1}/${s.steps.length}`] });
}

function handleScenarioChoice(choice, ev) {
    applyChoiceEffect(choice);
    const isCorrect = isCorrectChoice(choice);
    if (isCorrect) { bumpCombo(); Sound.correct(); addLog(`[정답] ${choice.log}`, "log-good"); }
    else { resetCombo(); Sound.wrong(); addLog(`[오답] ${choice.log}`, "log-bad"); }
    if (gameState.hp <= 0) { renderFeedback(ev, choice, { onNext: () => endScenario("환자 상태 악화 — 시나리오 실패") }); return; }
    renderFeedback(ev, choice, {
        onNext: () => { gameState.scenarioStep += 1; renderScenarioStep(); },
    });
}

function endScenario(failReason) {
    const s = NC.SCENARIOS.find(x => x.id === gameState.scenarioId);
    const title = failReason ? "❌ " + failReason : "✅ 시나리오 완수";
    const completed = !failReason;
    Storage.setScenarioResult(gameState.scenarioId, gameState.hp, gameState.rep, completed);
    Storage.addHistory({ mode: "scenario", at: Date.now(), id: gameState.scenarioId, hp: gameState.hp, rep: gameState.rep, completed });
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">${escapeHtml(title)}</h2>
        <p class="scene-desc">${escapeHtml(s ? s.title : "")}\n최종 HP ${gameState.hp} · 평판 ${gameState.rep}</p>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="renderScenarioMenu">시나리오 목록</button>
          <button class="choice-btn" data-action="returnToMenu">메인 메뉴</button>
        </div>
      </div>`;
}

// =========================================================================
// PDF/인쇄 (오답노트 + 대시보드)
// =========================================================================
// 잔여 print-only 영역을 정리하고 새 영역 추가 + 인쇄 미리보기 종료 후 제거
function preparePrintArea() {
    document.querySelectorAll(".print-only").forEach(n => n.remove());
    const area = document.createElement("div");
    area.className = "print-only";
    return area;
}
function triggerPrint(area) {
    document.body.appendChild(area);
    const cleanup = () => area.remove();
    // Chrome/Safari 는 print() 가 비동기 미리보기로 즉시 반환 — afterprint 후 제거해야 빈 페이지 방지
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
        window.addEventListener("afterprint", cleanup, { once: true });
    }
    try { window.print(); }
    catch { cleanup(); }
}

function printWrongQueue() {
    const queue = Storage.getWrongQueue();
    const area = preparePrintArea();
    let html = `<h1>오답노트 — ${todayKey()}</h1><p>총 ${queue.length}건</p>`;
    queue.forEach((q, i) => {
        const correct = (q.choices || []).find(c => c.correct);
        html += `
            <div class="print-item">
              <h3>${i + 1}. [${escapeHtml(q.category || "")}] ${escapeHtml(q.title || "")}</h3>
              <p>${escapeHtml(q.desc || "").replace(/\n/g, "<br>")}</p>
              <ul>
                ${(q.choices || []).map(c => `<li>${c.correct ? "<strong>✓ " + escapeHtml(c.text) + "</strong>" : escapeHtml(c.text)}</li>`).join("")}
              </ul>
              <p class="print-log">해설: ${escapeHtml((correct && correct.log) || "")}</p>
            </div>`;
    });
    area.innerHTML = html;
    triggerPrint(area);
}

function printDashboard() {
    const stats = Storage.getStats();
    const data = Storage.load();
    const area = preparePrintArea();
    let html = `<h1>학습 대시보드 — ${todayKey()}</h1>`;
    html += `<table class="print-stats"><thead><tr><th>과목</th><th>풀이</th><th>정답</th><th>정답률</th></tr></thead><tbody>`;
    CATEGORIES.forEach(cat => {
        const s = stats[cat] || { solved: 0, correct: 0 };
        const acc = s.solved ? Math.round(s.correct / s.solved * 100) : 0;
        html += `<tr><td>${escapeHtml(cat)}</td><td>${s.solved}</td><td>${s.correct}</td><td>${acc}%</td></tr>`;
    });
    html += `</tbody></table>`;
    html += `<p>최고 콤보 ${data.bestCombo} · 모의고사 최고점 ${data.mockBest} · 인계 ${data.handoffBest || 0}% · 트리아지 ${data.triageBest || 0}% · 오답 ${data.wrongQueue.length}건</p>`;
    area.innerHTML = html;
    triggerPrint(area);
}

// =========================================================================
// 출제 경향 차트 (SVG)
// =========================================================================
function renderTrendsChart() {
    const t = NC.EXAM_TRENDS;
    const cats = Object.keys(t.categories);
    const totals = cats.map(c => t.categories[c].reduce((s, v) => s + v, 0) / t.categories[c].length);
    const max = Math.max(...totals);
    const barH = 22, gap = 6, labelW = 130;
    const W = 360, H = cats.length * (barH + gap) + 20;
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="최근 5개년 과목별 평균 문항 수" class="trends-svg">`;
    cats.forEach((cat, i) => {
        const v = totals[i];
        const w = (v / max) * (W - labelW - 30);
        const y = i * (barH + gap) + 5;
        svg += `<text x="0" y="${y + 15}" class="trend-label">${escapeHtml(cat)}</text>`;
        svg += `<rect x="${labelW}" y="${y}" width="${w}" height="${barH}" rx="4" class="trend-bar"/>`;
        svg += `<text x="${labelW + w + 4}" y="${y + 15}" class="trend-value">${Math.round(v)}</text>`;
    });
    svg += `</svg>`;
    return svg;
}

// =========================================================================
// 대시보드 (과목별 통계)
// =========================================================================
function renderDashboard() {
    gameState.mode = "dashboard";
    showCoreUI(); updateStats();
    const stats = Storage.getStats();
    const data = Storage.load();
    const rows = CATEGORIES.map(cat => {
        const s = stats[cat] || { solved: 0, correct: 0 };
        const acc = s.solved > 0 ? Math.round((s.correct / s.solved) * 100) : 0;
        return `
          <div class="dashboard-row">
            <div class="dashboard-cat-cell">
              <div class="cat-name">${escapeHtml(cat)}</div>
              <div class="cat-stats">${s.correct}/${s.solved} · ${acc}%</div>
            </div>
            <div class="mini-bar" role="progressbar" aria-valuenow="${acc}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHtml(cat)} 정답률"><div class="mini-bar-fill" style="width:${acc}%"></div></div>
          </div>`;
    }).join("");
    const wrongCount = data.wrongQueue.length;
    const todayDaily = data.daily[todayKey()];
    const dailyMsg = todayDaily?.completed ? `오늘 완료 (${todayDaily.correct}/${DAILY_CHALLENGE_TOTAL})` : "오늘 미완료";

    const summaryRows = [
        { label: "최고 콤보",        value: data.bestCombo },
        { label: "모의고사 최고점",   value: data.mockBest },
        { label: "인계 정확도",       value: `${data.handoffBest || 0}%` },
        { label: "트리아지 정확도",   value: `${data.triageBest || 0}%` },
        { label: "오답노트",         value: `${wrongCount}건` },
        { label: "오늘의 챌린지",     value: dailyMsg },
    ].map(s => `<div class="dash-stat"><span class="dash-stat-label">${escapeHtml(s.label)}</span><span class="dash-stat-value">${escapeHtml(String(s.value))}</span></div>`).join("");

    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">학습 대시보드</h2>
        <p class="scene-desc">과목별 정답률과 누적 성과를 확인할 수 있습니다.</p>

        <h3 class="dash-section-title">과목별 정답률</h3>
        <div class="dashboard-grid">${rows}</div>

        <h3 class="dash-section-title">누적 성과</h3>
        <div class="dash-stats-grid">${summaryRows}</div>

        <h3 class="dash-section-title">최근 5개년 출제 경향</h3>
        ${renderTrendsChart()}

        <div class="choice-list dashboard-actions">
          <button class="choice-btn primary" data-action="reviewWrongAnswers">오답 복습 (${wrongCount})</button>
          <button class="choice-btn" data-action="printWrongQueue">오답노트 PDF / 인쇄</button>
          <button class="choice-btn" data-action="printDashboard">대시보드 PDF / 인쇄</button>
          <button class="choice-btn" data-action="confirmClearStats">통계 초기화</button>
        </div>
      </div>`;
}
function confirmClearStats() {
    if (!confirm("모든 통계/오답/기록을 초기화합니다. 계속하시겠습니까?")) return;
    localStorage.removeItem(STORAGE_KEY);
    addLog("저장된 데이터를 초기화했습니다.", "log-important");
    renderDashboard();
}

// =========================================================================
// 설정 · About · 개인정보 · 백업/복원 (출시 1.0 페이지들)
// =========================================================================
function openSettings() {
    if (UI.modal.classList.contains("active")) return;
    gameState.mode = "settings";
    showCoreUI(); updateStats();
    const settings = Storage.getSettings();
    const data = Storage.load();
    const stats = data.stats || {};
    const totalSolved = Object.values(stats).reduce((s, v) => s + (v.solved || 0), 0);
    const totalCorrect = Object.values(stats).reduce((s, v) => s + (v.correct || 0), 0);
    const acc = totalSolved ? Math.round(totalCorrect / totalSolved * 100) : 0;
    UI.gameArea.innerHTML = `
      <div class="card settings-card">
        <h2 class="scene-title">⚙️ 설정</h2>

        <h3 class="settings-section">일반</h3>
        <div class="settings-row">
          <span>테마</span>
          <span class="settings-value">${settings.theme === "dark" ? "다크" : settings.theme === "light" ? "라이트" : "자동(시스템)"}</span>
        </div>
        <div class="settings-row">
          <span>사운드</span>
          <span class="settings-value">${settings.sound !== false ? "켜짐" : "꺼짐"}</span>
        </div>
        <div class="settings-row">
          <span>언어</span>
          <span class="settings-value">한국어 <small>(NCLEX 영어 모드 예정)</small></span>
        </div>

        <h3 class="settings-section">데이터</h3>
        <div class="settings-row">
          <span>총 풀이</span>
          <span class="settings-value">${totalSolved}문제 · 정답 ${totalCorrect} (${acc}%)</span>
        </div>
        <div class="settings-row">
          <span>오답노트</span>
          <span class="settings-value">${(data.wrongQueue || []).length}건</span>
        </div>
        <div class="settings-row">
          <span>에피소드 완료</span>
          <span class="settings-value">${Object.keys(data.episodes || {}).length} / ${NC.EPISODES.length}</span>
        </div>
        <div class="settings-row">
          <span>오류 신고</span>
          <span class="settings-value">${(data.errorReports || []).length}건</span>
        </div>

        <div class="choice-list">
          <button class="choice-btn" data-action="exportData">📦 데이터 백업 (JSON 다운로드)</button>
          <button class="choice-btn" data-action="triggerImportData">📥 데이터 복원 (JSON 업로드)</button>
          <input type="file" id="import-file-input" accept="application/json" style="display:none">
          <button class="choice-btn" data-action="confirmClearStats">🗑 전체 데이터 초기화</button>
        </div>

        <h3 class="settings-section">정보</h3>
        <div class="choice-list">
          <button class="choice-btn" data-action="renderAbout">앱 정보 · 버전 · 변경 이력</button>
          <button class="choice-btn" data-action="renderPrivacy">개인정보 처리방침</button>
          <button class="choice-btn" data-action="showLegal">이용 약관 · 면책</button>
          <button class="choice-btn" data-action="showOnboarding">튜토리얼 다시 보기</button>
          <button class="choice-btn" data-action="openErrorReport">컨텐츠 오류 신고</button>
        </div>

        <div class="choice-list">
          <button class="choice-btn primary" data-action="returnToMenu">메인 메뉴</button>
        </div>
      </div>`;
    // 파일 업로드 핸들러 wiring
    const fileInput = document.getElementById("import-file-input");
    if (fileInput) {
        fileInput.addEventListener("change", handleImportFile);
    }
}

function exportData() {
    const data = Storage.load();
    const payload = JSON.stringify({
        version: APP_VERSION,
        exportedAt: new Date().toISOString(),
        data,
    }, null, 2);
    try {
        const blob = new Blob([payload], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `nurseSim-backup-${todayKey()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addLog("데이터 백업 파일이 다운로드됐습니다.", "log-good");
    } catch (e) {
        addLog("백업 실패: " + e.message, "log-bad");
    }
}
function triggerImportData() {
    const fileInput = document.getElementById("import-file-input");
    if (fileInput) fileInput.click();
}
function handleImportFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const parsed = JSON.parse(ev.target.result);
            const payload = parsed.data || parsed; // 둘 다 허용
            if (!payload || typeof payload !== "object") throw new Error("유효하지 않은 파일");
            if (!confirm("기존 데이터가 모두 덮어쓰여집니다. 계속하시겠습니까?")) return;
            const validated = Storage.validate(payload);
            Storage.save(validated);
            addLog("데이터가 복원됐습니다.", "log-good");
            openSettings();
        } catch (err) {
            addLog("복원 실패: " + err.message, "log-bad");
            alert("복원 실패: " + err.message);
        }
    };
    reader.readAsText(file);
}

function renderAbout() {
    gameState.mode = "about";
    showCoreUI(); updateStats();
    UI.gameArea.innerHTML = `
      <div class="card about-card">
        <h2 class="scene-title">앱 정보</h2>
        <p><strong>간호사 시뮬레이터 v${APP_VERSION}</strong></p>
        <p class="about-meta">한국 간호사 국가고시 학습을 위한 임상 시뮬레이션 + 문제풀이 하이브리드.</p>

        <h3 class="settings-section">수록 컨텐츠</h3>
        <ul class="about-list">
          <li>📖 에피소드 ${NC.EPISODES.length}개 (313 단계)</li>
          <li>🎙️ 인계 환자 ${NC.HANDOFF_PATIENTS.length}명 풀</li>
          <li>📋 임상 시나리오 ${NC.SCENARIOS.length}개</li>
          <li>🚑 트리아지 케이스 ${NC.TRIAGE_CASES.length}개</li>
          <li>📚 4지선다 generator ${NQ.allGenerators.length}종 (8과목)</li>
          <li>📚 검증된 의료 출처 ${KNOWN_SOURCES.length}건</li>
        </ul>

        <h3 class="settings-section">변경 이력</h3>
        <p class="about-meta"><strong>v1.0.0</strong> — 정식 출시. 설정 · 백업/복원 · About · Privacy in-app · v1.0 배지.</p>
        <p class="about-meta"><strong>v0.9</strong> — 이어하기 · spaced repetition · 검색 · 출처 표시 (P0 4건).</p>
        <p class="about-meta"><strong>v0.8</strong> — 면책 스트립 · BETA 배지 · 오류 신고 · 동의 체크박스.</p>
        <p class="about-meta"><strong>v0.7</strong> — 에피소드 26개 완비.</p>
        <p class="about-meta"><strong>v0.6</strong> — 모바일 디자인 폴리시 · SVG 아이콘 · PNG 자동 생성.</p>
        <p class="about-meta">전체 이력: <code>CHANGELOG.md</code></p>

        <h3 class="settings-section">라이선스</h3>
        <p class="about-meta">MIT License. 의료 면책 고지는 LICENSE 파일 참고.</p>

        <div class="choice-list">
          <button class="choice-btn primary" data-action="openSettings">설정으로</button>
          <button class="choice-btn" data-action="returnToMenu">메인 메뉴</button>
        </div>
      </div>`;
}

function renderPrivacy() {
    gameState.mode = "privacy";
    showCoreUI(); updateStats();
    UI.gameArea.innerHTML = `
      <div class="card legal-card">
        <h2 class="scene-title">개인정보 처리방침</h2>
        <p class="about-meta"><strong>최종 갱신: 2026-05-17 · 버전 1.0</strong></p>

        <section class="legal-section">
          <h3 class="legal-h">1. 수집·이용하는 정보</h3>
          <p>본 앱은 <strong>외부 서버로 어떤 개인정보도 전송하지 않습니다.</strong> 다음 항목만 사용자 기기의 브라우저 localStorage 에 저장됩니다:</p>
          <ul class="legal-list">
            <li>학습 통계 (과목별 정답률·콤보 최고점)</li>
            <li>오답 노트 (틀린 문제 + spaced repetition 메타데이터)</li>
            <li>에피소드 진행 상태 (이어하기용)</li>
            <li>사운드·테마 설정</li>
            <li>약관 동의 일시</li>
            <li>오류 신고 로컬 기록</li>
          </ul>
        </section>

        <section class="legal-section">
          <h3 class="legal-h">2. 보유·이용 기간</h3>
          <p>모든 데이터는 사용자가 직접 삭제하거나 브라우저 데이터를 초기화할 때까지 보유됩니다. 외부로 자동 전송·동기화되지 않습니다.</p>
        </section>

        <section class="legal-section">
          <h3 class="legal-h">3. 제3자 제공·공유</h3>
          <p>없습니다. 본 앱은 광고·분석·외부 인증·결제 등 어떠한 제3자 SDK 도 포함하지 않습니다.</p>
        </section>

        <section class="legal-section">
          <h3 class="legal-h">4. 정보 보호 조치</h3>
          <ul class="legal-list">
            <li><strong>네트워크 통신 0</strong> — Electron 로컬 실행 또는 PWA cache-first</li>
            <li>CSP <code>script-src 'self'</code> — 외부 스크립트 차단</li>
            <li>Storage 스키마 검증 — 변조 시 안전 복구</li>
          </ul>
        </section>

        <section class="legal-section">
          <h3 class="legal-h">5. 이용자 권리</h3>
          <p>설정 → 데이터 백업으로 본인 데이터를 JSON 으로 내보낼 수 있습니다. 설정 → 전체 데이터 초기화로 모든 데이터를 영구 삭제할 수 있습니다.</p>
        </section>

        <section class="legal-section">
          <h3 class="legal-h">6. 문의</h3>
          <p>본 앱은 오픈소스 (MIT) 입니다. GitHub Issue 또는 이메일로 문의 가능합니다.</p>
        </section>

        <div class="choice-list">
          <button class="choice-btn primary" data-action="openSettings">설정으로</button>
          <button class="choice-btn" data-action="returnToMenu">메인 메뉴</button>
        </div>
      </div>`;
}

// =========================================================================
// 오류 신고 — 어디서든 접근 가능한 컨텐츠 신고 화면
// =========================================================================
function openErrorReport() {
    if (UI.modal.classList.contains("active")) return;
    // 현재 컨텍스트 자동 캡처
    const sceneTitle = document.querySelector(".scene-title");
    const ctx = {
        mode: gameState.mode,
        title: sceneTitle ? sceneTitle.textContent : "",
        episode: gameState.episodeId || null,
        scenario: gameState.scenarioId || null,
        category: gameState.quizCategory || null,
    };
    gameState._reportContext = ctx;
    gameState._reportReturn = { mode: gameState.mode, html: UI.gameArea.innerHTML };
    hideCoreUI();
    UI.topBar.classList.remove("hidden");
    UI.gameArea.innerHTML = `
      <div class="card report-card">
        <h2 class="menu-title">🚩 컨텐츠 오류 신고</h2>
        <p class="menu-tagline">잘못된 답·해설·약물 정보·맞춤법 등 모든 오류를 신고해 주세요. 본인 학습과 다른 사용자 안전에 직접 도움됩니다.</p>
        <div class="report-context">
          <strong>신고 컨텍스트</strong><br>
          모드: ${escapeHtml(ctx.mode || "메뉴")}<br>
          ${ctx.title ? `위치: ${escapeHtml(ctx.title)}<br>` : ""}
          ${ctx.episode ? `에피소드: ${escapeHtml(ctx.episode)}<br>` : ""}
          ${ctx.scenario ? `시나리오: ${escapeHtml(ctx.scenario)}<br>` : ""}
          ${ctx.category ? `카테고리: ${escapeHtml(ctx.category)}` : ""}
        </div>
        <label for="report-text" style="font-size:13px; color:var(--muted); display:block; margin-bottom:6px;">
          무엇이 잘못됐나요? (출처가 있다면 함께 적어주세요)
        </label>
        <textarea id="report-text" class="report-textarea"
          placeholder="예) Mg 독성 해독제는 Diazepam이 아니라 Calcium gluconate 입니다. 출처: ACOG 2021 가이드라인."
          aria-label="오류 내용"></textarea>
        <div class="report-button-row">
          <button class="choice-btn primary" data-action="submitErrorReport">로컬 저장</button>
          <button class="choice-btn" data-action="submitErrorReportGithub">GitHub 이슈로 보내기 ↗</button>
          <button class="choice-btn" data-action="closeErrorReport">취소</button>
        </div>
      </div>`;
}
function submitErrorReport() {
    const textEl = document.getElementById("report-text");
    if (!textEl) return;
    const text = textEl.value.trim();
    if (!text) { textEl.focus(); return; }
    const ctx = gameState._reportContext || {};
    Storage.addErrorReport({ ...ctx, text });
    UI.gameArea.innerHTML = `
      <div class="card report-card">
        <h2 class="menu-title">✓ 신고 접수</h2>
        <p class="menu-tagline">로컬에 저장됐습니다 (${Storage.getErrorReports().length}건). 검토 후 다음 버전에 반영됩니다. 감사합니다.</p>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="closeErrorReport">계속</button>
        </div>
      </div>`;
}
function submitErrorReportGithub() {
    const textEl = document.getElementById("report-text");
    if (!textEl) return;
    const text = textEl.value.trim();
    if (!text) { textEl.focus(); return; }
    const ctx = gameState._reportContext || {};
    Storage.addErrorReport({ ...ctx, text, sentToGithub: true });
    const title = `[content] ${ctx.title || ctx.mode || "메뉴"} 오류 신고`;
    const body = [
        `## 컨텍스트`,
        `- 모드: ${ctx.mode || "메뉴"}`,
        ctx.title ? `- 위치: ${ctx.title}` : "",
        ctx.episode ? `- 에피소드: ${ctx.episode}` : "",
        ctx.scenario ? `- 시나리오: ${ctx.scenario}` : "",
        ctx.category ? `- 카테고리: ${ctx.category}` : "",
        ``,
        `## 오류 내용`,
        text,
        ``,
        `## 출처 / 참고`,
        `(여기에 첨부)`,
    ].filter(Boolean).join("\n");
    const url = `https://github.com/luiseluise0619-wq/nursing-simulation/issues/new?labels=content,needs-clinical-review&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    try { window.open(url, "_blank", "noopener,noreferrer"); } catch {}
    submitErrorReport(); // confirmation 화면도 띄움
}
function closeErrorReport() {
    const ret = gameState._reportReturn;
    gameState._reportContext = null;
    gameState._reportReturn = null;
    if (ret && ret.html && ret.mode && ret.mode !== "menu") {
        UI.gameArea.innerHTML = ret.html;
        gameState.mode = ret.mode;
        showCoreUI(); updateStats();
    } else {
        returnToMenu();
    }
}

// =========================================================================
// 약관 / 개인정보 / 면책 (첫 실행 시 동의 게이트)
// =========================================================================
const LEGAL_VERSION = "1.0";

function renderLegalGate(onAccept) {
    hideCoreUI();
    UI.topBar.classList.remove("hidden"); // 테마/사운드 토글은 유지
    UI.gameArea.innerHTML = `
      <div class="card legal-card">
        <h1 class="menu-title">📜 시작 전 확인</h1>
        <p class="menu-tagline">간호사 시뮬레이터는 학습 보조 도구입니다.</p>

        <section class="legal-section">
          <h2 class="legal-h">⚠️ 의료 학습 면책 고지</h2>
          <p>이 앱이 제공하는 임상 시나리오·약물 정보·간호중재 권고는 <strong>교육적 시뮬레이션</strong>이며, 실제 환자에 대한 의학적 자문·진단·치료를 대체하지 않습니다.</p>
          <p>실제 임상에서는 반드시 <strong>면허를 가진 의료인의 판단, 공식 가이드라인(KDCA, ACLS, AHA 등), 의료기관 프로토콜</strong>을 따르십시오.</p>
          <p>작성자와 기여자는 이 앱의 사용·오용에서 비롯된 환자 손상, 의료 사고, 학습 결과의 부정확성에 대해 책임지지 않습니다.</p>
        </section>

        <section class="legal-section">
          <h2 class="legal-h">🔒 개인정보 처리방침 (요약)</h2>
          <ul class="legal-list">
            <li>이 앱은 <strong>네트워크 통신을 하지 않습니다.</strong> 모든 데이터는 사용자의 기기 안에서만 처리됩니다.</li>
            <li>저장되는 항목: 학습 통계, 오답 노트, 사운드/테마 설정, 일일 챌린지 기록 (브라우저 localStorage).</li>
            <li>외부 서버로 전송되는 개인정보·식별정보는 <strong>없습니다.</strong></li>
            <li>대시보드 "통계 초기화" 버튼으로 언제든 전체 데이터를 삭제할 수 있습니다.</li>
          </ul>
        </section>

        <section class="legal-section">
          <h2 class="legal-h">📑 이용 약관 (요약)</h2>
          <ul class="legal-list">
            <li>본 앱은 무료로 제공되며 학습·교육 목적으로만 사용됩니다.</li>
            <li>MIT 라이선스에 따라 자유롭게 사용·수정·배포할 수 있습니다 (LICENSE 파일 참고).</li>
            <li>임상 의사결정의 책임은 사용자에게 있습니다.</li>
          </ul>
        </section>

        <div class="legal-consent">
          <input type="checkbox" id="legal-consent-check" aria-describedby="legal-consent-label">
          <label for="legal-consent-check" id="legal-consent-label">
            본 앱의 정보를 <strong>실제 환자에게 직접 적용하지 않을 것</strong>을 약속하며, 임상 의사결정에는 면허 의료인의 판단과 공식 가이드라인을 따를 것을 동의합니다.
          </label>
        </div>
        <div class="choice-list">
          <button class="choice-btn primary legal-accept-btn" data-action="legalAccept" disabled>동의하고 시작하기</button>
        </div>
      </div>`;
    UI._onLegalAccept = onAccept;
    // 체크박스 활성/비활성 wiring — innerHTML 직후라 DOM 동기적으로 접근 가능
    const cb = document.getElementById("legal-consent-check");
    const btn = document.querySelector(".legal-accept-btn");
    if (cb && btn) {
        cb.addEventListener("change", () => { btn.disabled = !cb.checked; });
    }
}
function legalAccept() {
    // 체크박스 미체크 상태 클릭 방지 (키보드 우회 대비)
    const cb = document.getElementById("legal-consent-check");
    if (cb && !cb.checked) { cb.focus(); return; }
    Storage.setAccepted(LEGAL_VERSION);
    const cont = UI._onLegalAccept;
    UI._onLegalAccept = null;
    if (typeof cont === "function") cont(); else returnToMenu();
}

// =========================================================================
// 온보딩 (첫 실행 튜토리얼 — 5 슬라이드)
// =========================================================================
// 온보딩 SVG 일러스트 — 외부 자원 0, currentColor stroke 로 테마 따라가도록
const ONBOARDING_ILLUSTRATIONS = [
    // 0: 환영 — 건물 + 십자
    `<svg class="onboard-svg" viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="20" y="30" width="80" height="70" rx="4"/>
        <path d="M55 50 v20 M45 60 h20" stroke-width="4" stroke="var(--primary)"/>
        <rect x="30" y="80" width="14" height="20" stroke-width="1.5"/>
        <rect x="76" y="80" width="14" height="20" stroke-width="1.5"/>
        <path d="M20 30 L60 10 L100 30" stroke="var(--primary)"/>
    </svg>`,
    // 1: 9개 모드 — 3x3 그리드
    `<svg class="onboard-svg" viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="20" y="20" width="22" height="22" rx="4" fill="var(--primary)" stroke="none"/>
        <rect x="49" y="20" width="22" height="22" rx="4"/>
        <rect x="78" y="20" width="22" height="22" rx="4"/>
        <rect x="20" y="49" width="22" height="22" rx="4"/>
        <rect x="49" y="49" width="22" height="22" rx="4" fill="var(--primary)" stroke="none"/>
        <rect x="78" y="49" width="22" height="22" rx="4"/>
        <rect x="20" y="78" width="22" height="22" rx="4"/>
        <rect x="49" y="78" width="22" height="22" rx="4"/>
        <rect x="78" y="78" width="22" height="22" rx="4" fill="var(--primary)" stroke="none"/>
    </svg>`,
    // 2: 오답노트 — 책갈피 + 화살표 루프
    `<svg class="onboard-svg" viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="35" y="20" width="50" height="80" rx="3"/>
        <path d="M45 35 h30 M45 50 h30 M45 65 h20" stroke-width="1.5"/>
        <path d="M65 75 l8 8 l-8 8" stroke="var(--primary)"/>
        <path d="M45 91 q-8 -10 0 -20" stroke="var(--primary)" fill="none"/>
    </svg>`,
    // 3: 키보드
    `<svg class="onboard-svg" viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="15" y="40" width="90" height="50" rx="6"/>
        <rect x="24" y="50" width="10" height="10" rx="2"/>
        <rect x="38" y="50" width="10" height="10" rx="2"/>
        <rect x="52" y="50" width="10" height="10" rx="2"/>
        <rect x="66" y="50" width="10" height="10" rx="2"/>
        <rect x="80" y="50" width="16" height="10" rx="2" fill="var(--primary)" stroke="none"/>
        <rect x="24" y="65" width="58" height="10" rx="2"/>
        <rect x="86" y="65" width="10" height="10" rx="2"/>
        <path d="M40 90 v8 M80 90 v8 M40 98 h40" stroke-width="1.5"/>
    </svg>`,
    // 4: 면책 — 방패 + 십자
    `<svg class="onboard-svg" viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M60 15 L95 25 V60 Q95 90 60 105 Q25 90 25 60 V25 Z"/>
        <path d="M60 45 v25 M48 57 h24" stroke="var(--primary)" stroke-width="3.5"/>
    </svg>`,
];

const ONBOARDING_SLIDES = [
    { illust: 0, title: "간호사 시뮬레이터에 오신 것을 환영합니다",
      body: "국시 8과목 + 임상 시뮬레이션을 하나의 앱에서 연습할 수 있어요.\n시프트 난이도(Day/Evening/Night)에 따라 HP 손실이 달라집니다." },
    { illust: 1, title: "9개 모드를 활용하세요",
      body: "실전 듀티 · 트레이닝 · 모의고사 · 일일 챌린지 · 인계 시뮬 · 트리아지 · 시나리오 · 오답노트 · 대시보드.\n메인 메뉴에서 카드를 탭하면 바로 시작합니다." },
    { illust: 2, title: "오답은 자동으로 쌓입니다",
      body: "틀린 문제는 오답노트에 저장되어, 정답을 맞힐 때까지 다시 출제됩니다.\n과목별 정답률은 대시보드에서 막대 그래프로 확인하세요." },
    { illust: 3, title: "키보드 단축키",
      body: "1~4 보기 선택 · Space 다음 문제 · T 테마 전환 · M 사운드 토글 · ESC 모달 닫기.\n모바일에서는 카드를 그냥 탭하시면 됩니다." },
    { illust: 4, title: "학습 도구로만 사용하세요",
      body: "본 앱은 교육 목적이며, 실제 임상 의사결정을 대체하지 않습니다.\n공식 가이드라인과 의료기관 프로토콜을 항상 우선하세요." },
];
let onboardingIndex = 0;

function renderOnboarding(idx = 0) {
    onboardingIndex = idx;
    const slide = ONBOARDING_SLIDES[idx];
    const total = ONBOARDING_SLIDES.length;
    hideCoreUI();
    UI.topBar.classList.remove("hidden");
    const dots = ONBOARDING_SLIDES.map((_, i) =>
        `<span class="onboard-dot ${i === idx ? "active" : ""}" aria-current="${i === idx ? "true" : "false"}"></span>`
    ).join("");
    UI.gameArea.innerHTML = `
      <div class="card onboard-card">
        <div class="onboard-illust" aria-hidden="true">${ONBOARDING_ILLUSTRATIONS[slide.illust]}</div>
        <h1 class="menu-title">${escapeHtml(slide.title)}</h1>
        <p class="onboard-body">${escapeHtml(slide.body)}</p>
        <div class="onboard-dots" role="tablist" aria-label="튜토리얼 진행도">${dots}</div>
        <div class="choice-list">
          ${idx < total - 1
              ? `<button class="choice-btn primary" data-action="onboardNext">다음 (${idx + 1}/${total})</button>
                 <button class="choice-btn subtle center" data-action="onboardSkip">건너뛰기</button>`
              : `<button class="choice-btn primary" data-action="onboardFinish">시작하기</button>`}
        </div>
      </div>`;
}
function onboardNext() {
    if (onboardingIndex < ONBOARDING_SLIDES.length - 1) renderOnboarding(onboardingIndex + 1);
    else onboardFinish();
}
function onboardSkip() { onboardFinish(); }
function onboardFinish() {
    Storage.setOnboarded();
    returnToMenu();
}

// =========================================================================
// 메인 메뉴 (returnToMenu)
// =========================================================================
function returnToMenu() {
    // 진행 중인 모의고사 → abort 로 일관 처리 (endMockExam이 history/timer 정리)
    if (gameState.mode === "mock" && !gameState._mockEnded) {
        gameState._mockEnded = true;
        if (gameState.mockTimerId) { clearInterval(gameState.mockTimerId); gameState.mockTimerId = null; }
        const total = gameState.mockTotal, correct = gameState.mockCorrect, answered = gameState.mockAnswered;
        const acc = answered > 0 ? Math.round((correct / answered) * 100) : 0;
        Storage.setMockBest(correct);
        Storage.addHistory({ mode: "mock", at: Date.now(), total, answered, correct, accuracy: acc, reason: "abort" });
    }
    // 에피소드 중간 이탈 시 진행 자동 저장
    if (gameState.mode === "episode" && gameState.episodeId) {
        const ep = NC.EPISODES.find(x => x.id === gameState.episodeId);
        if (ep && gameState.episodeStep > 0 && gameState.episodeStep < ep.steps.length) {
            Storage.saveEpisodeProgress(gameState.episodeId, gameState.episodeStep, gameState.hp, gameState.rep);
        }
    }
    // 일일 챌린지 부분 진행 상태 저장 (메뉴에서 재방문 시 대시보드에 노출)
    if (gameState.mode === "daily" && gameState.dailySolved > 0 && gameState.dailySolved < DAILY_CHALLENGE_TOTAL) {
        Storage.setDaily(todayKey(), {
            solved: gameState.dailySolved,
            correct: gameState.dailyCorrect,
            completed: false,
            ts: Date.now(),
        });
    }
    if (gameState.mockTimerId) { clearInterval(gameState.mockTimerId); gameState.mockTimerId = null; }
    // 인계 시뮬레이터 등 TTS 재생을 메뉴 진입과 동시에 강제 중단
    if (typeof Speech !== "undefined") Speech.stop();
    if (UI.modal.classList.contains("active")) UI.modal.classList.remove("active");
    resetStateForMode();
    gameState.mode = "menu";
    UI.logBar.innerHTML = "";
    hideCoreUI();

    const data = Storage.load();
    const todayDaily = data.daily[todayKey()];
    const dailyDone = todayDaily?.completed;
    const wrongCount = data.wrongQueue.length;

    UI.gameArea.innerHTML = `
      <div class="card menu-container">
        <h1 class="menu-title">간호사 시뮬레이터<span class="version-badge" aria-label="버전 1.0 자가 검증">v1.0 · 자가 검증</span></h1>
        <div class="menu-shift-row" role="radiogroup" aria-label="시프트 난이도">
          <button class="shift-option ${gameState.currentShift === 'Day' ? 'active' : ''}" data-action="setShift" data-shift="Day" data-mult="1.0">Day</button>
          <button class="shift-option ${gameState.currentShift === 'Evening' ? 'active' : ''}" data-action="setShift" data-shift="Evening" data-mult="1.2">Evening</button>
          <button class="shift-option ${gameState.currentShift === 'Night' ? 'active' : ''}" data-action="setShift" data-shift="Night" data-mult="1.5">Night</button>
        </div>
        <div class="mode-grid" role="group" aria-label="게임 모드">
          <button class="mode-card wide hero" data-mode="survival" data-action="initSurvival">
            ${ICONS.survival}
            <span class="mc-title">실전 듀티</span>
            <span class="mc-sub">${escapeHtml(gameState.currentShift)} 시프트 · 20 이벤트</span>
          </button>
          <button class="mode-card" data-mode="training" data-action="renderQuizMenu">
            ${ICONS.training}
            <span class="mc-title">트레이닝</span>
            <span class="mc-sub">8과목 · 무한</span>
          </button>
          <button class="mode-card" data-mode="mock" data-action="startMockExam">
            ${ICONS.mock}
            <span class="mc-title">모의고사</span>
            <span class="mc-sub">${MOCK_EXAM_TOTAL}문제 · ${MOCK_EXAM_SECONDS / 60}분</span>
          </button>
          <button class="mode-card" data-mode="daily" data-action="startDailyChallenge">
            ${ICONS.daily}
            <span class="mc-title">일일 챌린지</span>
            <span class="mc-sub">오늘의 ${DAILY_CHALLENGE_TOTAL}문제</span>
            ${dailyDone ? '<span class="mc-badge done" aria-label="오늘 완료">✓</span>' : ''}
          </button>
          <button class="mode-card" data-mode="handoff" data-action="startHandoff">
            ${ICONS.handoff}
            <span class="mc-title">인계 시뮬</span>
            <span class="mc-sub">TTS · 100명 풀</span>
          </button>
          <button class="mode-card" data-mode="triage" data-action="startTriage">
            ${ICONS.triage}
            <span class="mc-title">트리아지</span>
            <span class="mc-sub">응급실 분류 · 7</span>
          </button>
          <button class="mode-card wide" data-mode="scenario" data-action="renderEpisodeMenu">
            ${ICONS.episode}
            <span class="mc-title">에피소드 — 한 듀티 전체</span>
            <span class="mc-sub">12~15단계 연결 스토리 · 같은 환자가 계속 등장</span>
          </button>
          <button class="mode-card wide" data-mode="scenario" data-action="renderScenarioMenu">
            ${ICONS.scenario}
            <span class="mc-title">임상 시나리오</span>
            <span class="mc-sub">짧은 의사결정 · 6 케이스</span>
          </button>
          <button class="mode-card" data-mode="wrong" data-action="reviewWrongAnswers">
            ${ICONS.wrong}
            <span class="mc-title">오답노트</span>
            <span class="mc-sub">${wrongCount}건</span>
            ${wrongCount ? `<span class="mc-badge">${wrongCount}</span>` : ''}
          </button>
          <button class="mode-card" data-mode="dash" data-action="renderDashboard">
            ${ICONS.dash}
            <span class="mc-title">대시보드</span>
            <span class="mc-sub">학습 통계</span>
          </button>
          <button class="mode-card wide" data-mode="training" data-action="openSearch">
            <svg class="mc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <span class="mc-title">🔍 컨텐츠 검색</span>
            <span class="mc-sub">에피소드·인계·시나리오·문제 전체 키워드 검색</span>
          </button>
        </div>
        <p class="menu-kbd-row">
          <span class="kbd-hint">1-4</span> 보기 ·
          <span class="kbd-hint">Space</span> 다음 ·
          <span class="kbd-hint">T</span> 테마 ·
          <span class="kbd-hint">M</span> 사운드
        </p>
        <div class="menu-footer">
          <button class="text-link" data-action="openSettings">설정</button>
          <span class="dot-sep" aria-hidden="true">·</span>
          <button class="text-link" data-action="showOnboarding">튜토리얼</button>
          <span class="dot-sep" aria-hidden="true">·</span>
          <button class="text-link" data-action="renderPrivacy">개인정보</button>
          <span class="dot-sep" aria-hidden="true">·</span>
          <button class="text-link" data-action="showLegal">약관</button>
          <span class="dot-sep" aria-hidden="true">·</span>
          <button class="text-link" data-action="renderAbout">v${APP_VERSION}</button>
        </div>
      </div>`;

    // 메인 메뉴에서도 상단 헤더는 표시(테마/사운드 토글 위해)
    UI.topBar.classList.remove("hidden");
}

// =========================================================================
// 게임오버 (Survival → 승급 심사 모달)
// =========================================================================
function showGameOver(title, desc) {
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-desc").textContent = desc;
    const statsEl = document.getElementById("modal-stats");
    statsEl.innerHTML = "";
    const tpl = [
        ["최종 체력", clamp(gameState.hp, 0, 100)],
        ["최종 평판", gameState.rep],
        ["처리한 상황", `${gameState.eventCount}건`],
        ["최고 콤보", gameState.bestCombo],
    ];
    tpl.forEach(([k, v]) => {
        const row = document.createElement("div");
        row.appendChild(document.createTextNode(`${k}: `));
        const sp = document.createElement("span");
        sp.className = "highlight";
        sp.textContent = String(v);
        row.appendChild(sp);
        statsEl.appendChild(row);
    });
    UI.modal.classList.add("active");

    let score = 0, attempts = 0, currentQ = null;
    function gen() {
        const raw = generateClinicalEventByCategory(null);
        const idx = raw.choices.findIndex(isCorrectChoice);
        return { q: `[${raw.category} - ${raw.part}]\n${raw.title}\n\n${raw.desc}`, choices: raw.choices, answer: idx >= 0 ? idx : 0, explain: idx >= 0 ? raw.choices[idx].log : "" };
    }
    function load() {
        currentQ = gen();
        document.getElementById("question-box").textContent = currentQ.q;
        const choicesEl = document.getElementById("choices");
        choicesEl.innerHTML = "";
        currentQ.choices.forEach((c, i) => {
            const btn = document.createElement("button");
            btn.className = "choice-btn";
            btn.textContent = c.text;
            btn.addEventListener("click", () => check(i));
            choicesEl.appendChild(btn);
        });
        document.getElementById("left").textContent = `${attempts + 1}회차`;
        document.getElementById("result").textContent = "";
        // 첫 보기에 포커스
        const first = choicesEl.querySelector(".choice-btn");
        if (first) first.focus();
    }
    function renderResult(ok) {
        const resultEl = document.getElementById("result");
        resultEl.innerHTML = "";
        if (ok) {
            const s = document.createElement("span");
            s.style.color = "var(--success)";
            s.textContent = "✅ 정답!";
            resultEl.appendChild(s);
        } else {
            const head = document.createElement("div");
            head.className = "modal-result-wrong-head";
            head.textContent = `❌ 오답 — 정답: ${currentQ.choices[currentQ.answer].text}`;
            const exp = document.createElement("div");
            exp.className = "modal-result-wrong-exp";
            exp.textContent = currentQ.explain;
            resultEl.appendChild(head);
            resultEl.appendChild(exp);
        }
    }
    function check(i) {
        attempts++;
        const ok = i === currentQ.answer;
        if (ok) { score++; Sound.correct(); }
        else { Sound.wrong(); }
        renderResult(ok);
        const acc = attempts > 0 ? Math.round((score / attempts) * 100) : 0;
        let rank = "신규 간호사 (SN/RN)";
        if (score >= 10) rank = "RN 2년차 (1인분 가능)";
        if (score >= 30) rank = "RN 5년차 (에이스)";
        if (score >= 50) rank = "차지 널스 (Charge)";
        if (score >= 100) rank = "수간호사 (HN)";
        document.getElementById("rank").textContent = `${rank} · 정답률 ${acc}%`;
        document.getElementById("score").textContent = score;
        const choicesEl = document.getElementById("choices");
        choicesEl.querySelectorAll(".choice-btn").forEach(b => b.disabled = true);
        // 자동 진행 대신 명시적 "다음 문제" 버튼 (느린 독해자 배려)
        const nextBtn = document.createElement("button");
        nextBtn.className = "choice-btn primary center";
        nextBtn.textContent = "다음 문제 (Space)";
        nextBtn.style.marginTop = "12px";
        nextBtn.addEventListener("click", load);
        choicesEl.appendChild(nextBtn);
        nextBtn.focus();
    }
    load();
}

// =========================================================================
// 키보드 단축키
// =========================================================================
function handleKeydown(e) {
    // 한국어 IME 조합 중 입력 무시 (1~4, t, m 등이 잘못 발동되지 않도록)
    if (e.isComposing || e.keyCode === 229) return;
    // 모달 활성 시 ESC 로 닫기 + 단축키 차단
    if (UI.modal.classList.contains("active")) {
        if (e.key === "Escape") { returnToMenu(); e.preventDefault(); }
        return;
    }
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= 4) {
        const btns = document.querySelectorAll("#choice-list .choice-btn");
        const btn = btns[num - 1];
        if (btn && !btn.disabled) { btn.click(); e.preventDefault(); }
    } else if (e.key === " " || e.key === "Enter") {
        const next = document.querySelector("#feedback-zone .choice-btn.primary");
        if (next && !next.disabled) { next.click(); e.preventDefault(); }
    } else if (e.key.toLowerCase() === "t") {
        toggleTheme();
    } else if (e.key.toLowerCase() === "m") {
        toggleSound();
    }
}

// =========================================================================
// 부트
// =========================================================================
function boot() {
    cacheUI();
    const settings = Storage.getSettings();
    applyTheme(settings.theme || "auto");
    Sound.enabled = settings.sound !== false;
    if (UI.soundToggle) UI.soundToggle.textContent = Sound.enabled ? "🔊" : "🔇";
    const stored = Storage.load();
    gameState.bestCombo = stored.bestCombo || 0;
    if (UI.themeToggle) UI.themeToggle.addEventListener("click", toggleTheme);
    if (UI.soundToggle) UI.soundToggle.addEventListener("click", toggleSound);
    document.addEventListener("keydown", handleKeydown);
    document.body.addEventListener("click", handleDelegatedAction);
    // 시스템 다크모드 변경에 반응 (사용자가 명시적으로 라이트/다크를 선택하지 않은 경우)
    try {
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const onChange = () => {
            const t = Storage.getSettings().theme;
            if (t === "auto" || !t) applyTheme("auto");
        };
        if (mq.addEventListener) mq.addEventListener("change", onChange);
        else if (mq.addListener) mq.addListener(onChange);
    } catch {}
    // 서비스 워커 등록 (PWA — Electron file:// 에서는 자동으로 무시됨)
    try {
        if (navigator.serviceWorker && location.protocol !== "file:") {
            navigator.serviceWorker.register("./sw.js").catch(() => {});
        }
    } catch {}
    // 첫 실행 → 약관 동의 → 온보딩 → 메뉴
    if (!Storage.isAccepted(LEGAL_VERSION)) {
        renderLegalGate(() => {
            if (!Storage.isOnboarded()) renderOnboarding(0);
            else returnToMenu();
        });
    } else if (!Storage.isOnboarded()) {
        renderOnboarding(0);
    } else {
        returnToMenu();
    }
}

// 인라인 onclick 핸들러를 모두 data-action 위임으로 대체 → CSP `script-src 'self'`만 허용 가능
const DELEGATED_ACTIONS = {
    returnToMenu: () => returnToMenu(),
    initSurvival: () => initSurvival(),
    renderQuizMenu: () => renderQuizMenu(),
    startQuiz: (t) => startQuiz(t.dataset.arg),
    startMockExam: () => startMockExam(),
    startDailyChallenge: () => startDailyChallenge(),
    reviewWrongAnswers: () => reviewWrongAnswers(),
    renderDashboard: () => renderDashboard(),
    confirmClearStats: () => confirmClearStats(),
    setShift: (t) => setShift(t.dataset.shift, parseFloat(t.dataset.mult), t),
    // 신규 모드
    startHandoff: () => startHandoff(),
    handoffPlay: () => handoffPlay(),
    handoffStop: () => handoffStop(),
    handoffShow: () => handoffShow(),
    handoffSubmit: () => handoffSubmit(),
    handoffNext: () => handoffNext(),
    startTriage: () => startTriage(),
    triagePick: (t) => triagePick(t),
    triageSubmit: () => triageSubmit(),
    triageNext: () => triageNext(),
    renderScenarioMenu: () => renderScenarioMenu(),
    startScenario: (t) => startScenario(t),
    renderEpisodeMenu: () => renderEpisodeMenu(),
    startEpisode: (t) => startEpisode(t),
    printWrongQueue: () => printWrongQueue(),
    printDashboard: () => printDashboard(),
    // 약관 / 온보딩
    legalAccept: () => legalAccept(),
    onboardNext: () => onboardNext(),
    onboardSkip: () => onboardSkip(),
    onboardFinish: () => onboardFinish(),
    showLegal: () => renderLegalGate(() => returnToMenu()),
    showOnboarding: () => renderOnboarding(0),
    openErrorReport: () => openErrorReport(),
    submitErrorReport: () => submitErrorReport(),
    submitErrorReportGithub: () => submitErrorReportGithub(),
    closeErrorReport: () => closeErrorReport(),
    // 이어하기 + 검색 + 강제 복습
    episodeResume: (t) => episodeResume(t),
    episodeRestart: (t) => episodeRestart(t),
    openSearch: () => openSearch(),
    reviewWrongForce: () => reviewWrongForce(),
    // 출시 1.0 페이지들
    openSettings: () => openSettings(),
    renderAbout: () => renderAbout(),
    renderPrivacy: () => renderPrivacy(),
    exportData: () => exportData(),
    triggerImportData: () => triggerImportData(),
};
function handleDelegatedAction(e) {
    const target = e.target.closest("[data-action]");
    if (!target) return;
    const handler = DELEGATED_ACTIONS[target.dataset.action];
    if (!handler) return;
    handler(target);
}

if (typeof window !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
}

// Node 환경 (테스트)에서 일부 헬퍼를 노출
if (typeof module !== "undefined" && module.exports) {
    module.exports = { dailySeed, todayKey, clamp, escapeHtml };
}
