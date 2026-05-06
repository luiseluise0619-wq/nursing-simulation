// =========================
// 상태
// =========================
const MAX_PROGRESS_EVENTS = 20;
const STORAGE_KEY = "nurseSim.v1";

let gameState = {
    mode: "menu",
    hp: 100,
    rep: 0,
    eventCount: 0,
    items: [],
    difficulty: 1.0,
    currentShift: "Day",
    quizCategory: null,
    quizSolved: 0,
    recentIds: [], // 중복 방지를 위한 Base ID 기록 배열
    streak: 0,
    bestStreak: 0,
    bossesCleared: 0,
    lang: "ko", // "ko" | "en"
    lifetime: { totalQuizSolved: 0, bestStreak: 0, bestRep: 0, dutiesCompleted: 0 },
};

// =========================
// i18n 헬퍼
// =========================
function loc(ko, en) { return gameState.lang === "en" ? en : ko; }
function L(obj) { return obj?.[gameState.lang] ?? obj?.ko ?? ""; }

const CATEGORY_KEYS = ["fundamentals", "adult", "maternal", "pediatric", "community", "psych", "management", "law"];
const CATEGORY_NAMES = {
    fundamentals: { ko: "기본간호학", en: "Fundamentals" },
    adult:        { ko: "성인간호학", en: "Adult Health" },
    maternal:     { ko: "모성간호학", en: "Maternity" },
    pediatric:    { ko: "아동간호학", en: "Pediatric" },
    community:    { ko: "지역사회간호학", en: "Community Health" },
    psych:        { ko: "정신간호학", en: "Psychiatric" },
    management:   { ko: "간호관리학", en: "Management" },
    law:          { ko: "보건의약관계법규", en: "Health Laws" },
    flavor:       { ko: "병동 일상", en: "Daily Ward" },
    boss:         { ko: "🚨 위기상황", en: "🚨 Crisis" },
};
function catName(key) { return L(CATEGORY_NAMES[key]); }

// 한글 카테고리명 → key (구버전 generator 호환용 정규화)
const KO_TO_KEY = {
    "기본간호학": "fundamentals", "성인간호학": "adult", "모성간호학": "maternal",
    "아동간호학": "pediatric", "지역사회간호학": "community", "정신간호학": "psych",
    "간호관리학": "management", "보건의약관계법규": "law",
    "병동 일상": "flavor", "🚨 위기상황": "boss",
};
function normalizeEvent(ev) {
    if (!ev) return ev;
    if (!ev.categoryKey) ev.categoryKey = KO_TO_KEY[ev.category] || null;
    if (ev.categoryKey && CATEGORY_NAMES[ev.categoryKey]) {
        ev.category = catName(ev.categoryKey);
    }
    return ev;
}

// UI 문자열 사전
const T = {
    appTitle:       { ko: "간호사 시뮬레이터", en: "Nurse Simulator" },
    subtitle:       { ko: "당신의 임상 판단력을 테스트하세요", en: "Test your clinical judgment" },
    shiftLabel:     { ko: "근무 난이도 선택", en: "Select Shift Difficulty" },
    shiftDay:       { ko: "☀️ Day · 기본", en: "☀️ Day · Easy" },
    shiftEvening:   { ko: "🌆 Evening · 어려움", en: "🌆 Evening · Hard" },
    shiftNight:     { ko: "🌙 Night · 지옥", en: "🌙 Night · Hell" },
    startSurvival:  { ko: "🚑 실전 듀티 시작", en: "🚑 Start Live Shift" },
    openTraining:   { ko: "📚 트레이닝 센터 (문제은행)", en: "📚 Training Center (Question Bank)" },
    backHome:       { ko: "🏠 처음으로 돌아가기", en: "🏠 Back to Home" },
    backMenu:       { ko: "메인 메뉴", en: "Main Menu" },
    nextQuestion:   { ko: "다음 문제", en: "Next Question" },
    changeSubject:  { ko: "과목 변경", en: "Change Subject" },
    progressShift:  { ko: "듀티 진행도", en: "Shift Progress" },
    progressTrain:  { ko: "학습 진행도", en: "Study Progress" },
    progressIdle:   { ko: "진행도", en: "Progress" },
    statShift:      { ko: "근무", en: "Shift" },
    statStateLive:  { ko: "상태: 실전 모드", en: "State: Live Mode" },
    statStateTrain: { ko: "상태: 트레이닝", en: "State: Training" },
    statStateIdle:  { ko: "상태: 대기", en: "State: Idle" },
    solvedBadge:    { ko: "학습 완료", en: "Solved" },
    questionsLabel: { ko: "문제", en: "questions" },
    rankLabel:      { ko: "랭크", en: "Rank" },
    rankNew:        { ko: "신규", en: "Rookie" },
    leftLabel:      { ko: "남은 문제", en: "Remaining" },
    scoreNow:       { ko: "현재 점수", en: "Current Score" },
    pointsUnit:     { ko: "점", en: "pts" },
    correct:        { ko: "✅ 정답", en: "✅ Correct" },
    wrong:          { ko: "❌ 오답", en: "❌ Wrong" },
    promotionTitle: { ko: "📚 승급 심사 · 무한 랜덤 문제풀이", en: "📚 Promotion Exam · Infinite Random Quiz" },
    finalHp:        { ko: "최종 체력", en: "Final HP" },
    finalRep:       { ko: "최종 평판", en: "Final Reputation" },
    eventsHandled:  { ko: "처리한 상황", en: "Events Handled" },
    metaCount:      { ko: "누적", en: "Total" },
    metaCombo:      { ko: "콤보", en: "Combo" },
    metaBoss:       { ko: "보스", en: "Boss" },
    bestCombo:      { ko: "최고 콤보", en: "Best Combo" },
    dutyStart:      { ko: "듀티가 시작되었습니다. 첫 판단부터 중요합니다.", en: "Shift begins. Every decision matters from the start." },
    quizModeStart:  { ko: "국가고시 8과목 트레이닝 모드입니다.", en: "Boards 8-subject training mode." },
    trainingStart:  { ko: "기출 변형 풀이를 시작합니다.", en: "Starting question bank session." },
    trainingTitle:  { ko: "국가고시 8과목 트레이닝", en: "Boards · 8 Subjects Training" },
    trainingDesc:   { ko: "숫자와 상황이 계속 변하는 무한 랜덤 기출 변형(4지선다)이 제공됩니다.", en: "Infinite randomized boards-style 4-choice questions with varying numbers and scenarios." },
    introTitle:     { ko: "듀티의 시작", en: "Shift Begins" },
    introNight:     { ko: "어두운 복도, 절반은 꺼진 형광등. Night 듀티가 시작됩니다. 모니터 알람이 멀리서 울립니다.", en: "Dim corridor, half the fluorescents off. Night shift begins. A monitor alarm wails in the distance." },
    introEvening:   { ko: "저녁 6시, 보호자 면회와 신규 입원이 동시에 몰리는 시간. Evening 듀티 시작.", en: "6 PM — visitors and new admissions surge in. Evening shift begins." },
    introDay:       { ko: "병동 문이 열립니다. 햇살과 함께 첫 호출벨이 울립니다. Day 듀티 시작.", en: "The unit doors open. Sunlight pours in with the first call bell. Day shift begins." },
    introA:         { ko: "심호흡하고 인계 핵심부터 정리한다", en: "Take a breath and review handoff highlights" },
    introB:         { ko: "물품 카트부터 점검한다", en: "Check supply cart first" },
    introC:         { ko: "차지널스에게 어제 야간 이슈를 묻는다", en: "Ask charge nurse about last night's issues" },
    logIntroA:      { ko: "기본기부터 챙겼습니다.", en: "Solid fundamentals." },
    logIntroB:      { ko: "준비성이 좋습니다.", en: "Good preparation." },
    logIntroC:      { ko: "맥락 파악이 빠릅니다.", en: "Quick to grasp context." },
    restTitle:      { ko: "잠깐의 여유", en: "A Brief Moment" },
    restDesc:       { ko: "복도가 잠시 조용해졌습니다. 휴게실 의자가 부릅니다.", en: "The corridor falls quiet. The break-room chair is calling." },
    restA:          { ko: "따뜻한 차 한 잔 마시기", en: "Sip a warm tea" },
    restB:          { ko: "스트레칭으로 어깨 풀기", en: "Stretch your shoulders" },
    restC:          { ko: "동료와 짧은 잡담", en: "Brief chat with a colleague" },
    logRestA:       { ko: "체력을 회복했습니다.", en: "HP recovered." },
    logRestB:       { ko: "몸이 가벼워졌습니다.", en: "Body feels lighter." },
    logRestC:       { ko: "마음이 편해집니다.", en: "Mind eases." },
    bossClear:      { ko: "👑 BOSS CLEAR · HP 회복", en: "👑 BOSS CLEAR · HP recovered" },
    bossClearLog:   { ko: "👑 보스 클리어! HP +15", en: "👑 Boss cleared! HP +15" },
    comboEndPrefix: { ko: "콤보", en: "Combo" },
    comboEndSuffix: { ko: "종료", en: "ended" },
    gameOverHpTitle:    { ko: "💀 체력 고갈", en: "💀 Burnout" },
    gameOverHpDesc:     { ko: "번아웃 되었습니다. 환자 안전을 위해 퇴근하세요.", en: "You burned out. Clock out for patient safety." },
    gameOverRepTitle:   { ko: "⚠️ 평판 실추", en: "⚠️ Reputation Collapse" },
    gameOverRepDesc:    { ko: "치명적인 실수 누적으로 투약 사고 위기입니다.", en: "Critical errors stacked into a med-incident risk." },
    endLegend:      { ko: "🏆 전설의 간호사", en: "🏆 Legendary Nurse" },
    endLegendDesc:  { ko: "병원장 표창 후보로 추천됐습니다.", en: "Nominated for the CEO commendation." },
    endHero:        { ko: "🌟 듀티의 영웅", en: "🌟 Shift Hero" },
    endHeroDesc:    { ko: "동료들이 박수로 인계해줍니다.", en: "Colleagues applaud as you sign out." },
    endAce:         { ko: "💪 에이스 듀티 클리어", en: "💪 Ace Shift Cleared" },
    endAceDesc:     { ko: "확실한 1인분, 그 이상이었습니다.", en: "Way more than carrying your weight." },
    endSafe:        { ko: "✅ 듀티 무사 완수", en: "✅ Shift Safely Completed" },
    endSafeDesc:    { ko: "수고하셨습니다. 안전한 듀티였습니다.", en: "Well done. A safe shift." },
    endSurvived:    { ko: "😮‍💨 겨우 살아남음", en: "😮‍💨 Barely Survived" },
    endSurvivedDesc:{ ko: "오늘은 운이 좋았습니다. 내일은 더 잘해봐요.", en: "Lucky today. Aim higher tomorrow." },
    endNeedsWork:   { ko: "📋 듀티 종료 · 개선 필요", en: "📋 Shift Ended · Needs Work" },
    endNeedsWorkDesc:{ko: "복기와 재교육이 필요한 듀티였습니다.", en: "A shift that calls for review and retraining." },
    quizDoneTitle:  { ko: "학습 종료", en: "Study Ended" },
    quizDoneDesc:   { ko: "머리가 과열됐습니다. 오늘은 여기까지!", en: "Brain overheated. That's it for today!" },
    rank0:          { ko: "신규 간호사 (SN/RN)", en: "New Grad RN" },
    rank10:         { ko: "RN 2년차 (1인분 가능)", en: "RN Year 2" },
    rank30:         { ko: "RN 5년차 (에이스)", en: "RN Year 5 · Ace" },
    rank50:         { ko: "차지 널스 (Charge)", en: "Charge Nurse" },
    rank100:        { ko: "수간호사 (HN)", en: "Head Nurse" },
};
function t(key) { return L(T[key]); }

// =========================
// 저장소 (localStorage)
// =========================
function saveSettings() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            lang: gameState.lang,
            lifetime: gameState.lifetime,
        }));
    } catch (e) { /* private mode 등 무시 */ }
}
function loadSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data.lang === "ko" || data.lang === "en") gameState.lang = data.lang;
        if (data.lifetime) Object.assign(gameState.lifetime, data.lifetime);
    } catch (e) { /* corrupt 무시 */ }
}
function setLang(lang) {
    gameState.lang = lang === "en" ? "en" : "ko";
    saveSettings();
    syncLangButtons();
    renderRoot();
}
function syncLangButtons() {
    const ko = document.getElementById("lang-ko");
    const en = document.getElementById("lang-en");
    if (!ko || !en) return;
    ko.classList.toggle("active", gameState.lang === "ko");
    en.classList.toggle("active", gameState.lang === "en");
    document.documentElement.lang = gameState.lang;
}

// =========================
// 루트 렌더 (현재 모드에 따라)
// =========================
function renderRoot() {
    if (gameState.mode === "menu") return renderMainMenu();
    if (gameState.mode === "quiz_menu") return renderQuizMenu();
    if (gameState.mode === "quiz") return renderNextQuizQuestion();
    if (gameState.mode === "survival") return renderSurvivalEvent("random_hub");
    return renderMainMenu();
}

function renderMainMenu() {
    gameState.mode = "menu";
    UI.topBar.classList.add("hidden");
    UI.logBar.classList.add("hidden");
    UI.inventory.classList.add("hidden");
    UI.progressWrap.classList.add("hidden");
    document.getElementById("progress-info").classList.add("hidden");
    document.title = t("appTitle");

    const shift = gameState.currentShift;
    UI.gameArea.innerHTML = `
        <div class="card menu-container">
            <span class="scene-emoji">🏥</span>
            <h2>${t("appTitle")}</h2>
            <p class="subtitle">${t("subtitle")}</p>

            <div class="shift-label">${t("shiftLabel")}</div>
            <div style="margin-bottom: 22px;">
                <button class="shift-option ${shift==='Day'?'active':''}" data-shift="Day" data-mult="1.0">${t("shiftDay")}</button>
                <button class="shift-option ${shift==='Evening'?'active':''}" data-shift="Evening" data-mult="1.2">${t("shiftEvening")}</button>
                <button class="shift-option ${shift==='Night'?'active':''}" data-shift="Night" data-mult="1.5">${t("shiftNight")}</button>
            </div>

            <button class="choice-btn primary" onclick="initSurvival()">${t("startSurvival")}</button>
            <button class="choice-btn ghost center" onclick="renderQuizMenu()">${t("openTraining")}</button>
        </div>
    `;
    UI.gameArea.querySelectorAll(".shift-option").forEach(btn => {
        btn.addEventListener("click", (e) => setShift(btn.dataset.shift, parseFloat(btn.dataset.mult), btn));
    });
}

const UI = {
    hp: document.getElementById("hp"),
    rep: document.getElementById("rep"),
    gameArea: document.getElementById("game-area"),
    topBar: document.getElementById("top-bar"),
    logBar: document.getElementById("log-bar"),
    inventory: document.getElementById("inventory-bar"),
    modal: document.getElementById("modal"),
    progressWrap: document.getElementById("progress-wrap"),
    progressFill: document.getElementById("progress-fill"),
    progressText: document.getElementById("progress-text"),
    progressPercent: document.getElementById("progress-percent"),
};

// =========================
// 유틸리티
// =========================
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function clamp(num, min, max) { return Math.min(Math.max(num, min), max); }

