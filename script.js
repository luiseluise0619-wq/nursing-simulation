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
    correctCount: 0,
    wrongCount: 0,
    narrative: {
        codeBlueFailed: false,
        vipFailed: false,
        massFailed: false,
        savedCodeBlue: false,
        helpedNewbie: false,
        acceptedThanks: false,
        sharedMeal: false,
        ethicsViolation: false,
    },
    lang: "ko", // "ko" | "en"
    lifetime: { totalQuizSolved: 0, bestStreak: 0, bestRep: 0, dutiesCompleted: 0 },
    disclaimerAccepted: false,
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
    endLegendDesc:  { ko: "병원장 표창 후보입니다. 동료들이 모범 사례로 인용합니다.", en: "Nominated for CEO commendation. Cited by peers as best practice." },
    endHero:        { ko: "🌟 듀티의 영웅", en: "🌟 Shift Hero" },
    endHeroDesc:    { ko: "복도 끝에서 박수가 터졌습니다.", en: "Applause echoes down the corridor." },
    endMaster:      { ko: "💎 임상 마스터", en: "💎 Clinical Master" },
    endMasterDesc:  { ko: "임상 판단이 흠잡을 데가 없습니다.", en: "Your clinical judgment is virtually flawless." },
    endAce:         { ko: "💪 노련한 에이스", en: "💪 Seasoned Ace" },
    endAceDesc:     { ko: "동기들 사이에서 단연 앞서갑니다.", en: "Clearly ahead of your peers." },
    endVeteran:     { ko: "⭐ 믿음직한 베테랑", en: "⭐ Reliable Veteran" },
    endVeteranDesc: { ko: "안정감 있는 듀티였습니다.", en: "A steady, dependable shift." },
    endSafe:        { ko: "✅ 무사 완수", en: "✅ Safely Completed" },
    endSafeDesc:    { ko: "수고하셨습니다. 안전한 듀티였습니다.", en: "Well done. A safe shift." },
    endSurvived:    { ko: "😮‍💨 겨우 통과", en: "😮‍💨 Just Survived" },
    endSurvivedDesc:{ ko: "오늘은 운이 좋았습니다. 내일은 더 잘해봐요.", en: "Lucky today. Aim higher tomorrow." },
    endNeedsWork:   { ko: "🤔 학습 필요", en: "🤔 Needs More Study" },
    endNeedsWorkDesc:{ko: "약점 위주로 다시 복기해보세요.", en: "Review your weak points." },
    endRetrain:     { ko: "📋 재교육 필수", en: "📋 Mandatory Retraining" },
    endRetrainDesc: { ko: "오늘은 침착하게 복기와 재교육이 우선입니다.", en: "Step back, debrief, and retrain." },
    accuracyLabel:  { ko: "정답률", en: "Accuracy" },
    correctLabel:   { ko: "정답", en: "Correct" },
    wrongLabel:     { ko: "오답", en: "Wrong" },
    rulesHeading:   { ko: "🎯 엔딩 분기", en: "🎯 Ending Branches" },

    // ===== Narrative endings (story branches) =====
    endPromotion:        { ko: "🌟 수간호사 승진", en: "🌟 Promoted to Head Nurse" },
    endPromotionDesc:    { ko: "보스 셋 모두 성공·정답률 95% 이상. 다음 분기, 당신의 책상에 'Head Nurse' 명패가 놓인다.", en: "All 3 bosses cleared and 95%+ accuracy. Next quarter, a 'Head Nurse' nameplate sits on your desk." },
    endBeloved:          { ko: "💝 사랑받는 멘토", en: "💝 Beloved Mentor" },
    endBelovedDesc:      { ko: "신규를 끌어주고 환자의 감사도 받았다. 동료들이 당신을 '우리 팀의 멘토'라 부른다.", en: "You guided the new grad and received a patient's thanks. Colleagues call you 'our team's mentor.'" },
    endHeroLetter:       { ko: "💌 환자의 손편지", en: "💌 A Patient's Letter" },
    endHeroLetterDesc:   { ko: "전신마취에서 깨어난 환자가 당신 이름으로 손편지를 보내왔다. 보람이 가슴에 새겨진다.", en: "A patient emerging from anesthesia mailed a handwritten letter with your name. Fulfillment etched in your heart." },
    endNewBond:          { ko: "☕ 새로운 인연", en: "☕ A New Bond" },
    endNewBondDesc:      { ko: "야식을 같이 먹은 동료와 다음 주 카페 약속이 잡혔다. 듀티가 끝나자 마음이 가벼워진다.", en: "You and the coworker who shared snacks have a coffee date next week. The shift ends with a lighter heart." },
    endBurnout:          { ko: "🌅 번아웃 · 휴식 발령", en: "🌅 Burnout · On Leave" },
    endBurnoutDesc:      { ko: "수치는 좋았지만 몸이 무너졌다. 수간호사가 일주일 쉬라고 직권 발령했다.", en: "Numbers were good but your body collapsed. The head nurse signs you off for a week." },
    endGradSchool:       { ko: "🎓 대학원 진학", en: "🎓 Off to Grad School" },
    endGradSchoolDesc:   { ko: "임상이 답이 아닐 수도. 당신은 대학원 입학 원서를 쓰기 시작한다.", en: "Maybe clinical isn't the only path. You start drafting a graduate-school application." },
    endSteadyAce:        { ko: "💪 든든한 에이스", en: "💪 The Steady Ace" },
    endSteadyAceDescNew: { ko: "튀지는 않지만 누구나 같이 일하고 싶어 하는 간호사가 됐다.", en: "Not flashy, but the nurse everyone wants on their team." },
    endSafeShift:        { ko: "✅ 무사 완수", en: "✅ Safely Completed" },
    endSafeShiftDescNew: { ko: "큰 사고 없이 인계가 끝났다. 평범하지만 그게 어렵다.", en: "Handoff complete without major incidents. Ordinary — but ordinary is hard." },
    endNeedsStudy:       { ko: "🤔 다시 책상 앞으로", en: "🤔 Back to the Books" },
    endNeedsStudyDesc:   { ko: "이번 듀티는 학습이 부족했다. 약점부터 다시 펼쳐보자.", en: "This shift exposed weak spots. Open the books to your gaps first." },
    endLostPatient:      { ko: "⚰️ 잃은 한 사람", en: "⚰️ One Life Lost" },
    endLostPatientDesc:  { ko: "코드 블루에서 골든타임을 놓쳤다. 가족 앞에 설 면목이 없다. 한동안 임상에서 멀어진다.", en: "Golden time lost in the Code Blue. You can't face the family. You step away from clinical for a while." },
    endEthics:           { ko: "⚖️ 기록 위조 적발", en: "⚖️ Falsified Records Uncovered" },
    endEthicsDesc:       { ko: "투약 기록 위조가 적발됐다. 사고 위원회에 회부되고 면허가 흔들린다.", en: "Falsified records were discovered. Incident committee, license at risk." },
    endInvestigation:    { ko: "⚖️ 사고 조사위원회 회부", en: "⚖️ Incident Committee Review" },
    endInvestigationDesc:{ ko: "치명적 실수가 누적돼 조사위원회가 열린다. 면허 정지 가능성도 거론된다.", en: "Critical errors trigger an incident committee. License suspension is on the table." },
    endRetrainNew:       { ko: "📋 재교육 명령", en: "📋 Mandatory Retraining" },
    endRetrainDescNew:   { ko: "내일은 비번. 모레부터 1주일 재교육 의무.", en: "Tomorrow off. The day after, mandatory week-long retraining." },
    correctAnswer:  { ko: "✅ 정답", en: "✅ Correct Answer" },
    yourChoice:     { ko: "당신의 선택", en: "Your Choice" },
    rationaleLabel: { ko: "해설", en: "Rationale" },
    quizDoneTitle:  { ko: "학습 종료", en: "Study Ended" },
    quizDoneDesc:   { ko: "머리가 과열됐습니다. 오늘은 여기까지!", en: "Brain overheated. That's it for today!" },
    rank0:          { ko: "신규 간호사 (SN/RN)", en: "New Grad RN" },
    rank10:         { ko: "RN 2년차 (1인분 가능)", en: "RN Year 2" },
    rank30:         { ko: "RN 5년차 (에이스)", en: "RN Year 5 · Ace" },
    rank50:         { ko: "차지 널스 (Charge)", en: "Charge Nurse" },
    rank100:        { ko: "수간호사 (HN)", en: "Head Nurse" },

    disclaimerTitle:  { ko: "⚠️ 의료 정보 면책고지", en: "⚠️ Medical Disclaimer" },
    disclaimerBody:   {
        ko: "이 앱은 간호 학습 보조 도구로 제공됩니다. 실제 임상 의사결정의 근거로 사용해서는 안 되며, 모든 임상 행위는 면허 의료인의 판단과 소속 기관의 지침을 따라야 합니다.\n\n문제·해설은 일반적 가이드라인을 기반으로 작성되었으며 정확성을 보장하지 않습니다. 응급 상황에서는 즉시 의료 전문가의 도움을 받으세요.",
        en: "This app is provided solely as an educational aid for nursing study. It must not be used to guide actual clinical decision-making. All clinical actions must follow your licensed clinician's judgment and your institution's protocols.\n\nQuestions and rationales are based on general guidelines and accuracy is not guaranteed. Seek qualified medical help immediately in any emergency."
    },
    disclaimerAccept: { ko: "이해했습니다 · 시작하기", en: "I Understand · Start" },
    disclaimerClose:  { ko: "닫기", en: "Close" },

    settingsTitle:    { ko: "⚙️ 설정 · 정보", en: "⚙️ Settings · About" },
    statsHeading:     { ko: "📊 통계", en: "📊 Statistics" },
    statTotalSolved:  { ko: "누적 풀이", en: "Total Solved" },
    statBestStreak:   { ko: "최고 콤보", en: "Best Combo" },
    statBestRep:      { ko: "최고 평판", en: "Best Reputation" },
    statDuties:       { ko: "완수 듀티", en: "Duties Completed" },
    settingsLanguage: { ko: "언어 / Language", en: "Language" },
    settingsReset:    { ko: "🗑️ 통계 초기화", en: "🗑️ Reset Statistics" },
    settingsResetConfirm: { ko: "정말 모든 통계를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.", en: "Reset all statistics? This cannot be undone." },
    settingsResetDone:{ ko: "✅ 통계가 초기화되었습니다", en: "✅ Statistics reset" },
    settingsDisclaim: { ko: "📜 면책고지 다시 보기", en: "📜 View Disclaimer" },
    settingsAbout:    { ko: "ℹ️ 앱 정보", en: "ℹ️ About" },
    aboutBody:        {
        ko: "Nurse Simulator v1.0\n간호 학습용 무료 시뮬레이터\n\n• 90+ 무한 랜덤 문제\n• 8개 과목 (국시 기반)\n• 보스 · 콤보 · 일상 이벤트\n• 한·영 양 언어 지원\n\n© 2025 · Educational use only",
        en: "Nurse Simulator v1.0\nA free nursing study simulator.\n\n• 90+ randomized questions\n• 8 board-exam subjects\n• Bosses · combos · daily events\n• Bilingual KO/EN\n\n© 2025 · Educational use only"
    },
    settingsButton:   { ko: "⚙️ 설정", en: "⚙️ Settings" },
    backToMenu:       { ko: "← 메뉴로", en: "← Back to Menu" },
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
            disclaimerAccepted: gameState.disclaimerAccepted,
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
        if (data.disclaimerAccepted) gameState.disclaimerAccepted = true;
    } catch (e) { /* corrupt 무시 */ }
}
function resetLifetimeStats() {
    gameState.lifetime = { totalQuizSolved: 0, bestStreak: 0, bestRep: 0, dutiesCompleted: 0 };
    saveSettings();
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
    if (gameState.mode === "settings") return renderSettings();
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
    const lt = gameState.lifetime;
    const hasStats = lt.totalQuizSolved > 0 || lt.dutiesCompleted > 0 || lt.bestStreak > 0;
    const statsRow = hasStats
        ? `<div class="lifetime-stats">
             <span class="stat-pill">📚 ${lt.totalQuizSolved}</span>
             <span class="stat-pill">🔥 ${lt.bestStreak}</span>
             <span class="stat-pill">🏆 ${lt.dutiesCompleted}</span>
           </div>` : "";

    UI.gameArea.innerHTML = `
        <div class="card menu-container">
            <span class="scene-emoji">🏥</span>
            <h2>${t("appTitle")}</h2>
            <p class="subtitle">${t("subtitle")}</p>
            ${statsRow}

            <div class="shift-label">${t("shiftLabel")}</div>
            <div style="margin-bottom: 22px;">
                <button class="shift-option ${shift==='Day'?'active':''}" data-shift="Day" data-mult="1.0">${t("shiftDay")}</button>
                <button class="shift-option ${shift==='Evening'?'active':''}" data-shift="Evening" data-mult="1.2">${t("shiftEvening")}</button>
                <button class="shift-option ${shift==='Night'?'active':''}" data-shift="Night" data-mult="1.5">${t("shiftNight")}</button>
            </div>

            <button class="choice-btn primary" onclick="initSurvival()">${t("startSurvival")}</button>
            <button class="choice-btn ghost center" onclick="renderQuizMenu()">${t("openTraining")}</button>
            <button class="choice-btn ghost center" style="margin-top: 4px; font-size: 0.85rem;" onclick="renderSettings()">${t("settingsButton")}</button>
        </div>
    `;
    UI.gameArea.querySelectorAll(".shift-option").forEach(btn => {
        btn.addEventListener("click", () => setShift(btn.dataset.shift, parseFloat(btn.dataset.mult), btn));
    });
}

// =========================
// 설정 / 정보 화면
// =========================
function renderSettings() {
    gameState.mode = "settings";
    UI.topBar.classList.add("hidden");
    UI.logBar.classList.add("hidden");
    UI.inventory.classList.add("hidden");
    UI.progressWrap.classList.add("hidden");
    document.getElementById("progress-info").classList.add("hidden");

    const lt = gameState.lifetime;
    UI.gameArea.innerHTML = `
        <div class="card">
            <h2 class="scene-title">${t("settingsTitle")}</h2>

            <div class="settings-section">
                <div class="settings-label">${t("statsHeading")}</div>
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-num">${lt.totalQuizSolved}</div><div class="stat-lbl">${t("statTotalSolved")}</div></div>
                    <div class="stat-card"><div class="stat-num">${lt.bestStreak}</div><div class="stat-lbl">${t("statBestStreak")}</div></div>
                    <div class="stat-card"><div class="stat-num">${lt.bestRep}</div><div class="stat-lbl">${t("statBestRep")}</div></div>
                    <div class="stat-card"><div class="stat-num">${lt.dutiesCompleted}</div><div class="stat-lbl">${t("statDuties")}</div></div>
                </div>
            </div>

            <div class="settings-section">
                <div class="settings-label">${t("settingsLanguage")}</div>
                <div>
                    <button class="shift-option ${gameState.lang==='ko'?'active':''}" onclick="setLang('ko')">한국어</button>
                    <button class="shift-option ${gameState.lang==='en'?'active':''}" onclick="setLang('en')">English</button>
                </div>
            </div>

            <div class="settings-section">
                <button class="choice-btn ghost" onclick="confirmReset()">${t("settingsReset")}</button>
                <button class="choice-btn ghost" onclick="showDisclaimer(false)">${t("settingsDisclaim")}</button>
                <button class="choice-btn ghost" onclick="showAbout()">${t("settingsAbout")}</button>
            </div>

            <button class="choice-btn primary" onclick="goHome()" style="margin-top: 8px;">${t("backToMenu")}</button>
        </div>
    `;
}

function confirmReset() {
    if (confirm(t("settingsResetConfirm"))) {
        resetLifetimeStats();
        renderSettings();
        showToast(t("settingsResetDone"));
    }
}

function showAbout() {
    alert(t("aboutBody"));
}

