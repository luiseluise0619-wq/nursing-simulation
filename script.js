// =========================================================================
// 간호사 시뮬레이터 — 메인 게임 로직
// 의존: questions.js (window.NurseQuestions)
// =========================================================================

const MAX_PROGRESS_EVENTS = 20;
const MAX_LOG_ENTRIES = 50;
const RECENT_HISTORY_SIZE = 50;
const MOCK_EXAM_TOTAL = 30;
const MOCK_EXAM_SECONDS = 30 * 60;
const DAILY_CHALLENGE_TOTAL = 10;
const STORAGE_KEY = "nurseSim:v1";
const APP_VERSION = "1.1.0-beta";

// 분석 (Plausible) — 익명·쿠키리스·GDPR/PIPA 준수.
// 배포 도메인을 여기 1줄 입력하면 자동 활성화. 비워두면 완전 no-op (외부 호출 0).
const ANALYTICS_DOMAIN = ""; // 예: "luiseluise0619-wq.github.io"
function initAnalytics() {
    if (!ANALYTICS_DOMAIN) return; // 미설정 시 외부 호출 0
    try {
        const s = document.createElement("script");
        s.defer = true;
        s.dataset.domain = ANALYTICS_DOMAIN;
        s.src = "https://plausible.io/js/script.js";
        document.head.appendChild(s);
        window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
    } catch { /* 분석 실패는 앱 동작에 영향 없음 */ }
}
// 익명 이벤트 추적 — Plausible 미로드 시 안전 no-op
function track(event, props) {
    try {
        if (typeof window !== "undefined" && typeof window.plausible === "function") {
            window.plausible(event, props ? { props } : undefined);
        }
    } catch { /* no-op */ }
}

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
/**
 * 숫자 범위 제한 (low ≤ n ≤ high)
 * @param {number} n
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
function clamp(n, lo, hi) { return Math.min(Math.max(n, lo), hi); }

/**
 * 배열에서 무작위 요소 선택 (빈 배열 시 undefined)
 * @template T
 * @param {T[]} arr
 * @returns {T|undefined}
 */
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/**
 * Fisher-Yates 셔플 (원본 보존, 새 배열 반환)
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** 오늘 날짜 키 (YYYY-MM-DD)
 * @returns {string}
 */
function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** N일 offset 날짜 키
 * @param {number} days
 * @returns {string}
 */