function addLog(text, type = "") {
    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`.trim();
    entry.textContent = `> ${text}`;
    UI.logBar.prepend(entry);
}

// 💡 똑같은 템플릿(유형)이 반복되지 않게 Base ID를 기억합니다.
function rememberQuestion(baseId) {
    if (!gameState.recentIds.includes(baseId)) {
        gameState.recentIds.push(baseId);
    }
    // 최근 45개의 문제 유형을 기억하여 중복을 원천 차단
    if (gameState.recentIds.length > 45) {
        gameState.recentIds.shift();
    }
}
function recentlyUsed(baseId) { return gameState.recentIds.includes(baseId); }

// =========================
// UI 업데이트
// =========================
function updateStats() {
    const shownHp = clamp(gameState.hp, 0, 100);
    UI.hp.textContent = shownHp;
    UI.rep.textContent = gameState.rep;
    UI.hp.style.color = shownHp < 30 ? "var(--danger)" : shownHp < 60 ? "var(--warning)" : "var(--success)";

    const progress = Math.min((gameState.eventCount / MAX_PROGRESS_EVENTS) * 100, 100);
    UI.progressFill.style.width = `${progress}%`;
    UI.progressPercent.textContent = `${Math.round(progress)}%`;

    if (gameState.mode === "survival") UI.progressText.textContent = t("progressShift");
    else if (gameState.mode === "quiz") UI.progressText.textContent = `${t("progressTrain")} · ${gameState.quizCategory ? catName(gameState.quizCategory) : ""}`;
    else UI.progressText.textContent = t("progressIdle");

    UI.inventory.innerHTML = "";
    const shiftBadge = document.createElement("span");
    shiftBadge.className = "badge accent";
    shiftBadge.textContent = `${t("statShift")}: ${gameState.currentShift}`;
    UI.inventory.appendChild(shiftBadge);

    const statusBadge = document.createElement("span");
    statusBadge.className = "badge";
    statusBadge.textContent = gameState.mode === "survival" ? t("statStateLive") : gameState.mode === "quiz" ? t("statStateTrain") : t("statStateIdle");
    UI.inventory.appendChild(statusBadge);

    if (gameState.quizSolved > 0) {
        const solvedBadge = document.createElement("span");
        solvedBadge.className = "badge success";
        solvedBadge.textContent = `${t("solvedBadge")}: ${gameState.quizSolved} ${t("questionsLabel")}`;
        UI.inventory.appendChild(solvedBadge);
    }
}

function showCoreUI() {
    UI.topBar.classList.remove("hidden");
    UI.logBar.classList.remove("hidden");
    UI.inventory.classList.remove("hidden");
    UI.progressWrap.classList.remove("hidden");
}

// =========================
// 4지선다 고정 문제은행
// =========================
const clinicalGenerators = [
    generateDopamineQuestion, generateSepsisQuestion, generatePsychQuestion,
    generateElectrolyteQuestion, generatePedsPriorityQuestion, generateOBQuestion,
    generateManagementQuestion, generateRespQuestion, generateSafetyPriorityQuestion,
    generateTransfusionQuestion, generateIICPQuestion, generateFHRQuestion,
    generateLawQuestion, generateMIQuestion, generateABGAQuestion, generateTriageQuestion,
    generatePositionQuestion, generateVaccineQuestion, generateNaegeleQuestion,
    generateApgarQuestion, generateBurnQuestion, generateShockQuestion,
    generateDiabeticQuestion, generateAsepticQuestion,
    // 신규 추가 기출 변형
    generateCPRQuestion, generatePressureUlcerQuestion, generateInsulinQuestion,
    generateCOPDQuestion, generateStrokeQuestion, generateChemoQuestion,
    generateSuicideQuestion, generateDepressionQuestion, generateDementiaQuestion,
    generateAlcoholWithdrawalQuestion, generateBSEQuestion, generatePIHQuestion,
    generateBreastfeedingQuestion, generateDevelopmentQuestion, generateCroupQuestion,
    generateKawasakiQuestion, generateDelegationQuestion, generateMedicalLawQuestion,
    generateFamilyNursingQuestion, generateSchoolHealthQuestion, generateIsolationQuestion,
    generatePainQuestion, generateGCSQuestion, generateRenalFailureQuestion,
    generatePostOpQuestion, generateHeartFailureQuestion,
    // 2차 대규모 확장 (40개)
    generateVitalSignQuestion, generateMedication5RQuestion, generateNGTubeQuestion,
    generateHandWashingQuestion, generateOxygenDeliveryQuestion, generateThyroidStormQuestion,
    generateHypothyroidQuestion, generateGlaucomaQuestion, generateCataractQuestion,
    generateFractureQuestion, generateSpinalCordQuestion, generatePEQuestion,
    generatePepticUlcerQuestion, generatePancreatitisQuestion, generateAppendicitisQuestion,
    generateAnemiaQuestion, generateLiverCirrhosisQuestion, generateEctopicQuestion,
    generatePlacentaPreviaQuestion, generateAbruptionQuestion, generateNeonatalJaundiceQuestion,
    generateRHIncompatibilityQuestion, generateInfantNutritionQuestion, generateAsthmaQuestion,
    generateOtitisMediaQuestion, generateSchizophreniaQuestion, generateBipolarQuestion,
    generateOCDQuestion, generatePTSDQuestion, generateECTQuestion,
    generatePreventionLevelQuestion, generateEpidemiologyQuestion, generateLeadershipQuestion,
    generateConflictQuestion, generateNursingDeliveryQuestion, generateMaternalLawQuestion,
    generateMentalHealthLawQuestion, generateEmergencyLawQuestion, generateBloodTypeQuestion,
    generateBPHQuestion, generateCKDDialysisQuestion, generateGallstoneQuestion,
    generatePostpartumQuestion
];

function generateABGAQuestion() {
    const isAcidosis = Math.random() < 0.5; const isResp = Math.random() < 0.5;
    let pH, PaCO2, HCO3, correctKey;
    if (isAcidosis && isResp)       { pH = (7.20 + Math.random() * 0.1).toFixed(2); PaCO2 = rand(46, 60); HCO3 = rand(22, 26); correctKey = "respAcid"; }
    else if (isAcidosis && !isResp) { pH = (7.20 + Math.random() * 0.1).toFixed(2); PaCO2 = rand(35, 45); HCO3 = rand(15, 21); correctKey = "metaAcid"; }
    else if (!isAcidosis && isResp) { pH = (7.46 + Math.random() * 0.1).toFixed(2); PaCO2 = rand(20, 34); HCO3 = rand(22, 26); correctKey = "respAlk";  }
    else                            { pH = (7.46 + Math.random() * 0.1).toFixed(2); PaCO2 = rand(35, 45); HCO3 = rand(27, 35); correctKey = "metaAlk";  }
    const labels = {
        respAcid: loc("호흡성 산증", "Respiratory acidosis"),
        metaAcid: loc("대사성 산증", "Metabolic acidosis"),
        respAlk:  loc("호흡성 알칼리증", "Respiratory alkalosis"),
        metaAlk:  loc("대사성 알칼리증", "Metabolic alkalosis"),
    };
    const wrongKeys = Object.keys(labels).filter(k => k !== correctKey);
    return { baseId: "abga", categoryKey: "adult", part: loc("호흡/ABGA","Resp / ABG"), emoji: "🩸",
        title: loc("ABGA 판독","ABG Interpretation"),
        desc: loc(`pH ${pH}, PaCO2 ${PaCO2}, HCO3- ${HCO3}\n이 환자의 상태는?`, `pH ${pH}, PaCO2 ${PaCO2}, HCO3- ${HCO3}\nWhat is the patient's status?`),
        choices: shuffle([
            { text: labels[correctKey],   effect: { hp: -5,  rep: 25 },  log: loc("정답. pH·PaCO2·HCO3 해석이 정확합니다.","Correct. Accurate pH/PaCO2/HCO3 interpretation.") },
            { text: labels[wrongKeys[0]], effect: { hp: -30, rep: -15 }, log: loc("수치 해석 오류입니다.","Misinterpreted lab values.") },
            { text: labels[wrongKeys[1]], effect: { hp: -30, rep: -15 }, log: loc("수치 해석 오류입니다.","Misinterpreted lab values.") },
            { text: labels[wrongKeys[2]], effect: { hp: -30, rep: -15 }, log: loc("수치 해석 오류입니다.","Misinterpreted lab values.") }
        ])
    };
}
function generateTriageQuestion() { return { baseId: "triage", categoryKey: "community", part: loc("재난간호","Disaster Nursing"), emoji: "🚨", title: loc("START 분류","START Triage"), desc: loc(`기도 유지 후에도 무호흡인 환자의 중증도 분류 색상은?`,`What triage color is assigned to a patient who remains apneic after airway repositioning?`), choices: shuffle([{ text: loc("흑색 (Black / 사망 또는 지연)","Black (Deceased / Expectant)"), effect: { hp: -5, rep: 20 }, log: loc("정답. 기도 개방 후에도 무호흡이면 흑색입니다.","Correct. Apneic after airway opening = Black.") }, { text: loc("적색 (Red / 긴급)","Red (Immediate)"), effect: { hp: -25, rep: -15 }, log: loc("적색은 생존 가능한 중증 환자입니다.","Red is salvageable critical patients.") }, { text: loc("황색 (Yellow / 응급)","Yellow (Delayed)"), effect: { hp: -20, rep: -10 }, log: loc("황색은 수시간 내 처치가 필요한 환자입니다.","Yellow needs care within hours.") }, { text: loc("녹색 (Green / 비응급)","Green (Minor)"), effect: { hp: -15, rep: -5 }, log: loc("녹색은 경증 환자입니다.","Green is minor injuries.") }]) }; }
function generatePositionQuestion() { return { baseId: "position", categoryKey: "fundamentals", part: loc("체위","Positioning"), emoji: "🛏️", title: loc("목적에 맞는 체위","Purpose-Specific Positioning"), desc: loc(`관장(Enema) 시 용액이 잘 들어가도록 가장 적절히 취해줄 체위는?`,`Which position best facilitates enema solution flow into the colon?`), choices: shuffle([{ text: loc("좌측 심스위(Sims')","Left Sims' position"), effect: { hp: -2, rep: 15 }, log: loc("정답. 구불결장으로 용액이 잘 흘러갑니다.","Correct. Solution flows easily into the sigmoid colon.") }, { text: loc("파울러씨위","Fowler's position"), effect: { hp: -15, rep: -10 }, log: loc("호흡곤란 시 취하는 체위입니다.","Used for dyspnea.") }, { text: loc("트렌델렌버그위","Trendelenburg position"), effect: { hp: -20, rep: -15 }, log: loc("쇼크 시 다리 거상 체위입니다.","Leg-elevation position for shock.") }, { text: loc("배횡와위","Dorsal recumbent position"), effect: { hp: -15, rep: -10 }, log: loc("여성 인공도뇨 시 취하는 체위입니다.","Used for female catheterization.") }]) }; }
function generateVaccineQuestion() { return { baseId: "vaccine", categoryKey: "pediatric", part: loc("예방접종","Immunization"), emoji: "💉", title: loc("정기 예방접종","Routine Immunization"), desc: loc(`생후 12~15개월에 접종해야 하는 백신은?`,`Which vaccine is given at 12–15 months of age?`), choices: shuffle([{ text: loc("MMR (홍역, 볼거리, 풍진)","MMR (measles, mumps, rubella)"), effect: { hp: -2, rep: 18 }, log: loc("정답. 수두와 함께 12~15개월 접종입니다.","Correct. Given with varicella at 12–15 months.") }, { text: loc("BCG (결핵)","BCG (tuberculosis)"), effect: { hp: -25, rep: -15 }, log: loc("생후 4주 이내 접종합니다.","Given within 4 weeks of birth.") }, { text: loc("B형 간염","Hepatitis B"), effect: { hp: -20, rep: -10 }, log: loc("0, 1, 6개월 접종입니다.","Given at 0/1/6 months.") }, { text: "DTaP", effect: { hp: -15, rep: -10 }, log: loc("2, 4, 6개월 접종입니다.","Given at 2/4/6 months.") }]) }; }
function generateTransfusionQuestion() { return { baseId: "transfusion", categoryKey: "fundamentals", part: loc("수혈","Transfusion"), emoji: "🩸", title: loc("수혈 부작용","Transfusion Reaction"), desc: loc(`수혈 15분 후 환자가 요통, 오한, 발열을 호소한다. 우선 중재는?`,`15 min into transfusion, the patient reports back pain, chills, and fever. First action?`), choices: shuffle([{ text: loc("수혈을 중단하고 N/S를 연결한다","Stop the transfusion and switch to normal saline"), effect: { hp: -5, rep: 22 }, log: loc("정답. 용혈성 반응 의심 시 즉각 중단이 필수입니다.","Correct. Stop immediately if hemolytic reaction is suspected.") }, { text: loc("의사에게 먼저 보고하고 지시를 기다린다","Notify the physician first and wait for orders"), effect: { hp: -30, rep: -15 }, log: loc("보고보다 원인 차단(중단)이 먼저입니다.","Stopping the cause comes before reporting.") }, { text: loc("주입 속도를 줄이고 활력징후를 재측정한다","Slow infusion and reassess vital signs"), effect: { hp: -40, rep: -20 }, log: loc("속도 조절이 아니라 완전 중단해야 합니다.","Slowing isn't enough — full stop required.") }, { text: loc("처방된 항히스타민제를 투여한다","Administer the ordered antihistamine"), effect: { hp: -25, rep: -10 }, log: loc("알레르기 반응이 아닐 수 있으며 중단이 먼저입니다.","May not be allergic — stop first.") }]) }; }
function generateIICPQuestion() { return { baseId: "iicp", categoryKey: "adult", part: loc("신경계","Neurology"), emoji: "🧠", title: loc("두개내압 상승","Increased ICP"), desc: loc(`두개내압 상승(IICP) 환자에게 적절한 간호중재는?`,`Which intervention is appropriate for a patient with increased intracranial pressure (ICP)?`), choices: shuffle([{ text: loc("침상 머리를 15~30도 올려 정맥 귀환을 돕는다","Elevate head of bed 15–30° to aid venous return"), effect: { hp: -5, rep: 20 }, log: loc("정답. 뇌압 하강을 돕는 기본 체위입니다.","Correct. Basic position to lower ICP.") }, { text: loc("객담 배출을 위해 기침과 심호흡을 강하게 유도한다","Strongly encourage coughing and deep breathing"), effect: { hp: -40, rep: -25 }, log: loc("발살바·기침은 뇌압을 급상승시킵니다.","Valsalva and coughing spike ICP.") }, { text: loc("다리를 올려주는 트렌델렌버그 체위를 취한다","Place in Trendelenburg position with legs up"), effect: { hp: -40, rep: -25 }, log: loc("뇌로 혈류가 몰려 뇌압이 크게 오릅니다.","Increases cerebral blood flow and ICP.") }, { text: loc("탈수를 막기 위해 수분 섭취를 적극 권장한다","Encourage abundant fluid intake to prevent dehydration"), effect: { hp: -20, rep: -10 }, log: loc("수분 제한 및 만니톨 투여가 필요합니다.","Fluid restriction and mannitol are indicated.") }]) }; }
function generateFHRQuestion() { return { baseId: "fhr", categoryKey: "maternal", part: loc("분만","Labor"), emoji: "🤰", title: loc("태아심음 후기하강","Late FHR Deceleration"), desc: loc(`자궁수축 정점 이후 태아심음이 떨어지는 '후기하강' 발생 시 올바른 중재는?`,`Late deceleration: FHR drops after the peak of contraction. Correct intervention?`), choices: shuffle([{ text: loc("좌측위를 취해주고 산소를 공급한다","Position left-lateral and administer oxygen"), effect: { hp: -6, rep: 24 }, log: loc("정답. 태반 관류 부족이 원인이므로 체위변경과 산소가 핵심입니다.","Correct. Caused by uteroplacental insufficiency — repositioning and O2 are key.") }, { text: loc("제대 압박이 원인이므로 슬흉위를 취해준다","Place in knee-chest position for cord compression"), effect: { hp: -20, rep: -10 }, log: loc("슬흉위는 가변성 하강의 중재입니다.","Knee-chest is for variable decelerations.") }, { text: loc("정상적인 아두 압박 과정이므로 관찰한다","Just observe — normal head compression"), effect: { hp: -25, rep: -15 }, log: loc("조기하강에 대한 설명입니다. 후기하강은 응급입니다.","That describes early deceleration. Late is emergent.") }, { text: loc("유도분만제(옥시토신)의 주입 속도를 높인다","Increase oxytocin infusion rate"), effect: { hp: -40, rep: -30 }, log: loc("수축을 촉진하면 태아가 더 위험해집니다. 즉시 중단해야 합니다.","Stronger contractions worsen the situation — must stop oxytocin.") }]) }; }
function generateLawQuestion() { return { baseId: "law", categoryKey: "law", part: loc("감염병예방법","Communicable Disease Law"), emoji: "⚖️", title: loc("감염병 신고","Reportable Disease"), desc: loc(`간호사가 법정감염병인 결핵 환자를 발견했다. 올바른 신고 절차는?`,`A nurse identifies a TB patient. What is the correct reporting procedure?`), choices: shuffle([{ text: loc("소속 의료기관의 장에게 즉시 보고한다","Immediately report to the head of the medical institution"), effect: { hp: -5, rep: 20 }, log: loc("정답. 의료인은 기관장에게 보고하고, 기관장이 보건소에 신고합니다.","Correct. Clinicians report to the institution head, who notifies the health center.") }, { text: loc("질병관리청장에게 즉시 전화로 유선 신고한다","Phone the KDCA director directly"), effect: { hp: -20, rep: -10 }, log: loc("직접 신고 대상이 아닙니다.","Not the direct reporting authority.") }, { text: loc("관할 경찰서에 먼저 알린다","Notify the local police first"), effect: { hp: -20, rep: -10 }, log: loc("경찰 소관이 아닙니다.","Not within police jurisdiction.") }, { text: loc("환자가 직접 보건소에 방문하도록 안내하고 끝낸다","Tell the patient to self-report and stop there"), effect: { hp: -30, rep: -20 }, log: loc("의료인의 신고 의무 위반입니다.","Violates the clinician's duty to report.") }]) }; }
function generateDopamineQuestion() { const w = rand(50, 70); const c = +(5*w*60/1000).toFixed(1); return { baseId: "dopamine", categoryKey: "fundamentals", part: loc("계산","Calculation"), emoji: "🔢", title: loc("약물 용량 계산","Drug Dose Calculation"), desc: loc(`Dopamine 5mcg/kg/min 처방. 체중 ${w}kg, 약제 농도 1mg/ml일 때 주입 속도는?`,`Dopamine ordered at 5 mcg/kg/min. Weight ${w} kg, concentration 1 mg/mL. Infusion rate?`), choices: shuffle([{ text: `${c} ml/hr`, effect: { hp: -2, rep: 15 }, log: loc("정답입니다. 정확한 계산입니다.","Correct. Accurate calculation.") }, { text: `${+(c*2).toFixed(1)} ml/hr`, effect: { hp: -20, rep: -10 }, log: loc("과용량입니다. 단위 변환을 확인하세요.","Overdose. Check unit conversion.") }, { text: `${+(c/2).toFixed(1)} ml/hr`, effect: { hp: -20, rep: -10 }, log: loc("소용량입니다. 계산 오류.","Underdose. Calculation error.") }, { text: `${+(c+5).toFixed(1)} ml/hr`, effect: { hp: -15, rep: -5 }, log: loc("오답입니다.","Incorrect.") }]) }; }
function generateSepsisQuestion() { return { baseId: "sepsis", categoryKey: "adult", part: loc("감염","Infection"), emoji: "🌡️", title: loc("패혈증(Sepsis) 번들","Sepsis Bundle"), desc: loc("환자가 혈압 80/50, 체온 39도, 의식 저하를 보일 때 우선 간호중재는?","BP 80/50, temp 39°C, altered mental status. Priority nursing intervention?"), choices: shuffle([{ text: loc("혈액배양 검사를 먼저 나간 후 광범위 항생제를 투여한다","Draw blood cultures first, then start broad-spectrum antibiotics"), effect: { hp: -2, rep: 15 }, log: loc("정답. 항생제 투여 전 혈액배양이 필수입니다.","Correct. Cultures must precede antibiotics.") }, { text: loc("해열제를 최우선으로 투여하여 체온을 떨어뜨린다","Prioritize antipyretic to drop temperature"), effect: { hp: -20, rep: -10 }, log: loc("해열보다 관류 유지와 배양이 먼저입니다.","Perfusion and cultures come before fever control.") }, { text: loc("스테로이드를 즉시 IV로 투여한다","Give IV steroids immediately"), effect: { hp: -20, rep: -10 }, log: loc("1차 선택약이 아닙니다.","Not first-line.") }, { text: loc("수분 섭취를 격려하고 경과를 관찰한다","Encourage oral fluids and observe"), effect: { hp: -30, rep: -20 }, log: loc("응급 수액 요법이 필요한 쇼크 상태입니다.","This is shock requiring emergent IV fluids.") }]) }; }
function generatePsychQuestion() { return { baseId: "psych", categoryKey: "psych", part: loc("망상","Delusion"), emoji: "🧠", title: loc("망상 환자 대화","Communicating with Delusional Patient"), desc: loc("환자가 '밥에 독을 탔다'며 식사를 강하게 거부할 때 적절한 반응은?","Patient refuses food, insisting it's poisoned. Best response?"), choices: shuffle([{ text: loc("두려운 감정을 수용하고 팩 포장된 음식을 제공해 본다","Accept the fear and offer sealed/packaged food"), effect: { hp: -2, rep: 15 }, log: loc("정답. 망상에 논쟁하지 않고 불안을 감소시킵니다.","Correct. Doesn't argue the delusion, reduces anxiety.") }, { text: loc("밥에 독이 없다는 것을 과학적으로 증명해준다","Scientifically prove the food isn't poisoned"), effect: { hp: -15, rep: -10 }, log: loc("망상은 논리로 설득되지 않습니다.","Delusions can't be argued away logically.") }, { text: loc("환자의 말을 무시하고 다른 주제로 대화를 돌린다","Ignore the patient and change the subject"), effect: { hp: -10, rep: -5 }, log: loc("환자의 감정을 외면하는 태도입니다.","Dismisses the patient's emotion.") }, { text: loc("식사를 안 하면 콧줄(L-tube)을 꽂겠다고 단호히 말한다","Threaten an NG tube if patient refuses"), effect: { hp: -30, rep: -20 }, log: loc("강압적인 태도는 불신을 더 키웁니다.","Coercion deepens distrust.") }]) }; }
function generateElectrolyteQuestion() { return { baseId: "electrolyte", categoryKey: "adult", part: loc("전해질","Electrolytes"), emoji: "⚡", title: loc("고칼륨혈증 응급간호","Hyperkalemia Emergency"), desc: loc("혈청 K(칼륨) 7.0 mEq/L인 환자에게 즉각적인 심근 보호를 위해 **가장 먼저** 투여해야 할 약물은?","Serum K 7.0 mEq/L. What is given **first** for immediate cardiac protection?"), choices: shuffle([{ text: "Calcium gluconate IV", effect: { hp: -3, rep: 22 }, log: loc("정답. 심근 세포막을 안정시켜 부정맥을 즉시 예방합니다.","Correct. Stabilizes cardiac cell membrane and prevents arrhythmia immediately.") }, { text: loc("처방된 KCL(염화칼륨) IV push","IV push of ordered KCl"), effect: { hp: -50, rep: -40 }, log: loc("절대 금기. 즉각적인 심정지를 유발합니다.","Absolute contraindication — causes immediate cardiac arrest.") }, { text: loc("포도당+인슐린 IV (단독)","Dextrose + insulin IV (alone)"), effect: { hp: -20, rep: -10 }, log: loc("칼륨을 세포 내로 이동시키나 심근 안정화가 우선입니다.","Shifts K intracellularly but membrane stabilization is first.") }, { text: loc("칼리메이트(Kalimate) 관장 (단독)","Kayexalate enema (alone)"), effect: { hp: -20, rep: -10 }, log: loc("장기적 칼륨 배출제로 응급 1차가 아닙니다.","Long-term K excretion — not first-line emergent.") }]) }; }
function generatePedsPriorityQuestion() { return { baseId: "peds", categoryKey: "pediatric", part: loc("호흡기계","Respiratory"), emoji: "🧸", title: loc("아동 호흡곤란 우선순위","Pediatric Respiratory Priority"), desc: loc("영아가 코벌렁임(비익호흡)과 흉벽 함몰을 보이며 칭얼거릴 때 가장 우선할 간호는?","An infant shows nasal flaring, chest retraction, and irritability. Top priority?"), choices: shuffle([{ text: loc("기도 유지와 호흡 상태를 사정하고 산소화를 준비한다","Assess airway/breathing and prepare oxygenation"), effect: { hp: -2, rep: 15 }, log: loc("정답. 소아는 호흡 문제가 가장 빠르게 악화됩니다.","Correct. Pediatric respiratory issues deteriorate fastest.") }, { text: loc("환아의 상태 변화를 차트에 상세히 기록한다","Document detailed changes in the chart"), effect: { hp: -20, rep: -10 }, log: loc("기록보다 즉각적인 사정과 처치가 먼저입니다.","Assessment and intervention precede documentation.") }, { text: loc("놀란 보호자를 병실 밖으로 안내하여 진정시킨다","Lead the anxious caregiver out to calm them"), effect: { hp: -15, rep: -5 }, log: loc("보호자 안위보다 환아 생명 유지가 먼저입니다.","Child's life takes priority over caregiver comfort.") }, { text: loc("열이 있는지 확인 후 해열제부터 경구 투여한다","Check fever and give an oral antipyretic first"), effect: { hp: -20, rep: -10 }, log: loc("호흡곤란 영아에게 경구 투여는 흡인 위험이 큽니다.","Aspiration risk in distressed infant.") }]) }; }
function generateOBQuestion() { return { baseId: "ob", categoryKey: "maternal", part: loc("산후출혈","Postpartum Hemorrhage"), emoji: "🩸", title: loc("자궁이완성 출혈 중재","Uterine Atony Intervention"), desc: loc("분만 1시간 뒤 산모의 패드가 다 젖고 자궁저부가 물렁하게 만져질 때 우선 중재는?","1 hour postpartum: pad is saturated and the fundus is boggy. Priority intervention?"), choices: shuffle([{ text: loc("즉시 자궁저부를 둥글게 마사지한다","Immediately perform circular fundal massage"), effect: { hp: -2, rep: 15 }, log: loc("정답. 자궁 수축을 유도하는 가장 빠르고 필수적인 1차 중재입니다.","Correct. Fastest, most essential first action to induce contraction.") }, { text: loc("마사지 없이 의사가 올 때까지 출혈량만 체크한다","Just monitor blood loss until the doctor arrives"), effect: { hp: -20, rep: -10 }, log: loc("지연되면 출혈성 쇼크에 빠집니다.","Delay leads to hemorrhagic shock.") }, { text: loc("회복을 위해 복도 보행을 적극적으로 유도한다","Encourage hallway ambulation for recovery"), effect: { hp: -30, rep: -15 }, log: loc("출혈 환자는 절대 안정해야 합니다.","Hemorrhaging patients require strict bed rest.") }, { text: loc("따뜻한 물을 많이 마시도록 격려한다","Push warm fluids by mouth"), effect: { hp: -15, rep: -5 }, log: loc("우선순위에서 크게 밀리는 행동입니다.","Far down the priority list.") }]) }; }
function generateManagementQuestion() { return { baseId: "management", categoryKey: "management", part: loc("안전","Safety"), emoji: "📑", title: loc("환자 안전과 보고","Patient Safety & Reporting"), desc: loc("근무 종료 직전, 환자에게 투여할 약물이 바뀐 것을 발견했습니다. 올바른 행동은?","Just before end-of-shift, you find a medication was switched. Correct action?"), choices: shuffle([{ text: loc("환자 상태를 즉시 살피고 책임자에게 정직하게 보고한다","Assess the patient immediately and report honestly to the supervisor"), effect: { hp: -2, rep: 15 }, log: loc("정답. 환자 안전을 위한 투명한 보고 문화가 가장 중요합니다.","Correct. Transparent reporting culture is paramount.") }, { text: loc("환자에게 증상이 없으므로 아무에게도 말하지 않고 은폐한다","No symptoms — conceal it from everyone"), effect: { hp: -50, rep: -50 }, log: loc("은폐는 추후 환자 생명에 치명적인 결과를 낳습니다.","Concealment can be fatal later.") }, { text: loc("환자에게 몰래 사과만 하고 투약 기록을 임의로 수정한다","Apologize privately and edit the MAR yourself"), effect: { hp: -40, rep: -40 }, log: loc("기록 조작은 심각한 범죄 행위입니다.","Falsifying records is a serious offense.") }, { text: loc("동료 간호사에게만 털어놓고 의사에게는 숨긴다","Tell only a coworker, hide from the doctor"), effect: { hp: -30, rep: -20 }, log: loc("공식적인 사고 보고 절차를 위반했습니다.","Violates formal incident-reporting procedures.") }]) }; }
function generateRespQuestion() { return { baseId: "resp", categoryKey: "adult", part: loc("호흡기계","Respiratory"), emoji: "🫁", title: loc("저산소증 응급","Hypoxia Emergency"), desc: loc("병실 환자가 갑자기 SpO2 85%로 떨어지며 청색증을 보일 때 가장 먼저 할 조치는?","Patient suddenly drops to SpO2 85% with cyanosis. First action?"), choices: shuffle([{ text: loc("기도를 확인하고 즉각적으로 산소 투여 및 반좌위를 취한다","Confirm airway, give oxygen, and place in semi-Fowler's position"), effect: { hp: -2, rep: 15 }, log: loc("정답. ABC 확보와 산소화가 최우선입니다.","Correct. Securing ABCs and oxygenation come first.") }, { text: loc("일시적 현상일 수 있으니 30분 뒤 재측정한다","May be transient — recheck in 30 min"), effect: { hp: -30, rep: -20 }, log: loc("저산소증을 방치하면 뇌손상·심정지가 옵니다.","Untreated hypoxia leads to brain damage and arrest.") }, { text: loc("상황을 간호기록지에 먼저 상세히 남긴다","Document in detail before intervening"), effect: { hp: -15, rep: -10 }, log: loc("처치가 기록보다 무조건 선행되어야 합니다.","Treatment always precedes documentation.") }, { text: loc("불안해하므로 수면제를 투여하여 재운다","Sedate the patient to calm anxiety"), effect: { hp: -40, rep: -30 }, log: loc("호흡 억제로 사망에 이를 수 있습니다.","Respiratory depression can be fatal.") }]) }; }
function generateSafetyPriorityQuestion() { return { baseId: "priority", categoryKey: "adult", part: loc("우선순위","Priority"), emoji: "🚑", title: loc("응급 환자 분류","ED Patient Prioritization"), desc: loc("응급실에 4명의 환자가 도착했습니다. 가장 먼저 처치해야 할 환자는?","Four patients arrive in the ED. Treat first?"), choices: shuffle([{ text: loc("갑작스러운 흉통과 식은땀을 흘리며 의식이 흐려지는 환자","Sudden chest pain, diaphoresis, and altered mental status"), effect: { hp: -2, rep: 15 }, log: loc("정답. 심근경색 의심 증상으로 즉각적 생명 위협이 있습니다.","Correct. Suspected MI — immediate life threat.") }, { text: loc("단순 열상으로 피가 조금 나며 퇴원 약을 기다리는 환자","Minor laceration awaiting discharge meds"), effect: { hp: -10, rep: -5 }, log: loc("가장 후순위 환자입니다.","Lowest priority.") }, { text: loc("수술 후 상처 부위 통증 5점(NRS)을 호소하는 환자","Post-op patient with NRS 5 pain at incision"), effect: { hp: -15, rep: -5 }, log: loc("통증 조절은 필요하나 생명 위협은 적습니다.","Needs analgesia but no immediate life threat.") }, { text: loc("아침 식사가 맛없다며 병동에서 난동을 피우는 환자","Patient making a scene about hospital food"), effect: { hp: -15, rep: -5 }, log: loc("의학적 응급상황이 아닙니다.","Not a medical emergency.") }]) }; }
function generateMIQuestion() { return { baseId: "mi", categoryKey: "adult", part: loc("심혈관계","Cardiovascular"), emoji: "💔", title: loc("급성 심근경색(MI)","Acute MI"), desc: loc("니트로글리세린(NTG) 설하 투여에도 가라앉지 않는 쥐어짜는 듯한 흉통 환자 중재는?","Crushing chest pain unrelieved by sublingual NTG. Intervention?"), choices: shuffle([{ text: loc("ECG 모니터링하며 산소를 공급하고 처방된 모르핀을 투여한다(MONA)","ECG monitoring + oxygen + ordered morphine (MONA)"), effect: { hp: -2, rep: 15 }, log: loc("정답. 급성 MI의 표준 초기 중재(MONA)입니다.","Correct. Standard MONA initial intervention.") }, { text: loc("혈전 방지를 위해 복도 걷기 운동을 30분간 강제한다","Force 30 min hallway walking to prevent clots"), effect: { hp: -30, rep: -20 }, log: loc("심근 산소요구량을 줄이기 위해 절대안정해야 합니다.","Strict bed rest to reduce myocardial oxygen demand.") }, { text: loc("효과가 나타날 때까지 NTG를 1분 간격으로 계속 무한정 투여한다","Give NTG every 1 min indefinitely"), effect: { hp: -25, rep: -15 }, log: loc("NTG는 5분 간격 3회까지만 투여합니다.","NTG: max 3 doses every 5 min.") }, { text: loc("호흡을 편하게 하기 위해 종이봉투를 입에 대고 심호흡을 시킨다","Have patient breathe into a paper bag"), effect: { hp: -20, rep: -10 }, log: loc("과호흡 증후군 처치법입니다. MI에는 산소 공급이 필요합니다.","That's for hyperventilation syndrome. MI needs O2.") }]) }; }
function generateNaegeleQuestion() { const m = rand(1, 12); const d = rand(1, 20); const eddMonth = m - 3 <= 0 ? m + 9 : m - 3; const eddDay = d + 7; const fmt = (mm, dd) => loc(`${mm}월 ${dd}일`, `${mm}/${dd}`); return { baseId: "naegele", categoryKey: "maternal", part: loc("임신","Pregnancy"), emoji: "📅", title: loc("분만예정일 계산","EDD Calculation"), desc: loc(`마지막 월경일(LMP)이 ${m}월 ${d}일인 임부의 분만예정일(EDD)은?`,`If LMP was ${m}/${d}, what is the EDD?`), choices: shuffle([{ text: fmt(eddMonth, eddDay), effect: { hp: -2, rep: 20 }, log: loc("정답. 네겔법(월 -3/+9, 일 +7) 계산입니다.","Correct. Naegele's rule (month -3/+9, day +7).") }, { text: fmt(eddMonth === 12 ? 1 : eddMonth + 1, eddDay), effect: { hp: -15, rep: -10 }, log: loc("월 계산 오류입니다.","Month calculation error.") }, { text: fmt(eddMonth, d - 7 > 0 ? d - 7 : d + 14), effect: { hp: -15, rep: -10 }, log: loc("일 계산 오류입니다.","Day calculation error.") }, { text: fmt(eddMonth === 1 ? 12 : eddMonth - 1, eddDay + 7), effect: { hp: -20, rep: -15 }, log: loc("계산 공식 적용 실패입니다.","Failed to apply the formula.") }]) }; }
function generateApgarQuestion() { return { baseId: "apgar", categoryKey: "pediatric", part: loc("신생아","Newborn"), emoji: "👶", title: loc("아프가 점수 계산","Apgar Score"), desc: loc("신생아가 심박동 100회 미만(1점), 호흡 느림(1점), 사지 약간 굽힘(1점), 자극에 찡그림(1점), 몸은 분홍 사지는 청색(1점). 총점은?","Newborn: HR <100 (1), slow respirations (1), some flexion (1), grimace (1), pink trunk/blue extremities (1). Total Apgar?"), choices: shuffle([{ text: loc("5점","5"), effect: { hp: -2, rep: 20 }, log: loc("정답. 1+1+1+1+1 = 5점입니다.","Correct. 1+1+1+1+1 = 5.") }, { text: loc("3점","3"), effect: { hp: -15, rep: -10 }, log: loc("계산 오류입니다.","Calculation error.") }, { text: loc("7점","7"), effect: { hp: -15, rep: -10 }, log: loc("계산 오류입니다.","Calculation error.") }, { text: loc("9점","9"), effect: { hp: -20, rep: -15 }, log: loc("정상 소견이 아닙니다.","Not a normal finding.") }]) }; }
function generateBurnQuestion() { return { baseId: "burn", categoryKey: "adult", part: loc("화상","Burns"), emoji: "🔥", title: loc("9의 법칙 화상 면적","Rule of Nines"), desc: loc(`몸통 앞면 전체(18%)와 오른쪽 다리 전체(18%)에 화상을 입었다. 총 체표면적은?`,`Burns over the entire anterior trunk (18%) and entire right leg (18%). Total %TBSA?`), choices: shuffle([{ text: "36%", effect: { hp: -2, rep: 20 }, log: loc("정답. 18 + 18 = 36% 입니다.","Correct. 18 + 18 = 36%.") }, { text: "27%", effect: { hp: -15, rep: -10 }, log: loc("비율 적용 오류입니다.","Misapplied percentages.") }, { text: "45%", effect: { hp: -15, rep: -10 }, log: loc("비율 적용 오류입니다.","Misapplied percentages.") }, { text: "18%", effect: { hp: -20, rep: -15 }, log: loc("한 부위만 계산했습니다.","Only counted one area.") }]) }; }
function generateShockQuestion() { return { baseId: "shock", categoryKey: "adult", part: loc("쇼크","Shock"), emoji: "😰", title: loc("쇼크 분류","Shock Classification"), desc: loc(`벌에 쏘이거나 페니실린 주사 후 두드러기와 심한 호흡곤란(천명음)이 발생하는 쇼크는?`,`Wheezing, hives, and respiratory distress after a bee sting or penicillin injection — what type of shock?`), choices: shuffle([{ text: loc("아나필락시스 쇼크","Anaphylactic shock"), effect: { hp: -2, rep: 20 }, log: loc("정답. 알레르기 반응에 의한 쇼크입니다.","Correct. Allergy-mediated shock.") }, { text: loc("저혈량성 쇼크","Hypovolemic shock"), effect: { hp: -15, rep: -10 }, log: loc("출혈 등에 의한 쇼크입니다.","Caused by bleeding/fluid loss.") }, { text: loc("심인성 쇼크","Cardiogenic shock"), effect: { hp: -15, rep: -10 }, log: loc("심근경색 등에 의한 심박출량 감소 쇼크입니다.","Reduced cardiac output (e.g., MI).") }, { text: loc("패혈성 쇼크","Septic shock"), effect: { hp: -15, rep: -10 }, log: loc("감염에 의한 쇼크입니다.","Infection-induced.") }]) }; }
function generateDiabeticQuestion() { return { baseId: "diabetic", categoryKey: "adult", part: loc("내분비계","Endocrine"), emoji: "🩸", title: loc("당뇨 응급상황","Diabetic Emergency"), desc: loc(`당뇨 환자가 식은땀, 빈맥, 손떨림을 호소하며 의식이 혼미해질 때 의심할 상황은?`,`Diabetic patient with diaphoresis, tachycardia, tremor, and clouded consciousness — suspect what?`), choices: shuffle([{ text: loc("저혈당증","Hypoglycemia"), effect: { hp: -2, rep: 20 }, log: loc("정답. 전형적인 저혈당 징후입니다.","Correct. Classic hypoglycemia signs.") }, { text: loc("당뇨병성 케톤산증(DKA)","Diabetic ketoacidosis (DKA)"), effect: { hp: -20, rep: -15 }, log: loc("고혈당 시 나타납니다(과일냄새 호흡 등).","Seen in hyperglycemia (fruity breath etc.).") }, { text: loc("아나필락시스 쇼크","Anaphylactic shock"), effect: { hp: -15, rep: -10 }, log: loc("알레르기 징후와 다릅니다.","Pattern differs from allergic reaction.") }, { text: loc("요붕증","Diabetes insipidus"), effect: { hp: -15, rep: -10 }, log: loc("다뇨와 갈증이 주증상입니다.","Polyuria and thirst predominate.") }]) }; }
function generateAsepticQuestion() { return { baseId: "aseptic", categoryKey: "fundamentals", part: loc("무균술","Aseptic Technique"), emoji: "🧤", title: loc("외과적 무균술","Surgical Asepsis"), desc: loc(`외과적 무균술 원칙 중 **틀린** 것은?`,`Which surgical asepsis principle is **incorrect**?`), choices: shuffle([{ text: loc("시야에서 벗어난 멸균 물품도 계속 멸균 상태로 간주한다.","A sterile item out of sight is still considered sterile."), effect: { hp: -2, rep: 20 }, log: loc("정답(틀린 설명). 시야를 벗어나면 오염으로 간주합니다.","Correct (this is wrong). Out of sight = considered contaminated.") }, { text: loc("멸균 물품이 습기나 물에 젖으면 오염으로 간주한다.","A wet sterile item is considered contaminated."), effect: { hp: -15, rep: -10 }, log: loc("올바른 원칙입니다.","Correct principle.") }, { text: loc("멸균포의 가장자리 2.5cm는 오염된 것으로 간주한다.","The 2.5 cm edge of a sterile drape is considered contaminated."), effect: { hp: -15, rep: -10 }, log: loc("올바른 원칙입니다.","Correct principle.") }, { text: loc("멸균 물품은 멸균된 물품과 접촉할 때만 멸균이 유지된다.","Sterile items remain sterile only when touching other sterile items."), effect: { hp: -15, rep: -10 }, log: loc("올바른 원칙입니다.","Correct principle.") }]) }; }

