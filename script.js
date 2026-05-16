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

const CATEGORIES = [
    "기본간호학", "성인간호학", "모성간호학", "아동간호학",
    "지역사회간호학", "정신간호학", "간호관리학", "보건의약관계법규"
];

const NQ = (typeof window !== "undefined" && window.NurseQuestions)
    || (typeof require !== "undefined" ? require("./questions.js") : null);

// =========================================================================
// 상태
// =========================================================================
let gameState = {
    mode: "menu",                    // menu | survival | quiz_menu | quiz | mock | daily | wrong_review | dashboard
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
        };
        if (data.wrongQueue.length >= 200) data.wrongQueue.shift();
        data.wrongQueue.push(entry);
        Storage.save(data);
        return entry.id;
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

    let value = 0, total = 1, label = "진행도";
    if (gameState.mode === "survival") { value = gameState.eventCount; total = MAX_PROGRESS_EVENTS; label = "듀티 진행도"; }
    else if (gameState.mode === "quiz") { value = gameState.quizSolved; total = Math.max(gameState.quizSolved, 1); label = `학습 진행도 · ${gameState.quizCategory || ""}`; }
    else if (gameState.mode === "mock") { value = gameState.mockAnswered; total = gameState.mockTotal; label = "모의고사"; }
    else if (gameState.mode === "daily") { value = gameState.dailySolved; total = DAILY_CHALLENGE_TOTAL; label = "일일 챌린지"; }
    else if (gameState.mode === "wrong_review") { value = gameState.quizSolved; total = Math.max(gameState.wrongQueue.length, 1); label = "오답노트"; }

    const progressRaw = total > 0 ? (value / total) * 100 : 0;
    const progress = Math.min(Number.isFinite(progressRaw) ? progressRaw : 0, 100);
    UI.progressFill.style.width = `${progress}%`;
    UI.progressPercent.textContent = `${Math.round(progress)}%`;
    UI.progressText.textContent = label;
    UI.progressWrap.setAttribute("aria-valuenow", String(Math.round(progress)));

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
    let pool = [];
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
    const tag = ev.category ? `<div class="category-tag" style="font-weight:bold; color:var(--primary); margin-bottom:5px;">[${ev.category}] ${ev.part || ""}</div>` : "";
    const metaRow = meta.length ? `<div class="meta-row" style="margin-bottom:15px;">${meta.map(m => `<div class="meta-chip" style="display:inline-block; margin-right:8px; font-size:12px; color:var(--muted); background:var(--soft); padding:2px 6px; border-radius:4px;">${escapeHtml(m)}</div>`).join("")}</div>` : "";

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
}
function initSurvival() {
    resetStateForMode();
    gameState.mode = "survival"; gameState.quizCategory = null;
    showCoreUI(); UI.logBar.innerHTML = "";
    addLog("듀티가 시작되었습니다. 첫 판단부터 중요합니다.", "log-important");
    renderSurvivalEvent("intro");
}
function renderSurvivalEvent(eventId) {
    let ev;
    if (eventId === "intro") {
        ev = { baseId: "intro", category: "", title: "듀티의 시작", emoji: "🏥",
            desc: "병동 문이 열리고 특유의 긴장감이 밀려옵니다.",
            choices: [
                { text: "심호흡하고 인계 핵심부터 정리한다", correct: true, effect: { hp: -4, rep: 6 }, log: "기본기부터 챙겼습니다.", next: "random_hub" },
                { text: "물품부터 챙긴다", effect: { hp: -2, rep: 2, item: "토니켓" }, log: "준비성이 좋습니다.", next: "random_hub" },
            ] };
    } else {
        const clinical = Math.random() < 0.9;
        ev = clinical ? generateClinicalEventByCategory(null) : pick([
            { baseId: "rest", title: "휴식", emoji: "☕", desc: "잠깐 쉴 틈이 생겼습니다.",
              choices: [
                  { text: "물 마시기", correct: true, effect: { hp: 15, rep: 0 }, log: "체력을 회복했습니다." },
                  { text: "스트레칭", effect: { hp: 10, rep: 2 }, log: "몸이 풀립니다." }
              ] }
        ]);
        gameState.eventCount += 1;
    }
    renderSceneCard(ev, { mode: "survival", meta: [`난이도: ${gameState.currentShift}`, `누적: ${gameState.eventCount}건`, `콤보: ${gameState.combo}`] });
}
function applyChoiceEffect(choice) {
    if (!choice.effect) return;
    let hpDelta = choice.effect.hp || 0;
    if (hpDelta < 0) hpDelta = Math.round(hpDelta * gameState.difficulty);
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
        <span class="scene-emoji">📖</span>
        <h2 class="scene-title">국가고시 8과목 트레이닝</h2>
        <p class="scene-desc">숫자와 상황이 계속 변하는 무한 랜덤 4지선다 문제를 제공합니다.\n트레이닝 모드에서는 체력이 감소하지 않습니다.</p>
        <div class="choice-list">
          ${CATEGORIES.map(c => `<button class="choice-btn primary" onclick="startQuiz('${c}')">${c}</button>`).join("")}
          <button class="choice-btn center" onclick="returnToMenu()">메인 메뉴</button>
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
        <span class="scene-emoji">📊</span>
        <h2 class="scene-title">${title}</h2>
        <p class="scene-desc">총 ${total}문제 중 ${answered}문제 응답 / 정답 ${correct} (정답률 ${acc}%)</p>
        <div class="choice-list">
          <button class="choice-btn primary" onclick="startMockExam()">한 번 더</button>
          <button class="choice-btn" onclick="reviewWrongAnswers()">오답 복습</button>
          <button class="choice-btn center" onclick="returnToMenu()">메인 메뉴</button>
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
        <span class="scene-emoji">🎯</span>
        <h2 class="scene-title">일일 챌린지 완료</h2>
        <p class="scene-desc">정답 ${correct}/${DAILY_CHALLENGE_TOTAL}\n오늘의 도전을 마쳤습니다. 내일 다시 도전하세요!</p>
        <div class="choice-list">
          <button class="choice-btn primary" onclick="returnToMenu()">메뉴로</button>
        </div>
      </div>`;
}

// =========================================================================
// 오답노트 복습
// =========================================================================
function reviewWrongAnswers() {
    resetStateForMode();
    gameState.mode = "wrong_review";
    gameState.wrongQueue = Storage.getWrongQueue();
    if (gameState.wrongQueue.length === 0) {
        UI.gameArea.innerHTML = `
          <div class="scene-card card">
            <span class="scene-emoji">📭</span>
            <h2 class="scene-title">오답노트가 비었습니다</h2>
            <p class="scene-desc">아직 저장된 오답이 없어요. 트레이닝/모의고사에서 문제를 풀면 자동으로 쌓입니다.</p>
            <div class="choice-list">
              <button class="choice-btn primary" onclick="returnToMenu()">메인 메뉴</button>
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
            <span class="scene-emoji">🎉</span>
            <h2 class="scene-title">오답을 모두 복습했습니다</h2>
            <p class="scene-desc">정답 ${gameState.quizCorrect} / 다시 오답 ${gameState.quizWrong}</p>
            <div class="choice-list">
              <button class="choice-btn primary" onclick="returnToMenu()">메인 메뉴</button>
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
        if (id) Storage.removeWrongById(id);
    } else {
        gameState.quizWrong += 1; resetCombo(); Sound.wrong();
        const item = gameState.wrongQueue.shift();
        gameState.wrongQueue.push(item);
    }
    updateStats();
    renderFeedback(ev, choice, { onNext: () => renderNextWrongQuestion() });
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
            <div style="min-width:120px;">
              <div class="cat-name">${cat}</div>
              <div class="cat-stats">${s.correct}/${s.solved} · ${acc}%</div>
            </div>
            <div class="mini-bar"><div class="mini-bar-fill" style="width:${acc}%"></div></div>
          </div>`;
    }).join("");
    const wrongCount = data.wrongQueue.length;
    const todayDaily = data.daily[todayKey()];
    const dailyMsg = todayDaily?.completed ? `오늘 완료 (${todayDaily.correct}/${DAILY_CHALLENGE_TOTAL})` : "오늘 미완료";

    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <span class="scene-emoji">📊</span>
        <h2 class="scene-title">학습 대시보드</h2>
        <p class="scene-desc">과목별 정답률과 누적 성과를 확인할 수 있습니다.</p>
        <div class="dashboard-grid">${rows}</div>
        <hr style="margin: 16px 0; border: 1px solid var(--border);">
        <p class="scene-desc" style="margin:0;">
          🔥 최고 콤보: <strong>${data.bestCombo}</strong> · 🏆 모의고사 최고점: <strong>${data.mockBest}</strong> · 📝 오답: <strong>${wrongCount}</strong>건 · 🎯 ${dailyMsg}
        </p>
        <div class="choice-list" style="margin-top: 16px;">
          <button class="choice-btn primary" onclick="reviewWrongAnswers()">오답 복습 (${wrongCount})</button>
          <button class="choice-btn" onclick="confirmClearStats()">통계 초기화</button>
          <button class="choice-btn center" onclick="returnToMenu()">메인 메뉴</button>
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
        <span class="scene-emoji">🏥</span>
        <h2>간호사 시뮬레이터</h2>
        <p style="color: var(--muted); font-size: 0.9rem; margin-bottom: 20px;">당신의 임상 판단력을 테스트하세요.</p>
        <div style="margin-bottom: 16px;">
          <button class="shift-option ${gameState.currentShift === 'Day' ? 'active' : ''}" onclick="setShift('Day', 1.0, this)">Day (기본)</button>
          <button class="shift-option ${gameState.currentShift === 'Evening' ? 'active' : ''}" onclick="setShift('Evening', 1.2, this)">Evening (어려움)</button>
          <button class="shift-option ${gameState.currentShift === 'Night' ? 'active' : ''}" onclick="setShift('Night', 1.5, this)">Night (지옥)</button>
        </div>
        <button class="choice-btn primary" onclick="initSurvival()">실전 듀티 시작</button>
        <button class="choice-btn" onclick="renderQuizMenu()">트레이닝 센터 (8과목)</button>
        <button class="choice-btn" onclick="startMockExam()">📝 모의고사 (${MOCK_EXAM_TOTAL}문제 · ${MOCK_EXAM_SECONDS / 60}분)</button>
        <button class="choice-btn" onclick="startDailyChallenge()">🎯 일일 챌린지 ${dailyDone ? "(오늘 완료)" : ""}</button>
        <button class="choice-btn" onclick="reviewWrongAnswers()">📝 오답노트 (${wrongCount})</button>
        <button class="choice-btn subtle center" onclick="renderDashboard()">📊 학습 대시보드</button>
        <p style="margin-top: 16px; font-size: 11px; color: var(--muted);">
          <span class="kbd-hint">1</span><span class="kbd-hint">2</span><span class="kbd-hint">3</span><span class="kbd-hint">4</span> 보기 선택 ·
          <span class="kbd-hint">Space</span> 다음 ·
          <span class="kbd-hint">T</span> 테마 ·
          <span class="kbd-hint">M</span> 사운드 ·
          <span class="kbd-hint">ESC</span> 모달 닫기
        </p>
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
    returnToMenu();
}

if (typeof window !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
}

// Node 환경 (테스트)에서 일부 헬퍼를 노출
if (typeof module !== "undefined" && module.exports) {
    module.exports = { dailySeed, todayKey, clamp, escapeHtml };
}