function dateKeyOffset(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** HTML 안전 이스케이프 (XSS 방지)
 * @param {string|number|null|undefined} s
 * @returns {string}
 */
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** 스크린리더 announcer — 상태 전환 시 호출 (접근성 WCAG 4.1.3)
 * @param {string} message
 */
function srAnnounce(message) {
    try {
        const el = document.getElementById("sr-announcer");
        if (!el) return;
        // 같은 메시지가 연속이면 빈 칸 → 다시 (aria-live 재발화)
        el.textContent = "";
        setTimeout(() => { el.textContent = String(message).slice(0, 200); }, 50);
    } catch {}
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
    // v1.1 신규 (25건)
    { pattern: /FiO2|비강캐뉼라.*4L|벤츄리|NRB/i,            source: "AARC Clinical Practice Guideline (산소요법)" },
    { pattern: /CAUTI|도뇨주머니.*방광.*아래|유치도뇨/i,      source: "CDC Guidelines for CAUTI Prevention" },
    { pattern: /비위관.*X-ray|NG tube.*위치 확인/i,           source: "ANA Best Practice: NG Tube Verification" },
    { pattern: /욕창.*Stage|하이드로콜로이드|체위변경.*2시간/i, source: "NPUAP/EPUAP/PPPIA 욕창 가이드 (2019)" },
    { pattern: /신체보호대|restraint.*2시간|이중 잠금/i,      source: "AHRQ Restraint Guidelines" },
    { pattern: /Lochia|오로.*rubra|오로.*serosa|오로.*alba/i, source: "AWHONN Postpartum Assessment" },
    { pattern: /deep latch|유륜.*깊게|모유수유.*자세/i,       source: "WHO/UNICEF 모유수유 가이드" },
    { pattern: /Berg Balance|낙상.*고위험|보행기 동반/i,      source: "AGS/BGS Fall Prevention" },
    { pattern: /발달이정표|영유아.*사회적 미소|옹알이/i,      source: "CDC Developmental Milestones" },
    { pattern: /열성경련.*측위|febrile seizure.*기도 확보/i,  source: "AAP Febrile Seizure Clinical Practice" },
    { pattern: /ORS.*경구수액|소아.*20ml\/kg.*bolus/i,        source: "AAP/WHO Pediatric Dehydration" },
    { pattern: /자살.*직접.*질문|자살 사고 평가/i,            source: "AFSP/SPRC Suicide Risk Assessment" },
    { pattern: /NMS|신경이완제.*악성증후군|dantrolene/i,      source: "APA/UpToDate NMS Management" },
    { pattern: /진전섬망|Delirium Tremens|DT.*벤조|CIWA/i,    source: "SAMHSA TIP 45 / CIWA-Ar" },
    { pattern: /1급 감염병.*즉시 신고|감염병.*신고기한/i,    source: "감염병의 예방 및 관리에 관한 법률" },
    { pattern: /마약.*이중 잠금|마약.*분리 보관/i,           source: "마약류 관리에 관한 법률 시행규칙" },
    { pattern: /정신건강복지법|보호의무자.*2인|행정입원/i,    source: "정신건강증진 및 정신질환자 복지서비스 지원에 관한 법률" },
    { pattern: /헌혈.*8주|전혈.*채혈.*간격/i,                source: "혈액관리법 시행규칙" },
    { pattern: /의료법.*30개.*병상|병원.*30 병상/i,          source: "의료법 시행규칙 (의료기관 종별)" },
    { pattern: /Thomas-Kilmann|협력형|독재형|민주형|자유방임형/i, source: "Thomas-Kilmann Conflict Mode Instrument" },
    { pattern: /위임.*5권리|right task|right person/i,        source: "NCSBN Delegation Five Rights" },
    { pattern: /적신호 사건|sentinel event/i,                 source: "The Joint Commission Sentinel Event Policy" },
    { pattern: /PDCA|Deming Cycle|Six Sigma|RCA/i,            source: "Deming / Joint Commission QI Methods" },
    { pattern: /FAST.*Face.*Arm.*Speech|뇌졸중.*신속 사정/i,   source: "AHA/ASA Stroke Pre-hospital (FAST)" },
    { pattern: /KDIGO|AKI 1단계|GFR.*15|CKD 단계/i,           source: "KDIGO Clinical Practice Guideline (AKI/CKD)" },
    { pattern: /air leak|water seal.*거품|흉관 배액/i,        source: "AACN Critical Care: Chest Tube Management" },
    { pattern: /croup|epiglottitis|bronchiolitis|RSV/i,        source: "AAP Pediatric Respiratory Emergencies" },
    { pattern: /Leitner|박스.*승급|간격 반복 학습/i,         source: "Leitner (1972) Spaced Repetition System" },
    { pattern: /Naloxone|마약.*해독|opioid.*반전/i,           source: "SAMHSA Opioid Overdose Reversal" },
    { pattern: /VTE.*예방|TED.*스타킹|enoxaparin.*피하/i,     source: "ACCP CHEST VTE Prevention Guidelines" },
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
        resultsEl.innerHTML = `<div class="search-empty">
          <div class="empty-state-illust">${EMPTY_ILLUST.searchEmpty}</div>
          "${escapeHtml(q)}" 결과 없음
        </div>`;
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
    practice:   '<svg class="mc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9 10 l3 -3 l3 3 M12 7 v10"/></svg>',
    sim:        '<svg class="mc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7 a2 2 0 0 1 2 -2 h14 a2 2 0 0 1 2 2 v10 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 z"/><path d="M10 10 l4 2 l-4 2 z" fill="currentColor"/></svg>',
    drills:     '<svg class="mc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><path d="M12 2 v3 M12 19 v3 M2 12 h3 M19 12 h3"/></svg>',
};

// =========================================================================
// 임상 시각 자료 (CLINICAL_SVG) — 외부 자원 0, 모두 자체 제작 SVG
// 텍스트만으로 학습 어려운 영역: ECG / 욕창 / 체위 / 화상 / 태아심음 / 동공
// =========================================================================
function ecgStrip(pattern) {
    const W = 600, H = 110, cy = 55;
    // 의료용 핑크 그리드 (large=100, small=20)
    let grids = `<rect width="${W}" height="${H}" fill="#fff8f8"/>`;
    for (let x = 0; x <= W; x += 20) grids += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${x%100===0?'#f4a8a8':'#fbdada'}" stroke-width="${x%100===0?0.7:0.35}"/>`;
    for (let y = 0; y <= H; y += 20) grids += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${y%100===0?'#f4a8a8':'#fbdada'}" stroke-width="${y%100===0?0.7:0.35}"/>`;
    let d = `M 0 ${cy}`;
    if (pattern === "normal") {
        for (let i = 0; i < 4; i++) {
            const ox = 20 + i * 145;
            d += ` L ${ox} ${cy} L ${ox+8} ${cy-5} L ${ox+16} ${cy-7} L ${ox+24} ${cy-5} L ${ox+32} ${cy} L ${ox+50} ${cy} L ${ox+54} ${cy+4} L ${ox+57} ${cy-32} L ${ox+60} ${cy+12} L ${ox+64} ${cy} L ${ox+90} ${cy} L ${ox+105} ${cy-8} L ${ox+125} ${cy-9} L ${ox+140} ${cy}`;
        }
    } else if (pattern === "stemi") {
        for (let i = 0; i < 4; i++) {
            const ox = 20 + i * 145;
            d += ` L ${ox} ${cy} L ${ox+8} ${cy-4} L ${ox+16} ${cy-6} L ${ox+24} ${cy-4} L ${ox+32} ${cy} L ${ox+50} ${cy} L ${ox+54} ${cy+3} L ${ox+57} ${cy-30} L ${ox+60} ${cy+10} L ${ox+64} ${cy-10} L ${ox+85} ${cy-15} L ${ox+115} ${cy-15} L ${ox+125} ${cy-6} L ${ox+140} ${cy}`;
        }
    } else if (pattern === "vfib") {
        for (let x = 0; x <= W; x += 4) {
            const n = (Math.sin(x*0.45) + Math.sin(x*0.17) + Math.sin(x*0.33))*14;
            d += ` L ${x} ${cy+n}`;
        }
    } else if (pattern === "vtach") {
        for (let i = 0; i < 7; i++) {
            const ox = i * 90;
            d += ` L ${ox} ${cy} L ${ox+15} ${cy-32} L ${ox+32} ${cy+18} L ${ox+50} ${cy-6} L ${ox+90} ${cy}`;
        }
    } else if (pattern === "afib") {
        const peaks = [70, 175, 240, 360, 450, 565];
        let prev = 0;
        for (const px of peaks) {
            for (let x = prev; x < px - 10; x += 4) {
                const wob = Math.sin(x*0.32)*2 + Math.sin(x*0.71)*1.4;
                d += ` L ${x} ${cy+wob}`;
            }
            d += ` L ${px-4} ${cy+4} L ${px} ${cy-26} L ${px+4} ${cy+10} L ${px+8} ${cy}`;
            prev = px + 8;
        }
    } else if (pattern === "asystole") {
        d += ` L ${W} ${cy}`;
    } else if (pattern === "svt") {
        for (let i = 0; i < 10; i++) {
            const ox = i * 60;
            d += ` L ${ox} ${cy} L ${ox+8} ${cy-3} L ${ox+16} ${cy} L ${ox+22} ${cy+3} L ${ox+25} ${cy-28} L ${ox+28} ${cy+8} L ${ox+60} ${cy}`;
        }
    }
    return `<svg viewBox="0 0 ${W} ${H}" class="clinical-svg ecg-svg" role="img" aria-label="심전도 리듬 strip"><g>${grids}</g><path d="${d}" stroke="#1e293b" stroke-width="1.6" fill="none" stroke-linejoin="round"/></svg>`;
}

function pressureUlcerSvg(stage) {
    // 욕창 단면도 — stage 1~4
    const W = 320, H = 200;
    const skinY = 60;
    const layers = `
      <rect x="20" y="${skinY}" width="280" height="20" fill="#fce7d4" stroke="#cd9b7a" stroke-width="1"/>
      <rect x="20" y="${skinY+20}" width="280" height="30" fill="#f4d2b4" stroke="#cd9b7a" stroke-width="0.5"/>
      <rect x="20" y="${skinY+50}" width="280" height="40" fill="#f7e1c8" stroke="#cd9b7a" stroke-width="0.5"/>
      <rect x="20" y="${skinY+90}" width="280" height="20" fill="#e8d5b0" stroke="#a18063" stroke-width="0.5"/>
      <text x="6" y="${skinY+12}" font-size="9" fill="#64748b">표피</text>
      <text x="6" y="${skinY+38}" font-size="9" fill="#64748b">진피</text>
      <text x="6" y="${skinY+72}" font-size="9" fill="#64748b">피하</text>
      <text x="6" y="${skinY+102}" font-size="9" fill="#64748b">근막/뼈</text>
    `;
    let lesion = "";
    if (stage === 1) {
        lesion = `<ellipse cx="160" cy="${skinY+8}" rx="50" ry="6" fill="#e36b6b" opacity="0.7"/><text x="120" y="40" font-size="13" font-weight="700" fill="#c43030">Stage I — 비창백 발적</text>`;
    } else if (stage === 2) {
        lesion = `<path d="M 110 ${skinY} L 130 ${skinY+25} L 190 ${skinY+25} L 210 ${skinY} Z" fill="#f7c4c4" stroke="#c43030" stroke-width="1.2"/><text x="105" y="40" font-size="13" font-weight="700" fill="#c43030">Stage II — 부분층 손상</text>`;
    } else if (stage === 3) {
        lesion = `<path d="M 105 ${skinY} L 115 ${skinY+60} L 205 ${skinY+60} L 215 ${skinY} Z" fill="#9d3838" stroke="#5a1a1a" stroke-width="1.2"/><text x="95" y="40" font-size="13" font-weight="700" fill="#5a1a1a">Stage III — 전층 손상 (피하 노출)</text>`;
    } else if (stage === 4) {
        lesion = `<path d="M 100 ${skinY} L 110 ${skinY+105} L 210 ${skinY+105} L 220 ${skinY} Z" fill="#5a1a1a" stroke="#000" stroke-width="1.2"/><text x="90" y="40" font-size="13" font-weight="700" fill="#000">Stage IV — 근막·뼈·근육 노출</text>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" class="clinical-svg ulcer-svg" role="img" aria-label="욕창 ${stage}단계"><rect width="${W}" height="${H}" fill="#fefcfa"/>${layers}${lesion}</svg>`;
}

function positionSvg(name) {
    // 체위 — 인체 실루엣 + 자세
    const W = 320, H = 180;
    const bed = `<rect x="10" y="120" width="300" height="50" rx="6" fill="#e8efe9" stroke="#7fa881" stroke-width="1.2"/>`;
    let body = "", label = "";
    if (name === "fowler") {
        // 반좌위 45도
        body = `<path d="M 50 130 L 120 130 L 170 60 L 195 60 L 195 75 L 175 80 L 130 140 L 50 140 Z" fill="#a3c4a5" stroke="#5a7a5c"/><circle cx="200" cy="55" r="14" fill="#a3c4a5" stroke="#5a7a5c"/>`;
        label = `<text x="160" y="20" font-size="13" font-weight="700" text-anchor="middle" fill="#1e293b">Fowler's (반좌위 45~60°)</text>`;
    } else if (name === "sims") {
        // 좌측 심스위
        body = `<ellipse cx="80" cy="75" rx="16" ry="14" fill="#a3c4a5" stroke="#5a7a5c"/><path d="M 95 70 Q 170 65 230 95 Q 260 105 270 130 L 90 130 Q 90 110 95 70 Z" fill="#a3c4a5" stroke="#5a7a5c"/><path d="M 175 95 Q 200 60 230 75" fill="none" stroke="#5a7a5c" stroke-width="1.5"/>`;
        label = `<text x="160" y="20" font-size="13" font-weight="700" text-anchor="middle" fill="#1e293b">Sims' (좌측 심스위 — 관장 시)</text>`;
    } else if (name === "trendelenburg") {
        // 트렌델렌버그 — 머리 낮춤
        body = `<path d="M 50 130 L 50 110 L 270 80 L 270 95 L 50 130 Z" fill="#a3c4a5" stroke="#5a7a5c"/><circle cx="55" cy="125" r="14" fill="#a3c4a5" stroke="#5a7a5c"/>`;
        label = `<text x="160" y="20" font-size="13" font-weight="700" text-anchor="middle" fill="#1e293b">Trendelenburg (머리 낮춤 — 쇼크)</text>`;
    } else if (name === "lithotomy") {
        // 배횡와위
        body = `<ellipse cx="180" cy="125" rx="60" ry="14" fill="#a3c4a5" stroke="#5a7a5c"/><circle cx="120" cy="120" r="13" fill="#a3c4a5" stroke="#5a7a5c"/><path d="M 230 125 L 250 80 L 270 75" fill="none" stroke="#5a7a5c" stroke-width="6" stroke-linecap="round"/><path d="M 235 130 L 260 95 L 280 95" fill="none" stroke="#5a7a5c" stroke-width="6" stroke-linecap="round"/>`;
        label = `<text x="160" y="20" font-size="13" font-weight="700" text-anchor="middle" fill="#1e293b">Lithotomy (배횡와위 — 분만·도뇨)</text>`;
    } else if (name === "prone") {
        body = `<path d="M 50 110 L 270 110 L 270 130 L 50 130 Z" fill="#a3c4a5" stroke="#5a7a5c"/><circle cx="55" cy="120" r="13" fill="#a3c4a5" stroke="#5a7a5c"/><text x="160" y="100" font-size="9" fill="#5a7a5c" text-anchor="middle">엎드린 자세</text>`;
        label = `<text x="160" y="20" font-size="13" font-weight="700" text-anchor="middle" fill="#1e293b">Prone (복와위 — ARDS 산소화)</text>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" class="clinical-svg pos-svg" role="img" aria-label="체위 ${name}"><rect width="${W}" height="${H}" fill="#fafdfb"/>${label}${bed}${body}</svg>`;
}

function ruleOfNinesSvg() {
    // 성인 9의 법칙 — 인체 정면도 + 라벨
    const W = 320, H = 280;
    return `<svg viewBox="0 0 ${W} ${H}" class="clinical-svg burn-svg" role="img" aria-label="9의 법칙">
      <rect width="${W}" height="${H}" fill="#fefcf8"/>
      <text x="${W/2}" y="18" text-anchor="middle" font-size="14" font-weight="700" fill="#1e293b">성인 9의 법칙 (Rule of Nines)</text>
      <!-- 머리 9% -->
      <circle cx="160" cy="50" r="22" fill="#fcd9c1" stroke="#c97070"/>
      <text x="160" y="54" text-anchor="middle" font-size="11" font-weight="700">9%</text>
      <text x="160" y="38" text-anchor="middle" font-size="9" fill="#64748b">머리/목</text>
      <!-- 몸통 앞 18% -->
      <rect x="125" y="80" width="70" height="100" rx="6" fill="#fce6cc" stroke="#c97070"/>
      <text x="160" y="135" text-anchor="middle" font-size="11" font-weight="700">18%</text>
      <text x="160" y="148" text-anchor="middle" font-size="9" fill="#64748b">몸통 앞</text>
      <!-- 양팔 각 9% -->
      <rect x="80" y="80" width="35" height="100" rx="6" fill="#fcdcc1" stroke="#c97070"/>
      <text x="97" y="135" text-anchor="middle" font-size="10" font-weight="700">9%</text>
      <text x="97" y="148" text-anchor="middle" font-size="8" fill="#64748b">좌측 팔</text>
      <rect x="205" y="80" width="35" height="100" rx="6" fill="#fcdcc1" stroke="#c97070"/>
      <text x="222" y="135" text-anchor="middle" font-size="10" font-weight="700">9%</text>
      <text x="222" y="148" text-anchor="middle" font-size="8" fill="#64748b">우측 팔</text>
      <!-- 양다리 각 18% -->
      <rect x="125" y="185" width="32" height="80" rx="6" fill="#fce6cc" stroke="#c97070"/>
      <text x="141" y="225" text-anchor="middle" font-size="10" font-weight="700">18%</text>
      <text x="141" y="240" text-anchor="middle" font-size="8" fill="#64748b">좌측 다리</text>
      <rect x="163" y="185" width="32" height="80" rx="6" fill="#fce6cc" stroke="#c97070"/>
      <text x="179" y="225" text-anchor="middle" font-size="10" font-weight="700">18%</text>
      <text x="179" y="240" text-anchor="middle" font-size="8" fill="#64748b">우측 다리</text>
      <!-- 회음부 1% -->
      <rect x="155" y="180" width="10" height="8" fill="#c97070"/>
      <text x="240" y="200" font-size="9" fill="#64748b">회음부 1%</text>
    </svg>`;
}

function fhrSvg(pattern) {
    // 태아심음 + 자궁수축 — 두 줄 그래프
    const W = 600, H = 180, fhrY = 50, ucY = 140;
    let grid = `<rect width="${W}" height="${H}" fill="#fff8f8"/>`;
    for (let x = 0; x <= W; x += 30) grid += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#fbdada" stroke-width="0.4"/>`;
    grid += `<text x="6" y="${fhrY-30}" font-size="9" fill="#64748b">FHR 240</text><text x="6" y="${fhrY+30}" font-size="9" fill="#64748b">100</text>`;
    grid += `<text x="6" y="${ucY-20}" font-size="9" fill="#64748b">UC</text>`;
    grid += `<line x1="0" y1="${fhrY}" x2="${W}" y2="${fhrY}" stroke="#94a3b8" stroke-width="0.4" stroke-dasharray="4 3"/>`;
    grid += `<line x1="0" y1="${ucY}" x2="${W}" y2="${ucY}" stroke="#94a3b8" stroke-width="0.4"/>`;
    let fhr = `M 0 ${fhrY}`;
    let uc = `M 0 ${ucY}`;
    const contractionPeaks = [120, 320, 520];
    for (let x = 0; x <= W; x += 6) {
        // 자궁수축 (3회)
        let uVal = 0;
        for (const p of contractionPeaks) uVal += Math.max(0, 28 - Math.abs(x-p)*0.5);
        uc += ` L ${x} ${ucY - Math.min(uVal, 40)}`;
        // FHR — pattern 별
        let fVal = 0;
        if (pattern === "early") {
            // 자궁수축과 동시 감속 — 거울상
            for (const p of contractionPeaks) fVal += Math.max(0, 22 - Math.abs(x-p)*0.45);
        } else if (pattern === "late") {
            // 자궁수축 정점 이후 감속 (15~30초 시차)
            for (const p of contractionPeaks) fVal += Math.max(0, 25 - Math.abs(x-(p+40))*0.45);
        } else if (pattern === "variable") {
            // V자형, 시점 불규칙
            const varPeaks = [100, 230, 410, 540];
            for (const p of varPeaks) fVal += Math.max(0, 35 - Math.abs(x-p)*0.7);
        } else {
            // normal — 부드러운 변동
            fVal = -3 + Math.sin(x*0.06)*4 + Math.sin(x*0.12)*2;
        }
        fhr += ` L ${x} ${fhrY + fVal + Math.sin(x*0.4)*0.8}`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" class="clinical-svg fhr-svg" role="img" aria-label="태아심음·자궁수축 strip">${grid}<path d="${fhr}" stroke="#1e293b" stroke-width="1.5" fill="none"/><path d="${uc}" stroke="#5a7a5c" stroke-width="1.5" fill="none"/></svg>`;
}

function pupilSvg(left, right) {
    // 동공 비교 — left/right 직경(mm) + 반응 가능 시 광 반사
    const W = 280, H = 130;
    const scale = 4; // 1mm = 4px
    return `<svg viewBox="0 0 ${W} ${H}" class="clinical-svg pupil-svg" role="img" aria-label="동공 사정"><rect width="${W}" height="${H}" fill="#fafdfb"/>
      <text x="${W/2}" y="20" text-anchor="middle" font-size="13" font-weight="700" fill="#1e293b">동공 사정</text>
      <g transform="translate(75,75)">
        <text x="0" y="-35" text-anchor="middle" font-size="11" fill="#64748b">좌안</text>
        <circle r="28" fill="#fef9f3" stroke="#94a3b8" stroke-width="1.2"/>
        <circle r="22" fill="#fff" stroke="#94a3b8" stroke-width="0.6"/>
        <circle r="${left*scale}" fill="#000"/>
        <text x="0" y="48" text-anchor="middle" font-size="12" font-weight="700">${left}mm</text>
      </g>
      <g transform="translate(205,75)">
        <text x="0" y="-35" text-anchor="middle" font-size="11" fill="#64748b">우안</text>
        <circle r="28" fill="#fef9f3" stroke="#94a3b8" stroke-width="1.2"/>
        <circle r="22" fill="#fff" stroke="#94a3b8" stroke-width="0.6"/>
        <circle r="${right*scale}" fill="#000"/>
        <text x="0" y="48" text-anchor="middle" font-size="12" font-weight="700">${right}mm</text>
      </g>
    </svg>`;
}

function gcsTableSvg(highlight) {
    // highlight: "E4V5M6" 등 — 해당 칸을 강조
    const W = 360, H = 220;
    const cellW = 50, cellH = 24, x0 = 90, y0 = 50;
    const rows = [
        { label: "Eye (E)", code: "E", values: ["1:없음", "2:통증", "3:음성", "4:자발"] },
        { label: "Verbal (V)", code: "V", values: ["1:없음", "2:이해X", "3:부적절", "4:혼동", "5:정상"] },
        { label: "Motor (M)", code: "M", values: ["1:없음", "2:신전", "3:굴곡", "4:회피", "5:국재화", "6:명령수행"] },
    ];
    const hi = {};
    if (highlight) {
        for (const m of highlight.matchAll(/([EVM])(\d)/g)) hi[m[1]] = parseInt(m[2]);
    }
    let svg = `<rect width="${W}" height="${H}" fill="#fefcfa"/>
      <text x="${W/2}" y="22" text-anchor="middle" font-size="14" font-weight="700" fill="#1e293b">Glasgow Coma Scale (GCS)</text>
      <text x="${W/2}" y="38" text-anchor="middle" font-size="10" fill="#64748b">3~15점 · 8 이하 = 중증 의식 저하</text>`;
    rows.forEach((row, ri) => {
        const y = y0 + ri * (cellH + 6);
        svg += `<text x="6" y="${y + cellH * 0.7}" font-size="11" font-weight="600" fill="#1e293b">${row.label}</text>`;
        row.values.forEach((v, vi) => {
            const cellX = x0 + vi * cellW;
            const score = parseInt(v.split(":")[0]);
            const isHi = hi[row.code] === score;
            svg += `<rect x="${cellX}" y="${y}" width="${cellW - 2}" height="${cellH}" rx="3"
              fill="${isHi ? '#7fa881' : '#fff'}" stroke="${isHi ? '#5a7a5c' : '#cbd5e1'}" stroke-width="${isHi ? 2 : 1}"/>
              <text x="${cellX + cellW/2 - 1}" y="${y + cellH * 0.7}" text-anchor="middle" font-size="10"
              font-weight="${isHi ? 700 : 400}" fill="${isHi ? '#fff' : '#1e293b'}">${v}</text>`;
        });
    });
    if (highlight) {
        const total = (hi.E || 0) + (hi.V || 0) + (hi.M || 0);
        svg += `<text x="${W/2}" y="${H - 14}" text-anchor="middle" font-size="13" font-weight="700" fill="#7fa881">총 점수: ${highlight} = ${total}점</text>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" class="clinical-svg gcs-svg" role="img" aria-label="GCS 점수표">${svg}</svg>`;
}

function aedPadSvg(target) {
    // target: "adult" | "child"
    const W = 280, H = 220;
    const head = target === "child" ? 28 : 24;
    const bodyW = target === "child" ? 90 : 110;
    const bodyH = target === "child" ? 110 : 130;
    const cx = W/2;
    let pads = "";
    if (target === "adult") {
        // 우상 흉골 + 좌측 흉부 외측
        pads = `<rect x="${cx - 45}" y="65" width="36" height="48" rx="6" fill="#fff5d4" stroke="#c9a25b" stroke-width="2"/>
                <text x="${cx - 27}" y="93" text-anchor="middle" font-size="9" font-weight="700">우상</text>
                <rect x="${cx + 18}" y="120" width="36" height="48" rx="6" fill="#fff5d4" stroke="#c9a25b" stroke-width="2"/>
                <text x="${cx + 36}" y="148" text-anchor="middle" font-size="9" font-weight="700">좌측</text>`;
    } else {
        // 소아 — 앞 가슴 + 뒤 (anterior-posterior) 시각화는 어려우니 표준 텍스트
        pads = `<rect x="${cx - 18}" y="80" width="36" height="40" rx="6" fill="#fff5d4" stroke="#c9a25b" stroke-width="2"/>
                <text x="${cx}" y="103" text-anchor="middle" font-size="9" font-weight="700">앞가슴</text>
                <text x="${cx}" y="200" text-anchor="middle" font-size="10" fill="#64748b">+ 등 (Anterior-Posterior 배치)</text>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" class="clinical-svg aed-svg" role="img" aria-label="AED 패드 위치">
      <rect width="${W}" height="${H}" fill="#fafdfb"/>
      <text x="${W/2}" y="22" text-anchor="middle" font-size="14" font-weight="700" fill="#1e293b">AED 패드 위치 — ${target === "child" ? "소아 (8세 미만)" : "성인"}</text>
      <circle cx="${cx}" cy="50" r="${head}" fill="#fce6cc" stroke="#94a3b8" stroke-width="1.2"/>
      <rect x="${cx - bodyW/2}" y="55" width="${bodyW}" height="${bodyH}" rx="14" fill="#fce6cc" stroke="#94a3b8" stroke-width="1.2"/>
      <line x1="${cx}" y1="65" x2="${cx}" y2="${55 + bodyH}" stroke="#94a3b8" stroke-width="0.5" stroke-dasharray="3 3"/>
      ${pads}
    </svg>`;
}

function fundalHeightSvg(weeks) {
    // 자궁저부 높이 — 12 (치골결합), 16 (치골과 배꼽 사이), 20 (배꼽), 24~36 (배꼽 위로 올라감)
    const W = 280, H = 280;
    // 배꼽 = y 130, 치골 = y 220
    const umbilicus = 130, pubis = 220;
    let topY;
    if (weeks <= 12) topY = pubis - 5;
    else if (weeks <= 20) topY = pubis - ((weeks - 12) / 8) * (pubis - umbilicus);
    else topY = umbilicus - ((weeks - 20) / 16) * 90;
    topY = Math.max(40, topY);
    return `<svg viewBox="0 0 ${W} ${H}" class="clinical-svg fundal-svg" role="img" aria-label="임신 ${weeks}주 자궁저부 높이">
      <rect width="${W}" height="${H}" fill="#fafdfb"/>
      <text x="${W/2}" y="22" text-anchor="middle" font-size="14" font-weight="700" fill="#1e293b">자궁저부 높이 — 임신 ${weeks}주</text>
      <!-- 인체 윤곽 -->
      <ellipse cx="${W/2}" cy="${H/2 + 20}" rx="60" ry="120" fill="#fcd9c1" stroke="#a18063" stroke-width="1.2"/>
      <!-- 배꼽 -->
      <circle cx="${W/2}" cy="${umbilicus}" r="3" fill="#a18063"/>
      <text x="${W/2 + 90}" y="${umbilicus + 3}" font-size="11" fill="#64748b">배꼽 (20주)</text>
      <!-- 치골결합 -->
      <line x1="${W/2 - 30}" y1="${pubis}" x2="${W/2 + 30}" y2="${pubis}" stroke="#a18063" stroke-width="3"/>
      <text x="${W/2 + 90}" y="${pubis + 4}" font-size="11" fill="#64748b">치골 (12주)</text>
      <!-- 자궁 -->
      <ellipse cx="${W/2}" cy="${(topY + pubis)/2}" rx="40" ry="${(pubis - topY)/2}" fill="#a3c4a5" stroke="#5a7a5c" stroke-width="1.5" opacity="0.85"/>
      <!-- 자궁저부 표시 -->
      <line x1="${W/2 - 50}" y1="${topY}" x2="${W/2 + 50}" y2="${topY}" stroke="#c97070" stroke-width="2" stroke-dasharray="5 3"/>
      <text x="${W/2 + 90}" y="${topY + 3}" font-size="11" font-weight="700" fill="#c97070">${weeks}주 저부</text>
    </svg>`;
}

function apgarTableSvg(scores) {
    // scores: {appearance, pulse, grimace, activity, respiration} — 각 0~2점
    const W = 380, H = 200;
    const items = [
        { key: "appearance", label: "외모 (피부색)", v0: "전신 청색", v1: "사지 청색", v2: "분홍" },
        { key: "pulse", label: "맥박 (HR)", v0: "없음", v1: "<100", v2: "≥100" },
        { key: "grimace", label: "찡그림 (자극반응)", v0: "없음", v1: "찡그림", v2: "기침/재채기" },
        { key: "activity", label: "근긴장도", v0: "없음", v1: "약간", v2: "활발" },
        { key: "respiration", label: "호흡", v0: "없음", v1: "느림·불규칙", v2: "강함·울음" },
    ];
    const cellW = 78, cellH = 22, x0 = 130, y0 = 50;
    let svg = `<rect width="${W}" height="${H}" fill="#fefcfa"/>
      <text x="${W/2}" y="22" text-anchor="middle" font-size="14" font-weight="700" fill="#1e293b">Apgar Score</text>
      <text x="${x0 + cellW/2}" y="42" text-anchor="middle" font-size="10" font-weight="600" fill="#64748b">0점</text>
      <text x="${x0 + cellW*1.5}" y="42" text-anchor="middle" font-size="10" font-weight="600" fill="#64748b">1점</text>
      <text x="${x0 + cellW*2.5}" y="42" text-anchor="middle" font-size="10" font-weight="600" fill="#64748b">2점</text>`;
    items.forEach((it, i) => {
        const y = y0 + i * (cellH + 4);
        svg += `<text x="6" y="${y + cellH * 0.7}" font-size="10" font-weight="600" fill="#1e293b">${it.label}</text>`;
        [0, 1, 2].forEach(score => {
            const cellX = x0 + score * cellW;
            const isHi = scores && scores[it.key] === score;
            svg += `<rect x="${cellX}" y="${y}" width="${cellW - 4}" height="${cellH}" rx="3"
                fill="${isHi ? '#7fa881' : '#fff'}" stroke="${isHi ? '#5a7a5c' : '#cbd5e1'}" stroke-width="${isHi ? 2 : 1}"/>
                <text x="${cellX + cellW/2 - 2}" y="${y + cellH * 0.7}" text-anchor="middle" font-size="9"
                font-weight="${isHi ? 700 : 400}" fill="${isHi ? '#fff' : '#1e293b'}">${it['v' + score]}</text>`;
        });
    });
    if (scores) {
        const total = Object.values(scores).reduce((a, b) => a + b, 0);
        svg += `<text x="${W/2}" y="${H - 14}" text-anchor="middle" font-size="13" font-weight="700" fill="#7fa881">총 점수: ${total}점</text>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" class="clinical-svg apgar-svg" role="img" aria-label="Apgar 점수표">${svg}</svg>`;
}

function auscultationSvg(pattern) {
    // pattern: "normal" | "wheeze-lower" | "crackle-lower" | "stridor-upper" | "wheeze-diffuse"
    const W = 280, H = 240;
    const zones = [
        { id: "RU", cx: 92, cy: 100, label: "RUL" },
        { id: "LU", cx: 188, cy: 100, label: "LUL" },
        { id: "RL", cx: 92, cy: 170, label: "RLL" },
        { id: "LL", cx: 188, cy: 170, label: "LLL" },
    ];
    const colorMap = { normal: "#a3c4a5", abnormal: "#c97070", warn: "#c9a25b" };
    function colorFor(zoneId) {
        if (pattern === "normal") return colorMap.normal;
        if (pattern === "wheeze-lower" && (zoneId === "RL" || zoneId === "LL")) return colorMap.abnormal;
        if (pattern === "crackle-lower" && (zoneId === "RL" || zoneId === "LL")) return colorMap.warn;
        if (pattern === "stridor-upper" && (zoneId === "RU" || zoneId === "LU")) return colorMap.abnormal;
        if (pattern === "wheeze-diffuse") return colorMap.abnormal;
        return colorMap.normal;
    }
    const titles = {
        normal: "정상 — 모든 zone 청정음",
        "wheeze-lower": "하부 wheeze — 천식·기관지수축",
        "crackle-lower": "하부 crackle — 폐부종·폐렴",
        "stridor-upper": "상부 stridor — 후두부종·기도폐쇄",
        "wheeze-diffuse": "전반적 wheeze — 중증 천식·과민반응",
    };
    let zoneSvg = "";
    zones.forEach(z => {
        const c = colorFor(z.id);
        zoneSvg += `<circle cx="${z.cx}" cy="${z.cy}" r="22" fill="${c}" stroke="#5a7a5c" stroke-width="1.5" opacity="0.85"/>
                    <text x="${z.cx}" y="${z.cy + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">${z.label}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" class="clinical-svg ausc-svg" role="img" aria-label="흉부 청진 위치">
      <rect width="${W}" height="${H}" fill="#fafdfb"/>
      <text x="${W/2}" y="22" text-anchor="middle" font-size="13" font-weight="700" fill="#1e293b">${titles[pattern] || "흉부 청진"}</text>
      <!-- 흉부 윤곽 -->
      <path d="M 60 70 Q 60 50 90 50 L 190 50 Q 220 50 220 70 L 220 200 Q 220 220 200 220 L 80 220 Q 60 220 60 200 Z" fill="#fce6cc" stroke="#a18063" stroke-width="1.5"/>
      <!-- 정중선 -->
      <line x1="${W/2}" y1="55" x2="${W/2}" y2="220" stroke="#a18063" stroke-width="0.6" stroke-dasharray="3 3"/>
      <!-- 청진 zones -->
      ${zoneSvg}
      <!-- 범례 -->
      <text x="20" y="${H - 10}" font-size="9" fill="#5a7a5c">● 정상</text>
      <text x="80" y="${H - 10}" font-size="9" fill="#c9a25b">● 약한 이상음</text>
      <text x="180" y="${H - 10}" font-size="9" fill="#c97070">● 명백한 이상음</text>
    </svg>`;
}

function kramerZoneSvg(zone) {
    // zone: 1~5 (신생아 황달 진행 영역)
    const W = 220, H = 280;
    const zoneInfo = [
        { z: 1, label: "Zone 1: 머리·목", bili: "<6 mg/dL" },
        { z: 2, label: "Zone 2: 가슴·상복부", bili: "6~9" },
        { z: 3, label: "Zone 3: 하복부·허벅지", bili: "9~12" },
        { z: 4, label: "Zone 4: 팔·종아리", bili: "12~15" },
        { z: 5, label: "Zone 5: 손·발", bili: ">15" },
    ];
    function fillZ(z) { return z <= zone ? "#f4d35e" : "#fef9e7"; }
    return `<svg viewBox="0 0 ${W} ${H}" class="clinical-svg kramer-svg" role="img" aria-label="Kramer's zones 신생아 황달">
      <rect width="${W}" height="${H}" fill="#fafdfb"/>
      <text x="${W/2}" y="20" text-anchor="middle" font-size="13" font-weight="700" fill="#1e293b">Kramer's zones — Zone ${zone}</text>
      <!-- 머리 (Zone 1) -->
      <circle cx="${W/2}" cy="50" r="22" fill="${fillZ(1)}" stroke="#a18063" stroke-width="1.5"/>
      <!-- 가슴·상복부 (Zone 2) -->
      <rect x="${W/2 - 30}" y="73" width="60" height="50" fill="${fillZ(2)}" stroke="#a18063" stroke-width="1.5"/>
      <!-- 하복부·허벅지 (Zone 3) -->
      <rect x="${W/2 - 30}" y="123" width="60" height="50" fill="${fillZ(3)}" stroke="#a18063" stroke-width="1.5"/>
      <!-- 팔 (Zone 4) -->
      <rect x="${W/2 - 60}" y="78" width="20" height="80" fill="${fillZ(4)}" stroke="#a18063" stroke-width="1.5"/>
      <rect x="${W/2 + 40}" y="78" width="20" height="80" fill="${fillZ(4)}" stroke="#a18063" stroke-width="1.5"/>
      <!-- 종아리 -->
      <rect x="${W/2 - 27}" y="173" width="22" height="60" fill="${fillZ(4)}" stroke="#a18063" stroke-width="1.5"/>
      <rect x="${W/2 + 5}" y="173" width="22" height="60" fill="${fillZ(4)}" stroke="#a18063" stroke-width="1.5"/>
      <!-- 손·발 (Zone 5) -->
      <circle cx="${W/2 - 50}" cy="165" r="9" fill="${fillZ(5)}" stroke="#a18063" stroke-width="1.5"/>
      <circle cx="${W/2 + 50}" cy="165" r="9" fill="${fillZ(5)}" stroke="#a18063" stroke-width="1.5"/>
      <circle cx="${W/2 - 16}" cy="240" r="9" fill="${fillZ(5)}" stroke="#a18063" stroke-width="1.5"/>
      <circle cx="${W/2 + 16}" cy="240" r="9" fill="${fillZ(5)}" stroke="#a18063" stroke-width="1.5"/>
      <text x="${W/2}" y="265" text-anchor="middle" font-size="11" font-weight="700" fill="#c97070">${zoneInfo[zone-1]?.bili || ''} 빌리루빈</text>
    </svg>`;
}

const CLINICAL_SVG = {
    ecg: ecgStrip,
    pressureUlcer: pressureUlcerSvg,
    position: positionSvg,
    ruleOfNines: ruleOfNinesSvg,
    fhr: fhrSvg,
    pupil: pupilSvg,
    gcs: gcsTableSvg,
    aedPad: aedPadSvg,
    fundalHeight: fundalHeightSvg,
    apgar: apgarTableSvg,
    auscultation: auscultationSvg,
    kramer: kramerZoneSvg,
};

// 이미지 키 → SVG 변환 (generator/episode 에서 사용)
// 형식: "ecg:vfib", "ulcer:2", "position:sims", "rule-of-nines",
//       "fhr:late", "pupil:3,5"
function renderClinicalImage(key) {
    if (!key) return "";
    // AI 생성 비트맵 이미지 우선 — images/ 폴더에 매칭 파일 있으면 사용
    // 매핑: "ecg:vtach" → "images/ecg-vtach.webp" (없으면 자동 SVG 폴백)
    const imgMap = (typeof window !== "undefined") ? window.CLINICAL_IMAGE_MAP : null;
    const altMap = (typeof window !== "undefined") ? window.CLINICAL_IMAGE_ALT : null;
    if (imgMap && imgMap[key]) {
        const src = imgMap[key];
        const alt = (altMap && altMap[key]) || key;
        return `<img class="clinical-img" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" onerror="this.outerHTML=window._renderSvgFallback('${escapeHtml(key)}')">`;
    }
    return _renderSvgFallback(key);
}

// SVG 폴백 — 비트맵 없거나 로드 실패 시 자체 제작 SVG 렌더
function _renderSvgFallback(key) {
    if (!key) return "";
    if (key === "rule-of-nines") return CLINICAL_SVG.ruleOfNines();
    const [type, arg] = key.split(":");
    if (type === "ecg") return CLINICAL_SVG.ecg(arg);
    if (type === "ulcer") return CLINICAL_SVG.pressureUlcer(Number(arg));
    if (type === "position") return CLINICAL_SVG.position(arg);
    if (type === "fhr") return CLINICAL_SVG.fhr(arg);
    if (type === "pupil") {
        const [L, R] = arg.split(",").map(Number);
        return CLINICAL_SVG.pupil(L, R);
    }
    if (type === "gcs") return CLINICAL_SVG.gcs(arg);
    if (type === "aed") return CLINICAL_SVG.aedPad(arg);
    if (type === "fundal") return CLINICAL_SVG.fundalHeight(Number(arg));
    if (type === "apgar") {
        const scores = {};
        arg.split(",").forEach(p => {
            const [k, v] = p.split("=");
            scores[k] = parseInt(v);
        });
        return CLINICAL_SVG.apgar(scores);
    }
    if (type === "ausc") return CLINICAL_SVG.auscultation(arg);
    if (type === "kramer") return CLINICAL_SVG.kramer(Number(arg));
    return "";
}
// onerror 핸들러에서 호출 가능하도록 글로벌 노출
if (typeof window !== "undefined") {
    window._renderSvgFallback = _renderSvgFallback;
}

// 환자 아바타 선택 — id + desc 기반 결정적 매칭
// 성별/연령 힌트가 desc에 있으면 그에 맞는 아바타를, 없으면 id 해시로 결정
const _AVATAR_MALE = ["young-m", "bald-m", "grey-m", "buzz-m"];
const _AVATAR_FEMALE = ["senior-f", "bun-f", "hijab-f", "long-f"];
function pickAvatarForPatient(id, desc) {
    const d = String(desc || "");
    // 연령 + 성별 힌트
    const isOld = /노인|70세|80세|90세|7\d세|8\d세|9\d세/.test(d);
    const isMale = /\b남\b|남자|남성|할아버지/.test(d);
    const isFemale = /\b여\b|여자|여성|임신|산모|임산부|할머니/.test(d);
    let pool;
    if (isOld && isFemale) pool = ["senior-f"];
    else if (isOld && isMale) pool = ["grey-m"];
    else if (isFemale) pool = _AVATAR_FEMALE.filter(a => a !== "senior-f");
    else if (isMale) pool = _AVATAR_MALE.filter(a => a !== "grey-m");
    else pool = [..._AVATAR_MALE, ..._AVATAR_FEMALE];
    // id 해시로 결정적 선택 (같은 환자 = 항상 같은 아바타)
    const key = String(id || "");
    let h = 0;
    for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
    return pool[Math.abs(h) % pool.length];
}
function renderPatientAvatar(id, desc, opts = {}) {
    const avatar = pickAvatarForPatient(id, desc);
    const cls = opts.cls || "patient-avatar";
    return `<img class="${cls}" src="images/avatar-${_avatarIndex(avatar)}-${avatar}.svg" alt="" aria-hidden="true" loading="lazy">`;
}
function _avatarIndex(name) {
    const order = ["senior-f", "young-m", "bun-f", "bald-m", "hijab-f", "long-f", "grey-m", "buzz-m"];
    return (order.indexOf(name) + 1) || 1;
}
if (typeof window !== "undefined") {
    window.pickAvatarForPatient = pickAvatarForPatient;
    window.renderPatientAvatar = renderPatientAvatar;
}

// 빈 상태 일러스트 — Claude 디자인 SVG (images/) + 기존 인라인 (폴백)
const EMPTY_ILLUST = {
    // 오답노트 0건 — 체크된 노트
    wrongDone: '<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="32" y="22" width="56" height="76" rx="6"/><path d="M44 40 h32 M44 54 h32 M44 68 h22"/><circle cx="86" cy="80" r="16" fill="var(--primary-soft)" stroke="var(--primary)"/><path d="M78 80 l6 6 l12 -12" stroke="var(--primary)" stroke-width="3"/></svg>',
    // 일일 챌린지 완료 — 체크 동그라미
    dailyDone: '<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="60" cy="60" r="42" fill="var(--primary-soft)" stroke="currentColor"/><path d="M40 60 l14 14 l28 -28" stroke="var(--primary)" stroke-width="4"/><path d="M60 18 v6 M60 96 v6 M18 60 h6 M96 60 h6" stroke="var(--primary)" opacity="0.6"/></svg>',
    // 검색 결과 0건 — Claude 디자인
    searchEmpty: '<img src="images/empty-no-search.svg" alt="" aria-hidden="true">',
    // 북마크 0건 — Claude 디자인
    bookmarkEmpty: '<img src="images/empty-no-bookmarks.svg" alt="" aria-hidden="true">',
    // 데이터 부족 — Claude 디자인
    dataEmpty: '<img src="images/empty-no-data.svg" alt="" aria-hidden="true">',
    // 기록 없음 — Claude 디자인
    recordsEmpty: '<img src="images/empty-no-records.svg" alt="" aria-hidden="true">',
    // 이미지 없음 — Claude 디자인
    imagesEmpty: '<img src="images/empty-no-images.svg" alt="" aria-hidden="true">',
    // 오답 0건 (학습 완료) — Claude 디자인
    wrongEmpty: '<img src="images/empty-no-wrong.svg" alt="" aria-hidden="true">',
};

function renderEmptyState({ illust, title, desc, primaryAction, primaryLabel = "메인 메뉴", secondaryAction, secondaryLabel }) {
    const buttons = [];
    if (primaryAction) buttons.push(`<button class="choice-btn primary" data-action="${primaryAction}">${escapeHtml(primaryLabel)}</button>`);
    if (secondaryAction) buttons.push(`<button class="choice-btn" data-action="${secondaryAction}">${escapeHtml(secondaryLabel)}</button>`);
    return `
      <div class="scene-card card empty-state">
        <div class="empty-state-illust">${EMPTY_ILLUST[illust] || ''}</div>
        <h2 class="empty-state-title">${escapeHtml(title)}</h2>
        <p class="empty-state-desc">${escapeHtml(desc)}</p>
        <div class="choice-list">${buttons.join("")}</div>
      </div>`;
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
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {
            if (e && e.name === "QuotaExceededError" && typeof UI !== "undefined" && UI.logBar) {
                try { addLog("⚠️ 저장 공간 부족. 브라우저 캐시를 정리해주세요.", "log-bad"); } catch {}
            }
        }
    },
    defaults() {
        const stats = {};
        CATEGORIES.forEach(c => stats[c] = { solved: 0, correct: 0 });
        return {
            settings: { theme: "auto", sound: true, haptics: true, tts: false, examMode: "korean", lang: "ko" },
            stats,
            wrongQueue: [],
            bookmarks: {},     // { contentId: { type, label, ts } } — 즐겨찾기
            bestCombo: 0,
            mockBest: 0,
            handoffBest: 0,
            triageBest: 0,
            scenarios: {},     // { scenarioId: { bestHp, bestRep, completed } }
            daily: {},
            history: [],
            // 배지(achievements) — { unlocked: [{ id, at }], lastChecked, hintUsedCount, graduatedCount }
            achievements: { unlocked: [], lastChecked: 0, hintUsedCount: 0, graduatedCount: 0 },
            // 친구 초대 — 양쪽 보너스 메커니즘 (?ref=ABC123)
            referral: { myCode: null, invitedBy: null, invitesSent: 0, bonusGranted: false, bonusAwardedOnce: false, bonusAwardedDate: null },
            // 약점 분석 funnel — 어떤 시나리오/카테고리에서 자주 틀리는지
            funnel: { sceneStarts: {}, sceneWrongs: {}, lastActivityTs: 0 },
            // 직군 선택 (persona) — 시장 확장용 수요 신호
            persona: { discipline: null, year: null, choseAt: 0 },
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
            bookmarks: (raw.bookmarks && typeof raw.bookmarks === "object" && !Array.isArray(raw.bookmarks)) ? raw.bookmarks : {},
            bestCombo: Number.isFinite(raw.bestCombo) ? raw.bestCombo : 0,
            mockBest: Number.isFinite(raw.mockBest) ? raw.mockBest : 0,
            handoffBest: Number.isFinite(raw.handoffBest) ? raw.handoffBest : 0,
            handoffSeen: Array.isArray(raw.handoffSeen) ? raw.handoffSeen.filter(x => typeof x === "string") : [],
            triageBest: Number.isFinite(raw.triageBest) ? raw.triageBest : 0,
            accepted: (raw.accepted && typeof raw.accepted === "object") ? raw.accepted : null,
            onboarded: raw.onboarded === true,
            firstActionDone: raw.firstActionDone === true,
            scenarios: (raw.scenarios && typeof raw.scenarios === "object" && !Array.isArray(raw.scenarios)) ? raw.scenarios : {},
            episodes: (raw.episodes && typeof raw.episodes === "object" && !Array.isArray(raw.episodes)) ? raw.episodes : {},
            campaign: (raw.campaign && typeof raw.campaign === "object" && !Array.isArray(raw.campaign)) ? raw.campaign : { started: false, chapter: 0, episode: 0, cumulativeRep: 0, log: [] },
            streak: (raw.streak && typeof raw.streak === "object" && !Array.isArray(raw.streak)) ? raw.streak : { count: 0, best: 0, lastDate: null, freezeUsedAt: null },
            errorReports: Array.isArray(raw.errorReports) ? raw.errorReports.filter(e => e && typeof e === "object") : [],
            episodeProgress: (raw.episodeProgress && typeof raw.episodeProgress === "object" && !Array.isArray(raw.episodeProgress)) ? raw.episodeProgress : {},
            daily: (raw.daily && typeof raw.daily === "object") ? raw.daily : {},
            history: Array.isArray(raw.history) ? raw.history : [],
            deviceId: (typeof raw.deviceId === "string" && raw.deviceId.length > 0) ? raw.deviceId : null,
            notifyOptIn: raw.notifyOptIn === true,
            achievements: (raw.achievements && typeof raw.achievements === "object" && !Array.isArray(raw.achievements)) ? {
                unlocked: Array.isArray(raw.achievements.unlocked) ? raw.achievements.unlocked.filter(x => x && typeof x === "object" && typeof x.id === "string") : [],
                lastChecked: Number.isFinite(raw.achievements.lastChecked) ? raw.achievements.lastChecked : 0,
                hintUsedCount: Number.isFinite(raw.achievements.hintUsedCount) ? raw.achievements.hintUsedCount : 0,
                graduatedCount: Number.isFinite(raw.achievements.graduatedCount) ? raw.achievements.graduatedCount : 0,
            } : { unlocked: [], lastChecked: 0, hintUsedCount: 0, graduatedCount: 0 },
            referral: (raw.referral && typeof raw.referral === "object" && !Array.isArray(raw.referral)) ? {
                myCode: (typeof raw.referral.myCode === "string" && /^[A-Z0-9]{6}$/.test(raw.referral.myCode)) ? raw.referral.myCode : null,
                invitedBy: (typeof raw.referral.invitedBy === "string" && /^[A-Z0-9]{6}$/.test(raw.referral.invitedBy)) ? raw.referral.invitedBy : null,
                invitesSent: Number.isFinite(raw.referral.invitesSent) ? raw.referral.invitesSent : 0,
                bonusGranted: raw.referral.bonusGranted === true,
                bonusAwardedOnce: raw.referral.bonusAwardedOnce === true,
                bonusAwardedDate: typeof raw.referral.bonusAwardedDate === "string" ? raw.referral.bonusAwardedDate : null,
            } : { myCode: null, invitedBy: null, invitesSent: 0, bonusGranted: false, bonusAwardedOnce: false, bonusAwardedDate: null },
            funnel: (raw.funnel && typeof raw.funnel === "object" && !Array.isArray(raw.funnel)) ? {
                sceneStarts: (raw.funnel.sceneStarts && typeof raw.funnel.sceneStarts === "object" && !Array.isArray(raw.funnel.sceneStarts)) ? raw.funnel.sceneStarts : {},
                sceneWrongs: (raw.funnel.sceneWrongs && typeof raw.funnel.sceneWrongs === "object" && !Array.isArray(raw.funnel.sceneWrongs)) ? raw.funnel.sceneWrongs : {},
                lastActivityTs: Number.isFinite(raw.funnel.lastActivityTs) ? raw.funnel.lastActivityTs : 0,
            } : { sceneStarts: {}, sceneWrongs: {}, lastActivityTs: 0 },
            persona: (raw.persona && typeof raw.persona === "object" && !Array.isArray(raw.persona)) ? {
                discipline: (typeof raw.persona.discipline === "string" && raw.persona.discipline.length > 0) ? raw.persona.discipline : null,
                year: (typeof raw.persona.year === "string" && raw.persona.year.length > 0) ? raw.persona.year : null,
                choseAt: Number.isFinite(raw.persona.choseAt) ? raw.persona.choseAt : 0,
            } : { discipline: null, year: null, choseAt: 0 },
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
            // Leitner 5-box: 1d → 3d → 7d → 14d → 30d (box 1~5)
            box: 1,
            interval: 0, repetitions: 0, easeFactor: 2.5, nextDue: Date.now(),
        };
        if (data.wrongQueue.length >= 200) data.wrongQueue.shift();
        data.wrongQueue.push(entry);
        Storage.save(data);
        return entry.id;
    },
    // Leitner 5-box 알고리즘 — quality 0~5 (정답=5, 부분정답=3, 오답=0)
    // box 1→2→3→4→5 (정답시 승급), 오답시 box 1 강등. 박스 5 졸업 시 자동 제거.
    updateSpacedRepetition(id, quality) {
        const data = Storage.load();
        const item = data.wrongQueue.find(e => e.id === id);
        if (!item) return;
        const LEITNER_DAYS = [1, 3, 7, 14, 30];
        if (typeof item.box !== "number" || item.box < 1 || item.box > 5) item.box = 1;
        let graduate = false;
        if (quality < 3) {
            item.box = 1;
            item.repetitions = 0;
        } else {
            if (item.box >= 5) {
                graduate = true;
            } else {
                item.box = Math.min(5, item.box + 1);
            }
            item.repetitions = (item.repetitions || 0) + 1;
        }
        item.interval = LEITNER_DAYS[item.box - 1];
        item.nextDue = Date.now() + item.interval * 24 * 60 * 60 * 1000;
        item.lastReviewed = Date.now();
        if (graduate) {
            const idx = data.wrongQueue.findIndex(e => e.id === id);
            if (idx >= 0) data.wrongQueue.splice(idx, 1);
            if (!data.achievements || typeof data.achievements !== "object") data.achievements = { unlocked: [], lastChecked: 0, hintUsedCount: 0, graduatedCount: 0 };
            data.achievements.graduatedCount = (data.achievements.graduatedCount || 0) + 1;
        }
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
    // 즐겨찾기 (북마크) — 문제 스냅샷을 ⭐ 토글로 보관
    getBookmarks() { return Storage.load().bookmarks || {}; },
    isBookmarked(id) {
        const bm = Storage.load().bookmarks || {};
        return !!bm[id];
    },
    toggleBookmark(id, snapshot = null) {
        const data = Storage.load();
        if (!data.bookmarks || typeof data.bookmarks !== "object") data.bookmarks = {};
        if (data.bookmarks[id]) {
            delete data.bookmarks[id];
            Storage.save(data);
            return false;
        }
        const entry = snapshot ? {
            baseId: snapshot.baseId, category: snapshot.category, part: snapshot.part,
            title: snapshot.title, desc: snapshot.desc,
            choices: (snapshot.choices || []).map(c => ({ text: c.text, correct: !!c.correct, log: c.log })),
            ts: Date.now(),
        } : { ts: Date.now() };
        data.bookmarks[id] = entry;
        Storage.save(data);
        return true;
    },
    removeBookmark(id) {
        const data = Storage.load();
        if (data.bookmarks && data.bookmarks[id]) {
            delete data.bookmarks[id];
            Storage.save(data);
        }
    },
    getStats() { return Storage.load().stats; },
    getSettings() { return Storage.load().settings; },
    setSettings(s) {
        const data = Storage.load();
        data.settings = Object.assign(data.settings, s);
        Storage.save(data);
    },
    // NCLEX-RN 영어 모드 토글 — "korean" | "nclex"
    getExamMode() {
        const s = Storage.getSettings();
        return s && s.examMode === "nclex" ? "nclex" : "korean";
    },
    setExamMode(mode) {
        if (mode !== "korean" && mode !== "nclex") return;
        const data = Storage.load();
        data.settings = Object.assign(data.settings || {}, { examMode: mode });
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
    // 신규 사용자가 첫 액션(듀티 시작/문제 풀이/일일 챌린지)을 한 적 있는지
    // → 없으면 메인 메뉴에 첫 진입 시 hero-card에 onboarding pulse + tooltip 표시
    isFirstAction() {
        const data = Storage.load();
        return data.firstActionDone !== true;
    },
    setFirstActionDone() {
        const data = Storage.load();
        if (data.firstActionDone === true) return;
        data.firstActionDone = true;
        Storage.save(data);
    },
    setPersona(discipline, year) {
        const data = Storage.load();
        data.persona = {
            discipline: (typeof discipline === "string" && discipline.length > 0) ? discipline : null,
            year: (typeof year === "string" && year.length > 0) ? year : null,
            choseAt: Date.now(),
        };
        Storage.save(data);
    },
    // 익명 디바이스 ID — 향후 클라우드 동기화·서버측 분석용 (현재 미사용)
    // crypto.randomUUID 가 없는 구형 환경은 timestamp+random 폴백
    getDeviceId() {
        const data = Storage.load();
        if (data.deviceId) return data.deviceId;
        let id;
        try {
            id = (crypto && crypto.randomUUID) ? crypto.randomUUID()
                : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        } catch {
            id = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        }
        data.deviceId = id;
        Storage.save(data);
        return id;
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
    setHandoffBest(acc) {
        const data = Storage.load();
        if (!Number.isFinite(data.handoffBest) || acc > data.handoffBest) { data.handoffBest = acc; Storage.save(data); }
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
    // 커리어 캠페인 — 에피소드를 소설처럼 이어가는 연속 진행 상태
    getCampaign() {
        const data = Storage.load();
        const c = data.campaign;
        if (c && typeof c === "object") return c;
        return { started: false, chapter: 0, episode: 0, cumulativeRep: 0, log: [] };
    },
    saveCampaign(c) {
        const data = Storage.load();
        data.campaign = c;
        Storage.save(data);
    },
    resetCampaign() {
        const data = Storage.load();
        data.campaign = { started: false, chapter: 0, episode: 0, cumulativeRep: 0, log: [] };
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
    // 연속 학습 일수(streak) — 습관 루프
    getStreak() {
        const data = Storage.load();
        return (data.streak && typeof data.streak === "object") ? data.streak : { count: 0, best: 0, lastDate: null };
    },
    bumpStreak() {
        const data = Storage.load();
        const s = (data.streak && typeof data.streak === "object") ? data.streak : { count: 0, best: 0, lastDate: null, freezeUsedAt: null };
        const today = todayKey();
        if (s.lastDate === today) return s; // 오늘 이미 카운트됨
        if (s.lastDate === dateKeyOffset(-1)) {
            // 어제 이어서 — 정상 +1
            s.count = (s.count || 0) + 1;
        } else if (s.lastDate === dateKeyOffset(-2)) {
            // 2일 전 — 그레이스 (스트릭 보호) 검사
            // 최근 7일 이내 그레이스 미사용 시 한 번 봐주고 +1
            const freezeRecent = s.freezeUsedAt && s.freezeUsedAt >= dateKeyOffset(-6);
            if (!freezeRecent) {
                s.count = (s.count || 0) + 1;
                s.freezeUsedAt = today;
                s._lastGraceLog = today; // UI 표시용 (한 번만 안내)
            } else {
                s.count = 1; // 두 번째 빠짐 → 리셋
            }
        } else {
            s.count = 1; // 3일+ 끊김 → 새로 시작
        }
        s.lastDate = today;
        s.best = Math.max(s.best || 0, s.count);
        data.streak = s;
        Storage.save(data);
        return s;
    },
    addHistory(entry) {
        const data = Storage.load();
        data.history.unshift(entry);
        data.history = data.history.slice(0, 20);
        Storage.save(data);
    },
    // 배지(achievements) — 학습 동기 부여를 위한 도전과제 시스템
    getAchievements() {
        const data = Storage.load();
        return data.achievements || { unlocked: [], lastChecked: 0, hintUsedCount: 0, graduatedCount: 0 };
    },
    isAchievementUnlocked(id) {
        const ach = Storage.getAchievements();
        return (ach.unlocked || []).some(u => u && u.id === id);
    },
    unlockAchievement(id) {
        const data = Storage.load();
        if (!data.achievements || typeof data.achievements !== "object") {
            data.achievements = { unlocked: [], lastChecked: 0, hintUsedCount: 0, graduatedCount: 0 };
        }
        if (!Array.isArray(data.achievements.unlocked)) data.achievements.unlocked = [];
        if (data.achievements.unlocked.some(u => u && u.id === id)) return false;
        data.achievements.unlocked.push({ id, at: Date.now() });
        Storage.save(data);
        return true;
    },
    incrementHintUsed() {
        const data = Storage.load();
        if (!data.achievements || typeof data.achievements !== "object") {
            data.achievements = { unlocked: [], lastChecked: 0, hintUsedCount: 0, graduatedCount: 0 };
        }
        data.achievements.hintUsedCount = (data.achievements.hintUsedCount || 0) + 1;
        Storage.save(data);
        return data.achievements.hintUsedCount;
    },
    // 신규 카운터 — 배지 시스템 확장용 (15→20 배지)
    _ensureCounters() {
        const data = Storage.load();
        if (!data.achievements || typeof data.achievements !== "object") {
            data.achievements = { unlocked: [], lastChecked: 0, hintUsedCount: 0, graduatedCount: 0 };
        }
        if (!data.achievements.counters || typeof data.achievements.counters !== "object") {
            data.achievements.counters = {};
        }
        return data;
    },
    incrementImageCorrect() {
        const data = Storage._ensureCounters();
        data.achievements.counters.imageCorrect = (data.achievements.counters.imageCorrect || 0) + 1;
        Storage.save(data);
    },
    incrementNclexCorrect() {
        const data = Storage._ensureCounters();
        data.achievements.counters.nclexCorrect = (data.achievements.counters.nclexCorrect || 0) + 1;
        Storage.save(data);
    },
    incrementScenarioDone() {
        const data = Storage._ensureCounters();
        data.achievements.counters.scenariosDone = (data.achievements.counters.scenariosDone || 0) + 1;
        Storage.save(data);
    },
    incrementPerfectSet() {
        const data = Storage._ensureCounters();
        data.achievements.counters.perfectSets = (data.achievements.counters.perfectSets || 0) + 1;
        Storage.save(data);
    },
    updateMockBest(score) {
        if (!Number.isFinite(score)) return;
        const data = Storage._ensureCounters();
        const prev = data.achievements.counters.mockBest || 0;
        if (score > prev) {
            data.achievements.counters.mockBest = score;
            Storage.save(data);
        }
    },
    markComebackWin() {
        const data = Storage._ensureCounters();
        data.achievements.counters.comebackWin = true;
        Storage.save(data);
    },
    markStudyTime() {
        const data = Storage._ensureCounters();
        const hour = new Date().getHours();
        if (hour >= 0 && hour < 5) data.achievements.counters.nightStudy = true;
        else if (hour >= 5 && hour < 9) data.achievements.counters.earlyStudy = true;
        Storage.save(data);
    },
    markModeUsed(mode) {
        if (!mode) return;
        const data = Storage._ensureCounters();
        const arr = Array.isArray(data.achievements.counters.modesUsed) ? data.achievements.counters.modesUsed : [];
        if (!arr.includes(mode)) {
            arr.push(mode);
            data.achievements.counters.modesUsed = arr;
            Storage.save(data);
        }
    },
    markSupporter() {
        const data = Storage._ensureCounters();
        data.achievements.counters.supporter = true;
        Storage.save(data);
    },
    // 로컬 리더보드 — 본인 최고 기록 (백엔드 없음)
    recordSetScore(category, correct, total) {
        if (!Number.isFinite(correct) || !Number.isFinite(total) || total <= 0) return;
        const data = Storage.load();
        if (!data.leaderboard || typeof data.leaderboard !== "object") {
            data.leaderboard = { topSets: [], mockBest: 0 };
        }
        if (!Array.isArray(data.leaderboard.topSets)) data.leaderboard.topSets = [];
        data.leaderboard.topSets.push({ category: category || "전체", correct, total, ts: Date.now() });
        // 상위 10개만 유지 (정답률 우선, 동률 시 최근 우선)
        data.leaderboard.topSets.sort((a, b) => {
            const ra = (a.correct || 0) / Math.max(1, a.total || 1);
            const rb = (b.correct || 0) / Math.max(1, b.total || 1);
            if (rb !== ra) return rb - ra;
            return (b.ts || 0) - (a.ts || 0);
        });
        data.leaderboard.topSets = data.leaderboard.topSets.slice(0, 10);
        // 완벽 세트 카운터
        if (correct === total && total >= 5) Storage.incrementPerfectSet();
        Storage.save(data);
    },
    getLeaderboard() {
        const data = Storage.load();
        return data.leaderboard && typeof data.leaderboard === "object"
            ? data.leaderboard
            : { topSets: [], mockBest: 0 };
    },
    // 현재 데이터 상태를 스캔해 새로 달성된 배지를 잠금 해제 → 새로 잠금해제된 항목 배열 반환
    checkAchievements() {
        const data = Storage.load();
        const stats = data.stats || {};
        const totalSolved = Object.values(stats).reduce((s, v) => s + (v.solved || 0), 0);
        const totalCorrect = Object.values(stats).reduce((s, v) => s + (v.correct || 0), 0);
        const acc = totalSolved > 0 ? (totalCorrect / totalSolved) * 100 : 0;
        const streak = data.streak || { count: 0, best: 0 };
        const streakBest = streak.best || streak.count || 0;
        const bestCombo = data.bestCombo || 0;
        const campaignLog = (data.campaign && Array.isArray(data.campaign.log)) ? data.campaign.log.length : 0;
        const graduatedCount = (data.achievements && data.achievements.graduatedCount) || 0;
        const hintUsedCount = (data.achievements && data.achievements.hintUsedCount) || 0;

        const counters = (data.achievements && data.achievements.counters) || {};
        const hour = new Date().getHours();
        // 학습 활동이 있으면 시간대 마킹
        const studiedToday = totalSolved > 0 || (data.daily && Object.keys(data.daily).length > 0);
        const checks = [
            { id: "first-step", earned: totalCorrect >= 1 },
            { id: "century", earned: totalSolved >= 100 },
            { id: "sharpshooter", earned: totalSolved >= 50 && acc >= 80 },
            { id: "streak-7", earned: streakBest >= 7 },
            { id: "campaign-runner", earned: campaignLog >= 1 },
            { id: "perfect-set", earned: (counters.perfectSets || 0) >= 1 },
        ];

        const newlyUnlocked = [];
        const already = new Set((data.achievements && Array.isArray(data.achievements.unlocked) ? data.achievements.unlocked : []).map(u => u.id));
        checks.forEach(c => {
            if (c.earned && !already.has(c.id)) newlyUnlocked.push(c.id);
        });
        // 마스터 — 위 6개 모두 달성 시
        const wouldBeUnlocked = new Set([...already, ...newlyUnlocked]);
        const nineCount = checks.filter(c => wouldBeUnlocked.has(c.id)).length;
        if (nineCount >= 9 && !already.has("master")) newlyUnlocked.push("master");

        newlyUnlocked.forEach(id => Storage.unlockAchievement(id));
        if (newlyUnlocked.length > 0) {
            const fresh = Storage.load();
            fresh.achievements.lastChecked = Date.now();
            Storage.save(fresh);
        }
        return newlyUnlocked;
    },
    // 친구 초대 — 6자리 영숫자 코드 발급/조회. 혼동되는 0/O/1/I/L 제외.
    getOrCreateReferralCode() {
        const data = Storage.load();
        if (!data.referral || typeof data.referral !== "object") {
            data.referral = { myCode: null, invitedBy: null, invitesSent: 0, bonusGranted: false };
        }
        if (typeof data.referral.myCode === "string" && /^[A-Z0-9]{6}$/.test(data.referral.myCode)) {
            return data.referral.myCode;
        }
        const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
        let code = "";
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
        data.referral.myCode = code;
        Storage.save(data);
        return code;
    },
    getReferral() {
        const data = Storage.load();
        return (data.referral && typeof data.referral === "object") ? data.referral
            : { myCode: null, invitedBy: null, invitesSent: 0, bonusGranted: false };
    },
    incrementInvitesSent() {
        const data = Storage.load();
        if (!data.referral || typeof data.referral !== "object") {
            data.referral = { myCode: null, invitedBy: null, invitesSent: 0, bonusGranted: false };
        }
        data.referral.invitesSent = (Number.isFinite(data.referral.invitesSent) ? data.referral.invitesSent : 0) + 1;
        Storage.save(data);
        return data.referral.invitesSent;
    },
    // 약점 분석 funnel — 어떤 시나리오에서 자주 시작/오답이 발생하는지 기록
    // 키 수 제한 — 가장 오래된 항목부터 제거 (LRU). 시나리오 ID 다양성 < 500 가정으로 여유 유지
    _capFunnelDict(dict, cap) {
        const keys = Object.keys(dict);
        if (keys.length <= cap) return dict;
        const sorted = keys.sort((a, b) => (dict[a].lastTs || 0) - (dict[b].lastTs || 0));
        const toRemove = sorted.slice(0, keys.length - cap);
        toRemove.forEach(k => { delete dict[k]; });
        return dict;
    },
    recordSceneStart(sceneId, category) {
        if (!sceneId) return;
        const data = Storage.load();
        if (!data.funnel || typeof data.funnel !== "object") data.funnel = { sceneStarts: {}, sceneWrongs: {}, lastActivityTs: 0 };
        if (!data.funnel.sceneStarts || typeof data.funnel.sceneStarts !== "object") data.funnel.sceneStarts = {};
        const key = String(sceneId);
        const prev = data.funnel.sceneStarts[key] || { count: 0, category: category || null, lastTs: 0 };
        data.funnel.sceneStarts[key] = {
            count: (Number.isFinite(prev.count) ? prev.count : 0) + 1,
            category: category || prev.category || null,
            lastTs: Date.now(),
        };
        data.funnel.lastActivityTs = Date.now();
        Storage._capFunnelDict(data.funnel.sceneStarts, 500);
        Storage.save(data);
    },
    recordSceneWrong(sceneId, category) {
        if (!sceneId) return;
        const data = Storage.load();
        if (!data.funnel || typeof data.funnel !== "object") data.funnel = { sceneStarts: {}, sceneWrongs: {}, lastActivityTs: 0 };
        if (!data.funnel.sceneWrongs || typeof data.funnel.sceneWrongs !== "object") data.funnel.sceneWrongs = {};
        const key = String(sceneId);
        const prev = data.funnel.sceneWrongs[key] || { count: 0, category: category || null, lastTs: 0 };
        data.funnel.sceneWrongs[key] = {
            count: (Number.isFinite(prev.count) ? prev.count : 0) + 1,
            category: category || prev.category || null,
            lastTs: Date.now(),
        };
        data.funnel.lastActivityTs = Date.now();
        Storage._capFunnelDict(data.funnel.sceneWrongs, 500);
        Storage.save(data);
    },
    getFunnel() {
        const data = Storage.load();
        return (data.funnel && typeof data.funnel === "object")
            ? data.funnel
            : { sceneStarts: {}, sceneWrongs: {}, lastActivityTs: 0 };
    },
};

// 배지(achievement) 정의 — id, 이모지, 이름, 잠금 해제 조건 설명
const BADGES = [
    { id: "first-step",      emoji: "🌱", name: "첫걸음",     desc: "첫 문제 정답" },
    { id: "century",         emoji: "📚", name: "100문제",   desc: "누적 100문제 풀이" },
    { id: "sharpshooter",    emoji: "🎯", name: "명사수",     desc: "50문제 + 정답률 80%" },
    { id: "streak-7",        emoji: "🔥", name: "7일 연속",  desc: "연속 학습 7일" },
    { id: "campaign-runner", emoji: "🏥", name: "캠페인 완주", desc: "에피소드 1화 완주" },
    { id: "perfect-set",     emoji: "💯", name: "완벽한 세트", desc: "한 세트 10/10 정답" },
    { id: "master",          emoji: "🎓", name: "마스터",     desc: "위 6개 모두 달성" },
];

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
    correct() { Sound.beep(880, 0.1); setTimeout(() => Sound.beep(1320, 0.16), 90); Haptics.light(); },
    wrong()   { Sound.beep(220, 0.18, "sawtooth", 0.06); setTimeout(() => Sound.beep(160, 0.22, "sawtooth", 0.05), 110); Haptics.medium(); },
    combo(n)  { Sound.beep(660 + n * 60, 0.08, "triangle", 0.07); },
    tick()    { Sound.beep(520, 0.04, "square", 0.04); },
};

// 햅틱 — Capacitor Haptics 플러그인 있으면 사용, 없으면 navigator.vibrate 폴백
const Haptics = {
    enabled: true,
    get plugin() {
        try { return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) || null; }
        catch { return null; }
    },
    light() {
        if (!Haptics.enabled) return;
        const p = Haptics.plugin;
        try {
            if (p && p.impact) p.impact({ style: "LIGHT" });
            else if (navigator.vibrate) navigator.vibrate(10);
        } catch {}
    },
    medium() {
        if (!Haptics.enabled) return;
        const p = Haptics.plugin;
        try {
            if (p && p.impact) p.impact({ style: "MEDIUM" });
            else if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
        } catch {}
    },
    heavy() {
        if (!Haptics.enabled) return;
        const p = Haptics.plugin;
        try {
            if (p && p.impact) p.impact({ style: "HEAVY" });
            else if (navigator.vibrate) navigator.vibrate(50);
        } catch {}
    },
};

// TTS — 시각 의존 완화 + 접근성 (Web Speech API)
const TTS = {
    enabled: false,
    available: typeof window !== "undefined" && "speechSynthesis" in window,
    voice: null,
    rate: 0.95,    // 0.95 = 살짝 느리게 (1.0 보다 자연스러움)
    pitch: 0.98,   // 0.98 = 약간 낮은 톤 (덜 합성적)
    selectedVoiceName: null,  // 사용자가 명시 선택한 보이스명 (없으면 자동)

    // 자연스러운 한국어 보이스 우선순위 — 플랫폼별 최상위 품질 검출
    // Android: Google 한국어, iOS: Yuna (남자 한국어), Mac: 신지/Yuna (여자)
    // Windows: Heami(Microsoft) → 합성적이라 우선순위 낮음
    listKoreanVoices() {
        if (!TTS.available) return [];
        try {
            const voices = window.speechSynthesis.getVoices() || [];
            return voices.filter(v => v.lang && (v.lang.startsWith("ko") || v.lang === "ko-KR"));
        } catch { return []; }
    },
    pickVoice() {
        if (!TTS.available) return null;
        try {
            const koVoices = TTS.listKoreanVoices();
            if (koVoices.length === 0) {
                // 한국어 보이스 없으면 일반 보이스 fallback
                const all = window.speechSynthesis.getVoices() || [];
                return all[0] || null;
            }
            // 사용자가 명시 선택한 보이스 있으면 그것 사용
            if (TTS.selectedVoiceName) {
                const chosen = koVoices.find(v => v.name === TTS.selectedVoiceName);
                if (chosen) return chosen;
            }
            // 자연스러운 보이스 score 계산
            const scoreVoice = (v) => {
                const name = (v.name || "").toLowerCase();
                let score = 0;
                // 클라우드 보이스 (localService false) = 일반적으로 더 자연스러움
                if (v.localService === false) score += 50;
                // Google (Android Chrome) — WaveNet 기반, 가장 자연스러움
                if (name.includes("google")) score += 100;
                // Apple Neural / Premium / Enhanced
                if (name.includes("neural") || name.includes("premium") || name.includes("enhanced")) score += 80;
                // iOS/Mac 한국어 보이스 (자연스러움 순)
                if (name.includes("yuna")) score += 70;       // iOS 한국어 여성
                if (name.includes("siri")) score += 75;       // iOS Siri 보이스
                if (name.includes("heami")) score += 30;      // Microsoft (덜 자연)
                if (name.includes("seolhee")) score += 60;
                if (name.includes("sora")) score += 60;
                if (name.includes("inha")) score += 55;
                if (name.includes("jian")) score += 55;
                // 기본 보이스 (default 마크)
                if (v.default) score += 20;
                return score;
            };
            const sorted = [...koVoices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
            return sorted[0];
        } catch { return null; }
    },
    speak(text) {
        if (!TTS.available || !TTS.enabled || !text) return;
        try {
            window.speechSynthesis.cancel();
            const cleanText = String(text).slice(0, 800);
            // 텍스트에 한글이 없으면 영어 (NCLEX 영문 모드 약물명 발음 정확도)
            const hasKorean = /[가-힣]/.test(cleanText);
            const ttsLang = hasKorean ? "ko-KR" : "en-US";
            const v = (hasKorean ? (TTS.voice || TTS.pickVoice()) : null);
            // 긴 텍스트는 문장 단위로 끊어 자연스러운 호흡 (마침표/물음표/느낌표 기준)
            const sentences = cleanText
                .split(/(?<=[.!?。!?])\s+/)
                .map(s => s.trim())
                .filter(Boolean);
            if (sentences.length === 0) sentences.push(cleanText);

            sentences.forEach((sentence, i) => {
                const u = new SpeechSynthesisUtterance(sentence);
                if (v) u.voice = v;
                u.lang = ttsLang;
                u.rate = TTS.rate;
                u.pitch = TTS.pitch;
                u.volume = 1.0;
                // 마지막 문장 외엔 짧은 호흡 (pause)
                if (i < sentences.length - 1) {
                    u.onend = null; // 시스템이 자연 큐잉
                }
                window.speechSynthesis.speak(u);
            });
        } catch {}
    },
    stop() {
        if (!TTS.available) return;
        try { window.speechSynthesis.cancel(); } catch {}
    },
    toggle() {
        if (!TTS.available) { addLog("이 브라우저는 음성 읽기를 지원하지 않습니다.", "log-bad"); return; }
        TTS.enabled = !TTS.enabled;
        Storage.setSettings({ tts: TTS.enabled });
        if (!TTS.enabled) TTS.stop();
        addLog(TTS.enabled ? "🔊 음성 읽기 켜짐" : "🔇 음성 읽기 꺼짐", "log-good");
    },
    setVoice(voiceName) {
        TTS.selectedVoiceName = voiceName || null;
        TTS.voice = TTS.pickVoice();
        Storage.setSettings({ ttsVoice: voiceName || null });
        // 미리듣기 — 1초만
        if (TTS.enabled) TTS.speak("안녕하세요. 저는 간호사 시뮬레이터입니다.");
        else { TTS.enabled = true; Storage.setSettings({ tts: true }); TTS.speak("안녕하세요. 저는 간호사 시뮬레이터입니다."); }
    },
    setRate(rate) {
        const n = parseFloat(rate);
        if (Number.isFinite(n) && n >= 0.5 && n <= 1.5) {
            TTS.rate = n;
            Storage.setSettings({ ttsRate: n });
        }
    },
    setPitch(pitch) {
        const n = parseFloat(pitch);
        if (Number.isFinite(n) && n >= 0.5 && n <= 1.5) {
            TTS.pitch = n;
            Storage.setSettings({ ttsPitch: n });
        }
    },
    preview() {
        if (!TTS.enabled) { TTS.enabled = true; Storage.setSettings({ tts: true }); }
        TTS.speak("환자가 갑자기 호흡곤란을 호소합니다. SpO2 88%. 우선 중재를 선택하세요.");
    },
};

// PWA 설치 권유 토스트 — 5회 이상 방문 시 1회만
function showInstallToast() {
    if (document.getElementById("install-toast")) return;
    const el = document.createElement("div");
    el.id = "install-toast";
    el.setAttribute("role", "status");
    el.innerHTML = `
        <span style="margin-right:12px;">📱 홈 화면에 설치하시겠어요?</span>
        <button id="install-toast-yes" style="background:#fff;color:#7fa881;border:none;padding:6px 12px;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;font-size:13px;">설치</button>
        <button id="install-toast-no" style="background:transparent;color:#fff;border:none;padding:6px 8px;cursor:pointer;font-family:inherit;font-size:13px;opacity:0.8;margin-left:4px;">나중에</button>`;
    el.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#7fa881;color:#fff;padding:12px 18px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.3);z-index:99996;font-size:13px;font-family:inherit;display:flex;align-items:center;animation:badgePop 400ms ease;max-width:calc(100vw - 32px);";
    document.body.appendChild(el);
    document.getElementById("install-toast-yes")?.addEventListener("click", async () => {
        try {
            const ev = window.__pwaInstallPrompt;
            if (ev) { ev.prompt(); await ev.userChoice; window.__pwaInstallPrompt = null; }
            track("pwa_install_toast_yes");
        } catch {}
        el.remove();
    });
    document.getElementById("install-toast-no")?.addEventListener("click", () => {
        track("pwa_install_toast_no");
        el.remove();
    });
}

// 새 버전 배포 토스트 — SW activate 후 호출됨
// 인앱 리뷰 프롬프트 — 사용자 7일+ 학습 + 100문제+ 풀이 시점에 1회만
// Play Store / App Store 리뷰 유도 (실 사용자 만족 시점에 자연스럽게 노출)
function maybeShowReviewPrompt() {
    try {
        const SHOWN_KEY = "nurseSim:reviewPromptShown";
        if (localStorage.getItem(SHOWN_KEY)) return;
        const data = Storage.load();
        const stats = data.stats || {};
        const totalSolved = Object.values(stats).reduce((s, v) => s + (v.solved || 0), 0);
        if (totalSolved < 100) return;
        // 약관 동의일 기준 7일 경과 체크
        const accepted = data.accepted && data.accepted.at;
        if (!accepted || (Date.now() - accepted) < 7 * 24 * 60 * 60 * 1000) return;
        // 정답률 60% 이상에만 (이탈 사용자에게 리뷰 요청 X)
        const totalCorrect = Object.values(stats).reduce((s, v) => s + (v.correct || 0), 0);
        const acc = totalSolved > 0 ? totalCorrect / totalSolved : 0;
        if (acc < 0.6) return;
        // 마킹 후 노출
        localStorage.setItem(SHOWN_KEY, String(Date.now()));
        setTimeout(() => { try { showReviewToast(); } catch {} }, 2500);
    } catch {}
}

function showReviewToast() {
    if (document.getElementById("review-toast")) return;
    const el = document.createElement("div");
    el.id = "review-toast";
    el.setAttribute("role", "status");
    el.innerHTML = `
        <div style="margin-bottom:10px;font-weight:700;">⭐ 100문제 돌파! 어떠셨나요?</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;">
          <button id="review-toast-yes" style="background:#fff;color:#7fa881;border:none;padding:8px 14px;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;font-size:13px;">⭐⭐⭐⭐⭐ 좋아요</button>
          <button id="review-toast-no" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,0.5);padding:8px 14px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px;">개선 의견</button>
          <button id="review-toast-dismiss" style="background:transparent;color:#fff;border:none;padding:8px;cursor:pointer;font-family:inherit;font-size:12px;opacity:0.7;">나중에</button>
        </div>`;
    el.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#7fa881,#6a9170);color:#fff;padding:18px 24px;border-radius:14px;box-shadow:0 10px 32px rgba(0,0,0,0.35);z-index:99996;font-family:inherit;text-align:center;max-width:calc(100vw - 32px);animation:badgePop 500ms ease;";
    document.body.appendChild(el);
    document.getElementById("review-toast-yes")?.addEventListener("click", () => {
        track("review_prompt_positive");
        // Play Store 리뷰 페이지로 이동 (본인 출시 후 패키지명 교체)
        const PACKAGE_ID = "com.luiseluise0619.nursingsim";
        const url = `https://play.google.com/store/apps/details?id=${PACKAGE_ID}&showAllReviews=true`;
        try { window.open(url, "_blank", "noopener,noreferrer"); } catch {}
        addLog("⭐ 리뷰 페이지로 이동했어요. 감사합니다!", "log-good");
        el.remove();
    });
    document.getElementById("review-toast-no")?.addEventListener("click", () => {
        track("review_prompt_feedback");
        try { openFeedback(); } catch {}
        el.remove();
    });
    document.getElementById("review-toast-dismiss")?.addEventListener("click", () => {
        track("review_prompt_dismiss");
        el.remove();
    });
}

function showUpdateToast() {
    if (document.getElementById("update-toast")) return;
    const el = document.createElement("div");
    el.id = "update-toast";
    el.setAttribute("role", "status");
    el.innerHTML = `
        <span style="margin-right:12px;">🔄 새 버전이 준비되었어요</span>
        <button id="update-toast-reload" style="background:#fff;color:#7fa881;border:none;padding:6px 12px;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;font-size:13px;">새로고침</button>
        <button id="update-toast-dismiss" style="background:transparent;color:#fff;border:none;padding:6px 8px;cursor:pointer;font-family:inherit;font-size:13px;opacity:0.8;margin-left:4px;">나중에</button>`;
    el.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#7fa881;color:#fff;padding:12px 18px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.3);z-index:99996;font-size:13px;font-family:inherit;display:flex;align-items:center;animation:badgePop 400ms ease;";
    document.body.appendChild(el);
    document.getElementById("update-toast-reload")?.addEventListener("click", () => { location.reload(); });
    document.getElementById("update-toast-dismiss")?.addEventListener("click", () => { el.remove(); });
}

function ttsSpeak(t) {
    const text = t && t.dataset ? t.dataset.text : "";
    if (!TTS.enabled) {
        addLog("음성 읽기가 꺼져 있어요. 설정에서 켤 수 있어요.", "");
        return;
    }
    if (text) TTS.speak(text);
}

function renderTtsSettings() {
    gameState.mode = "tts_settings";
    showCoreUI();
    if (!TTS.available) {
        UI.gameArea.innerHTML = `
          <div class="card">
            <h2 class="scene-title">음성 설정</h2>
            <p class="scene-desc">이 브라우저는 음성 합성을 지원하지 않습니다.</p>
            <button class="choice-btn center" data-action="openSettings">설정으로</button>
          </div>`;
        return;
    }
    const settings = Storage.getSettings();
    const voices = TTS.listKoreanVoices();
    const currentName = TTS.selectedVoiceName || (TTS.pickVoice() ? TTS.pickVoice().name : "(자동)");
    const voiceListHtml = voices.length > 0
        ? voices.map(v => {
            const isSelected = v.name === TTS.selectedVoiceName
                || (!TTS.selectedVoiceName && TTS.voice && TTS.voice.name === v.name);
            const isCloud = v.localService === false;
            const quality = isCloud ? "☁️ 클라우드 (자연)" : "📱 로컬";
            return `<button class="choice-btn ${isSelected ? "primary" : ""}" data-action="setTtsVoice" data-voice="${escapeHtml(v.name)}">
                ${escapeHtml(v.name)} <span class="voice-quality">${quality}</span>
            </button>`;
        }).join("")
        : `<p class="scene-desc">사용 가능한 한국어 보이스가 없어요. 브라우저/OS의 한국어 TTS 보이스를 설치하면 더 자연스러워집니다.</p>`;

    UI.gameArea.innerHTML = `
      <div class="card">
        <h2 class="scene-title">음성 설정</h2>
        <p class="scene-desc">목소리·속도·톤을 조절해 가장 자연스러운 조합을 찾아보세요. 보이스 품질은 기기/브라우저에 따라 다릅니다 — 모바일은 보통 클라우드 보이스가 가장 자연스러워요.</p>

        <h3 class="settings-section">현재 보이스</h3>
        <div class="settings-row">
          <span>${escapeHtml(currentName)}</span>
          <button class="choice-btn" data-action="ttsPreview" style="padding: 6px 14px; font-size: 13px;">▶ 미리듣기</button>
        </div>

        <h3 class="settings-section">보이스 선택 (한국어)</h3>
        <div class="choice-list">${voiceListHtml}</div>

        <h3 class="settings-section">속도</h3>
        <div class="tts-slider-row">
          <span class="tts-slider-label">느림 (0.7)</span>
          <input type="range" id="tts-rate" min="0.7" max="1.3" step="0.05" value="${TTS.rate}" class="tts-slider">
          <span class="tts-slider-label">빠름 (1.3)</span>
        </div>
        <div class="tts-slider-value">현재: ${TTS.rate.toFixed(2)}x</div>

        <h3 class="settings-section">톤 (피치)</h3>
        <div class="tts-slider-row">
          <span class="tts-slider-label">낮음 (0.8)</span>
          <input type="range" id="tts-pitch" min="0.8" max="1.2" step="0.05" value="${TTS.pitch}" class="tts-slider">
          <span class="tts-slider-label">높음 (1.2)</span>
        </div>
        <div class="tts-slider-value">현재: ${TTS.pitch.toFixed(2)}</div>

        <div class="settings-help">
          💡 <strong>덜 AI 스럽게 만드는 팁</strong><br>
          · 클라우드 ☁️ 보이스 선택 (Google·Apple 신경망)<br>
          · 속도 0.90~0.95 (살짝 느리게)<br>
          · 톤 0.95~1.00 (약간 낮게)<br>
          · 모바일에서 더 자연스러움 (PC 합성음 한계)
        </div>

        <div class="choice-list" style="margin-top: 18px;">
          <button class="choice-btn primary" data-action="ttsPreview">▶ 현재 설정 미리듣기</button>
          <button class="choice-btn center" data-action="openSettings">설정으로</button>
        </div>
      </div>`;

    // 슬라이더 이벤트 — DOM 렌더 후 바인딩
    setTimeout(() => {
        const rateEl = document.getElementById("tts-rate");
        const pitchEl = document.getElementById("tts-pitch");
        if (rateEl) {
            rateEl.addEventListener("input", (e) => {
                TTS.setRate(e.target.value);
                const display = rateEl.parentElement.parentElement.querySelector(".tts-slider-value");
                if (display) display.textContent = `현재: ${parseFloat(e.target.value).toFixed(2)}x`;
            });
        }
        if (pitchEl) {
            pitchEl.addEventListener("input", (e) => {
                TTS.setPitch(e.target.value);
                // 두 번째 .tts-slider-value 찾기
                const allDisplays = document.querySelectorAll(".tts-slider-value");
                if (allDisplays[1]) allDisplays[1].textContent = `현재: ${parseFloat(e.target.value).toFixed(2)}`;
            });
        }
    }, 50);
}

function setTtsVoice(t) {
    const name = t && t.dataset ? t.dataset.voice : null;
    if (name) {
        TTS.setVoice(name);
        renderTtsSettings();
    }
}

function ttsPreview() {
    TTS.preview();
}

// =========================================================================
// 테마
// =========================================================================
function resolvedTheme(t) {
    if (t === "amoled") return "amoled";
    if (t === "auto" || !t) {
        try { return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }
        catch { return "light"; }
    }
    return t === "dark" ? "dark" : "light";
}
function applyTheme(theme) {
    const r = resolvedTheme(theme);
    document.documentElement.setAttribute("data-theme", r);
    if (UI.themeToggle) {
        UI.themeToggle.textContent = r === "amoled" ? "🌑" : r === "dark" ? "☀️" : "🌙";
    }
}
function toggleTheme() {
    // light → dark → amoled → light 순환
    const cur = Storage.getSettings().theme || "auto";
    const resolved = resolvedTheme(cur);
    let next;
    if (resolved === "light") next = "dark";
    else if (resolved === "dark") next = "amoled";
    else next = "light";
    applyTheme(next);
    Storage.setSettings({ theme: next });
}
function toggleHaptics() {
    Haptics.enabled = !Haptics.enabled;
    Storage.setSettings({ haptics: Haptics.enabled });
    if (Haptics.enabled) Haptics.medium();
    addLog(Haptics.enabled ? "📳 햅틱 켜짐" : "햅틱 꺼짐", "log-good");
}
function toggleSound() {
    Sound.enabled = !Sound.enabled;
    Storage.setSettings({ sound: Sound.enabled });
    if (UI.soundToggle) UI.soundToggle.textContent = Sound.enabled ? "🔊" : "🔇";
}

// 언어 순환 전환 (한국어 → English → Filipino → Español → 한국어)
function toggleLang() {
    if (typeof window === "undefined" || !window.I18N) return;
    const ORDER = ["ko", "en", "fil", "es"];
    const cur = window.I18N.getLang();
    const idx = ORDER.indexOf(cur);
    const next = ORDER[(idx + 1) % ORDER.length];
    window.I18N.setLang(next);
    Storage.setSettings({ lang: next });
    document.documentElement.lang = next;
    const LABELS = { ko: "🇰🇷 한국어", en: "🇺🇸 English", fil: "🇵🇭 Filipino", es: "🇪🇸 Español" };
    addLog("🌐 " + LABELS[next], "log-good");
    try { returnToMenu(); } catch {}
}

// ⋯ 케밥 메뉴 (top-bar 3 아이콘 통합)
function toggleKebab() {
    const menu = document.getElementById("kebab-menu");
    const btn = document.getElementById("kebab-btn");
    if (!menu || !btn) return;
    const open = !menu.classList.contains("hidden");
    if (open) closeKebab();
    else {
        menu.classList.remove("hidden");
        btn.setAttribute("aria-expanded", "true");
        _syncKebabSoundLabel();
    }
}
function closeKebab() {
    const menu = document.getElementById("kebab-menu");
    const btn = document.getElementById("kebab-btn");
    if (menu) menu.classList.add("hidden");
    if (btn) btn.setAttribute("aria-expanded", "false");
}
function _syncKebabSoundLabel() {
    const el = document.getElementById("kebab-sound-label");
    if (el) el.textContent = Sound.enabled ? "사운드 끄기" : "사운드 켜기";
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
    const hpFill = document.getElementById("hp-fill");
    const hpGauge = document.getElementById("hp-gauge");
    if (hpFill) hpFill.style.width = `${shownHp}%`;
    if (hpGauge) hpGauge.dataset.level = shownHp > 60 ? "hi" : shownHp > 30 ? "mid" : "lo";

    // 게임 모드에서만 HP/REP 표시 — 메뉴/통계/설정에선 숨김 (잡스 모드: 컨텍스트 없는 정보 제거)
    const isGameMode = ["survival", "episode", "scenario", "quiz", "mock", "daily", "wrong_review", "handoff", "triage", "image_quiz", "drug_drill", "nclex"].includes(gameState.mode);
    if (hpGauge) hpGauge.classList.toggle("hidden", !isGameMode);
    const repGauge = document.getElementById("rep-gauge");
    if (repGauge) repGauge.classList.toggle("hidden", !isGameMode);
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
    // 메뉴 외 화면에서는 has-tabbar 폴백 클래스 제거 (탭바 없을 때 padding-bottom 회수)
    try { document.body.classList.remove("has-tabbar"); } catch {}
}

// =========================================================================
// 문제 풀기
// =========================================================================
// 이미지 보유 시나리오 풀 — NC.EPISODES 의 image-keyed step을 1회성 듀티 문제로 재활용
// 첫 호출 시 캐시, 이후 재사용 (78개 정도)
let _IMAGED_SCENE_POOL = null;
function _buildImagedScenePool() {
    const out = [];
    if (!NC || !NC.EPISODES) return out;
    for (const ep of NC.EPISODES) {
        if (!ep || !Array.isArray(ep.steps)) continue;
        ep.steps.forEach((s, idx) => {
            if (!s || !s.image) return;
            if (!Array.isArray(s.choices) || s.choices.length < 2) return;
            // 정답 보장
            if (!s.choices.some(c => c && c.correct === true)) return;
            const desc = s.prompt || s.narration || s.title || "";
            if (!desc) return;
            out.push({
                baseId: `scene-${ep.id || "ep"}-${idx}`,
                category: ep.category || "스토리",
                part: s.title || "임상 시각자료",
                emoji: ep.emoji || "🩺",
                title: s.title || ep.title || "임상 사례",
                desc,
                image: s.image,
                choices: s.choices.map(c => ({ ...c })),
            });
        });
    }
    return out;
}

function generateClinicalEventByCategory(category = null) {
    const pool = [];
    // 1. 절차적 generator (questions.js)
    for (const gen of NQ.allGenerators) {
        const ev = gen();
        if ((!category || ev.category === category) && !recentlyUsed(ev.baseId)) pool.push(ev);
    }
    // 2. 이미지 보유 시나리오 (content.js EPISODES) — 카테고리 필터 없을 때만 (듀티 mode)
    if (!category) {
        if (_IMAGED_SCENE_POOL == null) _IMAGED_SCENE_POOL = _buildImagedScenePool();
        for (const ev of _IMAGED_SCENE_POOL) {
            if (!recentlyUsed(ev.baseId)) pool.push(ev);
        }
    }
    if (pool.length === 0) {
        // 모든 후보 소진 → 최근 기록 리셋 후 재충전
        gameState.recentIds = [];
        for (const gen of NQ.allGenerators) {
            const ev = gen();
            if (!category || ev.category === category) pool.push(ev);
        }
        if (!category && _IMAGED_SCENE_POOL) {
            for (const ev of _IMAGED_SCENE_POOL) pool.push(ev);
        }
    }
    const selected = pick(pool);
    if (!selected) return null;
    rememberQuestion(selected.baseId);
    return selected;
}
function isCorrectChoice(c) { return c && c.correct === true; }

// 북마크용 안정 id — 동일 컨텐츠가 동일 id 를 갖도록 baseId + title 해시
function bookmarkIdFor(ev) {
    if (!ev) return "";
    const base = String(ev.baseId || "");
    const title = String(ev.title || "");
    let hash = 0;
    for (let i = 0; i < title.length; i++) hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0;
    return `${base}#${Math.abs(hash).toString(36)}`;
}

// 북마크 가능 모드 — 에피소드/시나리오 step 자체는 컨텍스트가 필요해 제외
const BOOKMARKABLE_MODES = new Set(["survival", "quiz", "mock", "daily", "wrong_review", "episode", "scenario"]);

function renderSceneCard(ev, options = {}) {
    // 방어 — generateClinicalEventByCategory 가 빈 풀로 null 반환 시
    if (!ev) {
        addLog("문제를 불러올 수 없습니다. 메뉴로 돌아갑니다.", "log-bad");
        returnToMenu();
        return;
    }
    const { mode = "survival", questionIndex = null, meta = [], totalSteps = null } = options;
    const tag = ev.category ? `<div class="category-tag">[${escapeHtml(ev.category)}] ${escapeHtml(ev.part || "")}</div>` : "";
    const metaRow = meta.length ? `<div class="meta-row">${meta.map(m => `<div class="meta-chip">${escapeHtml(m)}</div>`).join("")}</div>` : "";

    // 약점 분석 funnel — 어떤 시나리오에서 자주 시작/오답이 발생하는지 기록
    try {
        const sceneId = ev.baseId || ev.title || (questionIndex !== null ? `step-${questionIndex}` : null);
        if (sceneId && mode !== "wrong_review") Storage.recordSceneStart(sceneId, ev.category || null);
    } catch {}

    // 단계 진행 시각화 — 에피소드 등 다단계 모드에서 현재 단계를 dot 으로 표시
    let stepProgressHtml = "";
    if (totalSteps && questionIndex !== null && totalSteps > 1) {
        const segs = [];
        for (let i = 1; i <= totalSteps; i++) {
            const cls = i < questionIndex ? "seg done" : i === questionIndex ? "seg current" : "seg";
            segs.push(`<span class="${cls}" aria-hidden="true"></span>`);
        }
        stepProgressHtml = `
          <div class="step-progress" role="progressbar" aria-valuenow="${questionIndex}" aria-valuemin="1" aria-valuemax="${totalSteps}" aria-label="단계 진행">${segs.join("")}</div>
          <div class="step-progress-label">${questionIndex} / ${totalSteps} 단계</div>`;
    }

    // 북마크 버튼 — 가능 모드에서만 노출
    let bookmarkBtnHtml = "";
    if (BOOKMARKABLE_MODES.has(mode) && ev.baseId) {
        const bmId = bookmarkIdFor(ev);
        const on = Storage.isBookmarked(bmId);
        bookmarkBtnHtml = `<button class="bookmark-toggle ${on ? 'on' : ''}" data-action="toggleSceneBookmark" data-bm-id="${escapeHtml(bmId)}" aria-pressed="${on}" aria-label="${on ? '북마크 해제' : '북마크 추가'}" title="${on ? '북마크 해제' : '북마크 추가'}">
          <svg viewBox="0 0 24 24" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9"/></svg>
        </button>`;
    }

    // 임상 시각자료 — ev.image 키가 있으면 자체 제작 SVG 렌더
    const imageHtml = ev.image ? `<div class="scene-image">${renderClinicalImage(ev.image)}</div>` : "";

    // 힌트 버튼 — 보기 ≥3 + 광고 unit 세팅 + 보상 가능 모드. 1회만 노출.
    const HINT_MODES = new Set(["survival", "episode", "scenario", "quiz", "daily", "wrong_review"]);
    const choicesLen = Array.isArray(ev.choices) ? ev.choices.length : 0;
    const hintEligible = HINT_MODES.has(mode) && choicesLen >= 3 && !!(ADS_UNITS.hint || ADS_UNITS.rewarded);
    const hintUsed = !!ev._hintUsed;
    const hintBtnHtml = hintEligible
        ? `<button class="choice-btn hint-btn" data-action="useHint" data-hint-used="${hintUsed ? '1' : '0'}"${hintUsed ? ' disabled' : ''}>💡 광고 보고 힌트 — 오답 1개 제거 (1회만)</button>`
        : "";

    // 임상 근거 (clinical source attribution) — ev.sourceKey 가 있으면 출처 표시
    const sourceKey = ev.sourceKey || null;
    const sourceTable = (typeof window !== "undefined" && window.CLINICAL_SOURCES)
        || (NC && NC.CLINICAL_SOURCES) || null;
    const srcEntry = (sourceKey && sourceTable) ? sourceTable[sourceKey] : null;
    const clinicalSourceHtml = srcEntry
        ? `<div class="clinical-source-tag">📖 임상 근거: ${escapeHtml(srcEntry.ref)}</div>`
        : "";

    // TTS 읽어주기 버튼 — TTS 사용 가능 + 텍스트가 있을 때만
    const ttsText = (ev.desc || ev.narration || ev.prompt || ev.title || "").slice(0, 500);
    const ttsBtnHtml = (TTS.available && ttsText)
        ? `<button class="tts-btn" data-action="ttsSpeak" data-text="${escapeHtml(ttsText)}" aria-label="장면 읽어주기" title="음성 읽기">🔊</button>`
        : "";

    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        ${bookmarkBtnHtml}
        ${tag}${metaRow}
        ${stepProgressHtml}
        
        <h2 class="scene-title">${questionIndex !== null ? `[Q${questionIndex}] ` : ""}${escapeHtml(ev.title)} ${ttsBtnHtml}</h2>
        ${imageHtml}
        <p class="scene-desc">${escapeHtml(ev.desc)}</p>
        <div class="choice-list" id="choice-list" role="list"></div>
        ${hintBtnHtml}
        ${clinicalSourceHtml}
        <div id="feedback-zone" aria-live="polite" aria-atomic="true"></div>
      </div>
    `;
    // 현재 ev 를 토글에서 참조하도록 저장
    gameState._currentEv = ev;

    // 보기 셔플 — 정답이 항상 1번이라는 위치 편향 제거.
    // 셔플 1회만, ev 에 결과를 저장해 재렌더에서도 같은 순서 유지.
    if (!ev._shuffledChoices) {
        ev._shuffledChoices = shuffle(ev.choices);
    }
    const renderChoices = ev._shuffledChoices;
    const listEl = document.getElementById("choice-list");
    renderChoices.forEach((choice, idx) => {
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

    // 스토리 모드(에피소드/시나리오) — 내레이션 타이핑 효과 + 탭하면 즉시 전체
    if (mode === "episode" || mode === "scenario") {
        startTypewriter(ev.desc);
    }
}

let _typewriterTimer = null;
function startTypewriter(fullText) {
    if (_typewriterTimer) { clearInterval(_typewriterTimer); _typewriterTimer = null; }
    const descEl = document.querySelector(".scene-desc");
    const listEl = document.getElementById("choice-list");
    const card = document.querySelector(".scene-card");
    if (!descEl || !fullText) return;
    // 모션 줄이기 환경 → 타이핑 생략
    const reduce = (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (reduce) { descEl.textContent = fullText; return; }

    descEl.textContent = "";
    descEl.classList.add("typing");
    if (listEl) listEl.classList.add("typing-hidden"); // 타이핑 중 선택지 숨김

    let i = 0, done = false;
    const finish = () => {
        if (done) return; done = true;
        if (_typewriterTimer) { clearInterval(_typewriterTimer); _typewriterTimer = null; }
        descEl.textContent = fullText;
        descEl.classList.remove("typing");
        if (listEl) listEl.classList.remove("typing-hidden");
        if (card) card.removeEventListener("click", skipHandler);
    };
    function skipHandler(e) {
        if (e.target.closest(".choice-btn")) return; // 선택지 클릭은 제외
        finish();
    }
    if (card) card.addEventListener("click", skipHandler);

    _typewriterTimer = setInterval(() => {
        i += 2; // 2글자씩 — 부드러우면서 빠르게
        descEl.textContent = fullText.slice(0, i);
        if (i >= fullText.length) finish();
    }, 16);
}

function dispatchChoice(choice, ev, idx, mode) {
    // 약점 분석 — 오답 기록 (wrong_review 제외, 모든 일반 흐름 공통)
    try {
        if (!isCorrectChoice(choice) && mode !== "wrong_review") {
            const sceneId = ev.baseId || ev.title;
            if (sceneId) Storage.recordSceneWrong(sceneId, ev.category || null);
        }
    } catch {}
    // 스크린리더 announcer — 접근성 (WCAG 4.1.3)
    try { srAnnounce(isCorrectChoice(choice) ? "정답입니다" : "오답입니다. " + (choice.log || "").slice(0, 80)); } catch {}
    if (mode === "survival") handleSurvivalChoice(choice);
    else if (mode === "mock") handleMockChoice(choice, ev);
    else if (mode === "daily") handleDailyChoice(choice, ev);
    else if (mode === "wrong_review") handleWrongReviewChoice(choice, ev);
    else if (mode === "scenario") handleScenarioChoice(choice, ev);
    else if (mode === "episode") handleEpisodeChoice(choice, ev);
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
    document.querySelectorAll(".shift-pill, .shift-option").forEach(o => o.classList.remove("active"));
    if (el) el.classList.add("active");
}
function resetStateForMode() {
    gameState.hp = 100; gameState.rep = 0; gameState.eventCount = 0;
    gameState.items = []; gameState.quizSolved = 0;
    gameState.quizCorrect = 0; gameState.quizWrong = 0;
    gameState.quizSetStartCorrect = 0; gameState.quizSetStartSolved = 0;
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
    gameState.firedStoryBeats = [];
    gameState.reviveCount = 0;
    gameState._lastDeath = null;
    // NCLEX 영어 모드 상태
    gameState.nclexQueue = null;
    gameState.nclexIndex = 0;
    gameState.nclexCorrect = 0;
    gameState.nclexAnswered = 0;
    gameState.nclexCategory = null;
    gameState.nclexSataPick = null;
}
function initSurvival() {
    // 첫 액션 완료 (메인 메뉴 hero-card tooltip 제거)
    try { Storage.setFirstActionDone(); } catch {}
    // 시프트 미선택 또는 이번 세션 첫 진입 시 → 시프트 선택 화면 (잡스: 진입 시점에 한 가지만 결정)
    if (!gameState._shiftPicked) {
        return renderShiftPicker();
    }
    return _initSurvivalReal();
}

function renderShiftPicker() {
    gameState.mode = "shift_picker";
    resetStateForMode();
    showCoreUI();
    if (UI.logBar) UI.logBar.innerHTML = "";
    updateStats();
    const cur = gameState.currentShift || "Day";
    UI.gameArea.innerHTML = `
      <div class="card">
        <h2 class="page-title">시프트 선택</h2>
        <p class="page-sub">난이도가 다릅니다.</p>
        <div class="shift-picker-grid">
          <button class="shift-picker-card ${cur === 'Day' ? 'active' : ''}" data-action="pickShift" data-shift="Day" data-mult="1.0">
            <div class="shift-picker-name">Day</div>
            <div class="shift-picker-mult">기본 난이도</div>
          </button>
          <button class="shift-picker-card ${cur === 'Evening' ? 'active' : ''}" data-action="pickShift" data-shift="Evening" data-mult="1.2">
            <div class="shift-picker-name">Evening</div>
            <div class="shift-picker-mult">× 1.2</div>
          </button>
          <button class="shift-picker-card ${cur === 'Night' ? 'active' : ''}" data-action="pickShift" data-shift="Night" data-mult="1.5">
            <div class="shift-picker-name">Night</div>
            <div class="shift-picker-mult">× 1.5</div>
          </button>
        </div>
        <button class="choice-btn center" data-action="returnToMenu">메뉴</button>
      </div>`;
}

function pickShift(t) {
    const shift = t && t.dataset ? t.dataset.shift : "Day";
    const mult = parseFloat(t && t.dataset ? t.dataset.mult : "1.0") || 1.0;
    setShift(shift, mult, t);
    gameState._shiftPicked = true;
    _initSurvivalReal();
}

function _initSurvivalReal() {
    resetStateForMode();
    const episodes = NC.EPISODES || [];
    if (episodes.length === 0) {
        // 컨텐츠 부재 시 안전한 메뉴 복귀
        addLog("에피소드 컨텐츠가 없습니다.", "log-bad");
        returnToMenu();
        return;
    }
    // 진행 중인 (임상) 에피소드가 있으면 그것부터 이어가기 제안 (일상 미니는 제외)
    const inProgress = episodes
        .filter(ep => !ep.daily)
        .map(ep => ({ ep, progress: Storage.getEpisodeProgress(ep.id) }))
        .filter(x => x.progress && x.progress.step > 0 && x.progress.step < x.ep.steps.length);
    if (inProgress.length > 0) {
        return renderEpisodeResumeChoice(inProgress[0].ep, inProgress[0].progress);
    }
    // 일상(틈새) 미니 에피소드 — ~28% 확률로 가끔 등장 (휴식·식사·퇴근 등)
    const lifeEps = episodes.filter(ep => ep.daily);
    let target;
    if (lifeEps.length > 0 && Math.random() < 0.28) {
        target = lifeEps[Math.floor(Math.random() * lifeEps.length)];
    } else {
        // 미완료 임상 에피소드 우선 랜덤 (일상 미니 제외)
        const data = Storage.load();
        const done = data.episodes || {};
        const clinical = episodes.filter(ep => !ep.daily);
        const pool = clinical.filter(ep => !done[ep.id] || !done[ep.id].completed);
        const fromPool = pool.length > 0 ? pool : clinical;
        target = fromPool[Math.floor(Math.random() * fromPool.length)];
    }
    const sensitive = sensitiveLabelFor(target.id);
    if (target.daily) {
        addLog(`🌙 잠깐의 일상 — ${target.title}`, "log-important");
    } else if (sensitive) {
        addLog(`🎲 듀티 시뮬레이션 — 오늘의 에피소드: ${target.title}`, "log-important");
        addLog(`⚠️ 민감 컨텐츠 포함 (${sensitive}). 어렵다면 메인 메뉴로 돌아가세요.`, "log-bad");
    } else {
        addLog(`🎲 듀티 시뮬레이션 — 오늘의 에피소드: ${target.title}`, "log-important");
    }
    beginEpisode(target.id, 0, 100, 0);
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
    if (isCorrect) { bumpCombo(); Sound.correct(); checkAndNotifyAchievements(); }
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
        <h3 class="episode-group-label">🎲 전체 랜덤</h3>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="startQuiz" data-arg="__random__">🎲 8과목 통합 랜덤</button>
        </div>
        <h3 class="episode-group-label">📚 과목별</h3>
        <div class="choice-list">
          ${CATEGORIES.map(c => `<button class="choice-btn primary" data-action="startQuiz" data-arg="${escapeHtml(c)}">${c}</button>`).join("")}
          <button class="choice-btn center" data-action="returnToMenu">메인 메뉴</button>
        </div>
      </div>`;
}

// =========================================================================
// 이미지 문제 모음 — 모든 에피소드·시나리오에서 image 가 있는 step 만 추려서 퀴즈로
// =========================================================================
function collectImageScenes() {
    const scenes = [];
    const episodes = NC.EPISODES || [];
    episodes.forEach(ep => {
        (ep.steps || []).forEach((step, idx) => {
            if (step.image && Array.isArray(step.choices) && step.choices.length >= 2) {
                scenes.push({
                    src: "episode",
                    sourceId: ep.id,
                    sourceTitle: ep.title,
                    stepIdx: idx,
                    image: step.image,
                    prompt: step.prompt || step.narration || step.title || "",
                    title: step.title || `${ep.title} — ${idx + 1}단계`,
                    choices: step.choices,
                });
            }
        });
    });
    const scenarios = NC.SCENARIOS || [];
    scenarios.forEach(sc => {
        (sc.steps || []).forEach((step, idx) => {
            if (step.image && Array.isArray(step.choices) && step.choices.length >= 2) {
                scenes.push({
                    src: "scenario",
                    sourceId: sc.id,
                    sourceTitle: sc.title,
                    stepIdx: idx,
                    image: step.image,
                    prompt: step.prompt || step.narration || "",
                    title: step.title || sc.title,
                    choices: step.choices,
                });
            }
        });
    });
    return scenes;
}

// =========================================================================
// 학습 진입 메뉴 — 잡스 컷 (9개 → 3개 → 세부)
// =========================================================================
function renderPracticeMenu() {
    gameState.mode = "practice_menu"; resetStateForMode();
    showCoreUI(); if (UI.logBar) UI.logBar.innerHTML = ""; updateStats();
    const examMode = Storage.getExamMode();
    const nclexBtn = examMode === "nclex"
        ? `<button class="row-card" data-action="renderNclexMenuLazy">
              <div class="row-icon">${ICONS.training}</div>
              <div class="row-body"><div class="row-title">NCLEX-RN</div><div class="row-sub">2,200 문제 · MCQ · SATA · Priority</div></div>
              <div class="row-chev">›</div>
           </button>` : "";
    UI.gameArea.innerHTML = `
      <div class="tab-section">
        <h2 class="page-title">풀이</h2>
        <p class="page-sub">빠른 풀이로 점수 만들기.</p>
        ${nclexBtn}
        <button class="row-card" data-action="renderSubjectStudyMenu">
          <div class="row-icon">${ICONS.training}</div>
          <div class="row-body"><div class="row-title">과목별 학습</div><div class="row-sub">국시 8과목 · 정식 5지선다 + 무한 변형</div></div>
          <div class="row-chev">›</div>
        </button>
        <button class="row-card" data-action="startMockExam">
          <div class="row-icon">${ICONS.mock}</div>
          <div class="row-body"><div class="row-title">모의고사</div><div class="row-sub">${MOCK_EXAM_TOTAL}문제 · ${MOCK_EXAM_SECONDS / 60}분</div></div>
          <div class="row-chev">›</div>
        </button>
        <button class="row-card" data-action="startDailyChallenge">
          <div class="row-icon">${ICONS.daily}</div>
          <div class="row-body"><div class="row-title">일일 챌린지</div><div class="row-sub">매일 ${DAILY_CHALLENGE_TOTAL}문제</div></div>
          <div class="row-chev">›</div>
        </button>
        <button class="choice-btn center" data-action="returnToMenu">메뉴</button>
      </div>`;
}

// 통합: 한국 국시 정적(5지선다) + 과목별 변형 연습(generator)
function renderSubjectStudyMenu() {
    gameState.mode = "subject_study_menu"; resetStateForMode();
    showCoreUI(); if (UI.logBar) UI.logBar.innerHTML = ""; updateStats();
    const korCount = (typeof window !== "undefined" && window.KOR_QUESTIONS && Array.isArray(window.KOR_QUESTIONS)) ? window.KOR_QUESTIONS.length : 0;
    const korBtn = korCount > 0
        ? `<button class="row-card" data-action="renderKorMenu">
             <div class="row-icon">${ICONS.training}</div>
             <div class="row-body"><div class="row-title">정식 국시 (5지선다)</div><div class="row-sub">${korCount}문제 · 8과목 · KNCA 출제기준</div></div>
             <div class="row-chev">›</div>
           </button>` : "";
    UI.gameArea.innerHTML = `
      <div class="tab-section">
        <h2 class="page-title">과목별 학습</h2>
        <p class="page-sub">시험 그대로 vs 무한 변형 연습.</p>
        ${korBtn}
        <button class="row-card" data-action="renderQuizMenu">
          <div class="row-icon">${ICONS.training}</div>
          <div class="row-body"><div class="row-title">변형 연습 (무한 랜덤)</div><div class="row-sub">국시 8과목 · 같은 유형 다른 숫자/임상</div></div>
          <div class="row-chev">›</div>
        </button>
        <button class="choice-btn center" data-action="renderPracticeMenu">뒤로</button>
      </div>`;
}

function renderSimMenu() {
    gameState.mode = "sim_menu"; resetStateForMode();
    showCoreUI(); if (UI.logBar) UI.logBar.innerHTML = ""; updateStats();
    UI.gameArea.innerHTML = `
      <div class="tab-section">
        <h2 class="page-title">시뮬레이션</h2>
        <p class="page-sub">실제 듀티처럼 한 사례를 끝까지.</p>
        <button class="row-card" data-action="renderCaseMenu">
          <div class="row-icon">${ICONS.episode}</div>
          <div class="row-body"><div class="row-title">사례 학습</div><div class="row-sub">에피소드 35편 + 짧은 시나리오</div></div>
          <div class="row-chev">›</div>
        </button>
        <button class="choice-btn center" data-action="returnToMenu">메뉴</button>
      </div>`;
}

// 통합: 에피소드(35편 장편) + 짧은 시나리오(단편)
function renderCaseMenu() {
    gameState.mode = "case_menu"; resetStateForMode();
    showCoreUI(); if (UI.logBar) UI.logBar.innerHTML = ""; updateStats();
    UI.gameArea.innerHTML = `
      <div class="tab-section">
        <h2 class="page-title">사례 학습</h2>
        <p class="page-sub">시간 여유에 맞춰 골라.</p>
        <button class="row-card" data-action="renderEpisodeMenu">
          <div class="row-icon">${ICONS.episode}</div>
          <div class="row-body"><div class="row-title">에피소드 (장편)</div><div class="row-sub">한 듀티 전체 · 35편 · 30-60분</div></div>
          <div class="row-chev">›</div>
        </button>
        <button class="row-card" data-action="renderScenarioMenu">
          <div class="row-icon">${ICONS.scenario}</div>
          <div class="row-body"><div class="row-title">짧은 시나리오 (단편)</div><div class="row-sub">단편 임상 의사결정 · 10분 내</div></div>
          <div class="row-chev">›</div>
        </button>
        <button class="choice-btn center" data-action="renderSimMenu">뒤로</button>
      </div>`;
}

function renderDrillMenu() {
    gameState.mode = "drill_menu"; resetStateForMode();
    showCoreUI(); if (UI.logBar) UI.logBar.innerHTML = ""; updateStats();
    UI.gameArea.innerHTML = `
      <div class="tab-section">
        <h2 class="page-title">훈련</h2>
        <p class="page-sub">한 가지를 깊이.</p>
        <button class="row-card" data-action="renderImageQuizMenu">
          <div class="row-icon">${ICONS.scenario}</div>
          <div class="row-body"><div class="row-title">이미지 문제</div><div class="row-sub">ECG · 청진 · 산과 · 신경</div></div>
          <div class="row-chev">›</div>
        </button>
        <button class="row-card" data-action="renderDrugDrill">
          <div class="row-icon">${ICONS.training}</div>
          <div class="row-body"><div class="row-title">약물 드릴</div><div class="row-sub">핵심 약물 50종</div></div>
          <div class="row-chev">›</div>
        </button>
        <button class="row-card" data-action="startHandoff">
          <div class="row-icon">${ICONS.handoff}</div>
          <div class="row-body"><div class="row-title">인계 시뮬</div><div class="row-sub">100명 풀 셔플</div></div>
          <div class="row-chev">›</div>
        </button>
        <button class="row-card" data-action="startTriage">
          <div class="row-icon">${ICONS.triage}</div>
          <div class="row-body"><div class="row-title">트리아지</div><div class="row-sub">응급실 다중환자 분류</div></div>
          <div class="row-chev">›</div>
        </button>
        <button class="choice-btn center" data-action="returnToMenu">메뉴</button>
      </div>`;
}

// =========================================================================
// 한국 국시 정적 문제 (kor-content.js) — 5지선다, 8과목 × 30
// =========================================================================
function renderKorMenu() {
    gameState.mode = "kor_menu";
    resetStateForMode();
    showCoreUI();
    if (UI.logBar) UI.logBar.innerHTML = "";
    updateStats();
    const qs = (typeof window !== "undefined" && window.KOR_QUESTIONS) || [];
    if (qs.length === 0) {
        UI.gameArea.innerHTML = `
          <div class="scene-card card">
            <h2 class="scene-title">한국 국시 정적 문제</h2>
            <p class="scene-desc">문제 데이터를 불러올 수 없습니다.</p>
            <button class="choice-btn center" data-action="returnToMenu">메뉴</button>
          </div>`;
        return;
    }
    const cats = (window.KOR_CATEGORIES || []).slice();
    const counts = {};
    qs.forEach(q => counts[q.category] = (counts[q.category] || 0) + 1);
    const catBtns = cats.map(c => `
      <button class="choice-btn primary" data-action="startKorQuiz" data-arg="${escapeHtml(c)}">
        ${escapeHtml(c)} (${counts[c] || 0})
      </button>`).join("");
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">한국 국시 정적 문제</h2>
        <p class="scene-desc">정식 5지선다 ${qs.length}문제. 출처 인용 포함 (KNCA / 대한○○학회 / 의료법). 카테고리 또는 무작위 선택.</p>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="startKorQuiz" data-arg="__all__">🎯 전체 무작위 (${qs.length})</button>
          ${catBtns}
          <button class="choice-btn center" data-action="returnToMenu">메뉴</button>
        </div>
      </div>`;
    track("kor_menu_open", { total: qs.length });
}

function startKorQuiz(t) {
    const arg = (t && t.dataset && t.dataset.arg) || "__all__";
    const all = (window.KOR_QUESTIONS || []).slice();
    let pool = arg === "__all__" ? all : all.filter(q => q.category === arg);
    if (pool.length === 0) { addLog("선택한 과목에 문제가 없습니다.", "log-bad"); renderKorMenu(); return; }
    // Fisher-Yates 셔플
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    gameState.mode = "kor_quiz";
    gameState.korPool = pool;
    gameState.korIndex = 0;
    gameState.korCorrect = 0;
    gameState.korCategory = arg === "__all__" ? null : arg;
    try { Storage.markModeUsed("kor_quiz"); } catch {}
    renderKorCard();
    track("kor_quiz_start", { category: arg, count: pool.length });
}

function renderKorCard() {
    const pool = gameState.korPool || [];
    const i = gameState.korIndex || 0;
    if (i >= pool.length) { renderKorSummary(); return; }
    const q = pool[i];
    // 보기 셔플 (정답 위치 랜덤)
    if (!q._shuffled) {
        const arr = q.choices.slice();
        for (let k = arr.length - 1; k > 0; k--) {
            const j = Math.floor(Math.random() * (k + 1));
            [arr[k], arr[j]] = [arr[j], arr[k]];
        }
        q._shuffled = arr;
    }
    const choicesHtml = q._shuffled.map((c, idx) => `
      <button class="choice-btn" data-action="korQuizAnswer" data-idx="${idx}">${escapeHtml(c.text)}</button>
    `).join("");
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <div class="quiz-progress">한국 국시 ${i + 1}/${pool.length} · ${escapeHtml(q.category)}</div>
        <h2 class="scene-title">${escapeHtml(q.title)}</h2>
        <p class="scene-desc">${escapeHtml(q.desc)}</p>
        <div class="choice-list" id="kor-choices">${choicesHtml}</div>
        <div id="kor-feedback" class="image-quiz-feedback hidden"></div>
        <button class="choice-btn subtle center hidden" id="kor-next-btn" data-action="korQuizNext">다음 →</button>
        <button class="choice-btn center" data-action="returnToMenu">중단하고 메뉴로</button>
      </div>`;
}

function korQuizAnswer(t) {
    const pool = gameState.korPool || [];
    const i = gameState.korIndex || 0;
    const q = pool[i];
    if (!q) return;
    const idx = parseInt(t.dataset.idx, 10);
    const choice = q._shuffled[idx];
    if (!choice) return;
    const isCorrect = !!choice.correct;
    if (isCorrect) { gameState.korCorrect = (gameState.korCorrect || 0) + 1; Sound.correct(); }
    else { Sound.wrong(); }
    document.querySelectorAll("#kor-choices .choice-btn").forEach((btn, bi) => {
        btn.disabled = true;
        const c = q._shuffled[bi];
        if (c && c.correct) btn.classList.add("correct-flash");
        else if (bi === idx) btn.classList.add("wrong-flash");
    });
    const fb = document.getElementById("kor-feedback");
    if (fb) {
        fb.innerHTML = `
          <div class="${isCorrect ? "feedback-good" : "feedback-bad"}">${isCorrect ? "✅ 정답" : "❌ 오답"}</div>
          <div class="feedback-log">${escapeHtml(choice.log || "")}</div>`;
        fb.classList.remove("hidden");
    }
    const nextBtn = document.getElementById("kor-next-btn");
    if (nextBtn) nextBtn.classList.remove("hidden");
    track("kor_quiz_answer", { correct: isCorrect, category: q.category });
}

function korQuizNext() {
    gameState.korIndex = (gameState.korIndex || 0) + 1;
    renderKorCard();
}

function renderKorSummary() {
    const total = (gameState.korPool || []).length;
    const correct = gameState.korCorrect || 0;
    const acc = total > 0 ? Math.round((correct / total) * 100) : 0;
    try {
        Storage.recordSetScore("한국 국시 — " + (gameState.korCategory || "전체"), correct, total);
        checkAndNotifyAchievements();
    } catch {}
    // 100% 셀레브레이션
    if (total > 0 && correct === total) { try { launchConfetti(); Haptics.heavy(); } catch {} }
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">한국 국시 완료</h2>
        <div class="quiz-summary-stats">
          <div class="quiz-stat-row"><span>총 문제</span><strong>${total}</strong></div>
          <div class="quiz-stat-row"><span>정답</span><strong>${correct}</strong></div>
          <div class="quiz-stat-row"><span>정답률</span><strong>${acc}%</strong></div>
        </div>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="renderKorMenu">다시 풀기</button>
          <button class="choice-btn center" data-action="returnToMenu">메뉴</button>
        </div>
      </div>`;
    track("kor_quiz_complete", { total, correct, acc });
}

function renderImageQuizMenu() {
    gameState.mode = "image_quiz_menu";
    resetStateForMode();
    showCoreUI();
    if (UI.logBar) UI.logBar.innerHTML = "";
    updateStats();
    const scenes = collectImageScenes();
    if (scenes.length === 0) {
        UI.gameArea.innerHTML = `
          <div class="scene-card card">
            <h2 class="scene-title">이미지 문제</h2>
            <p class="scene-desc">아직 이미지 문제가 없어요.</p>
            <button class="choice-btn center" data-action="returnToMenu">메인 메뉴</button>
          </div>`;
        return;
    }
    const buckets = { ECG: [], 청진: [], 산과: [], 신경: [], 화상상처: [], 영상: [], 기타: [] };
    scenes.forEach(s => {
        const k = s.image || "";
        if (k.startsWith("ecg:")) buckets.ECG.push(s);
        else if (k.startsWith("ausc:")) buckets.청진.push(s);
        else if (k.startsWith("fhr:") || k.startsWith("fundal:")) buckets.산과.push(s);
        else if (k.startsWith("pupil:") || k.startsWith("glasgow:")) buckets.신경.push(s);
        else if (k.startsWith("wound:") || k === "rule-of-nines") buckets.화상상처.push(s);
        else if (k.startsWith("cxr:") || k.startsWith("aed:")) buckets.영상.push(s);
        else buckets.기타.push(s);
    });
    const bucketBtns = Object.entries(buckets)
        .filter(([_, list]) => list.length > 0)
        .map(([name, list]) => `
          <button class="choice-btn primary" data-action="startImageQuiz" data-bucket="${escapeHtml(name)}">
            ${name} (${list.length}문제)
          </button>`).join("");
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">이미지 문제</h2>
        <p class="scene-desc">에피소드·시나리오의 임상 이미지 문제 ${scenes.length}개를 모았어요. 카테고리를 선택하세요.</p>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="startImageQuiz" data-bucket="__all__">🎯 전체 (${scenes.length}문제, 무작위)</button>
          ${bucketBtns}
          <button class="choice-btn center" data-action="returnToMenu">메인 메뉴</button>
        </div>
      </div>`;
    track("image_quiz_menu_open", { total: scenes.length });
}

function startImageQuiz(t) {
    const bucket = t && t.dataset ? t.dataset.bucket : "__all__";
    const all = collectImageScenes();
    let pool = all;
    if (bucket !== "__all__") {
        pool = all.filter(s => {
            const k = s.image || "";
            if (bucket === "ECG") return k.startsWith("ecg:");
            if (bucket === "청진") return k.startsWith("ausc:");
            if (bucket === "산과") return k.startsWith("fhr:") || k.startsWith("fundal:");
            if (bucket === "신경") return k.startsWith("pupil:") || k.startsWith("glasgow:");
            if (bucket === "화상상처") return k.startsWith("wound:") || k === "rule-of-nines";
            if (bucket === "영상") return k.startsWith("cxr:") || k.startsWith("aed:");
            return !["ecg:", "ausc:", "fhr:", "fundal:", "pupil:", "glasgow:", "wound:", "cxr:", "aed:"].some(p => k.startsWith(p)) && k !== "rule-of-nines";
        });
    }
    if (pool.length === 0) {
        addLog("해당 카테고리에 문제가 없습니다.", "log-bad");
        renderImageQuizMenu();
        return;
    }
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    gameState.mode = "image_quiz";
    gameState.imageQuizPool = shuffled;
    gameState.imageQuizIndex = 0;
    gameState.imageQuizCorrect = 0;
    gameState.imageQuizBucket = bucket;
    renderImageQuizCard();
    track("image_quiz_start", { bucket, count: shuffled.length });
}

function renderImageQuizCard() {
    const pool = gameState.imageQuizPool || [];
    const i = gameState.imageQuizIndex || 0;
    if (i >= pool.length) { renderImageQuizSummary(); return; }
    const scene = pool[i];
    if (!scene._shuffled) {
        const arr = [...scene.choices];
        for (let k = arr.length - 1; k > 0; k--) {
            const j = Math.floor(Math.random() * (k + 1));
            [arr[k], arr[j]] = [arr[j], arr[k]];
        }
        scene._shuffled = arr;
    }
    showCoreUI();
    updateStats();
    const imgHtml = `<div class="scene-image">${renderClinicalImage(scene.image)}</div>`;
    const choicesHtml = scene._shuffled.map((c, idx) => `
        <button class="choice-btn" data-action="imageQuizAnswer" data-idx="${idx}">${escapeHtml(c.text)}</button>
    `).join("");
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <div class="quiz-progress">📷 이미지 문제 ${i + 1}/${pool.length} · ${escapeHtml(scene.sourceTitle)}</div>
        <h2 class="scene-title">${escapeHtml(scene.title)}</h2>
        ${imgHtml}
        ${scene.prompt ? `<p class="scene-desc">${escapeHtml(scene.prompt)}</p>` : ""}
        <div class="choice-list" id="image-quiz-choices">${choicesHtml}</div>
        <div id="image-quiz-feedback" class="image-quiz-feedback hidden"></div>
        <button class="choice-btn subtle center hidden" id="image-quiz-next-btn" data-action="imageQuizNext">다음 →</button>
        <button class="choice-btn center" data-action="returnToMenu">중단하고 메뉴로</button>
      </div>`;
}

function imageQuizAnswer(t) {
    const pool = gameState.imageQuizPool || [];
    const i = gameState.imageQuizIndex || 0;
    const scene = pool[i];
    if (!scene) return;
    const idx = parseInt(t.dataset.idx, 10);
    const choice = scene._shuffled[idx];
    if (!choice) return;
    const isCorrect = !!choice.correct;
    if (isCorrect) {
        gameState.imageQuizCorrect = (gameState.imageQuizCorrect || 0) + 1;
        Sound.correct();
        try { Storage.incrementImageCorrect(); } catch {}
    } else { Sound.wrong(); }
    document.querySelectorAll("#image-quiz-choices .choice-btn").forEach((btn, bi) => {
        btn.disabled = true;
        const c = scene._shuffled[bi];
        if (c && c.correct) btn.classList.add("correct-flash");
        else if (bi === idx) btn.classList.add("wrong-flash");
    });
    const fb = document.getElementById("image-quiz-feedback");
    if (fb) {
        fb.innerHTML = `
            <div class="${isCorrect ? "feedback-good" : "feedback-bad"}">${isCorrect ? "✅ 정답" : "❌ 오답"}</div>
            <div class="feedback-log">${escapeHtml(choice.log || "")}</div>`;
        fb.classList.remove("hidden");
    }
    const nextBtn = document.getElementById("image-quiz-next-btn");
    if (nextBtn) nextBtn.classList.remove("hidden");
    track("image_quiz_answer", { correct: isCorrect, image: scene.image });
}

function imageQuizNext() {
    gameState.imageQuizIndex = (gameState.imageQuizIndex || 0) + 1;
    renderImageQuizCard();
}

function renderImageQuizSummary() {
    const total = (gameState.imageQuizPool || []).length;
    const correct = gameState.imageQuizCorrect || 0;
    const acc = total > 0 ? Math.round((correct / total) * 100) : 0;
    if (total > 0 && correct === total) { try { launchConfetti(); Haptics.heavy(); } catch {} }
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">완료</h2>
        <div class="quiz-summary-stats">
            <div class="quiz-stat-row"><span>총 문제</span><strong>${total}</strong></div>
            <div class="quiz-stat-row"><span>정답</span><strong>${correct}</strong></div>
            <div class="quiz-stat-row"><span>정답률</span><strong>${acc}%</strong></div>
        </div>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="renderImageQuizMenu">다시 풀기</button>
          <button class="choice-btn center" data-action="returnToMenu">메인 메뉴</button>
        </div>
      </div>`;
    track("image_quiz_complete", { total, correct, acc });
}
const QUIZ_SET_SIZE = 10; // 한 세트 = 10문제 (종결감 + 진행도)
function startQuiz(category) {
    // "__random__" = 8과목 통합 랜덤 (category null → 전체 풀 출제)
    if (category === "__random__") category = null;
    gameState.mode = "quiz"; gameState.quizCategory = category;
    gameState.quizSolved = 0; gameState.quizCorrect = 0; gameState.quizWrong = 0;
    gameState.quizSetStartCorrect = 0; gameState.quizSetStartSolved = 0;
    const label = category || "8과목 통합 랜덤";
    UI.logBar.innerHTML = ""; addLog(`${label} 풀이를 시작합니다. (한 세트 ${QUIZ_SET_SIZE}문제)`, "log-important");
    renderNextQuizQuestion();
}
function renderNextQuizQuestion() {
    const inSet = (gameState.quizSolved % QUIZ_SET_SIZE) + 1; // 현재 세트 내 위치 (1~10)
    const catLabel = gameState.quizCategory || "🎲 통합 랜덤";
    renderSceneCard(generateClinicalEventByCategory(gameState.quizCategory), {
        mode: "quiz", questionIndex: gameState.quizSolved + 1,
        totalSteps: QUIZ_SET_SIZE,
        meta: [catLabel, `세트 ${inSet}/${QUIZ_SET_SIZE}`, `총 ${gameState.quizSolved}문제 · 정답률 ${gameState.quizSolved > 0 ? Math.round(gameState.quizCorrect / gameState.quizSolved * 100) : 0}%`]
    });
}
// 한 세트(10문제) 완료 시 결과 요약 + 계속/종료 선택
function renderQuizSetSummary() {
    const setNum = Math.floor(gameState.quizSolved / QUIZ_SET_SIZE);
    const setCorrect = gameState.quizCorrect - gameState.quizSetStartCorrect;
    const acc = Math.round((setCorrect / QUIZ_SET_SIZE) * 100);
    const catLabel = gameState.quizCategory || "8과목 통합 랜덤";
    let msg, emoji;
    if (acc >= 90) { emoji = "🏆"; msg = "완벽에 가까워요! 이 과목은 자신감 가져도 됩니다."; }
    else if (acc >= 70) { emoji = "🌟"; msg = "안정적입니다. 틀린 문제는 오답노트에서 복습하세요."; }
    else if (acc >= 50) { emoji = "📚"; msg = "절반은 맞췄어요. 오답노트 + 한 세트 더 권장."; }
    else { emoji = "💪"; msg = "어려운 과목이네요. 오답노트 복습이 가장 빠른 길입니다."; }
    // 다음 세트 기준점 갱신
    gameState.quizSetStartCorrect = gameState.quizCorrect;
    gameState.quizSetStartSolved = gameState.quizSolved;
    Storage.addHistory({ mode: "quiz", at: Date.now(), category: gameState.quizCategory, total: QUIZ_SET_SIZE, correct: setCorrect, accuracy: acc, set: setNum });
    try { Storage.recordSetScore(catLabel, setCorrect, QUIZ_SET_SIZE); Storage.markModeUsed("quiz"); } catch {}
    try { checkAndNotifyAchievements(); } catch {}
    try { maybeShowReviewPrompt(); } catch {}
    // 완벽 세트 (10/10) 셀레브레이션 — confetti + 진동
    if (setCorrect === QUIZ_SET_SIZE) {
        try { launchConfetti(); } catch {}
        try { Haptics.heavy(); } catch {}
        try { srAnnounce("완벽한 세트입니다. 10문제 모두 정답입니다."); } catch {}
    }
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        
        <h2 class="scene-title">세트 ${setNum} 완료 — ${escapeHtml(catLabel)}</h2>
        <div class="dashboard-row" role="group" aria-label="세트 결과">
          <div class="dash-stat"><div class="ds-num">${setCorrect}/${QUIZ_SET_SIZE}</div><div class="ds-label">이번 세트</div></div>
          <div class="dash-stat"><div class="ds-num">${acc}%</div><div class="ds-label">세트 정답률</div></div>
          <div class="dash-stat"><div class="ds-num">${gameState.quizSolved}</div><div class="ds-label">누적 풀이</div></div>
          <div class="dash-stat"><div class="ds-num">${gameState.bestCombo}</div><div class="ds-label">최고 콤보</div></div>
        </div>
        <p class="scene-desc">${msg}</p>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="quizContinue">한 세트 더 (${QUIZ_SET_SIZE}문제)</button>
          ${gameState.quizWrong > 0 ? `<button class="choice-btn" data-action="reviewWrongAnswers">오답노트 복습 (${gameState.quizWrong})</button>` : ""}
          <button class="choice-btn" data-action="shareResultCard" data-mode="quiz" data-title="${escapeHtml(catLabel)} 세트 ${setNum}" data-lines="이번 세트 ${setCorrect}/${QUIZ_SET_SIZE} (${acc}%)|누적 ${gameState.quizSolved}문제|간호사 시뮬레이터">결과 카드</button>
          <button class="choice-btn" data-action="renderQuizMenu">과목 변경</button>
          <button class="choice-btn" data-action="returnToMenu">메인 메뉴</button>
        </div>
      </div>`;
}
function quizContinue() {
    track("quiz_set_completed", { category: gameState.quizCategory });
    renderNextQuizQuestion();
}

// =========================================================================
// NCLEX-RN 영어 모드 — 카테고리별 문제풀이 (MCQ / SATA / Priority)
// 데이터: window.NCLEX_CATEGORIES, window.NCLEX_QUESTIONS (nclex-content.js)
// 한국 국시 퀴즈 흐름과 별도 — 무한 랜덤이 아닌 카테고리별 풀 셔플 1세트
// =========================================================================
// NCLEX 동적 로더 — 첫 진입 시에만 nclex-content.js 다운로드 (2MB)
// 초기 부팅 시간 단축: 4-10s 절약 (3G/저사양 안드로이드)
let _nclexLoadPromise = null;
function loadNclexContent() {
    if (_nclexAvailable()) return Promise.resolve(true);
    if (_nclexLoadPromise) return _nclexLoadPromise;
    _nclexLoadPromise = new Promise((resolve) => {
        try {
            const s = document.createElement("script");
            s.src = "nclex-content.js";
            s.async = true;
            s.onload = () => { track("nclex_loaded"); resolve(_nclexAvailable()); };
            s.onerror = () => { track("nclex_load_fail"); resolve(false); };
            document.head.appendChild(s);
        } catch { resolve(false); }
    });
    return _nclexLoadPromise;
}

// NCLEX 메뉴 진입 — 로딩 중이면 스피너 표시
async function renderNclexMenuLazy() {
    if (_nclexAvailable()) return renderNclexMenu();
    gameState.mode = "nclex_loading"; resetStateForMode(); showCoreUI();
    UI.gameArea.innerHTML = `
      <div class="scene-card card" style="text-align:center;padding:48px 24px;">
        <div class="loader-mark" style="margin: 0 auto 16px;">🇺🇸</div>
        <h2 class="scene-title">NCLEX-RN 콘텐츠 로딩 중...</h2>
        <p class="scene-desc">2,200 문제 준비 중 (첫 진입 시 1회만)</p>
      </div>`;
    const ok = await loadNclexContent();
    if (ok) renderNclexMenu();
    else {
        UI.gameArea.innerHTML = `
          <div class="scene-card card">
            <h2 class="scene-title">NCLEX-RN Practice</h2>
            <p class="scene-desc">NCLEX content failed to load. Check internet connection or reinstall.</p>
            <div class="choice-list">
              <button class="choice-btn primary" data-action="renderNclexMenuLazy">Retry</button>
              <button class="choice-btn" data-action="returnToMenu">Back to Menu</button>
            </div>
          </div>`;
    }
}

function _nclexAvailable() {
    return typeof window !== "undefined"
        && Array.isArray(window.NCLEX_CATEGORIES)
        && Array.isArray(window.NCLEX_QUESTIONS)
        && window.NCLEX_QUESTIONS.length > 0;
}

function renderNclexMenu() {
    gameState.mode = "nclex_menu"; resetStateForMode();
    showCoreUI(); UI.logBar.innerHTML = "";
    if (!_nclexAvailable()) {
        UI.gameArea.innerHTML = `
          <div class="scene-card card">
            <h2 class="scene-title">NCLEX-RN Practice</h2>
            <p class="scene-desc">NCLEX content failed to load. Please reinstall or report the issue.</p>
            <div class="choice-list">
              <button class="choice-btn" data-action="returnToMenu">Back to Menu</button>
            </div>
          </div>`;
        return;
    }
    addLog("NCLEX-RN practice — English-language US licensing prep.", "log-important");
    const cats = window.NCLEX_CATEGORIES;
    const counts = {};
    cats.forEach(c => { counts[c] = window.NCLEX_QUESTIONS.filter(q => q.category === c).length; });
    const buttons = cats.map(c => `<button class="choice-btn primary" data-action="startNclexQuiz" data-arg="${escapeHtml(c)}">${escapeHtml(c)} <small>(${counts[c]})</small></button>`).join("");
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">🇺🇸 NCLEX-RN Practice</h2>
        <p class="scene-desc">US RN licensing prep — 4 client need categories.\nIncludes standard MCQ, SATA (Select All That Apply), and Priority items.</p>
        <h3 class="episode-group-label">🎲 Mixed</h3>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="startNclexQuiz" data-arg="__random__">🎲 All Categories (Random)</button>
        </div>
        <h3 class="episode-group-label">📚 By Client Need Category</h3>
        <div class="choice-list">
          ${buttons}
          <button class="choice-btn center" data-action="returnToMenu">Back to Menu</button>
        </div>
      </div>`;
}

function _nclexShuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function startNclexQuiz(category) {
    if (!_nclexAvailable()) { renderNclexMenu(); return; }
    gameState.mode = "nclex_quiz";
    const isRandom = !category || category === "__random__";
    const pool = isRandom
        ? window.NCLEX_QUESTIONS.slice()
        : window.NCLEX_QUESTIONS.filter(q => q.category === category);
    if (pool.length === 0) {
        addLog("No questions in this category.", "log-bad");
        renderNclexMenu();
        return;
    }
    gameState.nclexQueue = _nclexShuffle(pool);
    gameState.nclexCategory = isRandom ? null : category;
    gameState.nclexIndex = 0;
    gameState.nclexCorrect = 0;
    gameState.nclexAnswered = 0;
    gameState.nclexSataPick = new Set();
    UI.logBar.innerHTML = "";
    addLog(`NCLEX-RN — ${isRandom ? "All categories" : category} (${pool.length} items)`, "log-important");
    track("nclex_quiz_started", { category: isRandom ? "__random__" : category, total: pool.length });
    renderNclexQuestion();
}

function renderNclexQuestion() {
    const q = gameState.nclexQueue && gameState.nclexQueue[gameState.nclexIndex];
    if (!q) { renderNclexSummary(); return; }
    showCoreUI();
    const idx = gameState.nclexIndex + 1;
    const total = gameState.nclexQueue.length;
    const typeLabel = q.type === "sata" ? "SATA — Select all that apply"
        : q.type === "priority" ? "PRIORITY — Choose the highest-acuity client"
        : "Multiple choice";
    gameState.nclexSataPick = new Set();

    let choicesHtml = "";
    if (q.type === "sata") {
        // Render checkboxes; user toggles, then submits
        choicesHtml = q.choices.map((c, i) => `
          <button class="choice-btn sata-choice" data-action="nclexSataToggle" data-i="${i}" aria-pressed="false">
            <span class="sata-box" aria-hidden="true">☐</span>
            <span class="sata-text">${escapeHtml(c.text)}</span>
          </button>`).join("");
        choicesHtml += `<button class="choice-btn primary" data-action="nclexSataSubmit">Submit</button>`;
    } else {
        // mcq + priority: single-choice tap to lock answer
        choicesHtml = q.choices.map((c, i) => `
          <button class="choice-btn" data-action="nclexAnswer" data-i="${i}">${escapeHtml(c.text)}</button>`).join("");
    }

    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <div class="scene-meta-row">
          <span class="scene-meta">${escapeHtml(q.category)}</span>
          <span class="scene-meta">${idx} / ${total}</span>
          <span class="scene-meta">${typeLabel}</span>
        </div>
        <h2 class="scene-title">${escapeHtml(q.title)}</h2>
        <p class="scene-desc">${escapeHtml(q.desc)}</p>
        <div class="choice-list" id="nclex-choices">${choicesHtml}</div>
        <div id="nclex-feedback" class="modal-result" aria-live="polite"></div>
      </div>`;
}

function nclexSataToggle(t) {
    const i = parseInt(t.dataset.i, 10);
    if (!Number.isFinite(i)) return;
    if (!gameState.nclexSataPick) gameState.nclexSataPick = new Set();
    if (gameState.nclexSataPick.has(i)) {
        gameState.nclexSataPick.delete(i);
        t.setAttribute("aria-pressed", "false");
        t.classList.remove("selected");
        const box = t.querySelector(".sata-box"); if (box) box.textContent = "☐";
    } else {
        gameState.nclexSataPick.add(i);
        t.setAttribute("aria-pressed", "true");
        t.classList.add("selected");
        const box = t.querySelector(".sata-box"); if (box) box.textContent = "☑";
    }
}

function nclexSataSubmit() {
    const q = gameState.nclexQueue[gameState.nclexIndex];
    if (!q || q.type !== "sata") return;
    const pick = gameState.nclexSataPick || new Set();
    const correctSet = new Set(q.choices.map((c, i) => c.correct ? i : -1).filter(i => i >= 0));
    // 모든 정답이 선택되고 오답이 하나도 선택되지 않은 경우만 정답 — 표준 NCLEX SATA 채점
    let isAllCorrect = pick.size === correctSet.size;
    if (isAllCorrect) {
        for (const i of correctSet) { if (!pick.has(i)) { isAllCorrect = false; break; } }
    }
    _nclexRenderFeedback(q, { sataPick: pick, sataCorrect: correctSet, isCorrect: isAllCorrect });
}

function nclexAnswer(t) {
    const q = gameState.nclexQueue[gameState.nclexIndex];
    if (!q) return;
    const i = parseInt(t.dataset.i, 10);
    if (!Number.isFinite(i)) return;
    const choice = q.choices[i];
    if (!choice) return;
    _nclexRenderFeedback(q, { picked: i, isCorrect: !!choice.correct });
}

function _nclexRenderFeedback(q, info) {
    // 채점 + 해설 표시 + Next 버튼
    const list = document.getElementById("nclex-choices");
    if (list) list.querySelectorAll(".choice-btn").forEach(b => b.disabled = true);
    gameState.nclexAnswered = (gameState.nclexAnswered || 0) + 1;
    if (info.isCorrect) gameState.nclexCorrect = (gameState.nclexCorrect || 0) + 1;
    track("nclex_answered", { id: q.id, type: q.type, correct: !!info.isCorrect });

    // 각 보기에 정답/오답 표시
    if (list) {
        q.choices.forEach((c, i) => {
            const btn = list.querySelector(`[data-i="${i}"]`);
            if (!btn) return;
            if (c.correct) btn.classList.add("nclex-correct");
            if (q.type === "sata") {
                const picked = info.sataPick && info.sataPick.has(i);
                if (picked && !c.correct) btn.classList.add("nclex-wrong");
            } else {
                if (info.picked === i && !c.correct) btn.classList.add("nclex-wrong");
            }
        });
    }

    // 해설 박스
    const fb = document.getElementById("nclex-feedback");
    if (fb) {
        const verdict = info.isCorrect ? "✅ Correct" : "❌ Incorrect";
        const explainItems = q.choices
            .filter(c => c.correct || (q.type === "sata" ? (info.sataPick && info.sataPick.has(q.choices.indexOf(c))) : info.picked === q.choices.indexOf(c)))
            .map(c => `<div class="nclex-explain-row"><strong>${escapeHtml(c.text)}</strong><div>${escapeHtml(c.log || "")}</div></div>`)
            .join("");
        fb.innerHTML = `
          <div class="feedback-box ${info.isCorrect ? "correct" : "wrong"}">
            <div class="feedback-title">${verdict}</div>
            <div class="nclex-explain">${explainItems}</div>
          </div>
          <div class="choice-list" style="margin-top:12px">
            <button class="choice-btn primary" data-action="nclexNext">Next ›</button>
            <button class="choice-btn" data-action="renderNclexMenu">Back to Categories</button>
          </div>`;
        try { fb.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch {}
    }
}

function nclexNext() {
    gameState.nclexIndex = (gameState.nclexIndex || 0) + 1;
    if (!gameState.nclexQueue || gameState.nclexIndex >= gameState.nclexQueue.length) {
        renderNclexSummary();
        return;
    }
    renderNclexQuestion();
}

function renderNclexSummary() {
    const total = (gameState.nclexQueue || []).length;
    const correct = gameState.nclexCorrect || 0;
    const answered = gameState.nclexAnswered || 0;
    const acc = answered ? Math.round((correct / answered) * 100) : 0;
    const catLabel = gameState.nclexCategory || "All Categories";
    let msg, emoji;
    if (acc >= 85) { emoji = "🏆"; msg = "Excellent — you are at passing level for this domain."; }
    else if (acc >= 65) { emoji = "🌟"; msg = "Solid. Review the missed rationales for full retention."; }
    else if (acc >= 50) { emoji = "📚"; msg = "Halfway there. Re-run this category after reviewing wrong rationales."; }
    else { emoji = "💪"; msg = "Tough domain. Review each rationale and retry — repetition builds NCLEX recall."; }
    track("nclex_quiz_completed", { category: gameState.nclexCategory || "__random__", total, correct, accuracy: acc });
    try { Storage.addHistory({ mode: "nclex", at: Date.now(), category: gameState.nclexCategory || "__random__", total, answered, correct, accuracy: acc }); } catch {}
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        
        <h2 class="scene-title">NCLEX-RN — ${escapeHtml(catLabel)}</h2>
        <div class="dashboard-row" role="group" aria-label="session result">
          <div class="dash-stat"><div class="ds-num">${correct}/${total}</div><div class="ds-label">Score</div></div>
          <div class="dash-stat"><div class="ds-num">${acc}%</div><div class="ds-label">Accuracy</div></div>
          <div class="dash-stat"><div class="ds-num">${answered}</div><div class="ds-label">Answered</div></div>
        </div>
        <p class="scene-desc">${msg}</p>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="renderNclexMenu">Practice Another Category</button>
          <button class="choice-btn" data-action="returnToMenu">Main Menu</button>
        </div>
      </div>`;
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

    // 시뮬(에피소드/시나리오) 자동 진행 — 답 누르면 짧게 보여주고 바로 다음으로.
    // 결과를 읽을 시간을 주되, 탭하면 즉시 진행.
    if (opts.autoAdvance) {
        let advanced = false;
        const go = () => { if (advanced) return; advanced = true; clearTimeout(timer); if (opts.onNext) opts.onNext(); };
        const hint = document.createElement("div");
        hint.className = "feedback-tap-hint";
        hint.textContent = "탭하면 바로 다음 →";
        box.appendChild(hint);
        box.style.cursor = "pointer";
        box.addEventListener("click", go);
        const delay = isCorrect ? 700 : 2200; // 정답은 빠르게 다음, 오답은 해설 읽을 시간
        const timer = setTimeout(go, delay);
        return;
    }

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
    if (isCorrect) checkAndNotifyAchievements();
    renderFeedback(ev, choice, {
        onNext: () => {
            // 세트(10문제) 완료 시 요약 카드, 아니면 다음 문제
            if (gameState.quizSolved % QUIZ_SET_SIZE === 0) renderQuizSetSummary();
            else renderNextQuizQuestion();
        },
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
    try { Storage.updateMockBest(correct); Storage.markModeUsed("mock"); checkAndNotifyAchievements(); } catch {}
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
    // 첫 액션 완료 (메인 메뉴 hero-card tooltip 제거)
    try { Storage.setFirstActionDone(); } catch {}
    // 이미 오늘 완료한 경우 → 빈 상태 (재도전은 명시적 선택)
    const data = Storage.load();
    const today = data.daily?.[todayKey()];
    if (today?.completed) {
        resetStateForMode();
        gameState.mode = "daily_done";
        showCoreUI(); updateStats();
        UI.gameArea.innerHTML = renderEmptyState({
            illust: "dailyDone",
            title: "오늘 일일 챌린지 완료!",
            desc: `오늘 ${today.correct}/${DAILY_CHALLENGE_TOTAL} 정답.\n내일 0시에 새 챌린지가 열려요.`,
            primaryAction: "returnToMenu", primaryLabel: "메인 메뉴",
            secondaryAction: "startDailyChallengeForce", secondaryLabel: "그래도 다시 풀기",
        });
        return;
    }
    startDailyChallengeForce();
}
function startDailyChallengeForce() {
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
    if (isCorrect) {
        checkAndNotifyAchievements();
        // 친구 초대 보너스 — 일일 챌린지 첫 정답 시 +10 평판 (1회 한정, 영구)
        try {
            const data = Storage.load();
            if (data.referral && data.referral.invitedBy && data.referral.bonusGranted
                && !data.referral.bonusAwardedOnce) {
                gameState.rep = (gameState.rep || 0) + 10;
                data.referral.bonusAwardedOnce = true;
                data.referral.bonusAwardedDate = todayKey();
                Storage.save(data);
                addLog("🎁 초대 보너스 +10 평판! (1회 한정)", "log-good");
                track("referral_bonus_awarded");
            }
        } catch {}
    }
    renderFeedback(ev, choice, {
        onNext: () => {
            if (gameState.dailySolved >= DAILY_CHALLENGE_TOTAL) endDailyChallenge();
            else renderNextDailyQuestion();
        },
    });
}
function endDailyChallenge() {
    track("daily_challenge_completed", { correct: String(gameState.dailyCorrect) });
    const correct = gameState.dailyCorrect;
    Storage.setDaily(todayKey(), { solved: DAILY_CHALLENGE_TOTAL, correct, completed: true, ts: Date.now() });
    Storage.addHistory({ mode: "daily", at: Date.now(), total: DAILY_CHALLENGE_TOTAL, correct, date: todayKey() });
    const streak = Storage.bumpStreak(); // 연속 학습일 갱신
    checkAndNotifyAchievements();
    const streakMsg = streak.count >= 2
        ? `🔥 ${streak.count}일 연속 학습 중! (최고 ${streak.best}일)`
        : `🔥 연속 학습 시작! 내일 또 오면 2일째.`;
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        
        <h2 class="scene-title">일일 챌린지 완료</h2>
        <p class="scene-desc">정답 ${correct}/${DAILY_CHALLENGE_TOTAL}\n${streakMsg}</p>
        <div class="choice-list">
          <button class="choice-btn" data-action="shareResultCard" data-mode="daily" data-title="일일 챌린지 ${correct}/${DAILY_CHALLENGE_TOTAL} · ${streak.count}일 연속" data-lines="${todayKey()}|정답 ${correct} 문제|🔥 ${streak.count}일 연속">결과 카드 다운로드</button>
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
        UI.gameArea.innerHTML = renderEmptyState({
            illust: "wrongDone",
            title: "오늘 복습할 게 없어요",
            desc: `${all.length}건 오답 모두 복습 완료 상태.\n다음 복습 만기: 약 ${hoursToNext}시간 후 (spaced repetition).`,
            primaryAction: "reviewWrongForce", primaryLabel: "그래도 복습할게요",
            secondaryAction: "returnToMenu", secondaryLabel: "메인 메뉴",
        });
        showCoreUI(); updateStats();
        return;
    }
    if (gameState.wrongQueue.length === 0) {
        UI.gameArea.innerHTML = renderEmptyState({
            illust: "wrongEmpty",
            title: "오답노트가 비었습니다",
            desc: "아직 저장된 오답이 없어요. 트레이닝/모의고사에서 문제를 풀면 자동으로 쌓입니다.",
            primaryAction: "returnToMenu", primaryLabel: "메인 메뉴",
        });
        showCoreUI(); updateStats();
        return;
    }
    showCoreUI(); UI.logBar.innerHTML = "";
    addLog(`오답노트 복습 시작 — ${gameState.wrongQueue.length}건`, "log-important");
    renderNextWrongQuestion();
}
function renderNextWrongQuestion() {
    if (gameState.wrongQueue.length === 0) {
        UI.gameArea.innerHTML = renderEmptyState({
            illust: "wrongDone",
            title: "오답을 모두 복습했습니다",
            desc: `정답 ${gameState.quizCorrect} / 다시 오답 ${gameState.quizWrong}`,
            primaryAction: "returnToMenu", primaryLabel: "메인 메뉴",
        });
        return;
    }
    const snap = gameState.wrongQueue[0];
    gameState.currentWrongId = snap.id;
    const ev = {
        baseId: snap.baseId, category: snap.category, part: snap.part,
        emoji: "📝", title: snap.title, desc: snap.desc,
        choices: snap.choices.map(c => ({ text: c.text, correct: c.correct, log: c.log })),
    };
    const box = (snap.box && snap.box >= 1 && snap.box <= 5) ? snap.box : 1;
    renderSceneCard(ev, {
        mode: "wrong_review",
        questionIndex: gameState.quizSolved + 1,
        meta: ["오답 복습", `남은 ${gameState.wrongQueue.length}건`, `Leitner ${box}/5`]
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
        <div class="handoff-header">
          ${renderPatientAvatar(p.id, p.title, { cls: "handoff-avatar" })}
          <h2 class="scene-title">[인계 ${gameState.handoffIndex + 1}/${gameState.handoffPool.length}] ${escapeHtml(p.title)}</h2>
        </div>
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
            ${renderPatientAvatar(p.id, p.desc, { cls: "triage-avatar" })}
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
// 민감 컨텐츠 라벨 — 정서적·트라우마 사용자 보호 안내
const SENSITIVE_EPISODES = {
    "ep-psych-closed":       ["자해", "자살", "강박"],
    "ep-ems-ambulance":      ["자해", "외상"],
    "ep-ed-elder-abuse":     ["학대", "폭력"],
    "ep-ed-code-black":      ["폭력", "가정폭력"],
    "ep-peds-hospice":       ["소아 임종"],
    "ep-adolescent-psych":   ["자해", "자살", "식이장애"],
    "ep-psych-outpatient":   ["자살", "자해", "가정폭력"],
    "ep-er-opioid-od":       ["약물 중독", "자해"],
    "ep-ob-clinic-abortion": ["임신중절", "청소년 임신"],
    "ep-hospice-inpatient":  ["임종"],
    "ep-hiv-clinic":         ["HIV", "차별"],
    "ep-ed-overdose":        ["자해", "자살", "약물"],
    "ep-er-pesticide":       ["자해", "자살", "약물"],
    "ep-trial-1-event":      ["응급 사건"],
};
function sensitiveLabelFor(episodeId) {
    const tags = SENSITIVE_EPISODES[episodeId];
    return tags ? tags.join("·") : "";
}

// 에피소드 임상 영역 그룹 — 61개를 8개 카테고리로 묶어 탐색 용이
const EPISODE_GROUPS = [
    { label: "🚨 응급·외상", ids: ["ep-peds-ed", "ep-er-codeblue", "ep-air-evac", "ep-ed-overdose", "ep-ems-ambulance", "ep-ed-elder-abuse", "ep-ed-code-black", "ep-ob-er", "ep-er-pesticide", "ep-er-opioid-od", "ep-er-sepsis-bundle", "ep-trauma-ortho", "ep-trauma-center-week"] },
    { label: "🫀 중환자 (ICU)", ids: ["ep-icu-sepsis", "ep-ccu-stemi", "ep-nsicu-ich", "ep-picu-sepsis", "ep-icu-dnr", "ep-neuro-gbs"] },
    { label: "🔪 외과·수술", ids: ["ep-surgical-night", "ep-or-shift", "ep-pacu-week", "ep-urology-tx"] },
    { label: "🤰 산과·분만", ids: ["ep-ob-night", "ep-ob-hellp", "ep-ob-eclampsia", "ep-ldr-first-birth", "ep-postpartum-center", "ep-teen-mother", "ep-ob-clinic-abortion"] },
    { label: "👶 소아·신생아", ids: ["ep-nicu-week", "ep-peds-hospice"] },
    { label: "🧠 정신간호", ids: ["ep-psych-closed", "ep-adolescent-psych", "ep-psych-outpatient"] },
    { label: "🧪 종양·혈액", ids: ["ep-onco-week", "ep-outpatient-chemo", "ep-bmt-week"] },
    { label: "🏥 외래·클리닉", ids: ["ep-hospice-home", "ep-eye-ent", "ep-neuro-clinic", "ep-hiv-clinic", "ep-hospice-inpatient"] },
    { label: "🌍 지역사회·공중보건", ids: ["ep-school-health", "ep-occupational-health", "ep-multicultural", "ep-covid-ward", "ep-home-chronic", "ep-tb-isolation", "ep-health-center", "ep-rural-clinic"] },
    { label: "📋 전문·특수", ids: ["ep-geri-week", "ep-hd-center", "ep-burn-week", "ep-handoff-conflict", "ep-narcotics-incident", "ep-clinical-research", "ep-military-hosp", "ep-rehab-stroke", "ep-trial-1-event", "ep-newgrad-year"] },
    { label: "🌙 일상 (틈새 이야기)", ids: ["life-breakroom", "life-meal", "life-clockout", "life-rooftop", "life-locker-chat"] },
];

function episodeButtonHtml(e) {
    const prog = Storage.getEpisodeProgress(e.id);
    const pill = prog && prog.step > 0 && prog.step < e.steps.length
        ? ` <span class="mc-badge" style="position:static;background:var(--warning);">진행 중 ${prog.step}/${e.steps.length}</span>` : "";
    const sensitiveTags = sensitiveLabelFor(e.id);
    const sensitivePill = sensitiveTags
        ? ` <span class="mc-badge" style="position:static;background:var(--danger);" title="민감 컨텐츠">⚠️ ${escapeHtml(sensitiveTags)}</span>` : "";
    return `<button class="choice-btn primary" data-action="startEpisode" data-arg="${escapeHtml(e.id)}">${escapeHtml(e.title)}${pill}${sensitivePill}</button>`;
}

function renderEpisodeMenu() {
    resetStateForMode();
    gameState.mode = "episode_menu";
    showCoreUI(); UI.logBar.innerHTML = "";
    addLog("에피소드 — 한 듀티 전체를 따라가는 장편 스토리.", "log-important");
    updateStats();

    const byId = {};
    NC.EPISODES.forEach(e => { byId[e.id] = e; });
    const grouped = new Set();
    let groupsHtml = "";
    EPISODE_GROUPS.forEach(grp => {
        const eps = grp.ids.map(id => byId[id]).filter(Boolean);
        eps.forEach(e => grouped.add(e.id));
        if (eps.length === 0) return;
        groupsHtml += `
          <h3 class="episode-group-label">${grp.label} <span class="episode-group-count">${eps.length}</span></h3>
          <div class="choice-list episode-group-list">${eps.map(episodeButtonHtml).join("")}</div>`;
    });
    // 미분류 에피소드 (신규 추가 시 누락 방지) → "기타"
    const ungrouped = NC.EPISODES.filter(e => !grouped.has(e.id));
    if (ungrouped.length > 0) {
        groupsHtml += `
          <h3 class="episode-group-label">📦 기타 <span class="episode-group-count">${ungrouped.length}</span></h3>
          <div class="choice-list episode-group-list">${ungrouped.map(episodeButtonHtml).join("")}</div>`;
    }

    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">에피소드 (${NC.EPISODES.length})</h2>
        <p class="scene-desc">한 듀티 10~21단계의 연결된 스토리. 같은 환자·동료·의사가 계속 등장하고, 각 결정이 HP·평판에 누적되어 커리어 엔딩으로 이어집니다.\n\n⚠️ 표시된 에피소드는 자해·약물·폭력 등 민감 컨텐츠를 포함합니다.</p>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="renderCampaign">📖 커리어 스토리 (4막 13화 — 소설처럼 이어보기)</button>
          <button class="choice-btn primary" data-action="initSurvival">🎲 랜덤 에피소드 (오늘의 듀티)</button>
        </div>
        ${groupsHtml}
        <div class="choice-list">
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
    const stepNum = gameState.episodeStep + 1;
    const totalSteps = ep.steps.length;
    const ev = {
        baseId: `episode-${ep.id}-${stepNum}`,
        category: ep.title,
        part: `${step.time || ""} · Step ${stepNum}/${totalSteps}`,
        emoji: "📖",
        title: step.title,
        desc: step.narration,
        image: step.image || null, // 임상 시각자료 (ECG·X-ray·체위 등) — 있으면 표시
        sourceKey: step.sourceKey || null, // 임상 근거 키 — 있으면 카드 하단 출처 표시
        choices: step.choices.map(c => ({
            text: c.text, correct: !!c.correct,
            effect: { hp: c.hp || 0, rep: c.rep || 0 },
            log: c.log || "",
        })),
    };
    renderSceneCard(ev, {
        mode: "episode",
        questionIndex: stepNum,
        totalSteps,
        meta: [ep.title, step.time || "", `Step ${stepNum}/${totalSteps}`].filter(Boolean),
    });
}

function handleEpisodeChoice(choice, ev) {
    applyChoiceEffect(choice);
    const isCorrect = isCorrectChoice(choice);
    if (isCorrect) { bumpCombo(); Sound.correct(); addLog(`[정답] ${choice.log}`, "log-good"); checkAndNotifyAchievements(); }
    else { resetCombo(); Sound.wrong(); addLog(`[오답] ${choice.log}`, "log-bad"); }
    renderFeedback(ev, choice, {
        autoAdvance: true,
        onNext: () => {
            gameState.episodeStep += 1;
            // 다음 step 으로 진행하면서 자동 저장
            Storage.saveEpisodeProgress(gameState.episodeId, gameState.episodeStep, gameState.hp, gameState.rep);
            renderEpisodeStep();
        },
    });
}

// 커리어 결과 — 듀티 누적 + 평판 + 누적 에피소드로 간호사 일대기 스토리
function generateCareerOutcome(hp, rep, _completedEpisodes) {
    // 누적 평판 (전체 에피소드 history 기반) + 현재 듀티 결과
    const data = Storage.load();
    const epHist = (data.history || []).filter(h => h && h.mode === "episode");
    const bestStreak = epHist.length >= 3 && epHist.slice(0, 3).every(h => h.ending === "good");
    const recentBad = epHist.length >= 2 && epHist.slice(0, 2).every(h => h.ending === "bad");

    // 본 듀티 점수
    const score = hp + rep;
    let tier;
    if (score >= 150 && bestStreak) tier = "promotion";
    else if (score >= 130) tier = "honored";
    else if (score >= 90) tier = "stable";
    else if (score >= 40) tier = "transfer";
    else if (recentBad) tier = "burnout";
    else tier = "rough";

    const stories = {
        promotion: [
            { title: "🏆 수간호사 승진 — 다음 분기 정식 발령", body: "최근 3차례 듀티 모두 우수. 동료들이 추천 + 수간호사 결정. 다음 분기 정식 승진 통보.\n\"좋은 케이스마다 본인이 있었어요\" — 부장님 코멘트." },
            { title: "🎓 전문간호사 펠로우십 합격", body: "본인 듀티 기록·동료 추천서로 전문간호사 펠로우십 합격. 6개월 파견 교육 시작. 미래 커리어 한 단계." },
            { title: "🌟 우수 간호사상 수상 — 사내 시상식", body: "병원 우수 간호사상 후보 → 수상. 부장님 \"환자 안전 + 다학제 협력의 모범\". 사내 인터뷰 진행." },
        ],
        honored: [
            { title: "📈 분기 우수 직원 — 인정", body: "분기 우수 직원으로 본인 이름이 올라갑니다. 상금 + 휴가 보상. 동료들의 신뢰가 두터워집니다." },
            { title: "👏 부서 인계 표창 — 모범", body: "안전한 인계와 환자 케어로 부서 표창. 다른 부서에서 견학 요청도 들어옵니다." },
            { title: "💼 멘토 지정 — 신규 간호사 교육 담당", body: "신규 간호사 교육 멘토로 지정. \"본인 같은 간호사를 키우고 싶어요\" — 부장님." },
        ],
        stable: [
            { title: "🌿 안정적 근무 — 흐름 유지", body: "특별한 사건 없이 안정 근무. 환자·동료와의 관계도 무난. 연간 평가 \"기대 충족\"." },
            { title: "📚 학회 참석 기회 — 자기계발", body: "병원 지원 학회 참석 기회. 새 임상 지식·네트워크 + 다음 듀티 준비." },
            { title: "🔄 부서 이동 검토 — 새 도전", body: "본인 의향으로 다른 부서 (외래·검진센터) 이동 검토. 새 경험을 위해 인사팀과 면담." },
        ],
        transfer: [
            { title: "🔁 부서 이동 권유 — 적성 평가", body: "본인 + 관리자 면담 후 다른 부서 이동 권유. 적성과 강점을 살릴 영역을 찾는 중. 휴직보단 적성 일치." },
            { title: "📖 추가 교육 권유 — 역량 보강", body: "직무 역량 평가 후 추가 교육 권유 (CPR·약물 안전·인계 표준). 6개월 교육 후 재평가." },
            { title: "👥 동료 멘토링 시작 — 학습 동맹", body: "선임 멘토 1:1 배정. 6개월 동안 함께 듀티하며 케어 표준 다시 익힘." },
        ],
        burnout: [
            { title: "💔 번아웃 휴직 권고 — 회복 우선", body: "연속 어려운 듀티 후 정신과·산업의학 평가 → 휴직 권고. 본인 회복 + 가족 시간 + 직장 복귀 계획.\nEAP·자조모임 자원 안내됨." },
            { title: "🌧 이직 결정 — 다른 환경 모색", body: "이번 듀티 결과 + 누적 번아웃으로 이직 결정. 작은 병원/외래 등 다른 환경 모색. 본인 회복이 우선." },
            { title: "🏥 산재 신청 + 휴직 — 재충전", body: "직장 내 사건으로 산재 신청 + 6개월 휴직. 본인 회복 + 시스템 평가. 복귀 후 다른 부서 배정 예정." },
        ],
        rough: [
            { title: "🌫 마음 무거운 듀티 — 디브리핑", body: "환자 위해 없이 듀티 마쳤지만 본인 정서 무거움. 팀 디브리핑 + EAP + 다음 듀티 회복 시간 확보." },
            { title: "📋 개선 계획 수립 — 다음 듀티 준비", body: "관리자 면담 후 개선 계획 수립 (시간 관리·인계·환자 사정). 다음 듀티에서 적용 예정." },
            { title: "🤝 동료 지원 강화 — 1:1 슈퍼비전", body: "동료 슈퍼비전 + 정기 디브리핑 강화. 본인 회복 + 케어 표준 점검." },
        ],
    };
    const pool = stories[tier];
    const pick = pool[Math.floor(Math.random() * pool.length)];
    return { tier, ...pick };
}

// =========================================================================
// 커리어 캠페인 — 에피소드를 소설처럼 이어가는 연속 스토리 (4막 13화)
// 같은 간호사의 신규기 → 경력기 → 전문기 → 리더십기 일대기.
// 막마다 도입/마무리 내레이션 + 화 사이 전환 내레이션 + 누적 평판.
// =========================================================================
const CAREER_CAMPAIGN = {
    chapters: [
        {
            title: "1막 · 신규 간호사",
            subtitle: "면허를 받고, 첫 출근",
            intro: "스물넷의 봄. 간호사 면허증을 손에 쥐고 첫 병원에 출근한다.\n흰 가운은 아직 빳빳하고, 복도의 모든 게 낯설다. 선임의 한마디가 떨린다 — \"오늘부터 너도 간호사야.\"\n이제, 한 사람의 이야기가 시작된다.",
            outro: "첫 해가 지났다. 수많은 밤과 실수와 눈물. 그러나 손은 단단해졌고, 환자를 보는 눈이 생겼다.\n이제 더는 신규가 아니다.",
            episodes: ["ep-newgrad-year", "ep-surgical-night", "ep-handoff-conflict"],
        },
        {
            title: "2막 · 병동을 누비다",
            subtitle: "여러 병동, 다양한 환자",
            intro: "경력 2년차. 이제 여러 병동을 돌며 다양한 환자를 만난다.\nICU의 긴박함, 응급실의 코드블루, 분만실의 새 생명, 소아응급의 작은 손. 매 듀티가 새로운 시험이다.",
            outro: "다양한 현장을 거치며 본인만의 임상 감각이 자리잡았다. 동료들이 어려운 케이스에 본인을 찾기 시작한다.",
            episodes: ["ep-icu-sepsis", "ep-er-codeblue", "ep-ob-night", "ep-peds-ed"],
        },
        {
            title: "3막 · 전문가의 길",
            subtitle: "한 영역을 깊이 파다",
            intro: "5년차. 이제 한 영역의 전문가로 성장한다.\n심장중환자실의 STEMI, 신경외과의 뇌출혈, 종양병동의 항암, 골수이식의 무균 병동. 깊이가 곧 환자의 생존을 좌우한다.",
            outro: "전문간호사의 길에 들어섰다. 후배를 가르치고, 다학제 회의에서 목소리를 낸다.",
            episodes: ["ep-ccu-stemi", "ep-nsicu-ich", "ep-onco-week", "ep-bmt-week"],
        },
        {
            title: "4막 · 무게를 짊어지다",
            subtitle: "리더십, 윤리, 그리고 책임",
            intro: "10년차. 이제 가장 무거운 결정들이 본인의 어깨에 놓인다.\nDNR과 임종의 윤리, 응급실의 폭력, 외상센터의 대량재해. 의학을 넘어 사람과 시스템을 책임진다.",
            outro: "한 간호사의 긴 여정이 한 장을 마친다. 수많은 환자와 동료와 밤들이 지나갔다.\n그러나 이야기는 끝나지 않는다 — 다음 세대의 신규 간호사가 오늘도 첫 출근을 한다.",
            episodes: ["ep-icu-dnr", "ep-ed-code-black", "ep-trauma-center-week"],
        },
    ],
};
function campaignTotalEpisodes() {
    return CAREER_CAMPAIGN.chapters.reduce((a, ch) => a + ch.episodes.length, 0);
}
function campaignDoneCount(c) {
    let n = 0;
    for (let i = 0; i < c.chapter; i++) n += CAREER_CAMPAIGN.chapters[i].episodes.length;
    return n + c.episode;
}

function renderCampaign() {
    resetStateForMode();
    gameState.mode = "campaign";
    gameState.campaignActive = false;
    showCoreUI(); UI.logBar.innerHTML = "";
    updateStats();
    const c = Storage.getCampaign();
    const total = campaignTotalEpisodes();
    const done = campaignDoneCount(c);

    // 캠페인 완주
    if (c.chapter >= CAREER_CAMPAIGN.chapters.length) {
        const avgRep = c.log.length ? Math.round(c.cumulativeRep / c.log.length) : 0;
        const goodCount = c.log.filter(l => l.ending === "good").length;
        let finale;
        if (goodCount >= total - 2) finale = "🏆 전설의 간호사 — 한 시대를 이끈 임상가로 기억됩니다. 후배들이 본인의 이름을 듣고 간호사를 꿈꿉니다.";
        else if (goodCount >= total / 2) finale = "🌟 존경받는 선배 — 흔들림 없이 환자 곁을 지킨 간호사. 동료들의 신뢰가 곧 유산입니다.";
        else finale = "🌿 묵묵한 헌신 — 화려하진 않았지만, 수많은 환자가 본인 덕분에 살았습니다. 그것으로 충분합니다.";
        UI.gameArea.innerHTML = `
          <div class="scene-card card">
            
            <h2 class="scene-title">커리어 완주 — 한 사람의 이야기</h2>
            <p class="scene-desc">${escapeHtml(CAREER_CAMPAIGN.chapters[CAREER_CAMPAIGN.chapters.length - 1].outro)}</p>
            <hr class="dashboard-divider">
            <div class="dashboard-row" role="group">
              <div class="dash-stat"><div class="ds-num">${c.log.length}</div><div class="ds-label">완주 에피소드</div></div>
              <div class="dash-stat"><div class="ds-num">${goodCount}</div><div class="ds-label">우수 듀티</div></div>
              <div class="dash-stat"><div class="ds-num">${avgRep}</div><div class="ds-label">평균 평판</div></div>
            </div>
            <p class="scene-desc"><strong>${escapeHtml(finale)}</strong></p>
            <div class="choice-list">
              <button class="choice-btn" data-action="shareResultCard" data-mode="campaign" data-title="간호사 커리어 완주" data-lines="${c.log.length}화 완주|우수 듀티 ${goodCount}|평균 평판 ${avgRep}">결과 카드 다운로드</button>
              <button class="choice-btn" data-action="resetCampaignConfirm">처음부터 다시</button>
              <button class="choice-btn primary" data-action="returnToMenu">메인 메뉴</button>
            </div>
          </div>`;
        return;
    }

    const chapter = CAREER_CAMPAIGN.chapters[c.chapter];
    const ep = NC.EPISODES.find(x => x.id === chapter.episodes[c.episode]);
    const atChapterStart = c.episode === 0;
    const introHtml = (!c.started || atChapterStart)
        ? `<div class="campaign-interlude">${escapeHtml(chapter.intro).replace(/\n/g, "<br>")}</div>` : "";

    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <div class="campaign-progress-label">📖 커리어 스토리 · ${done}/${total}화</div>
        <h2 class="scene-title">${escapeHtml(chapter.title)}</h2>
        <p class="about-meta">${escapeHtml(chapter.subtitle)} · 누적 평판 ${c.cumulativeRep}</p>
        ${introHtml}
        <hr class="dashboard-divider">
        <h3 class="modal-section-title">다음 이야기</h3>
        <p class="scene-desc"><strong>${escapeHtml(ep ? ep.title : "")}</strong> ${sensitiveLabelFor(ep ? ep.id : "") ? `<span class="mc-badge" style="position:static;background:var(--danger);">⚠️ ${escapeHtml(sensitiveLabelFor(ep.id))}</span>` : ""}</p>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="startCampaignEpisode">${c.started ? "이어서 진행" : "이야기 시작"}</button>
          <button class="choice-btn" data-action="returnToMenu">메인 메뉴</button>
          ${c.started ? `<button class="choice-btn" data-action="resetCampaignConfirm">처음부터 다시</button>` : ""}
        </div>
      </div>`;
}

function startCampaignEpisode() {
    const c = Storage.getCampaign();
    if (c.chapter >= CAREER_CAMPAIGN.chapters.length) { renderCampaign(); return; }
    const chapter = CAREER_CAMPAIGN.chapters[c.chapter];
    const epId = chapter.episodes[c.episode];
    const ep = NC.EPISODES.find(x => x.id === epId);
    if (!ep) { renderCampaign(); return; }
    if (!c.started) { c.started = true; Storage.saveCampaign(c); }
    gameState.campaignActive = true;
    track("campaign_episode_start", { ch: String(c.chapter + 1) });
    beginEpisode(epId, 0, 100, 0);
}

function advanceCampaign(endingKey) {
    const c = Storage.getCampaign();
    c.cumulativeRep += gameState.rep;
    c.log.push({ id: gameState.episodeId, ending: endingKey, rep: gameState.rep });
    c.episode += 1;
    let chapterCleared = false;
    if (c.episode >= CAREER_CAMPAIGN.chapters[c.chapter].episodes.length) {
        chapterCleared = true;
        c.chapter += 1;
        c.episode = 0;
    }
    Storage.saveCampaign(c);
    return { c, chapterCleared };
}

function renderCampaignInterlude(prevChapterIdx, chapterCleared, endingKey) {
    const c = Storage.getCampaign();
    const prevChapter = CAREER_CAMPAIGN.chapters[prevChapterIdx];
    const reaction = endingKey === "good"
        ? "그날의 판단은 옳았다. 환자도, 동료도 본인을 신뢰한다."
        : endingKey === "ok"
            ? "무사히 듀티를 마쳤다. 배운 것을 다음으로 가져간다."
            : "쉽지 않은 듀티였다. 그러나 무너지지 않고, 다시 가운을 입는다.";
    let bridgeHtml, nextLabel, nextAction;
    if (chapterCleared && prevChapter && prevChapter.outro && c.chapter < CAREER_CAMPAIGN.chapters.length) {
        bridgeHtml = `<div class="campaign-interlude">${escapeHtml(reaction)}<br><br><em>${escapeHtml(prevChapter.outro).replace(/\n/g, "<br>")}</em></div>`;
        nextLabel = "다음 막으로"; nextAction = "renderCampaign";
    } else if (c.chapter >= CAREER_CAMPAIGN.chapters.length) {
        bridgeHtml = `<div class="campaign-interlude">${escapeHtml(reaction)}<br><br><em>${escapeHtml(prevChapter.outro).replace(/\n/g, "<br>")}</em></div>`;
        nextLabel = "마지막 장 보기"; nextAction = "renderCampaign";
    } else {
        const nextEp = NC.EPISODES.find(x => x.id === CAREER_CAMPAIGN.chapters[c.chapter].episodes[c.episode]);
        bridgeHtml = `<div class="campaign-interlude">${escapeHtml(reaction)}<br><br>시간이 흐른다. 다음 듀티가 기다린다 — <strong>${escapeHtml(nextEp ? nextEp.title : "")}</strong>.</div>`;
        nextLabel = "이어서 진행"; nextAction = "renderCampaign";
    }
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        
        <h2 class="scene-title">${chapterCleared ? "막을 내리며" : "다음 이야기로"}</h2>
        ${bridgeHtml}
        <p class="about-meta">누적 평판 ${c.cumulativeRep} · ${campaignDoneCount(c)}/${campaignTotalEpisodes()}화 완주</p>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="${nextAction}">${nextLabel}</button>
          <button class="choice-btn" data-action="returnToMenu">메인 메뉴</button>
        </div>
      </div>`;
}

function resetCampaignConfirm() {
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">커리어를 처음부터?</h2>
        <p class="scene-desc">지금까지의 커리어 진행과 누적 평판이 모두 초기화됩니다. 계속할까요?</p>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="resetCampaignDo">처음부터 다시 시작</button>
          <button class="choice-btn" data-action="renderCampaign">취소</button>
        </div>
      </div>`;
}
function resetCampaignDo() {
    Storage.resetCampaign();
    addLog("커리어를 처음부터 다시 시작합니다.", "log-important");
    renderCampaign();
}
function campaignContinue() {
    const t = gameState._campaignTransition;
    if (!t) { renderCampaign(); return; }
    gameState._campaignTransition = null;
    renderCampaignInterlude(t.prevChapterIdx, t.chapterCleared, t.endingKey);
}

function endEpisode() {
    track("episode_completed", { id: gameState.episodeId });
    checkAndNotifyAchievements();
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

    // 캠페인 모드면 ending 카드 → 다음 화 전환 내레이션으로 진행 (소설처럼 연속)
    if (gameState.campaignActive) {
        gameState.campaignActive = false;
        const prevChapterIdx = Storage.getCampaign().chapter;
        const { chapterCleared } = advanceCampaign(endingKey);
        UI.gameArea.innerHTML = `
          <div class="scene-card card">
            <h2 class="scene-title">${escapeHtml(ending.title)}</h2>
            <p class="scene-desc">${escapeHtml(ending.body)}</p>
            <p class="about-meta">이번 듀티 HP ${gameState.hp} · 평판 ${gameState.rep}</p>
            <div class="choice-list">
              <button class="choice-btn primary" data-action="campaignContinue">— 이야기 계속 —</button>
            </div>
          </div>`;
        // 전환 내레이션 렌더용 상태 보관
        gameState._campaignTransition = { prevChapterIdx, chapterCleared, endingKey };
        return;
    }

    // 커리어 결과 (간호사 일대기 스토리텔링)
    const career = generateCareerOutcome(gameState.hp, gameState.rep, gameState.episodeStep);
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">${escapeHtml(ending.title)}</h2>
        <p class="scene-desc">${escapeHtml(ending.body)}</p>
        <hr class="dashboard-divider">
        <h3 class="modal-section-title">📖 커리어 결과</h3>
        <p class="scene-desc"><strong>${escapeHtml(career.title)}</strong></p>
        <p class="scene-desc">${escapeHtml(career.body)}</p>
        <hr class="dashboard-divider">
        <p class="scene-desc">최종 HP <strong>${gameState.hp}</strong> · 평판 <strong>${gameState.rep}</strong> · 듀티 종료.</p>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="initSurvival">다음 듀티 (랜덤 에피소드)</button>
          <button class="choice-btn" data-action="renderEpisodeMenu">에피소드 목록</button>
          <button class="choice-btn" data-action="shareResultCard" data-mode="career" data-title="${escapeHtml(career.title)}" data-lines="HP ${gameState.hp}|평판 ${gameState.rep}|${escapeHtml(ep.title)}">결과 카드 다운로드</button>
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
        baseId: `scenario-${s.id}-${gameState.scenarioStep + 1}`, category: s.title, part: `Step ${gameState.scenarioStep + 1}/${s.steps.length}`,
        emoji: "📋", title: step.prompt,
        desc: gameState.scenarioStep === 0 ? s.intro : `현재 HP ${gameState.hp} / 평판 ${gameState.rep}`,
        image: step.image || null,
        sourceKey: step.sourceKey || null,
        choices: step.choices.map(c => ({
            text: c.text, correct: !!c.correct,
            effect: { hp: c.hp || 0, rep: c.rep || 0 },
            log: c.log || "",
        })),
    };
    renderSceneCard(ev, { mode: "scenario", questionIndex: gameState.scenarioStep + 1, totalSteps: s.steps.length, meta: [s.title, `Step ${gameState.scenarioStep + 1}/${s.steps.length}`] });
}

function handleScenarioChoice(choice, ev) {
    applyChoiceEffect(choice);
    const isCorrect = isCorrectChoice(choice);
    if (isCorrect) { bumpCombo(); Sound.correct(); addLog(`[정답] ${choice.log}`, "log-good"); }
    else { resetCombo(); Sound.wrong(); addLog(`[오답] ${choice.log}`, "log-bad"); }
    if (gameState.hp <= 0) { renderFeedback(ev, choice, { autoAdvance: true, onNext: () => endScenario("환자 상태 악화 — 시나리오 실패") }); return; }
    renderFeedback(ev, choice, {
        autoAdvance: true,
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

        <div class="choice-list dashboard-actions">
          <button class="choice-btn primary" data-action="renderWeaknessAnalysis">🎯 약점 분석</button>
          <button class="choice-btn primary" data-action="renderLeaderboard">📊 나의 최고 기록</button>
        </div>

        <h3 class="dash-section-title">최근 5개년 출제 경향</h3>
        ${renderTrendsChart()}

        <div class="choice-list dashboard-actions">
          <button class="choice-btn" data-action="reviewWrongAnswers">오답 복습 (${wrongCount})</button>
          <button class="choice-btn" data-action="printDashboard">PDF 인쇄</button>
          <button class="choice-btn" data-action="confirmClearStats">통계 초기화</button>
        </div>
      </div>`;
}
// safeConfirm — Capacitor 일부 iOS 빌드에서 confirm() 비신뢰. 폴백 형식으로 보장.
function safeConfirm(message) {
    try {
        // 표준 window.confirm — 일반 환경 (Android/PWA/Electron) 모두 안정적
        if (typeof window !== "undefined" && typeof window.confirm === "function") {
            return window.confirm(message);
        }
    } catch {}
    return false; // 폴백: 확인 불가 → 안전하게 거부
}
function confirmClearStats() {
    if (!safeConfirm("모든 통계/오답/기록을 초기화합니다. 계속하시겠습니까?")) return;
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
        <h2 class="scene-title">설정</h2>

        <h3 class="settings-section">일반</h3>
        <div class="settings-row">
          <span>테마</span>
          <span class="settings-value">${settings.theme === "dark" ? "다크" : settings.theme === "light" ? "라이트" : "자동"}</span>
        </div>
        <div class="settings-row-3col">
          <button class="choice-btn ${settings.theme === "light" ? "primary" : ""}" data-action="setTheme" data-theme="light">라이트</button>
          <button class="choice-btn ${settings.theme === "dark" ? "primary" : ""}" data-action="setTheme" data-theme="dark">다크</button>
          <button class="choice-btn ${(!settings.theme || settings.theme === "auto") ? "primary" : ""}" data-action="setTheme" data-theme="auto">자동</button>
        </div>
        <div class="settings-toggle-row">
          <div class="settings-toggle-label">
            <span class="settings-toggle-name">사운드</span>
            <span class="settings-toggle-sub">정답·오답 효과음</span>
          </div>
          <button class="toggle-switch ${settings.sound !== false ? 'on' : ''}" data-action="toggleSound" aria-pressed="${settings.sound !== false}"></button>
        </div>
        <div class="settings-toggle-row">
          <div class="settings-toggle-label">
            <span class="settings-toggle-name">햅틱</span>
            <span class="settings-toggle-sub">진동 피드백 (모바일)</span>
          </div>
          <button class="toggle-switch ${settings.haptics !== false ? 'on' : ''}" data-action="toggleHaptics" aria-pressed="${settings.haptics !== false}"></button>
        </div>
        <div class="settings-toggle-row">
          <div class="settings-toggle-label">
            <span class="settings-toggle-name">음성 읽기</span>
            <span class="settings-toggle-sub">TTS 자동 읽기</span>
          </div>
          <button class="toggle-switch ${settings.tts === true ? 'on' : ''}" data-action="toggleTts" aria-pressed="${settings.tts === true}"></button>
        </div>
        <div class="choice-list">
          <button class="choice-btn" data-action="renderTtsSettings">음성 상세 설정</button>
        </div>
        <h3 class="settings-section">시험 모드 (Exam Mode)</h3>
        <div class="settings-row">
          <span>현재 모드</span>
          <span class="settings-value">${settings.examMode === "nclex" ? "🇺🇸 NCLEX-RN (English)" : "🇰🇷 한국 국시"}</span>
        </div>
        <div class="choice-list">
          <button class="choice-btn ${settings.examMode !== "nclex" ? "primary" : ""}" data-action="setExamMode" data-mode="korean">🇰🇷 한국 국시</button>
          <button class="choice-btn ${settings.examMode === "nclex" ? "primary" : ""}" data-action="setExamMode" data-mode="nclex">🇺🇸 NCLEX-RN</button>
        </div>
        <p class="settings-help">${settings.examMode === "nclex" ? "NCLEX-RN: US licensing exam questions in English (MCQ + SATA + Priority)." : "한국 간호사 국가고시 문제 (8과목)."}</p>
        <div class="settings-row">
          <span>일일 학습 알림</span>
          <span class="settings-value">${data.notifyOptIn ? "켜짐" : "꺼짐"}</span>
        </div>
        <div class="choice-list">
          <button class="choice-btn" data-action="toggleDailyNotify">${data.notifyOptIn ? "🔕 알림 끄기" : "🔔 일일 챌린지 알림 켜기"}</button>
        </div>

        <h3 class="settings-section">프리미엄 (준비중)</h3>
        <div class="settings-row">
          <span>광고 제거 + 무제한 부활 + 우선 RN 감수 받기</span>
          <span class="settings-value">₩4,900/월</span>
        </div>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="renderPremiumPage">⭐ 프리미엄 자세히 보기</button>
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
          <button class="choice-btn primary" data-action="renderDataControl">📋 내 데이터 (백업·내보내기·삭제)</button>
          <button class="choice-btn" data-action="exportData">📦 빠른 백업 (JSON 다운로드)</button>
          <button class="choice-btn" data-action="triggerImportData">📥 데이터 복원 (JSON 업로드)</button>
          <input type="file" id="import-file-input" accept="application/json" style="display:none">
          <button class="choice-btn" data-action="confirmClearStats">🗑 전체 데이터 초기화</button>
        </div>

        <h3 class="settings-section">정보</h3>
        <div class="choice-list">
          <button class="choice-btn" data-action="renderAbout">앱 정보 · 버전 · 변경 이력</button>
          <button class="choice-btn" data-action="renderPrivacy">개인정보 처리방침 (요약)</button>
          <button class="choice-btn" data-action="showLegal">이용 약관 · 면책 (요약)</button>
          <button class="choice-btn" data-action="openExternalPrivacy">📄 개인정보 전문</button>
          <button class="choice-btn" data-action="openExternalTerms">📄 이용약관 전문</button>
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

// GDPR 데이터 컨트롤 — 사용자 권리 (열람·이전·삭제)
function renderDataControl() {
    gameState.mode = "data_control";
    showCoreUI(); updateStats();
    const data = Storage.load();
    const errLog = (() => {
        try { return JSON.parse(localStorage.getItem("nurseSim:errLog") || "[]"); } catch { return []; }
    })();
    const lsSize = (() => {
        try {
            let total = 0;
            for (let k in localStorage) if (k.startsWith("nurseSim")) total += (localStorage[k] || "").length;
            return Math.round(total / 1024 * 10) / 10;
        } catch { return 0; }
    })();
    UI.gameArea.innerHTML = `
      <div class="card">
        <h2 class="scene-title">내 데이터</h2>
        <p class="scene-desc">모든 학습 데이터는 사용자 기기 내에만 저장됩니다. 언제든 백업·이전·삭제 가능.</p>

        <h3 class="settings-section">현재 저장량</h3>
        <div class="settings-row"><span>localStorage 사용</span><span class="settings-value">${lsSize} KB</span></div>
        <div class="settings-row"><span>오답 노트</span><span class="settings-value">${(data.wrongQueue || []).length}개</span></div>
        <div class="settings-row"><span>학습 히스토리</span><span class="settings-value">${(data.history || []).length}건</span></div>
        <div class="settings-row"><span>북마크</span><span class="settings-value">${Object.keys(data.bookmarks || {}).length}개</span></div>
        <div class="settings-row"><span>최근 에러 로그</span><span class="settings-value">${errLog.length}건</span></div>

        <h3 class="settings-section">권리 행사 (GDPR / PIPA)</h3>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="exportData">📦 전체 데이터 백업 (JSON)</button>
          <button class="choice-btn" data-action="triggerImportData">📥 백업에서 복원</button>
          <button class="choice-btn" data-action="exportErrLog">🐛 에러 로그 다운로드 (오류 신고용)</button>
          <button class="choice-btn" data-action="confirmClearErrLog">🧹 에러 로그만 삭제</button>
          <button class="choice-btn" data-action="confirmClearStats">⚠️ 전체 데이터 영구 삭제</button>
        </div>
        <p class="scene-desc" style="font-size: 12px; color: var(--muted); margin-top: 16px;">
          ℹ️ 본 앱은 학습 데이터를 외부 서버로 전송하지 않습니다.<br>
          광고(AdMob)와 익명 사용 통계(Plausible)는 모바일 빌드에서만 작동하며, 개인 식별정보는 수집하지 않습니다.<br>
          자세한 내용: <button class="text-link" data-action="renderPrivacy">개인정보 처리방침</button>
        </p>
        <button class="choice-btn center" data-action="returnToMenu">메뉴</button>
      </div>`;
}

function exportErrLog() {
    try {
        const log = localStorage.getItem("nurseSim:errLog") || "[]";
        const blob = new Blob([log], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `nurseSim-errlog-${todayKey()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addLog("에러 로그 파일이 다운로드됐어요. 오류 신고 시 첨부하시면 도움됩니다.", "log-good");
    } catch (e) {
        addLog("에러 로그 다운로드 실패: " + e.message, "log-bad");
    }
}

function confirmClearErrLog() {
    if (!safeConfirm("에러 로그만 삭제합니다 (학습 데이터는 유지). 계속하시겠습니까?")) return;
    try { localStorage.removeItem("nurseSim:errLog"); } catch {}
    addLog("에러 로그가 삭제됐어요.", "log-good");
    renderDataControl();
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
            if (!safeConfirm("기존 데이터가 모두 덮어쓰여집니다. 계속하시겠습니까?")) return;
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
    const totalSteps = NC.EPISODES.reduce((a, e) => a + e.steps.length, 0);
    UI.gameArea.innerHTML = `
      <div class="card about-card">
        <h2 class="scene-title">앱 정보</h2>
        <p><strong>간호사 시뮬레이터 v${APP_VERSION}</strong></p>
        <p class="about-meta">한국 간호사 국가고시 학습을 위한 임상 시뮬레이션 + 문제풀이 하이브리드.</p>

        <h3 class="settings-section">수록 컨텐츠</h3>
        <ul class="about-list">
          <li>📖 에피소드 ${NC.EPISODES.length}개 (${totalSteps} 단계)</li>
          <li>🎙️ 인계 환자 ${NC.HANDOFF_PATIENTS.length}명 풀</li>
          <li>📋 임상 시나리오 ${NC.SCENARIOS.length}개</li>
          <li>🚑 트리아지 케이스 ${NC.TRIAGE_CASES.length}개</li>
          <li>📚 4지선다 generator ${NQ.allGenerators.length}종 (8과목 균형)</li>
          <li>📚 자동 매칭 의료 출처 ${KNOWN_SOURCES.length}건</li>
        </ul>

        <h3 class="settings-section">컨텐츠 출처</h3>
        <p class="about-meta">본 시뮬레이터는 다음 표준 자료에 기반합니다:</p>
        <ul class="about-list">
          <li>한국 간호사 국가시험 출제기준 (국시원 2024)</li>
          <li>AHA ACLS/BLS Provider Manual (2020)</li>
          <li>ACOG · KDIGO · GOLD · GINA · ADA 가이드라인</li>
          <li>한국 법령 (의료법·감염병관리법·마약류관리법 등 — 법제처)</li>
          <li>표준 한국 간호학 교과서 8과목 (수문사·현문사)</li>
          <li>대한심폐소생협회 KACPR · 대한간호협회 KNA</li>
        </ul>
        <p class="about-meta">전체 출처 목록: 저장소의 <code>SOURCES.md</code> 참고. 본 자료는 정식 RN/MD 감수 전 베타이며, 실제 임상 적용 시 최신 기관 가이드라인을 우선합니다.</p>

        <h3 class="settings-section">변경 이력</h3>
        <p class="about-meta"><strong>v1.1</strong> — Sage neumorphic 디자인 · 3탭 메뉴 · Leitner SRS · 북마크 · 공유 · 위클리 · 부활 · 컨텐츠 +600 결정포인트.</p>
        <p class="about-meta"><strong>v1.0.0</strong> — 정식 출시. 설정 · 백업/복원 · About · Privacy in-app · v1.0 배지.</p>
        <p class="about-meta"><strong>v0.9</strong> — 이어하기 · spaced repetition · 검색 · 출처 표시.</p>
        <p class="about-meta"><strong>v0.8</strong> — 면책 스트립 · BETA 배지 · 오류 신고 · 동의 체크박스.</p>
        <p class="about-meta">전체 이력: <code>CHANGELOG.md</code></p>

        <h3 class="settings-section">피드백 · 오류 신고</h3>
        <p class="about-meta">버그·잘못된 의학 정보·UX 불편·새 컨텐츠 제안 모두 환영합니다.</p>
        <ul class="about-list">
          <li>앱 내 "❗" 버튼 (오답 옆): 의학적 오류 즉시 신고</li>
          <li>GitHub Issues: <code>github.com/luiseluise0619-wq/nursing-simulation/issues</code></li>
          <li>피드백: 본 페이지 하단 "피드백 보내기" 버튼</li>
        </ul>

        <h3 class="settings-section">라이선스</h3>
        <p class="about-meta">MIT License. 의료 면책 고지는 <code>LICENSE</code> · <code>SOURCES.md</code> 참고.</p>

        <div class="choice-list">
          <button class="choice-btn primary" data-action="openFeedback">📝 피드백 보내기</button>
          <button class="choice-btn" data-action="openSettings">설정으로</button>
          <button class="choice-btn" data-action="returnToMenu">메인 메뉴</button>
        </div>
      </div>`;
}

function openFeedback() {
    // 출시 후 사용자가 1인 개발자에게 직접 피드백 전송할 수 있는 채널.
    // GitHub Issues URL 은 정해진 저장소로 새 창. 모바일에선 새 탭으로 열림.
    const url = "https://github.com/luiseluise0619-wq/nursing-simulation/issues/new";
    try {
        window.open(url, "_blank", "noopener,noreferrer");
        addLog("📝 GitHub Issues 새 탭에서 열림 — 자유롭게 의견 작성하세요.", "log-good");
    } catch {
        addLog("브라우저가 새 창을 막았습니다. 직접 방문: github.com/luiseluise0619-wq/nursing-simulation/issues", "log-bad");
    }
}

// 일일 학습 알림 — Notification API 권한 요청 + 24시간 후 로컬 푸시 예약
// 캐퍼시터 환경에서는 LocalNotifications 플러그인으로 자동 위임됨 (향후)
async function toggleDailyNotify() {
    const data = Storage.load();
    if (data.notifyOptIn) {
        data.notifyOptIn = false;
        Storage.save(data);
        // 예약된 일일 알림 취소 (Capacitor)
        try {
            const LN = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
            if (LN) await LN.cancel({ notifications: [{ id: 7001 }] });
        } catch {}
        addLog("🔕 알림 꺼졌습니다. 설정에서 다시 켤 수 있어요.", "log-good");
        openSettings();
        return;
    }
    // 권한 요청
    if (!("Notification" in window)) {
        addLog("이 기기는 알림을 지원하지 않습니다.", "log-bad");
        return;
    }
    try {
        const perm = await Notification.requestPermission();
        if (perm === "granted") {
            data.notifyOptIn = true;
            Storage.save(data);
            // Capacitor 모바일: 매일 반복 로컬 알림 실제 스케줄
            const scheduled = await scheduleDailyNotification();
            addLog(scheduled
                ? "🔔 매일 오전 9시 일일 챌린지 알림이 예약되었습니다."
                : "🔔 알림이 켜졌습니다. (웹에서는 앱 방문 시 안내로 표시됩니다)", "log-good");
            try { new Notification("간호사 시뮬레이터", { body: "알림이 켜졌어요. 매일 한 듀티씩 ✨", icon: "icon.svg" }); } catch {}
        } else {
            addLog("알림 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.", "log-bad");
        }
    } catch (e) {
        addLog("알림 권한 요청 실패: " + (e && e.message ? e.message : "unknown"), "log-bad");
    }
    openSettings();
}

// Capacitor LocalNotifications — 매일 오전 9시 반복 알림 예약 (모바일 빌드 전용)
// 웹/PWA 에서는 플러그인 부재로 false 반환 (no-op, 앱 방문 시 인앱 안내로 대체)
async function scheduleDailyNotification() {
    try {
        const LN = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
        if (!LN) return false;
        // 권한 확인/요청
        try {
            const p = await LN.requestPermissions();
            if (p && p.display && p.display !== "granted") return false;
        } catch {}
        // 기존 예약 제거 후 재등록 (중복 방지)
        try { await LN.cancel({ notifications: [{ id: 7001 }] }); } catch {}
        await LN.schedule({
            notifications: [{
                id: 7001,
                title: "간호사 시뮬레이터",
                body: "오늘의 일일 챌린지가 기다려요. 한 듀티 돌고 가실래요? ✨",
                schedule: { on: { hour: 9, minute: 0 }, repeats: true, every: "day", allowWhileIdle: true },
                smallIcon: "ic_stat_icon_config_sample",
            }],
        });
        track("daily_notify_scheduled");
        return true;
    } catch (e) {
        track("daily_notify_schedule_fail");
        return false;
    }
}

// 시험 모드 전환 — 한국 국시 ↔ NCLEX-RN (영어)
function setExamMode(t) {
    const mode = (t && t.dataset && t.dataset.mode) || null;
    if (mode !== "korean" && mode !== "nclex") return;
    const cur = Storage.getExamMode();
    if (cur === mode) {
        // 같은 모드 — 다시 누른 경우 가벼운 토스트만
        addLog(mode === "nclex" ? "Already in NCLEX-RN mode." : "이미 한국 국시 모드입니다.", "log-good");
        return;
    }
    Storage.setExamMode(mode);
    track("exam_mode_changed", { mode });
    addLog(mode === "nclex" ? "🇺🇸 NCLEX-RN mode activated — English questions enabled" : "🇰🇷 한국 국시 모드로 전환했습니다", "log-good");
    // 메뉴/설정 재렌더 — 새 상태 반영
    openSettings();
}

// 프리미엄 안내 — 결제 활성 전까지 마케팅 풀페이지
function showPremiumInfo() {
    track("premium_interest");
    renderPremiumPage();
}

function renderPremiumPage() {
    gameState.mode = "premium";
    showCoreUI(); updateStats();
    UI.gameArea.innerHTML = `
      <div class="card">
        <div class="premium-hero">
            <h2>프리미엄</h2>
            <p>광고 없이, 더 깊게.</p>
        </div>

        <div class="premium-pricing">
            <div class="premium-plan">
                <div class="premium-plan-label">월간</div>
                <div class="premium-plan-price">₩4,900<span>/월</span></div>
                <div class="premium-plan-desc">언제든 해지</div>
            </div>
            <div class="premium-plan recommended">
                <div class="premium-plan-badge">2개월 무료</div>
                <div class="premium-plan-label">연간</div>
                <div class="premium-plan-price">₩49,000<span>/년</span></div>
                <div class="premium-plan-desc">월 ₩4,083 효과</div>
            </div>
        </div>

        <div class="premium-features">
            <div class="premium-feature"><div class="premium-feature-icon">🚫</div><div class="premium-feature-body"><div class="premium-feature-title">광고 0</div><div class="premium-feature-sub">힌트·부활 광고 없이 즉시 사용</div></div></div>
            <div class="premium-feature"><div class="premium-feature-icon">📚</div><div class="premium-feature-body"><div class="premium-feature-title">독점 에피소드</div><div class="premium-feature-sub">신규 임상 시뮬 매월 +2편</div></div></div>
            <div class="premium-feature"><div class="premium-feature-icon">🎯</div><div class="premium-feature-body"><div class="premium-feature-title">AI 약점 코칭</div><div class="premium-feature-sub">개인 맞춤 학습 계획 자동 생성</div></div></div>
            <div class="premium-feature"><div class="premium-feature-icon">☁️</div><div class="premium-feature-body"><div class="premium-feature-title">기기 간 동기화</div><div class="premium-feature-sub">폰·태블릿·PC 진도 이어가기</div></div></div>
            <div class="premium-feature"><div class="premium-feature-icon">📝</div><div class="premium-feature-body"><div class="premium-feature-title">기출 라이선스</div><div class="premium-feature-sub">5년치 국시 + NCLEX 풀이</div></div></div>
            <div class="premium-feature"><div class="premium-feature-icon">💎</div><div class="premium-feature-body"><div class="premium-feature-title">RN 검수 우선</div><div class="premium-feature-sub">현직 간호사 검수 콘텐츠 우선 공개</div></div></div>
        </div>

        <div class="tip-jar-card">
            <h3>💚 응원하기</h3>
            <p>구독은 준비 중. 지금 응원하고 싶으시면 작은 후원으로 도움 가능합니다.<br><small>모든 후원은 콘텐츠 검수·서버·디자인에 100% 사용됩니다.</small></p>
            <div class="tip-jar-amounts">
                <button class="choice-btn" data-action="donate" data-amount="3000" data-method="toss">☕ 3,000원 (커피)</button>
                <button class="choice-btn" data-action="donate" data-amount="5000" data-method="toss">🍱 5,000원 (점심)</button>
                <button class="choice-btn" data-action="donate" data-amount="10000" data-method="toss">📚 10,000원 (책)</button>
            </div>
            <div class="choice-list" style="margin-top: 12px;">
                <button class="choice-btn" data-action="donate" data-amount="0" data-method="toss">💚 자유 금액 (Toss)</button>
                <button class="choice-btn" data-action="notifyPremium">📬 출시 알림 받기</button>
            </div>
        </div>

        <button class="choice-btn center" data-action="returnToMenu">메인 메뉴</button>
      </div>`;
    track("premium_view");
}

// Toss/KakaoPay 후원 — 백엔드 없이 작동 (본인 toss.me 핸들만 설정)
// 본인 작업: 아래 TOSS_HANDLE 을 본인 Toss 핸들로 교체 (예: "nursesim" → toss.me/nursesim)
const TOSS_HANDLE = "nursesim"; // ← 본인 Toss 핸들로 교체

function donate(t) {
    const amount = parseInt((t && t.dataset && t.dataset.amount) || "0", 10);
    const method = (t && t.dataset && t.dataset.method) || "toss";
    track("donation_click", { amount, method });

    if (method === "toss") {
        // toss.me 링크 형식: https://toss.me/{handle}/{amount}  (amount 0 = 자유)
        const url = amount > 0
            ? `https://toss.me/${encodeURIComponent(TOSS_HANDLE)}/${amount}`
            : `https://toss.me/${encodeURIComponent(TOSS_HANDLE)}`;
        try {
            window.open(url, "_blank", "noopener,noreferrer");
            addLog(`💚 ${amount > 0 ? amount.toLocaleString() + "원 " : ""}후원 페이지로 이동했어요. 감사합니다!`, "log-good");
            try { Storage.markSupporter(); checkAndNotifyAchievements(); } catch {}
        } catch {
            addLog(`Toss 페이지: toss.me/${TOSS_HANDLE}`, "");
        }
    }
}

function notifyPremium() {
    track("premium_notify_requested");
    try { Storage.markSupporter(); checkAndNotifyAchievements(); } catch {}
    addLog("💚 출시 알림 신청됨! 준비되는 대로 알려드릴게요.", "log-good");
}

// =========================================================================
// 약물 드릴 — Top 50 임상 약물 빠른 학습 (국시 + NCLEX 공통 핵심)
// =========================================================================
const DRUGS = [
    // 심혈관 (10)
    { name: "Aspirin", class: "항혈소판", action: "COX 억제 → 혈소판 응집 차단", se: "위장 출혈, 알레르기", monitor: "출혈 징후, CBC" },
    { name: "Warfarin", class: "항응고 (Vit K 길항)", action: "프로트롬빈 합성 억제", se: "출혈, 태아 기형", monitor: "PT/INR (목표 2-3)" },
    { name: "Heparin", class: "항응고", action: "Antithrombin III 활성화", se: "출혈, HIT", monitor: "aPTT (1.5-2배)" },
    { name: "Digoxin", class: "강심제", action: "Na-K ATPase 억제 → Ca 증가", se: "독성 (시야 황색·서맥)", monitor: "혈중농도 0.5-2 ng/mL, K+" },
    { name: "Furosemide", class: "Loop 이뇨제", action: "Henle 상행각 Na-K-Cl 차단", se: "저K, 청력 손실, 탈수", monitor: "K+, Cr, BUN, 체중" },
    { name: "Metoprolol", class: "β1 차단제", action: "심박·혈압 감소", se: "서맥, 기관지 수축, 우울", monitor: "HR(>60), BP" },
    { name: "Lisinopril", class: "ACEi", action: "Angiotensin II 합성 억제", se: "마른기침, 고K, 혈관부종", monitor: "Cr, K+, BP" },
    { name: "Atorvastatin", class: "Statin", action: "HMG-CoA 환원효소 억제", se: "간독성, 근육통 (횡문근융해)", monitor: "LFT, CK, lipid panel" },
    { name: "Nitroglycerin", class: "혈관확장제", action: "정맥 확장 → preload 감소", se: "두통, 저혈압, 내성", monitor: "BP, 흉통 호전" },
    { name: "Amiodarone", class: "Class III 항부정맥", action: "K 채널 차단 → AP 연장", se: "폐섬유화, 갑상선·간·시야", monitor: "TFT, LFT, CXR, 안과" },
    // 내분비 (5)
    { name: "Insulin (Regular)", class: "단기형 인슐린", action: "혈당 → 세포내 K+ 이동", se: "저혈당, 저K", monitor: "혈당, K+ (DKA 시)" },
    { name: "Metformin", class: "Biguanide", action: "간 포도당 생성 억제", se: "유산산증 (조영제 금기)", monitor: "Cr, B12, lactate" },
    { name: "Levothyroxine", class: "갑상선 호르몬", action: "T4 보충", se: "빈맥, 골밀도↓ (과량)", monitor: "TSH 6-8주마다" },
    { name: "Prednisone", class: "Glucocorticoid", action: "항염증·면역억제", se: "Cushing, 골다공증, 감염", monitor: "혈당, BP, 체중, 골밀도" },
    { name: "Glucagon", class: "혈당↑ 호르몬", action: "간 glycogen → glucose", se: "오심, 구토", monitor: "혈당 (저혈당 응급)" },
    // 진통/마취 (6)
    { name: "Morphine", class: "Opioid", action: "μ 수용체 작용", se: "호흡 억제, 변비, 의존", monitor: "RR(>12), 진통, 동공" },
    { name: "Fentanyl", class: "Opioid (강력)", action: "Morphine 100배", se: "호흡 억제, 흉벽 경직", monitor: "RR, SpO2" },
    { name: "Naloxone", class: "Opioid 길항제", action: "μ 수용체 차단", se: "급성 금단, 폐부종", monitor: "RR, 의식 (재투여 가능)" },
    { name: "Acetaminophen", class: "해열·진통", action: "중추 COX 억제", se: "간독성 (>4g/일)", monitor: "LFT, 일일 총량" },
    { name: "Ibuprofen", class: "NSAID", action: "COX-1/2 억제", se: "GI 출혈, 신독성", monitor: "Cr, GI 증상" },
    { name: "Lidocaine", class: "국소마취·항부정맥", action: "Na 채널 차단", se: "이명, 경련, 부정맥", monitor: "심전도, CNS 증상" },
    // 항생제 (6)
    { name: "Vancomycin", class: "Glycopeptide (MRSA)", action: "세포벽 합성 억제", se: "Red man, 신독성, 이독성", monitor: "trough 15-20, Cr" },
    { name: "Penicillin G", class: "β-lactam", action: "세포벽 합성 억제", se: "Anaphylaxis", monitor: "알레르기 병력" },
    { name: "Gentamicin", class: "Aminoglycoside", action: "단백 합성 억제 (30S)", se: "신독성, 이독성", monitor: "peak/trough, Cr, 청력" },
    { name: "Ciprofloxacin", class: "Fluoroquinolone", action: "DNA gyrase 억제", se: "건염 파열, QT 연장", monitor: "QT, 건 증상" },
    { name: "Metronidazole", class: "Nitroimidazole", action: "DNA 손상", se: "Disulfiram 반응 (음주 금기)", monitor: "신경증상, 음주 금지" },
    { name: "Azithromycin", class: "Macrolide", action: "단백 합성 (50S)", se: "QT 연장, GI 불편", monitor: "QT, 간기능" },
    // 호흡 (3)
    { name: "Albuterol", class: "β2 작용제", action: "기관지 확장", se: "빈맥, 떨림, 저K", monitor: "HR, SpO2, K+" },
    { name: "Ipratropium", class: "항콜린", action: "기관지 확장", se: "구건, 요폐 (BPH 주의)", monitor: "SpO2, 호흡음" },
    { name: "Theophylline", class: "Methylxanthine", action: "기관지 확장 + 횡격막 자극", se: "독성 (불안, 부정맥, 발작)", monitor: "혈중농도 10-20" },
    // 신경/정신 (5)
    { name: "Phenytoin", class: "항경련 (Na 차단)", action: "발작 역치 상승", se: "잇몸 비대, 다모, 안진", monitor: "혈중농도 10-20, LFT" },
    { name: "Lithium", class: "기분조절제", action: "양극성 유지", se: "독성 (떨림, 의식·신장)", monitor: "혈중농도 0.6-1.2, TFT, Cr" },
    { name: "Haloperidol", class: "1세대 항정신", action: "D2 차단", se: "EPS, NMS, QT 연장", monitor: "EPS, 체온, QT" },
    { name: "Diazepam", class: "Benzodiazepine", action: "GABA-A 강화", se: "호흡 억제, 의존", monitor: "RR, 의식 (역제 flumazenil)" },
    { name: "Sertraline", class: "SSRI", action: "Serotonin 재흡수 차단", se: "GI, 성기능, 자살 사고 증가(청소년)", monitor: "기분, 자살 사고" },
    // GI (3)
    { name: "Omeprazole", class: "PPI", action: "위산 분비 억제", se: "B12·Mg·Ca↓, C.diff", monitor: "장기 사용 시 골밀도" },
    { name: "Ondansetron", class: "5-HT3 길항", action: "구토 중추 억제", se: "QT 연장, 두통, 변비", monitor: "QT" },
    { name: "Loperamide", class: "지사제 (Opioid 유사)", action: "장 운동 억제", se: "변비, 마비성 장폐색", monitor: "배변 양상" },
    // 응급/기타 (12)
    { name: "Epinephrine", class: "α/β 작용제", action: "혈관 수축 + 기관지 확장", se: "고혈압, 빈맥, 부정맥", monitor: "HR, BP, ECG" },
    { name: "Atropine", class: "항콜린 (서맥용)", action: "M 수용체 차단", se: "구건, 요폐, 빈맥", monitor: "HR (서맥 응급용)" },
    { name: "Magnesium sulfate", class: "Mg 보충 (자간전증)", action: "신경근 차단", se: "독성 (반사 소실, 호흡 억제)", monitor: "DTR, RR, 소변량" },
    { name: "Calcium gluconate", class: "Ca 보충", action: "Mg 독성 역제·고K 안정화", se: "조직 괴사 (extravasation)", monitor: "ECG, IV 부위" },
    { name: "Potassium chloride", class: "K 보충", action: "K 정상화", se: "고K (>5.5 → ECG 변화)", monitor: "K+, ECG (peaked T)" },
    { name: "Mannitol", class: "삼투성 이뇨제", action: "두개내압↓·이뇨", se: "탈수, 폐부종 (CHF 금기)", monitor: "ICP, 소변량, 전해질" },
    { name: "Heparin (LMW Enoxaparin)", class: "저분자량 헤파린", action: "Factor Xa 억제", se: "출혈 (역제 protamine 일부)", monitor: "Anti-Xa, 혈소판" },
    { name: "Furosemide-K-sparing combo (Spironolactone)", class: "K 보존 이뇨제", action: "Aldosterone 길항", se: "고K, 여성형 유방", monitor: "K+, Cr, BP" },
    { name: "tPA (Alteplase)", class: "혈전 용해", action: "Plasminogen → Plasmin", se: "두개내 출혈", monitor: "ICH 증상, BP <185/110" },
    { name: "Dobutamine", class: "β1 작용 (cardiogenic shock)", action: "심수축력 증가", se: "빈맥, 부정맥", monitor: "HR, BP, CO" },
    { name: "Norepinephrine", class: "α 작용 (septic shock 1st)", action: "혈관 수축", se: "extravasation 시 괴사", monitor: "MAP >65, IV 부위" },
    { name: "Vasopressin", class: "ADH 작용", action: "혈관 수축 + 수분 보유", se: "저Na (SIADH 유사)", monitor: "Na, 소변량" },
];

const DRUG_QUESTION_TYPES = ["action", "class", "se", "monitor"];

function renderDrugDrill() {
    gameState.mode = "drug_drill_menu";
    resetStateForMode();
    showCoreUI();
    if (UI.logBar) UI.logBar.innerHTML = "";
    updateStats();
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">약물 드릴</h2>
        <p class="scene-desc">국시·NCLEX 공통 핵심 약물 ${DRUGS.length}종. 무작위로 작용·계열·부작용·모니터링 항목을 묻습니다.</p>
        <div class="drug-stats-grid">
            <div class="drug-stat-card"><div class="drug-stat-num">${DRUGS.length}</div><div class="drug-stat-label">약물</div></div>
            <div class="drug-stat-card"><div class="drug-stat-num">4</div><div class="drug-stat-label">질문 유형</div></div>
            <div class="drug-stat-card"><div class="drug-stat-num">10</div><div class="drug-stat-label">세트 문항</div></div>
        </div>
        <div class="choice-list">
            <button class="choice-btn primary" data-action="startDrugDrill">🎯 10문제 시작</button>
            <button class="choice-btn center" data-action="returnToMenu">메인 메뉴</button>
        </div>
      </div>`;
    track("drug_drill_menu");
}

function startDrugDrill() {
    // 10문제 무작위 생성 — 각 문제는 (약물, 질문유형) 페어
    const pool = [];
    const used = new Set();
    while (pool.length < 10) {
        const drug = DRUGS[Math.floor(Math.random() * DRUGS.length)];
        const qType = DRUG_QUESTION_TYPES[Math.floor(Math.random() * DRUG_QUESTION_TYPES.length)];
        const key = `${drug.name}|${qType}`;
        if (used.has(key)) continue;
        used.add(key);
        pool.push(buildDrugQuestion(drug, qType));
    }
    gameState.mode = "drug_drill";
    gameState.drugPool = pool;
    gameState.drugIndex = 0;
    gameState.drugCorrect = 0;
    Storage.markModeUsed("drug_drill");
    renderDrugDrillCard();
    track("drug_drill_start");
}

function buildDrugQuestion(drug, qType) {
    const LABELS = {
        action: { q: "다음 약물의 작용 기전은?", field: "action" },
        class: { q: "다음 약물의 계열은?", field: "class" },
        se: { q: "다음 약물의 주요 부작용은?", field: "se" },
        monitor: { q: "다음 약물 투여 시 모니터링 항목은?", field: "monitor" },
    };
    const label = LABELS[qType];
    const correctText = drug[label.field];
    // 오답 3개 — 같은 필드의 다른 약물에서 가져옴
    const wrongPool = DRUGS.filter(d => d.name !== drug.name).map(d => d[label.field]);
    const shuffled = wrongPool.sort(() => Math.random() - 0.5).slice(0, 3);
    const choices = [
        { text: correctText, correct: true, log: `정답. ${drug.name} = ${label.field === "action" ? "작용: " : label.field === "class" ? "계열: " : label.field === "se" ? "부작용: " : "모니터: "}${correctText}` },
        ...shuffled.map(t => ({ text: t, log: `오답. 이 답은 다른 약물의 ${label.field === "action" ? "작용" : label.field === "class" ? "계열" : label.field === "se" ? "부작용" : "모니터"}입니다.` })),
    ];
    // 셔플
    for (let i = choices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    return { drug: drug.name, qType, prompt: `${label.q} — ${drug.name}`, choices };
}

function renderDrugDrillCard() {
    const pool = gameState.drugPool || [];
    const i = gameState.drugIndex || 0;
    if (i >= pool.length) { renderDrugDrillSummary(); return; }
    const q = pool[i];
    const choicesHtml = q.choices.map((c, idx) => `
        <button class="choice-btn" data-action="drugDrillAnswer" data-idx="${idx}">${escapeHtml(c.text)}</button>
    `).join("");
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <div class="quiz-progress">💊 약물 드릴 ${i + 1}/${pool.length}</div>
        <h2 class="scene-title">${escapeHtml(q.prompt)}</h2>
        <div class="choice-list" id="drug-drill-choices">${choicesHtml}</div>
        <div id="drug-drill-feedback" class="image-quiz-feedback hidden"></div>
        <button class="choice-btn subtle center hidden" id="drug-drill-next-btn" data-action="drugDrillNext">다음 →</button>
        <button class="choice-btn center" data-action="returnToMenu">중단하고 메뉴로</button>
      </div>`;
}

function drugDrillAnswer(t) {
    const pool = gameState.drugPool || [];
    const i = gameState.drugIndex || 0;
    const q = pool[i];
    if (!q) return;
    const idx = parseInt(t.dataset.idx, 10);
    const choice = q.choices[idx];
    if (!choice) return;
    const isCorrect = !!choice.correct;
    if (isCorrect) { gameState.drugCorrect = (gameState.drugCorrect || 0) + 1; Sound.correct(); }
    else { Sound.wrong(); }
    document.querySelectorAll("#drug-drill-choices .choice-btn").forEach((btn, bi) => {
        btn.disabled = true;
        const c = q.choices[bi];
        if (c && c.correct) btn.classList.add("correct-flash");
        else if (bi === idx) btn.classList.add("wrong-flash");
    });
    const fb = document.getElementById("drug-drill-feedback");
    if (fb) {
        fb.innerHTML = `
            <div class="${isCorrect ? "feedback-good" : "feedback-bad"}">${isCorrect ? "✅ 정답" : "❌ 오답"}</div>
            <div class="feedback-log">${escapeHtml(choice.log || "")}</div>`;
        fb.classList.remove("hidden");
    }
    const nextBtn = document.getElementById("drug-drill-next-btn");
    if (nextBtn) nextBtn.classList.remove("hidden");
    track("drug_drill_answer", { correct: isCorrect, drug: q.drug, qType: q.qType });
}

function drugDrillNext() {
    gameState.drugIndex = (gameState.drugIndex || 0) + 1;
    renderDrugDrillCard();
}

function renderDrugDrillSummary() {
    const total = (gameState.drugPool || []).length;
    const correct = gameState.drugCorrect || 0;
    const acc = total > 0 ? Math.round((correct / total) * 100) : 0;
    try { Storage.recordSetScore("💊 약물 드릴", correct, total); checkAndNotifyAchievements(); } catch {}
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">완료</h2>
        <div class="quiz-summary-stats">
            <div class="quiz-stat-row"><span>총 문제</span><strong>${total}</strong></div>
            <div class="quiz-stat-row"><span>정답</span><strong>${correct}</strong></div>
            <div class="quiz-stat-row"><span>정답률</span><strong>${acc}%</strong></div>
        </div>
        <div class="choice-list">
          <button class="choice-btn primary" data-action="renderDrugDrill">다시 풀기</button>
          <button class="choice-btn center" data-action="returnToMenu">메인 메뉴</button>
        </div>
      </div>`;
    track("drug_drill_complete", { total, correct, acc });
}

// 로컬 리더보드 — 본인 최고 기록 페이지
function renderLeaderboard() {
    gameState.mode = "leaderboard";
    showCoreUI(); updateStats();
    const lb = Storage.getLeaderboard();
    const data = Storage.load();
    const streak = (data.streak && typeof data.streak === "object") ? data.streak : { count: 0, best: 0 };
    const counters = (data.achievements && data.achievements.counters) || {};
    const mockBest = counters.mockBest || lb.mockBest || 0;

    const topSetsHtml = (lb.topSets && lb.topSets.length > 0)
        ? lb.topSets.map((s, i) => {
            const acc = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `<span class="lb-rank">${i+1}</span>`;
            const dt = new Date(s.ts || 0);
            const dateStr = `${dt.getMonth()+1}/${dt.getDate()}`;
            return `<div class="lb-row">
                <div class="lb-medal">${medal}</div>
                <div class="lb-body">
                    <div class="lb-title">${escapeHtml(s.category || "전체")}</div>
                    <div class="lb-sub">${s.correct}/${s.total} · ${dateStr}</div>
                </div>
                <div class="lb-acc">${acc}%</div>
            </div>`;
        }).join("")
        : `<div class="empty-state">
            <svg class="empty-state-svg" viewBox="0 0 120 120" fill="none">
                <circle cx="60" cy="60" r="50" fill="var(--primary-soft)"/>
                <path d="M40 70 L55 55 L65 65 L80 50" stroke="var(--primary)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                <circle cx="80" cy="50" r="4" fill="var(--primary)"/>
            </svg>
            <div class="empty-state-title">아직 기록이 없어요</div>
            <div class="empty-state-sub">퀴즈 세트를 한 번 완주하면 여기에 기록돼요.</div>
          </div>`;

    UI.gameArea.innerHTML = `
      <div class="card">
        <h2 class="scene-title">나의 기록</h2>
        <div class="lb-summary">
            <div class="lb-summary-cell">
                <div class="lb-summary-label">모의고사 최고</div>
                <div class="lb-summary-value">${mockBest > 0 ? mockBest + "점" : "—"}</div>
            </div>
            <div class="lb-summary-cell">
                <div class="lb-summary-label">연속 학습 최고</div>
                <div class="lb-summary-value">${streak.best > 0 ? streak.best + "일" : "—"}</div>
            </div>
            <div class="lb-summary-cell">
                <div class="lb-summary-label">현재 연속</div>
                <div class="lb-summary-value">${streak.count > 0 ? streak.count + "일" : "—"}</div>
            </div>
        </div>
        <h3 class="settings-section">세트 정답률 TOP 10</h3>
        <div class="lb-list">${topSetsHtml}</div>
        <button class="choice-btn center" data-action="returnToMenu">메인 메뉴</button>
      </div>`;
    track("leaderboard_view");
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
          <p>본 앱은 <strong>학습 데이터·개인 식별정보를 외부 서버로 전송하지 않습니다.</strong> 다음 항목만 사용자 기기의 브라우저 localStorage 에 저장됩니다:</p>
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
            <li><strong>학습 데이터는 기기 내에만 저장</strong> — 외부 서버로 전송하지 않음 (PWA cache-first)</li>
            <li>광고(Google AdMob)·익명 사용 통계(Plausible) 는 모바일 빌드에서 작동할 수 있으며, 개인 식별정보는 수집하지 않습니다</li>
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
    // 게임 카드 모드(quiz/survival/episode 등)는 보기 버튼이 onclick 으로 바인딩되어
    // innerHTML 스냅샷 복원 시 리스너가 죽어 클릭 불능 → 안전하게 메뉴로 복귀.
    // 정적 페이지(메뉴/설정 등)만 스냅샷 복원 허용.
    const RESTORABLE = new Set(["settings", "dashboard", "leaderboard", "bookmarks", "premium", "weekly", "about", "privacy"]);
    if (ret && ret.html && ret.mode && RESTORABLE.has(ret.mode)) {
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
          <p class="legal-note"><strong>권장 연령:</strong> 만 15세 이상 (간호학과 학생·간호사 대상). 자해·약물·임종 등 일부 민감 컨텐츠 포함 — 해당 에피소드엔 ⚠️ 라벨 표시.</p>
          <p class="legal-note"><strong>컨텐츠 상태:</strong> 정식 RN/MD 감수 전 베타. AI 1차 검토를 거쳤으나 오류 가능성이 있으며, 앱 내 "오류 신고"로 제보할 수 있습니다.</p>
        </section>

        <section class="legal-section">
          <h2 class="legal-h">🔒 개인정보 처리방침 (요약)</h2>
          <ul class="legal-list">
            <li>학습 데이터는 <strong>모두 사용자 기기 안에서만 처리</strong>됩니다 (브라우저 localStorage).</li>
            <li>저장되는 항목: 학습 통계, 오답 노트, 사운드/테마 설정, 일일 챌린지 기록.</li>
            <li>모바일 빌드에서는 광고(Google AdMob)·익명 사용 통계가 작동할 수 있으나, <strong>개인 식별정보는 외부로 전송되지 않습니다.</strong></li>
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
    track("legal_accepted", { version: LEGAL_VERSION });
    const cont = UI._onLegalAccept;
    UI._onLegalAccept = null;
    if (typeof cont === "function") cont(); else returnToMenu();
}

// =========================================================================
// 온보딩 (첫 실행 튜토리얼 — 5 슬라이드)
// =========================================================================
// 온보딩 일러스트 — Claude 디자인 SVG 5종 (images/onboard-*.svg)
const ONBOARDING_ILLUSTRATIONS = [
    '<img class="onboard-svg" src="images/onboard-1-welcome.svg" alt="" aria-hidden="true">',
    '<img class="onboard-svg" src="images/onboard-2-simulation.svg" alt="" aria-hidden="true">',
    '<img class="onboard-svg" src="images/onboard-3-nclex.svg" alt="" aria-hidden="true">',
    '<img class="onboard-svg" src="images/onboard-4-analytics.svg" alt="" aria-hidden="true">',
    '<img class="onboard-svg" src="images/onboard-5-start.svg" alt="" aria-hidden="true">',
];

const ONBOARDING_SLIDES = [
    { illust: 0, title: "간호사 시뮬레이터에 오신 것을 환영합니다",
      body: "한국 국시 320문항 + NCLEX-RN 2,200문항 + 실전 듀티 시뮬레이션을 하나의 앱에서.\n완전 무료, 가입 없음, 광고는 보상형만 사용합니다." },
    { illust: 1, title: "실전 듀티 시뮬레이션",
      body: "Day · Evening · Night 3교대 시프트로 임상 상황을 체험하세요.\n시프트에 따라 HP 손실과 난이도가 달라집니다." },
    { illust: 2, title: "NCLEX-RN 2,200 문제",
      body: "MCQ + SATA + 우선순위까지 미국 간호사 시험 전 범위를 무료로.\n해외 취업 준비도 한 앱에서 가능합니다." },
    { illust: 3, title: "통계로 약점 파악",
      body: "과목별 정답률 막대 그래프 · 오답 자동 저장 · 14일 연속 배지.\n키보드 단축키(1~5, ↑↓, T, M, ESC)도 지원합니다." },
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
    track("onboarding_complete");
    returnToMenu();
    // 신규 사용자의 ?ref= / ?shortcut= URL 파라미터 — 온보딩 완료 후에도 한 번 더 처리
    try { handleShortcutUrl(); } catch {}
}

// =========================================================================
// 직군 선택 (persona picker) — 시장 확장용 수요 신호 수집
// 온보딩 완료 후 1회 노출. 메인 메뉴 위에 오버레이로 표시.
// =========================================================================
const PERSONA_OPTIONS = [
    { id: "student",    icon: "🩺", label: "간호학과 학생",   sub: "재학생",       available: true },
    { id: "rn-exam",    icon: "📖", label: "간호사 국시 준비", sub: "시험 준비",     available: true },
    { id: "nclex",      icon: "🇺🇸", label: "NCLEX-RN 준비",   sub: "미국 간호사 면허", available: true },
    { id: "pharmacist", icon: "💊", label: "약사 국시",        sub: "예정",         available: false },
];

function renderPersonaPicker() {
    // 기존 picker 가 있으면 중복 렌더 방지
    if (document.getElementById("persona-picker-overlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "persona-picker-overlay";
    overlay.className = "persona-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "persona-title");
    const cards = PERSONA_OPTIONS.map(opt => {
        const disabled = !opt.available;
        return `
          <button class="persona-card${disabled ? " disabled" : ""}"
                  data-action="choosePersona"
                  data-persona="${opt.id}"
                  ${disabled ? 'aria-disabled="true"' : ""}>
            ${disabled ? '<span class="persona-coming">곧 만나요</span>' : ""}
            <span class="persona-icon" aria-hidden="true">${opt.icon}</span>
            <span class="persona-label">${escapeHtml(opt.label)}</span>
            <span class="persona-sub">${escapeHtml(opt.sub)}</span>
          </button>`;
    }).join("");
    overlay.innerHTML = `
      <div class="persona-card-wrap">
        <h2 id="persona-title" class="persona-title">어떤 분야 준비 중이세요?</h2>
        <p class="persona-subdesc">학습 콘텐츠 추천에 활용해요. 언제든 설정에서 변경할 수 있어요.</p>
        <div class="persona-grid">${cards}</div>
        <button class="choice-btn subtle center" data-action="skipPersona">나중에 선택</button>
      </div>`;
    document.body.appendChild(overlay);
    track("persona_picker_shown");
}

function closePersonaPicker() {
    const overlay = document.getElementById("persona-picker-overlay");
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
}

function choosePersona(discipline) {
    if (!discipline) return;
    // "예정" 분야 — 수요 신호 + 오버레이 내부에 즉시 피드백 (logBar 가 가려져 있을 수 있음)
    if (discipline === "pharmacist" || discipline === "ems") {
        track("persona_demand_signal", { discipline });
        const wrap = document.querySelector(".persona-card-wrap");
        if (wrap && !wrap.querySelector(".persona-toast")) {
            const toast = document.createElement("div");
            toast.className = "persona-toast";
            toast.textContent = "관심 감사합니다! 곧 만나요 💚";
            wrap.appendChild(toast);
            setTimeout(() => { toast.remove(); }, 2400);
        }
        return;
    }
    // NCLEX 선택 시 영어 모드를 자동 활성화 (사용자 의도 강한 신호)
    if (discipline === "nclex") {
        try { Storage.setExamMode("nclex"); } catch {}
    }
    Storage.setPersona(discipline, null);
    track("persona_chosen", { discipline });
    closePersonaPicker();
    returnToMenu();
}

// =========================================================================
// 메인 메뉴 (returnToMenu)
// =========================================================================
function returnToMenu() {
    // 타자기 효과 타이머 정리 — 모드 전환 시 누수 방지 (orphan DOM 대상 interval)
    try { if (_typewriterTimer) { clearInterval(_typewriterTimer); _typewriterTimer = null; } } catch {}
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

    UI.gameArea.innerHTML = renderMenuTabs(data, dailyDone, wrongCount);
    // CSS :has() 호환 폴백 — body에 has-tabbar 클래스 부여
    try { document.body.classList.add("has-tabbar"); } catch {}

    // 스크롤 복원 — 메뉴 탭별로 마지막 위치 기억 (잡스: "Continuity")
    requestAnimationFrame(() => {
        try {
            const key = `nurseSim:scroll:${gameState.menuTab || "home"}`;
            const saved = parseInt(sessionStorage.getItem(key) || "0", 10);
            if (Number.isFinite(saved) && saved > 0) window.scrollTo(0, saved);
            // 이후 스크롤은 새로 추적 (탭 전환마다 다시 저장)
            const onScroll = () => {
                try { sessionStorage.setItem(key, String(window.scrollY || 0)); } catch {}
            };
            window.removeEventListener("scroll", window.__menuScrollSave || (()=>{}));
            window.__menuScrollSave = onScroll;
            window.addEventListener("scroll", onScroll, { passive: true });
        } catch {}
    });

    // 메인 메뉴에서도 상단 헤더는 표시(테마/사운드 토글 위해)
    UI.topBar.classList.remove("hidden");
}

// =========================================================================
// D-day 카운트다운 (한국 국시 / NCLEX) — 9~12월 트래픽 폭증 유도
// =========================================================================
// 한국 간호사 국가시험 — 매년 1월 셋째주 수요일 (대략)
// 시험 후 4일 지나면 자동으로 +1년 (운영 부담 0)
const KOREAN_EXAM_BASE = "2027-01-20"; // 기준 — KNCA 공식 발표 시 업데이트

function getKoreanExamDate() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let target = new Date(KOREAN_EXAM_BASE + "T00:00:00");
    // 시험 후 4일 이상 지났으면 다음 해로 자동 이동
    while ((today - target) / (1000 * 60 * 60 * 24) > 4) {
        target.setFullYear(target.getFullYear() + 1);
    }
    return target.toISOString().slice(0, 10);
}
// 호환성 — 기존 코드는 KOREAN_EXAM_DATE 참조
const KOREAN_EXAM_DATE = getKoreanExamDate();

function getDaysUntil(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + "T00:00:00");
    const diffMs = target.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// 카운트다운 단계별 SVG 아이콘 — 기간에 따라 모양이 진화
// 7단계: 달력 → 책 → 근육 → 로켓 → 번개 → 불꽃 → 트로피
const COUNTDOWN_ICONS = {
    // 달력 + 햇살 (여유) — D-200+
    calendar: '<svg class="cd-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="12" width="32" height="28" rx="3"/><path d="M8 20h32"/><path d="M16 8v6 M32 8v6" stroke-width="2.5"/><circle cx="24" cy="30" r="3.5" fill="currentColor" opacity="0.3"/><path d="M24 23 v2 M24 35 v2 M17 30 h2 M29 30 h2 M19 25 l1.5 1.5 M28.5 33.5 l-1.5 -1.5 M19 35 l1.5 -1.5 M28.5 26.5 l-1.5 1.5" opacity="0.6"/></svg>',
    // 펼친 책 (장기 학습) — D-100~200
    book: '<svg class="cd-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 10 L24 14 L42 10 V36 L24 40 L6 36 Z" fill="currentColor" fill-opacity="0.12"/><path d="M24 14 V40" stroke-width="2"/><path d="M10 16 h10 M10 22 h10 M10 28 h10 M28 16 h10 M28 22 h10 M28 28 h8" stroke-width="1.5" opacity="0.7"/></svg>',
    // 근육 / 화이팅 — D-30~100
    muscle: '<svg class="cd-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 28 Q14 18 22 16 Q30 14 36 20 Q40 24 38 30 Q34 36 28 36 L22 38 Q16 38 14 32 Z" fill="currentColor" fill-opacity="0.15"/><path d="M22 22 Q26 24 28 28" opacity="0.6"/><path d="M30 14 L34 8 M36 16 L42 14 M34 22 L42 22" stroke-width="2" stroke-linecap="round"/></svg>',
    // 로켓 (스프린트 시작) — D-7~30
    rocket: '<svg class="cd-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M24 4 Q34 12 34 26 L34 34 L14 34 L14 26 Q14 12 24 4 Z" fill="currentColor" fill-opacity="0.15"/><circle cx="24" cy="20" r="4"/><path d="M14 30 L8 38 L14 36 Z M34 30 L40 38 L34 36 Z" fill="currentColor" fill-opacity="0.2"/><path d="M20 38 L22 44 M28 38 L26 44 M24 38 V46" stroke="#d68945" stroke-width="2.5" opacity="0.85"/></svg>',
    // 번개 (1주 스프린트) — D-3~7
    bolt: '<svg class="cd-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M26 4 L10 26 L22 26 L18 44 L38 20 L26 20 Z" fill="currentColor" fill-opacity="0.25"/></svg>',
    // 불꽃 (최종 점검) — D-0~3
    fire: '<svg class="cd-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M24 4 Q26 14 32 18 Q40 26 36 36 Q32 44 24 44 Q16 44 12 36 Q8 28 14 22 Q18 18 18 12 Q22 14 24 4 Z" fill="currentColor" fill-opacity="0.25"/><path d="M24 24 Q26 30 28 34 Q26 38 24 38 Q22 38 20 34 Q22 30 24 24 Z" fill="currentColor" fill-opacity="0.4"/></svg>',
    // 트로피 (D-day / 응원) — D-day
    trophy: '<svg class="cd-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 8 H34 V18 Q34 28 24 30 Q14 28 14 18 Z" fill="currentColor" fill-opacity="0.2"/><path d="M14 12 H8 Q8 18 14 20 M34 12 H40 Q40 18 34 20"/><path d="M20 30 V36 H28 V30 M18 40 H30 V44 H18 Z" fill="currentColor" fill-opacity="0.15"/><circle cx="24" cy="18" r="3" fill="currentColor" opacity="0.5"/></svg>',
};

function getCountdownStage(days) {
    if (days < -3) return { stage: "after", tone: "cool", icon: "calendar", label: "다음 국시", sub: "긴 호흡으로 차근차근" };
    if (days < 0)  return { stage: "post", tone: "hot",  icon: "trophy",   label: "국시 응원",   sub: "결과 발표를 기다려요" };
    if (days === 0) return { stage: "dday", tone: "hot",  icon: "trophy",  label: "D-day",       sub: "침착하게 평소처럼 — 화이팅!" };
    if (days <= 3)   return { stage: "final",   tone: "hot",    icon: "fire",     label: "최종 점검",     sub: "오답·핵심 약물·우선순위 정리" };
    if (days <= 7)   return { stage: "sprint",  tone: "hot",    icon: "bolt",     label: "1주 스프린트",  sub: "고빈도 키워드 + 모의고사 1회" };
    if (days <= 30)  return { stage: "intense", tone: "warm",   icon: "rocket",   label: "D-30 집중기",   sub: "매일 5문제 + 오답 복습" };
    if (days <= 100) return { stage: "focus",   tone: "warm",   icon: "muscle",   label: "D-100 시작",    sub: "지금부터 매일 1시간이면 충분" };
    if (days <= 200) return { stage: "long",    tone: "normal", icon: "book",     label: "장기 학습",     sub: "기초 다지기 좋은 시기" };
    return                  { stage: "early",   tone: "cool",   icon: "calendar", label: "국시까지",      sub: "여유 있게 — 천천히 누적" };
}

function renderExamCountdown() {
    let days = getDaysUntil(KOREAN_EXAM_DATE);
    let displayDays = days;
    // 시험 이후 → 다음 시험까지 (대략 +365일)
    if (days < -3) {
        const next = new Date(KOREAN_EXAM_DATE);
        next.setFullYear(next.getFullYear() + 1);
        displayDays = getDaysUntil(next.toISOString().slice(0, 10));
    }
    const st = getCountdownStage(days);
    const iconSvg = COUNTDOWN_ICONS[st.icon] || COUNTDOWN_ICONS.calendar;
    const daysText = (days < 0 && days >= -3) ? "고생했어요!" : (days === 0) ? "오늘이 시험일" : `D-${displayDays}`;
    // 시험 후 3일간은 응원, 그 외엔 학습 탭 이동
    const isInteractive = days > 0;
    const tag = isInteractive ? "button" : "div";
    const interactiveAttrs = isInteractive ? `data-action="setMenuTab" data-tab="study" aria-label="학습 탭으로 이동 — ${st.label}"` : "";
    return `<${tag} class="countdown-card ${st.tone} cd-stage-${st.stage}" ${interactiveAttrs}>
        <div class="cd-icon-wrap">${iconSvg}</div>
        <div class="cd-body">
            <div class="cd-label">${st.label}</div>
            <div class="cd-days">${daysText}</div>
            <div class="cd-sub">${st.sub}</div>
        </div>
    </${tag}>`;
}

// NCLEX 모드 — 한국인 해외 진출 / 영어권 학습자용 콜아웃
function renderNclexCallout() {
    const _t = (k, fb) => (typeof window !== "undefined" && window.I18N) ? window.I18N.t(k, fb) : fb;
    // 지구본 아이콘 (글로벌 NCLEX)
    const globeIcon = '<svg class="cd-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="24" cy="24" r="18" fill="currentColor" fill-opacity="0.12"/><ellipse cx="24" cy="24" rx="9" ry="18"/><path d="M6 24 h36 M6 16 h36 M6 32 h36" opacity="0.6"/></svg>';
    return `<div class="countdown-card warm">
        <div class="cd-icon-wrap">${globeIcon}</div>
        <div class="cd-body">
            <div class="cd-label">${_t("nclex.callout.label", "NCLEX-RN")}</div>
            <div class="cd-days">2,200 ${_t("nclex.callout.questions", "문항")}</div>
            <div class="cd-sub">${_t("nclex.callout.sub", "100% 무료 · MCQ + SATA + 우선순위")}</div>
        </div>
    </div>`;
}

if (typeof window !== "undefined") {
    window.KOREAN_EXAM_DATE = KOREAN_EXAM_DATE;
    window.getDaysUntil = getDaysUntil;
    window.renderExamCountdown = renderExamCountdown;
}

// 30일 학습 캘린더 — GitHub contribution graph 형식 (7×5 그리드)
// 활동 = daily 챌린지 완료 OR history 엔트리 있음
function _getActiveDaySet(data) {
    const active = new Set();
    // daily 챌린지 — 날짜 키 직접
    if (data && data.daily && typeof data.daily === "object") {
        for (const k of Object.keys(data.daily)) {
            const d = data.daily[k];
            if (d && (d.solved > 0 || d.completed)) active.add(k);
        }
    }
    // history — 모든 모드 완료 (timestamp → dateKey 변환)
    if (data && Array.isArray(data.history)) {
        for (const h of data.history) {
            if (!h || !h.at) continue;
            const dt = new Date(h.at);
            const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
            active.add(key);
        }
    }
    // streak lastDate
    if (data && data.streak && data.streak.lastDate) active.add(data.streak.lastDate);
    return active;
}

function renderStudyCalendar(data) {
    const active = _getActiveDaySet(data);
    // 빈 캘린더는 카드 안 그림 (신규 사용자 노이즈 방지)
    if (active.size === 0) return "";
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const cells = [];
    let activeCount = 0;
    for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const isActive = active.has(key);
        const isToday = i === 0;
        if (isActive) activeCount++;
        cells.push(`<span class="cal-cell${isActive ? " on" : ""}${isToday ? " today" : ""}" title="${key}${isActive ? " · 학습" : ""}" aria-label="${key}${isActive ? " 학습함" : " 미학습"}"></span>`);
    }
    return `<div class="study-calendar" aria-label="최근 30일 학습 캘린더">
        <div class="cal-header">
            <span class="cal-title">최근 30일</span>
            <span class="cal-meta">${activeCount}/30일 학습</span>
        </div>
        <div class="cal-grid" role="grid">${cells.join("")}</div>
    </div>`;
}

// 3탭 메뉴 시스템
function renderMenuTabs(data, dailyDone, wrongCount) {
    if (!gameState.menuTab) gameState.menuTab = "home";
    const tab = gameState.menuTab;
    const todayDaily = data.daily[todayKey()];
    const dailyCorrect = todayDaily?.correct || 0;
    const bookmarkCount = Object.keys(data.bookmarks || {}).length;
    const weekly = computeWeeklyReport(Date.now(), data);
    const streak = (data.streak && typeof data.streak === "object") ? data.streak : { count: 0, best: 0, lastDate: null };
    // 오늘 또는 어제 학습했으면 streak 유효, 아니면 끊긴 것으로 표시
    // streakAlive — 오늘/어제/그저께(그레이스 1회 보유 시) 모두 유효 처리
    const _todayK = todayKey();
    const _yK = dateKeyOffset(-1);
    const _2K = dateKeyOffset(-2);
    const _freezeRecent = streak.freezeUsedAt && streak.freezeUsedAt >= dateKeyOffset(-6);
    const streakAlive = streak.lastDate === _todayK
        || streak.lastDate === _yK
        || (streak.lastDate === _2K && !_freezeRecent);
    const streakCount = streakAlive ? streak.count : 0;
    // 그레이스 사용 안내 — 오늘 처음 메뉴 진입 시 한 번
    const showedGrace = streak._lastGraceLog === _todayK;
    const graceHint = showedGrace ? '<span class="streak-grace">🧊 1회 보호 사용됨</span>' : "";
    // 손실 경고 — 오후 8시 이후 오늘 학습 안 한 streak 보유자에게 부드러운 알림
    const nowHour = new Date().getHours();
    const studiedToday = streak.lastDate === _todayK;
    const atRisk = streakCount >= 2 && !studiedToday && nowHour >= 20;
    const riskHint = atRisk ? `<span class="streak-risk">⏰ 오늘 학습하면 ${streakCount}일 유지</span>` : "";
    const streakHtml = streakCount >= 1
        ? `<div class="streak-banner${atRisk ? ' at-risk' : ''}" title="연속 학습일">🔥 <strong>${streakCount}일</strong> 연속 학습 중${streak.best > streakCount ? ` · 최고 ${streak.best}일` : ""}${graceHint}${riskHint}</div>`
        : "";

    // D-day 카운트다운 — 한국 국시 (1월) / NCLEX 모드 시 비활성
    const examModeForCountdown = (typeof Storage !== "undefined" && Storage.getExamMode) ? Storage.getExamMode() : "korean";
    const countdownHtml = examModeForCountdown === "korean" ? renderExamCountdown() : renderNclexCallout();

    // 30일 학습 캘린더 — 활동 일자 시각화 (GitHub contribution graph 형식)
    const calendarHtml = renderStudyCalendar(data);

    // 활성 에피소드(이어하기) 탐지
    let resumeEp = null;
    if (NC && NC.EPISODES) {
        for (const ep of NC.EPISODES) {
            const p = Storage.getEpisodeProgress(ep.id);
            if (p && p.step > 0 && p.step < ep.steps.length) {
                resumeEp = { ep, progress: p };
                break;
            }
        }
    }

    const weeklyHtml = (weekly.modesPlayed > 0) ? `
      <button class="weekly-report-card" data-action="renderWeeklyReport" aria-label="이번 주 학습 요약 보기">
        <div class="wr-label">${weekly.isSundayAfternoon ? '🗓 일요일 위클리 리포트' : '🗓 이번 주 요약'}</div>
        <div class="wr-title">${weekly.totalSolved}문제 풀이 · 정답률 ${weekly.accuracy}%</div>
        <div class="wr-stats">
          <span><strong>${weekly.daysActive}</strong>일 학습</span>
          <span><strong>${weekly.modesPlayed}</strong>회 모드 완료</span>
        </div>
      </button>` : '';

    const renderHome = () => `
      <div class="tab-section">
        ${countdownHtml}
        ${streakHtml}
        ${calendarHtml}
        ${weeklyHtml}
        ${resumeEp ? `
          <button class="resume-card" data-action="startEpisode" data-arg="${escapeHtml(resumeEp.ep.id)}">
            <div class="resume-label">이어하기</div>
            <div class="resume-title">${escapeHtml(resumeEp.ep.title)}</div>
            <div class="resume-sub">${resumeEp.progress.step} / ${resumeEp.ep.steps.length} 단계 · HP ${resumeEp.progress.hp} · REP ${resumeEp.progress.rep}</div>
          </button>` : ''}

        <button class="hero-card ${Storage.isFirstAction() ? 'hero-card-first' : ''}" data-action="initSurvival">
          ${Storage.isFirstAction() ? '<div class="hero-tooltip" aria-hidden="true">👇 여기 먼저 눌러보세요</div>' : ''}
          <div class="hero-label">지금 시작</div>
          <div class="hero-title">오늘의 듀티</div>
          <div class="hero-sub">환자 관리하며 점수 쌓기</div>
        </button>

        <div class="home-row">
          <button class="row-card ${dailyDone ? 'done' : ''}" data-action="startDailyChallenge">
            <div class="row-icon">${ICONS.daily}</div>
            <div class="row-body">
              <div class="row-title">일일 챌린지 ${dailyDone ? '<span class="row-pill done">완료</span>' : ''}</div>
              <div class="row-sub">${dailyDone ? `오늘 ${dailyCorrect}/${DAILY_CHALLENGE_TOTAL} 정답` : `매일 ${DAILY_CHALLENGE_TOTAL}문제`}</div>
            </div>
            <div class="row-chev">›</div>
          </button>

          ${wrongCount > 0 ? `
          <button class="row-card" data-action="reviewWrongAnswers">
            <div class="row-icon">${ICONS.wrong}</div>
            <div class="row-body">
              <div class="row-title">오답 복습 <span class="row-pill warn">${wrongCount}</span></div>
              <div class="row-sub">틀렸던 문제 다시 풀기</div>
            </div>
            <div class="row-chev">›</div>
          </button>` : ''}
        </div>
      </div>`;

    const renderStudy = () => {
      const examMode = (typeof Storage !== "undefined" && Storage.getExamMode) ? Storage.getExamMode() : "korean";
      // i18n: 언어 설정에 따라 자동 번역 (한국/영어)
      const _t = (k, fb) => (typeof window !== "undefined" && window.I18N) ? window.I18N.t(k, fb) : fb;
      const practiceSub = examMode === "nclex" ? _t("study.nclex.sub", "NCLEX · 과목별 · 모의고사") : _t("study.practice.sub", "과목별 · 모의고사 · 일일");
      return `
      <div class="tab-section">
        <button class="row-card big" data-action="renderPracticeMenu">
          <div class="row-icon big">${ICONS.practice}</div>
          <div class="row-body">
            <div class="row-title">${_t("study.practice", "풀이")}</div>
            <div class="row-sub">${practiceSub}</div>
          </div>
          <div class="row-chev">›</div>
        </button>
        <button class="row-card big" data-action="renderSimMenu">
          <div class="row-icon big">${ICONS.sim}</div>
          <div class="row-body">
            <div class="row-title">${_t("study.simulation", "시뮬레이션")}</div>
            <div class="row-sub">${_t("study.simulation.sub", "에피소드 · 짧은 시나리오 · 듀티")}</div>
          </div>
          <div class="row-chev">›</div>
        </button>
        <button class="row-card big" data-action="renderDrillMenu">
          <div class="row-icon big">${ICONS.drills}</div>
          <div class="row-body">
            <div class="row-title">${_t("study.drills", "훈련")}</div>
            <div class="row-sub">${_t("study.drills.sub", "이미지 · 약물 · 인계 · 트리아지")}</div>
          </div>
          <div class="row-chev">›</div>
        </button>
      </div>`;
    };

    const renderMy = () => {
        const achState = (typeof Storage !== "undefined" && Storage.getAchievements) ? Storage.getAchievements() : { unlocked: [] };
        const gotCount = Array.isArray(achState.unlocked) ? achState.unlocked.length : 0;
        const totalBadges = (typeof BADGES !== "undefined" && Array.isArray(BADGES)) ? BADGES.length : 10;
        return `
      <div class="tab-section">
        <button class="row-card big" data-action="renderDashboard">
          <div class="row-icon big">${ICONS.dash}</div>
          <div class="row-body">
            <div class="row-title">통계</div>
            <div class="row-sub">과목별 정답률 · 약점 · 최고 기록</div>
          </div>
          <div class="row-chev">›</div>
        </button>
        <button class="row-card big" data-action="renderAchievements">
          <div class="row-icon big" aria-hidden="true">🏆</div>
          <div class="row-body">
            <div class="row-title">배지 ${gotCount > 0 ? `<span class="row-pill">${gotCount}/${totalBadges}</span>` : `<span class="row-pill">0/${totalBadges}</span>`}</div>
            <div class="row-sub">${gotCount > 0 ? `획득 ${gotCount}개` : `도전과제 ${totalBadges}종`}</div>
          </div>
          <div class="row-chev">›</div>
        </button>
        <button class="row-card big" data-action="reviewWrongAnswers">
          <div class="row-icon big">${ICONS.wrong}</div>
          <div class="row-body">
            <div class="row-title">오답노트 ${wrongCount > 0 ? `<span class="row-pill warn">${wrongCount}</span>` : ''}</div>
            <div class="row-sub">${wrongCount > 0 ? `복습 대기 ${wrongCount}건` : 'Leitner 5박스 복습'}</div>
          </div>
          <div class="row-chev">›</div>
        </button>
        <button class="row-card big" data-action="renderBookmarks">
          <div class="row-icon big"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9"/></svg></div>
          <div class="row-body">
            <div class="row-title">북마크 ${bookmarkCount > 0 ? `<span class="row-pill">${bookmarkCount}</span>` : ''}</div>
            <div class="row-sub">${bookmarkCount > 0 ? `별표 ${bookmarkCount}건` : '⭐ 로 즐겨찾기'}</div>
          </div>
          <div class="row-chev">›</div>
        </button>
        <button class="row-card big" data-action="openSettings">
          <div class="row-icon big"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></div>
          <div class="row-body">
            <div class="row-title">설정</div>
            <div class="row-sub">테마 · 사운드 · 데이터 백업·초기화</div>
          </div>
          <div class="row-chev">›</div>
        </button>

        <div class="my-footer">
          <button class="text-link" data-action="openSearch">🔍 검색</button>
          <span class="dot-sep" aria-hidden="true">·</span>
          <button class="text-link" data-action="renderInviteScreen">🎁 친구 초대</button>
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
    };

    const tabContent = tab === "study" ? renderStudy() : tab === "my" ? renderMy() : renderHome();

    return `
      <div class="menu-shell">
        <header class="menu-header">
          <h1 class="menu-title-v2">간호사 시뮬레이터</h1>
          <span class="version-badge-v2">v${APP_VERSION || '1.0'}</span>
        </header>

        <main class="menu-body">${tabContent}</main>

        <nav class="tab-bar" role="tablist" aria-label="메인 탐색">
          <button class="tab-btn ${tab === 'home' ? 'active' : ''}" data-action="setMenuTab" data-tab="home" role="tab" aria-selected="${tab === 'home'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12 12 3l9 9"/><path d="M5 10v10h14V10"/></svg>
            <span>홈</span>
          </button>
          <button class="tab-btn ${tab === 'study' ? 'active' : ''}" data-action="setMenuTab" data-tab="study" role="tab" aria-selected="${tab === 'study'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            <span>학습</span>
          </button>
          <button class="tab-btn ${tab === 'my' ? 'active' : ''}" data-action="setMenuTab" data-tab="my" role="tab" aria-selected="${tab === 'my'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>내 기록</span>
          </button>
        </nav>
      </div>`;
}

// =========================================================================
// 게임오버 (Survival → 승급 심사 모달)
// =========================================================================
// =========================================================================
// 부활 (보상형 광고 시청 시 HP 회복) — 게임 오버 시 마지막 기회
// =========================================================================
function renderReviveSlot() {
    const slot = document.getElementById("revive-slot");
    if (!slot) return;
    // 부활 조건:
    //   1) 부활 가능 모드 (survival — 듀티 시뮬레이션의 체력 고갈 시)
    //   2) HP <= 0 으로 죽었을 때 (평판 실추는 부활 대상 아님)
    //   3) 세션당 부활 한도 미초과
    //   4) 보상형 광고 unit ID 가 세팅돼 있음 (없으면 광고 환경 자체 부재)
    const eligible = gameState.mode === "survival"
        && gameState.hp <= 0
        && (gameState.reviveCount || 0) < REVIVE_CONFIG.maxPerSession
        && !!ADS_UNITS.rewarded;
    if (!eligible) { slot.classList.add("hidden"); slot.innerHTML = ""; return; }
    slot.classList.remove("hidden");
    slot.innerHTML = `
      <button class="choice-btn primary revive-btn" data-action="reviveByAd" aria-label="광고 보고 부활하기">
        <span class="revive-icon" aria-hidden="true">💚</span>
        <span class="revive-text">광고 보고 부활하기 (HP ${REVIVE_CONFIG.hpRestore} 회복)</span>
        <span class="revive-sub">남은 기회: ${REVIVE_CONFIG.maxPerSession - (gameState.reviveCount || 0)}회</span>
      </button>`;
}

// =========================================================================
// 힌트 — 보상형 광고 시청 시 오답 1개 제거 (보기 ≥3 인 카드에서 1회만)
// =========================================================================
async function useHint() {
    const ev = gameState._currentEv;
    if (!ev || !Array.isArray(ev._shuffledChoices)) {
        addLog("힌트를 적용할 수 없는 화면입니다.", "log-bad");
        return;
    }
    if (ev._hintUsed) { addLog("이미 힌트를 사용했습니다.", ""); return; }
    if (ev._shuffledChoices.length < 3) {
        addLog("보기가 3개 이상일 때만 힌트를 쓸 수 있습니다.", "");
        return;
    }
    const hintBtn = document.querySelector(".hint-btn");
    if (hintBtn) { hintBtn.disabled = true; hintBtn.classList.add("loading"); }
    // 힌트 광고 — 별도 단위 ID (analytics 분리)
    const adUnit = ADS_UNITS.hint || ADS_UNITS.rewarded;
    if (!adUnit) {
        addLog("광고가 준비되지 않았습니다.", "log-bad");
        if (hintBtn) { hintBtn.disabled = false; hintBtn.classList.remove("loading"); }
        return;
    }
    const ok = await Ads.showRewarded(adUnit);
    if (!ok) {
        if (hintBtn) { hintBtn.disabled = false; hintBtn.classList.remove("loading"); }
        addLog("광고 시청이 완료되지 않았습니다.", "log-bad");
        return;
    }
    // Race guard — 광고 시청 중 다음 문제로 넘어갔으면 적용하지 않음
    if (gameState._currentEv !== ev) {
        addLog("이미 다음 문제로 넘어가 힌트가 적용되지 않았습니다.", "");
        return;
    }
    ev._hintUsed = true;
    // 오답 1개 찾아 비활성 + 시각 마킹
    const wrongIdx = ev._shuffledChoices.findIndex(c => !c.correct);
    if (wrongIdx >= 0) {
        const btn = document.querySelector(`#choice-list .choice-btn[data-idx="${wrongIdx}"]`);
        if (btn) {
            btn.disabled = true;
            btn.classList.add("choice-btn-eliminated");
        }
    }
    if (hintBtn) {
        hintBtn.disabled = true;
        hintBtn.dataset.hintUsed = "1";
        hintBtn.classList.remove("loading");
    }
    try { Storage.incrementHintUsed(); } catch {}
    addLog("💡 힌트 사용 — 오답 1개 제거됨", "log-good");
    track("hint_used");
    checkAndNotifyAchievements();
}

async function reviveByAd() {
    const btn = document.querySelector(".revive-btn");
    if (btn) { btn.disabled = true; btn.classList.add("loading"); }
    const ok = await Ads.showRewarded(ADS_UNITS.rewarded);
    if (!ok) {
        if (btn) { btn.disabled = false; btn.classList.remove("loading"); }
        addLog("광고 시청이 완료되지 않아 부활이 취소되었습니다.", "log-bad");
        return;
    }
    gameState.reviveCount = (gameState.reviveCount || 0) + 1;
    const baseHp = Number.isFinite(gameState.hp) ? Math.max(gameState.hp, 0) : 0;
    gameState.hp = clamp(baseHp + REVIVE_CONFIG.hpRestore, 0, 100);
    // 모달 닫고 게임 재개
    UI.modal.classList.remove("active");
    document.getElementById("revive-slot")?.classList.add("hidden");
    updateStats();
    addLog(`💚 광고 시청으로 부활! HP ${gameState.hp} 회복.`, "log-good");
    if (gameState.mode === "survival") {
        renderSurvivalEvent("random_hub");
    }
}

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
    // 모달의 정적 텍스트는 진입 시점에 채움 (HTML 에는 빈 컨테이너만 두어 FOUC 방지)
    const _secTitle = document.getElementById("modal-section-title");
    if (_secTitle) _secTitle.textContent = "📚 승급 심사 (무한 랜덤 문제풀이)";
    const _leftWrap = document.getElementById("modal-quiz-left-wrap");
    if (_leftWrap) _leftWrap.classList.remove("hidden");
    const _rankWrap = document.getElementById("modal-quiz-rank-wrap");
    if (_rankWrap) _rankWrap.classList.remove("hidden");
    const _scoreWrap = document.getElementById("modal-score-wrap");
    if (_scoreWrap) _scoreWrap.classList.remove("hidden");
    const _rankEl = document.getElementById("rank");
    if (_rankEl) _rankEl.textContent = "신규";
    UI.modal.classList.add("active");
    renderReviveSlot();

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
    if (e.isComposing || e.keyCode === 229) return;
    if (UI.modal.classList.contains("active")) {
        if (e.key === "Escape") { returnToMenu(); e.preventDefault(); }
        return;
    }
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;

    // Esc — 메뉴로 (접근성 — 사용자가 어디서든 안전하게 나감)
    if (e.key === "Escape") {
        const inGame = ["survival", "episode", "scenario", "quiz", "mock", "daily",
            "wrong_review", "handoff", "triage", "image_quiz", "drug_drill",
            "nclex_quiz", "kor_quiz"].includes(gameState.mode);
        if (inGame) { returnToMenu(); e.preventDefault(); }
        return;
    }

    // 1-5 보기 단축키 (5지선다 한국 국시 대응)
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= 5) {
        const btns = document.querySelectorAll("#choice-list .choice-btn, #image-quiz-choices .choice-btn, #drug-drill-choices .choice-btn, #kor-choices .choice-btn");
        const btn = btns[num - 1];
        if (btn && !btn.disabled) { btn.click(); e.preventDefault(); }
        return;
    }

    // 화살표 키 — 메뉴 row-card 네비게이션 (접근성 표준)
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const cards = Array.from(document.querySelectorAll("#game-area .row-card, #game-area .hero-card, #game-area .choice-btn.primary"));
        if (cards.length > 0) {
            const focused = document.activeElement;
            let idx = cards.indexOf(focused);
            if (idx === -1) idx = 0;
            else idx = e.key === "ArrowDown" ? Math.min(idx + 1, cards.length - 1) : Math.max(idx - 1, 0);
            cards[idx].focus();
            e.preventDefault();
        }
        return;
    }

    // Space/Enter — 다음 또는 선택
    if (e.key === " " || e.key === "Enter") {
        const next = document.querySelector("#feedback-zone .choice-btn.primary, #image-quiz-next-btn:not(.hidden), #kor-next-btn:not(.hidden), #drug-drill-next-btn:not(.hidden)");
        if (next && !next.disabled) { next.click(); e.preventDefault(); }
        return;
    }

    // 단축키
    if (e.key.toLowerCase() === "t") toggleTheme();
    else if (e.key.toLowerCase() === "m") toggleSound();
    else if (e.key === "?") {
        // 도움말 토스트
        addLog("⌨️ 단축키: 1-5 선택 / ↑↓ 네비 / Enter 다음 / Esc 메뉴 / T 테마 / M 사운드", "log-good");
    }
}

// =========================================================================
// 부트
// =========================================================================
// 전역 에러 복구 — 예기치 못한 오류로 빈 화면(white screen) 되는 것 방지.
// 사용자 데이터는 localStorage 에 안전하므로 메뉴 복귀만으로 회복 가능.
function installErrorBoundary() {
    if (typeof window === "undefined") return;
    // 로컬 에러 로그 — 사용자가 오류 신고 시 첨부 가능
    const logError = (msg, source) => {
        try {
            const KEY = "nurseSim:errLog";
            let log = [];
            try { log = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch {}
            log.unshift({
                msg: String(msg).slice(0, 300),
                source: String(source || "").slice(0, 50),
                at: Date.now(),
                ua: (navigator.userAgent || "").slice(0, 100),
                url: (location.pathname || "") + (location.search || ""),
            });
            log = log.slice(0, 20); // 최근 20건만
            localStorage.setItem(KEY, JSON.stringify(log));
        } catch {}
    };
    const handler = (msg, source) => {
        logError(msg, source);
        try {
            const area = document.getElementById("game-area");
            if (!area) return;
            area.innerHTML = `
              <div class="scene-card card">
                <h2 class="scene-title">일시적 오류가 발생했어요</h2>
                <p class="scene-desc">화면을 복구했습니다. 학습 기록은 안전하게 저장되어 있어요.\n계속하려면 아래 버튼을 누르세요.</p>
                <div class="choice-list">
                  <button class="choice-btn primary" data-action="returnToMenu">메인 메뉴로</button>
                  <button class="choice-btn" data-action="openErrorReport">오류 신고 (자동 첨부)</button>
                </div>
              </div>`;
            track("error_recovered", { msg: String(msg).slice(0, 60), source: String(source || "").slice(0, 30) });
        } catch { /* 복구 실패 시에도 앱 크래시 방지 */ }
    };
    window.addEventListener("error", (e) => handler(e.message || "error", "window"));
    window.addEventListener("unhandledrejection", (e) => handler((e.reason && e.reason.message) || "promise", "promise"));
}

function boot() {
    cacheUI();
    installErrorBoundary();
    initAnalytics();
    track("app_open");
    const settings = Storage.getSettings();
    applyTheme(settings.theme || "auto");
    Sound.enabled = settings.sound !== false;
    Haptics.enabled = settings.haptics !== false;
    TTS.enabled = settings.tts === true;
    // i18n 초기화 — 저장된 lang 또는 브라우저 기본
    try {
        if (typeof window !== "undefined" && window.I18N) {
            const lang = settings.lang || window.I18N.detectLang();
            window.I18N.setLang(lang);
            document.documentElement.lang = lang;
        }
    } catch {}
    if (settings.ttsVoice) TTS.selectedVoiceName = settings.ttsVoice;
    if (Number.isFinite(settings.ttsRate)) TTS.rate = settings.ttsRate;
    if (Number.isFinite(settings.ttsPitch)) TTS.pitch = settings.ttsPitch;
    try { if (TTS.available && window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => { TTS.voice = TTS.pickVoice(); };
    } } catch {}
    // 학습 시간대 마킹 (배지 — 올빼미/아침형)
    try { Storage.markStudyTime(); } catch {}
    if (UI.soundToggle) UI.soundToggle.textContent = Sound.enabled ? "🔊" : "🔇";
    const stored = Storage.load();
    gameState.bestCombo = stored.bestCombo || 0;
    if (UI.themeToggle) UI.themeToggle.addEventListener("click", toggleTheme);
    if (UI.soundToggle) UI.soundToggle.addEventListener("click", toggleSound);
    document.addEventListener("keydown", handleKeydown);
    document.body.addEventListener("click", handleDelegatedAction);
    // 케밥 메뉴 외부 클릭 시 닫기
    document.addEventListener("click", (e) => {
        const menu = document.getElementById("kebab-menu");
        const btn = document.getElementById("kebab-btn");
        if (!menu || menu.classList.contains("hidden")) return;
        if (!menu.contains(e.target) && (!btn || !btn.contains(e.target))) closeKebab();
    });
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
    // 백그라운드 진입 시 사운드 / 타이머 정리 — 모바일 발열·배터리 보호
    try {
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                // 오디오 컨텍스트 suspend (재진입 시 자동 resume)
                try { if (Sound.ctx && Sound.ctx.state === "running") Sound.ctx.suspend(); } catch {}
                // 타자기 효과 중단 (다음 진입 시 자연스럽게 재개됨)
                try { if (_typewriterTimer) { clearInterval(_typewriterTimer); _typewriterTimer = null; } } catch {}
                // CSS 무한 애니메이션 일괄 정지
                document.body.classList.add("app-hidden");
            } else {
                try { if (Sound.ctx && Sound.ctx.state === "suspended") Sound.ctx.resume(); } catch {}
                document.body.classList.remove("app-hidden");
            }
        });
    } catch {}
    // 서비스 워커 등록 (PWA — Electron file:// 에서는 자동으로 무시됨)
    try {
        if (navigator.serviceWorker && location.protocol !== "file:") {
            navigator.serviceWorker.register("./sw.js").catch(() => {});
            // 새 버전 배포 시 토스트 (배포 성숙도)
            navigator.serviceWorker.addEventListener("message", (e) => {
                if (e.data && e.data.type === "NEW_VERSION") {
                    try { showUpdateToast(); } catch {}
                }
            });
        }
    } catch {}
    // PWA 설치 프롬프트 — 5번 이상 방문 + 1회 한정 토스트
    try {
        window.addEventListener("beforeinstallprompt", (e) => {
            e.preventDefault();
            window.__pwaInstallPrompt = e;
            track("pwa_install_prompt_available");
            // 방문 횟수 추적
            try {
                const KEY = "nurseSim:visitCount";
                const cnt = (parseInt(localStorage.getItem(KEY) || "0", 10) || 0) + 1;
                localStorage.setItem(KEY, String(cnt));
                const SHOWN_KEY = "nurseSim:installToastShown";
                if (cnt >= 5 && !localStorage.getItem(SHOWN_KEY)) {
                    localStorage.setItem(SHOWN_KEY, "1");
                    setTimeout(() => { try { showInstallToast(); } catch {} }, 3000);
                }
            } catch {}
        });
        window.addEventListener("appinstalled", () => track("pwa_installed"));
    } catch {}
    // 첫 실행 → 약관 동의 → 온보딩 → 메뉴 → (단축키 URL 처리)
    const removeLoader = () => {
        requestAnimationFrame(() => {
            const loader = document.getElementById("app-loader");
            if (loader) {
                loader.classList.add("fade-out");
                setTimeout(() => { try { loader.remove(); } catch {} }, 350);
            }
        });
    };
    const afterReady = () => {
        handleShortcutUrl();
        const disclaimer = document.getElementById("app-disclaimer");
        if (disclaimer && Storage.isAccepted(LEGAL_VERSION)) disclaimer.classList.remove("hidden");
        removeLoader();
    };
    if (!Storage.isAccepted(LEGAL_VERSION)) {
        renderLegalGate(() => {
            if (!Storage.isOnboarded()) renderOnboarding(0);
            else { returnToMenu(); afterReady(); }
        });
        removeLoader();
    } else if (!Storage.isOnboarded()) {
        renderOnboarding(0);
        removeLoader();
    } else {
        returnToMenu();
        afterReady();
    }
}

// 단축키 URL 처리 — ?shortcut=daily|survival|review 로 진입 시 해당 모드 즉시 시작
// ?ref=ABC123 으로 진입 시 친구 초대 보너스 메커니즘 작동
function handleShortcutUrl() {
    try {
        const params = new URLSearchParams(location.search);

        // 친구 초대 — 양쪽 보너스 (?ref=ABC123)
        const ref = params.get("ref");
        if (ref && /^[A-Z0-9]{6}$/.test(ref)) {
            const data = Storage.load();
            if (!data.referral) data.referral = { myCode: null, invitedBy: null, invitesSent: 0, bonusGranted: false };
            if (!data.referral.invitedBy && !data.referral.bonusGranted) {
                data.referral.invitedBy = ref;
                data.referral.bonusGranted = true;
                Storage.save(data);
                track("referral_received", { code: ref });
                // 보너스: 첫 진입 시 사용자 알림 (boot 완료 후 표시)
                setTimeout(() => addLog("🎁 친구 초대 보너스 — 일일 챌린지 첫 정답 시 추가 +10 평판", "log-good"), 1500);
            }
        }

        const sc = params.get("shortcut");
        if (sc) {
            track("shortcut_open", { shortcut: sc });
            if (sc === "daily" && typeof startDailyChallenge === "function") startDailyChallenge();
            else if (sc === "survival" && typeof initSurvival === "function") initSurvival();
            else if (sc === "review" && typeof reviewWrongAnswers === "function") reviewWrongAnswers();
        }

        // URL 정리 (ref/shortcut 모두 처리 후 1회만)
        if (ref || sc) {
            try { history.replaceState(null, "", location.pathname); } catch {}
        }
    } catch {}
}

// 커스텀 PWA 설치 프롬프트 트리거 (메뉴에서 호출)
function promptPwaInstall() {
    const ev = window.__pwaInstallPrompt;
    if (!ev) {
        addLog("이미 설치되었거나 이 브라우저는 설치를 지원하지 않습니다.", "log-good");
        return;
    }
    ev.prompt();
    ev.userChoice.then(c => {
        track("pwa_install_choice", { outcome: c.outcome });
        if (c.outcome === "accepted") addLog("✨ 앱이 홈 화면에 추가됩니다!", "log-good");
        window.__pwaInstallPrompt = null;
    }).catch(() => {});
}

// 법적 문서 열기 — 새 탭 시도 후 실패 시 인앱 화면으로 폴백 (state 손실 방지)
// popup blocker / Capacitor WebView 에서 location.href 로 문서를 덮으면 게임 state 소실되므로
// 인앱 렌더(renderPrivacy / showLegal)를 우선 폴백으로 사용.
function openExternalLegal(type) {
    const PAGES = { privacy: "privacy.html", terms: "terms.html" };
    const page = PAGES[type];
    if (!page) return;

    // 인앱 폴백 — state 보존
    const inAppFallback = () => {
        try {
            if (type === "privacy" && typeof renderPrivacy === "function") { renderPrivacy(); return true; }
            if (type === "terms") { renderLegalGate(() => returnToMenu()); return true; }
        } catch {}
        return false;
    };

    try {
        const isNative = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
        if (isNative) {
            // Capacitor: 외부 문서로 이동하면 state 소실 → 인앱 렌더 우선
            if (!inAppFallback()) location.href = page;
        } else {
            const w = window.open(page, "_blank", "noopener,noreferrer");
            // popup blocker 차단 시: location.href 로 덮지 않고 인앱 렌더 (state 보존)
            if (!w && !inAppFallback()) location.href = page;
        }
        track("legal_open", { type });
    } catch {
        if (!inAppFallback()) location.href = page;
    }
}

// =========================================================================
// 광고 (Capacitor AdMob 통합 어댑터) — 부활(rewarded) 전용
// 웹/PWA 에서는 자동 no-op. Capacitor 안드로이드 빌드에서 자동 활성화.
// =========================================================================
const Ads = {
    get plugin() {
        try {
            return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob) || null;
        } catch { return null; }
    },
    initialized: false,
    async init() {
        const p = Ads.plugin;
        if (!p || Ads.initialized) return;
        try {
            await p.initialize({
                initializeForTesting: !!window.NURSESIM_ADS_TESTING,
                requestTrackingAuthorization: false,
            });
            Ads.initialized = true;
            track("ads_init_ok");
        } catch (e) {
            track("ads_init_fail");
            // 광고 SDK 부재/에러는 조용히 무시 (앱 정상 동작 유지)
        }
    },
    // 보상형 광고 — 시청 완료 시 true resolve, 미시청·미지원·실패 시 false.
    // 게임 오버 → 광고 시청 → HP 회복 부활 시나리오에만 사용.
    async showRewarded(adUnitId) {
        if (!adUnitId) return false;
        const p = Ads.plugin;
        if (!p) return false;
        try {
            await Ads.init();
            await p.prepareRewardVideoAd({ adId: adUnitId });
            const result = await p.showRewardVideoAd();
            const rewarded = !!(result && (result.amount || result.type || result.rewarded));
            track(rewarded ? "rewarded_ad_completed" : "rewarded_ad_skipped");
            return rewarded;
        } catch (e) {
            track("rewarded_ad_error");
            return false;
        }
    },
};
// AdMob unit IDs — 보상형 광고 2종 (부활 + 힌트). 전면/배너 없음.
// App ID: ca-app-pub-3894575898077880~9738094108 (capacitor.config.json + AndroidManifest.xml)
// 정책: 사용자가 명시적으로 "광고 보고 부활" / "광고 보고 힌트" 선택 시에만 표시
// (Incentivized reward, AdMob 정책 준수)
const ADS_UNITS = {
    // 부활 (HP 60 회복) — 게임 오버 모달에서 사용자 선택 시
    rewarded: "ca-app-pub-3894575898077880/6895318664",
    // 힌트 (오답 1개 제거) — 시나리오 카드에서 사용자 선택 시
    hint: "ca-app-pub-3894575898077880/5934580467",
};

// 부활(revive) 설정 — 게임 오버 시 보상형 광고로 HP 회복
const REVIVE_CONFIG = {
    hpRestore: 60,        // 부활 시 회복할 HP (0~100)
    maxPerSession: 1,     // 한 세션(모드 1회)당 최대 부활 횟수 — 무한 부활 방지
};

// =========================================================================
// 위클리 리포트 (일요일 오후 홈 탭 상단)
// =========================================================================
function computeWeeklyReport(now, data) {
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const cutoff = now - SEVEN_DAYS;
    const history = Array.isArray(data?.history) ? data.history : [];
    const recent = history.filter(h => h && Number.isFinite(h.at) && h.at >= cutoff);
    let totalSolved = 0, totalCorrect = 0;
    const days = new Set();
    recent.forEach(h => {
        if (Number.isFinite(h.total)) totalSolved += h.total;
        if (Number.isFinite(h.correct)) totalCorrect += h.correct;
        if (h.at) {
            const d = new Date(h.at);
            days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
        }
    });
    // 일일 챌린지도 포함
    const daily = data?.daily || {};
    Object.entries(daily).forEach(([key, v]) => {
        if (!v) return;
        const ts = v.ts || 0;
        if (ts >= cutoff) {
            if (Number.isFinite(v.solved)) totalSolved += v.solved;
            if (Number.isFinite(v.correct)) totalCorrect += v.correct;
            days.add(key);
        }
    });
    const accuracy = totalSolved > 0 ? Math.round((totalCorrect / totalSolved) * 100) : 0;
    const d = new Date(now);
    return {
        totalSolved, totalCorrect, accuracy,
        daysActive: days.size,
        modesPlayed: recent.length,
        isSundayAfternoon: d.getDay() === 0 && d.getHours() >= 12,
    };
}

function renderWeeklyReport() {
    resetStateForMode();
    gameState.mode = "weekly";
    showCoreUI(); updateStats();
    const data = Storage.load();
    const w = computeWeeklyReport(Date.now(), data);
    // 모드별 분포
    const modeCount = {};
    (data.history || []).filter(h => h && (Date.now() - h.at) <= 7 * 24 * 60 * 60 * 1000).forEach(h => {
        modeCount[h.mode] = (modeCount[h.mode] || 0) + 1;
    });
    const modeLines = Object.entries(modeCount).map(([m, n]) => `<li><strong>${escapeHtml(m)}</strong> · ${n}회</li>`).join("");
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">🗓 위클리 리포트</h2>
        <p class="scene-desc">최근 7일 학습 요약</p>
        <div class="dashboard-row" role="group" aria-label="주간 통계">
          <div class="dash-stat"><div class="ds-num">${w.totalSolved}</div><div class="ds-label">총 풀이</div></div>
          <div class="dash-stat"><div class="ds-num">${w.accuracy}%</div><div class="ds-label">정답률</div></div>
          <div class="dash-stat"><div class="ds-num">${w.daysActive}</div><div class="ds-label">학습 일수</div></div>
          <div class="dash-stat"><div class="ds-num">${w.modesPlayed}</div><div class="ds-label">모드 완료</div></div>
        </div>
        ${modeLines ? `<h3 class="modal-section-title">모드별</h3><ul class="weekly-mode-list">${modeLines}</ul>` : ''}
        <div class="choice-list">
          <button class="choice-btn primary" data-action="shareResultCard" data-mode="weekly" data-title="이번 주 ${w.totalSolved}문제 풀이" data-lines="정답률 ${w.accuracy}%|학습 일수 ${w.daysActive}일|모드 완료 ${w.modesPlayed}회">결과 카드 다운로드</button>
          <button class="choice-btn" data-action="returnToMenu">메인 메뉴</button>
        </div>
      </div>`;
}

// =========================================================================
// 북마크 (즐겨찾기)
// =========================================================================
function toggleSceneBookmark(target) {
    const bmId = target.dataset.bmId;
    if (!bmId) return;
    const ev = gameState._currentEv;
    const nowOn = Storage.toggleBookmark(bmId, ev);
    target.classList.toggle("on", nowOn);
    target.setAttribute("aria-pressed", String(nowOn));
    target.setAttribute("aria-label", nowOn ? "북마크 해제" : "북마크 추가");
    const svg = target.querySelector("svg");
    if (svg) svg.setAttribute("fill", nowOn ? "currentColor" : "none");
}

function renderBookmarks() {
    resetStateForMode();
    gameState.mode = "bookmarks";
    showCoreUI(); updateStats();
    const bm = Storage.getBookmarks();
    const ids = Object.keys(bm).sort((a, b) => (bm[b].ts || 0) - (bm[a].ts || 0));
    if (ids.length === 0) {
        UI.gameArea.innerHTML = renderEmptyState({
            illust: "bookmarkEmpty",
            title: "북마크가 비었습니다",
            desc: "문제 카드 우측 상단 ⭐ 버튼으로 즐겨찾기 추가할 수 있어요.",
            primaryAction: "returnToMenu", primaryLabel: "메인 메뉴",
        });
        return;
    }
    const items = ids.map(id => {
        const e = bm[id];
        const cat = escapeHtml(e.category || "");
        const title = escapeHtml(e.title || "(저장된 카드)");
        return `
          <div class="bookmark-item">
            <button class="bookmark-open" data-action="openBookmark" data-bm-id="${escapeHtml(id)}">
              <div class="bm-cat">${cat}</div>
              <div class="bm-title">${title}</div>
            </button>
            <button class="bookmark-remove icon-btn" data-action="removeBookmark" data-bm-id="${escapeHtml(id)}" aria-label="북마크 해제">✕</button>
          </div>`;
    }).join("");
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">북마크 (${ids.length})</h2>
        <div class="bookmark-list" role="list">${items}</div>
        <div class="choice-list">
          <button class="choice-btn" data-action="returnToMenu">메인 메뉴</button>
        </div>
      </div>`;
}
// 새로 획득한 배지를 사용자에게 알림 — addLog + 정답 사운드
function checkAndNotifyAchievements() {
    let newly;
    try { newly = Storage.checkAchievements(); } catch { newly = []; }
    if (!Array.isArray(newly) || newly.length === 0) return;
    newly.forEach(id => {
        const b = BADGES.find(x => x.id === id);
        if (!b) return;
        try { addLog(`🏆 배지 획득: ${b.emoji} ${b.name}`, "log-good"); } catch {}
        try { showBadgeUnlockBanner(b); } catch {}
    });
    if (newly.length > 0) {
        try { Sound.correct(); } catch {}
        try { Haptics.heavy(); } catch {}
        track("achievement_unlocked", { count: String(newly.length) });
    }
}

// 배지 잠금해제 축하 배너 — 2.5s 자동 사라짐
function showBadgeUnlockBanner(badge) {
    if (!badge) return;
    const existing = document.querySelector(".badge-unlock-banner");
    if (existing) existing.remove();
    const el = document.createElement("div");
    el.className = "badge-unlock-banner";
    el.setAttribute("role", "alert");
    el.innerHTML = `
        <div class="badge-unlock-emoji">${badge.emoji || "🏆"}</div>
        <div class="badge-unlock-title">배지 획득</div>
        <div class="badge-unlock-name">${escapeHtml(badge.name || "")}</div>
    `;
    document.body.appendChild(el);
    // 셀레브레이션 confetti — 모션 감소 선호 시 생략
    try {
        if (!window.matchMedia || !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            launchConfetti();
        }
    } catch {}
    setTimeout(() => { try { el.remove(); } catch {} }, 3200);
}

/** Confetti 셀레브레이션 — 배지 획득·완벽 세트 시
 * 외부 라이브러리 없음, CSS + DOM 직접
 */
function launchConfetti() {
    if (document.getElementById("confetti-layer")) return;
    const layer = document.createElement("div");
    layer.id = "confetti-layer";
    layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:99997;overflow:hidden;";
    const colors = ["#7fa881", "#aacaa9", "#c9a25b", "#d99494", "#9aa5b8", "#7fa881"];
    const count = 60;
    for (let i = 0; i < count; i++) {
        const piece = document.createElement("div");
        const size = 6 + Math.random() * 8;
        const left = Math.random() * 100;
        const delay = Math.random() * 0.4;
        const duration = 1.5 + Math.random() * 1.2;
        const rotation = Math.random() * 720;
        const color = colors[Math.floor(Math.random() * colors.length)];
        piece.style.cssText = `position:absolute;top:-20px;left:${left}%;width:${size}px;height:${size}px;background:${color};border-radius:${Math.random() > 0.5 ? "50%" : "2px"};opacity:0.9;animation:confettiFall ${duration}s cubic-bezier(.22,.61,.36,1) ${delay}s forwards;transform:rotate(${rotation}deg);`;
        layer.appendChild(piece);
    }
    document.body.appendChild(layer);
    setTimeout(() => { try { layer.remove(); } catch {} }, 3500);
}

function renderAchievements() {
    resetStateForMode();
    gameState.mode = "achievements";
    showCoreUI(); updateStats();
    // 진입 시 한 번 더 스캔 — 다른 화면에서 누락된 항목 보정
    try { Storage.checkAchievements(); } catch {}
    const ach = Storage.getAchievements();
    const unlocked = new Map((ach.unlocked || []).map(u => [u.id, u.at || 0]));
    const total = BADGES.length;
    const got = BADGES.filter(b => unlocked.has(b.id)).length;

    const cards = BADGES.map(b => {
        const isUnlocked = unlocked.has(b.id);
        const at = unlocked.get(b.id) || 0;
        const dateStr = at > 0 ? new Date(at).toLocaleDateString("ko-KR") : "";
        const cls = isUnlocked ? "badge-card unlocked" : "badge-card locked";
        const status = isUnlocked
            ? `<div class="badge-status">획득 · ${escapeHtml(dateStr)}</div>`
            : `<div class="badge-status">잠김</div>`;
        return `
          <div class="${cls}">
            <div class="badge-emoji" aria-hidden="true">${b.emoji}</div>
            <div class="badge-name">${escapeHtml(b.name)}</div>
            <div class="badge-desc">${escapeHtml(b.desc)}</div>
            ${status}
          </div>`;
    }).join("");

    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <h2 class="scene-title">배지</h2>
        <p class="scene-desc">획득 ${got} / ${total}</p>
        <div class="badge-grid">${cards}</div>
        <div class="choice-list">
          <button class="choice-btn" data-action="returnToMenu">메인 메뉴</button>
        </div>
      </div>`;
}

function openBookmark(target) {
    const bmId = target.dataset.bmId;
    const bm = Storage.getBookmarks();
    const e = bm[bmId];
    if (!e || !e.choices) {
        renderBookmarks();
        return;
    }
    resetStateForMode();
    gameState.mode = "bookmark_review";
    gameState._activeBookmarkId = bmId;
    showCoreUI(); updateStats();
    const ev = {
        baseId: e.baseId || "bookmark",
        category: e.category, part: e.part,
        emoji: "⭐", title: e.title, desc: e.desc,
        choices: e.choices.map(c => ({ text: c.text, correct: !!c.correct, log: c.log })),
    };
    renderSceneCard(ev, { mode: "quiz", meta: ["북마크", e.category || ""].filter(Boolean) });
}

// =========================================================================
// 공유 (결과 카드 Canvas 렌더 → blob 다운로드)
// =========================================================================
function shareResultCard(target) {
    const mode = target.dataset.mode || gameState.mode || "result";
    const title = target.dataset.title || "간호사 시뮬레이터 결과";
    const lines = (target.dataset.lines || "").split("|").filter(Boolean);
    // 친구 초대 코드 — 결과 카드 + 공유 텍스트에 자동 동봉
    let myCode = null;
    try { myCode = Storage.getOrCreateReferralCode(); } catch {}
    try {
        const canvas = document.createElement("canvas");
        const W = 720, H = 1024;
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas unsupported");
        // 배경 — 세이지 톤
        ctx.fillStyle = "#eef2f5"; ctx.fillRect(0, 0, W, H);
        // 카드
        const cx = 48, cy = 96, cw = W - 96, ch = H - 192;
        ctx.fillStyle = "#ffffff";
        roundRect(ctx, cx, cy, cw, ch, 28); ctx.fill();
        // 헤더
        ctx.fillStyle = "#7fa881";
        ctx.font = "600 28px 'Pretendard', system-ui, sans-serif";
        ctx.fillText("간호사 시뮬레이터", cx + 36, cy + 60);
        // 제목
        ctx.fillStyle = "#1e293b";
        ctx.font = "700 44px 'Pretendard', system-ui, sans-serif";
        wrapText(ctx, String(title), cx + 36, cy + 140, cw - 72, 56);
        // 본문
        ctx.fillStyle = "#1e293b";
        ctx.font = "500 24px 'Pretendard', system-ui, sans-serif";
        let yy = cy + 260;
        for (const ln of lines) { wrapText(ctx, ln, cx + 36, yy, cw - 72, 36); yy += 60; }
        // 푸터 + 워터마크/브랜딩
        ctx.fillStyle = "#64748b";
        ctx.font = "500 18px 'Pretendard', system-ui, sans-serif";
        ctx.fillText("교육 목적 · 임상 적용 금지", cx + 36, cy + ch - 56);
        ctx.font = "500 16px 'Pretendard', system-ui, sans-serif";
        ctx.fillStyle = "#94a3b8";
        const watermark = myCode
            ? `간호사 시뮬레이터 · nursing-sim.app · 초대코드 ${myCode}`
            : "간호사 시뮬레이터 · nursing-sim.app";
        ctx.fillText(watermark, cx + 36, cy + ch - 28);
        // 다운로드
        canvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `nurse-sim-${mode}-${Date.now()}.png`;
            document.body.appendChild(a); a.click();
            setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
            addLog("결과 카드를 다운로드했어요.", "log-good");
        }, "image/png");

        // 공유 텍스트도 클립보드에 (브라우저 권한 가능 시) — 친구 초대 보너스 안내
        if (myCode) {
            try {
                const shareUrl = `${location.origin}${location.pathname}?ref=${myCode}`;
                const shareText = `간호사 시뮬레이터 — ${title}\n내 초대코드 ${myCode} 로 가입하면 양쪽 +10 평판 보너스!\n${shareUrl}`;
                if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
                    navigator.clipboard.writeText(shareText).catch(() => {});
                }
            } catch {}
        }
    } catch (err) {
        addLog("브라우저가 캔버스 공유를 지원하지 않아요.", "log-bad");
    }
}
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}
function wrapText(ctx, text, x, y, maxW, lineH) {
    const words = String(text).split(/(\s+)/);
    let line = "", yy = y;
    for (const w of words) {
        const test = line + w;
        if (ctx.measureText(test).width > maxW && line) {
            ctx.fillText(line, x, yy); line = w.trim(); yy += lineH;
        } else { line = test; }
    }
    if (line) ctx.fillText(line, x, yy);
}

// =========================================================================
// 친구 초대 (referral) — 양쪽 보너스 + 코드 공유
// =========================================================================
function inviteFriend() {
    let code = null;
    try { code = Storage.getOrCreateReferralCode(); } catch {}
    if (!code) { addLog("초대 코드 생성에 실패했어요.", "log-bad"); return; }
    const url = `${location.origin}${location.pathname}?ref=${code}`;
    const title = "간호사 시뮬레이터";
    const text = `간호사 시뮬레이터 — 한국 간호 국시 RPG. 내 코드로 가입하면 양쪽 보너스! ${code}\n${url}`;
    track("invite_sent");
    try { Storage.incrementInvitesSent(); } catch {}

    // Web Share API 우선 — 모바일에서 카톡/문자/이메일로 바로 전달
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        navigator.share({ title, text, url }).then(() => {
            addLog("✅ 초대를 공유했어요.", "log-good");
            try { renderInviteScreen(); } catch {}
        }).catch(() => {
            // 사용자 취소 또는 실패 → 클립보드 폴백
            shareInviteClipboardFallback(text);
        });
        return;
    }
    shareInviteClipboardFallback(text);
}
function shareInviteClipboardFallback(text) {
    try {
        if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
            navigator.clipboard.writeText(text).then(() => {
                addLog("📋 초대 링크 복사됨 — 친구에게 붙여넣기 해주세요.", "log-good");
                try { renderInviteScreen(); } catch {}
            }).catch(() => addLog("클립보드 접근이 거부되었어요.", "log-bad"));
        } else {
            addLog("📋 초대 텍스트: " + text, "log-important");
        }
    } catch {
        addLog("공유 기능을 사용할 수 없어요.", "log-bad");
    }
}
function renderInviteScreen() {
    const code = Storage.getOrCreateReferralCode();
    const ref = Storage.getReferral();
    const invitesSent = Number.isFinite(ref.invitesSent) ? ref.invitesSent : 0;
    const invitedBy = (typeof ref.invitedBy === "string" && /^[A-Z0-9]{6}$/.test(ref.invitedBy)) ? ref.invitedBy : null;
    showCoreUI(); UI.logBar.innerHTML = "";
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        
        <h2 class="scene-title">친구 초대</h2>
        <p class="scene-desc">친구가 내 코드로 가입하면 양쪽 모두에게 +10 평판 보너스! 코드를 공유해보세요.</p>

        <div class="invite-code-display">
          <div class="invite-code-label">내 초대 코드</div>
          <div class="invite-code">${escapeHtml(code)}</div>
        </div>

        <div class="dashboard-row" role="group" aria-label="초대 현황">
          <div class="dash-stat"><div class="ds-num">${invitesSent}</div><div class="ds-label">초대 발송</div></div>
          <div class="dash-stat"><div class="ds-num">${invitedBy ? "✅" : "—"}</div><div class="ds-label">${invitedBy ? "초대받음" : "직접 가입"}</div></div>
          <div class="dash-stat"><div class="ds-num">+10</div><div class="ds-label">양쪽 보너스</div></div>
        </div>

        <ul class="empty-list" style="margin-top:12px">
          <li>친구가 가입하면 양쪽에 <strong>+10 평판</strong> 보너스</li>
          <li>친구의 첫 일일 챌린지 정답 시 자동 지급</li>
          <li>제한 없음 — 더 많이 초대할수록 좋아요</li>
        </ul>

        <div class="choice-list">
          <button class="choice-btn primary" data-action="inviteFriend">🔗 초대 링크 공유하기</button>
          <button class="choice-btn" data-action="returnToMenu">메인 메뉴</button>
        </div>
      </div>`;
}

// =========================================================================
// 약점 분석 — 자주 시작하지만 오답이 잦은 시나리오/카테고리 발견
// =========================================================================
function renderWeaknessAnalysis() {
    const funnel = Storage.getFunnel();
    const starts = funnel.sceneStarts || {};
    const wrongs = funnel.sceneWrongs || {};
    const keys = Object.keys(starts);

    showCoreUI(); UI.logBar.innerHTML = "";

    // 데이터 부족 시
    const startedEnough = keys.filter(k => (starts[k]?.count || 0) >= 3);
    if (startedEnough.length === 0) {
        UI.gameArea.innerHTML = renderEmptyState({
            illust: "dataEmpty",
            title: "약점 분석 데이터 부족",
            desc: "시나리오를 3회 이상 진행하면 자주 틀리는 패턴을 분석해드려요.",
            primaryAction: "initSurvival", primaryLabel: "듀티 시작",
            secondaryAction: "returnToMenu", secondaryLabel: "메뉴",
        });
        return;
    }

    // 각 시나리오별 정답률 계산 — starts >= 3 만
    const rows = startedEnough.map(k => {
        const s = starts[k];
        const w = wrongs[k] || { count: 0, category: s.category || null };
        const startCount = s.count || 0;
        const wrongCount = Math.min(w.count || 0, startCount);
        const rate = startCount > 0 ? Math.round(((startCount - wrongCount) / startCount) * 100) : 0;
        return { id: k, title: k, category: s.category || w.category || "기타", starts: startCount, wrongs: wrongCount, rate };
    });
    // 정답률 낮은 순 (가장 약한 시나리오)
    rows.sort((a, b) => a.rate - b.rate || b.starts - a.starts);
    const top5 = rows.slice(0, 5);

    // 카테고리별 집계 (가중치: 오답 count)
    const catAgg = {};
    rows.forEach(r => {
        const c = r.category || "기타";
        if (!catAgg[c]) catAgg[c] = { starts: 0, wrongs: 0 };
        catAgg[c].starts += r.starts;
        catAgg[c].wrongs += r.wrongs;
    });
    const catList = Object.keys(catAgg).map(c => {
        const a = catAgg[c];
        const rate = a.starts > 0 ? Math.round(((a.starts - a.wrongs) / a.starts) * 100) : 0;
        return { category: c, starts: a.starts, wrongs: a.wrongs, rate };
    }).filter(c => c.starts >= 3).sort((a, b) => a.rate - b.rate).slice(0, 3);

    const knownCats = new Set(CATEGORIES);

    const top5Html = top5.length > 0 ? top5.map(r => `
      <div class="weakness-row">
        <div class="wk-title">❌ ${escapeHtml(r.title)}</div>
        <div class="wk-stat">정답률 ${r.rate}% (오답 ${r.wrongs}/${r.starts}) · ${escapeHtml(r.category)}</div>
      </div>`).join("") : `<p class="scene-desc">아직 표시할 약점이 없어요.</p>`;

    const catHtml = catList.length > 0 ? `
      <h3 class="episode-group-label">📂 카테고리별 약점</h3>
      ${catList.map(c => {
          const isCat = knownCats.has(c.category);
          return `
        <div class="weakness-row">
          <div class="wk-title">${escapeHtml(c.category)}</div>
          <div class="wk-stat">정답률 ${c.rate}% (오답 ${c.wrongs}/${c.starts})</div>
          ${isCat ? `<button class="choice-btn" data-action="startQuiz" data-arg="${escapeHtml(c.category)}" style="margin-top:8px">이 카테고리 집중 복습 →</button>` : ""}
        </div>`;
      }).join("")}` : "";

    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        
        <h2 class="scene-title">약점 분석</h2>
        <p class="scene-desc">자주 진행하지만 정답률이 낮은 시나리오를 모아봤어요. 집중 복습으로 점수를 끌어올리세요.</p>

        <h3 class="episode-group-label">⚠️ 약점 시나리오 Top ${top5.length}</h3>
        ${top5Html}
        ${catHtml}

        <div class="choice-list">
          <button class="choice-btn" data-action="returnToMenu">메인 메뉴</button>
        </div>
      </div>`;
}

// 인라인 onclick 핸들러를 모두 data-action 위임으로 대체 → CSP `script-src 'self'`만 허용 가능
const DELEGATED_ACTIONS = {
    returnToMenu: () => returnToMenu(),
    initSurvival: () => initSurvival(),
    renderQuizMenu: () => renderQuizMenu(),
    renderImageQuizMenu: () => renderImageQuizMenu(),
    renderKorMenu: () => renderKorMenu(),
    startKorQuiz: (t) => startKorQuiz(t),
    korQuizAnswer: (t) => korQuizAnswer(t),
    korQuizNext: () => korQuizNext(),
    renderPracticeMenu: () => renderPracticeMenu(),
    renderSubjectStudyMenu: () => renderSubjectStudyMenu(),
    renderSimMenu: () => renderSimMenu(),
    renderCaseMenu: () => renderCaseMenu(),
    renderDrillMenu: () => renderDrillMenu(),
    pickShift: (t) => pickShift(t),
    renderShiftPicker: () => renderShiftPicker(),
    toggleKebab: () => toggleKebab(),
    toggleTheme: () => { toggleTheme(); closeKebab(); },
    toggleLang: () => { toggleLang(); closeKebab(); },
    toggleSound: () => { toggleSound(); closeKebab(); _syncKebabSoundLabel(); },
    toggleHaptics: () => toggleHaptics(),
    toggleTts: () => TTS.toggle(),
    ttsSpeak: (t) => ttsSpeak(t),
    renderTtsSettings: () => renderTtsSettings(),
    setTtsVoice: (t) => setTtsVoice(t),
    ttsPreview: () => ttsPreview(),
    renderPremiumPage: () => renderPremiumPage(),
    notifyPremium: () => notifyPremium(),
    donate: (t) => donate(t),
    renderDataControl: () => renderDataControl(),
    exportErrLog: () => exportErrLog(),
    confirmClearErrLog: () => confirmClearErrLog(),
    renderLeaderboard: () => renderLeaderboard(),
    renderDrugDrill: () => renderDrugDrill(),
    startDrugDrill: () => startDrugDrill(),
    drugDrillAnswer: (t) => drugDrillAnswer(t),
    drugDrillNext: () => drugDrillNext(),
    setTheme: (t) => { const mode = t.dataset.theme; applyTheme(mode); Storage.setSettings({ theme: mode }); },
    startImageQuiz: (t) => startImageQuiz(t),
    imageQuizAnswer: (t) => imageQuizAnswer(t),
    imageQuizNext: () => imageQuizNext(),
    startQuiz: (t) => startQuiz(t.dataset.arg),
    quizContinue: () => quizContinue(),
    startMockExam: () => startMockExam(),
    startDailyChallenge: () => startDailyChallenge(),
    startDailyChallengeForce: () => startDailyChallengeForce(),
    reviewWrongAnswers: () => reviewWrongAnswers(),
    renderDashboard: () => renderDashboard(),
    confirmClearStats: () => confirmClearStats(),
    setShift: (t) => setShift(t.dataset.shift, parseFloat(t.dataset.mult), t),
    setMenuTab: (t) => { gameState.menuTab = t.dataset.tab; returnToMenu(); },
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
    renderCampaign: () => renderCampaign(),
    startCampaignEpisode: () => startCampaignEpisode(),
    campaignContinue: () => campaignContinue(),
    resetCampaignConfirm: () => resetCampaignConfirm(),
    resetCampaignDo: () => resetCampaignDo(),
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
    setExamMode: (t) => setExamMode(t),
    renderNclexMenu: () => renderNclexMenu(),
    renderNclexMenuLazy: () => renderNclexMenuLazy(),
    startNclexQuiz: (t) => startNclexQuiz(t.dataset.arg),
    nclexAnswer: (t) => nclexAnswer(t),
    nclexSataToggle: (t) => nclexSataToggle(t),
    nclexSataSubmit: () => nclexSataSubmit(),
    nclexNext: () => nclexNext(),
    renderAbout: () => renderAbout(),
    openFeedback: () => openFeedback(),
    renderPrivacy: () => renderPrivacy(),
    exportData: () => exportData(),
    triggerImportData: () => triggerImportData(),
    toggleDailyNotify: () => toggleDailyNotify(),
    showPremiumInfo: () => showPremiumInfo(),
    // 약관/개인정보 외부 URL — Capacitor 안드로이드에선 시스템 브라우저로,
    // PWA 에선 새 탭으로. GitHub Pages 호스팅 URL 우선 시도, 실패 시 로컬 파일.
    openExternalPrivacy: () => openExternalLegal("privacy"),
    openExternalTerms: () => openExternalLegal("terms"),
    // 북마크
    toggleSceneBookmark: (t) => toggleSceneBookmark(t),
    renderBookmarks: () => renderBookmarks(),
    openBookmark: (t) => openBookmark(t),
    removeBookmark: (t) => {
        Storage.removeBookmark(t.dataset.bmId);
        renderBookmarks();
    },
    // 공유
    shareResultCard: (t) => shareResultCard(t),
    // 위클리 리포트
    renderWeeklyReport: () => renderWeeklyReport(),
    // 부활 (보상형 광고)
    reviveByAd: () => reviveByAd(),
    // 힌트 (보상형 광고 시청 → 오답 1개 제거)
    useHint: () => useHint(),
    // 배지 컬렉션
    renderAchievements: () => renderAchievements(),
    // 친구 초대 · 약점 분석
    renderInviteScreen: () => renderInviteScreen(),
    inviteFriend: () => inviteFriend(),
    renderWeaknessAnalysis: () => renderWeaknessAnalysis(),
    // 직군 선택 (persona)
    choosePersona: (t) => choosePersona(t.dataset.persona),
    skipPersona: () => { Storage.setPersona("skip", null); track("persona_skipped"); closePersonaPicker(); returnToMenu(); },
    renderPersonaPicker: () => renderPersonaPicker(),
};
function handleDelegatedAction(e) {
    const target = e.target.closest("[data-action]");
    if (!target) return;
    const handler = DELEGATED_ACTIONS[target.dataset.action];
    if (!handler) return;
    try {
        handler(target);
    } catch (err) {
        // 핸들러 에러 격리 — 한 액션 실패가 앱 전체 죽이지 않게
        track("delegated_action_error", { action: target.dataset.action, msg: String(err && err.message || err).slice(0, 60) });
        try { console.error("[action error]", target.dataset.action, err); } catch {}
        try { addLog("작업 처리 중 오류가 발생했어요. 다시 시도해 주세요.", "log-bad"); } catch {}
    }
}

if (typeof window !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
}

// Node 환경 (테스트)에서 일부 헬퍼를 노출
if (typeof module !== "undefined" && module.exports) {
    module.exports = { dailySeed, todayKey, clamp, escapeHtml };
}