// ========= 추가 기출 변형 문제 생성기 =========
function generateCPRQuestion() { return { baseId: "cpr", category: "성인간호학", part: "응급/CPR", emoji: "💗", title: "성인 CPR 가슴압박", desc: `의식이 없고 호흡이 없는 성인 환자에게 시행하는 가슴압박 깊이와 속도로 옳은 것은?`, choices: shuffle([{ text: "약 5cm 깊이로 분당 100~120회 압박한다", effect: { hp: -3, rep: 22 }, log: "정답. 2020 가이드라인 기준 성인 CPR 표준입니다." }, { text: "약 2cm 깊이로 분당 60회 천천히 압박한다", effect: { hp: -25, rep: -15 }, log: "압박이 너무 얕고 느립니다." }, { text: "흉골 하단 갈비뼈 끝(검상돌기)을 정확히 압박한다", effect: { hp: -30, rep: -20 }, log: "검상돌기 압박은 간 손상을 유발합니다." }, { text: "압박과 인공호흡 비율을 5:1로 시행한다", effect: { hp: -20, rep: -10 }, log: "성인은 30:2가 표준입니다." }]) }; }
function generatePressureUlcerQuestion() { return { baseId: "pressureUlcer", category: "기본간호학", part: "욕창", emoji: "🛌", title: "욕창 예방 간호", desc: `장기간 와상 환자의 욕창 예방을 위한 가장 적절한 간호중재는?`, choices: shuffle([{ text: "최소 2시간마다 체위변경하고 뼈돌출부 압력을 분산한다", effect: { hp: -2, rep: 20 }, log: "정답. 압력 제거가 가장 핵심입니다." }, { text: "발적 부위를 알코올로 마사지하여 자극을 준다", effect: { hp: -25, rep: -15 }, log: "발적 부위 마사지는 조직 손상을 가속화합니다." }, { text: "엉덩이에 도넛 모양 쿠션을 적용한다", effect: { hp: -20, rep: -10 }, log: "도넛쿠션은 오히려 혈류를 차단합니다." }, { text: "피부가 건조하지 않도록 하루 4시간만 누워있게 한다", effect: { hp: -15, rep: -5 }, log: "체위변경 빈도가 부족합니다." }]) }; }
function generateInsulinQuestion() { const types = [{ name: "속효성(Regular)", onset: "30분", peak: "2-4시간", correct: true }, { name: "초속효성(Lispro)", onset: "15분", peak: "1시간", correct: false }, { name: "지속형(Glargine)", onset: "1시간", peak: "없음(지속)", correct: false }, { name: "중간형(NPH)", onset: "1-2시간", peak: "6-8시간", correct: false }]; const target = pick(types); return { baseId: "insulin", category: "성인간호학", part: "내분비", emoji: "💉", title: "인슐린 작용시간", desc: `${target.name} 인슐린의 작용 발현시간으로 가장 적절한 것은?`, choices: shuffle([{ text: target.onset, effect: { hp: -2, rep: 18 }, log: `정답. ${target.name}의 작용 발현시간입니다.` }, { text: types.filter(t => t !== target)[0].onset + " (다른 인슐린)", effect: { hp: -15, rep: -10 }, log: "인슐린 종류가 다릅니다." }, { text: "12시간 (모든 인슐린 동일)", effect: { hp: -20, rep: -15 }, log: "인슐린은 종류별 시간이 다릅니다." }, { text: "24시간 후 작용 시작", effect: { hp: -20, rep: -15 }, log: "이렇게 늦게 작용하는 인슐린은 없습니다." }]) }; }
function generateCOPDQuestion() { return { baseId: "copd", category: "성인간호학", part: "호흡기", emoji: "🌬️", title: "COPD 산소요법", desc: `만성폐쇄성폐질환(COPD) 환자에게 산소를 투여할 때 옳은 방법은?`, choices: shuffle([{ text: "Venturi mask로 1~3L/min 저농도 산소를 정확히 투여한다", effect: { hp: -3, rep: 22 }, log: "정답. CO2 정체 환자는 저농도 정확 투여가 핵심입니다." }, { text: "Non-rebreather mask로 10L/min 고농도 산소를 투여한다", effect: { hp: -35, rep: -25 }, log: "고농도 산소는 호흡중추를 억제하여 CO2 정체를 악화시킵니다." }, { text: "비강캐뉼라로 6L/min 이상 고유속을 투여한다", effect: { hp: -30, rep: -20 }, log: "비강캐뉼라 6L 이상은 점막 자극과 고농도 위험이 있습니다." }, { text: "수면 중에는 산소를 모두 차단한다", effect: { hp: -25, rep: -15 }, log: "야간 저산소증을 유발합니다." }]) }; }
function generateStrokeQuestion() { return { baseId: "stroke", category: "성인간호학", part: "신경계", emoji: "🧠", title: "급성 뇌졸중 초기간호", desc: `갑작스러운 편마비와 구음장애로 응급실에 내원한 환자에게 가장 우선되는 간호는?`, choices: shuffle([{ text: "증상 발생 시간을 확인하고 신속히 CT를 시행하도록 돕는다", effect: { hp: -2, rep: 22 }, log: "정답. tPA 적용을 위해 발생시각 확인과 영상검사가 최우선입니다." }, { text: "혈압이 높으므로 즉시 강하제로 적극 낮춘다", effect: { hp: -30, rep: -20 }, log: "허혈성 뇌졸중은 뇌관류를 위해 혈압을 함부로 낮추지 않습니다." }, { text: "구강으로 아스피린을 즉시 투여한다", effect: { hp: -25, rep: -15 }, log: "출혈성 뇌졸중일 수 있어 영상검사 전 금기입니다." }, { text: "재활을 위해 침상에서 적극적인 ROM 운동을 시작한다", effect: { hp: -20, rep: -10 }, log: "급성기에는 절대안정이 우선입니다." }]) }; }
function generateChemoQuestion() { return { baseId: "chemo", category: "성인간호학", part: "종양", emoji: "💊", title: "항암화학요법 부작용", desc: `항암제 투여 7~10일 후 가장 주의 깊게 관찰해야 할 부작용은?`, choices: shuffle([{ text: "골수억제로 인한 호중구 감소·감염 위험", effect: { hp: -3, rep: 20 }, log: "정답. 7~14일 nadir에 감염 위험이 가장 높습니다." }, { text: "탈모(주된 사망 원인)", effect: { hp: -25, rep: -15 }, log: "탈모는 흔하나 사망 원인이 아닙니다." }, { text: "혈당 상승으로 인한 케톤산증", effect: { hp: -20, rep: -10 }, log: "항암제의 주 부작용이 아닙니다." }, { text: "체중 증가와 식욕 폭증", effect: { hp: -25, rep: -15 }, log: "오심·구토와 식욕부진이 더 흔합니다." }]) }; }
function generateSuicideQuestion() { return { baseId: "suicide", category: "정신간호학", part: "자살위험", emoji: "🆘", title: "자살 위험 환자 간호", desc: `\"이제 다 끝내고 싶어요\"라고 말하며 우울감을 표현한 환자에 대한 우선 간호는?`, choices: shuffle([{ text: "직접적으로 자살 계획·방법이 있는지 사정한다", effect: { hp: -3, rep: 22 }, log: "정답. 직접적 사정이 자살을 부추기지 않으며 가장 중요합니다." }, { text: "주제를 돌려 즐거운 일을 떠올리게 한다", effect: { hp: -25, rep: -15 }, log: "감정을 외면하면 신뢰가 깨집니다." }, { text: "혼자 조용히 쉬도록 1인실로 옮기고 격리한다", effect: { hp: -40, rep: -25 }, log: "자살 위험 환자는 절대 혼자 두지 않습니다." }, { text: "\"그런 말씀 마세요\"라며 강하게 만류한다", effect: { hp: -20, rep: -15 }, log: "감정을 차단하는 비치료적 의사소통입니다." }]) }; }
function generateDepressionQuestion() { return { baseId: "depression", category: "정신간호학", part: "우울증", emoji: "💧", title: "우울증 환자 간호", desc: `심한 우울증 환자에게 가장 적절한 초기 간호중재는?`, choices: shuffle([{ text: "함께 있어주며 경청하고 단순하고 구체적인 활동을 격려한다", effect: { hp: -2, rep: 20 }, log: "정답. 신뢰 형성과 단순 활동이 핵심입니다." }, { text: "복잡하고 도전적인 그룹 활동에 참여시킨다", effect: { hp: -20, rep: -10 }, log: "우울 환자는 결정과 복잡한 과제에 무력감을 느낍니다." }, { text: "\"기운 내세요, 다 잘 될 거예요\"라고 격려한다", effect: { hp: -15, rep: -10 }, log: "공허한 위로는 비치료적입니다." }, { text: "환자 혼자 조용히 사색하도록 둔다", effect: { hp: -25, rep: -15 }, log: "고립은 자살 위험을 높입니다." }]) }; }
function generateDementiaQuestion() { return { baseId: "dementia", category: "정신간호학", part: "치매", emoji: "🧓", title: "치매 환자 의사소통", desc: `치매 환자와의 효과적인 의사소통 방법은?`, choices: shuffle([{ text: "짧고 단순한 문장으로 한 번에 한 가지씩 천천히 지시한다", effect: { hp: -2, rep: 20 }, log: "정답. 인지기능 저하에 맞춘 의사소통입니다." }, { text: "기억을 자극하기 위해 어려운 질문을 반복한다", effect: { hp: -25, rep: -15 }, log: "혼란과 좌절감을 증가시킵니다." }, { text: "환자가 잘못 말할 때마다 즉시 정정해 준다", effect: { hp: -20, rep: -10 }, log: "잦은 정정은 자존감 저하와 분노를 유발합니다." }, { text: "여러 사람이 동시에 다양한 주제로 대화한다", effect: { hp: -25, rep: -15 }, log: "자극이 과해 혼돈을 악화시킵니다." }]) }; }
function generateAlcoholWithdrawalQuestion() { return { baseId: "alcoholWithdrawal", category: "정신간호학", part: "물질관련", emoji: "🍷", title: "알코올 금단증상", desc: `금주 48~72시간 후 환각, 진전, 발작이 나타나는 응급상태(DTs) 환자에게 우선 투여하는 약물은?`, choices: shuffle([{ text: "벤조디아제핀계(Lorazepam, Diazepam)", effect: { hp: -3, rep: 22 }, log: "정답. 알코올 금단의 1차 선택약입니다." }, { text: "정신자극제(Methylphenidate)", effect: { hp: -25, rep: -20 }, log: "오히려 흥분을 가중시킵니다." }, { text: "진통제(Morphine)", effect: { hp: -25, rep: -15 }, log: "호흡 억제 위험이 있습니다." }, { text: "이뇨제(Furosemide)", effect: { hp: -20, rep: -10 }, log: "탈수를 유발해 더 위험합니다." }]) }; }
function generateBSEQuestion() { return { baseId: "bse", category: "모성간호학", part: "유방암", emoji: "🎗️", title: "유방 자가검진 시기", desc: `폐경 전 여성에게 권장되는 유방 자가검진(BSE)의 가장 적절한 시기는?`, choices: shuffle([{ text: "월경이 끝난 후 7~10일 사이", effect: { hp: -2, rep: 20 }, log: "정답. 호르몬 영향이 적어 가장 정확합니다." }, { text: "월경 시작 첫날", effect: { hp: -20, rep: -10 }, log: "유방 부종으로 정확도가 떨어집니다." }, { text: "월경 시작 직전 2~3일", effect: { hp: -20, rep: -10 }, log: "호르몬 영향으로 결절감이 증가합니다." }, { text: "배란일 당일", effect: { hp: -15, rep: -10 }, log: "주기 중간은 호르몬 변화가 큽니다." }]) }; }
function generatePIHQuestion() { return { baseId: "pih", category: "모성간호학", part: "임신성고혈압", emoji: "🤰", title: "전자간증 간호", desc: `임신 32주 산모가 혈압 160/110, 단백뇨, 두통, 시야 흐림을 호소한다. 가장 우선되는 간호는?`, choices: shuffle([{ text: "조용한 어두운 환경에서 좌측위로 안정시키고 자간증을 예방한다", effect: { hp: -3, rep: 22 }, log: "정답. 자극 최소화와 좌측위는 자간증 예방의 핵심입니다." }, { text: "수분을 다량 섭취시켜 단백뇨를 희석한다", effect: { hp: -25, rep: -15 }, log: "수분 과다는 폐부종 위험을 증가시킵니다." }, { text: "운동을 권장해 혈압을 내린다", effect: { hp: -30, rep: -20 }, log: "절대 안정이 필요한 상황입니다." }, { text: "MgSO4 투여 시 심부건반사가 항진된 상태를 유지한다", effect: { hp: -30, rep: -20 }, log: "심부건반사 소실은 마그네슘 중독 징후입니다." }]) }; }
function generateBreastfeedingQuestion() { return { baseId: "breastfeeding", category: "모성간호학", part: "모유수유", emoji: "🍼", title: "모유수유 교육", desc: `초산모에게 모유수유에 대해 옳게 교육한 내용은?`, choices: shuffle([{ text: "한쪽 유방을 충분히 비운 후 다른 쪽으로 바꿔 후유즙까지 먹인다", effect: { hp: -2, rep: 20 }, log: "정답. 후유즙은 지방이 많아 영아 성장에 중요합니다." }, { text: "수유 후 남은 모유는 짜내지 말고 그대로 둔다", effect: { hp: -20, rep: -10 }, log: "비우지 않으면 분비가 줄어듭니다." }, { text: "수유 시간은 정확히 4시간 간격을 지킨다", effect: { hp: -20, rep: -10 }, log: "모유수유는 자율수유(요구 시 수유)가 원칙입니다." }, { text: "유두 균열 시 비누로 깨끗이 자주 씻는다", effect: { hp: -25, rep: -15 }, log: "비누는 유두 건조와 균열을 악화시킵니다." }]) }; }
function generateDevelopmentQuestion() { const milestones = [{ age: "6개월", correct: "혼자 앉기 시작" }, { age: "12개월", correct: "혼자 걷기 시작" }, { age: "2세", correct: "두 단어 문장 사용" }, { age: "4세", correct: "한 발로 뛰기" }]; const target = pick(milestones); const wrongs = milestones.filter(m => m !== target).map(m => m.correct); return { baseId: "development", category: "아동간호학", part: "성장발달", emoji: "👶", title: "아동 발달이정표", desc: `${target.age} 영유아가 일반적으로 보일 수 있는 발달 단계는?`, choices: shuffle([{ text: target.correct, effect: { hp: -2, rep: 20 }, log: `정답. ${target.age}의 일반 발달 단계입니다.` }, { text: wrongs[0], effect: { hp: -20, rep: -10 }, log: "다른 시기의 발달입니다." }, { text: wrongs[1], effect: { hp: -20, rep: -10 }, log: "다른 시기의 발달입니다." }, { text: wrongs[2], effect: { hp: -20, rep: -10 }, log: "다른 시기의 발달입니다." }]) }; }
function generateCroupQuestion() { return { baseId: "croup", category: "아동간호학", part: "호흡기", emoji: "🐶", title: "크룹(후두기관기관지염)", desc: `밤사이 컹컹거리는 개 짖는 듯한 기침과 흡기성 천명음을 보이는 영아의 가장 효과적인 가정 간호는?`, choices: shuffle([{ text: "차가운 습한 공기 또는 따뜻한 욕실의 수증기에 노출시킨다", effect: { hp: -2, rep: 20 }, log: "정답. 차거나 습한 공기는 후두 부종을 감소시킵니다." }, { text: "기침억제제를 즉시 경구 투여한다", effect: { hp: -25, rep: -15 }, log: "기침억제제는 분비물 배출을 막아 위험합니다." }, { text: "건조한 더운 방에서 충분히 재운다", effect: { hp: -20, rep: -10 }, log: "건조한 공기는 증상을 악화시킵니다." }, { text: "찬물을 다량 마시게 한다", effect: { hp: -15, rep: -10 }, log: "흡인 위험이 있고 직접적 도움이 없습니다." }]) }; }
function generateKawasakiQuestion() { return { baseId: "kawasaki", category: "아동간호학", part: "심혈관", emoji: "👅", title: "가와사키병 간호", desc: `5일 이상의 고열, 딸기혀, 손발 부종이 나타난 아동의 가장 위험한 합병증은?`, choices: shuffle([{ text: "관상동맥류 형성", effect: { hp: -3, rep: 22 }, log: "정답. 관상동맥류가 가장 치명적인 합병증입니다." }, { text: "수두에 의한 폐렴", effect: { hp: -20, rep: -15 }, log: "수두와는 관련이 없습니다." }, { text: "선천성 심실중격결손", effect: { hp: -25, rep: -15 }, log: "선천성 기형이 아닌 후천성 혈관염입니다." }, { text: "백혈병으로의 진행", effect: { hp: -30, rep: -20 }, log: "혈액암과 관련이 없습니다." }]) }; }
function generateDelegationQuestion() { return { baseId: "delegation", category: "간호관리학", part: "위임", emoji: "📋", title: "업무 위임", desc: `간호조무사(NA)에게 위임할 수 있는 업무로 가장 적절한 것은?`, choices: shuffle([{ text: "안정된 환자의 활력징후 측정 및 경구섭취량 기록", effect: { hp: -2, rep: 18 }, log: "정답. 표준화·반복적 업무는 위임 가능합니다." }, { text: "신규 입원환자의 초기 간호 사정", effect: { hp: -25, rep: -15 }, log: "사정은 RN의 고유 업무입니다." }, { text: "환자 교육 및 퇴원교육 시행", effect: { hp: -20, rep: -10 }, log: "교육은 RN의 책임입니다." }, { text: "정맥주사 IV 약물 투여", effect: { hp: -30, rep: -20 }, log: "정맥 약물 투여는 위임할 수 없습니다." }]) }; }
function generateMedicalLawQuestion() { return { baseId: "medicalLaw", category: "보건의약관계법규", part: "의료법", emoji: "📜", title: "간호기록부 보존기간", desc: `의료법령에 따른 간호기록부의 법정 보존기간은?`, choices: shuffle([{ text: "5년", effect: { hp: -2, rep: 20 }, log: "정답. 간호기록부 보존기간은 5년입니다." }, { text: "2년", effect: { hp: -20, rep: -10 }, log: "처방전이 2년입니다." }, { text: "10년", effect: { hp: -20, rep: -10 }, log: "진료기록부와 수술기록부가 10년입니다." }, { text: "3년", effect: { hp: -20, rep: -10 }, log: "진단서·검안서 부본이 3년입니다." }]) }; }
function generateFamilyNursingQuestion() { return { baseId: "familyNursing", category: "지역사회간호학", part: "가족간호", emoji: "👨‍👩‍👧", title: "가족 사정 도구", desc: `가족 구성원 간의 외부 자원 및 지지체계를 시각적으로 표현하는 사정 도구는?`, choices: shuffle([{ text: "외부체계도(Eco-map)", effect: { hp: -2, rep: 20 }, log: "정답. 가족과 외부의 상호작용을 시각화합니다." }, { text: "가계도(Genogram)", effect: { hp: -15, rep: -10 }, log: "가족 구성원·질병력을 보여주는 3대 가계도입니다." }, { text: "가족연대기(Family chronology)", effect: { hp: -15, rep: -10 }, log: "가족의 주요 사건 시간순 정리입니다." }, { text: "사회지지도(Social support)", effect: { hp: -15, rep: -10 }, log: "구성원 개인의 지지망 도구입니다." }]) }; }
function generateSchoolHealthQuestion() { return { baseId: "schoolHealth", category: "지역사회간호학", part: "학교보건", emoji: "🏫", title: "학교 감염병 관리", desc: `학교에서 수두 환아가 발생했을 때 보건교사의 가장 적절한 우선 조치는?`, choices: shuffle([{ text: "학생을 즉시 등교중지(격리)시키고 보호자 및 교육청에 보고한다", effect: { hp: -2, rep: 22 }, log: "정답. 등교중지·보고가 학교 감염병 관리의 핵심입니다." }, { text: "학급 학생들에게 비밀을 유지하고 평소대로 진행한다", effect: { hp: -30, rep: -20 }, log: "감염 확산을 방치하는 위법행위입니다." }, { text: "환아를 격리하지 않고 양호실에서 관찰만 한다", effect: { hp: -25, rep: -15 }, log: "수두는 공기 전파로 즉시 등교중지가 필요합니다." }, { text: "학급 전체에 항생제를 예방 투여한다", effect: { hp: -30, rep: -20 }, log: "수두는 바이러스로 항생제가 무효합니다." }]) }; }
function generateIsolationQuestion() { const diseases = [{ name: "수두", correct: "공기주의 + 접촉주의" }, { name: "결핵", correct: "공기주의" }, { name: "백일해", correct: "비말주의" }, { name: "MRSA", correct: "접촉주의" }]; const target = pick(diseases); const wrongs = diseases.filter(d => d !== target).map(d => d.correct); return { baseId: "isolation", category: "기본간호학", part: "감염관리", emoji: "🦠", title: "격리 지침", desc: `${target.name} 환자에게 적용해야 할 격리 지침은?`, choices: shuffle([{ text: target.correct, effect: { hp: -2, rep: 20 }, log: `정답. ${target.name}의 표준 격리 지침입니다.` }, { text: wrongs[0], effect: { hp: -20, rep: -10 }, log: "다른 질환의 격리 지침입니다." }, { text: wrongs[1] || "표준주의만 적용", effect: { hp: -20, rep: -10 }, log: "전파 경로에 맞지 않는 격리입니다." }, { text: "역격리(보호격리)", effect: { hp: -25, rep: -15 }, log: "역격리는 면역저하 환자 보호용입니다." }]) }; }
function generatePainQuestion() { return { baseId: "pain", category: "기본간호학", part: "통증", emoji: "😣", title: "통증 사정", desc: `의식이 명료한 성인 환자의 통증 사정에서 가장 신뢰할 수 있는 자료는?`, choices: shuffle([{ text: "환자가 직접 진술하는 통증의 강도와 양상", effect: { hp: -2, rep: 20 }, log: "정답. 통증은 주관적 경험으로 본인 진술이 가장 신뢰성 높습니다." }, { text: "활력징후의 변화로 통증 정도를 객관적으로 판정한다", effect: { hp: -20, rep: -10 }, log: "활력징후는 보조 지표일 뿐입니다." }, { text: "보호자가 관찰한 환자의 표정과 행동", effect: { hp: -20, rep: -10 }, log: "본인 진술 우선이며 보조 지표입니다." }, { text: "이전 입원기록의 통증 점수", effect: { hp: -25, rep: -15 }, log: "현재 통증 사정에 부적절합니다." }]) }; }
function generateGCSQuestion() { return { baseId: "gcs", category: "성인간호학", part: "신경계", emoji: "👁️", title: "GCS 판정", desc: `환자가 통증자극에 눈을 뜨고(E2), 부적절한 단어로 신음(V3), 자극에 회피반응(M4)을 보인다. GCS 점수와 의미는?`, choices: shuffle([{ text: "9점, 중등도 의식장애", effect: { hp: -3, rep: 22 }, log: "정답. 2+3+4=9점이며 9~12점은 중등도입니다." }, { text: "15점, 정상", effect: { hp: -25, rep: -15 }, log: "15점은 모든 항목 만점입니다." }, { text: "5점, 혼수상태", effect: { hp: -25, rep: -15 }, log: "GCS 8점 이하가 혼수입니다." }, { text: "12점, 경증", effect: { hp: -20, rep: -10 }, log: "계산 오류입니다." }]) }; }
function generateRenalFailureQuestion() { return { baseId: "renalFailure", category: "성인간호학", part: "비뇨기", emoji: "🫘", title: "만성신부전 식이", desc: `만성신부전(투석 전) 환자에게 권장되는 식이로 옳은 것은?`, choices: shuffle([{ text: "저단백, 저칼륨, 저인 식이를 제공한다", effect: { hp: -2, rep: 22 }, log: "정답. 신장 부담을 줄이는 식이입니다." }, { text: "고단백, 고칼륨 식이로 영양을 보충한다", effect: { hp: -30, rep: -20 }, log: "단백질·칼륨 과다는 신장에 치명적입니다." }, { text: "수분을 무제한 섭취하여 노폐물을 배출한다", effect: { hp: -30, rep: -20 }, log: "수분 제한이 필요한 단계입니다." }, { text: "바나나·오렌지·감자 같은 과일채소를 충분히 먹는다", effect: { hp: -25, rep: -15 }, log: "고칼륨 식품으로 제한 대상입니다." }]) }; }
function generatePostOpQuestion() { return { baseId: "postop", category: "성인간호학", part: "수술간호", emoji: "🏨", title: "수술 후 합병증 예방", desc: `복부수술 후 무기폐와 폐렴을 예방하기 위한 가장 효과적인 간호중재는?`, choices: shuffle([{ text: "강화 폐활량계(IS) 사용과 심호흡·기침을 정기적으로 격려한다", effect: { hp: -2, rep: 20 }, log: "정답. 폐 확장 운동이 합병증 예방의 핵심입니다." }, { text: "통증으로 호흡을 자제하도록 권한다", effect: { hp: -30, rep: -20 }, log: "얕은 호흡은 무기폐를 유발합니다." }, { text: "절대안정으로 침상에서 움직이지 않게 한다", effect: { hp: -25, rep: -15 }, log: "조기 이상이 오히려 합병증을 줄입니다." }, { text: "산소포화도가 정상이면 기침을 금지시킨다", effect: { hp: -25, rep: -15 }, log: "분비물 배출을 위해 기침이 필요합니다." }]) }; }
function generateHeartFailureQuestion() { return { baseId: "heartFailure", category: "성인간호학", part: "심혈관", emoji: "💔", title: "심부전 환자 체위", desc: `급성 좌심부전으로 호흡곤란을 호소하는 환자에게 취해주어야 할 가장 적절한 체위는?`, choices: shuffle([{ text: "다리를 침상 아래로 내린 좌위(High Fowler's, 다리 하수)", effect: { hp: -2, rep: 22 }, log: "정답. 정맥귀환 감소로 폐울혈을 완화합니다." }, { text: "다리를 높이는 트렌델렌버그 체위", effect: { hp: -35, rep: -25 }, log: "정맥귀환 증가로 폐부종이 악화됩니다." }, { text: "엎드린 자세(복위)", effect: { hp: -30, rep: -20 }, log: "흉부 확장이 제한되어 호흡이 더 어려워집니다." }, { text: "왼쪽으로 누운 좌측위", effect: { hp: -20, rep: -10 }, log: "호흡곤란 환자에 권장되는 체위가 아닙니다." }]) }; }