// =========================
// 의료 면책고지 모달
// =========================
function showDisclaimer(isFirstLaunch) {
    const overlay = document.getElementById("disclaimer-overlay");
    document.getElementById("disclaimer-title").textContent = t("disclaimerTitle");
    document.getElementById("disclaimer-body").textContent = t("disclaimerBody");
    const btn = document.getElementById("disclaimer-btn");
    btn.textContent = isFirstLaunch ? t("disclaimerAccept") : t("disclaimerClose");
    btn.onclick = () => {
        if (isFirstLaunch) {
            gameState.disclaimerAccepted = true;
            saveSettings();
        }
        overlay.classList.remove("active");
    };
    overlay.classList.add("active");
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
    // 최근 80개의 baseId를 기억하여 중복을 원천 차단 (총 93개 임상문제 중)
    if (gameState.recentIds.length > 80) {
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
    generatePostpartumQuestion,
    // 신규 추가 20문제
    generateLithiumQuestion, generateEPSQuestion, generateMAOIQuestion,
    generateAnorexiaQuestion, generateNaloxoneQuestion, generateAnaphylaxisRxQuestion,
    generateChestTubeQuestion, generateOstomyQuestion, generateCentralLineQuestion,
    generatePacemakerQuestion, generateGDMQuestion, generatePPDQuestion,
    generateHEGQuestion, generateEpisiotomyQuestion, generateNeonatalHypoQuestion,
    generateSickleCellQuestion, generateLeukemiaPedsQuestion, generateLeadPoisonQuestion,
    generateRestraintLawQuestion, generateHomeHealthQuestion
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
function generateCPRQuestion() { return { baseId: "cpr", categoryKey: "adult", part: loc("응급/CPR","Emergency / CPR"), emoji: "💗", title: loc("성인 CPR 가슴압박","Adult CPR Compressions"), desc: loc(`의식이 없고 호흡이 없는 성인 환자에게 시행하는 가슴압박 깊이와 속도로 옳은 것은?`,`Correct depth and rate of chest compressions for an unresponsive, apneic adult?`), choices: shuffle([{ text: loc("약 5cm 깊이로 분당 100~120회 압박한다","About 5 cm deep at 100–120/min"), effect: { hp: -3, rep: 22 }, log: loc("정답. 2020 가이드라인 기준 성인 CPR 표준입니다.","Correct. 2020 AHA adult CPR standard.") }, { text: loc("약 2cm 깊이로 분당 60회 천천히 압박한다","About 2 cm deep at 60/min slowly"), effect: { hp: -25, rep: -15 }, log: loc("압박이 너무 얕고 느립니다.","Too shallow and slow.") }, { text: loc("흉골 하단 갈비뼈 끝(검상돌기)을 정확히 압박한다","Compress directly on the xiphoid process"), effect: { hp: -30, rep: -20 }, log: loc("검상돌기 압박은 간 손상을 유발합니다.","Xiphoid compression causes liver injury.") }, { text: loc("압박과 인공호흡 비율을 5:1로 시행한다","Use a 5:1 compression-to-ventilation ratio"), effect: { hp: -20, rep: -10 }, log: loc("성인은 30:2가 표준입니다.","Adult standard is 30:2.") }]) }; }
function generatePressureUlcerQuestion() { return { baseId: "pressureUlcer", categoryKey: "fundamentals", part: loc("욕창","Pressure Ulcer"), emoji: "🛌", title: loc("욕창 예방 간호","Pressure Ulcer Prevention"), desc: loc(`장기간 와상 환자의 욕창 예방을 위한 가장 적절한 간호중재는?`,`Best intervention to prevent pressure ulcers in a long-bedridden patient?`), choices: shuffle([{ text: loc("최소 2시간마다 체위변경하고 뼈돌출부 압력을 분산한다","Reposition at least every 2 hours and offload bony prominences"), effect: { hp: -2, rep: 20 }, log: loc("정답. 압력 제거가 가장 핵심입니다.","Correct. Pressure offloading is key.") }, { text: loc("발적 부위를 알코올로 마사지하여 자극을 준다","Massage red areas with alcohol to stimulate"), effect: { hp: -25, rep: -15 }, log: loc("발적 부위 마사지는 조직 손상을 가속화합니다.","Massaging reddened skin accelerates tissue damage.") }, { text: loc("엉덩이에 도넛 모양 쿠션을 적용한다","Apply a donut-shaped cushion under the buttocks"), effect: { hp: -20, rep: -10 }, log: loc("도넛쿠션은 오히려 혈류를 차단합니다.","Donut cushions actually block blood flow.") }, { text: loc("피부가 건조하지 않도록 하루 4시간만 누워있게 한다","Lie down only 4 hours a day to keep skin dry"), effect: { hp: -15, rep: -5 }, log: loc("체위변경 빈도가 부족합니다.","Insufficient repositioning frequency.") }]) }; }
function generateInsulinQuestion() {
    const types = [
        { nameKo: "속효성(Regular)", nameEn: "Short-acting (Regular)", onsetKo: "30분", onsetEn: "30 min" },
        { nameKo: "초속효성(Lispro)", nameEn: "Rapid-acting (Lispro)", onsetKo: "15분", onsetEn: "15 min" },
        { nameKo: "지속형(Glargine)", nameEn: "Long-acting (Glargine)", onsetKo: "1시간", onsetEn: "1 hour" },
        { nameKo: "중간형(NPH)", nameEn: "Intermediate (NPH)", onsetKo: "1-2시간", onsetEn: "1-2 hours" },
    ];
    const target = pick(types); const wrong = types.filter(t => t !== target)[0];
    const tName = loc(target.nameKo, target.nameEn); const tOnset = loc(target.onsetKo, target.onsetEn);
    return { baseId: "insulin", categoryKey: "adult", part: loc("내분비","Endocrine"), emoji: "💉",
        title: loc("인슐린 작용시간","Insulin Onset"),
        desc: loc(`${tName} 인슐린의 작용 발현시간으로 가장 적절한 것은?`, `What is the onset of action for ${tName} insulin?`),
        choices: shuffle([
            { text: tOnset, effect: { hp: -2, rep: 18 }, log: loc(`정답. ${tName}의 작용 발현시간입니다.`, `Correct. Onset of ${tName}.`) },
            { text: loc(`${wrong.onsetKo} (다른 인슐린)`, `${wrong.onsetEn} (different insulin)`), effect: { hp: -15, rep: -10 }, log: loc("인슐린 종류가 다릅니다.","That belongs to another insulin.") },
            { text: loc("12시간 (모든 인슐린 동일)","12 hours (same for all insulins)"), effect: { hp: -20, rep: -15 }, log: loc("인슐린은 종류별 시간이 다릅니다.","Insulins differ by type.") },
            { text: loc("24시간 후 작용 시작","Begins acting after 24 hours"), effect: { hp: -20, rep: -15 }, log: loc("이렇게 늦게 작용하는 인슐린은 없습니다.","No insulin starts that late.") }
        ])
    };
}
function generateCOPDQuestion() { return { baseId: "copd", categoryKey: "adult", part: loc("호흡기","Respiratory"), emoji: "🌬️", title: loc("COPD 산소요법","COPD Oxygen Therapy"), desc: loc(`만성폐쇄성폐질환(COPD) 환자에게 산소를 투여할 때 옳은 방법은?`,`Correct oxygen administration for a COPD patient?`), choices: shuffle([{ text: loc("Venturi mask로 1~3L/min 저농도 산소를 정확히 투여한다","Venturi mask with precise low-flow 1–3 L/min"), effect: { hp: -3, rep: 22 }, log: loc("정답. CO2 정체 환자는 저농도 정확 투여가 핵심입니다.","Correct. Precise low FiO2 is key for CO2 retainers.") }, { text: loc("Non-rebreather mask로 10L/min 고농도 산소를 투여한다","Non-rebreather at 10 L/min high concentration"), effect: { hp: -35, rep: -25 }, log: loc("고농도 산소는 호흡중추를 억제하여 CO2 정체를 악화시킵니다.","High FiO2 suppresses respiratory drive and worsens CO2 retention.") }, { text: loc("비강캐뉼라로 6L/min 이상 고유속을 투여한다","Nasal cannula above 6 L/min"), effect: { hp: -30, rep: -20 }, log: loc("비강캐뉼라 6L 이상은 점막 자극과 고농도 위험이 있습니다.","NC >6 L/min causes mucosal irritation and risks high FiO2.") }, { text: loc("수면 중에는 산소를 모두 차단한다","Stop all oxygen during sleep"), effect: { hp: -25, rep: -15 }, log: loc("야간 저산소증을 유발합니다.","Causes nocturnal hypoxia.") }]) }; }
function generateStrokeQuestion() { return { baseId: "stroke", categoryKey: "adult", part: loc("신경계","Neurology"), emoji: "🧠", title: loc("급성 뇌졸중 초기간호","Acute Stroke Initial Care"), desc: loc(`갑작스러운 편마비와 구음장애로 응급실에 내원한 환자에게 가장 우선되는 간호는?`,`A patient arrives at the ED with sudden hemiplegia and dysarthria. Top priority?`), choices: shuffle([{ text: loc("증상 발생 시간을 확인하고 신속히 CT를 시행하도록 돕는다","Confirm symptom onset time and expedite CT scan"), effect: { hp: -2, rep: 22 }, log: loc("정답. tPA 적용을 위해 발생시각 확인과 영상검사가 최우선입니다.","Correct. Onset time and imaging are top priority for tPA eligibility.") }, { text: loc("혈압이 높으므로 즉시 강하제로 적극 낮춘다","Aggressively lower the BP with antihypertensives"), effect: { hp: -30, rep: -20 }, log: loc("허혈성 뇌졸중은 뇌관류를 위해 혈압을 함부로 낮추지 않습니다.","BP shouldn't be aggressively lowered in ischemic stroke.") }, { text: loc("구강으로 아스피린을 즉시 투여한다","Give oral aspirin immediately"), effect: { hp: -25, rep: -15 }, log: loc("출혈성 뇌졸중일 수 있어 영상검사 전 금기입니다.","Contraindicated before imaging — may be hemorrhagic.") }, { text: loc("재활을 위해 침상에서 적극적인 ROM 운동을 시작한다","Start aggressive ROM exercises in bed"), effect: { hp: -20, rep: -10 }, log: loc("급성기에는 절대안정이 우선입니다.","Strict bed rest in acute phase.") }]) }; }
function generateChemoQuestion() { return { baseId: "chemo", categoryKey: "adult", part: loc("종양","Oncology"), emoji: "💊", title: loc("항암화학요법 부작용","Chemotherapy Side Effects"), desc: loc(`항암제 투여 7~10일 후 가장 주의 깊게 관찰해야 할 부작용은?`,`What side effect requires closest monitoring 7–10 days after chemotherapy?`), choices: shuffle([{ text: loc("골수억제로 인한 호중구 감소·감염 위험","Myelosuppression with neutropenia and infection risk"), effect: { hp: -3, rep: 20 }, log: loc("정답. 7~14일 nadir에 감염 위험이 가장 높습니다.","Correct. Nadir at days 7–14 carries the highest infection risk.") }, { text: loc("탈모(주된 사망 원인)","Alopecia (major cause of death)"), effect: { hp: -25, rep: -15 }, log: loc("탈모는 흔하나 사망 원인이 아닙니다.","Common but not a cause of death.") }, { text: loc("혈당 상승으로 인한 케톤산증","Ketoacidosis from hyperglycemia"), effect: { hp: -20, rep: -10 }, log: loc("항암제의 주 부작용이 아닙니다.","Not a primary chemo side effect.") }, { text: loc("체중 증가와 식욕 폭증","Weight gain with surging appetite"), effect: { hp: -25, rep: -15 }, log: loc("오심·구토와 식욕부진이 더 흔합니다.","Nausea, vomiting, anorexia are more typical.") }]) }; }
function generateSuicideQuestion() { return { baseId: "suicide", categoryKey: "psych", part: loc("자살위험","Suicide Risk"), emoji: "🆘", title: loc("자살 위험 환자 간호","Suicidal Patient Care"), desc: loc(`\"이제 다 끝내고 싶어요\"라고 말하며 우울감을 표현한 환자에 대한 우선 간호는?`,`Patient says, "I want it all to end." Priority nursing action?`), choices: shuffle([{ text: loc("직접적으로 자살 계획·방법이 있는지 사정한다","Directly assess for suicidal plan and means"), effect: { hp: -3, rep: 22 }, log: loc("정답. 직접적 사정이 자살을 부추기지 않으며 가장 중요합니다.","Correct. Direct assessment doesn't induce suicide and is paramount.") }, { text: loc("주제를 돌려 즐거운 일을 떠올리게 한다","Change the subject to happy memories"), effect: { hp: -25, rep: -15 }, log: loc("감정을 외면하면 신뢰가 깨집니다.","Avoiding emotion breaks trust.") }, { text: loc("혼자 조용히 쉬도록 1인실로 옮기고 격리한다","Move them to a private room and leave them alone"), effect: { hp: -40, rep: -25 }, log: loc("자살 위험 환자는 절대 혼자 두지 않습니다.","Suicidal patients must never be left alone.") }, { text: loc("\"그런 말씀 마세요\"라며 강하게 만류한다","Firmly say, \"Don't say that\""), effect: { hp: -20, rep: -15 }, log: loc("감정을 차단하는 비치료적 의사소통입니다.","Non-therapeutic communication that blocks emotion.") }]) }; }
function generateDepressionQuestion() { return { baseId: "depression", categoryKey: "psych", part: loc("우울증","Depression"), emoji: "💧", title: loc("우울증 환자 간호","Caring for Depressed Patient"), desc: loc(`심한 우울증 환자에게 가장 적절한 초기 간호중재는?`,`Best initial intervention for a severely depressed patient?`), choices: shuffle([{ text: loc("함께 있어주며 경청하고 단순하고 구체적인 활동을 격려한다","Stay with them, listen, and encourage simple concrete activities"), effect: { hp: -2, rep: 20 }, log: loc("정답. 신뢰 형성과 단순 활동이 핵심입니다.","Correct. Trust-building and simple activities are key.") }, { text: loc("복잡하고 도전적인 그룹 활동에 참여시킨다","Place them in complex, challenging group activities"), effect: { hp: -20, rep: -10 }, log: loc("우울 환자는 결정과 복잡한 과제에 무력감을 느낍니다.","Depressed patients feel helpless with complex tasks.") }, { text: loc("\"기운 내세요, 다 잘 될 거예요\"라고 격려한다","Say, \"Cheer up, everything will be fine\""), effect: { hp: -15, rep: -10 }, log: loc("공허한 위로는 비치료적입니다.","Empty reassurance is non-therapeutic.") }, { text: loc("환자 혼자 조용히 사색하도록 둔다","Leave them alone for quiet reflection"), effect: { hp: -25, rep: -15 }, log: loc("고립은 자살 위험을 높입니다.","Isolation increases suicide risk.") }]) }; }
function generateDementiaQuestion() { return { baseId: "dementia", categoryKey: "psych", part: loc("치매","Dementia"), emoji: "🧓", title: loc("치매 환자 의사소통","Dementia Communication"), desc: loc(`치매 환자와의 효과적인 의사소통 방법은?`,`Effective communication with a dementia patient?`), choices: shuffle([{ text: loc("짧고 단순한 문장으로 한 번에 한 가지씩 천천히 지시한다","Use short simple sentences, one instruction at a time, slowly"), effect: { hp: -2, rep: 20 }, log: loc("정답. 인지기능 저하에 맞춘 의사소통입니다.","Correct. Tailored to cognitive decline.") }, { text: loc("기억을 자극하기 위해 어려운 질문을 반복한다","Repeat difficult questions to stimulate memory"), effect: { hp: -25, rep: -15 }, log: loc("혼란과 좌절감을 증가시킵니다.","Increases confusion and frustration.") }, { text: loc("환자가 잘못 말할 때마다 즉시 정정해 준다","Correct them immediately whenever they misspeak"), effect: { hp: -20, rep: -10 }, log: loc("잦은 정정은 자존감 저하와 분노를 유발합니다.","Frequent correction harms self-esteem and triggers anger.") }, { text: loc("여러 사람이 동시에 다양한 주제로 대화한다","Have multiple people speak at once on various topics"), effect: { hp: -25, rep: -15 }, log: loc("자극이 과해 혼돈을 악화시킵니다.","Excess stimulation worsens confusion.") }]) }; }
function generateAlcoholWithdrawalQuestion() { return { baseId: "alcoholWithdrawal", categoryKey: "psych", part: loc("물질관련","Substance Use"), emoji: "🍷", title: loc("알코올 금단증상","Alcohol Withdrawal"), desc: loc(`금주 48~72시간 후 환각, 진전, 발작이 나타나는 응급상태(DTs) 환자에게 우선 투여하는 약물은?`,`First-line medication for delirium tremens (DTs) 48–72 hours after last drink?`), choices: shuffle([{ text: loc("벤조디아제핀계(Lorazepam, Diazepam)","Benzodiazepines (Lorazepam, Diazepam)"), effect: { hp: -3, rep: 22 }, log: loc("정답. 알코올 금단의 1차 선택약입니다.","Correct. First-line for alcohol withdrawal.") }, { text: loc("정신자극제(Methylphenidate)","Stimulant (Methylphenidate)"), effect: { hp: -25, rep: -20 }, log: loc("오히려 흥분을 가중시킵니다.","Worsens agitation.") }, { text: loc("진통제(Morphine)","Opioid (Morphine)"), effect: { hp: -25, rep: -15 }, log: loc("호흡 억제 위험이 있습니다.","Risk of respiratory depression.") }, { text: loc("이뇨제(Furosemide)","Diuretic (Furosemide)"), effect: { hp: -20, rep: -10 }, log: loc("탈수를 유발해 더 위험합니다.","Causes dehydration — more dangerous.") }]) }; }
function generateBSEQuestion() { return { baseId: "bse", categoryKey: "maternal", part: loc("유방암","Breast Cancer"), emoji: "🎗️", title: loc("유방 자가검진 시기","BSE Timing"), desc: loc(`폐경 전 여성에게 권장되는 유방 자가검진(BSE)의 가장 적절한 시기는?`,`Best timing for breast self-examination (BSE) in a premenopausal woman?`), choices: shuffle([{ text: loc("월경이 끝난 후 7~10일 사이","7–10 days after menstruation ends"), effect: { hp: -2, rep: 20 }, log: loc("정답. 호르몬 영향이 적어 가장 정확합니다.","Correct. Lowest hormonal influence — most accurate.") }, { text: loc("월경 시작 첫날","First day of menstruation"), effect: { hp: -20, rep: -10 }, log: loc("유방 부종으로 정확도가 떨어집니다.","Breast swelling reduces accuracy.") }, { text: loc("월경 시작 직전 2~3일","2–3 days before menses begins"), effect: { hp: -20, rep: -10 }, log: loc("호르몬 영향으로 결절감이 증가합니다.","Hormones increase nodularity.") }, { text: loc("배란일 당일","Day of ovulation"), effect: { hp: -15, rep: -10 }, log: loc("주기 중간은 호르몬 변화가 큽니다.","Mid-cycle has large hormonal shifts.") }]) }; }
function generatePIHQuestion() { return { baseId: "pih", categoryKey: "maternal", part: loc("임신성고혈압","PIH"), emoji: "🤰", title: loc("전자간증 간호","Preeclampsia Care"), desc: loc(`임신 32주 산모가 혈압 160/110, 단백뇨, 두통, 시야 흐림을 호소한다. 가장 우선되는 간호는?`,`32-week pregnant woman: BP 160/110, proteinuria, headache, blurred vision. Top priority?`), choices: shuffle([{ text: loc("조용한 어두운 환경에서 좌측위로 안정시키고 자간증을 예방한다","Quiet darkened environment, left-lateral position, prevent eclampsia"), effect: { hp: -3, rep: 22 }, log: loc("정답. 자극 최소화와 좌측위는 자간증 예방의 핵심입니다.","Correct. Stimulus reduction and left lateral are key to preventing eclampsia.") }, { text: loc("수분을 다량 섭취시켜 단백뇨를 희석한다","Force fluids to dilute proteinuria"), effect: { hp: -25, rep: -15 }, log: loc("수분 과다는 폐부종 위험을 증가시킵니다.","Fluid overload increases pulmonary edema risk.") }, { text: loc("운동을 권장해 혈압을 내린다","Encourage exercise to lower BP"), effect: { hp: -30, rep: -20 }, log: loc("절대 안정이 필요한 상황입니다.","Strict bed rest is required.") }, { text: loc("MgSO4 투여 시 심부건반사가 항진된 상태를 유지한다","Keep DTRs hyperreflexive while giving MgSO4"), effect: { hp: -30, rep: -20 }, log: loc("심부건반사 소실은 마그네슘 중독 징후입니다.","Loss of DTRs signals magnesium toxicity.") }]) }; }
function generateBreastfeedingQuestion() { return { baseId: "breastfeeding", categoryKey: "maternal", part: loc("모유수유","Breastfeeding"), emoji: "🍼", title: loc("모유수유 교육","Breastfeeding Education"), desc: loc(`초산모에게 모유수유에 대해 옳게 교육한 내용은?`,`Which breastfeeding teaching is correct for a primiparous mother?`), choices: shuffle([{ text: loc("한쪽 유방을 충분히 비운 후 다른 쪽으로 바꿔 후유즙까지 먹인다","Empty one breast fully before switching, ensuring hindmilk"), effect: { hp: -2, rep: 20 }, log: loc("정답. 후유즙은 지방이 많아 영아 성장에 중요합니다.","Correct. Hindmilk is fat-rich and important for growth.") }, { text: loc("수유 후 남은 모유는 짜내지 말고 그대로 둔다","Don't pump out leftover milk after feeding"), effect: { hp: -20, rep: -10 }, log: loc("비우지 않으면 분비가 줄어듭니다.","Failure to empty reduces milk supply.") }, { text: loc("수유 시간은 정확히 4시간 간격을 지킨다","Feed exactly every 4 hours"), effect: { hp: -20, rep: -10 }, log: loc("모유수유는 자율수유(요구 시 수유)가 원칙입니다.","Breastfeeding follows on-demand principles.") }, { text: loc("유두 균열 시 비누로 깨끗이 자주 씻는다","Wash cracked nipples frequently with soap"), effect: { hp: -25, rep: -15 }, log: loc("비누는 유두 건조와 균열을 악화시킵니다.","Soap dries and worsens cracks.") }]) }; }
function generateDevelopmentQuestion() {
    const milestones = [
        { ageKo: "6개월", ageEn: "6 months", correctKo: "혼자 앉기 시작", correctEn: "Begins sitting unsupported" },
        { ageKo: "12개월", ageEn: "12 months", correctKo: "혼자 걷기 시작", correctEn: "Begins walking" },
        { ageKo: "2세", ageEn: "2 years", correctKo: "두 단어 문장 사용", correctEn: "Uses two-word sentences" },
        { ageKo: "4세", ageEn: "4 years", correctKo: "한 발로 뛰기", correctEn: "Hops on one foot" },
    ];
    const target = pick(milestones); const wrongs = milestones.filter(m => m !== target);
    const tAge = loc(target.ageKo, target.ageEn);
    return { baseId: "development", categoryKey: "pediatric", part: loc("성장발달","Growth & Development"), emoji: "👶",
        title: loc("아동 발달이정표","Developmental Milestones"),
        desc: loc(`${tAge} 영유아가 일반적으로 보일 수 있는 발달 단계는?`, `What developmental milestone is typical at ${tAge}?`),
        choices: shuffle([
            { text: loc(target.correctKo, target.correctEn), effect: { hp: -2, rep: 20 }, log: loc(`정답. ${tAge}의 일반 발달 단계입니다.`, `Correct. Typical milestone at ${tAge}.`) },
            { text: loc(wrongs[0].correctKo, wrongs[0].correctEn), effect: { hp: -20, rep: -10 }, log: loc("다른 시기의 발달입니다.","Belongs to a different age.") },
            { text: loc(wrongs[1].correctKo, wrongs[1].correctEn), effect: { hp: -20, rep: -10 }, log: loc("다른 시기의 발달입니다.","Belongs to a different age.") },
            { text: loc(wrongs[2].correctKo, wrongs[2].correctEn), effect: { hp: -20, rep: -10 }, log: loc("다른 시기의 발달입니다.","Belongs to a different age.") }
        ])
    };
}
function generateCroupQuestion() { return { baseId: "croup", categoryKey: "pediatric", part: loc("호흡기","Respiratory"), emoji: "🐶", title: loc("크룹(후두기관기관지염)","Croup (Laryngotracheobronchitis)"), desc: loc(`밤사이 컹컹거리는 개 짖는 듯한 기침과 흡기성 천명음을 보이는 영아의 가장 효과적인 가정 간호는?`,`Most effective home care for an infant with barking cough and inspiratory stridor at night?`), choices: shuffle([{ text: loc("차가운 습한 공기 또는 따뜻한 욕실의 수증기에 노출시킨다","Expose to cool humid air or warm bathroom steam"), effect: { hp: -2, rep: 20 }, log: loc("정답. 차거나 습한 공기는 후두 부종을 감소시킵니다.","Correct. Cool/humid air reduces laryngeal edema.") }, { text: loc("기침억제제를 즉시 경구 투여한다","Give an oral cough suppressant immediately"), effect: { hp: -25, rep: -15 }, log: loc("기침억제제는 분비물 배출을 막아 위험합니다.","Suppressants block secretion clearance.") }, { text: loc("건조한 더운 방에서 충분히 재운다","Let them sleep in a dry warm room"), effect: { hp: -20, rep: -10 }, log: loc("건조한 공기는 증상을 악화시킵니다.","Dry air worsens symptoms.") }, { text: loc("찬물을 다량 마시게 한다","Make them drink lots of cold water"), effect: { hp: -15, rep: -10 }, log: loc("흡인 위험이 있고 직접적 도움이 없습니다.","Aspiration risk with no direct benefit.") }]) }; }
function generateKawasakiQuestion() { return { baseId: "kawasaki", categoryKey: "pediatric", part: loc("심혈관","Cardiovascular"), emoji: "👅", title: loc("가와사키병 간호","Kawasaki Disease"), desc: loc(`5일 이상의 고열, 딸기혀, 손발 부종이 나타난 아동의 가장 위험한 합병증은?`,`Most dangerous complication in a child with >5 days fever, strawberry tongue, and extremity edema?`), choices: shuffle([{ text: loc("관상동맥류 형성","Coronary artery aneurysm"), effect: { hp: -3, rep: 22 }, log: loc("정답. 관상동맥류가 가장 치명적인 합병증입니다.","Correct. Coronary aneurysm is the most lethal complication.") }, { text: loc("수두에 의한 폐렴","Varicella pneumonia"), effect: { hp: -20, rep: -15 }, log: loc("수두와는 관련이 없습니다.","Unrelated to varicella.") }, { text: loc("선천성 심실중격결손","Congenital VSD"), effect: { hp: -25, rep: -15 }, log: loc("선천성 기형이 아닌 후천성 혈관염입니다.","It's an acquired vasculitis, not a congenital defect.") }, { text: loc("백혈병으로의 진행","Progression to leukemia"), effect: { hp: -30, rep: -20 }, log: loc("혈액암과 관련이 없습니다.","Unrelated to hematologic malignancy.") }]) }; }
function generateDelegationQuestion() { return { baseId: "delegation", categoryKey: "management", part: loc("위임","Delegation"), emoji: "📋", title: loc("업무 위임","Task Delegation"), desc: loc(`간호조무사(NA)에게 위임할 수 있는 업무로 가장 적절한 것은?`,`Which task is most appropriate to delegate to a nursing assistant (NA)?`), choices: shuffle([{ text: loc("안정된 환자의 활력징후 측정 및 경구섭취량 기록","Vital signs and oral intake recording on a stable patient"), effect: { hp: -2, rep: 18 }, log: loc("정답. 표준화·반복적 업무는 위임 가능합니다.","Correct. Standardized, repetitive tasks may be delegated.") }, { text: loc("신규 입원환자의 초기 간호 사정","Initial nursing assessment of a new admission"), effect: { hp: -25, rep: -15 }, log: loc("사정은 RN의 고유 업무입니다.","Assessment is the RN's exclusive role.") }, { text: loc("환자 교육 및 퇴원교육 시행","Patient and discharge teaching"), effect: { hp: -20, rep: -10 }, log: loc("교육은 RN의 책임입니다.","Education is the RN's responsibility.") }, { text: loc("정맥주사 IV 약물 투여","IV medication administration"), effect: { hp: -30, rep: -20 }, log: loc("정맥 약물 투여는 위임할 수 없습니다.","IV medications cannot be delegated.") }]) }; }
function generateMedicalLawQuestion() { return { baseId: "medicalLaw", categoryKey: "law", part: loc("의료법","Medical Law"), emoji: "📜", title: loc("간호기록부 보존기간","Nursing Record Retention"), desc: loc(`의료법령에 따른 간호기록부의 법정 보존기간은?`,`Legal retention period for the nursing record per Korean Medical Service Act?`), choices: shuffle([{ text: loc("5년","5 years"), effect: { hp: -2, rep: 20 }, log: loc("정답. 간호기록부 보존기간은 5년입니다.","Correct. Nursing record retention is 5 years.") }, { text: loc("2년","2 years"), effect: { hp: -20, rep: -10 }, log: loc("처방전이 2년입니다.","Prescriptions are 2 years.") }, { text: loc("10년","10 years"), effect: { hp: -20, rep: -10 }, log: loc("진료기록부와 수술기록부가 10년입니다.","Medical and operative records are 10 years.") }, { text: loc("3년","3 years"), effect: { hp: -20, rep: -10 }, log: loc("진단서·검안서 부본이 3년입니다.","Certificate copies are 3 years.") }]) }; }
function generateFamilyNursingQuestion() { return { baseId: "familyNursing", categoryKey: "community", part: loc("가족간호","Family Nursing"), emoji: "👨‍👩‍👧", title: loc("가족 사정 도구","Family Assessment Tool"), desc: loc(`가족 구성원 간의 외부 자원 및 지지체계를 시각적으로 표현하는 사정 도구는?`,`Which assessment tool visually maps a family's external resources and support systems?`), choices: shuffle([{ text: loc("외부체계도(Eco-map)","Eco-map"), effect: { hp: -2, rep: 20 }, log: loc("정답. 가족과 외부의 상호작용을 시각화합니다.","Correct. Visualizes family-external interactions.") }, { text: loc("가계도(Genogram)","Genogram"), effect: { hp: -15, rep: -10 }, log: loc("가족 구성원·질병력을 보여주는 3대 가계도입니다.","Three-generation chart of family members/health history.") }, { text: loc("가족연대기(Family chronology)","Family chronology"), effect: { hp: -15, rep: -10 }, log: loc("가족의 주요 사건 시간순 정리입니다.","Chronological list of family events.") }, { text: loc("사회지지도(Social support)","Social support map"), effect: { hp: -15, rep: -10 }, log: loc("구성원 개인의 지지망 도구입니다.","Tool for an individual's support network.") }]) }; }
function generateSchoolHealthQuestion() { return { baseId: "schoolHealth", categoryKey: "community", part: loc("학교보건","School Health"), emoji: "🏫", title: loc("학교 감염병 관리","School Outbreak Management"), desc: loc(`학교에서 수두 환아가 발생했을 때 보건교사의 가장 적절한 우선 조치는?`,`A varicella case appears at school. What is the school nurse's best first action?`), choices: shuffle([{ text: loc("학생을 즉시 등교중지(격리)시키고 보호자 및 교육청에 보고한다","Immediately exclude the student and notify guardians and the education office"), effect: { hp: -2, rep: 22 }, log: loc("정답. 등교중지·보고가 학교 감염병 관리의 핵심입니다.","Correct. Exclusion and reporting are the core actions.") }, { text: loc("학급 학생들에게 비밀을 유지하고 평소대로 진행한다","Keep it confidential and proceed as usual"), effect: { hp: -30, rep: -20 }, log: loc("감염 확산을 방치하는 위법행위입니다.","Allowing spread is a violation.") }, { text: loc("환아를 격리하지 않고 양호실에서 관찰만 한다","Just observe the student in the school clinic without isolation"), effect: { hp: -25, rep: -15 }, log: loc("수두는 공기 전파로 즉시 등교중지가 필요합니다.","Varicella spreads via airborne route — immediate exclusion required.") }, { text: loc("학급 전체에 항생제를 예방 투여한다","Give the entire class prophylactic antibiotics"), effect: { hp: -30, rep: -20 }, log: loc("수두는 바이러스로 항생제가 무효합니다.","Varicella is viral — antibiotics are useless.") }]) }; }
function generateIsolationQuestion() {
    const diseases = [
        { ko: "수두", en: "Varicella", correctKo: "공기주의 + 접촉주의", correctEn: "Airborne + Contact precautions" },
        { ko: "결핵", en: "Tuberculosis", correctKo: "공기주의", correctEn: "Airborne precautions" },
        { ko: "백일해", en: "Pertussis", correctKo: "비말주의", correctEn: "Droplet precautions" },
        { ko: "MRSA", en: "MRSA", correctKo: "접촉주의", correctEn: "Contact precautions" },
    ];
    const target = pick(diseases); const wrongs = diseases.filter(d => d !== target);
    const tName = loc(target.ko, target.en);
    return { baseId: "isolation", categoryKey: "fundamentals", part: loc("감염관리","Infection Control"), emoji: "🦠",
        title: loc("격리 지침","Isolation Precautions"),
        desc: loc(`${tName} 환자에게 적용해야 할 격리 지침은?`, `What isolation precaution applies to a ${tName} patient?`),
        choices: shuffle([
            { text: loc(target.correctKo, target.correctEn), effect: { hp: -2, rep: 20 }, log: loc(`정답. ${tName}의 표준 격리 지침입니다.`, `Correct. Standard precaution for ${tName}.`) },
            { text: loc(wrongs[0].correctKo, wrongs[0].correctEn), effect: { hp: -20, rep: -10 }, log: loc("다른 질환의 격리 지침입니다.","Applies to a different disease.") },
            { text: loc(wrongs[1].correctKo, wrongs[1].correctEn), effect: { hp: -20, rep: -10 }, log: loc("전파 경로에 맞지 않는 격리입니다.","Wrong transmission route.") },
            { text: loc("역격리(보호격리)","Protective (reverse) isolation"), effect: { hp: -25, rep: -15 }, log: loc("역격리는 면역저하 환자 보호용입니다.","Protective isolation is for immunocompromised patients.") }
        ])
    };
}
function generatePainQuestion() { return { baseId: "pain", categoryKey: "fundamentals", part: loc("통증","Pain"), emoji: "😣", title: loc("통증 사정","Pain Assessment"), desc: loc(`의식이 명료한 성인 환자의 통증 사정에서 가장 신뢰할 수 있는 자료는?`,`Most reliable data for pain assessment in an alert adult?`), choices: shuffle([{ text: loc("환자가 직접 진술하는 통증의 강도와 양상","The patient's own report of intensity and quality"), effect: { hp: -2, rep: 20 }, log: loc("정답. 통증은 주관적 경험으로 본인 진술이 가장 신뢰성 높습니다.","Correct. Pain is subjective — self-report is most reliable.") }, { text: loc("활력징후의 변화로 통증 정도를 객관적으로 판정한다","Use vital sign changes to objectively rate pain"), effect: { hp: -20, rep: -10 }, log: loc("활력징후는 보조 지표일 뿐입니다.","Vital signs are supportive indicators only.") }, { text: loc("보호자가 관찰한 환자의 표정과 행동","Caregiver's observations of facial expression and behavior"), effect: { hp: -20, rep: -10 }, log: loc("본인 진술 우선이며 보조 지표입니다.","Self-report comes first; this is supportive.") }, { text: loc("이전 입원기록의 통증 점수","Pain scores from prior hospitalization"), effect: { hp: -25, rep: -15 }, log: loc("현재 통증 사정에 부적절합니다.","Not appropriate for current assessment.") }]) }; }
function generateGCSQuestion() { return { baseId: "gcs", categoryKey: "adult", part: loc("신경계","Neurology"), emoji: "👁️", title: loc("GCS 판정","GCS Scoring"), desc: loc(`환자가 통증자극에 눈을 뜨고(E2), 부적절한 단어로 신음(V3), 자극에 회피반응(M4)을 보인다. GCS 점수와 의미는?`,`Patient opens eyes to pain (E2), uses inappropriate words (V3), withdraws from pain (M4). GCS total and meaning?`), choices: shuffle([{ text: loc("9점, 중등도 의식장애","9 — moderate impairment"), effect: { hp: -3, rep: 22 }, log: loc("정답. 2+3+4=9점이며 9~12점은 중등도입니다.","Correct. 2+3+4=9; 9–12 is moderate.") }, { text: loc("15점, 정상","15 — normal"), effect: { hp: -25, rep: -15 }, log: loc("15점은 모든 항목 만점입니다.","15 means full marks on all items.") }, { text: loc("5점, 혼수상태","5 — coma"), effect: { hp: -25, rep: -15 }, log: loc("GCS 8점 이하가 혼수입니다.","≤8 is coma.") }, { text: loc("12점, 경증","12 — minor"), effect: { hp: -20, rep: -10 }, log: loc("계산 오류입니다.","Calculation error.") }]) }; }
function generateRenalFailureQuestion() { return { baseId: "renalFailure", categoryKey: "adult", part: loc("비뇨기","Urology"), emoji: "🫘", title: loc("만성신부전 식이","CKD Diet"), desc: loc(`만성신부전(투석 전) 환자에게 권장되는 식이로 옳은 것은?`,`Recommended diet for a chronic kidney disease patient (pre-dialysis)?`), choices: shuffle([{ text: loc("저단백, 저칼륨, 저인 식이를 제공한다","Low-protein, low-potassium, low-phosphorus diet"), effect: { hp: -2, rep: 22 }, log: loc("정답. 신장 부담을 줄이는 식이입니다.","Correct. Reduces kidney workload.") }, { text: loc("고단백, 고칼륨 식이로 영양을 보충한다","High-protein, high-potassium diet for nutrition"), effect: { hp: -30, rep: -20 }, log: loc("단백질·칼륨 과다는 신장에 치명적입니다.","Excess protein/potassium harms the kidney.") }, { text: loc("수분을 무제한 섭취하여 노폐물을 배출한다","Drink unlimited fluids to flush wastes"), effect: { hp: -30, rep: -20 }, log: loc("수분 제한이 필요한 단계입니다.","Fluid restriction is indicated.") }, { text: loc("바나나·오렌지·감자 같은 과일채소를 충분히 먹는다","Plenty of bananas, oranges, and potatoes"), effect: { hp: -25, rep: -15 }, log: loc("고칼륨 식품으로 제한 대상입니다.","High-potassium foods to be restricted.") }]) }; }
function generatePostOpQuestion() { return { baseId: "postop", categoryKey: "adult", part: loc("수술간호","Surgical"), emoji: "🏨", title: loc("수술 후 합병증 예방","Postop Complication Prevention"), desc: loc(`복부수술 후 무기폐와 폐렴을 예방하기 위한 가장 효과적인 간호중재는?`,`Most effective intervention to prevent atelectasis/pneumonia after abdominal surgery?`), choices: shuffle([{ text: loc("강화 폐활량계(IS) 사용과 심호흡·기침을 정기적으로 격려한다","Regular incentive spirometry, deep breathing, and coughing"), effect: { hp: -2, rep: 20 }, log: loc("정답. 폐 확장 운동이 합병증 예방의 핵심입니다.","Correct. Lung expansion is the key.") }, { text: loc("통증으로 호흡을 자제하도록 권한다","Encourage shallow breathing to avoid pain"), effect: { hp: -30, rep: -20 }, log: loc("얕은 호흡은 무기폐를 유발합니다.","Shallow breathing causes atelectasis.") }, { text: loc("절대안정으로 침상에서 움직이지 않게 한다","Strict bed rest with no movement"), effect: { hp: -25, rep: -15 }, log: loc("조기 이상이 오히려 합병증을 줄입니다.","Early ambulation actually reduces complications.") }, { text: loc("산소포화도가 정상이면 기침을 금지시킨다","Forbid coughing if SpO2 is normal"), effect: { hp: -25, rep: -15 }, log: loc("분비물 배출을 위해 기침이 필요합니다.","Coughing is needed to clear secretions.") }]) }; }
function generateHeartFailureQuestion() { return { baseId: "heartFailure", categoryKey: "adult", part: loc("심혈관","Cardiovascular"), emoji: "💔", title: loc("심부전 환자 체위","Heart Failure Positioning"), desc: loc(`급성 좌심부전으로 호흡곤란을 호소하는 환자에게 취해주어야 할 가장 적절한 체위는?`,`Best position for an acute left heart failure patient with dyspnea?`), choices: shuffle([{ text: loc("다리를 침상 아래로 내린 좌위(High Fowler's, 다리 하수)","High Fowler's with legs dangling"), effect: { hp: -2, rep: 22 }, log: loc("정답. 정맥귀환 감소로 폐울혈을 완화합니다.","Correct. Reduces venous return and pulmonary congestion.") }, { text: loc("다리를 높이는 트렌델렌버그 체위","Trendelenburg with legs elevated"), effect: { hp: -35, rep: -25 }, log: loc("정맥귀환 증가로 폐부종이 악화됩니다.","Increases venous return and worsens pulmonary edema.") }, { text: loc("엎드린 자세(복위)","Prone position"), effect: { hp: -30, rep: -20 }, log: loc("흉부 확장이 제한되어 호흡이 더 어려워집니다.","Restricts chest expansion.") }, { text: loc("왼쪽으로 누운 좌측위","Left lateral position"), effect: { hp: -20, rep: -10 }, log: loc("호흡곤란 환자에 권장되는 체위가 아닙니다.","Not recommended for dyspneic patients.") }]) }; }

// ========= 추가 기출 변형 2차 (대규모 확장) =========
function generateVitalSignQuestion() { return { baseId: "vitalSign", categoryKey: "fundamentals", part: loc("활력징후","Vital Signs"), emoji: "🌡️", title: loc("성인 활력징후 정상범위","Adult Normal Vital Signs"), desc: loc(`다음 중 성인의 활력징후 정상 범위로 옳은 것은?`,`Which is the correct normal adult vital sign range?`), choices: shuffle([{ text: loc("체온 36.5~37.2℃, 맥박 60~100회/분, 호흡 12~20회/분","Temp 36.5–37.2°C, HR 60–100/min, RR 12–20/min"), effect: { hp: -2, rep: 18 }, log: loc("정답. 표준 정상 활력징후 범위입니다.","Correct. Standard normal range.") }, { text: loc("체온 38.5℃, 맥박 50회/분, 호흡 25회/분","Temp 38.5°C, HR 50/min, RR 25/min"), effect: { hp: -25, rep: -15 }, log: loc("발열·서맥·빈호흡으로 비정상입니다.","Fever, bradycardia, tachypnea — abnormal.") }, { text: loc("체온 35℃, 맥박 110회/분, 호흡 8회/분","Temp 35°C, HR 110/min, RR 8/min"), effect: { hp: -25, rep: -15 }, log: loc("저체온·빈맥·호흡억제 상태입니다.","Hypothermia, tachycardia, respiratory depression.") }, { text: loc("체온 37.5℃, 맥박 130회/분, 호흡 30회/분","Temp 37.5°C, HR 130/min, RR 30/min"), effect: { hp: -25, rep: -15 }, log: loc("전반적으로 비정상 수치입니다.","All values abnormal.") }]) }; }
function generateMedication5RQuestion() { return { baseId: "medication5R", categoryKey: "fundamentals", part: loc("투약","Medication"), emoji: "💊", title: loc("투약의 5원칙","Five Rights of Medication"), desc: loc(`투약의 5원칙(5R)에 해당하지 않는 것은?`,`Which is NOT one of the 5 Rights of medication administration?`), choices: shuffle([{ text: loc("정확한 의사(Right Doctor)","Right Doctor"), effect: { hp: -2, rep: 18 }, log: loc("정답. 5원칙은 환자·약명·용량·경로·시간이며 의사는 포함되지 않습니다.","Correct. The 5 Rs are patient, drug, dose, route, time — not the doctor.") }, { text: loc("정확한 환자(Right Patient)","Right Patient"), effect: { hp: -15, rep: -10 }, log: loc("5R에 포함됩니다.","Part of the 5 Rs.") }, { text: loc("정확한 용량(Right Dose)","Right Dose"), effect: { hp: -15, rep: -10 }, log: loc("5R에 포함됩니다.","Part of the 5 Rs.") }, { text: loc("정확한 경로(Right Route)","Right Route"), effect: { hp: -15, rep: -10 }, log: loc("5R에 포함됩니다.","Part of the 5 Rs.") }]) }; }
function generateNGTubeQuestion() { return { baseId: "ngTube", categoryKey: "fundamentals", part: loc("비위관","NG Tube"), emoji: "👃", title: loc("비위관 위치 확인","NG Tube Placement Check"), desc: loc(`비위관 영양 시작 전 위치 확인을 위한 가장 신뢰할 수 있는 방법은?`,`Most reliable bedside method to verify NG tube placement before feeding?`), choices: shuffle([{ text: loc("흡인된 위 내용물의 pH 측정(pH 4 이하)","Aspirate gastric contents and measure pH (≤4)"), effect: { hp: -2, rep: 20 }, log: loc("정답. 위 내용물 pH 확인이 침상 옆 가장 신뢰성 높은 방법입니다.","Correct. pH check is most reliable bedside method.") }, { text: loc("공기를 주입하며 청진하는 방법만으로 확인","Insufflate air and auscultate alone"), effect: { hp: -25, rep: -15 }, log: loc("공기 청진법은 단독 사용이 권장되지 않습니다.","Auscultation alone is not recommended.") }, { text: loc("환자가 말을 할 수 있으면 정상 위치이다","If patient can speak, placement is correct"), effect: { hp: -30, rep: -20 }, log: loc("기관 삽입 시에도 말이 가능할 수 있습니다.","Patient may speak even with tracheal misplacement.") }, { text: loc("튜브 끝을 물에 넣어 기포가 안 나오면 위치가 옳다","Submerge tube end in water — no bubbles = correct"), effect: { hp: -35, rep: -25 }, log: loc("비과학적이며 흡인 위험을 놓칩니다.","Unscientific — misses aspiration risk.") }]) }; }
function generateHandWashingQuestion() { return { baseId: "handWashing", categoryKey: "fundamentals", part: loc("감염관리","Infection Control"), emoji: "🧼", title: loc("내과적 손 씻기","Medical Handwashing"), desc: loc(`내과적 손씻기 시 가장 적절한 방법은?`,`Most appropriate technique for medical handwashing?`), choices: shuffle([{ text: loc("손끝을 아래로 향하게 하고 흐르는 물에 비누로 30초 이상 씻는다","Hold fingertips down, scrub with soap under running water ≥30 seconds"), effect: { hp: -2, rep: 20 }, log: loc("정답. 오염원이 팔에서 손으로 흐르게 합니다.","Correct. Lets contaminants flow from arm to fingertips.") }, { text: loc("손끝을 팔꿈치보다 위로 올려 씻는다","Hold fingertips above the elbow"), effect: { hp: -25, rep: -15 }, log: loc("외과적 손씻기 방법입니다.","That's surgical scrub technique.") }, { text: loc("물 절약을 위해 정지된 물에 담가 씻는다","Soak hands in standing water to save water"), effect: { hp: -25, rep: -15 }, log: loc("흐르는 물이 표준입니다.","Running water is standard.") }, { text: loc("비누를 사용하지 않고 5초간 헹군다","Rinse for 5 seconds without soap"), effect: { hp: -30, rep: -20 }, log: loc("감염관리에 부적절합니다.","Inadequate for infection control.") }]) }; }
function generateOxygenDeliveryQuestion() { return { baseId: "oxygenDelivery", categoryKey: "fundamentals", part: loc("산소요법","Oxygen Therapy"), emoji: "🫁", title: loc("산소공급 기구","Oxygen Delivery Device"), desc: loc(`100%에 가까운 고농도 산소를 공급해야 할 때 가장 적절한 기구는?`,`Best device when near-100% oxygen delivery is needed?`), choices: shuffle([{ text: loc("비재호흡 마스크(Non-rebreather mask)","Non-rebreather mask"), effect: { hp: -2, rep: 20 }, log: loc("정답. 10~15L/min에서 60~100% 농도가 가능합니다.","Correct. 60–100% FiO2 at 10–15 L/min.") }, { text: loc("비강캐뉼라(Nasal cannula)","Nasal cannula"), effect: { hp: -20, rep: -10 }, log: loc("최대 24~44%에 머무릅니다.","Limited to 24–44%.") }, { text: loc("단순 마스크(Simple mask)","Simple mask"), effect: { hp: -20, rep: -10 }, log: loc("약 35~55% 정도 공급됩니다.","Provides about 35–55%.") }, { text: loc("Venturi mask 24%","Venturi mask 24%"), effect: { hp: -25, rep: -15 }, log: loc("정확한 저농도 공급용입니다.","Used for precise low-dose delivery.") }]) }; }
function generateThyroidStormQuestion() { return { baseId: "thyroidStorm", categoryKey: "adult", part: loc("내분비","Endocrine"), emoji: "🔥", title: loc("갑상선 위기(Storm)","Thyroid Storm"), desc: loc(`갑상선기능항진증 환자에게서 고열, 빈맥, 의식저하가 갑자기 나타날 때 가장 우선 중재는?`,`Hyperthyroid patient suddenly develops high fever, tachycardia, altered mental status. Priority?`), choices: shuffle([{ text: loc("냉각 요법과 PTU·베타차단제 투여를 준비한다","Initiate cooling and prepare PTU and beta-blocker"), effect: { hp: -3, rep: 22 }, log: loc("정답. 갑상선 위기는 응급으로 즉시 냉각·약물 투여가 필요합니다.","Correct. Thyroid storm requires immediate cooling and meds.") }, { text: loc("갑상선 호르몬을 추가 투여한다","Administer additional thyroid hormone"), effect: { hp: -50, rep: -40 }, log: loc("절대 금기. 위기를 악화시킵니다.","Absolute contraindication — worsens the storm.") }, { text: loc("전기담요로 보온한다","Apply electric warming blanket"), effect: { hp: -35, rep: -25 }, log: loc("고체온이므로 냉각이 필요합니다.","Patient is hyperthermic — needs cooling.") }, { text: loc("수분 섭취를 제한한다","Restrict fluid intake"), effect: { hp: -25, rep: -15 }, log: loc("탈수 보정과 수분 보충이 필요합니다.","Rehydration is needed.") }]) }; }
function generateHypothyroidQuestion() { return { baseId: "hypothyroid", categoryKey: "adult", part: loc("내분비","Endocrine"), emoji: "❄️", title: loc("갑상선기능저하증 증상","Hypothyroid Symptoms"), desc: loc(`갑상선기능저하증 환자에게서 가장 흔히 나타나는 증상은?`,`Most common symptom cluster in hypothyroidism?`), choices: shuffle([{ text: loc("추위 못 견딤, 체중 증가, 서맥, 변비, 피로","Cold intolerance, weight gain, bradycardia, constipation, fatigue"), effect: { hp: -2, rep: 20 }, log: loc("정답. 대사 저하로 인한 전형 증상입니다.","Correct. Classic from reduced metabolism.") }, { text: loc("더위 못 견딤, 체중 감소, 빈맥, 설사","Heat intolerance, weight loss, tachycardia, diarrhea"), effect: { hp: -20, rep: -15 }, log: loc("갑상선기능항진증 증상입니다.","Those are hyperthyroid symptoms.") }, { text: loc("다음·다뇨·다식과 체중 감소","Polydipsia, polyuria, polyphagia with weight loss"), effect: { hp: -20, rep: -10 }, log: loc("당뇨병 증상입니다.","That's diabetes mellitus.") }, { text: loc("두통과 야간 발한, 안구돌출","Headache, night sweats, exophthalmos"), effect: { hp: -25, rep: -15 }, log: loc("안구돌출은 항진증의 특징입니다.","Exophthalmos is hyperthyroidism.") }]) }; }
function generateGlaucomaQuestion() { return { baseId: "glaucoma", categoryKey: "adult", part: loc("감각기","Sensory"), emoji: "👁️", title: loc("녹내장 환자 교육","Glaucoma Teaching"), desc: loc(`녹내장 환자에게 가장 중요한 교육 내용은?`,`Most important teaching for a glaucoma patient?`), choices: shuffle([{ text: loc("처방된 안압하강제(축동제)를 평생 정확히 점안한다","Use prescribed IOP-lowering (miotic) drops accurately for life"), effect: { hp: -2, rep: 20 }, log: loc("정답. 안압 조절이 시신경 보호의 핵심입니다.","Correct. IOP control protects the optic nerve.") }, { text: loc("산동제를 자주 사용하여 동공을 크게 유지한다","Use mydriatics often to keep pupil dilated"), effect: { hp: -35, rep: -25 }, log: loc("산동은 안방수 흐름을 막아 절대 금기입니다.","Mydriasis blocks aqueous flow — contraindicated.") }, { text: loc("어두운 영화관에서 장시간 영화를 자주 본다","Spend long hours in dark theaters frequently"), effect: { hp: -25, rep: -15 }, log: loc("어두운 환경은 동공이 커져 안압을 올립니다.","Dark dilates pupils, raising IOP.") }, { text: loc("수분을 한 번에 많이 마셔 안압을 낮춘다","Drink large amounts of water at once to lower IOP"), effect: { hp: -25, rep: -15 }, log: loc("급격한 수분 섭취는 안압을 올립니다.","Rapid intake actually raises IOP.") }]) }; }
function generateCataractQuestion() { return { baseId: "cataract", categoryKey: "adult", part: loc("감각기","Sensory"), emoji: "👓", title: loc("백내장 수술 후 간호","Post-Cataract Care"), desc: loc(`백내장 수술 후 환자에게 가장 적절한 교육 내용은?`,`Most appropriate teaching after cataract surgery?`), choices: shuffle([{ text: loc("무거운 물건 들기, 머리 숙이기, 기침을 피한다","Avoid lifting heavy objects, bending, and coughing"), effect: { hp: -2, rep: 20 }, log: loc("정답. 안압 상승을 유발하는 활동을 피해야 합니다.","Correct. Avoid activities that raise IOP.") }, { text: loc("조속한 회복을 위해 곧바로 윗몸일으키기를 한다","Do sit-ups immediately for fast recovery"), effect: { hp: -30, rep: -20 }, log: loc("안압을 급격히 올리는 행위는 절대 금기입니다.","Contraindicated — spikes IOP.") }, { text: loc("가려우면 손으로 비빈다","Rub the eye when itchy"), effect: { hp: -30, rep: -20 }, log: loc("감염 및 봉합부 손상의 위험이 큽니다.","Major infection and wound risk.") }, { text: loc("수술 부위를 위로 가게 옆으로 누워 잔다","Sleep on the operated side facing up"), effect: { hp: -20, rep: -10 }, log: loc("수술한 쪽이 위로 오게 누워야 압력을 피합니다.","Operated side should be up to avoid pressure.") }]) }; }
function generateFractureQuestion() { return { baseId: "fracture", categoryKey: "adult", part: loc("근골격계","Musculoskeletal"), emoji: "🦴", title: loc("석고붕대 후 5P 사정","Cast Care · 5 Ps"), desc: loc(`장하지 석고붕대 적용 환자에게서 가장 우선 사정해야 할 5P 신경혈관 증상은?`,`Most important neurovascular 5 Ps to assess after a long-leg cast?`), choices: shuffle([{ text: loc("통증·창백·맥박소실·마비·감각이상","Pain, Pallor, Pulselessness, Paralysis, Paresthesia"), effect: { hp: -3, rep: 22 }, log: loc("정답. 구획증후군의 5P 증상입니다.","Correct. The 5 Ps of compartment syndrome.") }, { text: loc("발열·발한·기침·오심·구토","Fever, sweating, cough, nausea, vomiting"), effect: { hp: -25, rep: -15 }, log: loc("신경혈관 사정과 무관합니다.","Unrelated to neurovascular check.") }, { text: loc("두통·시야흐림·이명·어지럼","Headache, blurred vision, tinnitus, dizziness"), effect: { hp: -25, rep: -15 }, log: loc("신경혈관 사정과 무관합니다.","Unrelated to neurovascular check.") }, { text: loc("복부팽만·변비·식욕부진","Distention, constipation, anorexia"), effect: { hp: -25, rep: -15 }, log: loc("위장관 증상입니다.","GI symptoms.") }]) }; }
function generateSpinalCordQuestion() { return { baseId: "spinalCord", categoryKey: "adult", part: loc("신경계","Neurology"), emoji: "🦽", title: loc("척추손상 환자 이동","Spinal Injury Transfer"), desc: loc(`경추손상이 의심되는 외상 환자를 이동시킬 때 가장 중요한 원칙은?`,`Most important principle when moving a suspected cervical spine injury?`), choices: shuffle([{ text: loc("통나무 굴리기(log roll)로 척추를 일직선 유지하며 이동한다","Log-roll keeping the spine in a straight line"), effect: { hp: -2, rep: 22 }, log: loc("정답. 척추 정렬 유지가 추가 손상 예방의 핵심입니다.","Correct. Spinal alignment prevents further injury.") }, { text: loc("환자가 아프지 않은 자세를 스스로 취하게 둔다","Let the patient assume any comfortable position"), effect: { hp: -40, rep: -30 }, log: loc("척추 추가 손상의 위험이 큽니다.","High risk of additional spinal injury.") }, { text: loc("허리를 굽혀 부드럽게 안아 옮긴다","Bend at the waist and lift gently"), effect: { hp: -40, rep: -30 }, log: loc("척추 굴곡은 절대 금기입니다.","Spinal flexion is absolutely contraindicated.") }, { text: loc("한 명이 머리만 들고 다른 한 명이 다리를 든다","One lifts the head, another lifts the legs"), effect: { hp: -35, rep: -25 }, log: loc("척추 정렬이 흐트러집니다.","Disrupts spinal alignment.") }]) }; }
function generatePEQuestion() { return { baseId: "pe", categoryKey: "adult", part: loc("호흡기","Respiratory"), emoji: "🫁", title: loc("폐색전증","Pulmonary Embolism"), desc: loc(`장기간 침상 안정 후 갑작스러운 흉통, 호흡곤란, 빈맥을 호소하는 환자에게 의심되는 진단은?`,`After prolonged bed rest, sudden chest pain, dyspnea, tachycardia. Suspect?`), choices: shuffle([{ text: loc("폐색전증(PE)","Pulmonary embolism (PE)"), effect: { hp: -3, rep: 22 }, log: loc("정답. 부동에 의한 심부정맥혈전이 폐로 색전된 상태입니다.","Correct. DVT from immobility embolizes to lung.") }, { text: loc("단순 과호흡 증후군","Simple hyperventilation syndrome"), effect: { hp: -30, rep: -20 }, log: loc("급박한 응급상황을 놓칩니다.","Misses an urgent emergency.") }, { text: loc("위식도역류 질환","GERD"), effect: { hp: -30, rep: -20 }, log: loc("흉통의 응급 원인이 아닙니다.","Not an emergency cause of chest pain.") }, { text: loc("긴장성 두통","Tension headache"), effect: { hp: -30, rep: -20 }, log: loc("호흡곤란과 무관합니다.","Unrelated to dyspnea.") }]) }; }
function generatePepticUlcerQuestion() { return { baseId: "pepticUlcer", categoryKey: "adult", part: loc("소화기","GI"), emoji: "🍽️", title: loc("소화성궤양 식이","Peptic Ulcer Diet"), desc: loc(`소화성궤양 환자에게 권장되는 식이 교육으로 옳은 것은?`,`Correct diet teaching for peptic ulcer?`), choices: shuffle([{ text: loc("규칙적인 시간에 소량씩 자주 식사하고 자극적 음식·카페인을 피한다","Regular small frequent meals, avoid spicy foods and caffeine"), effect: { hp: -2, rep: 20 }, log: loc("정답. 위산 분비 자극을 줄이는 식이 원칙입니다.","Correct. Reduces gastric acid stimulation.") }, { text: loc("공복 통증 시 진한 커피를 마신다","Drink strong coffee when stomach hurts"), effect: { hp: -30, rep: -20 }, log: loc("카페인은 위산 분비를 촉진합니다.","Caffeine stimulates acid.") }, { text: loc("취침 직전 우유를 마시면 좋다","Drink milk right before bed"), effect: { hp: -25, rep: -15 }, log: loc("야간 위산 분비를 자극합니다.","Stimulates nocturnal acid.") }, { text: loc("통증이 줄면 약을 임의로 중단해도 된다","Stop meds on your own once pain eases"), effect: { hp: -30, rep: -20 }, log: loc("재발과 출혈 위험이 큽니다.","High risk of recurrence and bleeding.") }]) }; }
function generatePancreatitisQuestion() { return { baseId: "pancreatitis", categoryKey: "adult", part: loc("소화기","GI"), emoji: "🥩", title: loc("급성 췌장염","Acute Pancreatitis"), desc: loc(`급성 췌장염 환자에게 가장 중요한 초기 간호중재는?`,`Most important early intervention for acute pancreatitis?`), choices: shuffle([{ text: loc("금식(NPO)과 비위관 흡인으로 췌장 휴식을 유도한다","NPO and NG suction to rest the pancreas"), effect: { hp: -2, rep: 22 }, log: loc("정답. 췌장 자극을 줄이는 것이 핵심입니다.","Correct. Minimizes pancreatic stimulation.") }, { text: loc("고지방 고단백 식이를 충분히 제공한다","Plenty of high-fat, high-protein diet"), effect: { hp: -35, rep: -25 }, log: loc("췌장 분비를 자극해 악화시킵니다.","Stimulates pancreatic secretion — worsens.") }, { text: loc("통증 시 모르핀(Morphine)을 우선 선택한다","Choose morphine first for pain"), effect: { hp: -25, rep: -15 }, log: loc("Oddi 괄약근을 수축시켜 권장되지 않습니다(메페리딘 선호).","Constricts sphincter of Oddi (meperidine preferred).") }, { text: loc("복부 마사지로 통증을 완화시킨다","Relieve pain with abdominal massage"), effect: { hp: -30, rep: -20 }, log: loc("복부 조작은 금기입니다.","Abdominal manipulation is contraindicated.") }]) }; }
function generateAppendicitisQuestion() { return { baseId: "appendicitis", categoryKey: "adult", part: loc("소화기","GI"), emoji: "🤕", title: loc("충수염 의심 환자","Suspected Appendicitis"), desc: loc(`우하복부 통증, 발열, McBurney 압통이 있는 환자에게 절대 하지 말아야 할 것은?`,`What is absolutely contraindicated in a patient with RLQ pain, fever, and McBurney's tenderness?`), choices: shuffle([{ text: loc("복부 따뜻한 찜질팩과 관장을 시행한다","Apply warm abdominal pack and give an enema"), effect: { hp: -3, rep: 22 }, log: loc("정답(이것이 금기). 따뜻한 자극과 관장은 천공을 유발합니다.","Correct (the contraindicated one). Heat and enemas can cause perforation.") }, { text: loc("금식 시키고 활력징후를 자주 측정한다","NPO and frequent vital signs"), effect: { hp: -15, rep: -10 }, log: loc("올바른 간호입니다.","Correct nursing care.") }, { text: loc("수액을 투여하고 수술 준비를 돕는다","Give IV fluids and prepare for surgery"), effect: { hp: -15, rep: -10 }, log: loc("올바른 간호입니다.","Correct nursing care.") }, { text: loc("압통 부위에 차가운 얼음팩을 적용한다","Apply a cold pack over the tender area"), effect: { hp: -15, rep: -10 }, log: loc("차가운 자극은 비교적 안전합니다.","Cold is relatively safe.") }]) }; }
function generateAnemiaQuestion() { return { baseId: "anemia", categoryKey: "adult", part: loc("혈액","Hematology"), emoji: "🩸", title: loc("철결핍성 빈혈 식이","Iron-Deficiency Anemia Diet"), desc: loc(`철결핍성 빈혈 환자의 철분 흡수를 가장 잘 돕는 음식 조합은?`,`Best combination to enhance iron absorption in iron-deficiency anemia?`), choices: shuffle([{ text: loc("붉은 살코기와 비타민C가 풍부한 오렌지 주스","Red lean meat with vitamin C-rich orange juice"), effect: { hp: -2, rep: 20 }, log: loc("정답. 비타민C는 철 흡수를 돕습니다.","Correct. Vitamin C boosts iron absorption.") }, { text: loc("철분제와 우유를 함께 복용","Take iron with milk"), effect: { hp: -25, rep: -15 }, log: loc("칼슘은 철 흡수를 방해합니다.","Calcium blocks iron absorption.") }, { text: loc("철분제와 진한 차 또는 커피","Iron with strong tea or coffee"), effect: { hp: -25, rep: -15 }, log: loc("탄닌은 철 흡수를 억제합니다.","Tannins inhibit iron absorption.") }, { text: loc("제산제와 함께 복용한다","Take with antacids"), effect: { hp: -25, rep: -15 }, log: loc("위산 저하로 흡수가 감소합니다.","Reduced gastric acid impairs absorption.") }]) }; }
function generateLiverCirrhosisQuestion() { return { baseId: "liverCirrhosis", categoryKey: "adult", part: loc("소화기","GI"), emoji: "🟡", title: loc("간경화 합병증","Cirrhosis Complication"), desc: loc(`간경화 말기 환자에게 의식 변화와 손떨림(asterixis)이 나타날 때 가장 의심되는 합병증은?`,`Late-stage cirrhosis with altered mental status and asterixis. Most likely complication?`), choices: shuffle([{ text: loc("간성 혼수(간성 뇌증)","Hepatic encephalopathy"), effect: { hp: -3, rep: 22 }, log: loc("정답. 암모니아 축적에 의한 의식 변화입니다.","Correct. Ammonia accumulation alters consciousness.") }, { text: loc("간성 빈혈","Hepatic anemia"), effect: { hp: -25, rep: -15 }, log: loc("의식 변화의 주된 원인이 아닙니다.","Not a main cause of altered consciousness.") }, { text: loc("단순 저혈당","Simple hypoglycemia"), effect: { hp: -25, rep: -15 }, log: loc("asterixis가 나타나지 않습니다.","Doesn't cause asterixis.") }, { text: loc("탈수성 어지럼","Dehydration-related dizziness"), effect: { hp: -25, rep: -15 }, log: loc("특징적 임상양상이 다릅니다.","Different clinical pattern.") }]) }; }
function generateEctopicQuestion() { return { baseId: "ectopic", categoryKey: "maternal", part: loc("임신합병증","Pregnancy Complication"), emoji: "🚑", title: loc("자궁외임신","Ectopic Pregnancy"), desc: loc(`임신 8주 산모가 갑작스러운 일측 하복부 통증과 어깨 방사통, 저혈압을 호소한다. 의심되는 상태는?`,`8-week pregnant patient: sudden one-sided lower abdominal pain, shoulder pain, hypotension. Suspect?`), choices: shuffle([{ text: loc("자궁외임신 파열","Ruptured ectopic pregnancy"), effect: { hp: -3, rep: 22 }, log: loc("정답. 응급수술이 필요한 출혈성 응급상황입니다.","Correct. Hemorrhagic emergency requiring surgery.") }, { text: loc("정상 입덧(임신오조)","Normal hyperemesis gravidarum"), effect: { hp: -35, rep: -25 }, log: loc("응급상황을 놓칩니다.","Misses the emergency.") }, { text: loc("단순 변비","Simple constipation"), effect: { hp: -35, rep: -25 }, log: loc("어깨 방사통과 저혈압을 설명할 수 없습니다.","Can't explain referred shoulder pain or hypotension.") }, { text: loc("정상 분만진통의 시작","Onset of normal labor"), effect: { hp: -35, rep: -25 }, log: loc("8주에 분만진통은 부적절합니다.","Labor at 8 weeks is inappropriate.") }]) }; }
function generatePlacentaPreviaQuestion() { return { baseId: "placentaPrevia", categoryKey: "maternal", part: loc("임신합병증","Pregnancy Complication"), emoji: "🤰", title: loc("전치태반","Placenta Previa"), desc: loc(`임신 후기에 통증 없이 선홍색 질출혈이 갑자기 발생한 산모에게 절대 금기인 행위는?`,`Late-pregnancy patient with sudden painless bright-red vaginal bleeding. What is contraindicated?`), choices: shuffle([{ text: loc("내진(질식 진찰)","Vaginal/digital examination"), effect: { hp: -3, rep: 22 }, log: loc("정답. 전치태반 의심 시 내진은 출혈을 악화시켜 금기입니다.","Correct. Vaginal exam may worsen bleeding — contraindicated.") }, { text: loc("초음파로 태반 위치를 확인한다","Confirm placental position with ultrasound"), effect: { hp: -15, rep: -10 }, log: loc("올바른 진단법입니다.","Appropriate diagnostic.") }, { text: loc("절대안정과 활력징후 모니터링","Strict bed rest and vital sign monitoring"), effect: { hp: -15, rep: -10 }, log: loc("올바른 간호입니다.","Appropriate care.") }, { text: loc("정맥로 확보 및 수액 공급","Establish IV access and provide fluids"), effect: { hp: -15, rep: -10 }, log: loc("올바른 응급간호입니다.","Appropriate emergency care.") }]) }; }
function generateAbruptionQuestion() { return { baseId: "abruption", categoryKey: "maternal", part: loc("임신합병증","Pregnancy Complication"), emoji: "🩸", title: loc("태반조기박리","Placental Abruption"), desc: loc(`임신 후기 산모가 \"판자처럼 단단한 자궁\"과 검붉은 출혈, 심한 복통을 호소한다. 우선 중재는?`,`Late-pregnancy patient: rigid "board-like" uterus, dark-red bleeding, severe abdominal pain. Priority?`), choices: shuffle([{ text: loc("측위로 안정시키고 산소를 공급하며 응급 제왕절개를 준비한다","Lateral position, oxygen, and prepare for emergency C-section"), effect: { hp: -3, rep: 22 }, log: loc("정답. 태반조기박리는 산모·태아 모두 응급입니다.","Correct. Abruption is an emergency for both mother and fetus.") }, { text: loc("유도분만으로 자연분만을 시도한다","Attempt induction for vaginal delivery"), effect: { hp: -35, rep: -25 }, log: loc("자연분만 시도 중 사망 위험이 큽니다.","High mortality risk during attempted vaginal delivery.") }, { text: loc("수축을 늦추기 위해 자궁수축억제제를 투여한다","Give a tocolytic to slow contractions"), effect: { hp: -30, rep: -20 }, log: loc("박리에는 적용되지 않습니다.","Not indicated for abruption.") }, { text: loc("출혈량이 적어 경과만 관찰한다","Just observe — bleeding is minimal"), effect: { hp: -40, rep: -30 }, log: loc("내부 출혈이 클 수 있어 위험합니다.","Concealed bleeding may be massive.") }]) }; }
function generateNeonatalJaundiceQuestion() { return { baseId: "neonatalJaundice", categoryKey: "pediatric", part: loc("신생아","Newborn"), emoji: "👶", title: loc("광선치료","Phototherapy"), desc: loc(`생리적 황달로 광선치료를 받는 신생아의 간호로 옳은 것은?`,`Correct nursing care for a newborn under phototherapy for physiologic jaundice?`), choices: shuffle([{ text: loc("안대를 적용하고 기저귀만 채운 채 수시로 체위 변경한다","Apply eye shields, leave only the diaper on, reposition frequently"), effect: { hp: -2, rep: 22 }, log: loc("정답. 망막 보호와 전신 노출이 모두 필요합니다.","Correct. Retinal protection and full-body exposure are both needed.") }, { text: loc("보온을 위해 옷을 두껍게 입힌다","Bundle in heavy clothing for warmth"), effect: { hp: -30, rep: -20 }, log: loc("노출이 광선치료의 핵심입니다.","Exposure is the point of phototherapy.") }, { text: loc("오일이나 로션을 충분히 발라준다","Apply plenty of oil or lotion"), effect: { hp: -25, rep: -15 }, log: loc("오일·로션은 화상 위험을 증가시킵니다.","Oils/lotions raise burn risk.") }, { text: loc("수분 섭취를 줄여 체온 손실을 막는다","Restrict fluids to prevent heat loss"), effect: { hp: -30, rep: -20 }, log: loc("광선치료 중 수분 손실이 늘어 보충이 필요합니다.","Fluid losses increase under phototherapy — supplement.") }]) }; }
function generateRHIncompatibilityQuestion() { return { baseId: "rh", categoryKey: "maternal", part: loc("혈액형부적합","Rh Incompatibility"), emoji: "🧬", title: loc("Rh 부적합 예방","Rh Incompatibility Prevention"), desc: loc(`Rh(-) 산모가 Rh(+) 신생아를 출산했을 때 RhoGAM 투여 시기로 옳은 것은?`,`Rh-negative mother delivered an Rh-positive newborn. Correct timing for RhoGAM?`), choices: shuffle([{ text: loc("분만 후 72시간 이내","Within 72 hours postpartum"), effect: { hp: -2, rep: 22 }, log: loc("정답. 다음 임신 감작을 예방하는 표준 시점입니다.","Correct. Standard timing to prevent sensitization for next pregnancy.") }, { text: loc("분만 후 1개월 이후","One month postpartum or later"), effect: { hp: -25, rep: -15 }, log: loc("예방 효과가 사라집니다.","Preventive effect is lost.") }, { text: loc("임신 사실 확인 즉시 1회만 투여","Single dose immediately upon confirming pregnancy"), effect: { hp: -20, rep: -10 }, log: loc("통상 28주와 분만 후 두 번 투여합니다.","Usually given at 28 weeks and again postpartum.") }, { text: loc("신생아에게 직접 투여한다","Administer to the newborn"), effect: { hp: -30, rep: -20 }, log: loc("RhoGAM은 산모용입니다.","RhoGAM is for the mother.") }]) }; }
function generateInfantNutritionQuestion() { return { baseId: "infantNutrition", categoryKey: "pediatric", part: loc("영양","Nutrition"), emoji: "🥕", title: loc("이유식 시작 시기","Solid Food Introduction"), desc: loc(`영아의 이유식을 시작하는 가장 적절한 시기는?`,`Best time to start solid foods for an infant?`), choices: shuffle([{ text: loc("생후 약 4~6개월(목 가눔, 혀 내밀기 반사 소실)","About 4–6 months (head control, loss of tongue-thrust reflex)"), effect: { hp: -2, rep: 20 }, log: loc("정답. WHO와 국내 권장 시점입니다.","Correct. WHO and national guideline.") }, { text: loc("생후 1개월부터 곡류 미음을 먹인다","Cereal porridge from 1 month"), effect: { hp: -30, rep: -20 }, log: loc("장 미성숙으로 알레르기 위험이 큽니다.","Immature gut — high allergy risk.") }, { text: loc("생후 12개월 이후 시작한다","Start after 12 months"), effect: { hp: -20, rep: -10 }, log: loc("철분 결핍과 발달 지연 위험이 있습니다.","Risk of iron deficiency and developmental delay.") }, { text: loc("출생 직후부터 분유와 함께 시작한다","Start at birth alongside formula"), effect: { hp: -35, rep: -25 }, log: loc("신생아에게는 절대 금기입니다.","Absolutely contraindicated for newborns.") }]) }; }
function generateAsthmaQuestion() { return { baseId: "asthma", categoryKey: "pediatric", part: loc("호흡기","Respiratory"), emoji: "💨", title: loc("소아 천식 발작","Pediatric Asthma Attack"), desc: loc(`학령기 아동이 갑작스러운 호기성 천명음과 호흡곤란을 호소할 때 가장 우선되는 중재는?`,`Sudden expiratory wheeze and dyspnea in a school-age child. Top intervention?`), choices: shuffle([{ text: loc("처방된 속효성 베타작용제(Salbutamol) 흡입을 시행한다","Administer ordered short-acting beta-agonist (Salbutamol) inhaler"), effect: { hp: -3, rep: 22 }, log: loc("정답. 급성 발작의 1차 약물입니다.","Correct. First-line for acute attack.") }, { text: loc("흡입 스테로이드를 단독으로 즉시 흡입시킨다","Inhaled corticosteroid alone immediately"), effect: { hp: -25, rep: -15 }, log: loc("흡입 스테로이드는 예방용입니다.","Inhaled steroids are for prevention.") }, { text: loc("기관지를 식히기 위해 차가운 공기를 마시게 한다","Have the child breathe cold air to cool airways"), effect: { hp: -30, rep: -20 }, log: loc("찬 공기는 기관지 수축을 악화시킵니다.","Cold air worsens bronchoconstriction.") }, { text: loc("복부에 압박을 가해 호흡을 도와준다","Apply abdominal pressure to assist breathing"), effect: { hp: -35, rep: -25 }, log: loc("호흡 보조에 부적절합니다.","Inappropriate for respiratory support.") }]) }; }
function generateOtitisMediaQuestion() { return { baseId: "otitisMedia", categoryKey: "pediatric", part: loc("감각기","Sensory"), emoji: "👂", title: loc("급성 중이염","Acute Otitis Media"), desc: loc(`급성 중이염 환아의 부모에게 제공하는 가장 적절한 교육은?`,`Best teaching for parents of a child with acute otitis media?`), choices: shuffle([{ text: loc("수유 시 머리를 세워 안고 먹이고 누운 채로 젖병을 물리지 않는다","Feed with head elevated and don't bottle-feed lying down"), effect: { hp: -2, rep: 20 }, log: loc("정답. 누운 자세 수유는 유스타키오관 역류로 중이염을 악화시킵니다.","Correct. Supine feeding causes Eustachian-tube reflux and worsens OM.") }, { text: loc("통증이 멈추면 항생제를 즉시 끊는다","Stop antibiotics as soon as pain resolves"), effect: { hp: -30, rep: -20 }, log: loc("처방 기간 끝까지 복용해야 합니다.","Must complete the full course.") }, { text: loc("면봉으로 외이도를 수시로 깊이 청소한다","Clean ear canal deeply and frequently with cotton swabs"), effect: { hp: -25, rep: -15 }, log: loc("고막 손상 위험이 있습니다.","Risk of tympanic membrane injury.") }, { text: loc("유아용 풀에서 자주 수영시킨다","Frequent swimming in a kiddie pool"), effect: { hp: -25, rep: -15 }, log: loc("수영은 회복 후 권장합니다.","Recommended after recovery only.") }]) }; }
function generateSchizophreniaQuestion() { return { baseId: "schizophrenia", categoryKey: "psych", part: loc("조현병","Schizophrenia"), emoji: "🧠", title: loc("조현병 음성 증상","Negative Symptoms of Schizophrenia"), desc: loc(`조현병의 음성 증상에 해당하는 것은?`,`Which describes negative symptoms of schizophrenia?`), choices: shuffle([{ text: loc("감정의 둔마, 무논리증, 무쾌감증","Affective flattening, alogia, anhedonia"), effect: { hp: -2, rep: 22 }, log: loc("정답. 정상 기능의 결핍이 음성 증상입니다.","Correct. Deficits of normal function = negative symptoms.") }, { text: loc("환각, 망상, 와해된 언어","Hallucinations, delusions, disorganized speech"), effect: { hp: -20, rep: -10 }, log: loc("양성 증상에 해당합니다.","Those are positive symptoms.") }, { text: loc("강박행동과 의식적 손씻기","Compulsive ritual handwashing"), effect: { hp: -25, rep: -15 }, log: loc("강박장애의 특징입니다.","Characteristic of OCD.") }, { text: loc("공황발작과 과호흡","Panic attacks and hyperventilation"), effect: { hp: -25, rep: -15 }, log: loc("공황장애의 특징입니다.","Characteristic of panic disorder.") }]) }; }
function generateBipolarQuestion() { return { baseId: "bipolar", categoryKey: "psych", part: loc("기분장애","Mood Disorder"), emoji: "🎢", title: loc("조증 환자 간호","Mania Care"), desc: loc(`조증 삽화 중인 환자에게 가장 적절한 간호중재는?`,`Best nursing intervention during a manic episode?`), choices: shuffle([{ text: loc("자극이 적은 단순한 환경을 제공하고 짧고 단순한 활동을 권한다","Provide low-stimulus environment and short, simple activities"), effect: { hp: -2, rep: 22 }, log: loc("정답. 자극 감소가 흥분 조절의 핵심입니다.","Correct. Reducing stimuli is key to controlling agitation.") }, { text: loc("단체 게임과 집단치료에 적극 참여시킨다","Push them into group games and therapy"), effect: { hp: -25, rep: -15 }, log: loc("자극이 과다해 흥분이 악화됩니다.","Overstimulation worsens agitation.") }, { text: loc("환자의 결정권 강화를 위해 모든 일과를 환자가 정하게 한다","Let the patient set their entire schedule"), effect: { hp: -25, rep: -15 }, log: loc("조절 안 된 환자에게 부적절합니다.","Inappropriate for an uncontrolled patient.") }, { text: loc("고열량의 격식 있는 식사를 식탁에서 천천히 먹게 한다","High-calorie formal meal eaten slowly at the table"), effect: { hp: -20, rep: -10 }, log: loc("조증 환자는 자리에 앉아있기 어려워 휴대 가능한 고열량 음식이 권장됩니다.","Manic patients can't sit still — portable high-calorie food preferred.") }]) }; }
function generateOCDQuestion() { return { baseId: "ocd", categoryKey: "psych", part: loc("강박장애","OCD"), emoji: "🔁", title: loc("강박장애 환자 간호","OCD Care"), desc: loc(`손씻기를 반복적으로 시행하는 강박장애 환자에 대한 초기 간호로 가장 적절한 것은?`,`Best initial intervention for an OCD patient with compulsive handwashing?`), choices: shuffle([{ text: loc("강박행동을 갑자기 막지 말고 시간을 두고 점진적으로 줄여간다","Don't abruptly block rituals; reduce them gradually over time"), effect: { hp: -2, rep: 22 }, log: loc("정답. 갑작스러운 차단은 불안을 폭증시킵니다.","Correct. Abrupt cessation triggers severe anxiety.") }, { text: loc("환자에게 즉시 강박행동을 멈추라고 단호히 지시한다","Firmly tell the patient to stop the ritual immediately"), effect: { hp: -25, rep: -15 }, log: loc("불안을 가중시켜 비치료적입니다.","Heightens anxiety — non-therapeutic.") }, { text: loc("강박행동을 못하도록 손을 신체보호대로 묶는다","Restrain the hands so they can't perform the ritual"), effect: { hp: -40, rep: -30 }, log: loc("심각한 인권 침해이며 불안을 폭증시킵니다.","Serious rights violation and triggers panic.") }, { text: loc("행동의 비합리성을 끊임없이 논리로 설득한다","Constantly argue logically that the behavior is irrational"), effect: { hp: -25, rep: -15 }, log: loc("비치료적 의사소통입니다.","Non-therapeutic communication.") }]) }; }
function generatePTSDQuestion() { return { baseId: "ptsd", categoryKey: "psych", part: loc("외상후스트레스","PTSD"), emoji: "💥", title: loc("PTSD 환자 간호","PTSD Care"), desc: loc(`외상사건 후 플래시백과 회피 행동을 보이는 환자에 대한 간호로 옳은 것은?`,`Correct nursing care for a patient with PTSD flashbacks and avoidance?`), choices: shuffle([{ text: loc("안전한 환경을 제공하고 환자가 준비될 때 천천히 사건을 표현하도록 돕는다","Provide a safe environment and gradually help them express the event when ready"), effect: { hp: -2, rep: 22 }, log: loc("정답. 안전감 확보 후 점진적 노출이 원칙입니다.","Correct. Safety first, then gradual exposure.") }, { text: loc("사건을 완전히 잊도록 절대 언급하지 않게 한다","Forbid any mention of the event so it can be forgotten"), effect: { hp: -25, rep: -15 }, log: loc("회피 강화는 치료를 방해합니다.","Reinforcing avoidance impedes recovery.") }, { text: loc("동일한 외상사건 영상을 반복 시청하게 강제한다","Force repeated viewing of the trauma footage"), effect: { hp: -40, rep: -30 }, log: loc("강제 노출은 재외상화의 위험이 큽니다.","Forced exposure risks retraumatization.") }, { text: loc("수면제만으로 모든 증상을 해결한다","Treat all symptoms with sleeping pills alone"), effect: { hp: -25, rep: -15 }, log: loc("약물만으로 부족하며 심리치료가 필요합니다.","Pharmacology alone is insufficient — therapy needed.") }]) }; }
function generateECTQuestion() { return { baseId: "ect", categoryKey: "psych", part: loc("치료","Treatment"), emoji: "⚡", title: loc("전기경련요법(ECT)","Electroconvulsive Therapy (ECT)"), desc: loc(`ECT 시술 후 환자에게서 흔히 나타나는 부작용으로 옳은 것은?`,`Common side effect after ECT?`), choices: shuffle([{ text: loc("일시적 기억상실과 두통","Transient memory loss and headache"), effect: { hp: -2, rep: 20 }, log: loc("정답. 가장 흔하며 대부분 회복됩니다.","Correct. Most common and usually resolves.") }, { text: loc("영구적 인격 변화","Permanent personality change"), effect: { hp: -25, rep: -15 }, log: loc("근거 없는 통념입니다.","Unfounded misconception.") }, { text: loc("체중의 급격한 증가","Rapid weight gain"), effect: { hp: -20, rep: -10 }, log: loc("ECT의 주된 부작용이 아닙니다.","Not a primary ECT side effect.") }, { text: loc("모든 환자에게 발생하는 영구 마비","Permanent paralysis in all patients"), effect: { hp: -30, rep: -20 }, log: loc("근육이완제로 마비는 일시적이고 영구적이지 않습니다.","Paralysis from muscle relaxants is transient.") }]) }; }
function generatePreventionLevelQuestion() { return { baseId: "preventionLevel", categoryKey: "community", part: loc("예방수준","Prevention Level"), emoji: "🛡️", title: loc("예방의 단계","Levels of Prevention"), desc: loc(`이미 발병한 결핵 환자에게 약물 치료를 시행하여 합병증과 후유증을 예방하는 것은 어느 단계 예방인가?`,`Treating a TB patient with medication to prevent complications — which level of prevention?`), choices: shuffle([{ text: loc("2차 예방(조기 진단·조기 치료)","Secondary (early dx and treatment)"), effect: { hp: -2, rep: 20 }, log: loc("정답. 발병 후 진단·치료를 통한 합병증 예방은 2차입니다.","Correct. Post-onset diagnosis/treatment for complication prevention = secondary.") }, { text: loc("1차 예방","Primary"), effect: { hp: -20, rep: -10 }, log: loc("1차는 발병 전 건강증진·예방접종입니다.","Primary is pre-onset promotion/immunization.") }, { text: loc("3차 예방","Tertiary"), effect: { hp: -20, rep: -10 }, log: loc("3차는 후유증 회복·재활입니다.","Tertiary is rehabilitation.") }, { text: loc("0차 예방","Zero-level prevention"), effect: { hp: -25, rep: -15 }, log: loc("표준 분류 단계가 아닙니다.","Not a standard category.") }]) }; }
function generateEpidemiologyQuestion() { return { baseId: "epi", categoryKey: "community", part: loc("역학","Epidemiology"), emoji: "📊", title: loc("역학 지표","Epidemiologic Measure"), desc: loc(`일정 기간 새로 발생한 환자 수를 인구로 나눈 지표는?`,`Which measure divides new cases over a period by the population at risk?`), choices: shuffle([{ text: loc("발생률(Incidence rate)","Incidence rate"), effect: { hp: -2, rep: 20 }, log: loc("정답. 신규 발생을 측정합니다.","Correct. Measures new occurrences.") }, { text: loc("유병률(Prevalence)","Prevalence"), effect: { hp: -20, rep: -10 }, log: loc("특정 시점 전체 환자 수입니다.","Total cases at a point in time.") }, { text: loc("치명률(Case-fatality)","Case-fatality rate"), effect: { hp: -20, rep: -10 }, log: loc("환자 중 사망자 비율입니다.","Proportion of cases that die.") }, { text: loc("이환률(Morbidity)의 누적 점유","Cumulative morbidity share"), effect: { hp: -20, rep: -10 }, log: loc("정의가 다른 개념입니다.","Different concept.") }]) }; }
function generateLeadershipQuestion() { return { baseId: "leadership", categoryKey: "management", part: loc("리더십","Leadership"), emoji: "🎯", title: loc("민주적 리더십","Democratic Leadership"), desc: loc(`구성원의 의견을 적극 수렴하여 의사결정에 반영하는 리더십 유형은?`,`Leadership style that actively gathers member input into decisions?`), choices: shuffle([{ text: loc("민주형 리더십(Democratic)","Democratic"), effect: { hp: -2, rep: 20 }, log: loc("정답. 참여와 합의를 강조합니다.","Correct. Emphasizes participation and consensus.") }, { text: loc("권위형 리더십(Authoritarian)","Authoritarian"), effect: { hp: -20, rep: -10 }, log: loc("리더가 단독 결정합니다.","Leader decides unilaterally.") }, { text: loc("자유방임형(Laissez-faire)","Laissez-faire"), effect: { hp: -20, rep: -10 }, log: loc("리더가 거의 개입하지 않습니다.","Leader rarely intervenes.") }, { text: loc("거래적 리더십(Transactional)","Transactional"), effect: { hp: -20, rep: -10 }, log: loc("보상·처벌 중심입니다.","Reward/punishment-driven.") }]) }; }
function generateConflictQuestion() { return { baseId: "conflict", categoryKey: "management", part: loc("갈등관리","Conflict Management"), emoji: "🤝", title: loc("갈등 해결 전략","Conflict Resolution Strategy"), desc: loc(`간호사 간 의견 대립이 심할 때 양측의 관심사를 모두 충족시키는 가장 바람직한 갈등해결 방식은?`,`Best resolution method that satisfies both parties' interests?`), choices: shuffle([{ text: loc("협력(Collaboration) - Win-Win 전략","Collaboration — Win-Win"), effect: { hp: -2, rep: 22 }, log: loc("정답. 양측 모두 만족하는 해결책을 모색합니다.","Correct. Seeks a solution satisfying both sides.") }, { text: loc("회피(Avoidance) - 무시하기","Avoidance — Ignoring"), effect: { hp: -25, rep: -15 }, log: loc("단기적이며 갈등이 잠복합니다.","Only short-term — conflict festers.") }, { text: loc("강요(Forcing) - 권력 사용","Forcing — Power play"), effect: { hp: -25, rep: -15 }, log: loc("한쪽만 만족하여 관계가 손상됩니다.","Only one side wins — damages relationships.") }, { text: loc("수용(Accommodating) - 무조건 양보","Accommodating — Unconditional yielding"), effect: { hp: -20, rep: -10 }, log: loc("장기적으로 부정적 감정이 누적됩니다.","Resentment accumulates over time.") }]) }; }
function generateNursingDeliveryQuestion() { return { baseId: "nursingDelivery", categoryKey: "management", part: loc("간호전달체계","Nursing Care Delivery"), emoji: "🏥", title: loc("간호전달체계","Care Delivery Model"), desc: loc(`한 명의 간호사가 입원부터 퇴원까지 환자의 24시간 간호를 책임지고 계획하는 방식은?`,`Model where one nurse is responsible for 24-hour care from admission to discharge?`), choices: shuffle([{ text: loc("일차 간호(Primary nursing)","Primary nursing"), effect: { hp: -2, rep: 20 }, log: loc("정답. 한 명의 RN이 전 과정을 책임집니다.","Correct. One RN owns the entire process.") }, { text: loc("팀 간호(Team nursing)","Team nursing"), effect: { hp: -20, rep: -10 }, log: loc("팀 리더 중심의 분업입니다.","Team-leader division of labor.") }, { text: loc("기능적 간호(Functional)","Functional nursing"), effect: { hp: -20, rep: -10 }, log: loc("업무별 분담으로 효율 위주입니다.","Task-based, efficiency-focused.") }, { text: loc("사례 관리(Case management)","Case management"), effect: { hp: -20, rep: -10 }, log: loc("여러 환자의 비용·결과 관리가 중심입니다.","Focuses on cost/outcomes across patients.") }]) }; }
function generateMaternalLawQuestion() { return { baseId: "maternalLaw", categoryKey: "law", part: loc("모자보건법","Maternal & Child Health Act"), emoji: "👶", title: loc("영유아 정의","Definition of Infant/Child"), desc: loc(`모자보건법상 \"영유아\"의 법적 정의는?`,`Korean Maternal & Child Health Act definition of "young child"?`), choices: shuffle([{ text: loc("출생 후 6세 미만의 사람","Person under 6 years of age"), effect: { hp: -2, rep: 20 }, log: loc("정답. 모자보건법상 영유아는 6세 미만입니다.","Correct. Defined as under 6 years.") }, { text: loc("출생 후 12세 미만의 사람","Person under 12 years of age"), effect: { hp: -20, rep: -10 }, log: loc("다른 법령의 아동 정의입니다.","Different law's child definition.") }, { text: loc("출생 후 1세 미만의 사람","Person under 1 year of age"), effect: { hp: -20, rep: -10 }, log: loc("이는 영아의 좁은 정의입니다.","That's the narrow definition of an infant.") }, { text: loc("임신 24주 이상의 태아","Fetus ≥24 weeks gestation"), effect: { hp: -25, rep: -15 }, log: loc("영유아 정의에 해당하지 않습니다.","Does not fit the definition.") }]) }; }
function generateMentalHealthLawQuestion() { return { baseId: "mentalHealthLaw", categoryKey: "law", part: loc("정신건강복지법","Mental Health Act"), emoji: "🏥", title: loc("정신과 입원 유형","Psychiatric Admission Types"), desc: loc(`자해·타해 위험이 큰 환자를 보호의무자 동의 없이 시·도지사 권한으로 입원시키는 유형은?`,`Type of admission for a patient at high risk of self/other harm, by mayor/governor authority without guardian consent?`), choices: shuffle([{ text: loc("행정입원","Administrative admission"), effect: { hp: -3, rep: 22 }, log: loc("정답. 시·도지사가 행하는 응급조치 입원입니다.","Correct. Emergency admission by mayor/governor.") }, { text: loc("자의입원","Voluntary admission"), effect: { hp: -25, rep: -15 }, log: loc("본인 동의 입원입니다.","Patient consents themselves.") }, { text: loc("보호입원","Guardian-consent admission"), effect: { hp: -20, rep: -10 }, log: loc("보호의무자 동의 입원입니다.","Admitted with guardian consent.") }, { text: loc("동의입원","Joint-consent admission"), effect: { hp: -20, rep: -10 }, log: loc("본인+보호의무자 동의 입원입니다.","Both patient and guardian consent.") }]) }; }
function generateEmergencyLawQuestion() { return { baseId: "emergencyLaw", categoryKey: "law", part: loc("응급의료법","Emergency Medical Act"), emoji: "🚑", title: loc("선의의 응급처치","Good Samaritan Law"), desc: loc(`응급의료법상 일반인의 선의의 응급처치(Good Samaritan)에 대한 법적 효과는?`,`Legal effect of a layperson's Good Samaritan emergency care under the Emergency Medical Act?`), choices: shuffle([{ text: loc("고의 또는 중대한 과실이 없으면 민·형사 책임을 감면한다","Civil/criminal liability is mitigated absent intent or gross negligence"), effect: { hp: -2, rep: 22 }, log: loc("정답. 선의의 응급처치자를 보호하는 규정입니다.","Correct. Protects Good Samaritans.") }, { text: loc("어떠한 경우에도 모두 면책된다","Always fully immune"), effect: { hp: -25, rep: -15 }, log: loc("고의·중과실은 면책되지 않습니다.","Intent and gross negligence are not exempt.") }, { text: loc("응급의료종사자만 면책된다","Only emergency personnel are immune"), effect: { hp: -20, rep: -10 }, log: loc("일반인도 보호 대상입니다.","Laypersons are also protected.") }, { text: loc("어떠한 경우에도 면책되지 않는다","Never any immunity"), effect: { hp: -25, rep: -15 }, log: loc("법의 입법 취지에 반합니다.","Contradicts the law's intent.") }]) }; }
function generateBloodTypeQuestion() { return { baseId: "bloodType", categoryKey: "fundamentals", part: loc("수혈","Transfusion"), emoji: "🩸", title: loc("수혈 가능 혈액형","Compatible Blood Types"), desc: loc(`O형 수혜자에게 응급으로 수혈할 수 있는 적혈구 혈액형은?`,`Which RBC type can be given in an emergency to a Type O recipient?`), choices: shuffle([{ text: loc("O형만 수혈 가능","Only Type O"), effect: { hp: -2, rep: 20 }, log: loc("정답. O형은 동형 적혈구만 수혈 가능합니다.","Correct. Type O can only receive Type O RBCs.") }, { text: loc("AB형이 만능 공혈자이므로 AB형 수혈","AB is universal donor, so give AB"), effect: { hp: -40, rep: -30 }, log: loc("AB형은 만능 수혈자(혈장 제외)이며 공혈자가 아닙니다.","AB is universal recipient (RBCs), not donor.") }, { text: loc("A형, B형 모두 가능","Both A and B are fine"), effect: { hp: -40, rep: -30 }, log: loc("용혈성 수혈반응이 발생합니다.","Causes hemolytic reaction.") }, { text: loc("Rh 인자만 일치하면 모두 가능","Any type if Rh matches"), effect: { hp: -40, rep: -30 }, log: loc("ABO 적합성이 우선입니다.","ABO compatibility comes first.") }]) }; }
function generateBPHQuestion() { return { baseId: "bph", categoryKey: "adult", part: loc("비뇨기","Urology"), emoji: "🚹", title: loc("전립선비대증","BPH"), desc: loc(`양성 전립선비대증(BPH) 환자에게서 가장 흔히 나타나는 증상은?`,`Most common symptoms of benign prostatic hyperplasia (BPH)?`), choices: shuffle([{ text: loc("약뇨, 잔뇨감, 야간뇨, 빈뇨 등 폐쇄·자극증상","Weak stream, residual-urine sensation, nocturia, frequency — obstructive/irritative symptoms"), effect: { hp: -2, rep: 20 }, log: loc("정답. 요도 폐쇄와 방광 자극으로 나타납니다.","Correct. From urethral obstruction and bladder irritation.") }, { text: loc("혈변과 흑색변","Hematochezia and melena"), effect: { hp: -25, rep: -15 }, log: loc("위장관 출혈 증상입니다.","GI bleeding symptoms.") }, { text: loc("복통과 황달","Abdominal pain and jaundice"), effect: { hp: -25, rep: -15 }, log: loc("간담도 질환의 증상입니다.","Hepatobiliary symptoms.") }, { text: loc("심한 두통과 시야결손","Severe headache and visual field defects"), effect: { hp: -25, rep: -15 }, log: loc("신경계 증상입니다.","Neurologic symptoms.") }]) }; }
function generateCKDDialysisQuestion() { return { baseId: "dialysis", categoryKey: "adult", part: loc("투석","Dialysis"), emoji: "🩺", title: loc("혈액투석 환자 간호","Hemodialysis Care"), desc: loc(`좌측 팔에 동정맥루(AVF)가 있는 혈액투석 환자에게 가장 중요한 교육은?`,`Most important teaching for an HD patient with a left-arm AV fistula?`), choices: shuffle([{ text: loc("AVF가 있는 팔로는 채혈·혈압 측정·정맥주사를 하지 않는다","Avoid blood draws, BP measurement, and IV in the AVF arm"), effect: { hp: -2, rep: 22 }, log: loc("정답. AVF 손상은 투석 자체를 위협합니다.","Correct. AVF damage threatens dialysis access itself.") }, { text: loc("AVF 부위에 무거운 가방을 메도록 권장한다","Encourage carrying a heavy bag over the AVF"), effect: { hp: -35, rep: -25 }, log: loc("압박은 폐쇄를 유발합니다.","Compression causes occlusion.") }, { text: loc("AVF가 있는 팔로 자주 운동을 시켜 진동(thrill)을 강화한다","Heavy exercise of the AVF arm to strengthen the thrill"), effect: { hp: -10, rep: 0 }, log: loc("가벼운 운동은 권장되지만, 측정·주사 금지가 더 핵심입니다.","Light exercise helps, but avoiding measurements/IV is the key teaching.") }, { text: loc("투석 직후 즉시 강한 운동을 한다","Vigorous exercise right after dialysis"), effect: { hp: -25, rep: -15 }, log: loc("저혈압 위험이 있어 부적절합니다.","Inappropriate due to hypotension risk.") }]) }; }
function generateGallstoneQuestion() { return { baseId: "gallstone", categoryKey: "adult", part: loc("소화기","GI"), emoji: "🥚", title: loc("담석증 식이","Cholelithiasis Diet"), desc: loc(`담석증 환자에게 권장되는 식이로 옳은 것은?`,`Recommended diet for cholelithiasis?`), choices: shuffle([{ text: loc("저지방, 저콜레스테롤 식이","Low-fat, low-cholesterol diet"), effect: { hp: -2, rep: 20 }, log: loc("정답. 지방은 담낭 수축을 유발해 통증을 일으킵니다.","Correct. Fat triggers gallbladder contraction and pain.") }, { text: loc("고지방 고열량 식이","High-fat, high-calorie diet"), effect: { hp: -30, rep: -20 }, log: loc("통증 발작을 유발합니다.","Triggers pain attacks.") }, { text: loc("고단백 동물성 지방 위주 식이","High-protein animal-fat-heavy diet"), effect: { hp: -25, rep: -15 }, log: loc("콜레스테롤이 결석 형성을 촉진합니다.","Cholesterol drives stone formation.") }, { text: loc("튀김과 베이컨, 버터를 충분히 섭취","Plenty of fried foods, bacon, and butter"), effect: { hp: -30, rep: -20 }, log: loc("포화지방이 과다합니다.","Excess saturated fat.") }]) }; }
function generatePostpartumQuestion() { return { baseId: "postpartum", categoryKey: "maternal", part: loc("산후","Postpartum"), emoji: "🤱", title: loc("자궁퇴축 사정","Uterine Involution"), desc: loc(`정상 분만 24시간 후 산모의 자궁저부 위치는?`,`Position of the fundus 24 hours after a normal delivery?`), choices: shuffle([{ text: loc("배꼽 부위(제와 높이)","At the umbilicus"), effect: { hp: -2, rep: 20 }, log: loc("정답. 분만 직후 제와부 → 매일 1cm씩 하강합니다.","Correct. At umbilicus right after birth, descends ~1 cm/day.") }, { text: loc("검상돌기 위","Above the xiphoid"), effect: { hp: -20, rep: -10 }, log: loc("이 위치는 비정상입니다.","Abnormal position.") }, { text: loc("치골결합 아래","Below the symphysis pubis"), effect: { hp: -20, rep: -10 }, log: loc("10일 이후 위치입니다.","Position seen after 10 days.") }, { text: loc("배꼽 위 5cm","5 cm above umbilicus"), effect: { hp: -20, rep: -10 }, log: loc("역행성 퇴축 의심 위치입니다.","Suggests subinvolution.") }]) }; }

// ========= 신규 임상 문제 (20개) =========
function generateLithiumQuestion() { return { baseId: "lithium", categoryKey: "psych", part: loc("리튬 중독","Lithium Toxicity"), emoji: "💊", title: loc("리튬 독성 징후","Lithium Toxicity Signs"), desc: loc(`양극성 환자가 리튬 복용 중 진전, 구토, 의식 혼탁을 호소한다. 가장 의심되는 상황은?`,`A bipolar patient on lithium develops tremor, vomiting, and altered consciousness. Most likely?`), choices: shuffle([{ text: loc("리튬 독성 - 즉시 약물 중단 후 혈중 농도 측정","Lithium toxicity — hold drug and check serum level"), effect: { hp: -3, rep: 22 }, log: loc("정답. 치료 농도 0.6~1.2 mEq/L, 1.5↑ 독성. 즉각 중단·수액·전해질 보정.","Correct. Therapeutic 0.6–1.2 mEq/L; toxic ≥1.5. Hold, hydrate, correct electrolytes.") }, { text: loc("내성이 생긴 것이므로 용량을 늘린다","Tolerance — increase the dose"), effect: { hp: -40, rep: -30 }, log: loc("절대 금기. 사망 위험.","Absolutely contraindicated — fatal risk.") }, { text: loc("정상 부작용이므로 그대로 유지","Normal side effect — continue"), effect: { hp: -30, rep: -20 }, log: loc("독성 징후를 놓치면 심각합니다.","Missing toxicity is dangerous.") }, { text: loc("저염식이 필요하다고 교육한다","Teach low-sodium diet"), effect: { hp: -30, rep: -20 }, log: loc("저염은 오히려 리튬 농도를 올립니다.","Low sodium raises lithium levels.") }]) }; }
function generateEPSQuestion() { return { baseId: "eps", categoryKey: "psych", part: loc("추체외로 증상","EPS"), emoji: "🤖", title: loc("항정신병약 EPS","Antipsychotic EPS"), desc: loc(`Haloperidol 투여 후 환자가 목과 안구가 위로 강하게 비틀어지며 침을 흘린다. 우선 처치는?`,`After Haloperidol, the patient's neck and eyes twist upward forcefully and they drool. Priority?`), choices: shuffle([{ text: loc("Benztropine 또는 Diphenhydramine 즉시 IM 투여","Immediate IM Benztropine or Diphenhydramine"), effect: { hp: -3, rep: 22 }, log: loc("정답. 급성 근긴장이상의 1차 처치입니다.","Correct. First-line for acute dystonia.") }, { text: loc("호전될 때까지 환자를 침상에 묶어둔다","Restrain the patient until it resolves"), effect: { hp: -40, rep: -30 }, log: loc("억제는 부적절합니다.","Restraint is inappropriate.") }, { text: loc("같은 약물을 추가 투여한다","Give another dose of the same drug"), effect: { hp: -45, rep: -35 }, log: loc("증상을 악화시킵니다.","Worsens symptoms.") }, { text: loc("관찰만 하며 다음 회진을 기다린다","Just observe and wait for next round"), effect: { hp: -25, rep: -15 }, log: loc("기도 폐쇄 위험이 있습니다.","Airway compromise risk.") }]) }; }
function generateMAOIQuestion() { return { baseId: "maoi", categoryKey: "psych", part: loc("MAOI 식이","MAOI Diet"), emoji: "🍷", title: loc("MAOI 복용 환자 식이","MAOI Patient Diet"), desc: loc(`MAOI(Phenelzine) 복용 환자에게 절대 피해야 할 식품은?`,`Which food must a patient on an MAOI (Phenelzine) absolutely avoid?`), choices: shuffle([{ text: loc("숙성 치즈, 와인, 절인 청어 등 티라민 함유 식품","Aged cheese, wine, pickled herring (tyramine-rich foods)"), effect: { hp: -3, rep: 22 }, log: loc("정답. 티라민과 MAOI 병용 시 고혈압 위기 발생.","Correct. Tyramine + MAOI causes hypertensive crisis.") }, { text: loc("바나나, 사과 등 신선한 과일","Fresh fruits like banana, apple"), effect: { hp: -25, rep: -15 }, log: loc("일반적으로 안전합니다.","Generally safe.") }, { text: loc("탄산음료","Carbonated drinks"), effect: { hp: -25, rep: -15 }, log: loc("MAOI와 직접 관련 없습니다.","Not directly related to MAOI.") }, { text: loc("쌀과 빵","Rice and bread"), effect: { hp: -25, rep: -15 }, log: loc("일반적으로 안전합니다.","Generally safe.") }]) }; }
function generateAnorexiaQuestion() { return { baseId: "anorexia", categoryKey: "psych", part: loc("섭식장애","Eating Disorder"), emoji: "🍽️", title: loc("거식증 재영양 증후군","Refeeding Syndrome"), desc: loc(`심한 영양실조 거식증 환자에게 급하게 다량 영양 공급 시 가장 위험한 합병증은?`,`Most dangerous complication of rapid aggressive refeeding in severe anorexia?`), choices: shuffle([{ text: loc("재영양 증후군(저인산혈증·심부전)","Refeeding syndrome (hypophosphatemia, heart failure)"), effect: { hp: -3, rep: 22 }, log: loc("정답. 천천히 시작해 인·칼륨·마그네슘을 모니터링합니다.","Correct. Start slow and monitor phos/K/Mg.") }, { text: loc("일시적 변비","Transient constipation"), effect: { hp: -25, rep: -15 }, log: loc("주된 위험이 아닙니다.","Not the primary risk.") }, { text: loc("간단한 과체중","Simple weight gain"), effect: { hp: -30, rep: -20 }, log: loc("위험 평가에 부적절합니다.","Misjudges severity.") }, { text: loc("일시적 발열","Transient fever"), effect: { hp: -25, rep: -15 }, log: loc("핵심 위험이 아닙니다.","Not the key risk.") }]) }; }
function generateNaloxoneQuestion() { return { baseId: "naloxone", categoryKey: "adult", part: loc("응급/약리","Emergency/Pharm"), emoji: "💉", title: loc("아편제 과량 응급","Opioid Overdose"), desc: loc(`아편제 과량으로 호흡 6회/분, 동공 핀포인트, 의식 없는 환자에 즉시 투여할 약물은?`,`Opioid overdose: RR 6/min, pinpoint pupils, unresponsive. Drug of choice?`), choices: shuffle([{ text: loc("Naloxone (Narcan) IV/IM","Naloxone (Narcan) IV/IM"), effect: { hp: -3, rep: 22 }, log: loc("정답. 아편제 길항제로 호흡 회복을 유도합니다.","Correct. Opioid antagonist, restores respiration.") }, { text: loc("Flumazenil","Flumazenil"), effect: { hp: -30, rep: -20 }, log: loc("벤조디아제핀 길항제입니다.","That's a benzodiazepine antagonist.") }, { text: loc("Atropine","Atropine"), effect: { hp: -30, rep: -20 }, log: loc("서맥/콜린성 위기에 사용합니다.","Used for bradycardia/cholinergic crisis.") }, { text: loc("Activated charcoal","Activated charcoal"), effect: { hp: -25, rep: -15 }, log: loc("의식 없는 환자에게 흡인 위험이 큽니다.","Aspiration risk in unconscious patient.") }]) }; }
function generateAnaphylaxisRxQuestion() { return { baseId: "anaphylaxisRx", categoryKey: "adult", part: loc("응급/약리","Emergency/Pharm"), emoji: "💉", title: loc("아나필락시스 1차 약물","Anaphylaxis First-Line"), desc: loc(`벌침에 쏘인 환자가 호흡곤란·천명·저혈압을 호소한다. 가장 먼저 투여할 약물·경로는?`,`Bee sting → dyspnea, wheezing, hypotension. First drug and route?`), choices: shuffle([{ text: loc("Epinephrine 1:1000 IM (대퇴부 외측)","IM epinephrine 1:1000 (vastus lateralis)"), effect: { hp: -3, rep: 22 }, log: loc("정답. 아나필락시스의 절대 1차 처치입니다.","Correct. Absolute first-line for anaphylaxis.") }, { text: loc("Diphenhydramine PO","Oral diphenhydramine"), effect: { hp: -40, rep: -30 }, log: loc("보조약이며, 단독 사용은 사망 위험.","Adjunct only — fatal risk if used alone.") }, { text: loc("Methylprednisolone IV","IV methylprednisolone"), effect: { hp: -30, rep: -20 }, log: loc("후기 반응 예방용 보조약입니다.","Adjunct for late-phase reaction.") }, { text: loc("Albuterol nebulizer","Nebulized albuterol"), effect: { hp: -30, rep: -20 }, log: loc("기관지 확장에만 효과적이며 단독으로 부족.","Bronchodilator only — insufficient alone.") }]) }; }
function generateChestTubeQuestion() { return { baseId: "chestTube", categoryKey: "adult", part: loc("흉관 배액","Chest Tube"), emoji: "🫁", title: loc("흉관 배액기","Chest Tube Drainage"), desc: loc(`흉관 배액기 수통에서 거품(bubbling)이 지속적으로 보일 때 가장 먼저 의심할 것은?`,`Continuous bubbling in the water-seal chamber. First suspicion?`), choices: shuffle([{ text: loc("배액 시스템 또는 환자 측의 공기 누출","Air leak in the system or at the patient"), effect: { hp: -3, rep: 22 }, log: loc("정답. 연결부터 흉부삽입부까지 누출을 점검합니다.","Correct. Check from connections to insertion site.") }, { text: loc("흉관이 정상 작동 중이므로 무시","Normal — ignore it"), effect: { hp: -30, rep: -20 }, log: loc("지속적 거품은 비정상입니다.","Continuous bubbling is abnormal.") }, { text: loc("환자의 호흡 곤란을 즉시 의심","Immediately assume respiratory failure"), effect: { hp: -20, rep: -10 }, log: loc("점검이 먼저입니다.","Check first.") }, { text: loc("배액기 줄을 무조건 잠근다","Clamp the chest tube tubing"), effect: { hp: -40, rep: -30 }, log: loc("긴장성 기흉을 유발할 수 있어 금기.","Can cause tension pneumothorax — contraindicated.") }]) }; }
function generateOstomyQuestion() { return { baseId: "ostomy", categoryKey: "fundamentals", part: loc("장루 간호","Ostomy Care"), emoji: "🩹", title: loc("결장루 stoma 색깔","Colostomy Stoma Color"), desc: loc(`결장루 간호 시 정상 stoma 색깔은?`,`Normal color of a healthy colostomy stoma?`), choices: shuffle([{ text: loc("선홍색 또는 분홍색(beefy red)","Bright/beefy red or pink"), effect: { hp: -2, rep: 20 }, log: loc("정답. 검붉거나 창백·검은색은 허혈 의심.","Correct. Dusky/pale/black = ischemia suspected.") }, { text: loc("검은색이 정상","Black is normal"), effect: { hp: -40, rep: -30 }, log: loc("괴사 의심으로 즉각 보고가 필요합니다.","Suggests necrosis — report immediately.") }, { text: loc("회색이 정상","Gray is normal"), effect: { hp: -35, rep: -25 }, log: loc("허혈 의심입니다.","Ischemia suspected.") }, { text: loc("노란색이 정상","Yellow is normal"), effect: { hp: -30, rep: -20 }, log: loc("정상 색이 아닙니다.","Not normal color.") }]) }; }
function generateCentralLineQuestion() { return { baseId: "centralLine", categoryKey: "fundamentals", part: loc("중심정맥관","Central Line"), emoji: "💉", title: loc("CVC 감염 예방","CVC Infection Prevention"), desc: loc(`중심정맥관 삽입 시 감염을 가장 효과적으로 예방하는 번들 항목은?`,`Most effective bundle item to prevent CVC-related bloodstream infection?`), choices: shuffle([{ text: loc("Maximum sterile barrier(전신 멸균드레이프), 손위생, 클로르헥시딘 소독, 적절한 부위 선택, 매일 필요성 평가","Max sterile barrier, hand hygiene, chlorhexidine, optimal site, daily necessity review"), effect: { hp: -2, rep: 22 }, log: loc("정답. CDC/IHI 5요소 번들입니다.","Correct. CDC/IHI 5-element bundle.") }, { text: loc("도덴(povidone)이 클로르헥시딘보다 우수","Povidone is superior to chlorhexidine"), effect: { hp: -25, rep: -15 }, log: loc("클로르헥시딘이 1차 권장입니다.","Chlorhexidine is first-line.") }, { text: loc("적절한 부위는 대퇴정맥","Femoral vein is ideal"), effect: { hp: -25, rep: -15 }, log: loc("대퇴는 감염 위험이 가장 높아 회피.","Femoral has highest infection risk — avoid.") }, { text: loc("멸균 장갑만 착용하면 충분","Sterile gloves alone are enough"), effect: { hp: -30, rep: -20 }, log: loc("Maximum barrier가 표준입니다.","Maximum barrier is standard.") }]) }; }
function generatePacemakerQuestion() { return { baseId: "pacemaker", categoryKey: "adult", part: loc("심장","Cardiac"), emoji: "🔋", title: loc("심박조율기 환자 교육","Pacemaker Patient Teaching"), desc: loc(`인공심박조율기를 막 삽입한 환자에게 가장 중요한 교육 내용은?`,`Most important teaching for a newly implanted pacemaker patient?`), choices: shuffle([{ text: loc("매일 맥박을 측정하고 강한 자기장(MRI 등)·미세 진동을 피하며 의료ID를 휴대한다","Check pulse daily, avoid strong magnets (e.g., MRI) and microwaves at close range, carry medical ID"), effect: { hp: -2, rep: 22 }, log: loc("정답. 작동 점검과 자기장 회피가 핵심입니다.","Correct. Pulse checks and avoiding magnetic interference are key.") }, { text: loc("시술한 쪽 팔을 즉시 들어올려 운동한다","Raise the operative arm immediately and exercise"), effect: { hp: -30, rep: -20 }, log: loc("3~4주간 시술측 팔 거상은 제한합니다.","Avoid lifting the operative arm for 3–4 weeks.") }, { text: loc("배터리 교체는 평생 필요 없다","Battery never needs replacement"), effect: { hp: -25, rep: -15 }, log: loc("5~10년마다 교체 필요.","Replaced every 5–10 years.") }, { text: loc("심한 운동을 즉시 시작해도 된다","Resume vigorous exercise immediately"), effect: { hp: -25, rep: -15 }, log: loc("점진적 회복이 필요합니다.","Gradual return to activity.") }]) }; }
function generateGDMQuestion() { return { baseId: "gdm", categoryKey: "maternal", part: loc("임신성 당뇨","GDM"), emoji: "🤰", title: loc("임신성 당뇨 선별","GDM Screening"), desc: loc(`임신성 당뇨 선별을 위한 표준 검사 시기는?`,`Standard timing for gestational diabetes screening?`), choices: shuffle([{ text: loc("임신 24~28주 사이 50g GCT 또는 75g OGTT","24–28 weeks (50g GCT or 75g OGTT)"), effect: { hp: -2, rep: 20 }, log: loc("정답. 표준 권장 시점입니다.","Correct. Standard recommended window.") }, { text: loc("임신 8주 이내","Before 8 weeks"), effect: { hp: -25, rep: -15 }, log: loc("이른 시점입니다(고위험군 별도 평가).","Too early (high-risk get earlier separate eval).") }, { text: loc("분만 직전","Just before delivery"), effect: { hp: -25, rep: -15 }, log: loc("관리 기간이 부족합니다.","Insufficient management window.") }, { text: loc("산후 6주","6 weeks postpartum"), effect: { hp: -25, rep: -15 }, log: loc("산후 평가 시점입니다.","Postpartum follow-up timing.") }]) }; }
function generatePPDQuestion() { return { baseId: "ppd", categoryKey: "maternal", part: loc("산후 우울","Postpartum Depression"), emoji: "😢", title: loc("산후 우울 vs 베이비블루스","PPD vs Baby Blues"), desc: loc(`분만 4주 후에도 자녀 돌봄 무관심·불면·죄책감이 지속되는 산모에 대한 가장 적절한 중재는?`,`4 weeks postpartum: persistent disinterest in baby care, insomnia, guilt. Best intervention?`), choices: shuffle([{ text: loc("산후 우울증 평가(EPDS) 후 정신과 의뢰","Edinburgh Postpartum Depression Scale + psychiatric referral"), effect: { hp: -3, rep: 22 }, log: loc("정답. 2주 이상 지속되면 전문 평가가 필요합니다.","Correct. Persistent ≥2 weeks needs expert evaluation.") }, { text: loc("정상 베이비블루스이므로 관찰만","Normal baby blues — just observe"), effect: { hp: -30, rep: -20 }, log: loc("베이비블루스는 보통 2주 이내 호전됩니다.","Baby blues usually resolve within 2 weeks.") }, { text: loc("아이를 격리하고 산모 혼자 두기","Separate the baby and isolate the mother"), effect: { hp: -35, rep: -25 }, log: loc("부적절한 중재입니다.","Inappropriate intervention.") }, { text: loc("강한 운동을 강제한다","Force vigorous exercise"), effect: { hp: -25, rep: -15 }, log: loc("강제는 비치료적입니다.","Coercion is non-therapeutic.") }]) }; }
function generateHEGQuestion() { return { baseId: "heg", categoryKey: "maternal", part: loc("임신오조","Hyperemesis"), emoji: "🤢", title: loc("임신오조","Hyperemesis Gravidarum"), desc: loc(`임신 12주 산모가 지속적 구토로 체중 5% 감소·케톤뇨를 보인다. 1차 중재는?`,`12-week pregnant patient: persistent vomiting, 5% weight loss, ketonuria. First intervention?`), choices: shuffle([{ text: loc("정맥 수액 보충 + 비타민 B6/Doxylamine","IV fluids + Vit B6 / Doxylamine"), effect: { hp: -3, rep: 22 }, log: loc("정답. 탈수 보정과 1차 항구토 약제입니다.","Correct. Rehydration and first-line antiemetic.") }, { text: loc("절대 금식으로 5일간 지속","Strict NPO for 5 days"), effect: { hp: -35, rep: -25 }, log: loc("탈수·전해질 불균형이 악화됩니다.","Worsens dehydration/electrolytes.") }, { text: loc("항우울제 즉시 투여","Immediate antidepressant"), effect: { hp: -30, rep: -20 }, log: loc("적응증이 다릅니다.","Wrong indication.") }, { text: loc("대량 경구 수분 강요","Force massive oral fluids"), effect: { hp: -25, rep: -15 }, log: loc("토할 가능성이 큽니다.","Likely to vomit.") }]) }; }
function generateEpisiotomyQuestion() { return { baseId: "episiotomy", categoryKey: "maternal", part: loc("회음 절개","Episiotomy"), emoji: "🩹", title: loc("회음 사정 REEDA","REEDA Assessment"), desc: loc(`회음 절개 부위 사정에 사용하는 REEDA의 \"E\" 두 가지 항목은?`,`Two "E" components in the REEDA episiotomy assessment?`), choices: shuffle([{ text: loc("Edema(부종), Ecchymosis(반상출혈)","Edema, Ecchymosis"), effect: { hp: -2, rep: 20 }, log: loc("정답. R-E-E-D-A: 발적·부종·반상출혈·분비물·접합.","Correct. R-E-E-D-A: Redness, Edema, Ecchymosis, Discharge, Approximation.") }, { text: loc("Erythema, Eruption","Erythema, Eruption"), effect: { hp: -25, rep: -15 }, log: loc("두 번째 E는 Ecchymosis입니다.","Second E is Ecchymosis.") }, { text: loc("Edema, Erosion","Edema, Erosion"), effect: { hp: -25, rep: -15 }, log: loc("Erosion은 포함되지 않습니다.","Erosion is not part of REEDA.") }, { text: loc("Excretion, Eruption","Excretion, Eruption"), effect: { hp: -25, rep: -15 }, log: loc("REEDA 항목이 아닙니다.","Not REEDA items.") }]) }; }
function generateNeonatalHypoQuestion() { return { baseId: "neonatalHypo", categoryKey: "pediatric", part: loc("신생아 저혈당","Neonatal Hypoglycemia"), emoji: "👶", title: loc("신생아 저혈당","Neonatal Hypoglycemia"), desc: loc(`출생 직후 신생아의 혈당이 35 mg/dL이며 무증상이다. 1차 중재는?`,`Just-born infant has glucose 35 mg/dL and is asymptomatic. First action?`), choices: shuffle([{ text: loc("즉시 모유수유/조제 수유 후 30~60분 뒤 재측정","Feed (breast/formula) and recheck in 30–60 min"), effect: { hp: -2, rep: 22 }, log: loc("정답. 무증상 경증은 우선 수유 후 재평가.","Correct. Asymptomatic mild — feed first, then recheck.") }, { text: loc("12시간 금식하며 관찰","NPO for 12 hours and observe"), effect: { hp: -35, rep: -25 }, log: loc("저혈당이 악화됩니다.","Worsens hypoglycemia.") }, { text: loc("무조건 IV 50% 포도당 푸시","Push 50% dextrose IV regardless"), effect: { hp: -30, rep: -20 }, log: loc("증상 있는 중증에만 적용합니다.","Only for symptomatic severe cases.") }, { text: loc("정상이므로 무시","Normal — ignore"), effect: { hp: -35, rep: -25 }, log: loc("정상 한계 미만(<40)입니다.","Below normal threshold (<40).") }]) }; }
function generateSickleCellQuestion() { return { baseId: "sickleCell", categoryKey: "pediatric", part: loc("겸상적혈구 위기","Sickle Cell Crisis"), emoji: "🩸", title: loc("겸상적혈구 통증위기","Sickle Cell Pain Crisis"), desc: loc(`겸상적혈구 환아가 심한 통증과 발열로 응급실에 왔다. 핵심 중재 3가지는?`,`Sickle cell child arrives with severe pain and fever. Core 3 interventions?`), choices: shuffle([{ text: loc("적극적 수액·산소·통증조절(아편제 포함)","Aggressive hydration, oxygen, pain control (including opioids)"), effect: { hp: -3, rep: 22 }, log: loc("정답. 통증위기의 표준 3요소입니다.","Correct. Standard triad for vaso-occlusive crisis.") }, { text: loc("탈수 유도와 산소 차단","Dehydrate and withhold oxygen"), effect: { hp: -45, rep: -35 }, log: loc("위기를 악화시킵니다.","Worsens the crisis.") }, { text: loc("아세트아미노펜만 사용·아편제 금지","Only acetaminophen; never opioids"), effect: { hp: -30, rep: -20 }, log: loc("심한 통증에는 아편제가 적응증입니다.","Opioids are indicated for severe pain.") }, { text: loc("운동을 격려해 적혈구 순환을 개선","Encourage exercise to improve circulation"), effect: { hp: -30, rep: -20 }, log: loc("산소 요구를 늘려 악화됩니다.","Increases O2 demand — worsens.") }]) }; }
function generateLeukemiaPedsQuestion() { return { baseId: "leukemiaPeds", categoryKey: "pediatric", part: loc("백혈병","Leukemia"), emoji: "🧒", title: loc("소아 백혈병 감염예방","Pediatric Leukemia Infection Prevention"), desc: loc(`항암치료 중 호중구감소증인 소아에게 가장 중요한 교육 내용은?`,`Most important teaching for a child with chemo-induced neutropenia?`), choices: shuffle([{ text: loc("생화·생채소·날음식 회피, 손위생, 사람 많은 곳 회피","Avoid fresh flowers, raw vegetables, raw foods; hand hygiene; avoid crowds"), effect: { hp: -2, rep: 22 }, log: loc("정답. 호중구감소 식이·환경 표준입니다.","Correct. Standard neutropenic precautions.") }, { text: loc("생백신을 적극 권장","Encourage live vaccines"), effect: { hp: -45, rep: -35 }, log: loc("생백신은 절대 금기.","Live vaccines absolutely contraindicated.") }, { text: loc("어린이집 등원 권장","Encourage daycare attendance"), effect: { hp: -35, rep: -25 }, log: loc("감염 위험이 큽니다.","High infection risk.") }, { text: loc("특별한 주의 필요 없음","No special precautions needed"), effect: { hp: -40, rep: -30 }, log: loc("매우 위험합니다.","Very dangerous.") }]) }; }
function generateLeadPoisonQuestion() { return { baseId: "leadPoison", categoryKey: "pediatric", part: loc("납 중독","Lead Poisoning"), emoji: "🧪", title: loc("아동 납 중독","Pediatric Lead Poisoning"), desc: loc(`5세 아동의 혈중 납 수치가 45 μg/dL이다. 가장 우선되는 중재는?`,`A 5-year-old's blood lead level is 45 μg/dL. Top priority intervention?`), choices: shuffle([{ text: loc("납 노출원 제거 + 킬레이션 치료(예: Succimer/EDTA)","Remove lead source + chelation therapy (e.g., Succimer/EDTA)"), effect: { hp: -3, rep: 22 }, log: loc("정답. 45+ μg/dL는 킬레이션 적응증입니다.","Correct. ≥45 μg/dL warrants chelation.") }, { text: loc("정상이므로 추적관찰만","Normal — just monitor"), effect: { hp: -40, rep: -30 }, log: loc("중등도 중독 수치입니다.","This is moderate toxicity.") }, { text: loc("우유만 권장","Recommend milk only"), effect: { hp: -30, rep: -20 }, log: loc("부적절한 단독 중재.","Insufficient as sole intervention.") }, { text: loc("석회 보충제 추가","Add lime supplement"), effect: { hp: -30, rep: -20 }, log: loc("효과 없습니다.","Ineffective.") }]) }; }
function generateRestraintLawQuestion() { return { baseId: "restraintLaw", categoryKey: "law", part: loc("신체보호대","Restraints"), emoji: "📜", title: loc("신체보호대 적용 원칙","Restraint Use Principle"), desc: loc(`신체보호대 적용에 대한 법적·윤리적 원칙으로 옳은 것은?`,`Correct legal/ethical principle for applying restraints?`), choices: shuffle([{ text: loc("최소한의 시간만 적용, 의사 처방·동의서·정기 사정·문서화 필수","Use only minimum time; physician order, consent, regular reassessment, documentation required"), effect: { hp: -2, rep: 22 }, log: loc("정답. 환자 안전과 인권 보호의 균형이 핵심입니다.","Correct. Balance patient safety and rights.") }, { text: loc("간호사 단독 판단으로 24시간 이상 적용 가능","Nurse can apply alone for over 24 hours"), effect: { hp: -45, rep: -35 }, log: loc("의사 처방·정기 갱신이 필수입니다.","Physician order and renewal are required.") }, { text: loc("관찰 없이 끈으로 단단히 묶어둔다","Tie tightly without monitoring"), effect: { hp: -50, rep: -40 }, log: loc("심각한 인권 침해이며 의료사고입니다.","Serious rights violation and incident.") }, { text: loc("동의서 없이 적용해도 무방","Apply without consent"), effect: { hp: -40, rep: -30 }, log: loc("응급 상황 외에는 동의가 필요합니다.","Consent required outside emergencies.") }]) }; }
function generateHomeHealthQuestion() { return { baseId: "homeHealth", categoryKey: "community", part: loc("가정간호","Home Health"), emoji: "🏠", title: loc("가정 방문 간호","Home Health Visit"), desc: loc(`가정 방문 간호 시 첫 방문에서 가장 우선되는 사정은?`,`Most important assessment on a first home visit?`), choices: shuffle([{ text: loc("환자/가족 안전과 환경 위험요소(낙상·감염)","Patient/family safety and environmental hazards (falls, infection)"), effect: { hp: -2, rep: 20 }, log: loc("정답. 가정환경 안전이 임상 결과의 1차 결정요인입니다.","Correct. Home safety is a primary outcome determinant.") }, { text: loc("환자의 정서 상태만","Only emotional state"), effect: { hp: -25, rep: -15 }, log: loc("부분적 평가입니다.","Only a partial assessment.") }, { text: loc("가족의 경제적 능력","Family's financial status"), effect: { hp: -25, rep: -15 }, log: loc("우선순위가 아닙니다.","Not the priority.") }, { text: loc("가족력 위주의 의료기록","Mainly family medical history"), effect: { hp: -25, rep: -15 }, log: loc("환경·안전이 먼저입니다.","Safety/environment come first.") }]) }; }

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
            if (mode === "survival") handleSurvivalChoice(choice, ev);
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
    gameState.correctCount = 0; gameState.wrongCount = 0;
    gameState.narrative = {
        codeBlueFailed: false, vipFailed: false, massFailed: false, savedCodeBlue: false,
        helpedNewbie: false, acceptedThanks: false, sharedMeal: false, ethicsViolation: false,
    };
}

// 12가지 스토리 엔딩 결정 — narrative 플래그 + 정답률 + 보스 + HP 종합
function decideEnding() {
    const correct = gameState.correctCount;
    const wrong = gameState.wrongCount;
    const total = correct + wrong;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const bosses = gameState.bossesCleared;
    const hp = gameState.hp;
    const rep = gameState.rep;
    const streak = gameState.bestStreak;
    const n = gameState.narrative;

    // ====== SAD ENDINGS (응급/윤리 — 우선) ======
    if (n.ethicsViolation)
        return { title: t("endEthics"), desc: t("endEthicsDesc"), accuracy };
    if (n.codeBlueFailed)
        return { title: t("endLostPatient"), desc: t("endLostPatientDesc"), accuracy };
    if (rep < 0 || hp <= 10)
        return { title: t("endInvestigation"), desc: t("endInvestigationDesc"), accuracy };
    if (accuracy < 20)
        return { title: t("endRetrainNew"), desc: t("endRetrainDescNew"), accuracy };

    // ====== HAPPY ENDINGS ======
    if (accuracy >= 95 && bosses === 3 && hp >= 50)
        return { title: t("endPromotion"), desc: t("endPromotionDesc"), accuracy };
    if (accuracy >= 85 && bosses >= 2 && n.helpedNewbie && n.acceptedThanks)
        return { title: t("endBeloved"), desc: t("endBelovedDesc"), accuracy };
    if (accuracy >= 80 && bosses >= 2)
        return { title: t("endHeroLetter"), desc: t("endHeroLetterDesc"), accuracy };

    // ====== EASTER EGG ======
    if (n.sharedMeal && accuracy >= 70 && streak >= 5)
        return { title: t("endNewBond"), desc: t("endNewBondDesc"), accuracy };

    // ====== BITTERSWEET ======
    if (hp < 30 && accuracy >= 50)
        return { title: t("endBurnout"), desc: t("endBurnoutDesc"), accuracy };
    if (accuracy >= 60 && accuracy <= 80 && streak >= 7 && hp < 50)
        return { title: t("endGradSchool"), desc: t("endGradSchoolDesc"), accuracy };

    // ====== NEUTRAL TIERS ======
    if (accuracy >= 65)
        return { title: t("endSteadyAce"), desc: t("endSteadyAceDescNew"), accuracy };
    if (accuracy >= 50)
        return { title: t("endSafeShift"), desc: t("endSafeShiftDescNew"), accuracy };
    if (accuracy >= 30)
        return { title: t("endNeedsStudy"), desc: t("endNeedsStudyDesc"), accuracy };

    return { title: t("endRetrainNew"), desc: t("endRetrainDescNew"), accuracy };
}

// 선택에 따라 스토리 플래그를 추적
function captureNarrative(ev, choice) {
    if (!ev || !choice) return;
    const n = gameState.narrative;
    const isCorrect = (choice.effect?.rep || 0) > 0;
    if (ev.baseId === "boss-codeblue") { if (choice.boss) n.savedCodeBlue = true; else n.codeBlueFailed = true; }
    if (ev.baseId === "boss-vip")      { if (!choice.boss) n.vipFailed = true; }
    if (ev.baseId === "boss-mass")     { if (!choice.boss) n.massFailed = true; }
    if (ev.baseId === "newbie"         && isCorrect)                      n.helpedNewbie = true;
    if (ev.baseId === "thankyou"       && (choice.effect?.rep || 0) >= 18) n.acceptedThanks = true;
    if (ev.baseId === "snack"          && (choice.effect?.hp   || 0) >= 18) n.sharedMeal = true;
    if (ev.baseId === "missing-chart"  && (choice.effect?.rep || 0) <= -30) n.ethicsViolation = true;
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
    () => ({ baseId: "guardian-rage", categoryKey: "flavor", part: loc("감정노동","Emotional Labor"), emoji: "🗣️", title: loc("보호자의 분노","Guardian's Outburst"), desc: loc("보호자가 \"왜 이렇게 오래 기다리게 해!\"라며 데스크 앞에서 큰 소리로 항의합니다. 다른 환자들이 쳐다봅니다.","A guardian shouts \"Why is this taking so long!\" loud enough at the desk that other patients stare."), choices: shuffle([
        { text: loc("한 발 물러서서 공감하고 상황을 차분히 설명한다","Step back, empathize, and calmly explain"), effect: { hp: -4, rep: 10 }, log: loc("분노가 가라앉았습니다.","The anger subsides.") },
        { text: loc("규정과 절차를 단호하게 안내한다","Firmly explain hospital policy and procedures"), effect: { hp: -6, rep: 4 }, log: loc("보호자가 일단 자리로 돌아갔습니다.","Guardian returns to the room for now.") },
        { text: loc("동료에게 인계하고 잠시 호흡을 가다듬는다","Hand off to a colleague and take a breath"), effect: { hp: 6, rep: -3 }, log: loc("잠시 회복했지만 책임감이 흔들립니다.","Brief recovery — but your sense of duty wavers.") },
        { text: loc("바쁜 척 자리를 피한다","Pretend to be busy and slip away"), effect: { hp: -12, rep: -16 }, log: loc("공식 민원이 접수됐습니다.","A formal complaint is filed.") }
    ]) }),
    () => ({ baseId: "newAdmission", categoryKey: "flavor", part: loc("신환","New Admission"), emoji: "🚪", title: loc("신환 입원","New Admission"), desc: loc("응급실에서 폐렴 의증 환자가 막 도착했습니다. 인계가 1분도 안 됩니다.","A suspected-pneumonia patient just arrived from the ED. You have less than a minute of handoff."), choices: shuffle([
        { text: loc("활력징후부터 측정하며 인계 빈자리를 메운다","Start with vital signs and fill the handoff gaps"), effect: { hp: -5, rep: 12 }, log: loc("기본기가 빛났습니다.","Solid fundamentals shone through.") },
        { text: loc("낙상 위험 사정과 환경 정비를 먼저 한다","Assess fall risk and prepare the environment first"), effect: { hp: -4, rep: 8 }, log: loc("안전 우선이 인정받았습니다.","Safety-first approach is recognized.") },
        { text: loc("수액부터 우선 달고 사정은 나중에","Hang IV fluids first, assess later"), effect: { hp: -10, rep: -6 }, log: loc("사정 없는 처치는 위험합니다.","Treating without assessment is dangerous.") },
        { text: loc("보호자에게 노트 작성을 부탁한다","Ask the guardian to take notes for you"), effect: { hp: -3, rep: -15 }, log: loc("보호자가 황당해합니다.","The guardian is dumbfounded.") }
    ]) }),
    () => ({ baseId: "drMad", categoryKey: "flavor", part: loc("팀워크","Teamwork"), emoji: "🥼", title: loc("의사의 짜증","Doctor's Frustration"), desc: loc("주치의가 \"왜 처방 안 받았어?\"라며 짜증을 냅니다. 처방창은 아직 열려있지 않았습니다.","The attending snaps, \"Why isn't the order in?\" — but the order entry is still empty."), choices: shuffle([
        { text: loc("\"방금 확인했는데 아직 미입력 상태입니다\"라고 사실대로 말한다","Honestly say, \"I just checked — it's still not entered\""), effect: { hp: -3, rep: 11 }, log: loc("정직이 통했습니다.","Honesty worked.") },
        { text: loc("\"확인하겠습니다\"라며 빠르게 처방을 다시 확인한다","Say, \"Let me verify\" and quickly recheck the orders"), effect: { hp: -5, rep: 6 }, log: loc("프로다운 응대였습니다.","A professional response.") },
        { text: loc("\"죄송합니다\"만 반복한다","Just repeat \"I'm sorry\""), effect: { hp: -10, rep: -3 }, log: loc("문제가 해결되지 않았습니다.","Nothing is resolved.") },
        { text: loc("감정적으로 맞받아친다","Snap back emotionally"), effect: { hp: -16, rep: -16 }, log: loc("분위기가 험악해집니다.","The atmosphere turns ugly.") }
    ]) }),
    () => ({ baseId: "fall-risk", categoryKey: "flavor", part: loc("환자 안전","Patient Safety"), emoji: "🛑", title: loc("낙상 위험 발견","Fall Risk Spotted"), desc: loc("옆 병실 환자가 침대 사이드레일을 내리고 일어서려 합니다.","A patient in the next room has lowered the side rail and is trying to stand."), choices: shuffle([
        { text: loc("즉시 다가가 부축하고 사이드레일을 올린다","Rush over, support them, and raise the side rail"), effect: { hp: -3, rep: 14 }, log: loc("낙상 사고를 막았습니다.","You prevented a fall.") },
        { text: loc("보호자에게 즉시 알리고 호출벨을 가까이 둔다","Alert the guardian and place the call bell within reach"), effect: { hp: -4, rep: 9 }, log: loc("안전 환경이 강화됐습니다.","Safer environment established.") },
        { text: loc("\"누우세요\"라고 멀리서 외친다","Shout \"Lie down!\" from a distance"), effect: { hp: -16, rep: -14 }, log: loc("환자가 미끄러졌습니다.","The patient slipped.") },
        { text: loc("차팅 중이라 잠시 후에 가본다","You're charting — check on them later"), effect: { hp: -22, rep: -22 }, log: loc("낙상 사고가 발생했습니다.","A fall occurred.") }
    ]) }),
    () => ({ baseId: "snack", categoryKey: "flavor", part: loc("휴식","Break"), emoji: "🍙", title: loc("동료의 야식","Coworker's Late-Night Snack"), desc: loc("동료가 컵라면과 김밥을 사왔습니다. \"같이 먹자\"고 권합니다.","A coworker brought instant noodles and gimbap. \"Eat with me!\" they say."), choices: shuffle([
        { text: loc("5분만 빠르게 먹고 일어선다","Eat quickly for 5 minutes and get back up"), effect: { hp: 18, rep: 1 }, log: loc("체력이 회복됐습니다.","HP recovered.") },
        { text: loc("고맙다고만 하고 일에 집중한다","Just thank them and focus on work"), effect: { hp: -3, rep: 5 }, log: loc("의지력이 빛났습니다.","Willpower shines.") },
        { text: loc("한 그릇 더 먹고 잠시 쉰다","Eat another bowl and rest a bit"), effect: { hp: 10, rep: -5 }, log: loc("포만감에 집중력이 흐려집니다.","Fullness blurs your focus.") },
        { text: loc("수다떨며 30분간 휴식한다","Chat for 30 minutes"), effect: { hp: 22, rep: -12 }, log: loc("환자 호출이 누락됐습니다.","A patient call went unanswered.") }
    ]) }),
    () => ({ baseId: "missing-chart", categoryKey: "flavor", part: loc("기록","Documentation"), emoji: "📋", title: loc("차트 누락","Missing Chart Entry"), desc: loc("오전 투약 기록 한 줄이 빠진 것을 발견했습니다.","You discover a missing line in the morning medication record."), choices: shuffle([
        { text: loc("즉시 사실대로 추가 기록하고 보고한다","Add the entry honestly and report it"), effect: { hp: -4, rep: 14 }, log: loc("투명성이 신뢰를 얻습니다.","Transparency builds trust.") },
        { text: loc("환자 상태부터 확인 후 기록한다","Check the patient first, then document"), effect: { hp: -3, rep: 9 }, log: loc("안전 우선 접근입니다.","Safety-first approach.") },
        { text: loc("눈 감고 모른 척한다","Look away and pretend you didn't see"), effect: { hp: -10, rep: -16 }, log: loc("도덕적 부담만 누적됩니다.","Only moral burden accumulates.") },
        { text: loc("몰래 임의로 기입한다","Quietly fabricate the entry"), effect: { hp: -32, rep: -34 }, log: loc("기록 위조는 중대한 위반입니다.","Falsifying records is a major violation.") }
    ]) }),
    () => ({ baseId: "bathroom", categoryKey: "flavor", part: loc("본인케어","Self-Care"), emoji: "🚻", title: loc("긴급한 신호","Urgent Personal Need"), desc: loc("방광이 한계입니다. 호출벨이 동시에 두 개 울립니다.","Your bladder is at its limit. Two call bells ring at once."), choices: shuffle([
        { text: loc("동료에게 호출 한 건을 인계하고 다녀온다","Hand off one call to a colleague and go"), effect: { hp: 6, rep: 5 }, log: loc("팀워크가 빛났습니다.","Teamwork shines.") },
        { text: loc("30초만 다녀온 뒤 호출에 응답한다","Take 30 seconds, then answer the calls"), effect: { hp: 8, rep: -3 }, log: loc("기본 권리도 중요합니다.","Basic rights matter too.") },
        { text: loc("참고 호출부터 응답한다","Hold it and answer the calls first"), effect: { hp: -16, rep: 7 }, log: loc("방광염 위험이 커졌습니다.","Cystitis risk rises.") },
        { text: loc("둘 다 동시에 응답한다며 우왕좌왕","Try to answer both at once and fumble"), effect: { hp: -10, rep: -8 }, log: loc("대응이 늦어 환자가 불만을 토로했습니다.","Delayed response — patients complain.") }
    ]) }),
    () => ({ baseId: "chargeNurse", categoryKey: "flavor", part: loc("보고","Reporting"), emoji: "📞", title: loc("차지널스 콜","Charge Nurse Call"), desc: loc("차지널스가 \"환자 상태 1분 안에 정리해서 보고해\"라고 말합니다.","Charge nurse says, \"Brief me on the patient in one minute.\""), choices: shuffle([
        { text: loc("SBAR 형식으로 핵심만 보고한다","Report the essentials in SBAR format"), effect: { hp: -3, rep: 14 }, log: loc("표준 보고가 빛났습니다.","Standard reporting shines.") },
        { text: loc("활력징후 위주로 간단히 보고한다","Quick report focused on vital signs"), effect: { hp: -2, rep: 7 }, log: loc("무난한 보고였습니다.","An adequate report.") },
        { text: loc("잘 모르겠다고 회피한다","Dodge with \"I'm not sure\""), effect: { hp: -10, rep: -16 }, log: loc("실력 부족이 드러났습니다.","Your weakness is exposed.") },
        { text: loc("감정과 잡담까지 길게 늘어놓는다","Ramble with emotions and small talk"), effect: { hp: -8, rep: -6 }, log: loc("시간 낭비라는 평가입니다.","Considered a waste of time.") }
    ]) }),
    () => ({ baseId: "thankyou", categoryKey: "flavor", part: loc("행운","Lucky Moment"), emoji: "💌", title: loc("감사 카드","Thank-You Card"), desc: loc("퇴원하는 환자가 손편지를 건네며 \"덕분에 살았어요\"라고 인사합니다.","A discharging patient hands you a handwritten note: \"You saved my life.\""), choices: shuffle([
        { text: loc("감사한 마음으로 인사받는다","Receive their thanks gratefully"), effect: { hp: 10, rep: 18 }, log: loc("마음이 따뜻해집니다. 보람이 누적됐습니다.","Your heart warms. Fulfillment accumulates.") },
        { text: loc("겸손하게 의사 덕분이라고 돌린다","Humbly credit the doctor"), effect: { hp: 6, rep: 8 }, log: loc("겸양이 인정받았습니다.","Humility is appreciated.") },
        { text: loc("어색해서 카드를 받지 않는다","Decline the card awkwardly"), effect: { hp: -2, rep: -4 }, log: loc("환자가 머쓱해합니다.","The patient feels embarrassed.") },
        { text: loc("바쁘다며 자리를 피한다","Slip away saying you're busy"), effect: { hp: -4, rep: -8 }, log: loc("감사 표현을 외면했습니다.","You turned away from gratitude.") }
    ]) }),
    () => ({ baseId: "newbie", categoryKey: "flavor", part: loc("선임 멘토링","Senior Mentoring"), emoji: "👶", title: loc("신규 간호사 도움 요청","New Grad Asking for Help"), desc: loc("신규 간호사가 IV 카테터를 3번 실패하고 울 것 같은 표정으로 도움을 청합니다.","A new grad has missed the IV three times and asks for help, near tears."), choices: shuffle([
        { text: loc("함께 가서 시범을 보이며 천천히 가르친다","Go together, demonstrate, and teach slowly"), effect: { hp: -5, rep: 16 }, log: loc("후배가 자신감을 얻었습니다.","Junior gains confidence.") },
        { text: loc("\"내가 대신 해줄게\" 하고 직접 처치한다","Say \"I'll do it for you\" and handle it yourself"), effect: { hp: -4, rep: 4 }, log: loc("당장은 해결됐지만 성장 기회를 뺏었습니다.","Solves the moment but steals their growth.") },
        { text: loc("\"3번이면 환자에게 미안해\"라며 핀잔준다","Scold them: \"Three tries — apologize to the patient\""), effect: { hp: -6, rep: -12 }, log: loc("후배의 자존감이 무너졌습니다.","Junior's self-esteem crumbles.") },
        { text: loc("차팅 중이라 무시한다","Ignore them — you're charting"), effect: { hp: -8, rep: -14 }, log: loc("후배가 다른 동료에게 갔습니다.","The junior turns to another colleague.") }
    ]) }),
    // ===== 신규 일상 이벤트 8개 =====
    () => ({ baseId: "ivPumpDown", categoryKey: "flavor", part: loc("장비 고장","Equipment Failure"), emoji: "🔌", title: loc("IV 펌프 고장","IV Pump Failure"), desc: loc("정맥주입 펌프가 갑자기 작동을 멈추며 알람이 울립니다. 환자의 항생제가 들어가야 하는 시간입니다.","The IV pump suddenly stops with an alarm. The antibiotic should be infusing right now."), choices: shuffle([
        { text: loc("즉시 다른 펌프로 교체하고 BME에 신고","Swap to another pump immediately and notify biomed"), effect: { hp: -4, rep: 14 }, log: loc("환자 치료 흐름이 유지됐습니다.","Patient's treatment flow is preserved.") },
        { text: loc("우선 수액 흐름을 수동으로 조절하고 펌프 점검을 요청","Run gravity drip manually first, then call for pump check"), effect: { hp: -6, rep: 8 }, log: loc("임시 조치가 적절했습니다.","A reasonable temporary fix.") },
        { text: loc("알람을 끄고 그대로 둔다","Silence the alarm and leave it"), effect: { hp: -22, rep: -22 }, log: loc("처방 누락으로 사고 위험이 큽니다.","Missed dose — high incident risk.") },
        { text: loc("환자에게 알림 없이 항생제를 건너뛴다","Skip the antibiotic without telling the patient"), effect: { hp: -32, rep: -28 }, log: loc("처방 위반이며 안전 문제입니다.","Order violation and safety issue.") }
    ]) }),
    () => ({ baseId: "drugShortage", categoryKey: "flavor", part: loc("약품 부족","Drug Shortage"), emoji: "📦", title: loc("약품 재고 부족","Drug Shortage"), desc: loc("처방된 약물이 약국에 재고 없음으로 표시됩니다. 환자는 곧 진통제가 필요합니다.","The pharmacy shows the prescribed drug is out of stock. The patient will need pain control soon."), choices: shuffle([
        { text: loc("의사·약사에게 동등 효능 대체약 처방을 즉시 요청","Immediately request an equivalent substitute from physician/pharmacist"), effect: { hp: -3, rep: 14 }, log: loc("표준 절차에 따라 빠르게 해결됐습니다.","Resolved quickly via standard pathway.") },
        { text: loc("환자가 호소할 때까지 기다린다","Wait until the patient complains"), effect: { hp: -15, rep: -10 }, log: loc("통증 관리가 지연됐습니다.","Pain management delayed.") },
        { text: loc("다른 환자 약을 빌려서 사용한다","Borrow another patient's medication"), effect: { hp: -40, rep: -34 }, log: loc("절대 금기. 약물 관리 위반입니다.","Absolutely contraindicated. Medication violation.") },
        { text: loc("기록만 남기고 회진 시 보고","Just document and report at rounds"), effect: { hp: -10, rep: -8 }, log: loc("적극적 개입이 부족했습니다.","Insufficient proactive action.") }
    ]) }),
    () => ({ baseId: "alarmFatigue", categoryKey: "flavor", part: loc("알람 폭주","Alarm Fatigue"), emoji: "🚨", title: loc("동시 다중 알람","Simultaneous Multi-Alarms"), desc: loc("4명의 환자 모니터에서 동시에 알람이 울립니다. SpO2·심박수·혈압 모두 변동합니다.","Four patient monitors alarm simultaneously — SpO2, HR, BP all fluctuating."), choices: shuffle([
        { text: loc("ABC 우선순위로 환자별 사정·분류 후 가장 위급한 환자부터","Triage by ABC priority, then attend the most critical first"), effect: { hp: -5, rep: 18 }, log: loc("우선순위 판단이 빛났습니다.","Priority judgment shines.") },
        { text: loc("모든 알람을 일괄로 끄고 천천히 확인","Silence all alarms at once and check slowly"), effect: { hp: -35, rep: -28 }, log: loc("실제 응급을 놓칠 수 있습니다.","May miss a true emergency.") },
        { text: loc("동료에게 도움을 요청하지 않고 혼자 처리","Try to handle it all alone without asking for help"), effect: { hp: -20, rep: -10 }, log: loc("팀 호출이 더 안전합니다.","Calling for help is safer.") },
        { text: loc("가장 가까운 환자부터 처리","Just handle the nearest patient first"), effect: { hp: -22, rep: -14 }, log: loc("우선순위 원칙을 어겼습니다.","Violates triage principle.") }
    ]) }),
    () => ({ baseId: "endOfLife", categoryKey: "flavor", part: loc("임종 케어","End-of-Life"), emoji: "🕯️", title: loc("가족 회의","Family Meeting"), desc: loc("말기 환자의 가족이 \"고통스럽지 않게 해 주세요\"라며 통증 조절을 부탁합니다.","The dying patient's family pleads, \"Please keep them comfortable.\""), choices: shuffle([
        { text: loc("처방된 진통제·항불안제로 편안함을 유지하고 가족 곁에 머물게 한다","Use ordered analgesics/anxiolytics for comfort and let family stay close"), effect: { hp: -3, rep: 18 }, log: loc("호스피스 원칙에 부합합니다.","Aligns with hospice principles.") },
        { text: loc("호흡 억제 우려로 진통제를 모두 끊는다","Withhold all analgesics fearing respiratory depression"), effect: { hp: -28, rep: -22 }, log: loc("말기 환자에게 통증 완화가 우선입니다.","Comfort takes precedence at end of life.") },
        { text: loc("가족을 모두 병실 밖으로 내보낸다","Send all family out of the room"), effect: { hp: -25, rep: -20 }, log: loc("가족 동행이 임종 케어의 핵심입니다.","Family presence is central to dying care.") },
        { text: loc("\"이제 곧 끝납니다\" 같은 단정적 발언을 한다","Make blunt statements like \"It'll be over soon\""), effect: { hp: -20, rep: -16 }, log: loc("부적절한 의사소통입니다.","Inappropriate communication.") }
    ]) }),
    () => ({ baseId: "itCrash", categoryKey: "flavor", part: loc("EMR 다운","EMR Crash"), emoji: "💻", title: loc("전자의무기록 다운","EMR Down"), desc: loc("EMR이 다운됐습니다. 모든 처방·기록이 보이지 않습니다.","The EMR is down. All orders and records are inaccessible."), choices: shuffle([
        { text: loc("종이 백업 양식으로 전환 + IT·약국·의사 동시 통보","Switch to paper downtime forms; notify IT, pharmacy, physicians"), effect: { hp: -5, rep: 16 }, log: loc("표준 다운타임 프로토콜입니다.","Standard downtime protocol.") },
        { text: loc("기억에 의존해서 임의로 약을 투여한다","Give meds from memory"), effect: { hp: -45, rep: -38 }, log: loc("심각한 투약 사고 위험.","Serious med-error risk.") },
        { text: loc("EMR 복구까지 모든 업무를 중단","Halt all care until EMR is back"), effect: { hp: -28, rep: -20 }, log: loc("환자 안전이 위협됩니다.","Compromises patient safety.") },
        { text: loc("환자에게 \"전산 고장\"이라고만 말하고 회피","Just tell patients \"system is down\" and avoid duties"), effect: { hp: -20, rep: -14 }, log: loc("책임 회피입니다.","Avoidance of duty.") }
    ]) }),
    () => ({ baseId: "mvcMass", categoryKey: "flavor", part: loc("기상 재난","Weather Disaster"), emoji: "🌪️", title: loc("폭우 다수 입실","Storm Mass Admission"), desc: loc("폭우로 사고가 속출. 응급실에서 신환 8명이 한꺼번에 올라옵니다. 보스 트리아지는 아니지만 인력은 빡빡합니다.","Severe storm: 8 new admissions land on your unit at once. Not the boss event, but staff is stretched."), choices: shuffle([
        { text: loc("팀별 분담과 ABC 우선순위로 빠르게 흡수","Distribute by team and absorb by ABC priority"), effect: { hp: -8, rep: 18 }, log: loc("위기 관리가 매끄러웠습니다.","Smooth crisis management.") },
        { text: loc("수간호사에게 즉시 추가 인력 요청","Immediately request more staff from head nurse"), effect: { hp: -5, rep: 14 }, log: loc("적절한 보고체계 사용.","Used the right escalation chain.") },
        { text: loc("들어온 순서대로 천천히 처리","Just process in arrival order, slowly"), effect: { hp: -25, rep: -18 }, log: loc("중증환자가 방치될 수 있습니다.","Critical patients may be neglected.") },
        { text: loc("일단 자리를 비우고 휴게실로","Step out to the break room first"), effect: { hp: -20, rep: -22 }, log: loc("책임 회피입니다.","Abandoning duty.") }
    ]) }),
    () => ({ baseId: "preceptorBossy", categoryKey: "flavor", part: loc("선임 갈등","Senior Conflict"), emoji: "😤", title: loc("프리셉터 갈등","Preceptor Conflict"), desc: loc("프리셉터(선임)가 환자 앞에서 \"이것도 못해?\"라며 큰 소리로 핀잔을 줍니다.","Your preceptor scolds you in front of the patient: \"You can't even do this?\""), choices: shuffle([
        { text: loc("환자 앞에서는 차분히 응대하고, 후에 따로 대화 요청","Respond calmly in front of the patient, request a private debrief later"), effect: { hp: -6, rep: 14 }, log: loc("프로다운 처신.","Professional handling.") },
        { text: loc("그 자리에서 즉시 반박하고 언쟁","Argue back on the spot"), effect: { hp: -18, rep: -14 }, log: loc("환자 신뢰가 깨졌습니다.","Patient trust is shattered.") },
        { text: loc("울며 자리를 떠난다","Walk away in tears"), effect: { hp: -16, rep: -10 }, log: loc("환자 관리가 중단됐습니다.","Patient care was interrupted.") },
        { text: loc("수간호사에게 익명 신고","Anonymous report to the head nurse"), effect: { hp: -8, rep: 4 }, log: loc("절차는 정당하나 직접 대화가 우선이었습니다.","Valid channel, but direct talk first would've been better.") }
    ]) }),
    () => ({ baseId: "needleStick", categoryKey: "flavor", part: loc("바늘찔림","Needlestick"), emoji: "💉", title: loc("바늘찔림 사고","Needlestick Injury"), desc: loc("HIV 양성 환자에게 정맥주사 후 손가락에 바늘이 찔렸습니다. 출혈 중입니다.","After IV on an HIV+ patient, the needle stuck your finger. It's bleeding."), choices: shuffle([
        { text: loc("즉시 흐르는 물로 5분 세척 후 사고 신고·PEP 시작","Wash under running water 5 min, report incident, start PEP"), effect: { hp: -8, rep: 18 }, log: loc("표준 노출 후 처치입니다.","Standard post-exposure protocol.") },
        { text: loc("아무에게도 말하지 않고 일을 계속한다","Tell no one and keep working"), effect: { hp: -32, rep: -32 }, log: loc("자신과 미래 환자가 위험에 노출.","Endangers self and future patients.") },
        { text: loc("상처 부위를 입으로 빨아낸다","Suck the wound to extract blood"), effect: { hp: -28, rep: -20 }, log: loc("점막 노출 위험을 증가시킵니다.","Increases mucosal exposure risk.") },
        { text: loc("드레싱만 하고 PEP 결정은 다음 주에","Just bandage; decide on PEP next week"), effect: { hp: -25, rep: -18 }, log: loc("PEP은 가능한 빨리 시작해야 합니다(이상적: 2시간 내).","PEP must start ASAP — ideally within 2 hours.") }
    ]) }),
];

// =========================
// 보스 이벤트 (eventCount 5/10/18)
// =========================
function bossEventForCount(count) {
    if (count === 5) return { baseId: "boss-codeblue", categoryKey: "boss", part: "BOSS", emoji: "💥",
        title: loc("[BOSS] 코드 블루","[BOSS] Code Blue"),
        desc: loc("병실에서 \"환자 의식 없어요!\"라는 외침. 모니터가 평탄선을 그립니다. 당신이 발견자입니다.","A scream from the room — \"Patient's unresponsive!\" The monitor flatlines. You're the first to find them."),
        choices: shuffle([
            { text: loc("의식·호흡 확인 즉시 가슴압박, 동료에게 코드블루 콜 요청","Confirm unresponsive/apneic, start compressions, call Code Blue"), effect: { hp: -10, rep: 38 }, log: loc("신속한 대응으로 ROSC! 보스 클리어!","ROSC achieved! Boss cleared!"), boss: true },
            { text: loc("AED만 가지러 다녀온다","Just go get the AED"), effect: { hp: -32, rep: -28 }, log: loc("가슴압박 공백이 생겼습니다.","A gap in compressions opens up.") },
            { text: loc("주치의에게 전화부터 한다","Call the attending first"), effect: { hp: -50, rep: -42 }, log: loc("골든타임을 놓쳤습니다.","Golden time is lost.") },
            { text: loc("보호자에게 먼저 상황을 설명한다","Explain the situation to the guardian first"), effect: { hp: -50, rep: -45 }, log: loc("환자가 사망 위기에 빠졌습니다.","The patient is on the brink of death.") }
        ])
    };
    if (count === 10) return { baseId: "boss-vip", categoryKey: "boss", part: "BOSS", emoji: "👑",
        title: loc("[BOSS] VIP 환자","[BOSS] VIP Patient"),
        desc: loc("병원 이사장의 모친이 입원했습니다. 보호자가 \"24시간 1:1 간호, 회진 우선, 특별식\" 등 무리한 요구를 쏟아냅니다.","The hospital chairman's mother is admitted. Family demands 24-hour 1:1 care, priority rounds, and a special diet."),
        choices: shuffle([
            { text: loc("환자 안전을 최우선으로 원칙대로 응대하며 정중히 설명한다","Prioritize patient safety, follow policy, and explain politely"), effect: { hp: -10, rep: 32 }, log: loc("전문성이 인정받았습니다. 보스 클리어!","Professionalism recognized. Boss cleared!"), boss: true },
            { text: loc("수간호사에게 즉시 보고하여 대응 방향을 정한다","Escalate to the head nurse and align on a response"), effect: { hp: -8, rep: 18 }, log: loc("차분한 보고체계로 위기를 넘겼습니다.","Crisis navigated through calm chain of command."), boss: true },
            { text: loc("모든 요구를 무리해서 다 들어준다","Bend over backwards to grant every demand"), effect: { hp: -28, rep: -16 }, log: loc("본인이 번아웃 직전이고 다른 환자가 방치됐습니다.","On the brink of burnout — other patients neglected.") },
            { text: loc("VIP라 무서워서 회피한다","Avoid them out of fear of the VIP"), effect: { hp: -22, rep: -28 }, log: loc("민원이 접수됐습니다.","A complaint is filed.") }
        ])
    };
    if (count === 18) return { baseId: "boss-mass", categoryKey: "boss", part: "BOSS", emoji: "🚑",
        title: loc("[BOSS] 다중외상 5명 동시 입실","[BOSS] Mass Casualty — 5 at Once"),
        desc: loc("교통사고로 환자 5명이 동시 도착. 인력은 당신과 신규 1명뿐입니다.","Five trauma patients arrive simultaneously from an MVC. Only you and one new grad are available."),
        choices: shuffle([
            { text: loc("START 분류로 적색·황색·녹색 트리아지 후 인력 배분","START triage into Red/Yellow/Green and allocate staff"), effect: { hp: -14, rep: 42 }, log: loc("훌륭한 트리아지로 모두 살렸습니다! 최종 보스 클리어!","Brilliant triage saves everyone! Final boss cleared!"), boss: true },
            { text: loc("눈에 띄는 출혈 환자부터 무작정 처치한다","Just treat the most visibly bleeding patient first"), effect: { hp: -32, rep: -22 }, log: loc("기도 폐쇄 환자가 방치됐습니다.","An airway-obstructed patient is neglected.") },
            { text: loc("신규에게 알아서 하라고 맡긴다","Tell the new grad to handle it themselves"), effect: { hp: -28, rep: -32 }, log: loc("리더십 부재로 사고가 발생했습니다.","Lack of leadership leads to incidents.") },
            { text: loc("도착한 순서대로 처치한다","Treat in order of arrival"), effect: { hp: -28, rep: -18 }, log: loc("트리아지 원칙을 어겼습니다.","Triage principles violated.") }
        ])
    };
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

function handleSurvivalChoice(choice, ev) {
    applyChoiceEffect(choice);
    const repDelta = choice.effect?.rep || 0;
    if (choice.log) addLog(choice.log, repDelta > 0 ? "log-good" : repDelta < 0 ? "log-bad" : "");

    // 정답/오답 카운트 (intro 제외 — eventCount 증가한 이벤트만)
    const isScoredEvent = ev && ev.baseId !== "intro";
    if (isScoredEvent) {
        if (repDelta > 0) gameState.correctCount += 1;
        else if (repDelta < 0) gameState.wrongCount += 1;
    }

    // 스토리 플래그 캡처 (엔딩 분기 결정용)
    captureNarrative(ev, choice);

    // 오답 시 정답 안내 (학습 효과)
    if (repDelta < 0 && ev && ev.choices) {
        const correctChoice = ev.choices.find(c => (c.effect?.rep || 0) > 0);
        if (correctChoice) {
            addLog(`${t("correctAnswer")}: ${correctChoice.text}`, "log-important");
            if (correctChoice.log) addLog(correctChoice.log, "log-good");
        }
    }

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
        const ending = decideEnding();
        let desc = ending.desc + `\n\n${t("accuracyLabel")}: ${gameState.correctCount}/${gameState.correctCount + gameState.wrongCount} (${ending.accuracy}%) · ${t("bestCombo")} ${gameState.bestStreak} · ${t("metaBoss")} ${gameState.bossesCleared}/3`;
        // 평생 통계 갱신
        gameState.lifetime.dutiesCompleted += 1;
        if (gameState.bestStreak > gameState.lifetime.bestStreak) gameState.lifetime.bestStreak = gameState.bestStreak;
        if (gameState.rep > gameState.lifetime.bestRep) gameState.lifetime.bestRep = gameState.rep;
        saveSettings();
        return showGameOver(ending.title, desc);
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
    const correctChoice = ev.choices.find(c => (c.effect?.rep || 0) > 0);

    // 선택 버튼에 시각적 표시 (정답=녹색, 사용자 오답=빨강)
    const buttons = document.querySelectorAll("#choice-list .choice-btn");
    ev.choices.forEach((c, i) => {
        if (c === correctChoice) buttons[i].classList.add("answer-correct");
        if (c === choice && !isCorrect) buttons[i].classList.add("answer-wrong");
    });

    let feedbackHtml = `
      <div class="feedback-box ${isCorrect ? "correct" : "wrong"}">
        <div class="feedback-title">${isCorrect ? t("correct") : t("wrong")}</div>`;

    if (!isCorrect) {
        feedbackHtml += `
          <div class="feedback-row"><strong>${t("yourChoice")}:</strong> ${choice.text}</div>
          <div class="feedback-text">${choice.log || ""}</div>
          <hr class="feedback-divider">
          <div class="feedback-row"><strong>${t("correctAnswer")}:</strong> ${correctChoice.text}</div>
          <div class="feedback-text"><strong>${t("rationaleLabel")}:</strong> ${correctChoice.log || ""}</div>`;
    } else {
        feedbackHtml += `
          <div class="feedback-row"><strong>${t("correctAnswer")}:</strong> ${correctChoice.text}</div>
          <div class="feedback-text">${correctChoice.log || ""}</div>`;
    }

    feedbackHtml += `</div>
      <div class="choice-list" style="margin-top:12px;">
        <button class="choice-btn primary center" onclick="goNextQuiz()">${t("nextQuestion")}</button>
        <button class="choice-btn center" onclick="renderQuizMenu()">${t("changeSubject")}</button>
      </div>`;
    document.getElementById("feedback-zone").innerHTML = feedbackHtml;

    const correctTag = loc("[정답]", "[Correct]");
    const wrongTag = loc("[오답]", "[Wrong]");
    if (isCorrect) {
        gameState.rep += 6;
        gameState.quizSolved += 1;
        gameState.correctCount += 1;
        gameState.lifetime.totalQuizSolved += 1;
        saveSettings();
        addLog(`${correctTag} ${choice.log}`, "log-good");
    } else {
        gameState.hp -= Math.round(4 * gameState.difficulty);
        gameState.wrongCount += 1;
        addLog(`${wrongTag} ${choice.log}`, "log-bad");
        if (correctChoice) addLog(`${t("correctAnswer")}: ${correctChoice.text}`, "log-important");
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
    const correct = gameState.correctCount;
    const wrong = gameState.wrongCount;
    const total = correct + wrong;
    const acc = total > 0 ? Math.round((correct / total) * 100) : 0;
    document.getElementById("modal-stats").innerHTML = `
    ${t("finalHp")}: <span class="highlight">${clamp(gameState.hp, 0, 100)}</span> ·
    ${t("finalRep")}: <span class="highlight">${gameState.rep}</span><br>
    ${t("correctLabel")} <span class="highlight">${correct}</span> /
    ${t("wrongLabel")} <span class="highlight">${wrong}</span> ·
    ${t("accuracyLabel")}: <span class="highlight">${acc}%</span>
    <hr style="border:0; border-top:1px solid rgba(255,255,255,0.12); margin:10px 0;">
    <div class="ending-rules-block">
      <div class="ending-rules-title">${t("rulesHeading")}</div>
      <div class="ending-rules-grid">
        <div>🌟 ${loc("승진","Promotion")}</div><div>95%+ · ${loc("보스 3/3","Boss 3/3")}</div>
        <div>💝 ${loc("멘토","Mentor")}</div><div>85%+ · ${loc("멘토링·감사","Mentor·Thanks")}</div>
        <div>💌 ${loc("손편지","Letter")}</div><div>80%+ · ${loc("보스 2+","Boss 2+")}</div>
        <div>☕ ${loc("새 인연","New Bond")}</div><div>${loc("야식+콤보5+70%","Snack+Combo5+70%")}</div>
        <div>💪 ${loc("든든한 에이스","Steady Ace")}</div><div>≥65%</div>
        <div>✅ ${loc("무사 완수","Safe")}</div><div>≥50%</div>
        <div>🎓 ${loc("대학원","Grad School")}</div><div>${loc("60-80%·HP낮음·콤보7+","60-80%·low HP·combo 7+")}</div>
        <div>🌅 ${loc("번아웃","Burnout")}</div><div>${loc("50%+·HP<30","50%+·HP<30")}</div>
        <div>🤔 ${loc("학습 필요","Needs Study")}</div><div>≥30%</div>
        <div>📋 ${loc("재교육","Retrain")}</div><div>&lt;20%</div>
        <div>⚰️ ${loc("환자 사망","Patient Lost")}</div><div>${loc("코드블루 실패","Code Blue failed")}</div>
        <div>⚖️ ${loc("기록 위조","Falsified Records")}</div><div>${loc("차트 임의 기입","Chart fabrication")}</div>
        <div>⚖️ ${loc("사고 위원회","Incident Review")}</div><div>${loc("평판<0 또는 HP=0","Rep<0 or HP=0")}</div>
      </div>
    </div>
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
    if (!gameState.disclaimerAccepted) {
        // 첫 실행 시 의료 면책고지 강제 노출
        setTimeout(() => showDisclaimer(true), 200);
    }
});

// 서비스 워커 등록 (오프라인 PWA)
if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    });
}