// ========= 추가 기출 변형 2차 (대규모 확장) =========
function generateVitalSignQuestion() { return { baseId: "vitalSign", category: "기본간호학", part: "활력징후", emoji: "🌡️", title: "성인 활력징후 정상범위", desc: `다음 중 성인의 활력징후 정상 범위로 옳은 것은?`, choices: shuffle([{ text: "체온 36.5~37.2℃, 맥박 60~100회/분, 호흡 12~20회/분", effect: { hp: -2, rep: 18 }, log: "정답. 표준 정상 활력징후 범위입니다." }, { text: "체온 38.5℃, 맥박 50회/분, 호흡 25회/분", effect: { hp: -25, rep: -15 }, log: "발열·서맥·빈호흡으로 비정상입니다." }, { text: "체온 35℃, 맥박 110회/분, 호흡 8회/분", effect: { hp: -25, rep: -15 }, log: "저체온·빈맥·호흡억제 상태입니다." }, { text: "체온 37.5℃, 맥박 130회/분, 호흡 30회/분", effect: { hp: -25, rep: -15 }, log: "전반적으로 비정상 수치입니다." }]) }; }
function generateMedication5RQuestion() { return { baseId: "medication5R", category: "기본간호학", part: "투약", emoji: "💊", title: "투약의 5원칙", desc: `투약의 5원칙(5R)에 해당하지 않는 것은?`, choices: shuffle([{ text: "정확한 의사(Right Doctor)", effect: { hp: -2, rep: 18 }, log: "정답. 5원칙은 환자·약명·용량·경로·시간이며 의사는 포함되지 않습니다." }, { text: "정확한 환자(Right Patient)", effect: { hp: -15, rep: -10 }, log: "5R에 포함됩니다." }, { text: "정확한 용량(Right Dose)", effect: { hp: -15, rep: -10 }, log: "5R에 포함됩니다." }, { text: "정확한 경로(Right Route)", effect: { hp: -15, rep: -10 }, log: "5R에 포함됩니다." }]) }; }
function generateNGTubeQuestion() { return { baseId: "ngTube", category: "기본간호학", part: "비위관", emoji: "👃", title: "비위관(L-tube) 위치 확인", desc: `비위관 영양 시작 전 위치 확인을 위한 가장 신뢰할 수 있는 방법은?`, choices: shuffle([{ text: "흡인된 위 내용물의 pH 측정(pH 4 이하)", effect: { hp: -2, rep: 20 }, log: "정답. 위 내용물 pH 확인이 침상 옆 가장 신뢰성 높은 방법입니다." }, { text: "공기를 주입하며 청진하는 방법만으로 확인", effect: { hp: -25, rep: -15 }, log: "공기 청진법은 단독 사용이 권장되지 않습니다." }, { text: "환자가 말을 할 수 있으면 정상 위치이다", effect: { hp: -30, rep: -20 }, log: "기관 삽입 시에도 말이 가능할 수 있습니다." }, { text: "튜브 끝을 물에 넣어 기포가 안 나오면 위치가 옳다", effect: { hp: -35, rep: -25 }, log: "비과학적이며 흡인 위험을 놓칩니다." }]) }; }
function generateHandWashingQuestion() { return { baseId: "handWashing", category: "기본간호학", part: "감염관리", emoji: "🧼", title: "내과적 손 씻기", desc: `내과적 손씻기 시 가장 적절한 방법은?`, choices: shuffle([{ text: "손끝을 아래로 향하게 하고 흐르는 물에 비누로 30초 이상 씻는다", effect: { hp: -2, rep: 20 }, log: "정답. 오염원이 팔에서 손으로 흐르게 합니다." }, { text: "손끝을 팔꿈치보다 위로 올려 씻는다", effect: { hp: -25, rep: -15 }, log: "외과적 손씻기 방법입니다." }, { text: "물 절약을 위해 정지된 물에 담가 씻는다", effect: { hp: -25, rep: -15 }, log: "흐르는 물이 표준입니다." }, { text: "비누를 사용하지 않고 5초간 헹군다", effect: { hp: -30, rep: -20 }, log: "감염관리에 부적절합니다." }]) }; }
function generateOxygenDeliveryQuestion() { return { baseId: "oxygenDelivery", category: "기본간호학", part: "산소요법", emoji: "🫁", title: "산소공급 기구", desc: `100%에 가까운 고농도 산소를 공급해야 할 때 가장 적절한 기구는?`, choices: shuffle([{ text: "비재호흡 마스크(Non-rebreather mask)", effect: { hp: -2, rep: 20 }, log: "정답. 10~15L/min에서 60~100% 농도가 가능합니다." }, { text: "비강캐뉼라(Nasal cannula)", effect: { hp: -20, rep: -10 }, log: "최대 24~44%에 머무릅니다." }, { text: "단순 마스크(Simple mask)", effect: { hp: -20, rep: -10 }, log: "약 35~55% 정도 공급됩니다." }, { text: "Venturi mask 24%", effect: { hp: -25, rep: -15 }, log: "정확한 저농도 공급용입니다." }]) }; }
function generateThyroidStormQuestion() { return { baseId: "thyroidStorm", category: "성인간호학", part: "내분비", emoji: "🔥", title: "갑상선 위기(Storm)", desc: `갑상선기능항진증 환자에게서 고열, 빈맥, 의식저하가 갑자기 나타날 때 가장 우선 중재는?`, choices: shuffle([{ text: "냉각 요법과 PTU·베타차단제 투여를 준비한다", effect: { hp: -3, rep: 22 }, log: "정답. 갑상선 위기는 응급으로 즉시 냉각·약물 투여가 필요합니다." }, { text: "갑상선 호르몬을 추가 투여한다", effect: { hp: -50, rep: -40 }, log: "절대 금기. 위기를 악화시킵니다." }, { text: "전기담요로 보온한다", effect: { hp: -35, rep: -25 }, log: "고체온이므로 냉각이 필요합니다." }, { text: "수분 섭취를 제한한다", effect: { hp: -25, rep: -15 }, log: "탈수 보정과 수분 보충이 필요합니다." }]) }; }
function generateHypothyroidQuestion() { return { baseId: "hypothyroid", category: "성인간호학", part: "내분비", emoji: "❄️", title: "갑상선기능저하증 증상", desc: `갑상선기능저하증 환자에게서 가장 흔히 나타나는 증상은?`, choices: shuffle([{ text: "추위 못 견딤, 체중 증가, 서맥, 변비, 피로", effect: { hp: -2, rep: 20 }, log: "정답. 대사 저하로 인한 전형 증상입니다." }, { text: "더위 못 견딤, 체중 감소, 빈맥, 설사", effect: { hp: -20, rep: -15 }, log: "갑상선기능항진증 증상입니다." }, { text: "다음·다뇨·다식과 체중 감소", effect: { hp: -20, rep: -10 }, log: "당뇨병 증상입니다." }, { text: "두통과 야간 발한, 안구돌출", effect: { hp: -25, rep: -15 }, log: "안구돌출은 항진증의 특징입니다." }]) }; }
function generateGlaucomaQuestion() { return { baseId: "glaucoma", category: "성인간호학", part: "감각기", emoji: "👁️", title: "녹내장 환자 교육", desc: `녹내장 환자에게 가장 중요한 교육 내용은?`, choices: shuffle([{ text: "처방된 안압하강제(축동제)를 평생 정확히 점안한다", effect: { hp: -2, rep: 20 }, log: "정답. 안압 조절이 시신경 보호의 핵심입니다." }, { text: "산동제를 자주 사용하여 동공을 크게 유지한다", effect: { hp: -35, rep: -25 }, log: "산동은 안방수 흐름을 막아 절대 금기입니다." }, { text: "어두운 영화관에서 장시간 영화를 자주 본다", effect: { hp: -25, rep: -15 }, log: "어두운 환경은 동공이 커져 안압을 올립니다." }, { text: "수분을 한 번에 많이 마셔 안압을 낮춘다", effect: { hp: -25, rep: -15 }, log: "급격한 수분 섭취는 안압을 올립니다." }]) }; }
function generateCataractQuestion() { return { baseId: "cataract", category: "성인간호학", part: "감각기", emoji: "👓", title: "백내장 수술 후 간호", desc: `백내장 수술 후 환자에게 가장 적절한 교육 내용은?`, choices: shuffle([{ text: "무거운 물건 들기, 머리 숙이기, 기침을 피한다", effect: { hp: -2, rep: 20 }, log: "정답. 안압 상승을 유발하는 활동을 피해야 합니다." }, { text: "조속한 회복을 위해 곧바로 윗몸일으키기를 한다", effect: { hp: -30, rep: -20 }, log: "안압을 급격히 올리는 행위는 절대 금기입니다." }, { text: "가려우면 손으로 비빈다", effect: { hp: -30, rep: -20 }, log: "감염 및 봉합부 손상의 위험이 큽니다." }, { text: "수술 부위를 위로 가게 옆으로 누워 잔다", effect: { hp: -20, rep: -10 }, log: "수술한 쪽이 위로 오게 누워야 압력을 피합니다(반대로 적힘)." }]) }; }
function generateFractureQuestion() { return { baseId: "fracture", category: "성인간호학", part: "근골격계", emoji: "🦴", title: "석고붕대 후 합병증", desc: `장하지 석고붕대 적용 환자에게서 가장 우선 사정해야 할 5P 신경혈관 증상은?`, choices: shuffle([{ text: "통증·창백·맥박소실·마비·감각이상", effect: { hp: -3, rep: 22 }, log: "정답. 구획증후군의 5P 증상입니다." }, { text: "발열·발한·기침·오심·구토", effect: { hp: -25, rep: -15 }, log: "신경혈관 사정과 무관합니다." }, { text: "두통·시야흐림·이명·어지럼", effect: { hp: -25, rep: -15 }, log: "신경혈관 사정과 무관합니다." }, { text: "복부팽만·변비·식욕부진", effect: { hp: -25, rep: -15 }, log: "위장관 증상입니다." }]) }; }
function generateSpinalCordQuestion() { return { baseId: "spinalCord", category: "성인간호학", part: "신경계", emoji: "🦽", title: "척추손상 환자 이동", desc: `경추손상이 의심되는 외상 환자를 이동시킬 때 가장 중요한 원칙은?`, choices: shuffle([{ text: "통나무 굴리기(log roll)로 척추를 일직선 유지하며 이동한다", effect: { hp: -2, rep: 22 }, log: "정답. 척추 정렬 유지가 추가 손상 예방의 핵심입니다." }, { text: "환자가 아프지 않은 자세를 스스로 취하게 둔다", effect: { hp: -40, rep: -30 }, log: "척추 추가 손상의 위험이 큽니다." }, { text: "허리를 굽혀 부드럽게 안아 옮긴다", effect: { hp: -40, rep: -30 }, log: "척추 굴곡은 절대 금기입니다." }, { text: "한 명이 머리만 들고 다른 한 명이 다리를 든다", effect: { hp: -35, rep: -25 }, log: "척추 정렬이 흐트러집니다." }]) }; }
function generatePEQuestion() { return { baseId: "pe", category: "성인간호학", part: "호흡기", emoji: "🫁", title: "폐색전증(PE)", desc: `장기간 침상 안정 후 갑작스러운 흉통, 호흡곤란, 빈맥을 호소하는 환자에게 의심되는 진단은?`, choices: shuffle([{ text: "폐색전증(PE)", effect: { hp: -3, rep: 22 }, log: "정답. 부동에 의한 심부정맥혈전이 폐로 색전된 상태입니다." }, { text: "단순 과호흡 증후군", effect: { hp: -30, rep: -20 }, log: "급박한 응급상황을 놓칩니다." }, { text: "위식도역류 질환", effect: { hp: -30, rep: -20 }, log: "흉통의 응급 원인이 아닙니다." }, { text: "긴장성 두통", effect: { hp: -30, rep: -20 }, log: "호흡곤란과 무관합니다." }]) }; }
function generatePepticUlcerQuestion() { return { baseId: "pepticUlcer", category: "성인간호학", part: "소화기", emoji: "🍽️", title: "소화성궤양 식이", desc: `소화성궤양 환자에게 권장되는 식이 교육으로 옳은 것은?`, choices: shuffle([{ text: "규칙적인 시간에 소량씩 자주 식사하고 자극적 음식·카페인을 피한다", effect: { hp: -2, rep: 20 }, log: "정답. 위산 분비 자극을 줄이는 식이 원칙입니다." }, { text: "공복 통증 시 진한 커피를 마신다", effect: { hp: -30, rep: -20 }, log: "카페인은 위산 분비를 촉진합니다." }, { text: "취침 직전 우유를 마시면 좋다", effect: { hp: -25, rep: -15 }, log: "야간 위산 분비를 자극합니다." }, { text: "통증이 줄면 약을 임의로 중단해도 된다", effect: { hp: -30, rep: -20 }, log: "재발과 출혈 위험이 큽니다." }]) }; }
function generatePancreatitisQuestion() { return { baseId: "pancreatitis", category: "성인간호학", part: "소화기", emoji: "🥩", title: "급성 췌장염 간호", desc: `급성 췌장염 환자에게 가장 중요한 초기 간호중재는?`, choices: shuffle([{ text: "금식(NPO)과 비위관 흡인으로 췌장 휴식을 유도한다", effect: { hp: -2, rep: 22 }, log: "정답. 췌장 자극을 줄이는 것이 핵심입니다." }, { text: "고지방 고단백 식이를 충분히 제공한다", effect: { hp: -35, rep: -25 }, log: "췌장 분비를 자극해 악화시킵니다." }, { text: "통증 시 모르핀(Morphine)을 우선 선택한다", effect: { hp: -25, rep: -15 }, log: "Oddi 괄약근을 수축시켜 권장되지 않습니다(메페리딘 선호)." }, { text: "복부 마사지로 통증을 완화시킨다", effect: { hp: -30, rep: -20 }, log: "복부 조작은 금기입니다." }]) }; }
function generateAppendicitisQuestion() { return { baseId: "appendicitis", category: "성인간호학", part: "소화기", emoji: "🤕", title: "충수염 의심 환자", desc: `우하복부 통증, 발열, McBurney 압통이 있는 환자에게 절대 하지 말아야 할 것은?`, choices: shuffle([{ text: "복부 따뜻한 찜질팩과 관장을 시행한다", effect: { hp: -3, rep: 22 }, log: "정답(이것이 금기). 따뜻한 자극과 관장은 천공을 유발합니다." }, { text: "금식 시키고 활력징후를 자주 측정한다", effect: { hp: -15, rep: -10 }, log: "올바른 간호입니다." }, { text: "수액을 투여하고 수술 준비를 돕는다", effect: { hp: -15, rep: -10 }, log: "올바른 간호입니다." }, { text: "압통 부위에 차가운 얼음팩을 적용한다", effect: { hp: -15, rep: -10 }, log: "차가운 자극은 비교적 안전합니다." }]) }; }
function generateAnemiaQuestion() { return { baseId: "anemia", category: "성인간호학", part: "혈액", emoji: "🩸", title: "철결핍성 빈혈 식이", desc: `철결핍성 빈혈 환자의 철분 흡수를 가장 잘 돕는 음식 조합은?`, choices: shuffle([{ text: "붉은 살코기와 비타민C가 풍부한 오렌지 주스", effect: { hp: -2, rep: 20 }, log: "정답. 비타민C는 철 흡수를 돕습니다." }, { text: "철분제와 우유를 함께 복용", effect: { hp: -25, rep: -15 }, log: "칼슘은 철 흡수를 방해합니다." }, { text: "철분제와 진한 차 또는 커피", effect: { hp: -25, rep: -15 }, log: "탄닌은 철 흡수를 억제합니다." }, { text: "제산제와 함께 복용한다", effect: { hp: -25, rep: -15 }, log: "위산 저하로 흡수가 감소합니다." }]) }; }
function generateLiverCirrhosisQuestion() { return { baseId: "liverCirrhosis", category: "성인간호학", part: "소화기", emoji: "🟡", title: "간경화 합병증", desc: `간경화 말기 환자에게 의식 변화와 손떨림(asterixis)이 나타날 때 가장 의심되는 합병증은?`, choices: shuffle([{ text: "간성 혼수(간성 뇌증)", effect: { hp: -3, rep: 22 }, log: "정답. 암모니아 축적에 의한 의식 변화입니다." }, { text: "간성 빈혈", effect: { hp: -25, rep: -15 }, log: "의식 변화의 주된 원인이 아닙니다." }, { text: "단순 저혈당", effect: { hp: -25, rep: -15 }, log: "asterixis가 나타나지 않습니다." }, { text: "탈수성 어지럼", effect: { hp: -25, rep: -15 }, log: "특징적 임상양상이 다릅니다." }]) }; }
function generateEctopicQuestion() { return { baseId: "ectopic", category: "모성간호학", part: "임신합병증", emoji: "🚑", title: "자궁외임신", desc: `임신 8주 산모가 갑작스러운 일측 하복부 통증과 어깨 방사통, 저혈압을 호소한다. 의심되는 상태는?`, choices: shuffle([{ text: "자궁외임신 파열", effect: { hp: -3, rep: 22 }, log: "정답. 응급수술이 필요한 출혈성 응급상황입니다." }, { text: "정상 입덧(임신오조)", effect: { hp: -35, rep: -25 }, log: "응급상황을 놓칩니다." }, { text: "단순 변비", effect: { hp: -35, rep: -25 }, log: "어깨 방사통과 저혈압을 설명할 수 없습니다." }, { text: "정상 분만진통의 시작", effect: { hp: -35, rep: -25 }, log: "8주에 분만진통은 부적절합니다." }]) }; }
function generatePlacentaPreviaQuestion() { return { baseId: "placentaPrevia", category: "모성간호학", part: "임신합병증", emoji: "🤰", title: "전치태반", desc: `임신 후기에 통증 없이 선홍색 질출혈이 갑자기 발생한 산모에게 절대 금기인 행위는?`, choices: shuffle([{ text: "내진(질식 진찰)", effect: { hp: -3, rep: 22 }, log: "정답. 전치태반 의심 시 내진은 출혈을 악화시켜 금기입니다." }, { text: "초음파로 태반 위치를 확인한다", effect: { hp: -15, rep: -10 }, log: "올바른 진단법입니다." }, { text: "절대안정과 활력징후 모니터링", effect: { hp: -15, rep: -10 }, log: "올바른 간호입니다." }, { text: "정맥로 확보 및 수액 공급", effect: { hp: -15, rep: -10 }, log: "올바른 응급간호입니다." }]) }; }
function generateAbruptionQuestion() { return { baseId: "abruption", category: "모성간호학", part: "임신합병증", emoji: "🩸", title: "태반조기박리", desc: `임신 후기 산모가 \"판자처럼 단단한 자궁\"과 검붉은 출혈, 심한 복통을 호소한다. 우선 중재는?`, choices: shuffle([{ text: "측위로 안정시키고 산소를 공급하며 응급 제왕절개를 준비한다", effect: { hp: -3, rep: 22 }, log: "정답. 태반조기박리는 산모·태아 모두 응급입니다." }, { text: "유도분만으로 자연분만을 시도한다", effect: { hp: -35, rep: -25 }, log: "자연분만 시도 중 사망 위험이 큽니다." }, { text: "수축을 늦추기 위해 자궁수축억제제를 투여한다", effect: { hp: -30, rep: -20 }, log: "박리에는 적용되지 않습니다." }, { text: "출혈량이 적어 경과만 관찰한다", effect: { hp: -40, rep: -30 }, log: "내부 출혈이 클 수 있어 위험합니다." }]) }; }
function generateNeonatalJaundiceQuestion() { return { baseId: "neonatalJaundice", category: "아동간호학", part: "신생아", emoji: "👶", title: "광선치료(Phototherapy)", desc: `생리적 황달로 광선치료를 받는 신생아의 간호로 옳은 것은?`, choices: shuffle([{ text: "안대를 적용하고 기저귀만 채운 채 수시로 체위 변경한다", effect: { hp: -2, rep: 22 }, log: "정답. 망막 보호와 전신 노출이 모두 필요합니다." }, { text: "보온을 위해 옷을 두껍게 입힌다", effect: { hp: -30, rep: -20 }, log: "노출이 광선치료의 핵심입니다." }, { text: "오일이나 로션을 충분히 발라준다", effect: { hp: -25, rep: -15 }, log: "오일·로션은 화상 위험을 증가시킵니다." }, { text: "수분 섭취를 줄여 체온 손실을 막는다", effect: { hp: -30, rep: -20 }, log: "광선치료 중 수분 손실이 늘어 보충이 필요합니다." }]) }; }
function generateRHIncompatibilityQuestion() { return { baseId: "rh", category: "모성간호학", part: "혈액형부적합", emoji: "🧬", title: "Rh 부적합 예방", desc: `Rh(-) 산모가 Rh(+) 신생아를 출산했을 때 RhoGAM 투여 시기로 옳은 것은?`, choices: shuffle([{ text: "분만 후 72시간 이내", effect: { hp: -2, rep: 22 }, log: "정답. 다음 임신 감작을 예방하는 표준 시점입니다." }, { text: "분만 후 1개월 이후", effect: { hp: -25, rep: -15 }, log: "예방 효과가 사라집니다." }, { text: "임신 사실 확인 즉시 1회만 투여", effect: { hp: -20, rep: -10 }, log: "통상 28주와 분만 후 두 번 투여합니다." }, { text: "신생아에게 직접 투여한다", effect: { hp: -30, rep: -20 }, log: "RhoGAM은 산모용입니다." }]) }; }
function generateInfantNutritionQuestion() { return { baseId: "infantNutrition", category: "아동간호학", part: "영양", emoji: "🥕", title: "이유식 시작 시기", desc: `영아의 이유식을 시작하는 가장 적절한 시기는?`, choices: shuffle([{ text: "생후 약 4~6개월(목 가눔, 혀 내밀기 반사 소실)", effect: { hp: -2, rep: 20 }, log: "정답. WHO와 국내 권장 시점입니다." }, { text: "생후 1개월부터 곡류 미음을 먹인다", effect: { hp: -30, rep: -20 }, log: "장 미성숙으로 알레르기 위험이 큽니다." }, { text: "생후 12개월 이후 시작한다", effect: { hp: -20, rep: -10 }, log: "철분 결핍과 발달 지연 위험이 있습니다." }, { text: "출생 직후부터 분유와 함께 시작한다", effect: { hp: -35, rep: -25 }, log: "신생아에게는 절대 금기입니다." }]) }; }
function generateAsthmaQuestion() { return { baseId: "asthma", category: "아동간호학", part: "호흡기", emoji: "💨", title: "소아 천식 발작", desc: `학령기 아동이 갑작스러운 호기성 천명음과 호흡곤란을 호소할 때 가장 우선되는 중재는?`, choices: shuffle([{ text: "처방된 속효성 베타작용제(Salbutamol) 흡입을 시행한다", effect: { hp: -3, rep: 22 }, log: "정답. 급성 발작의 1차 약물입니다." }, { text: "흡입 스테로이드를 단독으로 즉시 흡입시킨다", effect: { hp: -25, rep: -15 }, log: "흡입 스테로이드는 예방용입니다." }, { text: "기관지를 식히기 위해 차가운 공기를 마시게 한다", effect: { hp: -30, rep: -20 }, log: "찬 공기는 기관지 수축을 악화시킵니다." }, { text: "복부에 압박을 가해 호흡을 도와준다", effect: { hp: -35, rep: -25 }, log: "호흡 보조에 부적절합니다." }]) }; }
function generateOtitisMediaQuestion() { return { baseId: "otitisMedia", category: "아동간호학", part: "감각기", emoji: "👂", title: "급성 중이염 환아", desc: `급성 중이염 환아의 부모에게 제공하는 가장 적절한 교육은?`, choices: shuffle([{ text: "수유 시 머리를 세워 안고 먹이고 누운 채로 젖병을 물리지 않는다", effect: { hp: -2, rep: 20 }, log: "정답. 누운 자세 수유는 유스타키오관 역류로 중이염을 악화시킵니다." }, { text: "통증이 멈추면 항생제를 즉시 끊는다", effect: { hp: -30, rep: -20 }, log: "처방 기간 끝까지 복용해야 합니다." }, { text: "면봉으로 외이도를 수시로 깊이 청소한다", effect: { hp: -25, rep: -15 }, log: "고막 손상 위험이 있습니다." }, { text: "유아용 풀에서 자주 수영시킨다", effect: { hp: -25, rep: -15 }, log: "수영은 회복 후 권장합니다." }]) }; }
function generateSchizophreniaQuestion() { return { baseId: "schizophrenia", category: "정신간호학", part: "조현병", emoji: "🧠", title: "조현병 양성·음성 증상", desc: `조현병의 음성 증상에 해당하는 것은?`, choices: shuffle([{ text: "감정의 둔마, 무논리증, 무쾌감증", effect: { hp: -2, rep: 22 }, log: "정답. 정상 기능의 결핍이 음성 증상입니다." }, { text: "환각, 망상, 와해된 언어", effect: { hp: -20, rep: -10 }, log: "양성 증상에 해당합니다." }, { text: "강박행동과 의식적 손씻기", effect: { hp: -25, rep: -15 }, log: "강박장애의 특징입니다." }, { text: "공황발작과 과호흡", effect: { hp: -25, rep: -15 }, log: "공황장애의 특징입니다." }]) }; }
function generateBipolarQuestion() { return { baseId: "bipolar", category: "정신간호학", part: "기분장애", emoji: "🎢", title: "조증 환자 간호", desc: `조증 삽화 중인 환자에게 가장 적절한 간호중재는?`, choices: shuffle([{ text: "자극이 적은 단순한 환경을 제공하고 짧고 단순한 활동을 권한다", effect: { hp: -2, rep: 22 }, log: "정답. 자극 감소가 흥분 조절의 핵심입니다." }, { text: "단체 게임과 집단치료에 적극 참여시킨다", effect: { hp: -25, rep: -15 }, log: "자극이 과다해 흥분이 악화됩니다." }, { text: "환자의 결정권 강화를 위해 모든 일과를 환자가 정하게 한다", effect: { hp: -25, rep: -15 }, log: "조절 안 된 환자에게 부적절합니다." }, { text: "고열량의 격식 있는 식사를 식탁에서 천천히 먹게 한다", effect: { hp: -20, rep: -10 }, log: "조증 환자는 자리에 앉아있기 어려워 휴대 가능한 고열량 음식이 권장됩니다." }]) }; }
function generateOCDQuestion() { return { baseId: "ocd", category: "정신간호학", part: "강박장애", emoji: "🔁", title: "강박장애 환자 간호", desc: `손씻기를 반복적으로 시행하는 강박장애 환자에 대한 초기 간호로 가장 적절한 것은?`, choices: shuffle([{ text: "강박행동을 갑자기 막지 말고 시간을 두고 점진적으로 줄여간다", effect: { hp: -2, rep: 22 }, log: "정답. 갑작스러운 차단은 불안을 폭증시킵니다." }, { text: "환자에게 즉시 강박행동을 멈추라고 단호히 지시한다", effect: { hp: -25, rep: -15 }, log: "불안을 가중시켜 비치료적입니다." }, { text: "강박행동을 못하도록 손을 신체보호대로 묶는다", effect: { hp: -40, rep: -30 }, log: "심각한 인권 침해이며 불안을 폭증시킵니다." }, { text: "행동의 비합리성을 끊임없이 논리로 설득한다", effect: { hp: -25, rep: -15 }, log: "비치료적 의사소통입니다." }]) }; }
function generatePTSDQuestion() { return { baseId: "ptsd", category: "정신간호학", part: "외상후스트레스", emoji: "💥", title: "PTSD 환자 간호", desc: `외상사건 후 플래시백과 회피 행동을 보이는 환자에 대한 간호로 옳은 것은?`, choices: shuffle([{ text: "안전한 환경을 제공하고 환자가 준비될 때 천천히 사건을 표현하도록 돕는다", effect: { hp: -2, rep: 22 }, log: "정답. 안전감 확보 후 점진적 노출이 원칙입니다." }, { text: "사건을 완전히 잊도록 절대 언급하지 않게 한다", effect: { hp: -25, rep: -15 }, log: "회피 강화는 치료를 방해합니다." }, { text: "동일한 외상사건 영상을 반복 시청하게 강제한다", effect: { hp: -40, rep: -30 }, log: "강제 노출은 재외상화의 위험이 큽니다." }, { text: "수면제만으로 모든 증상을 해결한다", effect: { hp: -25, rep: -15 }, log: "약물만으로 부족하며 심리치료가 필요합니다." }]) }; }
function generateECTQuestion() { return { baseId: "ect", category: "정신간호학", part: "치료", emoji: "⚡", title: "전기경련요법(ECT)", desc: `ECT 시술 후 환자에게서 흔히 나타나는 부작용으로 옳은 것은?`, choices: shuffle([{ text: "일시적 기억상실과 두통", effect: { hp: -2, rep: 20 }, log: "정답. 가장 흔하며 대부분 회복됩니다." }, { text: "영구적 인격 변화", effect: { hp: -25, rep: -15 }, log: "근거 없는 통념입니다." }, { text: "체중의 급격한 증가", effect: { hp: -20, rep: -10 }, log: "ECT의 주된 부작용이 아닙니다." }, { text: "모든 환자에게 발생하는 영구 마비", effect: { hp: -30, rep: -20 }, log: "근육이완제로 마비는 일시적이고 영구적이지 않습니다." }]) }; }
function generatePreventionLevelQuestion() { return { baseId: "preventionLevel", category: "지역사회간호학", part: "예방수준", emoji: "🛡️", title: "예방의 단계", desc: `이미 발병한 결핵 환자에게 약물 치료를 시행하여 합병증과 후유증을 예방하는 것은 어느 단계 예방인가?`, choices: shuffle([{ text: "2차 예방(조기 진단·조기 치료)", effect: { hp: -2, rep: 20 }, log: "정답. 발병 후 진단·치료를 통한 합병증 예방은 2차입니다." }, { text: "1차 예방", effect: { hp: -20, rep: -10 }, log: "1차는 발병 전 건강증진·예방접종입니다." }, { text: "3차 예방", effect: { hp: -20, rep: -10 }, log: "3차는 후유증 회복·재활입니다." }, { text: "0차 예방", effect: { hp: -25, rep: -15 }, log: "표준 분류 단계가 아닙니다." }]) }; }
function generateEpidemiologyQuestion() { return { baseId: "epi", category: "지역사회간호학", part: "역학", emoji: "📊", title: "역학 지표", desc: `일정 기간 새로 발생한 환자 수를 인구로 나눈 지표는?`, choices: shuffle([{ text: "발생률(Incidence rate)", effect: { hp: -2, rep: 20 }, log: "정답. 신규 발생을 측정합니다." }, { text: "유병률(Prevalence)", effect: { hp: -20, rep: -10 }, log: "특정 시점 전체 환자 수입니다." }, { text: "치명률(Case-fatality)", effect: { hp: -20, rep: -10 }, log: "환자 중 사망자 비율입니다." }, { text: "이환률(Morbidity)의 누적 점유", effect: { hp: -20, rep: -10 }, log: "정의가 다른 개념입니다." }]) }; }
function generateLeadershipQuestion() { return { baseId: "leadership", category: "간호관리학", part: "리더십", emoji: "🎯", title: "민주적 리더십", desc: `구성원의 의견을 적극 수렴하여 의사결정에 반영하는 리더십 유형은?`, choices: shuffle([{ text: "민주형 리더십(Democratic)", effect: { hp: -2, rep: 20 }, log: "정답. 참여와 합의를 강조합니다." }, { text: "권위형 리더십(Authoritarian)", effect: { hp: -20, rep: -10 }, log: "리더가 단독 결정합니다." }, { text: "자유방임형(Laissez-faire)", effect: { hp: -20, rep: -10 }, log: "리더가 거의 개입하지 않습니다." }, { text: "거래적 리더십(Transactional)", effect: { hp: -20, rep: -10 }, log: "보상·처벌 중심입니다." }]) }; }
function generateConflictQuestion() { return { baseId: "conflict", category: "간호관리학", part: "갈등관리", emoji: "🤝", title: "갈등 해결 전략", desc: `간호사 간 의견 대립이 심할 때 양측의 관심사를 모두 충족시키는 가장 바람직한 갈등해결 방식은?`, choices: shuffle([{ text: "협력(Collaboration) - Win-Win 전략", effect: { hp: -2, rep: 22 }, log: "정답. 양측 모두 만족하는 해결책을 모색합니다." }, { text: "회피(Avoidance) - 무시하기", effect: { hp: -25, rep: -15 }, log: "단기적이며 갈등이 잠복합니다." }, { text: "강요(Forcing) - 권력 사용", effect: { hp: -25, rep: -15 }, log: "한쪽만 만족하여 관계가 손상됩니다." }, { text: "수용(Accommodating) - 무조건 양보", effect: { hp: -20, rep: -10 }, log: "장기적으로 부정적 감정이 누적됩니다." }]) }; }
function generateNursingDeliveryQuestion() { return { baseId: "nursingDelivery", category: "간호관리학", part: "간호전달체계", emoji: "🏥", title: "간호전달체계", desc: `한 명의 간호사가 입원부터 퇴원까지 환자의 24시간 간호를 책임지고 계획하는 방식은?`, choices: shuffle([{ text: "일차 간호(Primary nursing)", effect: { hp: -2, rep: 20 }, log: "정답. 한 명의 RN이 전 과정을 책임집니다." }, { text: "팀 간호(Team nursing)", effect: { hp: -20, rep: -10 }, log: "팀 리더 중심의 분업입니다." }, { text: "기능적 간호(Functional)", effect: { hp: -20, rep: -10 }, log: "업무별 분담으로 효율 위주입니다." }, { text: "사례 관리(Case management)", effect: { hp: -20, rep: -10 }, log: "여러 환자의 비용·결과 관리가 중심입니다." }]) }; }
function generateMaternalLawQuestion() { return { baseId: "maternalLaw", category: "보건의약관계법규", part: "모자보건법", emoji: "👶", title: "영유아 정의", desc: `모자보건법상 \"영유아\"의 법적 정의는?`, choices: shuffle([{ text: "출생 후 6세 미만의 사람", effect: { hp: -2, rep: 20 }, log: "정답. 모자보건법상 영유아는 6세 미만입니다." }, { text: "출생 후 12세 미만의 사람", effect: { hp: -20, rep: -10 }, log: "다른 법령의 아동 정의입니다." }, { text: "출생 후 1세 미만의 사람", effect: { hp: -20, rep: -10 }, log: "이는 영아의 좁은 정의입니다." }, { text: "임신 24주 이상의 태아", effect: { hp: -25, rep: -15 }, log: "영유아 정의에 해당하지 않습니다." }]) }; }
function generateMentalHealthLawQuestion() { return { baseId: "mentalHealthLaw", category: "보건의약관계법규", part: "정신건강복지법", emoji: "🏥", title: "정신과 입원 유형", desc: `자해·타해 위험이 큰 환자를 보호의무자 동의 없이 시·도지사 권한으로 입원시키는 유형은?`, choices: shuffle([{ text: "행정입원", effect: { hp: -3, rep: 22 }, log: "정답. 시·도지사가 행하는 응급조치 입원입니다." }, { text: "자의입원", effect: { hp: -25, rep: -15 }, log: "본인 동의 입원입니다." }, { text: "보호입원", effect: { hp: -20, rep: -10 }, log: "보호의무자 동의 입원입니다." }, { text: "동의입원", effect: { hp: -20, rep: -10 }, log: "본인+보호의무자 동의 입원입니다." }]) }; }
function generateEmergencyLawQuestion() { return { baseId: "emergencyLaw", category: "보건의약관계법규", part: "응급의료법", emoji: "🚑", title: "선의의 응급처치", desc: `응급의료법상 일반인의 선의의 응급처치(GoodSamaritan)에 대한 법적 효과는?`, choices: shuffle([{ text: "고의 또는 중대한 과실이 없으면 민·형사 책임을 감면한다", effect: { hp: -2, rep: 22 }, log: "정답. 선의의 응급처치자를 보호하는 규정입니다." }, { text: "어떠한 경우에도 모두 면책된다", effect: { hp: -25, rep: -15 }, log: "고의·중과실은 면책되지 않습니다." }, { text: "응급의료종사자만 면책된다", effect: { hp: -20, rep: -10 }, log: "일반인도 보호 대상입니다." }, { text: "어떠한 경우에도 면책되지 않는다", effect: { hp: -25, rep: -15 }, log: "법의 입법 취지에 반합니다." }]) }; }
function generateBloodTypeQuestion() { return { baseId: "bloodType", category: "기본간호학", part: "수혈", emoji: "🩸", title: "수혈 가능 혈액형", desc: `O형 수혜자에게 응급으로 수혈할 수 있는 적혈구 혈액형은?`, choices: shuffle([{ text: "O형만 수혈 가능", effect: { hp: -2, rep: 20 }, log: "정답. O형은 동형 적혈구만 수혈 가능합니다." }, { text: "AB형이 만능 공혈자이므로 AB형 수혈", effect: { hp: -40, rep: -30 }, log: "AB형은 만능 수혈자(혈장 제외)이며 공혈자가 아닙니다." }, { text: "A형, B형 모두 가능", effect: { hp: -40, rep: -30 }, log: "용혈성 수혈반응이 발생합니다." }, { text: "Rh 인자만 일치하면 모두 가능", effect: { hp: -40, rep: -30 }, log: "ABO 적합성이 우선입니다." }]) }; }
function generateBPHQuestion() { return { baseId: "bph", category: "성인간호학", part: "비뇨기", emoji: "🚹", title: "전립선비대증", desc: `양성 전립선비대증(BPH) 환자에게서 가장 흔히 나타나는 증상은?`, choices: shuffle([{ text: "약뇨, 잔뇨감, 야간뇨, 빈뇨 등 폐쇄·자극증상", effect: { hp: -2, rep: 20 }, log: "정답. 요도 폐쇄와 방광 자극으로 나타납니다." }, { text: "혈변과 흑색변", effect: { hp: -25, rep: -15 }, log: "위장관 출혈 증상입니다." }, { text: "복통과 황달", effect: { hp: -25, rep: -15 }, log: "간담도 질환의 증상입니다." }, { text: "심한 두통과 시야결손", effect: { hp: -25, rep: -15 }, log: "신경계 증상입니다." }]) }; }
function generateCKDDialysisQuestion() { return { baseId: "dialysis", category: "성인간호학", part: "투석", emoji: "🩺", title: "혈액투석 환자 간호", desc: `좌측 팔에 동정맥루(AVF)가 있는 혈액투석 환자에게 가장 중요한 교육은?`, choices: shuffle([{ text: "AVF가 있는 팔로는 채혈·혈압 측정·정맥주사를 하지 않는다", effect: { hp: -2, rep: 22 }, log: "정답. AVF 손상은 투석 자체를 위협합니다." }, { text: "AVF 부위에 무거운 가방을 메도록 권장한다", effect: { hp: -35, rep: -25 }, log: "압박은 폐쇄를 유발합니다." }, { text: "AVF가 있는 팔로 자주 운동을 시켜 진동(thrill)을 강화한다", effect: { hp: -10, rep: 0 }, log: "가벼운 운동은 권장되지만, 측정·주사 금지가 더 핵심입니다." }, { text: "투석 직후 즉시 강한 운동을 한다", effect: { hp: -25, rep: -15 }, log: "저혈압 위험이 있어 부적절합니다." }]) }; }
function generateGallstoneQuestion() { return { baseId: "gallstone", category: "성인간호학", part: "소화기", emoji: "🥚", title: "담석증 식이", desc: `담석증 환자에게 권장되는 식이로 옳은 것은?`, choices: shuffle([{ text: "저지방, 저콜레스테롤 식이", effect: { hp: -2, rep: 20 }, log: "정답. 지방은 담낭 수축을 유발해 통증을 일으킵니다." }, { text: "고지방 고열량 식이", effect: { hp: -30, rep: -20 }, log: "통증 발작을 유발합니다." }, { text: "고단백 동물성 지방 위주 식이", effect: { hp: -25, rep: -15 }, log: "콜레스테롤이 결석 형성을 촉진합니다." }, { text: "튀김과 베이컨, 버터를 충분히 섭취", effect: { hp: -30, rep: -20 }, log: "포화지방이 과다합니다." }]) }; }
function generatePostpartumQuestion() { return { baseId: "postpartum", category: "모성간호학", part: "산후", emoji: "🤱", title: "자궁퇴축 사정", desc: `정상 분만 24시간 후 산모의 자궁저부 위치는?`, choices: shuffle([{ text: "배꼽 부위(제와 높이)", effect: { hp: -2, rep: 20 }, log: "정답. 분만 직후 제와부 → 매일 1cm씩 하강합니다." }, { text: "검상돌기 위", effect: { hp: -20, rep: -10 }, log: "이 위치는 비정상입니다." }, { text: "치골결합 아래", effect: { hp: -20, rep: -10 }, log: "10일 이후 위치입니다." }, { text: "배꼽 위 5cm", effect: { hp: -20, rep: -10 }, log: "역행성 퇴축 의심 위치입니다." }]) }; }

// =========================
// 라우터 및 렌더링 (중복 방지 적용)
// =========================
function generateClinicalEventByCategory(categoryKey = null) {
    let pool = [];
    for (let generator of clinicalGenerators) {
        const ev = generator();
        normalizeEvent(ev);
        if ((!categoryKey || ev.categoryKey === categoryKey) && !recentlyUsed(ev.baseId)) {
            pool.push(ev);
        }
    }
    if (pool.length === 0) {
        gameState.recentIds = [];
        for (let generator of clinicalGenerators) {
            const ev = generator();
            normalizeEvent(ev);
            if (!categoryKey || ev.categoryKey === categoryKey) {
                pool.push(ev);
            }
        }
    }
    const selected = pick(pool);
    rememberQuestion(selected.baseId);
    return selected;
}

function renderSceneCard(ev, options = {}) {
    const { mode = "survival", questionIndex = null, meta = [] } = options;
    const tag = ev.category ? `<div class="category-tag">${ev.category}${ev.part ? ` <span class="part">· ${ev.part}</span>` : ""}</div>` : "";
    const metaRow = meta.length ? `<div class="meta-row">${meta.map((m) => `<span class="meta-chip">${m}</span>`).join("")}</div>` : "";

    UI.gameArea.innerHTML = `
    <div class="scene-card card">
      ${tag}${metaRow}
      <span class="scene-emoji">${ev.emoji || "🩺"}</span>
      <h2 class="scene-title">${questionIndex !== null ? `[Q${questionIndex}] ` : ""}${ev.title}</h2>
      <p class="scene-desc">${ev.desc}</p>
      <div class="choice-list" id="choice-list"></div>
      <div id="feedback-zone"></div>
    </div>
  `;

    const listEl = document.getElementById("choice-list");
    ev.choices.forEach((choice, idx) => {
        const btn = document.createElement("button");
        btn.className = "choice-btn";
        btn.innerHTML = choice.text;
        btn.onclick = () => {
            if (mode === "survival") handleSurvivalChoice(choice);
            else handleQuizChoice(choice, ev, idx);
        };
        listEl.appendChild(btn);
    });
    updateStats();
}

function setShift(shift, mult, el) {
    gameState.currentShift = shift;
    gameState.difficulty = mult;
    document.querySelectorAll(".shift-option").forEach((o) => o.classList.remove("active"));
    el.classList.add("active");
}

function resetStateForMode() {
    gameState.hp = 100; gameState.rep = 0; gameState.eventCount = 0;
    gameState.items = []; gameState.quizSolved = 0; gameState.recentIds = [];
    gameState.streak = 0; gameState.bestStreak = 0; gameState.bossesCleared = 0;
}

// =========================
// 토스트 알림 (콤보·보스용)
// =========================
function showToast(text, kind = "primary") {
    const el = document.createElement("div");
    el.className = `toast toast-${kind}`;
    el.textContent = text;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => el.classList.remove("show"), 1700);
    setTimeout(() => el.remove(), 2200);
}

// =========================
// 생존모드 - 일상/플래버 이벤트
// =========================
const flavorEvents = [
    () => ({ baseId: "guardian-rage", category: "병동 일상", part: "감정노동", emoji: "🗣️", title: "보호자의 분노", desc: "보호자가 \"왜 이렇게 오래 기다리게 해!\"라며 데스크 앞에서 큰 소리로 항의합니다. 다른 환자들이 쳐다봅니다.", choices: shuffle([
        { text: "한 발 물러서서 공감하고 상황을 차분히 설명한다", effect: { hp: -4, rep: 10 }, log: "분노가 가라앉았습니다." },
        { text: "규정과 절차를 단호하게 안내한다", effect: { hp: -6, rep: 4 }, log: "보호자가 일단 자리로 돌아갔습니다." },
        { text: "동료에게 인계하고 잠시 호흡을 가다듬는다", effect: { hp: 6, rep: -3 }, log: "잠시 회복했지만 책임감이 흔들립니다." },
        { text: "바쁜 척 자리를 피한다", effect: { hp: -12, rep: -16 }, log: "공식 민원이 접수됐습니다." }
    ]) }),
    () => ({ baseId: "newAdmission", category: "병동 일상", part: "신환", emoji: "🚪", title: "신환 입원", desc: "응급실에서 폐렴 의증 환자가 막 도착했습니다. 인계가 1분도 안 됩니다.", choices: shuffle([
        { text: "활력징후부터 측정하며 인계 빈자리를 메운다", effect: { hp: -5, rep: 12 }, log: "기본기가 빛났습니다." },
        { text: "낙상 위험 사정과 환경 정비를 먼저 한다", effect: { hp: -4, rep: 8 }, log: "안전 우선이 인정받았습니다." },
        { text: "수액부터 우선 달고 사정은 나중에", effect: { hp: -10, rep: -6 }, log: "사정 없는 처치는 위험합니다." },
        { text: "보호자에게 노트 작성을 부탁한다", effect: { hp: -3, rep: -15 }, log: "보호자가 황당해합니다." }
    ]) }),
    () => ({ baseId: "drMad", category: "병동 일상", part: "팀워크", emoji: "🥼", title: "의사의 짜증", desc: "주치의가 \"왜 처방 안 받았어?\"라며 짜증을 냅니다. 처방창은 아직 열려있지 않았습니다.", choices: shuffle([
        { text: "\"방금 확인했는데 아직 미입력 상태입니다\"라고 사실대로 말한다", effect: { hp: -3, rep: 11 }, log: "정직이 통했습니다." },
        { text: "\"확인하겠습니다\"라며 빠르게 처방을 다시 확인한다", effect: { hp: -5, rep: 6 }, log: "프로다운 응대였습니다." },
        { text: "\"죄송합니다\"만 반복한다", effect: { hp: -10, rep: -3 }, log: "문제가 해결되지 않았습니다." },
        { text: "감정적으로 맞받아친다", effect: { hp: -16, rep: -16 }, log: "분위기가 험악해집니다." }
    ]) }),
    () => ({ baseId: "fall-risk", category: "병동 일상", part: "환자 안전", emoji: "🛑", title: "낙상 위험 발견", desc: "옆 병실 환자가 침대 사이드레일을 내리고 일어서려 합니다.", choices: shuffle([
        { text: "즉시 다가가 부축하고 사이드레일을 올린다", effect: { hp: -3, rep: 14 }, log: "낙상 사고를 막았습니다." },
        { text: "보호자에게 즉시 알리고 호출벨을 가까이 둔다", effect: { hp: -4, rep: 9 }, log: "안전 환경이 강화됐습니다." },
        { text: "\"누우세요\"라고 멀리서 외친다", effect: { hp: -16, rep: -14 }, log: "환자가 미끄러졌습니다." },
        { text: "차팅 중이라 잠시 후에 가본다", effect: { hp: -22, rep: -22 }, log: "낙상 사고가 발생했습니다." }
    ]) }),
    () => ({ baseId: "snack", category: "병동 일상", part: "휴식", emoji: "🍙", title: "동료의 야식", desc: "동료가 컵라면과 김밥을 사왔습니다. \"같이 먹자\"고 권합니다.", choices: shuffle([
        { text: "5분만 빠르게 먹고 일어선다", effect: { hp: 18, rep: 1 }, log: "체력이 회복됐습니다." },
        { text: "고맙다고만 하고 일에 집중한다", effect: { hp: -3, rep: 5 }, log: "의지력이 빛났습니다." },
        { text: "한 그릇 더 먹고 잠시 쉰다", effect: { hp: 10, rep: -5 }, log: "포만감에 집중력이 흐려집니다." },
        { text: "수다떨며 30분간 휴식한다", effect: { hp: 22, rep: -12 }, log: "환자 호출이 누락됐습니다." }
    ]) }),
    () => ({ baseId: "missing-chart", category: "병동 일상", part: "기록", emoji: "📋", title: "차트 누락", desc: "오전 투약 기록 한 줄이 빠진 것을 발견했습니다.", choices: shuffle([
        { text: "즉시 사실대로 추가 기록하고 보고한다", effect: { hp: -4, rep: 14 }, log: "투명성이 신뢰를 얻습니다." },
        { text: "환자 상태부터 확인 후 기록한다", effect: { hp: -3, rep: 9 }, log: "안전 우선 접근입니다." },
        { text: "눈 감고 모른 척한다", effect: { hp: -10, rep: -16 }, log: "도덕적 부담만 누적됩니다." },
        { text: "몰래 임의로 기입한다", effect: { hp: -32, rep: -34 }, log: "기록 위조는 중대한 위반입니다." }
    ]) }),
    () => ({ baseId: "bathroom", category: "병동 일상", part: "본인케어", emoji: "🚻", title: "긴급한 신호", desc: "방광이 한계입니다. 호출벨이 동시에 두 개 울립니다.", choices: shuffle([
        { text: "동료에게 호출 한 건을 인계하고 다녀온다", effect: { hp: 6, rep: 5 }, log: "팀워크가 빛났습니다." },
        { text: "30초만 다녀온 뒤 호출에 응답한다", effect: { hp: 8, rep: -3 }, log: "기본 권리도 중요합니다." },
        { text: "참고 호출부터 응답한다", effect: { hp: -16, rep: 7 }, log: "방광염 위험이 커졌습니다." },
        { text: "둘 다 동시에 응답한다며 우왕좌왕", effect: { hp: -10, rep: -8 }, log: "대응이 늦어 환자가 불만을 토로했습니다." }
    ]) }),
    () => ({ baseId: "chargeNurse", category: "병동 일상", part: "보고", emoji: "📞", title: "차지널스 콜", desc: "차지널스가 \"환자 상태 1분 안에 정리해서 보고해\"라고 말합니다.", choices: shuffle([
        { text: "SBAR 형식으로 핵심만 보고한다", effect: { hp: -3, rep: 14 }, log: "표준 보고가 빛났습니다." },
        { text: "활력징후 위주로 간단히 보고한다", effect: { hp: -2, rep: 7 }, log: "무난한 보고였습니다." },
        { text: "잘 모르겠다고 회피한다", effect: { hp: -10, rep: -16 }, log: "실력 부족이 드러났습니다." },
        { text: "감정과 잡담까지 길게 늘어놓는다", effect: { hp: -8, rep: -6 }, log: "시간 낭비라는 평가입니다." }
    ]) }),
    () => ({ baseId: "thankyou", category: "병동 일상", part: "행운", emoji: "💌", title: "감사 카드", desc: "퇴원하는 환자가 손편지를 건네며 \"덕분에 살았어요\"라고 인사합니다.", choices: shuffle([
        { text: "감사한 마음으로 인사받는다", effect: { hp: 10, rep: 18 }, log: "마음이 따뜻해집니다. 보람이 누적됐습니다." },
        { text: "겸손하게 의사 덕분이라고 돌린다", effect: { hp: 6, rep: 8 }, log: "겸양이 인정받았습니다." },
        { text: "어색해서 카드를 받지 않는다", effect: { hp: -2, rep: -4 }, log: "환자가 머쓱해합니다." },
        { text: "바쁘다며 자리를 피한다", effect: { hp: -4, rep: -8 }, log: "감사 표현을 외면했습니다." }
    ]) }),
    () => ({ baseId: "newbie", category: "병동 일상", part: "선임 멘토링", emoji: "👶", title: "신규 간호사 도움 요청", desc: "신규 간호사가 IV 카테터를 3번 실패하고 울 것 같은 표정으로 도움을 청합니다.", choices: shuffle([
        { text: "함께 가서 시범을 보이며 천천히 가르친다", effect: { hp: -5, rep: 16 }, log: "후배가 자신감을 얻었습니다." },
        { text: "\"내가 대신 해줄게\" 하고 직접 처치한다", effect: { hp: -4, rep: 4 }, log: "당장은 해결됐지만 성장 기회를 뺏었습니다." },
        { text: "\"3번이면 환자에게 미안해\"라며 핀잔준다", effect: { hp: -6, rep: -12 }, log: "후배의 자존감이 무너졌습니다." },
        { text: "차팅 중이라 무시한다", effect: { hp: -8, rep: -14 }, log: "후배가 다른 동료에게 갔습니다." }
    ]) }),
];

// =========================
// 보스 이벤트 (eventCount 5/10/18)
// =========================
function bossEventForCount(count) {
    if (count === 5) return { baseId: "boss-codeblue", category: "🚨 위기상황", part: "BOSS", emoji: "💥", title: "[BOSS] 코드 블루", desc: "병실에서 \"환자 의식 없어요!\"라는 외침. 모니터가 평탄선을 그립니다. 당신이 발견자입니다.", choices: shuffle([
        { text: "의식·호흡 확인 즉시 가슴압박, 동료에게 코드블루 콜 요청", effect: { hp: -10, rep: 38 }, log: "신속한 대응으로 ROSC! 보스 클리어!", boss: true },
        { text: "AED만 가지러 다녀온다", effect: { hp: -32, rep: -28 }, log: "가슴압박 공백이 생겼습니다." },
        { text: "주치의에게 전화부터 한다", effect: { hp: -50, rep: -42 }, log: "골든타임을 놓쳤습니다." },
        { text: "보호자에게 먼저 상황을 설명한다", effect: { hp: -50, rep: -45 }, log: "환자가 사망 위기에 빠졌습니다." }
    ]) };
    if (count === 10) return { baseId: "boss-vip", category: "🚨 위기상황", part: "BOSS", emoji: "👑", title: "[BOSS] VIP 환자", desc: "병원 이사장의 모친이 입원했습니다. 보호자가 \"24시간 1:1 간호, 회진 우선, 특별식\" 등 무리한 요구를 쏟아냅니다.", choices: shuffle([
        { text: "환자 안전을 최우선으로 원칙대로 응대하며 정중히 설명한다", effect: { hp: -10, rep: 32 }, log: "전문성이 인정받았습니다. 보스 클리어!", boss: true },
        { text: "수간호사에게 즉시 보고하여 대응 방향을 정한다", effect: { hp: -8, rep: 18 }, log: "차분한 보고체계로 위기를 넘겼습니다.", boss: true },
        { text: "모든 요구를 무리해서 다 들어준다", effect: { hp: -28, rep: -16 }, log: "본인이 번아웃 직전이고 다른 환자가 방치됐습니다." },
        { text: "VIP라 무서워서 회피한다", effect: { hp: -22, rep: -28 }, log: "민원이 접수됐습니다." }
    ]) };
    if (count === 18) return { baseId: "boss-mass", category: "🚨 위기상황", part: "BOSS", emoji: "🚑", title: "[BOSS] 다중외상 5명 동시 입실", desc: "교통사고로 환자 5명이 동시 도착. 인력은 당신과 신규 1명뿐입니다.", choices: shuffle([
        { text: "START 분류로 적색·황색·녹색 트리아지 후 인력 배분", effect: { hp: -14, rep: 42 }, log: "훌륭한 트리아지로 모두 살렸습니다! 최종 보스 클리어!", boss: true },
        { text: "눈에 띄는 출혈 환자부터 무작정 처치한다", effect: { hp: -32, rep: -22 }, log: "기도 폐쇄 환자가 방치됐습니다." },
        { text: "신규에게 알아서 하라고 맡긴다", effect: { hp: -28, rep: -32 }, log: "리더십 부재로 사고가 발생했습니다." },
        { text: "도착한 순서대로 처치한다", effect: { hp: -28, rep: -18 }, log: "트리아지 원칙을 어겼습니다." }
    ]) };
    return null;
}

function initSurvival() {
    resetStateForMode(); gameState.mode = "survival"; gameState.quizCategory = null;
    showCoreUI(); UI.logBar.innerHTML = "";
    addLog(t("dutyStart"), "log-important");
    renderSurvivalEvent("intro");
}

function renderQuizMenu() {
    gameState.mode = "quiz_menu"; resetStateForMode(); showCoreUI(); UI.logBar.innerHTML = "";
    addLog(t("quizModeStart"), "log-important");
    updateStats();

    UI.gameArea.innerHTML = `
    <div class="scene-card card">
      <span class="scene-emoji">📖</span>
      <h2 class="scene-title">${t("trainingTitle")}</h2>
      <p class="scene-desc">${t("trainingDesc")}</p>
      <div class="choice-list">
        ${CATEGORY_KEYS.map((key) => `<button class="choice-btn primary" data-cat="${key}">${catName(key)}</button>`).join("")}
        <button class="choice-btn center" onclick="goHome()">${t("backMenu")}</button>
      </div>
    </div>
  `;
    UI.gameArea.querySelectorAll("[data-cat]").forEach(btn => {
        btn.addEventListener("click", () => startQuiz(btn.dataset.cat));
    });
}

function startQuiz(categoryKey) {
    gameState.mode = "quiz"; gameState.quizCategory = categoryKey; gameState.quizSolved = 0;
    UI.logBar.innerHTML = ""; addLog(`${catName(categoryKey)} ${t("trainingStart")}`, "log-important");
    renderNextQuizQuestion();
}

function goHome() {
    gameState.mode = "menu";
    renderMainMenu();
}

function renderSurvivalEvent(eventId) {
    let ev;
    if (eventId === "intro") {
        const introDesc = gameState.currentShift === "Night" ? t("introNight")
            : gameState.currentShift === "Evening" ? t("introEvening")
            : t("introDay");
        ev = {
            baseId: "intro", categoryKey: null, category: "", title: t("introTitle"), emoji: "🏥", desc: introDesc,
            choices: shuffle([
                { text: t("introA"), effect: { hp: -4, rep: 6 }, log: t("logIntroA"), next: "random_hub" },
                { text: t("introB"), effect: { hp: -2, rep: 3, item: "Tourniquet" }, log: t("logIntroB"), next: "random_hub" },
                { text: t("introC"), effect: { hp: -3, rep: 8 }, log: t("logIntroC"), next: "random_hub" },
            ]),
        };
    } else {
        const upcomingCount = gameState.eventCount + 1;
        const boss = bossEventForCount(upcomingCount);
        if (boss) {
            ev = normalizeEvent(boss);
        } else {
            const r = Math.random();
            if (r < 0.7) {
                ev = generateClinicalEventByCategory(null);
            } else if (r < 0.93) {
                ev = normalizeEvent(pick(flavorEvents)());
            } else {
                ev = normalizeEvent({
                    baseId: "rest", categoryKey: "flavor", part: loc("휴식", "Break"),
                    title: t("restTitle"), emoji: "☕", desc: t("restDesc"),
                    choices: shuffle([
                        { text: t("restA"), effect: { hp: 18, rep: 2 }, log: t("logRestA") },
                        { text: t("restB"), effect: { hp: 12, rep: 3 }, log: t("logRestB") },
                        { text: t("restC"), effect: { hp: 10, rep: 1 }, log: t("logRestC") }
                    ])
                });
            }
        }
        gameState.eventCount += 1;
    }
    const meta = [
        `${gameState.currentShift}`,
        `${t("metaCount")} ${gameState.eventCount}`,
    ];
    if (gameState.streak >= 2) meta.push(`🔥 ${t("metaCombo")} ${gameState.streak}`);
    if (gameState.bossesCleared > 0) meta.push(`👑 ${t("metaBoss")} ${gameState.bossesCleared}/3`);
    renderSceneCard(ev, { mode: "survival", meta });
}

function handleSurvivalChoice(choice) {
    applyChoiceEffect(choice);
    const repDelta = choice.effect?.rep || 0;
    if (choice.log) addLog(choice.log, repDelta > 0 ? "log-good" : repDelta < 0 ? "log-bad" : "");

    // 콤보(연속 정답) 트래킹
    if (repDelta > 0) {
        gameState.streak += 1;
        if (gameState.streak > gameState.bestStreak) gameState.bestStreak = gameState.streak;
        if (gameState.streak === 3) { gameState.rep += 5; showToast(loc("🔥 콤보 3 · 평판 +5", "🔥 Combo 3 · +5 Rep")); addLog(loc("🔥 콤보 3 보너스 +5 평판", "🔥 Combo 3 bonus +5 Rep"), "log-important"); }
        else if (gameState.streak === 5) { gameState.rep += 10; showToast(loc("⚡ 콤보 5 · 평판 +10", "⚡ Combo 5 · +10 Rep")); addLog(loc("⚡ 콤보 5 보너스 +10 평판", "⚡ Combo 5 bonus +10 Rep"), "log-important"); }
        else if (gameState.streak === 7) { gameState.rep += 18; gameState.hp = clamp(gameState.hp + 8, 0, 100); showToast(loc("💎 무결점 7연속!", "💎 Flawless Combo 7!")); addLog(loc("💎 콤보 7 · 평판 +18, HP 회복", "💎 Combo 7 · +18 Rep, HP recovered"), "log-important"); }
        else if (gameState.streak === 10) { gameState.rep += 30; gameState.hp = clamp(gameState.hp + 15, 0, 100); showToast(loc("🏆 콤보 10 · 전설", "🏆 Combo 10 · Legend")); addLog(loc("🏆 콤보 10 · 평판 +30, HP 대폭 회복", "🏆 Combo 10 · +30 Rep, big HP recovery"), "log-important"); }
    } else if (repDelta < 0) {
        if (gameState.streak >= 3) addLog(`${t("comboEndPrefix")} ${gameState.streak} ${t("comboEndSuffix")}`, "log-important");
        gameState.streak = 0;
    }

    // 보스 클리어 보너스
    if (choice.boss) {
        gameState.bossesCleared += 1;
        gameState.hp = clamp(gameState.hp + 15, 0, 100);
        showToast(t("bossClear"), "boss");
        addLog(t("bossClearLog"), "log-important");
    }

    updateStats();

    if (gameState.hp <= 0) return showGameOver(t("gameOverHpTitle"), t("gameOverHpDesc"));
    if (gameState.rep < -60) return showGameOver(t("gameOverRepTitle"), t("gameOverRepDesc"));
    if (gameState.eventCount >= MAX_PROGRESS_EVENTS) {
        const allBosses = gameState.bossesCleared >= 3;
        let title, desc;
        if (gameState.rep >= 250 && allBosses) { title = t("endLegend"); desc = t("endLegendDesc"); }
        else if (gameState.rep >= 150 && allBosses) { title = t("endHero"); desc = t("endHeroDesc"); }
        else if (gameState.rep >= 100) { title = t("endAce"); desc = t("endAceDesc"); }
        else if (gameState.rep >= 50) { title = t("endSafe"); desc = t("endSafeDesc"); }
        else if (gameState.rep >= 0) { title = t("endSurvived"); desc = t("endSurvivedDesc"); }
        else { title = t("endNeedsWork"); desc = t("endNeedsWorkDesc"); }
        desc += `\n\n${t("bestCombo")} ${gameState.bestStreak} · ${t("metaBoss")} ${gameState.bossesCleared}/3`;
        // 평생 통계 갱신
        gameState.lifetime.dutiesCompleted += 1;
        if (gameState.bestStreak > gameState.lifetime.bestStreak) gameState.lifetime.bestStreak = gameState.bestStreak;
        if (gameState.rep > gameState.lifetime.bestRep) gameState.lifetime.bestRep = gameState.rep;
        saveSettings();
        return showGameOver(title, desc);
    }

    renderSurvivalEvent(choice.next || "random_hub");
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

function renderNextQuizQuestion() {
    renderSceneCard(generateClinicalEventByCategory(gameState.quizCategory), {
        mode: "quiz", questionIndex: gameState.quizSolved + 1, meta: [`${gameState.quizCategory}`, `해결: ${gameState.quizSolved}`]
    });
}

function handleQuizChoice(choice, ev) {
    document.querySelectorAll("#choice-list .choice-btn").forEach((b) => (b.disabled = true));
    const isCorrect = (choice.effect?.rep || 0) > 0;

    document.getElementById("feedback-zone").innerHTML = `
    <div class="feedback-box ${isCorrect ? "correct" : "wrong"}">
      <div class="feedback-title">${isCorrect ? t("correct") : t("wrong")}</div>
      <div class="feedback-text">${choice.log || loc("해설이 없습니다.", "No explanation.")}</div>
    </div>
    <div class="choice-list" style="margin-top:12px;">
      <button class="choice-btn primary center" onclick="goNextQuiz()">${t("nextQuestion")}</button>
      <button class="choice-btn center" onclick="renderQuizMenu()">${t("changeSubject")}</button>
    </div>
  `;

    const correctTag = loc("[정답]", "[Correct]");
    const wrongTag = loc("[오답]", "[Wrong]");
    if (isCorrect) {
        gameState.rep += 6;
        gameState.quizSolved += 1;
        gameState.lifetime.totalQuizSolved += 1;
        saveSettings();
        addLog(`${correctTag} ${choice.log}`, "log-good");
    } else {
        gameState.hp -= Math.round(4 * gameState.difficulty);
        addLog(`${wrongTag} ${choice.log}`, "log-bad");
    }
    gameState.hp = clamp(gameState.hp, 0, 100);
    updateStats();
}

function goNextQuiz() {
    if (gameState.hp <= 0) return showGameOver(t("quizDoneTitle"), t("quizDoneDesc"));
    renderNextQuizQuestion();
}

// =========================
// 승급 심사 (무한 랜덤 생성)
// =========================
function showGameOver(title, desc) {
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-desc").textContent = desc;
    document.getElementById("modal-stats").innerHTML = `
    ${t("finalHp")}: <span class="highlight">${clamp(gameState.hp, 0, 100)}</span><br>
    ${t("finalRep")}: <span class="highlight">${gameState.rep}</span><br>
    ${t("eventsHandled")}: <span class="highlight">${gameState.eventCount}</span>
  `;
    document.getElementById("modal-promo-title").textContent = t("promotionTitle");
    document.getElementById("modal-left-label").textContent = t("leftLabel");
    document.getElementById("modal-rank-label").textContent = t("rankLabel");
    document.getElementById("modal-score-label").textContent = t("scoreNow");
    document.getElementById("modal-pts").textContent = t("pointsUnit");
    document.getElementById("rank").textContent = t("rankNew");
    document.getElementById("modal-home-btn").textContent = t("backHome");
    UI.modal.classList.add("active");

    let score = 0; let poolCount = 2000; let currentQ = null;

    function generateDynamicQuestion() {
        let rawQ = generateClinicalEventByCategory(null);
        let answerIdx = rawQ.choices.findIndex(c => (c.effect && c.effect.rep > 0));
        if (answerIdx === -1) answerIdx = 0;

        return {
            q: `[${rawQ.category} - ${rawQ.part}]\n${rawQ.title}\n\n${rawQ.desc}`,
            choices: rawQ.choices.map(c => c.text),
            answer: answerIdx,
            explain: rawQ.choices[answerIdx].log
        };
    }

    function loadQuestion() {
        if (poolCount <= 0) return;
        currentQ = generateDynamicQuestion();
        
        document.getElementById("question-box").innerText = currentQ.q;
        let html = "";
        currentQ.choices.forEach((c, i) => {
            html += `<button class="choice-btn" onclick="document.getElementById('modal').checkAnswer(${i})">${c}</button>`;
        });

        document.getElementById("choices").innerHTML = html;
        document.getElementById("left").innerText = poolCount;
        document.getElementById("result").innerText = "";
    }

    document.getElementById("modal").checkAnswer = function(i) {
        if (i === currentQ.answer) {
            score++;
            document.getElementById("result").innerHTML = "<span style='color:var(--success)'>✅ 정답!</span>";
        } else {
            document.getElementById("result").innerHTML = `<span style='color:var(--danger)'>❌ 오답: ${currentQ.explain}</span>`;
        }
        
        poolCount--; updateRank(); document.getElementById("score").innerText = score;
        document.getElementById("choices").innerHTML = ""; 
        setTimeout(loadQuestion, 1500);
    };

    function updateRank() {
        let rank = t("rank0");
        if (score >= 10) rank = t("rank10");
        if (score >= 30) rank = t("rank30");
        if (score >= 50) rank = t("rank50");
        if (score >= 100) rank = t("rank100");
        document.getElementById("rank").innerText = rank;
    }

    loadQuestion();
}

// =========================
// 초기화
// =========================
loadSettings();
window.addEventListener("DOMContentLoaded", () => {
    syncLangButtons();
    renderMainMenu();
});