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
    studyTools: { wrongIds: [], bookmarkIds: [] },
    timedExam: null, // { startMs, durationMs, total, done, correct, wrong }
    srs: { cards: {} }, // { baseId: { box: 1..5, dueAt: ms, lastSeen: ms } }
};

// SRS Leitner 5-box 간격(일): 박스1=즉시, 2=1일, 3=3일, 4=7일, 5=14일
const SRS_INTERVALS_DAYS = [0, 0, 1, 3, 7, 14];
function srsAnswered(baseId, isCorrect) {
    if (!baseId) return;
    const card = gameState.srs.cards[baseId] || { box: 1, dueAt: 0, lastSeen: 0 };
    if (isCorrect) card.box = Math.min(5, card.box + 1);
    else card.box = 1;
    card.lastSeen = Date.now();
    card.dueAt = Date.now() + SRS_INTERVALS_DAYS[card.box] * 24 * 60 * 60 * 1000;
    gameState.srs.cards[baseId] = card;
    saveSettings();
}
function getSrsDueIds() {
    const now = Date.now();
    return Object.entries(gameState.srs.cards)
        .filter(([id, c]) => c.dueAt <= now)
        .map(([id]) => id);
}
function getSrsBoxCounts() {
    const counts = [0, 0, 0, 0, 0]; // boxes 1..5
    Object.values(gameState.srs.cards).forEach(c => { if (c.box >= 1 && c.box <= 5) counts[c.box - 1]++; });
    return counts;
}

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

    // ===== 학습 도구 (오답노트·북마크·시간모드) =====
    wrongReviewBtn:   { ko: "🔁 오답노트", en: "🔁 Wrong-Answer Review" },
    bookmarkBtn:      { ko: "⭐ 북마크", en: "⭐ Bookmarks" },
    timedExamBtn:     { ko: "⏱️ 모의시험 (30문항·30분)", en: "⏱️ Mock Exam (30Q · 30min)" },
    wrongEmpty:       { ko: "오답이 아직 없습니다. 일반 학습부터 시작해 보세요.", en: "No wrong answers yet. Start with regular study." },
    bookmarkEmpty:    { ko: "북마크가 비어있습니다. 문제 풀이 중 ⭐를 눌러 저장하세요.", en: "Bookmarks empty. Tap ⭐ during quiz to save." },
    bookmarkAdd:      { ko: "⭐ 북마크 추가", en: "⭐ Bookmark" },
    bookmarkRemove:   { ko: "⭐ 북마크 해제", en: "⭐ Unbookmark" },
    bookmarkSaved:    { ko: "⭐ 북마크 저장됨", en: "⭐ Bookmarked" },
    bookmarkRemoved:  { ko: "북마크 해제됨", en: "Bookmark removed" },
    masteredFromWrong:{ ko: "오답노트에서 제거됨 (정복!)", en: "Removed from review (mastered!)" },
    examTimeLabel:    { ko: "남은 시간", en: "Time left" },
    examQNumLabel:    { ko: "문항", en: "Question" },
    examFinishTitle:  { ko: "📝 모의시험 종료", en: "📝 Mock Exam Complete" },
    examTimeUp:       { ko: "⏰ 시간 종료", en: "⏰ Time's Up" },
    examScoreLabel:   { ko: "점수", en: "Score" },
    examTimeUsed:     { ko: "소요 시간", en: "Time used" },
    finishExamBtn:    { ko: "지금 종료", en: "Finish Now" },
    nextExamQ:        { ko: "다음 문항", en: "Next Question" },

    // ===== SRS Leitner =====
    srsBtn:           { ko: "🧠 간격반복(SRS) 복습", en: "🧠 Spaced Repetition Review" },
    srsEmpty:         { ko: "오늘 도래한 SRS 카드가 없습니다. 일반 학습으로 카드를 만들어 보세요.", en: "No SRS cards due today. Build cards via regular study." },
    srsAllNew:        { ko: "아직 SRS에 등록된 카드가 없습니다.", en: "No SRS cards yet." },
    srsBoxLabel:      { ko: "박스", en: "Box" },
    srsDueLabel:      { ko: "도래", en: "Due" },

    // ===== 서브토픽 필터 =====
    chooseTopic:      { ko: "세부 주제 선택", en: "Choose Subtopic" },
    allTopics:        { ko: "📚 전체 (모든 세부 주제)", en: "📚 All (every subtopic)" },
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
    settingsExport:   { ko: "💾 진도·통계 내보내기", en: "💾 Export Progress/Stats" },
    settingsImport:   { ko: "📥 백업 불러오기", en: "📥 Import Backup" },
    exportDone:       { ko: "✅ 백업 파일이 다운로드됐습니다", en: "✅ Backup file downloaded" },
    importDone:       { ko: "✅ 백업이 복원됐습니다", en: "✅ Backup restored" },
    importFail:       { ko: "❌ 백업 파일 형식이 올바르지 않습니다", en: "❌ Invalid backup file" },
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
            studyTools: gameState.studyTools,
            srs: gameState.srs,
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
        if (data.studyTools) {
            gameState.studyTools.wrongIds = Array.isArray(data.studyTools.wrongIds) ? data.studyTools.wrongIds : [];
            gameState.studyTools.bookmarkIds = Array.isArray(data.studyTools.bookmarkIds) ? data.studyTools.bookmarkIds : [];
        }
        if (data.srs && data.srs.cards) gameState.srs.cards = data.srs.cards;
    } catch (e) { /* corrupt 무시 */ }
}

// 학습 도구 헬퍼
function addWrongId(baseId) {
    if (!baseId) return;
    const arr = gameState.studyTools.wrongIds;
    if (!arr.includes(baseId)) { arr.push(baseId); saveSettings(); }
}
function removeWrongId(baseId) {
    const arr = gameState.studyTools.wrongIds;
    const idx = arr.indexOf(baseId);
    if (idx >= 0) { arr.splice(idx, 1); saveSettings(); }
}
function toggleBookmark(baseId) {
    if (!baseId) return false;
    const arr = gameState.studyTools.bookmarkIds;
    const idx = arr.indexOf(baseId);
    if (idx >= 0) { arr.splice(idx, 1); saveSettings(); return false; }
    arr.push(baseId); saveSettings(); return true;
}
function isBookmarked(baseId) { return gameState.studyTools.bookmarkIds.includes(baseId); }
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
    const isKo = gameState.lang === "ko";
    ko.classList.toggle("active", isKo);
    en.classList.toggle("active", !isKo);
    ko.setAttribute("aria-pressed", isKo ? "true" : "false");
    en.setAttribute("aria-pressed", !isKo ? "true" : "false");
    document.documentElement.lang = gameState.lang;
}

// =========================
// 루트 렌더 (현재 모드에 따라)
// =========================
function renderRoot() {
    if (gameState.mode === "menu") return renderMainMenu();
    if (gameState.mode === "settings") return renderSettings();
    if (gameState.mode === "quiz_menu") return renderQuizMenu();
    if (gameState.mode === "subtopic_picker") return pickCategory(gameState.quizCategory);
    if (gameState.mode === "quiz" || gameState.mode === "review_wrong"
        || gameState.mode === "review_bookmark" || gameState.mode === "timed_exam"
        || gameState.mode === "srs_review") return renderNextQuizQuestion();
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
                <button class="choice-btn ghost" onclick="exportBackup()">${t("settingsExport")}</button>
                <button class="choice-btn ghost" onclick="document.getElementById('import-file').click()">${t("settingsImport")}</button>
                <input type="file" id="import-file" accept=".json,application/json" style="display:none" onchange="importBackup(event)">
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

// 진도·통계 백업: JSON 다운로드
function exportBackup() {
    const payload = {
        appVersion: "1.5.0",
        exportedAt: new Date().toISOString(),
        lang: gameState.lang,
        lifetime: gameState.lifetime,
        studyTools: gameState.studyTools,
        srs: gameState.srs,
        disclaimerAccepted: gameState.disclaimerAccepted,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nurse-simulator-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(t("exportDone"));
}

// 백업 파일을 불러와 진도 복원
function importBackup(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            if (typeof data !== "object") throw new Error("not an object");
            // 안전하게 필드별로 검사하며 적용
            if (data.lang === "ko" || data.lang === "en") gameState.lang = data.lang;
            if (data.lifetime && typeof data.lifetime === "object") Object.assign(gameState.lifetime, data.lifetime);
            if (data.studyTools && typeof data.studyTools === "object") {
                if (Array.isArray(data.studyTools.wrongIds)) gameState.studyTools.wrongIds = data.studyTools.wrongIds;
                if (Array.isArray(data.studyTools.bookmarkIds)) gameState.studyTools.bookmarkIds = data.studyTools.bookmarkIds;
            }
            if (data.srs && data.srs.cards && typeof data.srs.cards === "object") gameState.srs.cards = data.srs.cards;
            if (data.disclaimerAccepted) gameState.disclaimerAccepted = true;
            saveSettings();
            showToast(t("importDone"));
            renderSettings();
        } catch (e) {
            showToast(t("importFail"));
        }
        event.target.value = ""; // 같은 파일 다시 선택 가능하게
    };
    reader.readAsText(file);
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
    generateRestraintLawQuestion, generateHomeHealthQuestion,
    // ===== 4차 대규모 확장 (40개) =====
    generatePneumoniaQuestion, generateTBINHQuestion, generateHIVTransmissionQuestion,
    generateGERDQuestion, generateDiverticulitisQuestion, generateGoutQuestion,
    generateRAOAQuestion, generateOsteoporosisQuestion, generateDM12Question,
    generateSIADHQuestion, generateAddisonQuestion, generateTensionPneumoQuestion,
    generateStatusEpilepticusQuestion, generateHeadInjuryQuestion, generateUTIQuestion,
    generateLeopoldQuestion, generatePretermLaborQuestion, generateMastitisQuestion,
    generateCSectionQuestion, generatePrenatalDangerQuestion, generatePedDehydrationQuestion,
    generatePyloricQuestion, generateIntussusceptionQuestion, generatePedMeningitisQuestion,
    generateChildAbuseQuestion, generateDefenseMechQuestion, generateBorderlineQuestion,
    generateAnxietyDisorderQuestion, generateGriefStagesQuestion, generateDisasterPhaseQuestion,
    generateSurveillanceQuestion, generatePHNPriorityQuestion, generateEBPQuestion,
    generateTransformLeadQuestion, generateMagnetQuestion, generateDNRQuestion,
    generateChildAbuseLawQuestion, generateElderAbuseQuestion, generateJPDrainQuestion,
    generatePainTypesQuestion,
    // ===== 배치 1: 심혈관·호흡기 10문제 =====
    generateTamponadeQuestion, generateAorticDissectionQuestion, generateHTNCrisisQuestion,
    generateS3S4Question, generateAFlutterQuestion, generateARDSQuestion,
    generatePulmonaryEdemaQuestion, generatePleuralEffusionQuestion, generateAdultAsthmaQuestion,
    generatePostopAtelectasisQuestion,
    // ===== 배치 2: 신장·내분비·소화기·신경 10문제 =====
    generateAKIQuestion, generateGlomerulonephritisQuestion, generateNephroticSyndromeQuestion,
    generatePheoQuestion, generateHypoparaQuestion, generateHyperparaQuestion,
    generateBowelObstructionQuestion, generateGIBleedQuestion, generatePeritonitisQuestion,
    generateMGCrisisQuestion,
    // ===== 배치 3: 신경·면역·모성·아동 10문제 =====
    generateGBSQuestion, generateBellsQuestion, generateSLEQuestion,
    generateSJSQuestion, generateCordProlapseQuestion, generateUterineRuptureQuestion,
    generateAROMQuestion, generateTEFQuestion, generateHirschsprungQuestion,
    generateCFQuestion,
    // ===== 배치 4: 정신·기본·지역사회·관리 10문제 =====
    generateRSVQuestion, generateSomatoformQuestion, generateDissociativeQuestion,
    generateBulimiaQuestion, generateHeatColdQuestion, generateCrutchGaitQuestion,
    generateHandHygieneTypesQuestion, generateROMTypesQuestion, generateHerdImmunityQuestion,
    generateJustCultureQuestion,
    // ===== 이미지 문제: ECG·욕창·트리아지·9의법칙·심장·체위·반사 (총 10개) =====
    generateECGNSRQuestion, generateECGAFibQuestion, generateECGVTachQuestion,
    generateECGAsystoleQuestion, generatePressureUlcerStageQuestion,
    generateTriageColorQuestion, generateRuleOfNinesQuestion, generateHeartChambersQuestion,
    generatePositionDiagramQuestion, generateMoroReflexQuestion,
    // ===== 배치 5: 추가 30문제 =====
    generateMSQuestion, generateParkinsonQuestion, generateAlzheimerQuestion,
    generateDVTQuestion, generateAirEmbolismQuestion, generateLungCancerQuestion,
    generateProstateCancerQuestion, generateBreastSurgeryQuestion, generateHIVTreatmentQuestion,
    generateAcetaminophenODQuestion, generateOpioidConstipationQuestion, generatePCAQuestion,
    generateAdrenalCortexQuestion, generateAddisonChronicQuestion, generateThyroidNodeQuestion,
    generateGoutAcuteQuestion, generateOsteomyelitisQuestion, generateRespAcidosisCompQuestion,
    generateSeizurePrecautionsQuestion, generateSpinalShockQuestion, generateAutonomicDysreflexiaQuestion,
    generateBurnFluidQuestion, generateRabiesQuestion, generateLeadPoisonAdultQuestion,
    generateMagnesiumToxicityQuestion, generateUmbilicalCordCareQuestion, generateInfantSafetyQuestion,
    generateAdolescentDepressionQuestion, generateAntidepressantQuestion, generateNutritionLabsQuestion,
    generateCAUTIPreventionQuestion,
    // ===== 이미지 문제 2차: 10개 추가 (총 20개 이미지) =====
    generatePainScaleQuestion, generateInsulinSyringeQuestion, generateWoundTypesQuestion,
    generateBurnDepthQuestion, generateGCSImgQuestion, generateLungLobesQuestion,
    generateCrutchGaitImgQuestion, generateBodyPositionQuestion, generateDTRGradingQuestion,
    generateIVDripCalcQuestion,
    // ===== 배치 6: 텍스트 20문제 =====
    generatePediatricVSQuestion, generateAFibTreatmentQuestion, generateChemoExtravasationQuestion,
    generateMassiveTransfusionQuestion, generateNeutropenicQuestion, generateTPNQuestion,
    generateRedmanQuestion, generateOpioidWithdrawalQuestion, generateNicotineCessationQuestion,
    generateSnakebiteQuestion, generateHeatStrokeQuestion, generateHypothermiaQuestion,
    generateDrowningQuestion, generatePoisoningQuestion, generateLatexAllergyQuestion,
    generateImmunizationContraQuestion, generateBladderTrainingQuestion, generateLumbarPunctureQuestion,
    generateNarcoticReversalQuestion, generateColonoscopyPrepQuestion,
    // ===== 배치 7: 심혈관/호흡 10문제 =====
    generateNYHAQuestion, generatePericarditisQuestion, generateDigoxinToxQuestion,
    generateFurosemideKQuestion, generateCardiacCathQuestion, generateAsthmaSeverityQuestion,
    generateCOPDGOLDQuestion, generateCAPOrganismQuestion, generateTBPrecautionsQuestion,
    generateTrachSuctionQuestion,
    // ===== 배치 8: 신장/내분비/소화 10문제 =====
    generateCBIQuestion, generateHDAccessQuestion, generatePDQuestion,
    generateInsulinPumpQuestion, generateSlidingScaleQuestion, generateHashimotoQuestion,
    generateUlcerativeColitisQuestion, generateCrohnsQuestion, generateCirrhosisDietQuestion,
    generateHepatitisCompareQuestion,
    // ===== 배치 9: 신경/소아 10문제 =====
    generateALSQuestion, generateMigraineCompareQuestion, generateSAHQuestion,
    generateMyastheniaCrisisQuestion, generateCranialNerveQuestion, generatePedBLSQuestion,
    generateEpiglottitisQuestion, generateFifthDiseaseQuestion, generateFTTQuestion,
    generateLactoseIntoleranceQuestion,
    // ===== 배치 10: 모성/정신 10문제 =====
    generatePROMQuestion, generateGBSProphylaxisQuestion, generatePostpartumDVTQuestion,
    generateOxytocinQuestion, generateGestationalAgeQuestion, generateLithiumTeachingQuestion,
    generateSSRIDiscontQuestion, generateTardiveDyskinesiaQuestion, generateAntipsychoticChoiceQuestion,
    generateBenzoTaperQuestion,
    // ===== 배치 11: 약리/기본간호 10문제 =====
    generateHeparinAntidoteQuestion, generateWarfarinQuestion, generateBetaBlockerOverdoseQuestion,
    generateCCBOverdoseQuestion, generateLevothyroxineQuestion, generateNGInsertionQuestion,
    generateSterileGloveQuestion, generateSpongeBathQuestion, generateNasalCannulaO2Question,
    generateBMIQuestion,
    // ===== 배치 12: 심혈관 고급 10문제 =====
    generateMitralStenosisQuestion, generateAorticStenosisMurmurQuestion, generateEndocarditisProphyQuestion,
    generatePADQuestion, generateRaynaudQuestion, generateCardiogenicShockQuestion,
    generateUnstableAnginaQuestion, generateRheumaticFeverQuestion, generateBetaBlockerContraQuestion,
    generateCardiacRehabQuestion,
    // ===== 배치 13: 호흡·감염 10문제 =====
    generateWellsScoreQuestion, generateSleepApneaQuestion, generateSpirometryQuestion,
    generateCOPoisoningQuestion, generateInfluenzaVaccineQuestion, generateMRSAIsolationQuestion,
    generateCDiffQuestion, generateMERSCOVQuestion, generateBordertelosisQuestion,
    generateNeedleSafetyQuestion,
    // ===== 배치 14: 다중 시나리오 (각 4-6 변이) 10문제 =====
    generateAgeVitalSignsQuestion, generateImmunizationByAgeQuestion, generatePostopComplicationQuestion,
    generateLabAbnormalQuestion, generatePregnancyTrimesterQuestion, generateChemoSideEffectVarsQuestion,
    generatePsychDelusionTypesQuestion, generateNutritionalDeficiencyQuestion, generateBLSPriorityQuestion,
    generateAntibioticClassQuestion,
    // ===== 배치 15: 다중 시나리오 10문제 =====
    generateBabyDevelopmentQuestion, generateGriefStagesVarsQuestion, generateThyroidLabQuestion,
    generateMurmurLocationQuestion, generateBurnAreaCalcQuestion, generateInsulinTimingQuestion,
    generateOxygenDeviceFlowQuestion, generatePainTeachingTypeQuestion, generateContraceptionQuestion,
    generateInfectionPrecautionVarsQuestion,
    // ===== 이미지 문제 3차: 10개 추가 (총 30개 이미지) =====
    generateAuscultationAreasQuestion, generateIMSitesQuestion, generatePostureQuestion,
    generatePupilExamQuestion, generateAEDPadsQuestion, generateFontanelleQuestion,
    generateOstomyTypesQuestion, generateWoundColorQuestion, generateRespDistressPostureQuestion,
    generatePulsePointsQuestion
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

// ========= 신규 임상 문제 (40개) =========
function generatePneumoniaQuestion() { return { baseId: "pneumonia", categoryKey: "adult", part: loc("호흡기","Respiratory"), emoji: "🫁", title: loc("폐렴 환자 간호","Pneumonia Care"), desc: loc(`발열·기침·녹색 객담을 보이는 폐렴 환자에게 가장 우선되는 간호중재는?`,`Patient with fever, cough, and green sputum (pneumonia). Top priority?`), choices: shuffle([{ text: loc("기도 개방 + 산소·수분 공급, 객담 배출 격려","Maintain airway, oxygen, hydration, encourage sputum clearance"), effect: { hp: -3, rep: 22 }, log: loc("정답. 호흡기능 회복과 분비물 배출이 핵심.","Correct. Restoring oxygenation and clearing secretions are key.") }, { text: loc("객담 억제제로 기침을 완전 차단","Suppress cough completely with antitussives"), effect: { hp: -30, rep: -22 }, log: loc("객담 정체로 악화됩니다.","Worsens secretion retention.") }, { text: loc("절대 안정으로 평와위만 유지","Strict bed rest in supine flat position only"), effect: { hp: -25, rep: -16 }, log: loc("반좌위·체위 변경이 필요합니다.","Semi-Fowler's and repositioning needed.") }, { text: loc("객담을 줄이려 수분을 제한","Restrict fluids to reduce sputum"), effect: { hp: -28, rep: -20 }, log: loc("탈수가 분비물 점도를 높여 더 위험.","Dehydration thickens secretions — more dangerous.") }]) }; }
function generateTBINHQuestion() { return { baseId: "tbInh", categoryKey: "adult", part: loc("결핵 약물","TB Pharmacology"), emoji: "💊", title: loc("INH 부작용","Isoniazid Side Effect"), desc: loc(`결핵 치료 중 Isoniazid(INH) 복용 환자에게 예방 목적으로 함께 투여하는 비타민은?`,`Which vitamin is co-administered with isoniazid (INH) to prevent neuropathy?`), choices: shuffle([{ text: loc("Pyridoxine (비타민 B6)","Pyridoxine (Vitamin B6)"), effect: { hp: -2, rep: 22 }, log: loc("정답. INH는 말초신경병증 위험이 있어 B6 보충.","Correct. INH causes peripheral neuropathy — B6 supplementation prevents it.") }, { text: loc("비타민 C","Vitamin C"), effect: { hp: -25, rep: -15 }, log: loc("관련 없습니다.","Not related.") }, { text: loc("비타민 D","Vitamin D"), effect: { hp: -25, rep: -15 }, log: loc("관련 없습니다.","Not related.") }, { text: loc("엽산","Folic acid"), effect: { hp: -25, rep: -15 }, log: loc("관련 없습니다.","Not related.") }]) }; }
function generateHIVTransmissionQuestion() { return { baseId: "hivTrans", categoryKey: "adult", part: loc("감염","Infection"), emoji: "🦠", title: loc("HIV 전파 경로","HIV Transmission"), desc: loc(`HIV 환자와 같이 일하는 동료가 다음 중 가장 위험한 노출은?`,`Which exposure carries the highest HIV transmission risk for a healthcare worker?`), choices: shuffle([{ text: loc("바늘에 깊이 찔린 사고(혈액 노출)","Deep needlestick with visible blood"), effect: { hp: -3, rep: 22 }, log: loc("정답. 점막·피부 노출보다 경피 노출 위험이 가장 높습니다.","Correct. Percutaneous exposure carries the highest risk.") }, { text: loc("같이 식사하기","Sharing a meal"), effect: { hp: -25, rep: -15 }, log: loc("HIV는 음식·물로 전파되지 않습니다.","HIV is not spread via food or water.") }, { text: loc("악수","Handshake"), effect: { hp: -25, rep: -15 }, log: loc("HIV는 일상 접촉으로 전파되지 않습니다.","Not transmitted by casual contact.") }, { text: loc("같은 화장실 사용","Shared toilet"), effect: { hp: -25, rep: -15 }, log: loc("일상 접촉으로 전파되지 않습니다.","Not transmitted by shared facilities.") }]) }; }
function generateGERDQuestion() { return { baseId: "gerd", categoryKey: "adult", part: loc("소화기","GI"), emoji: "🔥", title: loc("GERD 교육","GERD Teaching"), desc: loc(`위식도역류 환자에게 옳은 생활 교육은?`,`Correct lifestyle teaching for GERD patient?`), choices: shuffle([{ text: loc("취침 3시간 전 금식, 머리를 15cm 올려 잔다","No food 3 hours before bed; elevate head of bed 15 cm"), effect: { hp: -2, rep: 20 }, log: loc("정답. 야간 역류 방지의 핵심.","Correct. Prevents nocturnal reflux.") }, { text: loc("취침 직전 우유를 마신다","Drink milk right before bed"), effect: { hp: -28, rep: -18 }, log: loc("산 분비를 자극해 악화.","Stimulates acid secretion.") }, { text: loc("식후 즉시 운동","Exercise right after eating"), effect: { hp: -25, rep: -15 }, log: loc("위 압력을 올려 역류 유발.","Raises gastric pressure → reflux.") }, { text: loc("매운 음식·커피·초콜릿을 충분히","Plenty of spicy food, coffee, chocolate"), effect: { hp: -28, rep: -18 }, log: loc("LES 압력을 떨어뜨려 악화.","Lowers LES tone — worsens.") }]) }; }
function generateDiverticulitisQuestion() { return { baseId: "diverticulitis", categoryKey: "adult", part: loc("소화기","GI"), emoji: "🥬", title: loc("게실염 식이","Diverticulitis Diet"), desc: loc(`급성 게실염 환자에게 맞는 식이는?`,`Appropriate diet during acute diverticulitis?`), choices: shuffle([{ text: loc("급성기엔 저섬유·NPO 후 진행, 회복 후엔 고섬유","NPO/low-fiber acutely, then high-fiber once resolved"), effect: { hp: -2, rep: 22 }, log: loc("정답. 급성기엔 장 휴식, 회복 후엔 재발 예방을 위해 고섬유.","Correct. Bowel rest acutely; high fiber for prevention.") }, { text: loc("급성기에도 견과·씨앗·옥수수 적극 섭취","Push nuts, seeds, corn even in acute phase"), effect: { hp: -28, rep: -18 }, log: loc("악화 위험이 큽니다.","Worsens the inflammation.") }, { text: loc("평생 무자극·무섬유 식이만","Lifelong low/no fiber diet"), effect: { hp: -25, rep: -15 }, log: loc("재발률이 오히려 높아집니다.","Increases recurrence.") }, { text: loc("우유와 고지방 권장","Push milk and high-fat"), effect: { hp: -25, rep: -15 }, log: loc("권장되지 않습니다.","Not recommended.") }]) }; }
function generateGoutQuestion() { return { baseId: "gout", categoryKey: "adult", part: loc("근골격","Musculoskeletal"), emoji: "🦶", title: loc("통풍 급성기","Acute Gout Attack"), desc: loc(`엄지발가락 관절이 빨갛고 부으며 극심한 통증을 호소하는 통풍 급성기 환자 식이 교육은?`,`Acute gout flare patient teaching for diet?`), choices: shuffle([{ text: loc("내장육·맥주·등푸른생선(고퓨린) 제한, 수분 충분히","Limit organ meats, beer, oily fish (high purine); plenty of water"), effect: { hp: -2, rep: 22 }, log: loc("정답. 요산 생성·축적 감소가 핵심.","Correct. Reduces uric acid production/buildup.") }, { text: loc("우유와 치즈 제한","Restrict milk and cheese"), effect: { hp: -25, rep: -15 }, log: loc("저지방 유제품은 오히려 권장.","Low-fat dairy is actually encouraged.") }, { text: loc("수분을 줄여 요산 농도를 진하게","Reduce fluids to concentrate uric acid"), effect: { hp: -32, rep: -22 }, log: loc("결정 형성을 촉진해 악화.","Promotes crystal formation — worsens.") }, { text: loc("커피 절대 금지","Never drink coffee"), effect: { hp: -25, rep: -15 }, log: loc("커피는 통풍 위험을 낮춥니다.","Coffee actually lowers gout risk.") }]) }; }
function generateRAOAQuestion() { return { baseId: "raoa", categoryKey: "adult", part: loc("관절염","Arthritis"), emoji: "🦴", title: loc("RA vs OA 감별","RA vs OA"), desc: loc(`아침 1시간 이상 지속되는 강직과 대칭성 관절 부종을 보이는 환자의 가장 가능성 높은 진단은?`,`Patient with morning stiffness >1 hour and symmetric joint swelling. Most likely?`), choices: shuffle([{ text: loc("류마티스 관절염(RA)","Rheumatoid arthritis (RA)"), effect: { hp: -2, rep: 22 }, log: loc("정답. 자가면역, 대칭성, 아침 강직이 핵심 특징.","Correct. Autoimmune, symmetric, morning stiffness — classic RA.") }, { text: loc("골관절염(OA)","Osteoarthritis (OA)"), effect: { hp: -25, rep: -15 }, log: loc("OA는 비대칭, 활동 후 통증, 강직 30분 이내.","OA is asymmetric, post-activity pain, stiffness <30 min.") }, { text: loc("통풍","Gout"), effect: { hp: -25, rep: -15 }, log: loc("통풍은 단관절 급성기성 통증.","Gout is monoarticular acute pain.") }, { text: loc("섬유근육통","Fibromyalgia"), effect: { hp: -25, rep: -15 }, log: loc("관절 부종이 없습니다.","No joint swelling.") }]) }; }
function generateOsteoporosisQuestion() { return { baseId: "osteoporosis", categoryKey: "adult", part: loc("근골격","Musculoskeletal"), emoji: "🦴", title: loc("골다공증 예방","Osteoporosis Prevention"), desc: loc(`폐경 후 여성의 골다공증 예방을 위한 가장 적절한 교육은?`,`Best teaching for osteoporosis prevention in a postmenopausal woman?`), choices: shuffle([{ text: loc("칼슘+비타민D 섭취 + 규칙적인 체중부하 운동(걷기)","Calcium + vitamin D intake plus regular weight-bearing exercise (walking)"), effect: { hp: -2, rep: 22 }, log: loc("정답. 골밀도 유지의 표준 권고.","Correct. Standard recommendation for bone density.") }, { text: loc("수영만 하면 충분하다","Swimming alone is enough"), effect: { hp: -25, rep: -15 }, log: loc("수영은 비체중부하라 골밀도 증가에 약합니다.","Swimming is non-weight-bearing — weak for bone density.") }, { text: loc("절대 안정으로 골절 예방","Strict bed rest to prevent fractures"), effect: { hp: -32, rep: -22 }, log: loc("부동은 골소실을 가속화.","Immobility accelerates bone loss.") }, { text: loc("탄산음료를 충분히 섭취","Plenty of carbonated beverages"), effect: { hp: -28, rep: -18 }, log: loc("인 함량이 높아 칼슘 흡수를 방해.","High phosphorus inhibits Ca absorption.") }]) }; }
function generateDM12Question() { return { baseId: "dm12", categoryKey: "adult", part: loc("내분비","Endocrine"), emoji: "🩸", title: loc("Type 1 vs Type 2 DM","Type 1 vs Type 2 DM"), desc: loc(`청소년기 갑작스러운 다음·다뇨·체중감소·DKA로 진단된 당뇨병의 유형은?`,`Adolescent with sudden polyuria, polydipsia, weight loss, and DKA. Type?`), choices: shuffle([{ text: loc("1형 당뇨 - 인슐린 절대 결핍","Type 1 — absolute insulin deficiency"), effect: { hp: -2, rep: 22 }, log: loc("정답. 자가면역성 베타세포 파괴.","Correct. Autoimmune beta-cell destruction.") }, { text: loc("2형 당뇨 - 인슐린 저항","Type 2 — insulin resistance"), effect: { hp: -25, rep: -15 }, log: loc("2형은 보통 성인기 점진적 발병.","Type 2 is typically gradual adult-onset.") }, { text: loc("임신성 당뇨","Gestational"), effect: { hp: -25, rep: -15 }, log: loc("청소년 비임부에 해당 없음.","Not applicable to non-pregnant adolescent.") }, { text: loc("MODY","MODY"), effect: { hp: -22, rep: -10 }, log: loc("드문 단일유전자 형태로 DKA가 흔하지 않음.","Rare monogenic form, DKA uncommon.") }]) }; }
function generateSIADHQuestion() { return { baseId: "siadh", categoryKey: "adult", part: loc("내분비","Endocrine"), emoji: "💧", title: loc("SIADH 간호","SIADH Care"), desc: loc(`SIADH 환자에게 가장 적절한 간호중재는?`,`Best intervention for a patient with SIADH?`), choices: shuffle([{ text: loc("수분 제한 + 혈청 나트륨·신경학적 상태 모니터링","Fluid restriction + monitor serum sodium and neuro status"), effect: { hp: -2, rep: 22 }, log: loc("정답. ADH 과다로 저나트륨혈증·뇌부종 위험.","Correct. ADH excess → hyponatremia/cerebral edema risk.") }, { text: loc("수분을 적극 공급","Push fluids aggressively"), effect: { hp: -40, rep: -28 }, log: loc("저나트륨혈증을 악화시킵니다.","Worsens hyponatremia.") }, { text: loc("이뇨제(루프성)만으로 해결","Loop diuretics alone"), effect: { hp: -25, rep: -15 }, log: loc("수분 제한이 1차이며 단독 약물은 부족.","Fluid restriction is first-line.") }, { text: loc("정상 식염수만으로 충분","Just give normal saline"), effect: { hp: -28, rep: -18 }, log: loc("저나트륨혈증을 빠르게 교정하면 osmotic demyelination 위험.","Rapid correction risks osmotic demyelination.") }]) }; }
function generateAddisonQuestion() { return { baseId: "addison", categoryKey: "adult", part: loc("내분비","Endocrine"), emoji: "🌑", title: loc("애디슨 위기","Addisonian Crisis"), desc: loc(`만성 부신부전 환자가 갑자기 심한 저혈압·구토·고칼륨혈증으로 응급실 도착. 1차 처치는?`,`Chronic adrenal insufficiency patient suddenly hypotensive, vomiting, hyperkalemic. First action?`), choices: shuffle([{ text: loc("Hydrocortisone IV + 정상 식염수 정맥주입","IV hydrocortisone + normal saline"), effect: { hp: -3, rep: 22 }, log: loc("정답. 코르티솔 보충과 수액·전해질 보정이 핵심.","Correct. Cortisol replacement + fluid/electrolyte correction.") }, { text: loc("스테로이드 투여 보류","Withhold steroids"), effect: { hp: -45, rep: -32 }, log: loc("절대 금기. 사망 위험.","Absolutely contraindicated — life-threatening.") }, { text: loc("이뇨제로 칼륨 배출","Diuretics to excrete potassium"), effect: { hp: -28, rep: -20 }, log: loc("저혈압을 악화시킵니다.","Worsens hypotension.") }, { text: loc("절대 안정만 유지","Just strict bed rest"), effect: { hp: -28, rep: -22 }, log: loc("능동적 처치가 필요합니다.","Active intervention required.") }]) }; }
function generateTensionPneumoQuestion() { return { baseId: "tensionPneumo", categoryKey: "adult", part: loc("호흡기 응급","Respiratory Emergency"), emoji: "🫁", title: loc("긴장성 기흉","Tension Pneumothorax"), desc: loc(`외상 후 호흡곤란·기관 편위·환측 호흡음 소실·저혈압. 의심 진단·즉시 처치는?`,`After trauma: dyspnea, tracheal deviation, absent breath sounds on one side, hypotension. Suspect and immediate action?`), choices: shuffle([{ text: loc("긴장성 기흉 - 환측 2번째 늑간 침바늘 감압","Tension pneumothorax — needle decompression at 2nd intercostal space"), effect: { hp: -3, rep: 22 }, log: loc("정답. 흉관 삽입 전 긴급 감압이 생명 구함.","Correct. Emergency decompression before chest tube saves lives.") }, { text: loc("심부전으로 의심해 이뇨제 투여","Suspect heart failure and give diuretics"), effect: { hp: -45, rep: -32 }, log: loc("진단·처치 모두 부적절.","Wrong diagnosis and treatment.") }, { text: loc("폐색전증으로 의심해 헤파린","Suspect PE and start heparin"), effect: { hp: -40, rep: -30 }, log: loc("긴장성 기흉의 임상양상이 더 적합.","Tension pneumothorax fits better.") }, { text: loc("관찰만 하며 X-ray 결과 대기","Just wait for X-ray result"), effect: { hp: -50, rep: -40 }, log: loc("응급 - 영상 검사 전 처치가 필요.","Emergency — treat before imaging.") }]) }; }
function generateStatusEpilepticusQuestion() { return { baseId: "statusEpil", categoryKey: "adult", part: loc("신경 응급","Neuro Emergency"), emoji: "⚡", title: loc("간질 지속상태","Status Epilepticus"), desc: loc(`5분 이상 지속되는 발작 환자에게 1차로 투여하는 약물은?`,`First-line drug for seizure lasting >5 minutes?`), choices: shuffle([{ text: loc("Lorazepam 또는 Diazepam IV","IV Lorazepam or Diazepam"), effect: { hp: -3, rep: 22 }, log: loc("정답. 벤조디아제핀이 1차 약물.","Correct. Benzodiazepines are first-line.") }, { text: loc("Phenytoin 단독 1차","Phenytoin alone first"), effect: { hp: -25, rep: -15 }, log: loc("벤조디아제핀 후 2차로 사용.","Used as second-line after benzo.") }, { text: loc("관찰만 하며 자연 종료 대기","Just observe and wait"), effect: { hp: -45, rep: -32 }, log: loc("뇌손상·사망 위험.","Risk of brain damage/death.") }, { text: loc("환자를 묶어 움직임 차단","Restrain to stop movements"), effect: { hp: -38, rep: -28 }, log: loc("골절·근손상 유발.","Causes fractures/injury.") }]) }; }
function generateHeadInjuryQuestion() { return { baseId: "headInjury", categoryKey: "adult", part: loc("외상","Trauma"), emoji: "🤕", title: loc("두부외상 모니터링","Head Injury Monitoring"), desc: loc(`두부외상 환자에서 두개내압 상승을 시사하는 가장 초기 징후는?`,`Earliest sign of increased ICP in head injury?`), choices: shuffle([{ text: loc("의식 수준 변화(LOC 저하)","Change in level of consciousness (LOC decline)"), effect: { hp: -2, rep: 22 }, log: loc("정답. LOC가 가장 민감한 초기 지표.","Correct. LOC is the most sensitive early indicator.") }, { text: loc("쿠싱 반응(고혈압·서맥)","Cushing's triad (HTN/bradycardia)"), effect: { hp: -20, rep: -10 }, log: loc("후기 징후로 임박한 뇌탈출.","Late sign — impending herniation.") }, { text: loc("동공 부동","Pupillary asymmetry"), effect: { hp: -22, rep: -12 }, log: loc("후기 징후입니다.","Late sign.") }, { text: loc("심한 두통만","Severe headache alone"), effect: { hp: -22, rep: -12 }, log: loc("비특이적입니다.","Non-specific.") }]) }; }
function generateUTIQuestion() { return { baseId: "uti", categoryKey: "adult", part: loc("비뇨기","Urology"), emoji: "💧", title: loc("UTI 예방 교육","UTI Prevention"), desc: loc(`반복적 요로감염을 호소하는 여성 환자에 옳은 교육은?`,`Correct teaching for a woman with recurrent UTIs?`), choices: shuffle([{ text: loc("앞에서 뒤로 닦기, 충분한 수분, 성관계 후 즉시 배뇨","Wipe front-to-back, ample fluids, void after intercourse"), effect: { hp: -2, rep: 22 }, log: loc("정답. 표준 UTI 예방 교육.","Correct. Standard UTI prevention bundle.") }, { text: loc("물을 적게 마셔 소변을 진하게","Drink little water to concentrate urine"), effect: { hp: -32, rep: -22 }, log: loc("UTI 위험을 크게 높입니다.","Greatly increases UTI risk.") }, { text: loc("강한 향이 있는 비누·여성청결제 사용","Use strongly scented soaps/feminine hygiene"), effect: { hp: -25, rep: -15 }, log: loc("정상 균총을 파괴.","Disrupts normal flora.") }, { text: loc("배뇨 욕구를 참고 한 번에 보기","Hold urine and void only when full"), effect: { hp: -25, rep: -15 }, log: loc("정체된 소변이 세균 증식의 환경.","Stagnant urine breeds bacteria.") }]) }; }
function generateLeopoldQuestion() { return { baseId: "leopold", categoryKey: "maternal", part: loc("산전사정","Antepartum"), emoji: "🤰", title: loc("Leopold 수기","Leopold's Maneuvers"), desc: loc(`Leopold 수기의 첫 번째 단계는?`,`What is the first step of Leopold's maneuvers?`), choices: shuffle([{ text: loc("자궁저부를 양손으로 만져 무엇이 있는지 확인","Palpate the fundus to identify which pole is there"), effect: { hp: -2, rep: 20 }, log: loc("정답. 1단계는 fundal grip.","Correct. Step 1 is the fundal grip.") }, { text: loc("처음부터 골반쪽 선진부 확인","Start by checking the presenting part at the pelvis"), effect: { hp: -22, rep: -12 }, log: loc("이는 4단계입니다.","That is step 4.") }, { text: loc("내진으로 자궁경부 개대를 확인","Vaginal exam for cervical dilation"), effect: { hp: -28, rep: -18 }, log: loc("Leopold 수기는 복부 촉진입니다.","Leopold is abdominal palpation only.") }, { text: loc("초음파부터 시행","Do ultrasound first"), effect: { hp: -25, rep: -15 }, log: loc("Leopold는 손으로 하는 사정.","Leopold is hands-on assessment.") }]) }; }
function generatePretermLaborQuestion() { return { baseId: "pretermLabor", categoryKey: "maternal", part: loc("조기진통","Preterm Labor"), emoji: "🤰", title: loc("조기진통 약물","Preterm Labor Drugs"), desc: loc(`임신 32주 산모가 규칙적 자궁수축을 호소한다. 자궁수축 억제와 함께 태아 폐성숙을 위해 함께 투여하는 약물은?`,`32-week pregnant woman with regular contractions. What is given alongside tocolytics to mature fetal lungs?`), choices: shuffle([{ text: loc("Betamethasone (코르티코스테로이드)","Betamethasone (corticosteroid)"), effect: { hp: -2, rep: 22 }, log: loc("정답. 24-34주에 폐성숙·호흡곤란증후군 예방.","Correct. 24-34 wks for lung maturation/RDS prevention.") }, { text: loc("Oxytocin","Oxytocin"), effect: { hp: -32, rep: -22 }, log: loc("자궁수축을 촉진해 절대 금기.","Stimulates contractions — contraindicated.") }, { text: loc("Aspirin","Aspirin"), effect: { hp: -25, rep: -15 }, log: loc("적응증이 다릅니다.","Wrong indication.") }, { text: loc("Insulin","Insulin"), effect: { hp: -25, rep: -15 }, log: loc("적응증이 다릅니다.","Wrong indication.") }]) }; }
function generateMastitisQuestion() { return { baseId: "mastitis", categoryKey: "maternal", part: loc("산후합병증","Postpartum Complication"), emoji: "🍼", title: loc("유선염 vs 유방울혈","Mastitis vs Engorgement"), desc: loc(`수유 중 한쪽 유방의 발적·경결·발열·전신 통증이 있는 산모의 진단·중재는?`,`Lactating mother with red, indurated, warm breast plus systemic chills. Diagnosis and intervention?`), choices: shuffle([{ text: loc("유선염 - 수유 지속 + 항생제, 온찜질·완전 비우기","Mastitis — continue breastfeeding, antibiotics, warm compress, fully empty"), effect: { hp: -3, rep: 22 }, log: loc("정답. 수유 중단이 오히려 악화.","Correct. Stopping breastfeeding actually worsens it.") }, { text: loc("수유 즉시 중단","Stop breastfeeding immediately"), effect: { hp: -28, rep: -20 }, log: loc("울체로 더 악화됩니다.","Worsens stasis.") }, { text: loc("냉찜질만 적용","Cold packs only"), effect: { hp: -22, rep: -12 }, log: loc("배출이 막혀 악화.","Inhibits drainage.") }, { text: loc("환자 관찰만, 항생제 불요","Just observe; no antibiotics"), effect: { hp: -28, rep: -20 }, log: loc("세균성 유선염은 항생제 필요.","Bacterial mastitis needs antibiotics.") }]) }; }
function generateCSectionQuestion() { return { baseId: "csection", categoryKey: "maternal", part: loc("제왕절개","C-Section"), emoji: "🤰", title: loc("제왕절개 후 간호","Post C-Section Care"), desc: loc(`제왕절개 후 24시간 산모에게 가장 우선되는 간호중재 3가지는?`,`Top 3 priorities for a 24-hour post-C-section patient?`), choices: shuffle([{ text: loc("자궁저부·오로 사정 + 절개부 출혈 + 조기 보행","Fundus and lochia checks + incision bleeding + early ambulation"), effect: { hp: -3, rep: 22 }, log: loc("정답. 자연분만+수술 후 합병증 예방의 핵심.","Correct. Combined OB + surgical recovery essentials.") }, { text: loc("절대 안정으로 1주일 침상안정","Strict bed rest for 1 week"), effect: { hp: -32, rep: -22 }, log: loc("DVT·무기폐 위험 증가.","Increases DVT/atelectasis risk.") }, { text: loc("자궁저부 사정 생략","Skip fundus assessment"), effect: { hp: -32, rep: -22 }, log: loc("산후출혈을 놓칠 수 있음.","May miss postpartum hemorrhage.") }, { text: loc("절개부는 만지지 않고 무관찰","Don't touch or observe the incision"), effect: { hp: -28, rep: -20 }, log: loc("감염·열개 위험을 놓침.","Misses infection/dehiscence.") }]) }; }
function generatePrenatalDangerQuestion() { return { baseId: "prenatalDanger", categoryKey: "maternal", part: loc("산전 경고","Prenatal Warning"), emoji: "⚠️", title: loc("산전 경고 징후","Prenatal Danger Signs"), desc: loc(`임신 중 즉시 의료기관에 연락해야 할 위험 징후가 아닌 것은?`,`Which is NOT a prenatal danger sign requiring immediate medical contact?`), choices: shuffle([{ text: loc("가벼운 입덧과 식욕 변화","Mild nausea and appetite changes"), effect: { hp: -2, rep: 20 }, log: loc("정답(이게 정상). 이는 흔한 정상 임신 증상.","Correct (this IS normal). Common normal pregnancy symptom.") }, { text: loc("질출혈 또는 유양액 누출","Vaginal bleeding or fluid leak"), effect: { hp: -22, rep: -12 }, log: loc("응급 신호입니다.","Emergency sign.") }, { text: loc("심한 두통·시야 흐림·부종","Severe headache, blurred vision, edema"), effect: { hp: -22, rep: -12 }, log: loc("전자간증 의심 - 응급.","Suggests preeclampsia — emergency.") }, { text: loc("태동의 갑작스러운 감소","Sudden decrease in fetal movement"), effect: { hp: -22, rep: -12 }, log: loc("응급 평가 필요.","Needs urgent evaluation.") }]) }; }
function generatePedDehydrationQuestion() { return { baseId: "pedDehydration", categoryKey: "pediatric", part: loc("탈수","Dehydration"), emoji: "💧", title: loc("소아 탈수 사정","Pediatric Dehydration"), desc: loc(`설사로 입원한 영아의 중등도 탈수를 시사하는 소견은?`,`Which finding indicates moderate dehydration in an infant with diarrhea?`), choices: shuffle([{ text: loc("천문 함몰, 소변량 감소, 피부 탄력 감소","Sunken fontanelles, decreased urine output, decreased skin turgor"), effect: { hp: -3, rep: 22 }, log: loc("정답. 영아 중등도 탈수의 전형적 임상 소견.","Correct. Classic findings for moderate dehydration in infants.") }, { text: loc("정상 활동·정상 소변량","Normal activity and urine output"), effect: { hp: -28, rep: -20 }, log: loc("탈수 징후가 없습니다.","No dehydration signs.") }, { text: loc("발열과 발진","Fever and rash"), effect: { hp: -22, rep: -12 }, log: loc("탈수의 직접 지표가 아닙니다.","Not direct dehydration indicators.") }, { text: loc("기침과 콧물","Cough and runny nose"), effect: { hp: -22, rep: -12 }, log: loc("탈수와 무관.","Unrelated to dehydration.") }]) }; }
function generatePyloricQuestion() { return { baseId: "pyloric", categoryKey: "pediatric", part: loc("소아 외과","Pediatric Surgery"), emoji: "🍼", title: loc("유문협착","Pyloric Stenosis"), desc: loc(`생후 4주 영아가 수유 직후 분출성 비담즙성 구토를 보이며 우상복부 올리브 모양 종괴가 만져진다. 진단은?`,`4-week-old infant: projectile non-bilious vomiting after feeds; olive-shaped mass in RUQ. Diagnosis?`), choices: shuffle([{ text: loc("유문협착 - 수술적 유문절개술 필요","Pyloric stenosis — needs pyloromyotomy"), effect: { hp: -3, rep: 22 }, log: loc("정답. 분출성·비담즙성·올리브 종괴가 특징.","Correct. Projectile, non-bilious, olive-shaped mass are classic.") }, { text: loc("위식도역류 - 수유 자세만 조정","GERD — just adjust feeding position"), effect: { hp: -32, rep: -22 }, log: loc("외과적 응급을 놓칩니다.","Misses surgical emergency.") }, { text: loc("정상 영아 구토 - 관찰만","Normal infant spit-up — just observe"), effect: { hp: -32, rep: -22 }, log: loc("탈수·체중감소가 빠릅니다.","Rapid dehydration/weight loss.") }, { text: loc("장중첩증","Intussusception"), effect: { hp: -25, rep: -15 }, log: loc("장중첩증은 담즙성 구토·redcurrant jelly 변.","Intussusception has bilious vomiting/currant-jelly stool.") }]) }; }
function generateIntussusceptionQuestion() { return { baseId: "intussusception", categoryKey: "pediatric", part: loc("소아 외과","Pediatric Surgery"), emoji: "🍓", title: loc("장중첩증","Intussusception"), desc: loc(`6개월 영아가 갑자기 비명을 지르며 무릎을 가슴으로 굽히는 발작적 복통과 \"적색 젤리 같은 변\"을 본다. 진단은?`,`6-month-old: sudden screaming with knees-to-chest, intermittent colic, and "currant-jelly stool." Diagnosis?`), choices: shuffle([{ text: loc("장중첩증 - 응급 공기/조영 정복 또는 수술","Intussusception — urgent air/contrast reduction or surgery"), effect: { hp: -3, rep: 22 }, log: loc("정답. 적색 젤리변·복통·복부 종괴가 특징.","Correct. Currant-jelly stool, colic, sausage-shaped mass.") }, { text: loc("일반 위장염 - 경구수액","Simple gastroenteritis — oral rehydration"), effect: { hp: -32, rep: -22 }, log: loc("외과적 응급을 놓칩니다.","Misses surgical emergency.") }, { text: loc("탈수만 의심","Just suspect dehydration"), effect: { hp: -28, rep: -20 }, log: loc("주된 진단을 놓칩니다.","Misses primary diagnosis.") }, { text: loc("변비","Constipation"), effect: { hp: -28, rep: -20 }, log: loc("적색 젤리변과 맞지 않습니다.","Inconsistent with currant-jelly stool.") }]) }; }
function generatePedMeningitisQuestion() { return { baseId: "pedMeningitis", categoryKey: "pediatric", part: loc("소아 신경","Pediatric Neuro"), emoji: "🧠", title: loc("소아 수막염","Pediatric Meningitis"), desc: loc(`발열·두통·목경직을 보이는 아동에서 양성으로 나타날 수 있는 신체검진 징후는?`,`Child with fever, headache, neck stiffness. Which physical sign may be positive?`), choices: shuffle([{ text: loc("Brudzinski 또는 Kernig 징후","Brudzinski or Kernig sign"), effect: { hp: -2, rep: 22 }, log: loc("정답. 수막 자극의 고전적 지표.","Correct. Classic meningeal irritation signs.") }, { text: loc("Murphy 징후","Murphy's sign"), effect: { hp: -25, rep: -15 }, log: loc("담낭염 진단입니다.","That's for cholecystitis.") }, { text: loc("McBurney 압통","McBurney's tenderness"), effect: { hp: -25, rep: -15 }, log: loc("충수염입니다.","That's for appendicitis.") }, { text: loc("Homan 징후","Homan's sign"), effect: { hp: -25, rep: -15 }, log: loc("DVT(현재 권장하지 않음)입니다.","DVT (no longer recommended).") }]) }; }
function generateChildAbuseQuestion() { return { baseId: "childAbuse", categoryKey: "pediatric", part: loc("아동 학대","Child Abuse"), emoji: "🚨", title: loc("아동 학대 의심","Suspected Child Abuse"), desc: loc(`설명되지 않는 다발성 멍, 다양한 치유 단계, 보호자의 모순된 진술을 보이는 아동에 대한 간호사의 의무는?`,`Child with unexplained bruises in different healing stages and inconsistent caregiver story. Nurse's duty?`), choices: shuffle([{ text: loc("법정 의무 신고자로서 즉시 관할 기관에 신고","As a mandated reporter, immediately notify the appropriate authority"), effect: { hp: -3, rep: 22 }, log: loc("정답. 의료인은 의무 신고자입니다.","Correct. Healthcare workers are mandated reporters.") }, { text: loc("가족 동의 없이는 신고 불가","Cannot report without family consent"), effect: { hp: -45, rep: -34 }, log: loc("법적 의무 위반입니다.","Violates legal duty.") }, { text: loc("가족 사생활 보호로 비밀 유지","Maintain confidentiality for family privacy"), effect: { hp: -40, rep: -30 }, log: loc("아동 보호가 우선입니다.","Child protection takes priority.") }, { text: loc("증거가 더 모일 때까지 대기","Wait until more evidence accumulates"), effect: { hp: -40, rep: -30 }, log: loc("의심만으로도 신고 의무가 있습니다.","Reasonable suspicion is enough to report.") }]) }; }
function generateDefenseMechQuestion() { return { baseId: "defenseMech", categoryKey: "psych", part: loc("방어기제","Defense Mechanisms"), emoji: "🧠", title: loc("방어기제 식별","Identifying Defense Mechanism"), desc: loc(`알코올 중독 환자가 \"나는 술 안 마셔도 충분히 살 수 있어, 단지 즐길 뿐\"이라고 말한다. 이 방어기제는?`,`Alcoholic patient says "I can live without drinking, I just enjoy it." Which defense mechanism?`), choices: shuffle([{ text: loc("부정(Denial)","Denial"), effect: { hp: -2, rep: 22 }, log: loc("정답. 명백한 사실을 인정하지 않는 무의식적 방어.","Correct. Refusing to acknowledge an obvious reality.") }, { text: loc("승화(Sublimation)","Sublimation"), effect: { hp: -25, rep: -15 }, log: loc("부정적 충동을 사회적으로 수용 가능하게 표출.","Channeling unacceptable impulses into acceptable activities.") }, { text: loc("투사(Projection)","Projection"), effect: { hp: -25, rep: -15 }, log: loc("자신의 감정을 타인에게 전가.","Attributing own feelings to others.") }, { text: loc("합리화(Rationalization)","Rationalization"), effect: { hp: -22, rep: -10 }, log: loc("정당화는 가깝지만, 핵심은 사실 자체를 부정.","Close but the core here is denying the fact itself.") }]) }; }
function generateBorderlineQuestion() { return { baseId: "borderline", categoryKey: "psych", part: loc("성격장애","Personality Disorder"), emoji: "💢", title: loc("경계성 인격장애","Borderline PD"), desc: loc(`경계성 인격장애 환자에게 가장 적절한 간호 접근은?`,`Best approach for a patient with borderline personality disorder?`), choices: shuffle([{ text: loc("일관된 한계 설정과 명확한 의사소통 + 공감","Consistent limits, clear communication, and empathy"), effect: { hp: -3, rep: 22 }, log: loc("정답. 분리·이상화/평가절하에 대응.","Correct. Counters splitting and idealization/devaluation.") }, { text: loc("환자 요구를 모두 수용","Accept all patient demands"), effect: { hp: -28, rep: -18 }, log: loc("조작 행동을 강화합니다.","Reinforces manipulation.") }, { text: loc("냉정하고 거리감을 둔 태도","Cold and detached attitude"), effect: { hp: -25, rep: -15 }, log: loc("불안을 가중시킵니다.","Worsens anxiety.") }, { text: loc("간호사마다 다른 규칙 적용","Different rules for each nurse"), effect: { hp: -32, rep: -22 }, log: loc("분리 행동을 강화합니다.","Reinforces splitting.") }]) }; }
function generateAnxietyDisorderQuestion() { return { baseId: "anxietyDx", categoryKey: "psych", part: loc("불안장애","Anxiety"), emoji: "😰", title: loc("공황발작 응급","Panic Attack"), desc: loc(`공황발작 중인 환자에게 가장 적절한 1차 간호중재는?`,`Best initial intervention during a panic attack?`), choices: shuffle([{ text: loc("조용한 환경에서 짧고 단순한 지시·심호흡 함께","Quiet environment, short simple directions, breathe with them"), effect: { hp: -2, rep: 22 }, log: loc("정답. 자극 감소와 동행 호흡이 핵심.","Correct. Reduce stimuli and pace breathing together.") }, { text: loc("\"진정하라\"고 강하게 말한다","Loudly tell them \"Calm down\""), effect: { hp: -25, rep: -15 }, log: loc("불안을 가중.","Worsens anxiety.") }, { text: loc("혼자 두고 자리를 떠난다","Leave them alone"), effect: { hp: -28, rep: -20 }, log: loc("발작 중 안전이 위협.","Safety risk during attack.") }, { text: loc("논리로 공황의 원인을 설명","Explain panic causes logically"), effect: { hp: -22, rep: -12 }, log: loc("발작 중에는 비효과적.","Ineffective during the attack.") }]) }; }
function generateGriefStagesQuestion() { return { baseId: "griefStages", categoryKey: "psych", part: loc("애도","Grief"), emoji: "💔", title: loc("Kübler-Ross 애도 단계","Kübler-Ross Stages"), desc: loc(`말기 진단을 받은 환자가 \"왜 하필 나에게? 이건 불공평해\"라고 분노한다. 애도의 어느 단계인가?`,`Terminal patient angrily says, "Why me? This isn't fair." Which Kübler-Ross stage?`), choices: shuffle([{ text: loc("분노(Anger)","Anger"), effect: { hp: -2, rep: 22 }, log: loc("정답. 5단계: 부정-분노-타협-우울-수용.","Correct. 5 stages: denial-anger-bargaining-depression-acceptance.") }, { text: loc("부정(Denial)","Denial"), effect: { hp: -22, rep: -12 }, log: loc("부정은 \"이럴 리 없어\"입니다.","Denial is \"This can't be happening.\"") }, { text: loc("타협(Bargaining)","Bargaining"), effect: { hp: -22, rep: -12 }, log: loc("타협은 \"~한다면 시간을 더 주세요\"입니다.","Bargaining is \"If only I could ___.\"") }, { text: loc("수용(Acceptance)","Acceptance"), effect: { hp: -22, rep: -12 }, log: loc("수용은 평온한 단계.","Acceptance is the peaceful stage.") }]) }; }
function generateDisasterPhaseQuestion() { return { baseId: "disasterPhase", categoryKey: "community", part: loc("재난간호","Disaster Nursing"), emoji: "🌪️", title: loc("재난 4단계","Disaster Phases"), desc: loc(`재난 발생 후 임시 거주지 마련, 식수·식량 공급, 트라우마 케어를 제공하는 단계는?`,`Phase that includes shelters, food/water supply, trauma care after a disaster?`), choices: shuffle([{ text: loc("대응(Response) 단계","Response phase"), effect: { hp: -2, rep: 20 }, log: loc("정답. 재난 직후 즉각적 구호 활동.","Correct. Immediate relief operations after disaster.") }, { text: loc("예방(Mitigation) 단계","Mitigation phase"), effect: { hp: -22, rep: -12 }, log: loc("재난 발생 전에 위험을 줄이는 단계.","Pre-disaster risk reduction.") }, { text: loc("대비(Preparedness) 단계","Preparedness phase"), effect: { hp: -22, rep: -12 }, log: loc("계획·훈련·물자 준비 단계.","Planning, training, stockpiling.") }, { text: loc("복구(Recovery) 단계","Recovery phase"), effect: { hp: -22, rep: -12 }, log: loc("장기 재건 단계.","Long-term rebuilding.") }]) }; }
function generateSurveillanceQuestion() { return { baseId: "surveillance", categoryKey: "community", part: loc("감시체계","Surveillance"), emoji: "📡", title: loc("감염병 감시체계","Disease Surveillance"), desc: loc(`감염병 발생을 지속적으로 모니터링하는 활동의 가장 핵심 목적은?`,`Most essential purpose of ongoing infectious disease surveillance?`), choices: shuffle([{ text: loc("발생을 조기에 인지해 확산을 차단하기 위해","Early detection to prevent spread"), effect: { hp: -2, rep: 20 }, log: loc("정답. 조기 인지·대응이 감시의 핵심.","Correct. Early detection and response is the core.") }, { text: loc("개별 환자 치료 결정","Individual patient treatment decisions"), effect: { hp: -25, rep: -15 }, log: loc("감시는 인구집단 수준의 활동.","Surveillance is population-level.") }, { text: loc("의료비 청구 자료 확보","Collect billing data"), effect: { hp: -25, rep: -15 }, log: loc("주된 목적이 아닙니다.","Not the primary purpose.") }, { text: loc("의료진 평가","Evaluate healthcare workers"), effect: { hp: -25, rep: -15 }, log: loc("관련 없습니다.","Unrelated.") }]) }; }
function generatePHNPriorityQuestion() { return { baseId: "phnPriority", categoryKey: "community", part: loc("지역사회 우선순위","Community Priority"), emoji: "🏘️", title: loc("PHN 가족 우선순위","PHN Family Priority"), desc: loc(`다음 4가족 중 보건소 간호사가 가장 먼저 방문해야 할 가족은?`,`Which family should the public health nurse visit first?`), choices: shuffle([{ text: loc("결핵 활동성 가족원이 있는 영아 동거 가정","Family with active TB living with an infant"), effect: { hp: -2, rep: 22 }, log: loc("정답. 감염 위험·취약 인구가 함께 있어 최우선.","Correct. Combined infectious risk and vulnerable population.") }, { text: loc("일반 만성질환 관리 가정","General chronic disease management family"), effect: { hp: -22, rep: -12 }, log: loc("우선순위가 더 낮습니다.","Lower priority.") }, { text: loc("정기 산전관리 가정","Routine antenatal care"), effect: { hp: -22, rep: -12 }, log: loc("정기 일정으로 처리 가능.","Can be scheduled routinely.") }, { text: loc("건강 증진 교육이 필요한 가정","Health promotion education only"), effect: { hp: -22, rep: -12 }, log: loc("가장 후순위.","Lowest priority.") }]) }; }
function generateEBPQuestion() { return { baseId: "ebp", categoryKey: "management", part: loc("근거기반 실무","EBP"), emoji: "📚", title: loc("EBP 5단계","EBP 5 Steps"), desc: loc(`근거기반 실무(EBP)의 첫 번째 단계는?`,`First step of evidence-based practice?`), choices: shuffle([{ text: loc("임상 의문(PICO)을 명확히 형성","Formulate a clear clinical question (PICO)"), effect: { hp: -2, rep: 22 }, log: loc("정답. Ask-Acquire-Appraise-Apply-Assess의 첫 단계.","Correct. First of Ask-Acquire-Appraise-Apply-Assess.") }, { text: loc("문헌을 무작위로 수집","Randomly collect papers"), effect: { hp: -25, rep: -15 }, log: loc("질문이 없으면 검색이 비효율적.","Searches are inefficient without a question.") }, { text: loc("결과만 본다","Just look at outcomes"), effect: { hp: -25, rep: -15 }, log: loc("EBP는 체계적입니다.","EBP is systematic.") }, { text: loc("실무에 즉시 적용","Apply immediately"), effect: { hp: -28, rep: -18 }, log: loc("평가 없이 적용은 위험.","Applying without appraisal is risky.") }]) }; }
function generateTransformLeadQuestion() { return { baseId: "transformLead", categoryKey: "management", part: loc("리더십","Leadership"), emoji: "✨", title: loc("변혁적 리더십","Transformational Leadership"), desc: loc(`구성원에게 비전을 제시하고 자기실현을 동기화하는 리더십 유형은?`,`Leadership style that inspires vision and self-actualization?`), choices: shuffle([{ text: loc("변혁적 리더십(Transformational)","Transformational"), effect: { hp: -2, rep: 22 }, log: loc("정답. 비전·영감·개별 배려·지적 자극이 4요소.","Correct. Vision, inspiration, individualized consideration, intellectual stimulation.") }, { text: loc("거래적 리더십(Transactional)","Transactional"), effect: { hp: -22, rep: -12 }, log: loc("보상·처벌 기반.","Reward/punishment-based.") }, { text: loc("자유방임형(Laissez-faire)","Laissez-faire"), effect: { hp: -22, rep: -12 }, log: loc("최소 개입.","Minimal intervention.") }, { text: loc("권위형(Autocratic)","Autocratic"), effect: { hp: -22, rep: -12 }, log: loc("리더 일방 결정.","Leader-only decisions.") }]) }; }
function generateMagnetQuestion() { return { baseId: "magnet", categoryKey: "management", part: loc("마그넷 병원","Magnet"), emoji: "🧲", title: loc("마그넷 병원 인증","Magnet Recognition"), desc: loc(`마그넷 병원 인증을 받기 위한 핵심 요구사항이 아닌 것은?`,`Which is NOT a core Magnet recognition requirement?`), choices: shuffle([{ text: loc("매년 가장 낮은 인건비를 유지","Maintain the lowest possible labor costs each year"), effect: { hp: -2, rep: 20 }, log: loc("정답(이게 아님). 마그넷은 비용 절감이 아니라 간호 우수성.","Correct (NOT a requirement). Magnet is about excellence, not cost-cutting.") }, { text: loc("간호 우수성과 환자 결과 향상","Nursing excellence and improved patient outcomes"), effect: { hp: -22, rep: -12 }, log: loc("핵심 요구사항입니다.","Core requirement.") }, { text: loc("간호사 만족도와 자율성","Nurse satisfaction and autonomy"), effect: { hp: -22, rep: -12 }, log: loc("핵심 요소.","Core element.") }, { text: loc("연구·EBP 적용","Research and EBP application"), effect: { hp: -22, rep: -12 }, log: loc("핵심 요구사항.","Core requirement.") }]) }; }
function generateDNRQuestion() { return { baseId: "dnr", categoryKey: "law", part: loc("사전 의향서","Advance Directive"), emoji: "📜", title: loc("DNR 의향서","DNR Order"), desc: loc(`DNR(연명의료중단) 처방이 있는 환자가 호흡곤란을 호소하면 간호사는?`,`A patient with a DNR order develops dyspnea. The nurse should?`), choices: shuffle([{ text: loc("편안하게 호흡하도록 산소·체위·진정 등 안위 중재 제공","Provide comfort: oxygen, positioning, sedation as appropriate"), effect: { hp: -3, rep: 22 }, log: loc("정답. DNR은 \"죽게 두라\"가 아니라 \"심폐소생술만 안 함\".","Correct. DNR doesn't mean \"do nothing\" — comfort care continues.") }, { text: loc("DNR이므로 어떤 처치도 하지 않는다","DNR — do nothing at all"), effect: { hp: -42, rep: -30 }, log: loc("심각한 오해. 안위 처치는 계속.","Serious misunderstanding — comfort care continues.") }, { text: loc("DNR을 무시하고 즉시 CPR","Ignore the DNR and start CPR"), effect: { hp: -45, rep: -32 }, log: loc("환자 자율성 위반.","Violates patient autonomy.") }, { text: loc("의사 호출하지 말고 그대로 둔다","Don't call the doctor; just leave it"), effect: { hp: -32, rep: -22 }, log: loc("증상 평가·완화 의무가 있습니다.","Symptom assessment/relief duty remains.") }]) }; }
function generateChildAbuseLawQuestion() { return { baseId: "childAbuseLaw", categoryKey: "law", part: loc("아동학대법","Child Abuse Law"), emoji: "📜", title: loc("아동학대 의무신고","Mandated Reporting"), desc: loc(`간호사가 아동학대를 의심할 때 가장 적절한 행동은?`,`Best action when a nurse suspects child abuse?`), choices: shuffle([{ text: loc("의심만으로도 즉시 관할 기관(아동보호전문기관·112)에 신고","Suspicion alone — immediately report to authorities (Child Protection Agency, 112)"), effect: { hp: -2, rep: 22 }, log: loc("정답. 한국 아동복지법상 의료인은 의무신고자.","Correct. Healthcare workers are mandated reporters under Korean law.") }, { text: loc("증거가 확실해질 때까지 대기","Wait until proof is solid"), effect: { hp: -42, rep: -30 }, log: loc("의무 위반. 의심으로 충분.","Violates duty — suspicion is enough.") }, { text: loc("부모 동의 후에만 신고","Only report after parental consent"), effect: { hp: -42, rep: -30 }, log: loc("부모가 가해자일 수 있음.","Parents may be the perpetrators.") }, { text: loc("신고하면 피해아동에게 더 위험","Reporting puts the child at more risk"), effect: { hp: -38, rep: -28 }, log: loc("미신고가 더 위험.","Failing to report is more dangerous.") }]) }; }
function generateElderAbuseQuestion() { return { baseId: "elderAbuse", categoryKey: "law", part: loc("노인학대","Elder Abuse"), emoji: "🧓", title: loc("노인학대 신고","Elder Abuse Reporting"), desc: loc(`치매 노인의 다발성 멍·체중감소·탈수가 보호자의 \"넘어졌어요\" 진술과 모순될 때 간호사의 의무는?`,`Demented elder with bruises, weight loss, dehydration; caregiver says "they fell." Nurse's duty?`), choices: shuffle([{ text: loc("노인학대 의심으로 노인보호전문기관·1577-1389 신고","Report to elder protection agency / 1577-1389 hotline"), effect: { hp: -2, rep: 22 }, log: loc("정답. 노인복지법상 의료인은 의무신고자.","Correct. Mandated reporter under elder welfare law.") }, { text: loc("가족 사생활 보호로 비밀유지","Keep confidential to protect family privacy"), effect: { hp: -42, rep: -30 }, log: loc("학대 방치는 의무 위반.","Inaction violates duty.") }, { text: loc("환자에게만 직접 물어보고 끝","Only ask the patient directly"), effect: { hp: -32, rep: -22 }, log: loc("치매로 정확한 진술이 어려울 수 있음.","Patient with dementia may not give accurate account.") }, { text: loc("\"증거 부족\"으로 무시","Ignore due to \"insufficient evidence\""), effect: { hp: -42, rep: -30 }, log: loc("의무 위반입니다.","Violates duty.") }]) }; }
function generateJPDrainQuestion() { return { baseId: "jpDrain", categoryKey: "fundamentals", part: loc("배액","Drainage"), emoji: "🩹", title: loc("JP 배액관 관리","JP Drain Care"), desc: loc(`수술 후 Jackson-Pratt(JP) 배액관을 비울 때 흡입력을 회복시키는 방법은?`,`How do you re-establish suction after emptying a Jackson-Pratt drain?`), choices: shuffle([{ text: loc("배액통을 손으로 누른 채 마개를 닫아 진공을 만든다","Compress the bulb fully and close the cap to create suction"), effect: { hp: -2, rep: 22 }, log: loc("정답. 음압 흡입이 핵심.","Correct. Negative-pressure suction is key.") }, { text: loc("부풀어 있을 때 닫는다","Close the cap while the bulb is fully expanded"), effect: { hp: -28, rep: -20 }, log: loc("흡입력이 없습니다.","No suction.") }, { text: loc("흡입 펌프에 연결","Connect to a suction pump"), effect: { hp: -22, rep: -12 }, log: loc("JP는 자체 진공이며 외부 흡입 불요.","JP self-suction; external pump unnecessary.") }, { text: loc("그냥 마개만 닫고 둔다","Just cap it without compressing"), effect: { hp: -28, rep: -20 }, log: loc("진공이 형성되지 않음.","No vacuum forms.") }]) }; }
function generatePainTypesQuestion() { return { baseId: "painTypes", categoryKey: "fundamentals", part: loc("통증","Pain"), emoji: "⚡", title: loc("통증 유형 분류","Pain Type Classification"), desc: loc(`타는 듯하고 저린 양상의 만성 통증으로 항우울제·항경련제에 잘 반응하는 통증 유형은?`,`Chronic burning, tingling pain that responds to antidepressants/anticonvulsants?`), choices: shuffle([{ text: loc("신경병성 통증(Neuropathic)","Neuropathic pain"), effect: { hp: -2, rep: 22 }, log: loc("정답. 신경 손상 - 항우울제·gabapentinoids에 반응.","Correct. Nerve damage — responds to TCAs/gabapentinoids.") }, { text: loc("체성 통증(Somatic)","Somatic pain"), effect: { hp: -22, rep: -12 }, log: loc("국소적·날카로운 양상.","Localized, sharp.") }, { text: loc("내장성 통증(Visceral)","Visceral pain"), effect: { hp: -22, rep: -12 }, log: loc("둔하고 광범위한 복부 통증.","Dull, diffuse abdominal pain.") }, { text: loc("관련통(Referred)","Referred pain"), effect: { hp: -22, rep: -12 }, log: loc("다른 부위로 방사되는 통증.","Pain felt at a distant site.") }]) }; }

// ========= 배치 1: 심혈관·호흡기 10문제 =========
function generateTamponadeQuestion() { return { baseId: "tamponade", categoryKey: "adult", part: loc("심혈관 응급","Cardiac Emergency"), emoji: "💔", title: loc("심낭 압전","Cardiac Tamponade"), desc: loc(`외상 후 환자가 저혈압·경정맥 팽대·심음 둔화의 Beck 3징후를 보인다. 즉각 처치는?`,`Post-trauma patient: hypotension, JVD, muffled heart sounds (Beck's triad). Immediate action?`), choices: shuffle([{ text: loc("응급 심낭천자(Pericardiocentesis)","Emergency pericardiocentesis"), effect: { hp: -3, rep: 22 }, log: loc("정답. 심낭 액체 배출이 생명을 구합니다.","Correct. Drainage saves life.") }, { text: loc("이뇨제 IV로 전부하 감소","IV diuretics to reduce preload"), effect: { hp: -45, rep: -32 }, log: loc("저혈압을 악화시킵니다.","Worsens hypotension.") }, { text: loc("관찰만 하며 X-ray 결과 대기","Just observe and wait for X-ray"), effect: { hp: -50, rep: -38 }, log: loc("응급입니다 - 영상 전 처치.","Emergency — treat before imaging.") }, { text: loc("스테로이드 IV","IV steroids"), effect: { hp: -28, rep: -20 }, log: loc("적응증이 다릅니다.","Wrong indication.") }]) }; }
function generateAorticDissectionQuestion() { return { baseId: "aorticDissection", categoryKey: "adult", part: loc("심혈관 응급","Cardiac Emergency"), emoji: "💢", title: loc("대동맥 박리","Aortic Dissection"), desc: loc(`갑작스러운 \"찢어지는\" 등으로 방사되는 흉통과 좌우 혈압 차이. 1차 치료 목표는?`,`Sudden tearing chest pain radiating to back, BP differential between arms. Primary treatment goal?`), choices: shuffle([{ text: loc("혈압·심박수 강력 조절(SBP 100-120, HR<60) + 외과 자문","Aggressive BP/HR control (SBP 100-120, HR<60) + surgical consult"), effect: { hp: -3, rep: 22 }, log: loc("정답. 박리 진행을 막는 것이 핵심.","Correct. Prevent dissection extension.") }, { text: loc("아스피린 즉시 투여","Immediate aspirin"), effect: { hp: -40, rep: -30 }, log: loc("출혈 위험 - MI와 다름.","Bleeding risk — different from MI.") }, { text: loc("혈전용해제(tPA) 투여","Thrombolytics (tPA)"), effect: { hp: -50, rep: -38 }, log: loc("절대 금기 - 박리 확대.","Absolutely contraindicated — extends dissection.") }, { text: loc("절대 안정만 유지","Just strict bed rest"), effect: { hp: -32, rep: -22 }, log: loc("능동적 약물 조절 필요.","Active pharmacologic control needed.") }]) }; }
function generateHTNCrisisQuestion() { return { baseId: "htnCrisis", categoryKey: "adult", part: loc("심혈관 응급","Cardiac Emergency"), emoji: "📈", title: loc("고혈압 응급","Hypertensive Emergency"), desc: loc(`혈압 220/130, 심한 두통·시야 흐림·구토를 보이는 환자에게 가장 적절한 약물은?`,`BP 220/130 with severe headache, blurred vision, vomiting. Best drug?`), choices: shuffle([{ text: loc("정맥 Nicardipine 또는 Labetalol (단계적 강하)","IV Nicardipine or Labetalol (gradual reduction)"), effect: { hp: -3, rep: 22 }, log: loc("정답. 첫 1시간 25% 이내로 천천히 강하.","Correct. Lower ≤25% in first hour.") }, { text: loc("경구 Nifedipine 즉시 투여로 급격히 강하","Immediate-release oral nifedipine to drop BP fast"), effect: { hp: -42, rep: -30 }, log: loc("뇌·심장 허혈 위험 - 권장하지 않습니다.","Risk of cerebral/cardiac ischemia — not recommended.") }, { text: loc("절대 안정만, 약물 보류","Just bed rest, withhold drugs"), effect: { hp: -30, rep: -22 }, log: loc("표적장기 손상 진행.","End-organ damage progresses.") }, { text: loc("아스피린만 투여","Just aspirin"), effect: { hp: -32, rep: -22 }, log: loc("혈압 조절 효과 없음.","No BP control effect.") }]) }; }
function generateS3S4Question() { return { baseId: "s3s4", categoryKey: "adult", part: loc("심음","Heart Sounds"), emoji: "🫀", title: loc("S3 vs S4 심음","S3 vs S4 Heart Sounds"), desc: loc(`젊은 환자에게는 정상이지만 성인에서는 심부전(체액 과다)을 시사하는 심음은?`,`Heart sound that's normal in youth but suggests heart failure (volume overload) in adults?`), choices: shuffle([{ text: loc("S3 (심실 충만음, ventricular gallop)","S3 (ventricular gallop)"), effect: { hp: -2, rep: 22 }, log: loc("정답. S3는 빠른 심실 충만 - 체액 과다·CHF 시사.","Correct. S3 = rapid ventricular filling — volume overload/CHF.") }, { text: loc("S4 (심방 갈로프, atrial gallop)","S4 (atrial gallop)"), effect: { hp: -22, rep: -12 }, log: loc("S4는 좌심실 비대·고혈압·MI에서.","S4 in LVH, HTN, MI.") }, { text: loc("S1 분열","Split S1"), effect: { hp: -22, rep: -12 }, log: loc("일반적으로 정상 변이.","Generally a normal variant.") }, { text: loc("S2 정상","Normal S2"), effect: { hp: -22, rep: -12 }, log: loc("정상 심음입니다.","Normal heart sound.") }]) }; }
function generateAFlutterQuestion() { return { baseId: "aFlutter", categoryKey: "adult", part: loc("부정맥","Arrhythmia"), emoji: "📊", title: loc("심방조동","Atrial Flutter"), desc: loc(`ECG에서 톱니 모양(sawtooth) F파와 규칙적 심실반응을 보이는 부정맥은?`,`ECG shows sawtooth F-waves with regular ventricular response. Which arrhythmia?`), choices: shuffle([{ text: loc("심방조동(Atrial flutter)","Atrial flutter"), effect: { hp: -2, rep: 22 }, log: loc("정답. 톱니파가 특징적 소견.","Correct. Sawtooth pattern is pathognomonic.") }, { text: loc("심방세동(A-fib)","Atrial fibrillation"), effect: { hp: -22, rep: -12 }, log: loc("A-fib는 불규칙·F파 없음.","A-fib is irregular without F-waves.") }, { text: loc("심실빈맥","V-tach"), effect: { hp: -25, rep: -15 }, log: loc("V-tach은 wide QRS.","V-tach has wide QRS.") }, { text: loc("정상 동성리듬","Normal sinus rhythm"), effect: { hp: -22, rep: -12 }, log: loc("정상은 P파가 명확합니다.","Normal has clear P-waves.") }]) }; }
function generateARDSQuestion() { return { baseId: "ards", categoryKey: "adult", part: loc("호흡기 응급","Respiratory Emergency"), emoji: "🫁", title: loc("ARDS","Acute Respiratory Distress Syndrome"), desc: loc(`패혈증 환자에서 갑작스러운 양측성 폐침윤·심한 저산소혈증(P/F<300)을 보일 때 진단은?`,`Septic patient develops bilateral pulmonary infiltrates and severe hypoxemia (P/F<300). Diagnosis?`), choices: shuffle([{ text: loc("급성호흡곤란증후군(ARDS)","Acute Respiratory Distress Syndrome (ARDS)"), effect: { hp: -3, rep: 22 }, log: loc("정답. 베를린 기준 - 양측 침윤+P/F<300+심부전 배제.","Correct. Berlin criteria — bilateral infiltrates + P/F<300 + cardiac failure excluded.") }, { text: loc("단순 폐렴","Simple pneumonia"), effect: { hp: -28, rep: -20 }, log: loc("심한 저산소혈증과 양측성이 ARDS 시사.","Severe hypoxemia + bilateral suggest ARDS.") }, { text: loc("폐색전증","Pulmonary embolism"), effect: { hp: -28, rep: -20 }, log: loc("PE는 보통 단측성·갑작스런 흉통.","PE is usually unilateral and sudden onset.") }, { text: loc("천식 발작","Asthma attack"), effect: { hp: -28, rep: -20 }, log: loc("기전과 영상 소견이 다릅니다.","Different mechanism and imaging.") }]) }; }
function generatePulmonaryEdemaQuestion() { return { baseId: "pulmonaryEdema", categoryKey: "adult", part: loc("호흡기 응급","Respiratory Emergency"), emoji: "💧", title: loc("폐부종","Pulmonary Edema"), desc: loc(`핑크색 거품 객담·기좌호흡·전체 폐야 수포음을 보이는 환자에게 1차 약물은?`,`Pink frothy sputum, orthopnea, diffuse crackles. First-line drug?`), choices: shuffle([{ text: loc("Furosemide IV + 산소 + 모르핀(불안 완화)","IV furosemide + oxygen + morphine (anxiety)"), effect: { hp: -3, rep: 22 }, log: loc("정답. 이뇨·산소화·전부하 감소가 핵심(LMNOP).","Correct. Diuresis, oxygenation, preload reduction (LMNOP).") }, { text: loc("정맥 식염수 대량 투여","Aggressive IV saline"), effect: { hp: -45, rep: -32 }, log: loc("폐부종을 악화시킵니다.","Worsens pulmonary edema.") }, { text: loc("절대 안정 평와위","Strict bed rest supine"), effect: { hp: -28, rep: -20 }, log: loc("앉은 자세가 호흡을 도움.","Upright position aids breathing.") }, { text: loc("기관지확장제만","Bronchodilators only"), effect: { hp: -25, rep: -15 }, log: loc("폐부종에는 부족.","Insufficient for pulmonary edema.") }]) }; }
function generatePleuralEffusionQuestion() { return { baseId: "pleuralEffusion", categoryKey: "adult", part: loc("호흡기","Respiratory"), emoji: "🫁", title: loc("늑막 천자","Thoracentesis"), desc: loc(`늑막 천자(thoracentesis) 시 환자에게 가장 적절한 자세는?`,`Best patient position for thoracentesis?`), choices: shuffle([{ text: loc("환자가 앞쪽 테이블에 기대어 앉은 자세","Patient sitting, leaning forward on a bedside table"), effect: { hp: -2, rep: 22 }, log: loc("정답. 늑간을 넓히고 액체 위치 확인 용이.","Correct. Widens intercostal spaces, fluid pools dependently.") }, { text: loc("앙와위로 평와","Supine flat"), effect: { hp: -22, rep: -12 }, log: loc("천자 부위 접근이 어려움.","Hard to access puncture site.") }, { text: loc("환측이 위로 가는 측와위","Lateral with affected side up"), effect: { hp: -25, rep: -15 }, log: loc("액체가 흩어집니다.","Fluid disperses.") }, { text: loc("Trendelenburg","Trendelenburg"), effect: { hp: -25, rep: -15 }, log: loc("호흡 곤란 악화.","Worsens dyspnea.") }]) }; }
function generateAdultAsthmaQuestion() { return { baseId: "adultAsthma", categoryKey: "adult", part: loc("호흡기 응급","Respiratory Emergency"), emoji: "💨", title: loc("성인 천식 악화","Adult Asthma Exacerbation"), desc: loc(`PEFR이 평소의 50% 미만, 청색증·말 끊김을 보이는 성인 환자에게 1차 처치는?`,`Adult patient: PEFR <50% baseline, cyanosis, broken speech. First-line treatment?`), choices: shuffle([{ text: loc("산소 + 흡입 SABA(Albuterol) + 전신 코르티코스테로이드","Oxygen + inhaled SABA (albuterol) + systemic corticosteroids"), effect: { hp: -3, rep: 22 }, log: loc("정답. 중증 악화의 표준 1차 요법.","Correct. Standard first-line for severe exacerbation.") }, { text: loc("진정제로 불안 완화부터","Sedate first to reduce anxiety"), effect: { hp: -45, rep: -32 }, log: loc("호흡 억제 사망 위험.","Respiratory depression — fatal.") }, { text: loc("비강캐뉼라 산소만","Nasal cannula oxygen only"), effect: { hp: -28, rep: -20 }, log: loc("기관지 확장이 필수.","Bronchodilation essential.") }, { text: loc("LABA(Salmeterol)만 흡입","Inhaled LABA (salmeterol) alone"), effect: { hp: -32, rep: -22 }, log: loc("LABA는 급성 발작에 부적절.","LABA inappropriate in acute attack.") }]) }; }
function generatePostopAtelectasisQuestion() { return { baseId: "postopAtelectasis", categoryKey: "adult", part: loc("수술 후 합병증","Postop Complication"), emoji: "🫁", title: loc("수술 후 무기폐","Postop Atelectasis"), desc: loc(`복부수술 후 24~48시간에 발열·빈호흡·청진상 한쪽 폐 호흡음 감소. 가장 가능성 높은 진단은?`,`24-48 hours post-abdominal surgery: fever, tachypnea, decreased breath sounds on one side. Most likely?`), choices: shuffle([{ text: loc("무기폐(Atelectasis)","Atelectasis"), effect: { hp: -3, rep: 22 }, log: loc("정답. 수술 후 가장 흔한 폐합병증.","Correct. Most common post-op pulmonary complication.") }, { text: loc("폐색전증","Pulmonary embolism"), effect: { hp: -22, rep: -12 }, log: loc("PE는 보통 갑작스런 흉통·D-dimer 상승.","PE: sudden chest pain, D-dimer up.") }, { text: loc("심부전","Heart failure"), effect: { hp: -22, rep: -12 }, log: loc("심부전은 양측 수포음.","HF has bilateral crackles.") }, { text: loc("폐부종","Pulmonary edema"), effect: { hp: -22, rep: -12 }, log: loc("폐부종도 양측성.","Edema is also bilateral.") }]) }; }

// ========= 배치 2: 신장·내분비·소화기·신경 10문제 =========
function generateAKIQuestion() { return { baseId: "aki", categoryKey: "adult", part: loc("비뇨기","Urology"), emoji: "💧", title: loc("급성 신손상(AKI) 유형","AKI Categories"), desc: loc(`수술 후 출혈·저혈량으로 인해 발생한 AKI는 어느 유형에 속하는가?`,`Surgical bleeding/hypovolemia-induced AKI falls into which category?`), choices: shuffle([{ text: loc("신전성(Pre-renal) - 관류 저하","Pre-renal — perfusion drop"), effect: { hp: -2, rep: 22 }, log: loc("정답. 신장 자체는 정상, 관류만 부족.","Correct. Kidney itself is intact; perfusion drops.") }, { text: loc("신성(Intra-renal)","Intra-renal"), effect: { hp: -22, rep: -12 }, log: loc("신실질 자체 손상(독성·ATN 등).","Parenchymal damage (toxic, ATN, etc.).") }, { text: loc("신후성(Post-renal)","Post-renal"), effect: { hp: -22, rep: -12 }, log: loc("요로 폐쇄가 원인.","Caused by urinary tract obstruction.") }, { text: loc("만성 신부전","Chronic kidney disease"), effect: { hp: -22, rep: -12 }, log: loc("CKD는 만성·서서히 진행.","CKD is chronic, gradual.") }]) }; }
function generateGlomerulonephritisQuestion() { return { baseId: "psgn", categoryKey: "pediatric", part: loc("신장","Renal"), emoji: "💧", title: loc("연쇄상구균 후 사구체신염","Post-Streptococcal GN"), desc: loc(`인후염 2주 후 콜라색 소변·부종·고혈압이 나타난 학령기 아동의 진단은?`,`School-age child: cola-colored urine, edema, HTN, 2 weeks post-pharyngitis. Diagnosis?`), choices: shuffle([{ text: loc("연쇄상구균 후 사구체신염(PSGN)","Post-streptococcal glomerulonephritis (PSGN)"), effect: { hp: -2, rep: 22 }, log: loc("정답. 인후염→2~3주 후 면역복합체 매개.","Correct. Pharyngitis → 2-3 weeks → immune-complex GN.") }, { text: loc("신증후군","Nephrotic syndrome"), effect: { hp: -22, rep: -12 }, log: loc("심한 단백뇨·전신 부종이 특징.","Marked proteinuria + generalized edema.") }, { text: loc("UTI","UTI"), effect: { hp: -22, rep: -12 }, log: loc("배뇨통·빈뇨가 주증상.","Dysuria, frequency.") }, { text: loc("결석","Kidney stones"), effect: { hp: -22, rep: -12 }, log: loc("심한 측복통이 특징.","Severe flank pain.") }]) }; }
function generateNephroticSyndromeQuestion() { return { baseId: "nephrotic", categoryKey: "pediatric", part: loc("신장","Renal"), emoji: "💧", title: loc("신증후군 4징후","Nephrotic Syndrome Tetrad"), desc: loc(`신증후군의 4대 임상 소견은?`,`Four hallmark findings of nephrotic syndrome?`), choices: shuffle([{ text: loc("심한 단백뇨·저알부민혈증·부종·고지혈증","Massive proteinuria, hypoalbuminemia, edema, hyperlipidemia"), effect: { hp: -2, rep: 22 }, log: loc("정답. 4징후 외우기.","Correct. Memorize the tetrad.") }, { text: loc("혈뇨·고혈압·부종·핍뇨","Hematuria, HTN, edema, oliguria"), effect: { hp: -22, rep: -12 }, log: loc("이는 신염성 증후군.","That's nephritic syndrome.") }, { text: loc("발열·관절통·발진","Fever, arthralgia, rash"), effect: { hp: -25, rep: -15 }, log: loc("자가면역 질환.","Autoimmune features.") }, { text: loc("빈뇨·배뇨통·발열","Frequency, dysuria, fever"), effect: { hp: -25, rep: -15 }, log: loc("UTI 증상.","UTI symptoms.") }]) }; }
function generatePheoQuestion() { return { baseId: "pheo", categoryKey: "adult", part: loc("내분비","Endocrine"), emoji: "⚡", title: loc("갈색세포종","Pheochromocytoma"), desc: loc(`발작적 두통·발한·심계항진·고혈압을 보이는 환자에서 의심되는 종양은?`,`Episodic headache, sweating, palpitations, HTN. Suspected tumor?`), choices: shuffle([{ text: loc("부신수질의 갈색세포종","Adrenal medullary pheochromocytoma"), effect: { hp: -3, rep: 22 }, log: loc("정답. 카테콜라민 분비 종양 - 5H(headache, hypertension, hyperhidrosis, hyperglycemia, heart palpitations).","Correct. Catecholamine-secreting tumor — 5 H's.") }, { text: loc("갑상선암","Thyroid cancer"), effect: { hp: -25, rep: -15 }, log: loc("증상 패턴이 다릅니다.","Different symptom pattern.") }, { text: loc("부신피질 선종","Adrenal cortical adenoma"), effect: { hp: -22, rep: -12 }, log: loc("Cushing 증후군 양상.","Cushing's pattern.") }, { text: loc("뇌하수체 종양","Pituitary tumor"), effect: { hp: -22, rep: -12 }, log: loc("호르몬에 따라 증상이 다양.","Symptoms vary by hormone.") }]) }; }
function generateHypoparaQuestion() { return { baseId: "hypopara", categoryKey: "adult", part: loc("내분비","Endocrine"), emoji: "🦴", title: loc("부갑상선기능저하","Hypoparathyroidism"), desc: loc(`갑상선 절제술 후 환자가 손가락 저림·구주위 감각이상·Trousseau·Chvostek 양성. 즉시 처치는?`,`Post-thyroidectomy patient: tingling fingers, perioral paresthesia, positive Trousseau/Chvostek. Immediate action?`), choices: shuffle([{ text: loc("Calcium gluconate IV (즉시) + Vitamin D","IV calcium gluconate + vitamin D"), effect: { hp: -3, rep: 22 }, log: loc("정답. 저칼슘혈증으로 후두경련 위험.","Correct. Hypocalcemia risks laryngospasm.") }, { text: loc("이뇨제 투여","Give diuretics"), effect: { hp: -32, rep: -22 }, log: loc("저칼슘을 더 악화.","Worsens hypocalcemia.") }, { text: loc("관찰만 하며 다음 회진까지","Just observe until next round"), effect: { hp: -45, rep: -32 }, log: loc("후두경련·발작 위험.","Risk of laryngospasm/seizure.") }, { text: loc("칼륨 IV","IV potassium"), effect: { hp: -32, rep: -22 }, log: loc("문제는 칼슘입니다.","The issue is calcium.") }]) }; }
function generateHyperparaQuestion() { return { baseId: "hyperpara", categoryKey: "adult", part: loc("내분비","Endocrine"), emoji: "🦴", title: loc("부갑상선기능항진","Hyperparathyroidism"), desc: loc(`반복적 신결석·골다공증·고칼슘혈증을 보이는 환자에서 의심되는 진단은?`,`Recurrent kidney stones, osteoporosis, hypercalcemia. Suspected?`), choices: shuffle([{ text: loc("부갑상선기능항진증","Hyperparathyroidism"), effect: { hp: -2, rep: 22 }, log: loc("정답. 칼슘 상승·인 저하·골재흡수.","Correct. Elevated Ca, low Phos, bone resorption.") }, { text: loc("부갑상선기능저하","Hypoparathyroidism"), effect: { hp: -22, rep: -12 }, log: loc("저칼슘혈증입니다.","That's hypocalcemia.") }, { text: loc("당뇨병","Diabetes mellitus"), effect: { hp: -22, rep: -12 }, log: loc("관련 없습니다.","Unrelated.") }, { text: loc("쿠싱병","Cushing's"), effect: { hp: -22, rep: -12 }, log: loc("패턴이 다릅니다.","Different pattern.") }]) }; }
function generateBowelObstructionQuestion() { return { baseId: "bowelObstruction", categoryKey: "adult", part: loc("소화기","GI"), emoji: "🌀", title: loc("기계적 vs 마비성 장폐색","Mechanical vs Paralytic Ileus"), desc: loc(`복부수술 후 환자에서 복부팽만·구토·배변 정지가 있으나 장음 무음. 어떤 유형의 장폐색인가?`,`Post-op patient: distention, vomiting, no BM, absent bowel sounds. Type?`), choices: shuffle([{ text: loc("마비성 장폐색(Paralytic ileus)","Paralytic ileus"), effect: { hp: -2, rep: 22 }, log: loc("정답. 수술 후·장음 무음이 특징.","Correct. Post-op + absent bowel sounds.") }, { text: loc("기계적 장폐색(Mechanical)","Mechanical obstruction"), effect: { hp: -22, rep: -12 }, log: loc("기계적은 고음성·금속음 장음.","Mechanical has high-pitched/tinkling sounds.") }, { text: loc("정상 수술 후 회복","Normal post-op recovery"), effect: { hp: -25, rep: -15 }, log: loc("증상이 비정상입니다.","Symptoms are abnormal.") }, { text: loc("위염","Gastritis"), effect: { hp: -25, rep: -15 }, log: loc("패턴이 다릅니다.","Different pattern.") }]) }; }
function generateGIBleedQuestion() { return { baseId: "giBleed", categoryKey: "adult", part: loc("소화기","GI"), emoji: "🩸", title: loc("상부 vs 하부 GI 출혈","Upper vs Lower GI Bleed"), desc: loc(`흑색변(melena)과 토혈을 보이는 환자에서 출혈 부위는?`,`Patient with melena and hematemesis. Source?`), choices: shuffle([{ text: loc("상부 GI 출혈(Treitz 인대 위)","Upper GI bleed (above Ligament of Treitz)"), effect: { hp: -2, rep: 22 }, log: loc("정답. 토혈+흑색변=상부.","Correct. Hematemesis + melena = upper.") }, { text: loc("하부 GI 출혈","Lower GI bleed"), effect: { hp: -22, rep: -12 }, log: loc("선홍색 혈변(hematochezia)이 특징.","Bright red blood per rectum.") }, { text: loc("치질","Hemorrhoids"), effect: { hp: -22, rep: -12 }, log: loc("외부·선홍색.","External, bright red.") }, { text: loc("게실 출혈","Diverticular bleed"), effect: { hp: -22, rep: -12 }, log: loc("하부 GI에 해당.","Lower GI source.") }]) }; }
function generatePeritonitisQuestion() { return { baseId: "peritonitis", categoryKey: "adult", part: loc("소화기","GI"), emoji: "🔥", title: loc("복막염","Peritonitis"), desc: loc(`판상복부(board-like rigidity)·반동압통·발열을 보이는 환자에서 가장 의심되는 진단은?`,`Board-like abdomen, rebound tenderness, fever. Most likely?`), choices: shuffle([{ text: loc("복막염","Peritonitis"), effect: { hp: -3, rep: 22 }, log: loc("정답. 응급 수술이 필요.","Correct. Surgical emergency.") }, { text: loc("단순 변비","Simple constipation"), effect: { hp: -42, rep: -32 }, log: loc("응급을 놓칩니다.","Misses emergency.") }, { text: loc("위장염","Gastroenteritis"), effect: { hp: -28, rep: -20 }, log: loc("판상복부는 비특이적이지 않음.","Board-like abdomen isn't typical.") }, { text: loc("IBS","IBS"), effect: { hp: -28, rep: -20 }, log: loc("응급 소견이 아님.","Not an emergency picture.") }]) }; }
function generateMGCrisisQuestion() { return { baseId: "mgCrisis", categoryKey: "adult", part: loc("신경계","Neuro"), emoji: "💪", title: loc("중증근무력증 위기","Myasthenic Crisis"), desc: loc(`중증근무력증 환자에서 호흡근 마비로 호흡 부전이 발생했다. 1차 응급 처치는?`,`MG patient develops respiratory failure from respiratory muscle paralysis. Emergency first action?`), choices: shuffle([{ text: loc("기관내 삽관·기계환기 + Plasmapheresis 또는 IVIG","Intubate and ventilate + plasmapheresis or IVIG"), effect: { hp: -3, rep: 22 }, log: loc("정답. 호흡 보조가 우선, 면역요법 병행.","Correct. Airway first, then immunotherapy.") }, { text: loc("Pyridostigmine 즉시 증량","Increase pyridostigmine"), effect: { hp: -32, rep: -22 }, log: loc("콜린성 위기 가능 - 신중해야.","May trigger cholinergic crisis — caution.") }, { text: loc("절대 안정만","Just bed rest"), effect: { hp: -45, rep: -32 }, log: loc("호흡 부전 응급.","Respiratory failure emergency.") }, { text: loc("진정제 투여","Give sedatives"), effect: { hp: -45, rep: -32 }, log: loc("호흡 억제 악화.","Worsens respiratory depression.") }]) }; }

// ========= 배치 3: 신경·면역·모성·아동 10문제 =========
function generateGBSQuestion() { return { baseId: "gbs", categoryKey: "adult", part: loc("신경계","Neuro"), emoji: "🦵", title: loc("길랭-바레 증후군","Guillain-Barré Syndrome"), desc: loc(`최근 위장관 감염 후 발에서 시작해 위로 올라가는 대칭성 마비를 보이는 환자에서 가장 위험한 합병증은?`,`Recent GI infection then ascending symmetric paralysis from feet up. Most dangerous complication?`), choices: shuffle([{ text: loc("호흡근 마비로 호흡부전","Respiratory failure from diaphragm paralysis"), effect: { hp: -3, rep: 22 }, log: loc("정답. FVC<15 mL/kg시 기계환기 필요.","Correct. Ventilation needed if FVC<15 mL/kg.") }, { text: loc("심각한 두통","Severe headache"), effect: { hp: -22, rep: -12 }, log: loc("주된 합병증이 아닙니다.","Not the main concern.") }, { text: loc("관절 통증","Joint pain"), effect: { hp: -25, rep: -15 }, log: loc("주된 위협이 아님.","Not life-threatening.") }, { text: loc("발진","Rash"), effect: { hp: -25, rep: -15 }, log: loc("주된 위협이 아님.","Not life-threatening.") }]) }; }
function generateBellsQuestion() { return { baseId: "bellsPalsy", categoryKey: "adult", part: loc("신경계","Neuro"), emoji: "😶", title: loc("벨 마비","Bell's Palsy"), desc: loc(`갑작스러운 한쪽 안면 마비·이마 주름 소실·눈 감기 어려움을 보이는 환자에 대한 1차 치료는?`,`Sudden unilateral facial paralysis with loss of forehead wrinkles, can't close eye. First-line treatment?`), choices: shuffle([{ text: loc("코르티코스테로이드 조기 투여 + 인공눈물·안대로 각막 보호","Early corticosteroids + artificial tears/eye patch for corneal protection"), effect: { hp: -2, rep: 22 }, log: loc("정답. 72시간 이내 스테로이드가 회복률 향상.","Correct. Steroids within 72 hours improve recovery.") }, { text: loc("뇌졸중 프로토콜로 tPA","Stroke protocol with tPA"), effect: { hp: -32, rep: -22 }, log: loc("이마가 영향받으면 말초성, 뇌졸중과 다름.","Forehead involvement = peripheral, not stroke.") }, { text: loc("관찰만","Just observe"), effect: { hp: -22, rep: -12 }, log: loc("각막 손상 위험.","Risk of corneal injury.") }, { text: loc("항생제 IV","IV antibiotics"), effect: { hp: -25, rep: -15 }, log: loc("바이러스성 추정 - 항생제 부적절.","Presumed viral — antibiotics inappropriate.") }]) }; }
function generateSLEQuestion() { return { baseId: "sle", categoryKey: "adult", part: loc("자가면역","Autoimmune"), emoji: "🦋", title: loc("전신홍반루푸스","Systemic Lupus Erythematosus"), desc: loc(`젊은 여성이 나비 모양 발진·관절통·신염을 보일 때 가장 우선되는 환자 교육은?`,`Young woman with butterfly rash, arthralgia, nephritis. Top priority teaching?`), choices: shuffle([{ text: loc("자외선 회피·자외선 차단제 사용","Avoid UV exposure, use sunscreen"), effect: { hp: -2, rep: 22 }, log: loc("정답. 햇빛이 luspus 악화의 주요 유발인자.","Correct. UV is a major lupus flare trigger.") }, { text: loc("매일 강한 운동","Vigorous daily exercise"), effect: { hp: -25, rep: -15 }, log: loc("피로 유발로 악화 가능.","Can trigger fatigue/flare.") }, { text: loc("고염분식이","High-salt diet"), effect: { hp: -25, rep: -15 }, log: loc("신장 부담을 가중.","Burdens kidneys.") }, { text: loc("스테로이드 임의 중단","Stop steroids on your own"), effect: { hp: -38, rep: -28 }, log: loc("위기 유발 위험.","Risks adrenal crisis/flare.") }]) }; }
function generateSJSQuestion() { return { baseId: "sjs", categoryKey: "adult", part: loc("응급 피부","Skin Emergency"), emoji: "🔥", title: loc("스티븐스-존슨 증후군","Stevens-Johnson Syndrome"), desc: loc(`새로운 약물 시작 1~3주 후 발열·점막 침범·박리성 발진을 보이는 환자에 대한 처치는?`,`1-3 weeks after new drug: fever, mucosal involvement, sloughing rash. Action?`), choices: shuffle([{ text: loc("의심 약물 즉시 중단 + 화상 환자처럼 액체·전해질 관리","Stop the suspect drug immediately + manage like burn (fluid/electrolyte)"), effect: { hp: -3, rep: 22 }, log: loc("정답. 응급 - 박리 면적이 클수록 위중.","Correct. Emergency — wider sloughing = worse prognosis.") }, { text: loc("증상 완화 위해 항생제 추가","Add antibiotics for symptoms"), effect: { hp: -32, rep: -22 }, log: loc("새 약물 추가는 위험.","Adding new drugs is dangerous.") }, { text: loc("스테로이드 크림만 도포","Topical steroid only"), effect: { hp: -32, rep: -22 }, log: loc("전신 응급에 부족.","Insufficient for systemic emergency.") }, { text: loc("관찰만","Just observe"), effect: { hp: -45, rep: -32 }, log: loc("사망률이 높습니다.","High mortality.") }]) }; }
function generateCordProlapseQuestion() { return { baseId: "cordProlapse", categoryKey: "maternal", part: loc("분만 응급","Labor Emergency"), emoji: "🚨", title: loc("제대 탈출","Umbilical Cord Prolapse"), desc: loc(`내진 시 자궁경부에서 박동하는 제대가 만져진다. 1차 응급 처치는?`,`On vaginal exam, a pulsating cord is palpated. First emergency action?`), choices: shuffle([{ text: loc("산모를 슬흉위로 + 손으로 선진부를 밀어 제대 압박 해제 + 응급 제왕절개","Knee-chest position + manually elevate presenting part off cord + emergency C-section"), effect: { hp: -3, rep: 22 }, log: loc("정답. 제대 압박을 즉시 해제.","Correct. Relieve cord compression immediately.") }, { text: loc("제대를 다시 자궁 안으로 밀어넣음","Push the cord back into the uterus"), effect: { hp: -45, rep: -32 }, log: loc("절대 금기 - 감염·손상.","Absolutely contraindicated — infection/injury.") }, { text: loc("자연분만 진행","Continue vaginal delivery"), effect: { hp: -45, rep: -32 }, log: loc("태아 사망 위험.","Risk of fetal death.") }, { text: loc("관찰만 하며 자연 정복 대기","Just observe for spontaneous reduction"), effect: { hp: -50, rep: -38 }, log: loc("응급입니다.","Emergency.") }]) }; }
function generateUterineRuptureQuestion() { return { baseId: "uterineRupture", categoryKey: "maternal", part: loc("분만 응급","Labor Emergency"), emoji: "💥", title: loc("자궁 파열","Uterine Rupture"), desc: loc(`이전 제왕절개 산모가 진통 중 갑작스러운 심한 복통·태아심음 변화·혈압 저하. 의심 진단은?`,`Previous C-section mother in labor: sudden severe abdominal pain, FHR changes, hypotension. Suspect?`), choices: shuffle([{ text: loc("자궁 파열 - 응급 개복술","Uterine rupture — emergency laparotomy"), effect: { hp: -3, rep: 22 }, log: loc("정답. 산모·태아 모두 응급.","Correct. Emergency for both mother and fetus.") }, { text: loc("정상 분만 진행","Normal labor progression"), effect: { hp: -45, rep: -32 }, log: loc("응급을 놓칩니다.","Misses emergency.") }, { text: loc("자궁수축억제제","Tocolytics"), effect: { hp: -42, rep: -30 }, log: loc("파열에는 부적절.","Inappropriate for rupture.") }, { text: loc("진통제만 IV","Just IV pain control"), effect: { hp: -38, rep: -28 }, log: loc("원인 처치가 필요.","Need to address cause.") }]) }; }
function generateAROMQuestion() { return { baseId: "arom", categoryKey: "maternal", part: loc("분만","Labor"), emoji: "💧", title: loc("인공 양막 파막술","Artificial ROM"), desc: loc(`인공 양막 파막술(AROM) 직후 가장 우선 사정해야 할 항목은?`,`Immediately after AROM, what should be assessed first?`), choices: shuffle([{ text: loc("태아심음 모니터링과 양수 색·양·냄새","FHR monitoring + amniotic fluid color/amount/odor"), effect: { hp: -2, rep: 22 }, log: loc("정답. 제대 탈출 위험과 태변 착색을 즉시 평가.","Correct. Assess for cord prolapse and meconium staining.") }, { text: loc("산모의 통증 점수만","Just maternal pain score"), effect: { hp: -25, rep: -15 }, log: loc("태아 평가가 우선.","Fetal assessment is priority.") }, { text: loc("산모 식사 평가","Maternal meal assessment"), effect: { hp: -28, rep: -20 }, log: loc("관련 없습니다.","Unrelated.") }, { text: loc("산모 혈당","Maternal glucose"), effect: { hp: -28, rep: -20 }, log: loc("우선순위가 아닙니다.","Not the priority.") }]) }; }
function generateTEFQuestion() { return { baseId: "tef", categoryKey: "pediatric", part: loc("선천 기형","Congenital Anomaly"), emoji: "👶", title: loc("기관식도루(TEF)","Tracheoesophageal Fistula"), desc: loc(`첫 수유 시 기침·청색증·구토를 보이는 신생아의 진단은?`,`Newborn coughs, becomes cyanotic, and vomits with first feeding. Diagnosis?`), choices: shuffle([{ text: loc("기관식도루(TEF) - 즉시 금식·NG 흡인·수술","Tracheoesophageal fistula — NPO, NG suction, surgery"), effect: { hp: -3, rep: 22 }, log: loc("정답. 3C: cough, choking, cyanosis with feeding.","Correct. 3 Cs: cough, choking, cyanosis with feeding.") }, { text: loc("정상 신생아 수유 반응","Normal newborn feeding reaction"), effect: { hp: -42, rep: -30 }, log: loc("응급 외과 진단입니다.","Surgical emergency diagnosis.") }, { text: loc("위식도역류","GERD"), effect: { hp: -32, rep: -22 }, log: loc("청색증과 기침이 동반되면 TEF 의심.","Cyanosis + cough suggests TEF.") }, { text: loc("유문협착","Pyloric stenosis"), effect: { hp: -32, rep: -22 }, log: loc("유문협착은 4주차 분출성 구토.","Pyloric stenosis: 4 weeks, projectile vomiting.") }]) }; }
function generateHirschsprungQuestion() { return { baseId: "hirschsprung", categoryKey: "pediatric", part: loc("선천 기형","Congenital Anomaly"), emoji: "👶", title: loc("선천성 거대결장","Hirschsprung Disease"), desc: loc(`출생 후 24~48시간 이내 태변 배출 실패와 복부 팽만을 보이는 신생아의 진단은?`,`Newborn fails to pass meconium within 24-48 hours and develops abdominal distention. Diagnosis?`), choices: shuffle([{ text: loc("선천성 거대결장(Hirschsprung's)","Hirschsprung's disease (aganglionic megacolon)"), effect: { hp: -3, rep: 22 }, log: loc("정답. 신경절세포 결손으로 연동운동 부재.","Correct. Aganglionic segment lacks peristalsis.") }, { text: loc("정상 신생아","Normal newborn"), effect: { hp: -42, rep: -30 }, log: loc("정상 태변 배출은 24시간 이내.","Normal meconium passes within 24 hours.") }, { text: loc("괴사성 장염","Necrotizing enterocolitis"), effect: { hp: -32, rep: -22 }, log: loc("미숙아·혈변·복부 압통이 특징.","NEC: prematurity, bloody stool, tenderness.") }, { text: loc("장중첩증","Intussusception"), effect: { hp: -32, rep: -22 }, log: loc("보통 6개월 이후.","Usually after 6 months.") }]) }; }
function generateCFQuestion() { return { baseId: "cysticFibrosis", categoryKey: "pediatric", part: loc("선천 질환","Congenital Disease"), emoji: "🧬", title: loc("낭성섬유증","Cystic Fibrosis"), desc: loc(`낭성섬유증 아동의 가장 중요한 일상 관리 영역은?`,`Most important daily care area for a CF child?`), choices: shuffle([{ text: loc("기도청결요법(CPT)·고지방·고열량 식이·췌장효소 보충","Chest physiotherapy + high-fat/high-calorie diet + pancreatic enzymes"), effect: { hp: -2, rep: 22 }, log: loc("정답. 폐 분비물 배출과 영양 결핍 방지가 핵심.","Correct. Airway clearance and preventing malnutrition are core.") }, { text: loc("저지방·저칼로리 식이","Low-fat, low-calorie diet"), effect: { hp: -38, rep: -28 }, log: loc("CF는 칼로리 요구가 높음.","CF needs MORE calories.") }, { text: loc("절대 안정","Strict bed rest"), effect: { hp: -32, rep: -22 }, log: loc("운동·CPT가 필요.","Activity and CPT needed.") }, { text: loc("수분 제한","Fluid restriction"), effect: { hp: -32, rep: -22 }, log: loc("점액 점도가 더 진해짐.","Thickens mucus.") }]) }; }

// ========= 배치 4: 정신·지역사회·관리·기본 10문제 =========
function generateRSVQuestion() { return { baseId: "rsv", categoryKey: "pediatric", part: loc("호흡기","Respiratory"), emoji: "👶", title: loc("RSV 세기관지염","RSV Bronchiolitis"), desc: loc(`6개월 영아의 RSV 세기관지염에서 가장 효과적인 일반 간호중재는?`,`Most effective general intervention for 6-month-old with RSV bronchiolitis?`), choices: shuffle([{ text: loc("산소·수분·생리식염수 비강 세척과 흡인, 접촉주의 격리","O2, hydration, saline drops with suction, contact precautions"), effect: { hp: -3, rep: 22 }, log: loc("정답. 지지 요법이 핵심·전염성 강함.","Correct. Supportive care + highly contagious.") }, { text: loc("아스피린 즉시 투여","Immediate aspirin"), effect: { hp: -45, rep: -32 }, log: loc("Reye 증후군 위험.","Risk of Reye syndrome.") }, { text: loc("기침억제제 투여","Cough suppressants"), effect: { hp: -32, rep: -22 }, log: loc("분비물 배출 방해.","Inhibits secretion clearance.") }, { text: loc("저산소혈증을 위해 100% 고농도 산소 즉시","Immediate 100% oxygen"), effect: { hp: -28, rep: -20 }, log: loc("필요한 만큼만 적정 SpO2 유지.","Titrate to target SpO2.") }]) }; }
function generateSomatoformQuestion() { return { baseId: "somatoform", categoryKey: "psych", part: loc("신체증상장애","Somatic Symptom"), emoji: "🤕", title: loc("신체증상장애 간호","Somatic Symptom Care"), desc: loc(`다양한 신체 증상을 호소하나 의학적 검사가 정상인 환자에 대한 가장 적절한 간호는?`,`Patient with multiple physical complaints but normal medical workup. Best nursing approach?`), choices: shuffle([{ text: loc("증상의 진실성을 인정하고 일관된 1명의 의료진과 정기 면담","Acknowledge symptoms as real; consistent single-provider regular visits"), effect: { hp: -3, rep: 22 }, log: loc("정답. 증상은 환자에게 실제임. 신뢰 형성이 핵심.","Correct. Symptoms are real to the patient — build consistent rapport.") }, { text: loc("\"꾀병\"이라며 직면","Confront them about \"faking\""), effect: { hp: -32, rep: -22 }, log: loc("의도적이 아닙니다.","It's not intentional.") }, { text: loc("증상 무시·외면","Ignore the symptoms"), effect: { hp: -25, rep: -15 }, log: loc("불안 가중.","Worsens anxiety.") }, { text: loc("매번 새로운 의료진 배정","Assign new providers every visit"), effect: { hp: -28, rep: -20 }, log: loc("중복 검사·신뢰 결여.","Redundant tests, no trust.") }]) }; }
function generateDissociativeQuestion() { return { baseId: "dissociative", categoryKey: "psych", part: loc("해리장애","Dissociative"), emoji: "🪞", title: loc("해리성 정체감 장애","Dissociative Identity Disorder"), desc: loc(`다중 인격을 보이는 환자에 대한 가장 적절한 간호 접근은?`,`Best approach for a patient with multiple personality presentations?`), choices: shuffle([{ text: loc("안전한 환경 제공·일관된 신뢰 관계 구축·외상 치료 의뢰","Provide safety, build consistent trust, refer for trauma therapy"), effect: { hp: -3, rep: 22 }, log: loc("정답. 통상 외상 후 발생, 통합 치료 필요.","Correct. Usually trauma-based; integration takes therapy.") }, { text: loc("\"가짜\"라고 단정","Dismiss as \"faking\""), effect: { hp: -32, rep: -22 }, log: loc("실제 정신질환입니다.","Real psychiatric condition.") }, { text: loc("어떤 인격이 나오는지 추궁","Interrogate which alter is present"), effect: { hp: -25, rep: -15 }, log: loc("불안과 해리 악화 위험.","May worsen dissociation.") }, { text: loc("환자 격리","Isolate the patient"), effect: { hp: -32, rep: -22 }, log: loc("외상 환자에게 부적절.","Inappropriate for trauma patients.") }]) }; }
function generateBulimiaQuestion() { return { baseId: "bulimia", categoryKey: "psych", part: loc("섭식장애","Eating Disorder"), emoji: "🦷", title: loc("폭식증 합병증","Bulimia Complications"), desc: loc(`반복적 자가유발 구토를 하는 폭식증 환자에서 가장 흔한 신체 합병증은?`,`Most common physical complication in bulimia with self-induced vomiting?`), choices: shuffle([{ text: loc("저칼륨혈증·치아 부식·식도염·이하선 비대","Hypokalemia, dental erosion, esophagitis, parotid swelling"), effect: { hp: -3, rep: 22 }, log: loc("정답. 위산 노출과 전해질 손실의 직접 결과.","Correct. Direct result of acid exposure and electrolyte loss.") }, { text: loc("간경화","Liver cirrhosis"), effect: { hp: -25, rep: -15 }, log: loc("주된 합병증이 아닙니다.","Not the main complication.") }, { text: loc("폐렴","Pneumonia"), effect: { hp: -25, rep: -15 }, log: loc("드물게만 흡인성으로.","Only rarely from aspiration.") }, { text: loc("당뇨병","Diabetes"), effect: { hp: -25, rep: -15 }, log: loc("직접 합병증이 아님.","Not a direct complication.") }]) }; }
function generateHeatColdQuestion() { return { baseId: "heatCold", categoryKey: "fundamentals", part: loc("물리치료","Physical Therapy"), emoji: "🌡️", title: loc("온열 vs 한랭 적용","Heat vs Cold Application"), desc: loc(`발목 염좌 직후 24~48시간에 권장되는 적용은?`,`Recommended application in the first 24-48 hours after an ankle sprain?`), choices: shuffle([{ text: loc("한랭 적용(RICE) - 부종·통증 감소","Cold application (RICE) — reduces edema and pain"), effect: { hp: -2, rep: 22 }, log: loc("정답. 급성기엔 한랭, 만성기에 온열.","Correct. Cold acutely, heat for chronic.") }, { text: loc("뜨거운 찜질팩 즉시 적용","Hot pack immediately"), effect: { hp: -28, rep: -20 }, log: loc("부종 악화.","Worsens edema.") }, { text: loc("환부를 강하게 마사지","Vigorously massage the area"), effect: { hp: -32, rep: -22 }, log: loc("출혈·부종 악화.","Worsens bleeding/edema.") }, { text: loc("절대 안정만 24시간","Just strict rest for 24 hours"), effect: { hp: -22, rep: -12 }, log: loc("RICE의 일부지만 부족.","Part of RICE but incomplete.") }]) }; }
function generateCrutchGaitQuestion() { return { baseId: "crutchGait", categoryKey: "fundamentals", part: loc("보행 보조","Mobility Aids"), emoji: "🦯", title: loc("목발 걸음","Crutch Gait"), desc: loc(`한쪽 다리 체중부하 금지 환자에게 적절한 목발 걸음은?`,`Appropriate crutch gait for non-weight-bearing on one leg?`), choices: shuffle([{ text: loc("3점 걸음(Three-point gait)","Three-point gait"), effect: { hp: -2, rep: 22 }, log: loc("정답. 양쪽 목발+성한 다리로 비체중부하 다리 보호.","Correct. Both crutches + good leg protect non-weight-bearing leg.") }, { text: loc("2점 걸음","Two-point gait"), effect: { hp: -22, rep: -12 }, log: loc("부분 체중부하용.","For partial weight-bearing.") }, { text: loc("4점 걸음","Four-point gait"), effect: { hp: -22, rep: -12 }, log: loc("양 다리 모두 부하 가능 시.","When both legs can bear weight.") }, { text: loc("Swing-through","Swing-through"), effect: { hp: -22, rep: -12 }, log: loc("양 다리 모두 마비 시 사용.","Used when both legs paralyzed.") }]) }; }
function generateHandHygieneTypesQuestion() { return { baseId: "handHygieneTypes", categoryKey: "fundamentals", part: loc("감염관리","Infection Control"), emoji: "🧴", title: loc("손위생 - 알코올 vs 비누","Alcohol vs Soap Hand Hygiene"), desc: loc(`다음 중 알코올 손소독제로는 부족하고 반드시 비누+물로 씻어야 하는 상황은?`,`When is soap and water REQUIRED instead of alcohol-based hand rub?`), choices: shuffle([{ text: loc("Clostridium difficile 환자 접촉 후","After contact with C. difficile patient"), effect: { hp: -3, rep: 22 }, log: loc("정답. C. diff 포자는 알코올로 죽지 않음.","Correct. C. diff spores are not killed by alcohol.") }, { text: loc("MRSA 환자 접촉 후","After MRSA contact"), effect: { hp: -22, rep: -12 }, log: loc("알코올 손소독제 효과 있음.","Alcohol rubs effective.") }, { text: loc("일반 환자 접촉 후","After routine patient contact"), effect: { hp: -22, rep: -12 }, log: loc("알코올로 충분.","Alcohol is sufficient.") }, { text: loc("VRE 접촉 후","After VRE contact"), effect: { hp: -22, rep: -12 }, log: loc("알코올로도 효과적.","Alcohol effective.") }]) }; }
function generateROMTypesQuestion() { return { baseId: "romTypes", categoryKey: "fundamentals", part: loc("운동","Mobility"), emoji: "🤸", title: loc("ROM 운동 유형","Range of Motion Types"), desc: loc(`혼수 상태 환자의 관절 구축 예방을 위한 가장 적절한 ROM 운동은?`,`Best ROM exercise to prevent joint contractures in a comatose patient?`), choices: shuffle([{ text: loc("수동적 ROM(Passive ROM) - 간호사가 시행","Passive ROM — performed by nurse"), effect: { hp: -2, rep: 22 }, log: loc("정답. 환자가 협조 못해도 관절 가동성 유지.","Correct. Maintains joint mobility without patient cooperation.") }, { text: loc("능동적 ROM(Active ROM)","Active ROM"), effect: { hp: -28, rep: -20 }, log: loc("환자가 의식이 없어 불가능.","Impossible — patient is unconscious.") }, { text: loc("저항성 운동","Resistance training"), effect: { hp: -25, rep: -15 }, log: loc("협조가 필요한 운동.","Requires cooperation.") }, { text: loc("운동 금지로 보호","Forbid all movement"), effect: { hp: -38, rep: -28 }, log: loc("구축이 빠르게 진행.","Contractures progress rapidly.") }]) }; }
function generateHerdImmunityQuestion() { return { baseId: "herdImmunity", categoryKey: "community", part: loc("예방접종","Immunization"), emoji: "🛡️", title: loc("집단 면역","Herd Immunity"), desc: loc(`집단면역의 가장 중요한 의의는?`,`Most important significance of herd immunity?`), choices: shuffle([{ text: loc("백신 접종 불가능한 사람들도 간접적으로 보호받음","Indirectly protects those who can't be vaccinated"), effect: { hp: -2, rep: 22 }, log: loc("정답. 신생아·면역결핍자 등 취약군 보호.","Correct. Protects vulnerable groups (infants, immunocompromised).") }, { text: loc("백신을 안 맞아도 안전","No need for anyone to vaccinate"), effect: { hp: -32, rep: -22 }, log: loc("높은 접종률 유지가 전제.","Requires high coverage to maintain.") }, { text: loc("개별 환자만 보호","Protects only the individual"), effect: { hp: -28, rep: -20 }, log: loc("집단 차원의 의의가 핵심.","Population-level effect is the point.") }, { text: loc("질병 박멸 즉시 가능","Immediate disease eradication"), effect: { hp: -28, rep: -20 }, log: loc("박멸은 매우 어려움(천연두만 성공).","Eradication is very rare (only smallpox).") }]) }; }
function generateJustCultureQuestion() { return { baseId: "justCulture", categoryKey: "management", part: loc("환자 안전","Patient Safety"), emoji: "⚖️", title: loc("정의 문화 vs 비난 문화","Just Culture vs Blame Culture"), desc: loc(`의료 사고 발생 시 \"정의 문화(Just Culture)\"의 핵심 원칙은?`,`Core principle of \"Just Culture\" when an incident occurs?`), choices: shuffle([{ text: loc("개인 처벌이 아닌 시스템 결함 분석에 초점, 단 의도적·반복적 위반은 책임","Focus on system flaws, not individual blame — but address willful/repeated violations"), effect: { hp: -2, rep: 22 }, log: loc("정답. 보고 문화·학습 문화의 토대.","Correct. Foundation of reporting/learning culture.") }, { text: loc("실수한 개인을 즉시 해고","Immediately fire the individual"), effect: { hp: -38, rep: -28 }, log: loc("비난 문화 - 보고 회피 유발.","Blame culture — discourages reporting.") }, { text: loc("모든 실수를 개인 책임으로 돌림","Make everything personal liability"), effect: { hp: -32, rep: -22 }, log: loc("심리적 안전감 파괴.","Destroys psychological safety.") }, { text: loc("실수를 모두 무시","Ignore all errors"), effect: { hp: -38, rep: -28 }, log: loc("재발 방지 불가.","No prevention of recurrence.") }]) }; }

// ========= 이미지 문제 (인라인 SVG) =========
const ECG_GRID = `<defs><pattern id="g" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#fecaca" stroke-width="0.5"/></pattern></defs><rect width="600" height="120" fill="#fff5f5"/><rect width="600" height="120" fill="url(#g)"/>`;

function generateECGNSRQuestion() {
    const svg = `<svg viewBox="0 0 600 120" xmlns="http://www.w3.org/2000/svg">${ECG_GRID}<polyline fill="none" stroke="#dc2626" stroke-width="1.8" points="0,60 50,60 60,52 70,46 80,52 95,60 105,60 108,65 110,30 113,90 116,60 130,60 155,50 175,45 195,50 200,60 250,60 260,52 270,46 280,52 295,60 305,60 308,65 310,30 313,90 316,60 330,60 355,50 375,45 395,50 400,60 450,60 460,52 470,46 480,52 495,60 505,60 508,65 510,30 513,90 516,60 530,60 555,50 575,45 595,50 600,60"/></svg>`;
    return { baseId: "ecgNsr", categoryKey: "adult", part: loc("ECG 판독","ECG Reading"), emoji: "📈",
        title: loc("리듬 판독 #1","Rhythm Strip #1"),
        desc: loc("아래 ECG 리듬 스트립을 판독하세요.","Interpret the ECG rhythm strip below."),
        image: svg,
        choices: shuffle([
            { text: loc("정상 동성리듬(NSR)","Normal sinus rhythm (NSR)"), effect: { hp: -2, rep: 22 }, log: loc("정답. P-QRS-T가 규칙적이고 P:QRS=1:1.","Correct. Regular P-QRS-T with 1:1 P:QRS ratio.") },
            { text: loc("심방세동","Atrial fibrillation"), effect: { hp: -22, rep: -12 }, log: loc("A-fib는 P파 없이 불규칙.","A-fib has no P waves and is irregular.") },
            { text: loc("심실빈맥","Ventricular tachycardia"), effect: { hp: -25, rep: -15 }, log: loc("V-tach는 wide·규칙적·P 없음.","V-tach has wide QRS and no P waves.") },
            { text: loc("심정지","Asystole"), effect: { hp: -28, rep: -20 }, log: loc("Asystole은 거의 평탄선.","Asystole is a flat line.") }
        ])
    };
}
function generateECGAFibQuestion() {
    const svg = `<svg viewBox="0 0 600 120" xmlns="http://www.w3.org/2000/svg">${ECG_GRID}<polyline fill="none" stroke="#dc2626" stroke-width="1.8" points="0,62 15,58 30,64 45,57 60,63 75,58 90,62 95,40 100,90 105,60 130,60 145,57 160,63 175,58 190,62 205,57 220,63 230,40 235,90 240,60 280,60 295,58 310,64 325,58 340,62 355,58 365,40 370,90 375,60 410,60 425,58 440,63 455,58 470,62 485,58 495,40 500,90 505,60 540,60 555,58 570,63 585,58 600,62"/></svg>`;
    return { baseId: "ecgAFib", categoryKey: "adult", part: loc("ECG 판독","ECG Reading"), emoji: "📊",
        title: loc("리듬 판독 #2","Rhythm Strip #2"),
        desc: loc("아래 ECG 리듬 스트립을 판독하세요. 가장 위험한 동반 합병증은?","Interpret this rhythm. What's the most concerning complication?"),
        image: svg,
        choices: shuffle([
            { text: loc("심방세동 - 좌심방 혈전·뇌졸중 위험","Atrial fibrillation — LA thrombus / stroke risk"), effect: { hp: -3, rep: 22 }, log: loc("정답. P파 없음·불규칙 RR. CHA2DS2-VASc로 항응고.","Correct. No P waves, irregularly irregular. Anticoagulate per CHA2DS2-VASc.") },
            { text: loc("정상 동성리듬","Normal sinus rhythm"), effect: { hp: -25, rep: -15 }, log: loc("불규칙성이 명백.","Clearly irregular.") },
            { text: loc("심실빈맥","Ventricular tachycardia"), effect: { hp: -25, rep: -15 }, log: loc("V-tach는 wide QRS 규칙적.","V-tach has wide regular QRS.") },
            { text: loc("심정지","Asystole"), effect: { hp: -28, rep: -20 }, log: loc("심실파동이 보임.","Ventricular complexes are visible.") }
        ])
    };
}
function generateECGVTachQuestion() {
    const svg = `<svg viewBox="0 0 600 120" xmlns="http://www.w3.org/2000/svg">${ECG_GRID}<polyline fill="none" stroke="#dc2626" stroke-width="2.2" points="0,60 30,60 50,15 70,90 85,40 100,80 130,60 150,60 170,15 190,90 205,40 220,80 250,60 270,60 290,15 310,90 325,40 340,80 370,60 390,60 410,15 430,90 445,40 460,80 490,60 510,60 530,15 550,90 565,40 580,80 600,60"/></svg>`;
    return { baseId: "ecgVTach", categoryKey: "adult", part: loc("ECG 응급","ECG Emergency"), emoji: "⚡",
        title: loc("리듬 판독 #3","Rhythm Strip #3"),
        desc: loc("환자에게 맥박이 없습니다. 아래 리듬을 판독하고 즉시 처치는?","No pulse. Interpret the rhythm and the immediate action?"),
        image: svg,
        choices: shuffle([
            { text: loc("무맥성 심실빈맥(pVT) - 즉각 제세동","Pulseless V-tach — immediate defibrillation"), effect: { hp: -3, rep: 22 }, log: loc("정답. 무맥성 VT/VF는 충격 가능 리듬.","Correct. Pulseless VT/VF are shockable rhythms.") },
            { text: loc("정상 동성리듬·관찰","Normal sinus rhythm — observe"), effect: { hp: -45, rep: -32 }, log: loc("Wide·규칙적 - V-tach.","Wide and regular — V-tach.") },
            { text: loc("심방세동·항응고제","Atrial fibrillation — anticoagulate"), effect: { hp: -45, rep: -32 }, log: loc("진단 오류 - 응급을 놓침.","Wrong dx — misses emergency.") },
            { text: loc("Atropine만 투여","Atropine only"), effect: { hp: -42, rep: -30 }, log: loc("Atropine은 서맥용.","Atropine is for bradycardia.") }
        ])
    };
}
function generateECGAsystoleQuestion() {
    const svg = `<svg viewBox="0 0 600 120" xmlns="http://www.w3.org/2000/svg">${ECG_GRID}<polyline fill="none" stroke="#dc2626" stroke-width="1.8" points="0,60 60,60 120,61 180,59 240,60 300,60 360,61 420,59 480,60 540,60 600,60"/></svg>`;
    return { baseId: "ecgAsystole", categoryKey: "adult", part: loc("ECG 응급","ECG Emergency"), emoji: "💀",
        title: loc("리듬 판독 #4","Rhythm Strip #4"),
        desc: loc("아래 리듬을 판독하고 즉시 처치는?","Interpret this rhythm and the immediate action?"),
        image: svg,
        choices: shuffle([
            { text: loc("심정지(Asystole) - 고품질 CPR + Epinephrine, 충격 금기","Asystole — high-quality CPR + epinephrine, NO shock"), effect: { hp: -3, rep: 22 }, log: loc("정답. Asystole은 충격 불가능 리듬.","Correct. Asystole is a non-shockable rhythm.") },
            { text: loc("즉시 제세동","Immediate defibrillation"), effect: { hp: -45, rep: -32 }, log: loc("Asystole은 충격 금기.","Asystole is non-shockable.") },
            { text: loc("정상 - 관찰","Normal — observe"), effect: { hp: -50, rep: -38 }, log: loc("심정지 응급입니다.","Cardiac arrest emergency.") },
            { text: loc("Atropine만으로 회복 시도","Atropine alone for resuscitation"), effect: { hp: -38, rep: -28 }, log: loc("Atropine은 서맥용.","Atropine is for bradycardia.") }
        ])
    };
}
function generateTriageColorQuestion() {
    const svg = `<svg viewBox="0 0 600 120" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="150" height="120" fill="#dc2626"/><rect x="150" y="0" width="150" height="120" fill="#facc15"/><rect x="300" y="0" width="150" height="120" fill="#16a34a"/><rect x="450" y="0" width="150" height="120" fill="#1f2937"/><text x="75" y="55" text-anchor="middle" fill="white" font-size="22" font-weight="800">RED</text><text x="75" y="80" text-anchor="middle" fill="white" font-size="13">${loc("긴급","Immediate")}</text><text x="225" y="55" text-anchor="middle" fill="#1e293b" font-size="22" font-weight="800">YELLOW</text><text x="225" y="80" text-anchor="middle" fill="#1e293b" font-size="13">${loc("응급","Delayed")}</text><text x="375" y="55" text-anchor="middle" fill="white" font-size="22" font-weight="800">GREEN</text><text x="375" y="80" text-anchor="middle" fill="white" font-size="13">${loc("비응급","Minor")}</text><text x="525" y="55" text-anchor="middle" fill="white" font-size="22" font-weight="800">BLACK</text><text x="525" y="80" text-anchor="middle" fill="white" font-size="13">${loc("사망/지연","Expectant")}</text></svg>`;
    return { baseId: "triageColor", categoryKey: "community", part: loc("재난 트리아지","Disaster Triage"), emoji: "🚦",
        title: loc("START 색상 매칭","START Color Matching"),
        desc: loc("호흡 30/min 이상이거나 모세혈관 재충전 2초 이상 또는 명령 따르기 불가능한 환자의 색깔은?","Patient with RR>30, capillary refill >2 sec, or unable to follow commands. Which color?"),
        image: svg,
        choices: shuffle([
            { text: loc("적색(Red) - 즉시 처치","Red — Immediate"), effect: { hp: -3, rep: 22 }, log: loc("정답. RPM(Respiration·Pulse·Mental status) 중 하나라도 비정상이면 적색.","Correct. If any of RPM is abnormal → Red.") },
            { text: loc("황색(Yellow) - 지연","Yellow — Delayed"), effect: { hp: -22, rep: -12 }, log: loc("황색은 RPM 정상이지만 보행 불가.","Yellow = RPM normal but can't walk.") },
            { text: loc("녹색(Green) - 경증","Green — Minor"), effect: { hp: -28, rep: -20 }, log: loc("녹색은 보행 가능한 환자.","Green = walking wounded.") },
            { text: loc("흑색(Black) - 사망/지연","Black — Expectant"), effect: { hp: -25, rep: -15 }, log: loc("흑색은 기도 후에도 무호흡.","Black = apneic after airway opening.") }
        ])
    };
}
function generateRuleOfNinesQuestion() {
    const svg = `<svg viewBox="0 0 600 240" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="240" fill="#fff5f0"/><g transform="translate(180,20)"><ellipse cx="120" cy="20" rx="22" ry="22" fill="#fde68a" stroke="#92400e" stroke-width="1.5"/><text x="120" y="25" text-anchor="middle" font-size="11" font-weight="700">9%</text><rect x="78" y="42" width="84" height="80" fill="#fecaca" stroke="#991b1b" stroke-width="1.5" rx="4"/><text x="120" y="86" text-anchor="middle" font-size="13" font-weight="800">${loc("앞 18%","Ant 18%")}</text><rect x="50" y="50" width="28" height="64" fill="#fde68a" stroke="#92400e" stroke-width="1.5" rx="4"/><text x="64" y="85" text-anchor="middle" font-size="11" font-weight="700">9%</text><rect x="162" y="50" width="28" height="64" fill="#fde68a" stroke="#92400e" stroke-width="1.5" rx="4"/><text x="176" y="85" text-anchor="middle" font-size="11" font-weight="700">9%</text><rect x="80" y="124" width="36" height="100" fill="#fed7aa" stroke="#9a3412" stroke-width="1.5" rx="4"/><text x="98" y="180" text-anchor="middle" font-size="11" font-weight="700">18%</text><rect x="124" y="124" width="36" height="100" fill="#fed7aa" stroke="#9a3412" stroke-width="1.5" rx="4"/><text x="142" y="180" text-anchor="middle" font-size="11" font-weight="700">18%</text><text x="120" y="-5" text-anchor="middle" font-size="11" fill="#1e293b" font-weight="600">${loc("성인 9의 법칙(앞면)","Rule of Nines (Anterior)")}</text></g></svg>`;
    return { baseId: "ruleOfNinesImg", categoryKey: "adult", part: loc("화상 면적","Burn TBSA"), emoji: "🔥",
        title: loc("9의 법칙 - 화상 계산","Rule of Nines"),
        desc: loc("그림에서 양쪽 다리 앞면 전체에 화상을 입었다면 총 %TBSA는?","If burn covers anterior surfaces of both entire legs, total %TBSA?"),
        image: svg,
        choices: shuffle([
            { text: loc("18% (양쪽 다리 앞면 9% × 2)","18% (anterior of each leg 9% × 2)"), effect: { hp: -2, rep: 22 }, log: loc("정답. 한 다리 전체=18%, 앞면만=9% × 2 = 18%.","Correct. Whole leg=18%, anterior only=9% × 2 = 18%.") },
            { text: loc("36% (양쪽 다리 전체 18% × 2)","36% (whole both legs)"), effect: { hp: -28, rep: -18 }, log: loc("앞면만이라고 했습니다.","Question says anterior only.") },
            { text: loc("9% (한쪽 다리 앞면)","9% (one leg anterior)"), effect: { hp: -25, rep: -15 }, log: loc("양쪽이라고 했습니다.","Question says both legs.") },
            { text: loc("27% (양쪽 다리 + 회음부 1%)","27% (both legs + perineum 1%)"), effect: { hp: -25, rep: -15 }, log: loc("계산이 맞지 않습니다.","Math doesn't add up.") }
        ])
    };
}
function generateHeartChambersQuestion() {
    const svg = `<svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="240" fill="#fff5f5"/><path d="M 100 50 Q 80 80 90 130 L 110 200 Q 130 220 160 200 Q 200 230 240 200 Q 270 220 290 200 L 310 130 Q 320 80 300 50 Q 280 30 240 40 Q 200 30 160 40 Q 120 30 100 50 Z" fill="#fee2e2" stroke="#991b1b" stroke-width="2"/><line x1="200" y1="40" x2="200" y2="220" stroke="#991b1b" stroke-width="2"/><line x1="100" y1="120" x2="200" y2="120" stroke="#991b1b" stroke-width="2"/><line x1="200" y1="120" x2="310" y2="120" stroke="#991b1b" stroke-width="2"/><text x="140" y="90" text-anchor="middle" font-size="13" font-weight="700">A</text><text x="265" y="90" text-anchor="middle" font-size="13" font-weight="700">B</text><text x="140" y="170" text-anchor="middle" font-size="13" font-weight="700">C</text><text x="265" y="170" text-anchor="middle" font-size="13" font-weight="700">D</text><text x="200" y="20" text-anchor="middle" font-size="11" fill="#1e293b" font-weight="600">${loc("심장 4개 방","Heart 4 Chambers")}</text></svg>`;
    return { baseId: "heartChambers", categoryKey: "adult", part: loc("해부학","Anatomy"), emoji: "🫀",
        title: loc("심장 챔버","Heart Chambers"),
        desc: loc("전신 순환의 동맥혈을 펌프하는 가장 두꺼운 벽을 가진 챔버는 (A·B·C·D 중)?","Which chamber (A/B/C/D) pumps oxygenated blood to the body and has the thickest wall?"),
        image: svg,
        choices: shuffle([
            { text: loc("D (좌심실, Left Ventricle)","D (Left Ventricle)"), effect: { hp: -2, rep: 22 }, log: loc("정답. 좌심실 = 환자 기준 좌측·아래·체순환 펌프.","Correct. LV = patient's left, lower, systemic pump.") },
            { text: loc("A (우심방)","A (Right Atrium)"), effect: { hp: -22, rep: -12 }, log: loc("RA는 정맥혈을 받음.","RA receives venous blood.") },
            { text: loc("B (좌심방)","B (Left Atrium)"), effect: { hp: -22, rep: -12 }, log: loc("LA는 폐정맥혈을 받음.","LA receives pulmonary venous blood.") },
            { text: loc("C (우심실)","C (Right Ventricle)"), effect: { hp: -22, rep: -12 }, log: loc("RV는 폐순환 펌프(저압).","RV pumps to lungs (low pressure).") }
        ])
    };
}
function generatePositionDiagramQuestion() {
    const svg = `<svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="200" fill="#f0f9ff"/><g transform="translate(20,20)"><rect x="0" y="100" width="160" height="14" fill="#94a3b8"/><line x1="0" y1="100" x2="160" y2="40" stroke="#1e293b" stroke-width="3"/><circle cx="155" cy="42" r="14" fill="#fecaca" stroke="#991b1b" stroke-width="1.5"/><text x="80" y="155" text-anchor="middle" font-size="13" font-weight="700">A</text><text x="80" y="175" text-anchor="middle" font-size="11" fill="#64748b">${loc("60-90°","60-90°")}</text></g><g transform="translate(220,20)"><rect x="0" y="100" width="160" height="14" fill="#94a3b8"/><line x1="0" y1="100" x2="160" y2="68" stroke="#1e293b" stroke-width="3"/><circle cx="155" cy="70" r="14" fill="#fecaca" stroke="#991b1b" stroke-width="1.5"/><text x="80" y="155" text-anchor="middle" font-size="13" font-weight="700">B</text><text x="80" y="175" text-anchor="middle" font-size="11" fill="#64748b">${loc("30-45°","30-45°")}</text></g><g transform="translate(420,20)"><rect x="0" y="100" width="160" height="14" fill="#94a3b8"/><line x1="0" y1="100" x2="160" y2="120" stroke="#1e293b" stroke-width="3"/><circle cx="155" cy="122" r="14" fill="#fecaca" stroke="#991b1b" stroke-width="1.5"/><text x="80" y="155" text-anchor="middle" font-size="13" font-weight="700">C</text><text x="80" y="175" text-anchor="middle" font-size="11" fill="#64748b">${loc("머리 ↓","Head ↓")}</text></g></svg>`;
    return { baseId: "positionDiagram", categoryKey: "fundamentals", part: loc("체위","Positioning"), emoji: "🛏️",
        title: loc("체위 식별","Identify the Position"),
        desc: loc("그림 C는 머리가 발보다 낮은 자세입니다. 어떤 체위인가요?","Diagram C: head lower than feet. Which position?"),
        image: svg,
        choices: shuffle([
            { text: loc("Trendelenburg - 쇼크 시 (현재는 권장 안 함)","Trendelenburg — for shock (no longer recommended)"), effect: { hp: -2, rep: 22 }, log: loc("정답. 머리↓·발↑. 현대에는 modified만 제한적 사용.","Correct. Head down, feet up. Modern use is limited.") },
            { text: loc("High Fowler's - 호흡곤란","High Fowler's — for dyspnea"), effect: { hp: -22, rep: -12 }, log: loc("그림 A입니다.","That's diagram A.") },
            { text: loc("Semi-Fowler's","Semi-Fowler's"), effect: { hp: -22, rep: -12 }, log: loc("그림 B입니다.","That's diagram B.") },
            { text: loc("Sims' - 좌측 측와","Sims' (left lateral)"), effect: { hp: -22, rep: -12 }, log: loc("Sims는 옆으로 누운 자세.","Sims is a side-lying position.") }
        ])
    };
}
// ========= 배치 5: 추가 30문제 =========
function generateMSQuestion() { return { baseId: "ms", categoryKey: "adult", part: loc("신경계","Neuro"), emoji: "🦴", title: loc("다발성경화증","Multiple Sclerosis"), desc: loc("재발-완화형 다발성경화증 환자에게 가장 적절한 환경 교육은?","Best environmental teaching for relapsing-remitting MS?"), choices: shuffle([{ text: loc("열·자외선·과로 회피, 시원한 환경 유지","Avoid heat, UV, overexertion; maintain cool environment"), effect: { hp: -2, rep: 22 }, log: loc("정답. Uhthoff 현상 - 열로 증상 악화.","Correct. Uhthoff phenomenon — heat worsens symptoms.") }, { text: loc("따뜻한 사우나로 근육 이완","Warm sauna to relax muscles"), effect: { hp: -32, rep: -22 }, log: loc("증상 악화 위험.","Worsens symptoms.") }, { text: loc("절대 안정으로 진행 차단","Strict bed rest to halt progression"), effect: { hp: -25, rep: -15 }, log: loc("부동은 근위축 가속.","Immobility accelerates atrophy.") }, { text: loc("강한 운동을 매일 강제","Force vigorous daily exercise"), effect: { hp: -28, rep: -20 }, log: loc("과로는 악화 유발.","Overexertion triggers flare.") }]) }; }
function generateParkinsonQuestion() { return { baseId: "parkinson", categoryKey: "adult", part: loc("신경계","Neuro"), emoji: "🧓", title: loc("파킨슨병 약물","Parkinson's Drugs"), desc: loc("Levodopa-Carbidopa 복용 환자에게 권장되지 않는 식이는?","Diet to avoid for a patient on Levodopa-Carbidopa?"), choices: shuffle([{ text: loc("고단백 식이를 약물과 동시 섭취","High-protein meal taken simultaneously with the drug"), effect: { hp: -3, rep: 22 }, log: loc("정답. 단백질이 흡수를 방해 - 시간 분리.","Correct. Protein impairs absorption — separate timing.") }, { text: loc("저단백 균형 식이","Balanced low-protein diet"), effect: { hp: -22, rep: -12 }, log: loc("이는 권장 사항.","Actually recommended.") }, { text: loc("충분한 수분 섭취","Adequate hydration"), effect: { hp: -22, rep: -12 }, log: loc("권장 사항.","Recommended.") }, { text: loc("규칙적 식사 시간","Regular meal schedule"), effect: { hp: -22, rep: -12 }, log: loc("권장 사항.","Recommended.") }]) }; }
function generateAlzheimerQuestion() { return { baseId: "alzheimer", categoryKey: "psych", part: loc("치매","Dementia"), emoji: "🧓", title: loc("알츠하이머 단계","Alzheimer's Stages"), desc: loc("최근 친한 친구의 이름을 잊고 길을 잃는 정도의 환자는 어느 단계인가?","Patient forgets close friend's names and gets lost. Which stage?"), choices: shuffle([{ text: loc("중기(Moderate) - 일상생활 보조 필요","Moderate stage — ADL assistance required"), effect: { hp: -2, rep: 22 }, log: loc("정답. 중기는 기억력 저하·언어 어려움·길 잃음.","Correct. Moderate: memory loss, language difficulty, getting lost.") }, { text: loc("초기(Mild)","Mild stage"), effect: { hp: -22, rep: -12 }, log: loc("초기는 가벼운 건망증만.","Mild: minor forgetfulness.") }, { text: loc("말기(Severe)","Severe stage"), effect: { hp: -22, rep: -12 }, log: loc("말기는 의사소통 거의 불가·전적 의존.","Severe: minimal communication, total dependence.") }, { text: loc("정상 노화","Normal aging"), effect: { hp: -28, rep: -20 }, log: loc("길 잃음·이름 망각은 정상이 아님.","Getting lost/forgetting names isn't normal.") }]) }; }
function generateDVTQuestion() { return { baseId: "dvt", categoryKey: "adult", part: loc("혈관","Vascular"), emoji: "🦵", title: loc("심부정맥혈전증","Deep Vein Thrombosis"), desc: loc("수술 후 한쪽 종아리의 발적·부종·온감을 보이는 환자에 대한 가장 중요한 예방·중재는?","Postop patient: redness, swelling, warmth in one calf. Most important prevention/intervention?"), choices: shuffle([{ text: loc("조기 보행 + 항응고제 + 압박 스타킹","Early ambulation + anticoagulants + compression stockings"), effect: { hp: -3, rep: 22 }, log: loc("정답. Virchow 3요소 차단 - 정체·과응고·내피 손상.","Correct. Targets Virchow's triad — stasis, hypercoagulability, endothelial injury.") }, { text: loc("환부를 강하게 마사지","Vigorously massage the area"), effect: { hp: -45, rep: -32 }, log: loc("절대 금기 - 색전증 위험.","Contraindicated — embolism risk.") }, { text: loc("절대 안정만 1주일","Strict bed rest for 1 week"), effect: { hp: -32, rep: -22 }, log: loc("정체 악화.","Worsens stasis.") }, { text: loc("뜨거운 찜질만","Hot pack only"), effect: { hp: -25, rep: -15 }, log: loc("색전증 위험을 놓침.","Misses embolism risk.") }]) }; }
function generateAirEmbolismQuestion() { return { baseId: "airEmbolism", categoryKey: "adult", part: loc("응급","Emergency"), emoji: "💨", title: loc("공기색전증","Air Embolism"), desc: loc("중심정맥관 사용 중 갑작스러운 호흡곤란·저혈압·청색증 발생. 1차 응급 처치는?","Sudden dyspnea, hypotension, cyanosis during CVC use. First emergency action?"), choices: shuffle([{ text: loc("좌측 측와위 + Trendelenburg + 100% 산소","Left lateral + Trendelenburg + 100% O2"), effect: { hp: -3, rep: 22 }, log: loc("정답. 공기를 우심실 첨부에 가두어 폐색전 예방.","Correct. Traps air at RV apex, preventing pulmonary embolism.") }, { text: loc("우측 측와위 + 좌상","Right lateral + Fowler's"), effect: { hp: -38, rep: -28 }, log: loc("공기가 폐로 이동 - 위험.","Air moves to lung — dangerous.") }, { text: loc("Trendelenburg만","Trendelenburg only"), effect: { hp: -28, rep: -20 }, log: loc("측와위가 추가로 필요.","Lateral position also needed.") }, { text: loc("앙와위로 대기","Supine and wait"), effect: { hp: -45, rep: -32 }, log: loc("응급 처치 부재.","No emergency action.") }]) }; }
function generateLungCancerQuestion() { return { baseId: "lungCancer", categoryKey: "adult", part: loc("종양","Oncology"), emoji: "🚭", title: loc("폐암 위험인자","Lung Cancer Risk Factors"), desc: loc("폐암 발생의 가장 주요한 위험인자는?","Single most important risk factor for lung cancer?"), choices: shuffle([{ text: loc("흡연(직접 + 간접)","Smoking (active + secondhand)"), effect: { hp: -2, rep: 22 }, log: loc("정답. 폐암의 약 85%가 흡연 관련.","Correct. ~85% of lung cancers are smoking-related.") }, { text: loc("음주","Alcohol use"), effect: { hp: -22, rep: -12 }, log: loc("간·식도암과 연관.","Linked to liver/esophageal cancer.") }, { text: loc("커피 섭취","Coffee consumption"), effect: { hp: -25, rep: -15 }, log: loc("관련 없음.","Unrelated.") }, { text: loc("적은 운동","Lack of exercise"), effect: { hp: -22, rep: -12 }, log: loc("간접 영향만.","Indirect at best.") }]) }; }
function generateProstateCancerQuestion() { return { baseId: "prostateCancer", categoryKey: "adult", part: loc("비뇨기","Urology"), emoji: "🧬", title: loc("전립선암 선별","Prostate Cancer Screening"), desc: loc("50세 남성의 전립선암 선별검사로 적절한 것은?","Appropriate prostate cancer screening for a 50-year-old man?"), choices: shuffle([{ text: loc("PSA 혈액검사 + 직장수지검사(DRE)","PSA blood test + digital rectal exam (DRE)"), effect: { hp: -2, rep: 22 }, log: loc("정답. USPSTF는 55-69세 공유의사결정 권장.","Correct. USPSTF recommends shared decision-making 55-69.") }, { text: loc("CT 전체 복부","Full abdominal CT"), effect: { hp: -25, rep: -15 }, log: loc("선별검사가 아님.","Not a screening test.") }, { text: loc("MRI 골반","Pelvic MRI"), effect: { hp: -25, rep: -15 }, log: loc("선별이 아닌 진단검사.","Diagnostic, not screening.") }, { text: loc("결장경검사","Colonoscopy"), effect: { hp: -28, rep: -20 }, log: loc("결장암 선별.","For colon cancer.") }]) }; }
function generateBreastSurgeryQuestion() { return { baseId: "breastSurgery", categoryKey: "adult", part: loc("종양","Oncology"), emoji: "🎗️", title: loc("유방절제 후 림프부종 예방","Post-Mastectomy Lymphedema"), desc: loc("유방 절제술 후 환측 팔의 림프부종 예방을 위한 핵심 교육은?","Key teaching to prevent affected-arm lymphedema after mastectomy?"), choices: shuffle([{ text: loc("환측 팔로 채혈·혈압측정·정맥주사·무거운 물건 들기 금지","Avoid blood draws, BP, IV, and heavy lifting on the affected arm"), effect: { hp: -2, rep: 22 }, log: loc("정답. 림프 흐름 보호가 핵심.","Correct. Protect lymphatic flow.") }, { text: loc("환측 팔 마사지를 강하게 자주","Frequent vigorous massage of the affected arm"), effect: { hp: -28, rep: -20 }, log: loc("부드러운 림프 마사지만 권장.","Only gentle lymphatic massage.") }, { text: loc("환측을 완전 부동","Complete immobilization"), effect: { hp: -28, rep: -20 }, log: loc("점진적 ROM 권장.","Gradual ROM is recommended.") }, { text: loc("강한 햇빛 노출 권장","Encourage strong sun exposure"), effect: { hp: -28, rep: -20 }, log: loc("화상·감염 위험 증가.","Increases burn/infection risk.") }]) }; }
function generateHIVTreatmentQuestion() { return { baseId: "hivTreatment", categoryKey: "adult", part: loc("감염","Infection"), emoji: "💊", title: loc("HIV 항레트로바이러스 치료","HIV Antiretroviral Therapy"), desc: loc("HIV 환자의 ART 치료 순응도가 가장 중요한 이유는?","Why is ART adherence critical for HIV patients?"), choices: shuffle([{ text: loc("순응도 저하 시 약물 내성 변이가 빠르게 발생","Poor adherence rapidly creates drug-resistant variants"), effect: { hp: -3, rep: 22 }, log: loc("정답. 내성 발생 시 치료 옵션이 줄어듦.","Correct. Resistance limits future options.") }, { text: loc("간호사가 평가받기 위해서","To impress the nurse"), effect: { hp: -32, rep: -22 }, log: loc("부적절한 답.","Inappropriate.") }, { text: loc("보험 청구를 위해","For insurance billing"), effect: { hp: -28, rep: -20 }, log: loc("주된 이유 아님.","Not the primary reason.") }, { text: loc("HIV는 곧 완치 가능하므로","Because HIV will soon be curable"), effect: { hp: -28, rep: -20 }, log: loc("아직 완치는 어려움.","Cure isn't yet routine.") }]) }; }
function generateAcetaminophenODQuestion() { return { baseId: "tylenolOD", categoryKey: "adult", part: loc("중독","Toxicology"), emoji: "💊", title: loc("아세트아미노펜 과량","Acetaminophen Overdose"), desc: loc("과량 복용 후 4~24시간 무증상기인 아세트아미노펜 중독의 해독제는?","Antidote for acetaminophen toxicity (silent phase 4-24h)?"), choices: shuffle([{ text: loc("N-Acetylcysteine (NAC)","N-Acetylcysteine (NAC)"), effect: { hp: -3, rep: 22 }, log: loc("정답. 8~10시간 이내가 가장 효과적.","Correct. Most effective within 8-10 hours.") }, { text: loc("Naloxone","Naloxone"), effect: { hp: -32, rep: -22 }, log: loc("아편제 길항제.","Opioid antagonist.") }, { text: loc("Flumazenil","Flumazenil"), effect: { hp: -32, rep: -22 }, log: loc("벤조 길항제.","Benzodiazepine antagonist.") }, { text: loc("Atropine","Atropine"), effect: { hp: -32, rep: -22 }, log: loc("콜린성/유기인제 중독.","For cholinergic poisoning.") }]) }; }
function generateOpioidConstipationQuestion() { return { baseId: "opioidConstipation", categoryKey: "adult", part: loc("호스피스/완화","Hospice/Palliative"), emoji: "💊", title: loc("아편제 변비","Opioid-Induced Constipation"), desc: loc("호스피스 환자가 모르핀 복용 중 변비가 심해졌다. 가장 적절한 중재는?","Hospice patient on morphine has worsening constipation. Best intervention?"), choices: shuffle([{ text: loc("아편제 시작과 동시에 자극성 완하제(Senna 등) 정기 투여","Start a stimulant laxative (e.g., Senna) at the same time as the opioid"), effect: { hp: -2, rep: 22 }, log: loc("정답. 아편제 변비는 예방이 핵심.","Correct. Opioid constipation needs prophylaxis.") }, { text: loc("아편제 즉시 중단","Stop opioids immediately"), effect: { hp: -32, rep: -22 }, log: loc("호스피스 환자의 통증을 방치.","Leaves the patient in pain.") }, { text: loc("완화제 절대 금지","Forbid all laxatives"), effect: { hp: -32, rep: -22 }, log: loc("필요한 처치를 막음.","Blocks needed care.") }, { text: loc("관찰만","Just observe"), effect: { hp: -22, rep: -12 }, log: loc("변비는 적극 관리 필요.","Constipation needs active management.") }]) }; }
function generatePCAQuestion() { return { baseId: "pca", categoryKey: "adult", part: loc("통증","Pain Management"), emoji: "💊", title: loc("PCA 펌프 안전","PCA Pump Safety"), desc: loc("환자조절진통(PCA) 사용 시 절대 금기인 행위는?","What is absolutely prohibited with patient-controlled analgesia (PCA)?"), choices: shuffle([{ text: loc("환자 외 가족·간호사가 대신 버튼을 누름(PCA-by-proxy)","PCA by proxy — family or nurse pressing the button"), effect: { hp: -3, rep: 22 }, log: loc("정답. 호흡억제 위험으로 절대 금기.","Correct. Absolutely contraindicated — respiratory depression.") }, { text: loc("환자 본인이 통증 시 버튼을 누름","Patient self-administering for pain"), effect: { hp: -22, rep: -12 }, log: loc("표준 사용법.","Standard use.") }, { text: loc("호흡수·진정 점수 모니터링","Monitoring RR and sedation score"), effect: { hp: -22, rep: -12 }, log: loc("권장 사항.","Recommended.") }, { text: loc("락아웃 시간 설정","Setting lockout intervals"), effect: { hp: -22, rep: -12 }, log: loc("표준 안전 기능.","Standard safety feature.") }]) }; }
function generateAdrenalCortexQuestion() { return { baseId: "cushing", categoryKey: "adult", part: loc("내분비","Endocrine"), emoji: "🌕", title: loc("쿠싱 증후군","Cushing's Syndrome"), desc: loc("월상안·중심성 비만·수포·고혈당·고혈압을 보이는 환자의 진단은?","Moon face, central obesity, striae, hyperglycemia, HTN. Diagnosis?"), choices: shuffle([{ text: loc("쿠싱 증후군 - 코르티솔 과잉","Cushing's syndrome — cortisol excess"), effect: { hp: -2, rep: 22 }, log: loc("정답. 외인성 스테로이드 또는 종양에 의한 코르티솔 과잉.","Correct. Cortisol excess from exogenous steroids or tumor.") }, { text: loc("애디슨병","Addison's disease"), effect: { hp: -22, rep: -12 }, log: loc("코르티솔 결핍 - 반대 증상.","Cortisol deficiency — opposite picture.") }, { text: loc("갑상선기능항진증","Hyperthyroidism"), effect: { hp: -22, rep: -12 }, log: loc("체중 감소 등 다른 패턴.","Different pattern (weight loss).") }, { text: loc("당뇨병","Diabetes mellitus"), effect: { hp: -22, rep: -12 }, log: loc("월상안·수포는 DM 특징 아님.","Not characteristic of DM alone.") }]) }; }
function generateAddisonChronicQuestion() { return { baseId: "addisonChronic", categoryKey: "adult", part: loc("내분비","Endocrine"), emoji: "🟫", title: loc("애디슨병 임상양상","Addison's Disease Findings"), desc: loc("애디슨병 환자에서 가장 특징적인 피부 소견은?","Most characteristic skin finding in Addison's disease?"), choices: shuffle([{ text: loc("피부·점막 색소침착(Bronze pigmentation)","Bronze pigmentation of skin and mucosa"), effect: { hp: -2, rep: 22 }, log: loc("정답. ACTH 상승이 멜라닌 자극.","Correct. Elevated ACTH stimulates melanin.") }, { text: loc("월상안","Moon face"), effect: { hp: -22, rep: -12 }, log: loc("쿠싱의 특징.","Feature of Cushing's.") }, { text: loc("황달","Jaundice"), effect: { hp: -25, rep: -15 }, log: loc("간담도 질환.","Hepatobiliary.") }, { text: loc("청색증","Cyanosis"), effect: { hp: -25, rep: -15 }, log: loc("저산소증의 징후.","Sign of hypoxia.") }]) }; }
function generateThyroidNodeQuestion() { return { baseId: "thyroidNode", categoryKey: "adult", part: loc("내분비","Endocrine"), emoji: "💎", title: loc("갑상선 결절","Thyroid Nodule"), desc: loc("갑상선 결절에서 악성 가능성이 가장 높은 임상 단서는?","Clinical clue most suggestive of malignancy in a thyroid nodule?"), choices: shuffle([{ text: loc("단단하고 고정된 결절 + 경부 림프절 종대","Hard, fixed nodule + cervical lymphadenopathy"), effect: { hp: -2, rep: 22 }, log: loc("정답. 단단·고정·림프절 종대가 적색 깃발.","Correct. Hard/fixed/lymphadenopathy = red flags.") }, { text: loc("부드럽고 움직이는 결절","Soft, mobile nodule"), effect: { hp: -22, rep: -12 }, log: loc("양성을 시사.","Suggests benign.") }, { text: loc("결절 자체가 작음","Small size of nodule"), effect: { hp: -22, rep: -12 }, log: loc("크기만으로는 결정되지 않음.","Size alone isn't determinative.") }, { text: loc("결절이 일정","Stable in size"), effect: { hp: -22, rep: -12 }, log: loc("성장 속도가 더 중요.","Growth rate matters more.") }]) }; }
function generateGoutAcuteQuestion() { return { baseId: "goutAcute", categoryKey: "adult", part: loc("근골격","Musculoskeletal"), emoji: "🦶", title: loc("통풍 급성기 1차약","Acute Gout 1st-Line"), desc: loc("급성 통풍 발작 환자에게 1차로 사용되는 약물은?","First-line drug for an acute gout attack?"), choices: shuffle([{ text: loc("NSAIDs(예: Indomethacin) 또는 Colchicine","NSAIDs (e.g., indomethacin) or colchicine"), effect: { hp: -2, rep: 22 }, log: loc("정답. 급성기엔 항염증제, Allopurinol은 예방용.","Correct. Anti-inflammatory acutely; allopurinol for prevention.") }, { text: loc("Allopurinol 즉시 시작","Start allopurinol immediately"), effect: { hp: -32, rep: -22 }, log: loc("급성기 시작은 발작 악화.","Starting in acute attack worsens it.") }, { text: loc("아세트아미노펜만","Acetaminophen only"), effect: { hp: -25, rep: -15 }, log: loc("항염증 효과 부족.","Lacks anti-inflammatory effect.") }, { text: loc("관찰만","Just observe"), effect: { hp: -28, rep: -20 }, log: loc("심한 통증 - 처치 필요.","Severe pain — treat.") }]) }; }
function generateOsteomyelitisQuestion() { return { baseId: "osteomyelitis", categoryKey: "adult", part: loc("근골격","Musculoskeletal"), emoji: "🦴", title: loc("골수염 치료","Osteomyelitis Treatment"), desc: loc("골수염의 표준 치료 기간은?","Standard duration of osteomyelitis treatment?"), choices: shuffle([{ text: loc("정맥 항생제 4~6주 이상","IV antibiotics for 4-6 weeks or longer"), effect: { hp: -2, rep: 22 }, log: loc("정답. 골 침투가 어려워 장기 치료 필요.","Correct. Poor bone penetration requires prolonged therapy.") }, { text: loc("경구 3일","Oral 3 days"), effect: { hp: -32, rep: -22 }, log: loc("재발 위험 매우 높음.","Very high relapse risk.") }, { text: loc("주사 1회","Single injection"), effect: { hp: -32, rep: -22 }, log: loc("부적절.","Inadequate.") }, { text: loc("관찰만","Just observe"), effect: { hp: -38, rep: -28 }, log: loc("패혈증·확산 위험.","Risk of sepsis/spread.") }]) }; }
function generateRespAcidosisCompQuestion() { return { baseId: "respAcidosisComp", categoryKey: "adult", part: loc("산-염기","Acid-Base"), emoji: "⚗️", title: loc("호흡성 산증 보상","Respiratory Acidosis Compensation"), desc: loc("만성 호흡성 산증에서 보상 기전은?","Compensation mechanism in chronic respiratory acidosis?"), choices: shuffle([{ text: loc("신장에서 HCO3- 재흡수 증가·H+ 배출","Kidney increases HCO3- reabsorption and excretes H+"), effect: { hp: -2, rep: 22 }, log: loc("정답. 만성기엔 신장 보상이 주.","Correct. Renal compensation predominates in chronic.") }, { text: loc("호흡으로 더 많은 CO2 배출","Lungs blow off more CO2"), effect: { hp: -28, rep: -20 }, log: loc("문제 자체가 호흡 기능 저하.","The problem IS respiratory failure.") }, { text: loc("간이 단백질 분해","Liver breaks down proteins"), effect: { hp: -28, rep: -20 }, log: loc("산-염기 보상과 무관.","Unrelated to acid-base.") }, { text: loc("심장이 과분극","Heart hyperpolarization"), effect: { hp: -28, rep: -20 }, log: loc("관련 없음.","Unrelated.") }]) }; }
function generateSeizurePrecautionsQuestion() { return { baseId: "seizurePrec", categoryKey: "adult", part: loc("신경계","Neuro"), emoji: "⚡", title: loc("발작 환자 안전","Seizure Precautions"), desc: loc("발작 발생 시 가장 우선되는 안전 조치는?","Top priority safety action during a seizure?"), choices: shuffle([{ text: loc("환자 옆으로 눕히고 머리 보호, 시간 측정","Side-lying position, protect head, time the seizure"), effect: { hp: -2, rep: 22 }, log: loc("정답. 흡인 예방 + 손상 예방.","Correct. Prevents aspiration + injury.") }, { text: loc("입에 압설자나 손가락 넣기","Insert a tongue blade or fingers"), effect: { hp: -38, rep: -28 }, log: loc("절대 금기 - 치아 손상·기도 폐쇄.","Absolutely contraindicated — tooth/airway damage.") }, { text: loc("환자를 강하게 잡아 움직임 차단","Restrain to stop movements"), effect: { hp: -32, rep: -22 }, log: loc("골절·근손상 유발.","Causes fractures/injury.") }, { text: loc("물을 부어 깨움","Pour water to wake them"), effect: { hp: -38, rep: -28 }, log: loc("흡인 위험.","Aspiration risk.") }]) }; }
function generateSpinalShockQuestion() { return { baseId: "spinalShock", categoryKey: "adult", part: loc("신경계","Neuro"), emoji: "🦽", title: loc("척수 쇼크","Spinal Shock"), desc: loc("척수손상 직후 발생하는 척수 쇼크의 임상양상은?","Clinical features of spinal shock immediately after SCI?"), choices: shuffle([{ text: loc("이완성 마비·심부건반사 소실·자율신경 기능 손실","Flaccid paralysis, absent DTRs, autonomic dysfunction"), effect: { hp: -3, rep: 22 }, log: loc("정답. 일시적 - 며칠~수주 후 회복.","Correct. Transient — resolves in days to weeks.") }, { text: loc("강직성 마비·과반사","Spastic paralysis with hyperreflexia"), effect: { hp: -22, rep: -12 }, log: loc("쇼크 회복 후 단계.","After shock resolves.") }, { text: loc("정상 신경학적 검사","Normal neuro exam"), effect: { hp: -28, rep: -20 }, log: loc("심각한 손상이 있음.","Significant injury present.") }, { text: loc("의식 소실","Loss of consciousness"), effect: { hp: -28, rep: -20 }, log: loc("뇌 손상이 동반되지 않으면 의식은 정상.","Consciousness intact unless brain injured.") }]) }; }
function generateAutonomicDysreflexiaQuestion() { return { baseId: "autonomicDys", categoryKey: "adult", part: loc("신경계","Neuro"), emoji: "🚨", title: loc("자율신경 반사이상","Autonomic Dysreflexia"), desc: loc("T6 이상 척수손상 환자에서 갑작스러운 심한 두통·고혈압·발한이 발생했다. 1차 처치는?","T6+ SCI patient: sudden severe headache, HTN, sweating. First action?"), choices: shuffle([{ text: loc("좌위로 일으키고 유발 자극(방광 가득·변비 등) 즉시 제거","Sit upright and remove the trigger (full bladder, fecal impaction, etc.)"), effect: { hp: -3, rep: 22 }, log: loc("정답. 응급 - 뇌출혈·발작 위험.","Correct. Emergency — risk of stroke/seizure.") }, { text: loc("Trendelenburg + 안정","Trendelenburg + bed rest"), effect: { hp: -45, rep: -32 }, log: loc("뇌압 더 상승.","Raises ICP further.") }, { text: loc("진정제 투여","Sedate the patient"), effect: { hp: -32, rep: -22 }, log: loc("원인 제거가 우선.","Trigger removal first.") }, { text: loc("관찰만","Just observe"), effect: { hp: -45, rep: -32 }, log: loc("응급 상태.","Emergency state.") }]) }; }
function generateBurnFluidQuestion() { return { baseId: "burnFluid", categoryKey: "adult", part: loc("화상","Burn"), emoji: "🔥", title: loc("Parkland 공식","Parkland Formula"), desc: loc("70kg 환자의 30% TBSA 화상에 대해 첫 24시간 Parkland 공식 총 수액량은?","Total 24-hour fluid for a 70kg patient with 30% TBSA burn (Parkland)?"), choices: shuffle([{ text: loc("8,400 mL (4 mL × 70kg × 30%)","8,400 mL (4 mL × 70kg × 30%)"), effect: { hp: -3, rep: 22 }, log: loc("정답. 첫 8시간에 절반(4,200), 다음 16시간에 나머지.","Correct. Half in first 8 h, half in next 16 h.") }, { text: loc("4,200 mL","4,200 mL"), effect: { hp: -25, rep: -15 }, log: loc("이는 첫 8시간분.","That's the first 8-hour amount.") }, { text: loc("21,000 mL","21,000 mL"), effect: { hp: -32, rep: -22 }, log: loc("계산이 틀림.","Calculation off.") }, { text: loc("2,100 mL","2,100 mL"), effect: { hp: -28, rep: -20 }, log: loc("부족.","Under.") }]) }; }
function generateRabiesQuestion() { return { baseId: "rabies", categoryKey: "community", part: loc("동물 교상","Animal Bite"), emoji: "🐕", title: loc("광견병 노출 후 처치","Rabies Post-Exposure"), desc: loc("야생 동물에 물린 환자에 대한 가장 우선되는 처치는?","Most important first action after wild animal bite?"), choices: shuffle([{ text: loc("상처 부위 비누·물로 15분 세척 + 광견병 백신 + 면역글로불린","Wash wound with soap and water 15 min + rabies vaccine + immune globulin"), effect: { hp: -3, rep: 22 }, log: loc("정답. 노출 후 예방(PEP)이 핵심.","Correct. Post-exposure prophylaxis (PEP) is critical.") }, { text: loc("관찰만 - 동물 잠복기 대기","Just observe — wait for incubation"), effect: { hp: -45, rep: -32 }, log: loc("증상 발현 후 사망률 100%.","100% mortality after symptoms.") }, { text: loc("항생제만","Antibiotics only"), effect: { hp: -32, rep: -22 }, log: loc("바이러스성 - 항생제 무효.","Viral — antibiotics ineffective.") }, { text: loc("드레싱만","Dressing only"), effect: { hp: -38, rep: -28 }, log: loc("PEP 누락.","Missing PEP.") }]) }; }
function generateLeadPoisonAdultQuestion() { return { baseId: "leadAdult", categoryKey: "community", part: loc("중독","Toxicology"), emoji: "🏭", title: loc("성인 납 중독","Adult Lead Poisoning"), desc: loc("배터리 공장 근로자가 복통·관절통·인지 저하를 호소한다. 가장 의심되는 진단은?","Battery factory worker: abdominal pain, arthralgia, cognitive decline. Suspected?"), choices: shuffle([{ text: loc("성인 납 중독","Adult lead poisoning"), effect: { hp: -2, rep: 22 }, log: loc("정답. 직업 노출이 가장 흔한 원인.","Correct. Occupational exposure is the most common cause.") }, { text: loc("정상 노화","Normal aging"), effect: { hp: -32, rep: -22 }, log: loc("증상 패턴이 비정상.","Symptom pattern is abnormal.") }, { text: loc("근막동통","Fibromyalgia"), effect: { hp: -25, rep: -15 }, log: loc("인지 저하·복통은 부적합.","Doesn't explain cognitive/abdominal symptoms.") }, { text: loc("우울증","Depression"), effect: { hp: -25, rep: -15 }, log: loc("주된 진단으로 부족.","Insufficient as primary dx.") }]) }; }
function generateMagnesiumToxicityQuestion() { return { baseId: "magnesiumTox", categoryKey: "maternal", part: loc("MgSO4","Magnesium Sulfate"), emoji: "💊", title: loc("MgSO4 독성","Magnesium Toxicity"), desc: loc("자간증 예방으로 MgSO4 IV 중인 산모에서 가장 먼저 사정해야 할 독성 징후는?","Earliest sign to monitor for in MgSO4 IV for eclampsia prevention?"), choices: shuffle([{ text: loc("심부건반사(DTR) 소실","Loss of deep tendon reflexes (DTRs)"), effect: { hp: -3, rep: 22 }, log: loc("정답. DTR 소실은 호흡억제 직전의 경고.","Correct. DTR loss precedes respiratory depression.") }, { text: loc("두통","Headache"), effect: { hp: -28, rep: -20 }, log: loc("자간증 자체의 증상.","Symptom of eclampsia itself.") }, { text: loc("부종 증가","Increased edema"), effect: { hp: -28, rep: -20 }, log: loc("독성 지표가 아님.","Not a toxicity indicator.") }, { text: loc("발열","Fever"), effect: { hp: -28, rep: -20 }, log: loc("독성과 무관.","Unrelated to toxicity.") }]) }; }
function generateUmbilicalCordCareQuestion() { return { baseId: "umbilicalCord", categoryKey: "pediatric", part: loc("신생아 간호","Newborn Care"), emoji: "👶", title: loc("탯줄 간호","Umbilical Cord Care"), desc: loc("신생아 탯줄(제대) 간호로 옳은 것은?","Correct umbilical cord care for a newborn?"), choices: shuffle([{ text: loc("청결·건조 유지, 알코올 일상 사용 불요, 기저귀 접어 노출","Keep clean and dry; routine alcohol not needed; fold diaper down to expose"), effect: { hp: -2, rep: 22 }, log: loc("정답. 자연 건조가 분리 촉진.","Correct. Air drying promotes detachment.") }, { text: loc("하루 5회 알코올 도포","Apply alcohol 5×/day"), effect: { hp: -22, rep: -12 }, log: loc("일상 알코올은 권장되지 않음.","Routine alcohol not recommended.") }, { text: loc("기저귀로 완전 덮음","Cover completely with diaper"), effect: { hp: -25, rep: -15 }, log: loc("습기로 감염 위험.","Moisture risks infection.") }, { text: loc("당일 목욕에 푹 담금","Submerge during first-day bath"), effect: { hp: -28, rep: -20 }, log: loc("탯줄 분리 전엔 스폰지 목욕만.","Sponge bath only until cord falls off.") }]) }; }
function generateInfantSafetyQuestion() { return { baseId: "infantSafety", categoryKey: "pediatric", part: loc("안전","Safety"), emoji: "🛏️", title: loc("영아 돌연사 예방(SIDS)","SIDS Prevention"), desc: loc("영아 돌연사 증후군(SIDS) 예방의 핵심 원칙은?","Core principle for SIDS prevention?"), choices: shuffle([{ text: loc("바로 눕혀 재우기(Back to sleep), 단단한 매트리스, 베개·이불 제거","Back to sleep, firm mattress, no pillows/blankets"), effect: { hp: -3, rep: 22 }, log: loc("정답. AAP 공식 권고.","Correct. Official AAP recommendation.") }, { text: loc("엎드려 재우기","Prone (face-down)"), effect: { hp: -45, rep: -32 }, log: loc("SIDS 위험 크게 증가.","Greatly increases SIDS risk.") }, { text: loc("푹신한 베개와 이불","Soft pillows and blankets"), effect: { hp: -38, rep: -28 }, log: loc("질식 위험.","Suffocation risk.") }, { text: loc("부모 침대에서 함께 자기","Co-sleep in adult bed"), effect: { hp: -32, rep: -22 }, log: loc("질식·압박 위험.","Suffocation/overlay risk.") }]) }; }
function generateAdolescentDepressionQuestion() { return { baseId: "adolescentDep", categoryKey: "psych", part: loc("청소년 정신건강","Adolescent Mental Health"), emoji: "🧑", title: loc("청소년 우울증","Adolescent Depression"), desc: loc("청소년 우울증의 임상양상이 성인과 다른 점은?","How does adolescent depression differ from adult presentation?"), choices: shuffle([{ text: loc("우울감 대신 짜증·분노·과민함이 주된 증상일 수 있음","Irritability, anger may predominate over sadness"), effect: { hp: -2, rep: 22 }, log: loc("정답. DSM도 청소년에서 짜증을 우울 기준으로 인정.","Correct. DSM allows irritability as a criterion in adolescents.") }, { text: loc("성인과 동일하게 슬픔만 보임","Same as adults — only sadness"), effect: { hp: -22, rep: -12 }, log: loc("청소년은 짜증 표출이 흔함.","Irritability is common in teens.") }, { text: loc("청소년은 우울증이 없음","Teens don't get depression"), effect: { hp: -38, rep: -28 }, log: loc("실제로 흔하며 자살 위험 높음.","Common with high suicide risk.") }, { text: loc("우울증 진단은 18세 이후만","Cannot diagnose before age 18"), effect: { hp: -32, rep: -22 }, log: loc("연령 기준 없음.","No age cutoff.") }]) }; }
function generateAntidepressantQuestion() { return { baseId: "ssriOnset", categoryKey: "psych", part: loc("항우울제","Antidepressants"), emoji: "💊", title: loc("SSRI 효과 발현","SSRI Onset"), desc: loc("SSRI 투여 후 효과가 충분히 발현되기까지 걸리는 시간은?","Time for SSRI to reach full effect?"), choices: shuffle([{ text: loc("4~6주","4-6 weeks"), effect: { hp: -2, rep: 22 }, log: loc("정답. 자살 위험은 초기 2주에 오히려 증가 - 모니터링.","Correct. Suicide risk may rise in first 2 weeks — monitor.") }, { text: loc("24시간 이내","Within 24 hours"), effect: { hp: -25, rep: -15 }, log: loc("이는 벤조 등의 즉각 약물.","That's for immediate-effect drugs like benzos.") }, { text: loc("3~6개월","3-6 months"), effect: { hp: -22, rep: -12 }, log: loc("너무 길음.","Too long.") }, { text: loc("1년 이상","Over 1 year"), effect: { hp: -28, rep: -20 }, log: loc("그 이전에 효과가 나타남.","Effect appears earlier.") }]) }; }
function generateNutritionLabsQuestion() { return { baseId: "nutritionLabs", categoryKey: "fundamentals", part: loc("영양","Nutrition"), emoji: "🥗", title: loc("영양 상태 검사","Nutritional Lab"), desc: loc("환자의 단백질-에너지 영양상태를 가장 잘 반영하는 혈액 검사는?","Best lab marker for protein-energy nutritional status?"), choices: shuffle([{ text: loc("프리알부민(prealbumin) - 반감기 2일","Prealbumin (half-life 2 days)"), effect: { hp: -2, rep: 22 }, log: loc("정답. 알부민(반감기 21일)보다 단기 변화 반영.","Correct. Reflects short-term changes better than albumin.") }, { text: loc("Hemoglobin","Hemoglobin"), effect: { hp: -22, rep: -12 }, log: loc("빈혈 평가용.","For anemia.") }, { text: loc("Cholesterol","Cholesterol"), effect: { hp: -22, rep: -12 }, log: loc("지질 평가용.","For lipid profile.") }, { text: loc("BUN","BUN"), effect: { hp: -22, rep: -12 }, log: loc("신장·수분 평가용.","For renal/fluid status.") }]) }; }
function generateCAUTIPreventionQuestion() { return { baseId: "cautiPrev", categoryKey: "fundamentals", part: loc("감염관리","Infection Control"), emoji: "🚽", title: loc("CAUTI 예방","CAUTI Prevention"), desc: loc("도뇨관 관련 요로감염(CAUTI) 예방의 가장 효과적인 방법은?","Most effective way to prevent CAUTI?"), choices: shuffle([{ text: loc("필요할 때만 삽입, 가능한 빨리 제거","Insert only when necessary; remove ASAP"), effect: { hp: -2, rep: 22 }, log: loc("정답. \"있으면 빠지게\" 원칙.","Correct. \"Get it out!\" principle.") }, { text: loc("매일 항생제 예방 투여","Daily prophylactic antibiotics"), effect: { hp: -32, rep: -22 }, log: loc("내성 유발.","Causes resistance.") }, { text: loc("도뇨관 매일 교체","Replace catheter daily"), effect: { hp: -25, rep: -15 }, log: loc("불필요한 조작은 감염 증가.","Unnecessary manipulation increases infection.") }, { text: loc("관찰만","Just observe"), effect: { hp: -25, rep: -15 }, log: loc("적극적 관리 필요.","Active management needed.") }]) }; }

function generateMoroReflexQuestion() {
    const svg = `<svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="200" fill="#fef3f7"/><g transform="translate(180,30)"><circle cx="120" cy="60" r="42" fill="#fed7aa" stroke="#9a3412" stroke-width="2"/><circle cx="106" cy="55" r="3" fill="#1e293b"/><circle cx="134" cy="55" r="3" fill="#1e293b"/><path d="M 110 70 Q 120 76 130 70" stroke="#1e293b" stroke-width="1.5" fill="none"/><line x1="78" y1="80" x2="40" y2="40" stroke="#1e293b" stroke-width="3"/><line x1="162" y1="80" x2="200" y2="40" stroke="#1e293b" stroke-width="3"/><circle cx="40" cy="40" r="6" fill="#fda4af"/><circle cx="200" cy="40" r="6" fill="#fda4af"/><line x1="78" y1="80" x2="40" y2="60" stroke="#1e293b" stroke-width="1" stroke-dasharray="4,3" opacity="0.4"/><line x1="162" y1="80" x2="200" y2="60" stroke="#1e293b" stroke-width="1" stroke-dasharray="4,3" opacity="0.4"/><text x="120" y="150" text-anchor="middle" font-size="13" font-weight="700">${loc("팔을 놀라며 펼침","Arms spread in startle")}</text></g></svg>`;
    return { baseId: "moroReflex", categoryKey: "pediatric", part: loc("신생아 반사","Newborn Reflex"), emoji: "👶",
        title: loc("신생아 반사 식별","Identify the Newborn Reflex"),
        desc: loc("머리가 갑자기 떨어질 때 팔이 외전되었다가 다시 모이는 그림 속 반사는?","Reflex shown: arms abduct then adduct in response to sudden head drop?"),
        image: svg,
        choices: shuffle([
            { text: loc("Moro 반사 (놀람 반사)","Moro (startle) reflex"), effect: { hp: -2, rep: 22 }, log: loc("정답. 정상은 출생~4-6개월까지.","Correct. Normal from birth to 4-6 months.") },
            { text: loc("Babinski 반사","Babinski reflex"), effect: { hp: -22, rep: -12 }, log: loc("Babinski는 발바닥 자극·발가락 부채꼴.","Babinski: stroke sole → toe fanning.") },
            { text: loc("Rooting 반사","Rooting reflex"), effect: { hp: -22, rep: -12 }, log: loc("Rooting은 뺨 자극·고개 돌림.","Rooting: cheek stroke → head turn.") },
            { text: loc("Tonic neck 반사","Tonic neck reflex"), effect: { hp: -22, rep: -12 }, log: loc("Tonic neck는 머리 회전·팔 펌프.","Tonic neck: head turn → arm extension same side.") }
        ])
    };
}

// ========= 이미지 문제 2차: 10개 추가 =========
// ========= 배치 6: 추가 텍스트 20문제 =========
function generatePediatricVSQuestion() { return { baseId: "pedVS", categoryKey: "pediatric", part: loc("아동 활력징후","Pediatric VS"), emoji: "👶", title: loc("연령별 정상 활력징후","Age-Specific Normal VS"), desc: loc(`생후 12개월 영아의 정상 심박수 범위는?`,`Normal heart rate for a 12-month-old infant?`), choices: shuffle([{ text: loc("100~160회/분","100-160 bpm"), effect: { hp: -2, rep: 22 }, log: loc("정답. 영아는 분당 100-160이 정상.","Correct. Infants normally 100-160.") }, { text: loc("60~100회/분","60-100 bpm"), effect: { hp: -22, rep: -12 }, log: loc("성인 정상 범위.","Adult range.") }, { text: loc("180~220회/분","180-220 bpm"), effect: { hp: -25, rep: -15 }, log: loc("빈맥 - 비정상.","Tachycardia.") }, { text: loc("40~60회/분","40-60 bpm"), effect: { hp: -28, rep: -20 }, log: loc("서맥 - 응급.","Bradycardia — emergency.") }]) }; }
function generateAFibTreatmentQuestion() { return { baseId: "afibTx", categoryKey: "adult", part: loc("부정맥 치료","Arrhythmia Tx"), emoji: "💊", title: loc("심방세동 항응고","A-fib Anticoagulation"), desc: loc(`만성 심방세동 환자에서 뇌졸중 예방을 위한 1차 약물군은?`,`First-line anticoagulant class for stroke prevention in chronic A-fib?`), choices: shuffle([{ text: loc("DOAC(Apixaban·Rivaroxaban) 또는 Warfarin","DOAC (apixaban/rivaroxaban) or warfarin"), effect: { hp: -2, rep: 22 }, log: loc("정답. CHA2DS2-VASc 점수에 따라 결정.","Correct. Based on CHA2DS2-VASc score.") }, { text: loc("Aspirin 단독","Aspirin alone"), effect: { hp: -25, rep: -15 }, log: loc("aspirin은 효과 부족.","Aspirin alone is insufficient.") }, { text: loc("Clopidogrel 단독","Clopidogrel alone"), effect: { hp: -25, rep: -15 }, log: loc("적응증이 다름.","Different indication.") }, { text: loc("이뇨제","Diuretics"), effect: { hp: -28, rep: -20 }, log: loc("응고 예방과 무관.","Unrelated to clot prevention.") }]) }; }
function generateChemoExtravasationQuestion() { return { baseId: "chemoExtrav", categoryKey: "adult", part: loc("종양 응급","Oncology Emergency"), emoji: "🚨", title: loc("항암제 혈관 외 누출","Chemo Extravasation"), desc: loc(`항암제 정맥주사 중 발적·통증·부종 발생. 1차 처치는?`,`Redness, pain, swelling during chemo IV. First action?`), choices: shuffle([{ text: loc("주입 즉시 중단·라인 유지·약물별 해독제·국소 처치","Stop infusion, keep IV in place, antidote per drug, local care"), effect: { hp: -3, rep: 22 }, log: loc("정답. 라인을 통해 해독제 주입.","Correct. Antidote via the same line.") }, { text: loc("계속 주입 - 호전 대기","Keep infusing — hope it improves"), effect: { hp: -45, rep: -32 }, log: loc("조직괴사 위험.","Tissue necrosis risk.") }, { text: loc("IV 즉시 제거","Remove IV immediately"), effect: { hp: -32, rep: -22 }, log: loc("해독제 주입 후 제거.","Give antidote first, then remove.") }, { text: loc("뜨거운 찜질","Hot pack"), effect: { hp: -25, rep: -15 }, log: loc("약물별로 다름 - vinca는 hot, anthracycline은 cold.","Drug-specific — vinca=hot, anthracycline=cold.") }]) }; }
function generateMassiveTransfusionQuestion() { return { baseId: "massiveTransfusion", categoryKey: "adult", part: loc("수혈","Transfusion"), emoji: "🩸", title: loc("대량수혈 합병증","Massive Transfusion Complications"), desc: loc(`24시간 이내 10단위 이상 수혈한 환자에게 모니터링해야 할 합병증은?`,`Complications to monitor when ≥10 units transfused in 24 hours?`), choices: shuffle([{ text: loc("저칼슘혈증·고칼륨혈증·저체온·응고병증","Hypocalcemia, hyperkalemia, hypothermia, coagulopathy"), effect: { hp: -3, rep: 22 }, log: loc("정답. \"치명적 4중주\" - 시트레이트·K+·차가운 혈액·희석 응고인자.","Correct. \"Lethal tetrad\" — citrate, K+, cold blood, dilution.") }, { text: loc("수분 부족","Dehydration"), effect: { hp: -32, rep: -22 }, log: loc("정반대 - 부피 과다 위험.","Opposite — volume overload risk.") }, { text: loc("저혈압만","Hypotension only"), effect: { hp: -28, rep: -20 }, log: loc("불완전.","Incomplete.") }, { text: loc("부작용 거의 없음","Few side effects"), effect: { hp: -38, rep: -28 }, log: loc("심각한 위험들이 있음.","Serious risks exist.") }]) }; }
function generateNeutropenicQuestion() { return { baseId: "neutropenic", categoryKey: "adult", part: loc("호중구 감소","Neutropenia"), emoji: "🛡️", title: loc("호중구감소 발열","Neutropenic Fever"), desc: loc(`항암 치료 환자가 ANC 500 미만에서 38.3℃ 발열. 가장 시급한 처치는?`,`Chemo patient with ANC<500 develops 38.3°C fever. Most urgent action?`), choices: shuffle([{ text: loc("혈액배양 즉시 + 1시간 이내 광범위 IV 항생제","Blood cultures + broad-spectrum IV antibiotics within 1 hour"), effect: { hp: -3, rep: 22 }, log: loc("정답. \"Hour Zero\" 원칙.","Correct. \"Door-to-needle\" 1 hour.") }, { text: loc("관찰 후 24시간 뒤 재평가","Observe and reassess in 24 hours"), effect: { hp: -45, rep: -32 }, log: loc("패혈증으로 사망 위험.","Risk of fatal sepsis.") }, { text: loc("해열제만 투여","Antipyretics only"), effect: { hp: -38, rep: -28 }, log: loc("감염 원인을 놓침.","Misses infection source.") }, { text: loc("스테로이드만","Steroids only"), effect: { hp: -38, rep: -28 }, log: loc("면역억제 - 더 위험.","Immunosuppressive — more dangerous.") }]) }; }
function generateTPNQuestion() { return { baseId: "tpn", categoryKey: "fundamentals", part: loc("TPN","Total Parenteral Nutrition"), emoji: "💉", title: loc("TPN 모니터링","TPN Monitoring"), desc: loc(`TPN을 받는 환자에서 가장 자주 모니터링해야 할 검사는?`,`Most frequently monitored lab in a patient on TPN?`), choices: shuffle([{ text: loc("혈당(매 4~6시간) + 매일 전해질·간기능","Glucose q4-6h + daily electrolytes/LFTs"), effect: { hp: -2, rep: 22 }, log: loc("정답. 고혈당·재영양 증후군이 주요 위험.","Correct. Hyperglycemia and refeeding syndrome are key risks.") }, { text: loc("주 1회 혈당","Glucose weekly"), effect: { hp: -32, rep: -22 }, log: loc("부족.","Inadequate.") }, { text: loc("월 1회 혈당","Glucose monthly"), effect: { hp: -38, rep: -28 }, log: loc("심각하게 부족.","Severely inadequate.") }, { text: loc("관찰만","Just observe"), effect: { hp: -38, rep: -28 }, log: loc("실험실 모니터링 필수.","Lab monitoring is essential.") }]) }; }
function generateRedmanQuestion() { return { baseId: "redman", categoryKey: "adult", part: loc("약물 부작용","Drug Reaction"), emoji: "💊", title: loc("Vancomycin Red Man","Vancomycin Red Man Syndrome"), desc: loc(`Vancomycin IV 빠른 주입 후 얼굴·목·상체 발적과 가려움 발생. 처치는?`,`After rapid Vancomycin IV: redness/itching on face/neck/upper body. Action?`), choices: shuffle([{ text: loc("주입 속도 늦추기 + 항히스타민(Diphenhydramine)","Slow infusion rate + antihistamine (diphenhydramine)"), effect: { hp: -2, rep: 22 }, log: loc("정답. 히스타민 분비에 의한 비특이성 반응.","Correct. Non-specific histamine release.") }, { text: loc("아나필락시스로 즉시 Epi","Epi immediately for anaphylaxis"), effect: { hp: -28, rep: -20 }, log: loc("아나필락시스가 아닌 단순 히스타민 반응.","Not anaphylaxis — just histamine release.") }, { text: loc("약물 영구 중단","Permanently discontinue"), effect: { hp: -22, rep: -12 }, log: loc("주입 속도 조절로 재투여 가능.","Can re-administer with slower rate.") }, { text: loc("관찰만","Just observe"), effect: { hp: -28, rep: -20 }, log: loc("불편 완화 처치 필요.","Need symptom relief.") }]) }; }
function generateOpioidWithdrawalQuestion() { return { baseId: "opioidWithdrawal", categoryKey: "psych", part: loc("아편제 금단","Opioid Withdrawal"), emoji: "💊", title: loc("아편제 금단증상","Opioid Withdrawal"), desc: loc(`헤로인 사용자가 갑자기 중단 후 콧물·동공 산대·근육통·설사·하품을 호소한다. 가장 적절한 약물은?`,`Heroin user stops abruptly: rhinorrhea, mydriasis, myalgia, diarrhea, yawning. Best drug?`), choices: shuffle([{ text: loc("Methadone 또는 Buprenorphine","Methadone or buprenorphine"), effect: { hp: -3, rep: 22 }, log: loc("정답. 부분작용제로 금단 완화 + 재발 방지.","Correct. Partial agonists ease withdrawal and prevent relapse.") }, { text: loc("Naloxone","Naloxone"), effect: { hp: -38, rep: -28 }, log: loc("길항제 - 금단을 유발.","Antagonist — induces withdrawal.") }, { text: loc("Diazepam만","Diazepam only"), effect: { hp: -22, rep: -12 }, log: loc("아편 금단의 1차약이 아님.","Not first-line for opioid withdrawal.") }, { text: loc("관찰만","Just observe"), effect: { hp: -22, rep: -12 }, log: loc("환자 고통이 큼.","Significant patient suffering.") }]) }; }
function generateNicotineCessationQuestion() { return { baseId: "nicotineCessation", categoryKey: "community", part: loc("금연","Smoking Cessation"), emoji: "🚭", title: loc("금연 약물 1차","Smoking Cessation 1st-line"), desc: loc(`흡연자의 금연 보조에 가장 효과적인 단일 약물은?`,`Most effective single drug for smoking cessation?`), choices: shuffle([{ text: loc("Varenicline (Chantix) - 부분작용제","Varenicline (Chantix) — partial agonist"), effect: { hp: -2, rep: 22 }, log: loc("정답. NRT·Bupropion보다 우수한 효과.","Correct. Superior efficacy vs NRT/bupropion.") }, { text: loc("Aspirin","Aspirin"), effect: { hp: -28, rep: -20 }, log: loc("관련 없음.","Unrelated.") }, { text: loc("Diazepam","Diazepam"), effect: { hp: -25, rep: -15 }, log: loc("관련 없음.","Unrelated.") }, { text: loc("Acetaminophen","Acetaminophen"), effect: { hp: -28, rep: -20 }, log: loc("관련 없음.","Unrelated.") }]) }; }
function generateSnakebiteQuestion() { return { baseId: "snakebite", categoryKey: "community", part: loc("뱀 교상","Snakebite"), emoji: "🐍", title: loc("독사 교상 처치","Venomous Snakebite"), desc: loc(`독사에 물린 환자의 응급실 도착 전 처치로 옳은 것은?`,`Pre-hospital care for venomous snakebite?`), choices: shuffle([{ text: loc("환부 부동·심장보다 낮게 유지·즉시 응급실 이송","Immobilize, keep below heart level, transport ASAP"), effect: { hp: -3, rep: 22 }, log: loc("정답. 독 확산 지연.","Correct. Slows venom spread.") }, { text: loc("입으로 독을 빨아냄","Suck venom out by mouth"), effect: { hp: -32, rep: -22 }, log: loc("효과 없고 추가 감염.","Ineffective + adds infection.") }, { text: loc("환부를 절개","Incise the wound"), effect: { hp: -38, rep: -28 }, log: loc("출혈·감염 위험.","Bleeding/infection risk.") }, { text: loc("얼음으로 환부 동결","Freeze the area with ice"), effect: { hp: -32, rep: -22 }, log: loc("조직 괴사 위험.","Tissue necrosis risk.") }]) }; }
function generateHeatStrokeQuestion() { return { baseId: "heatStroke", categoryKey: "adult", part: loc("환경 응급","Environmental Emergency"), emoji: "🌡️", title: loc("열사병","Heat Stroke"), desc: loc(`체온 40.5℃·의식 변화·무한증을 보이는 환자 응급 처치는?`,`Patient with 40.5°C, altered MS, anhidrosis. Emergency action?`), choices: shuffle([{ text: loc("즉각적 전신 냉각(얼음물·증발 냉각·찬 IV 수액)","Immediate aggressive cooling (ice water, evaporative, cold IV fluids)"), effect: { hp: -3, rep: 22 }, log: loc("정답. 첫 30분 골든타임.","Correct. First 30 min is critical.") }, { text: loc("따뜻한 담요로 보온","Warm blankets"), effect: { hp: -45, rep: -32 }, log: loc("체온을 더 올림.","Raises temperature more.") }, { text: loc("해열제(Aspirin/APAP)","Antipyretics (aspirin/APAP)"), effect: { hp: -32, rep: -22 }, log: loc("열사병에는 효과 없음.","Don't work in heat stroke.") }, { text: loc("관찰만","Just observe"), effect: { hp: -45, rep: -32 }, log: loc("응급 - 사망률 높음.","Emergency — high mortality.") }]) }; }
function generateHypothermiaQuestion() { return { baseId: "hypothermia", categoryKey: "adult", part: loc("환경 응급","Environmental Emergency"), emoji: "❄️", title: loc("저체온증 보온","Hypothermia Rewarming"), desc: loc(`체온 30℃·의식 저하 환자에 대한 가장 적절한 가온 방법은?`,`Patient with 30°C and altered MS. Best rewarming approach?`), choices: shuffle([{ text: loc("능동적 중심부 가온(따뜻한 IV 수액·따뜻한 인공호흡)","Active core rewarming (warm IV fluids, warmed humidified air)"), effect: { hp: -3, rep: 22 }, log: loc("정답. 중심부부터 천천히.","Correct. Central first, slowly.") }, { text: loc("뜨거운 물로 사지 즉시 가온","Hot water on extremities immediately"), effect: { hp: -38, rep: -28 }, log: loc("말초 가온은 \"after-drop\" 유발.","Peripheral causes after-drop.") }, { text: loc("환자에게 강한 운동 지시","Have patient exercise vigorously"), effect: { hp: -32, rep: -22 }, log: loc("부정맥 위험.","Arrhythmia risk.") }, { text: loc("관찰만","Just observe"), effect: { hp: -42, rep: -30 }, log: loc("응급.","Emergency.") }]) }; }
function generateDrowningQuestion() { return { baseId: "drowning", categoryKey: "adult", part: loc("응급","Emergency"), emoji: "🌊", title: loc("익수 환자 처치","Drowning"), desc: loc(`익수 후 의식 없는 환자에 대한 1차 응급 처치는?`,`First emergency action for an unconscious near-drowning victim?`), choices: shuffle([{ text: loc("ABC 평가 + 인공호흡 시작 (CPR이 필요하면 호흡 먼저)","Assess ABCs and initiate rescue breathing (rescue breaths first if CPR needed)"), effect: { hp: -3, rep: 22 }, log: loc("정답. 익수는 1차 호흡 정지가 원인.","Correct. Drowning is primarily respiratory arrest.") }, { text: loc("폐의 물을 빼기 위해 거꾸로 듦","Hold upside-down to drain water"), effect: { hp: -42, rep: -30 }, log: loc("효과 없으며 시간 낭비.","Ineffective, wastes time.") }, { text: loc("복부 강한 압박으로 물 짜냄","Push abdomen hard to expel water"), effect: { hp: -38, rep: -28 }, log: loc("손상·구토·흡인 위험.","Risk of injury/aspiration.") }, { text: loc("따뜻하게 보온만","Warm covers only"), effect: { hp: -38, rep: -28 }, log: loc("기도·호흡이 우선.","Airway/breathing first.") }]) }; }
function generatePoisoningQuestion() { return { baseId: "poisoning", categoryKey: "adult", part: loc("중독","Toxicology"), emoji: "☠️", title: loc("일반 중독 응급","General Poisoning"), desc: loc(`독성 물질 섭취 환자에서 1순위 정보 출처는?`,`First-priority information source for poisoning?`), choices: shuffle([{ text: loc("독성정보센터(Poison Control 1339) 즉시 연락","Call Poison Control immediately (1339)"), effect: { hp: -2, rep: 22 }, log: loc("정답. 독성물질별 처치는 전문가가 안내.","Correct. Specific antidotes per substance — get expert guidance.") }, { text: loc("환자에게 즉시 토하게 함","Induce vomiting immediately"), effect: { hp: -32, rep: -22 }, log: loc("물질에 따라 금기 - 부식제 등.","Contraindicated for some — caustics, etc.") }, { text: loc("우유를 다량 먹임","Force milk"), effect: { hp: -28, rep: -20 }, log: loc("물질에 따라 금기.","Substance-dependent.") }, { text: loc("관찰만","Just observe"), effect: { hp: -38, rep: -28 }, log: loc("응급 - 적극 개입.","Emergency — act.") }]) }; }
function generateLatexAllergyQuestion() { return { baseId: "latexAllergy", categoryKey: "fundamentals", part: loc("알레르기","Allergy"), emoji: "🧤", title: loc("라텍스 알레르기","Latex Allergy"), desc: loc(`이분척추증(spina bifida) 환자에게 가장 관련이 깊은 알레르기는?`,`Allergy most strongly associated with spina bifida patients?`), choices: shuffle([{ text: loc("라텍스 알레르기 - 라텍스 미함유 환경 필요","Latex allergy — latex-free environment required"), effect: { hp: -2, rep: 22 }, log: loc("정답. 다회 수술로 라텍스 노출 누적.","Correct. Repeated surgeries cause latex exposure buildup.") }, { text: loc("페니실린 알레르기","Penicillin allergy"), effect: { hp: -25, rep: -15 }, log: loc("일반인에 흔하지만 spina bifida 특이성 없음.","Common in general but no spina bifida link.") }, { text: loc("우유 알레르기","Milk allergy"), effect: { hp: -25, rep: -15 }, log: loc("관련 없음.","Unrelated.") }, { text: loc("계란 알레르기","Egg allergy"), effect: { hp: -25, rep: -15 }, log: loc("관련 없음.","Unrelated.") }]) }; }
function generateImmunizationContraQuestion() { return { baseId: "immunContra", categoryKey: "pediatric", part: loc("예방접종 금기","Immunization Contraindications"), emoji: "💉", title: loc("생백신 금기","Live Vaccine Contraindications"), desc: loc(`다음 중 생백신(MMR·수두)이 절대 금기인 환자는?`,`Who is an absolute contraindication for live vaccines (MMR, varicella)?`), choices: shuffle([{ text: loc("심한 면역결핍·임신부","Severe immunodeficiency or pregnancy"), effect: { hp: -3, rep: 22 }, log: loc("정답. 생백신 균이 질병 유발 위험.","Correct. Live virus may cause disease.") }, { text: loc("경증 감기","Mild common cold"), effect: { hp: -22, rep: -12 }, log: loc("발열 미동반 시 접종 가능.","OK if no fever.") }, { text: loc("계란 알레르기","Egg allergy"), effect: { hp: -22, rep: -12 }, log: loc("MMR은 가능, 인플루엔자는 신중.","MMR OK; flu vaccine cautious.") }, { text: loc("모유수유 중","Breastfeeding"), effect: { hp: -22, rep: -12 }, log: loc("대부분 백신 금기 아님.","Most vaccines OK.") }]) }; }
function generateBladderTrainingQuestion() { return { baseId: "bladderTraining", categoryKey: "fundamentals", part: loc("배뇨","Voiding"), emoji: "🚽", title: loc("방광 훈련","Bladder Training"), desc: loc(`요실금 노인 환자의 방광 훈련 핵심 원칙은?`,`Key principle of bladder training for an elderly incontinent patient?`), choices: shuffle([{ text: loc("정해진 시간에 배뇨, 점진적으로 간격 연장","Scheduled voiding with gradually extended intervals"), effect: { hp: -2, rep: 22 }, log: loc("정답. 방광 용량과 통제력 회복.","Correct. Restores bladder capacity and control.") }, { text: loc("수분 제한으로 빈도 감소","Restrict fluids to reduce frequency"), effect: { hp: -28, rep: -20 }, log: loc("UTI 위험과 탈수 유발.","Causes UTI/dehydration.") }, { text: loc("도뇨관 영구 삽입","Permanent catheter"), effect: { hp: -32, rep: -22 }, log: loc("CAUTI 위험과 의존성.","CAUTI risk and dependency.") }, { text: loc("기저귀만 적용","Diapers only"), effect: { hp: -28, rep: -20 }, log: loc("회복을 막음.","Prevents recovery.") }]) }; }
function generateLumbarPunctureQuestion() { return { baseId: "lumbarPuncture", categoryKey: "fundamentals", part: loc("처치","Procedure"), emoji: "💉", title: loc("요추천자 후 간호","Post-LP Care"), desc: loc(`요추천자 후 두통 예방을 위한 간호로 옳은 것은?`,`Nursing care to prevent post-LP headache?`), choices: shuffle([{ text: loc("4~6시간 평와위 + 충분한 수분 섭취","Lie flat 4-6 hours + ample hydration"), effect: { hp: -2, rep: 22 }, log: loc("정답. CSF 누출과 두통 감소.","Correct. Reduces CSF leak and headache.") }, { text: loc("즉시 보행 권장","Encourage immediate ambulation"), effect: { hp: -22, rep: -12 }, log: loc("두통 위험 증가.","Increases headache risk.") }, { text: loc("수분 제한","Restrict fluids"), effect: { hp: -25, rep: -15 }, log: loc("탈수가 두통 악화.","Dehydration worsens headache.") }, { text: loc("앉은 자세 유지","Keep sitting upright"), effect: { hp: -25, rep: -15 }, log: loc("두통을 더 유발.","Provokes headache.") }]) }; }
function generateNarcoticReversalQuestion() { return { baseId: "narcoticReversal", categoryKey: "adult", part: loc("PCA 합병증","PCA Complication"), emoji: "💊", title: loc("아편 호흡억제","Opioid Respiratory Depression"), desc: loc(`PCA 사용 환자가 호흡수 6회/분, 의식 저하. 1차 처치는?`,`PCA patient: RR 6, decreased LOC. First action?`), choices: shuffle([{ text: loc("PCA 즉시 중단·기도 확보 + Naloxone 투여","Stop PCA, secure airway, give naloxone"), effect: { hp: -3, rep: 22 }, log: loc("정답. 길항제로 호흡 회복.","Correct. Antagonist restores breathing.") }, { text: loc("관찰만 하며 자연 회복 대기","Observe and wait"), effect: { hp: -45, rep: -32 }, log: loc("호흡정지·사망 위험.","Risk of respiratory arrest/death.") }, { text: loc("PCA 용량 추가","Add more PCA dose"), effect: { hp: -50, rep: -38 }, log: loc("절대 금기.","Absolutely contraindicated.") }, { text: loc("Flumazenil 투여","Give flumazenil"), effect: { hp: -32, rep: -22 }, log: loc("이는 벤조 길항제.","That's a benzo antagonist.") }]) }; }
function generateColonoscopyPrepQuestion() { return { baseId: "colonoscopyPrep", categoryKey: "fundamentals", part: loc("검사 준비","Pre-procedure"), emoji: "🍵", title: loc("대장내시경 전 준비","Colonoscopy Prep"), desc: loc(`대장내시경 검사 전 환자에게 가장 중요한 교육은?`,`Most important pre-colonoscopy patient teaching?`), choices: shuffle([{ text: loc("검사 전 24시간 맑은 액체식·장 세척제 정확 복용","Clear liquids 24 hours before + take bowel prep exactly as ordered"), effect: { hp: -2, rep: 22 }, log: loc("정답. 시야 확보가 진단 정확도 결정.","Correct. Visualization determines diagnostic accuracy.") }, { text: loc("일반 식이 유지","Continue regular diet"), effect: { hp: -32, rep: -22 }, log: loc("검사 불가능.","Test would fail.") }, { text: loc("물도 마시지 않기","No fluids at all"), effect: { hp: -32, rep: -22 }, log: loc("탈수 유발.","Causes dehydration.") }, { text: loc("아침 식사만 거르기","Just skip breakfast"), effect: { hp: -28, rep: -20 }, log: loc("부족한 준비.","Inadequate prep.") }]) }; }

// ========= 배치 7: 심혈관/호흡 10문제 =========
function generateNYHAQuestion() { return { baseId: "nyha", categoryKey: "adult", part: loc("심부전","Heart Failure"), emoji: "💔", title: loc("NYHA 분류","NYHA Class"), desc: loc(`평소 활동(계단 1층)에서 호흡곤란이 있으나 안정 시는 정상인 환자의 NYHA 분류는?`,`Patient: dyspnea on ordinary activity (1 flight of stairs), normal at rest. NYHA?`), choices: shuffle([{ text: loc("Class III - 일상 활동에서 증상","Class III — symptoms with ordinary activity"), effect: { hp: -2, rep: 22 }, log: loc("정답. III=일상활동 제한, IV=안정시 증상.","Correct. III = limited ordinary activity; IV = symptoms at rest.") }, { text: loc("Class I - 무증상","Class I — asymptomatic"), effect: { hp: -22, rep: -12 }, log: loc("증상이 있음.","Patient has symptoms.") }, { text: loc("Class II - 강한 활동에서만","Class II — strong activity only"), effect: { hp: -22, rep: -12 }, log: loc("일상활동에서도 증상.","Symptoms occur with ordinary activity.") }, { text: loc("Class IV - 안정시 증상","Class IV — at rest"), effect: { hp: -22, rep: -12 }, log: loc("문제는 활동 시.","Question states with activity.") }]) }; }
function generatePericarditisQuestion() { return { baseId: "pericarditis", categoryKey: "adult", part: loc("심혈관","Cardiac"), emoji: "💔", title: loc("심낭염","Pericarditis"), desc: loc(`흉통이 앞으로 숙이면 좋아지고 누우면 악화되는 환자의 진단은?`,`Chest pain relieved by leaning forward, worsened lying down. Diagnosis?`), choices: shuffle([{ text: loc("심낭염 - 마찰음(friction rub) 청진","Pericarditis — friction rub on auscultation"), effect: { hp: -2, rep: 22 }, log: loc("정답. 자세에 따른 통증 변화·마찰음이 특징.","Correct. Positional pain + friction rub are classic.") }, { text: loc("MI","Myocardial infarction"), effect: { hp: -25, rep: -15 }, log: loc("MI는 자세와 무관하며 압박감.","MI not positional, crushing.") }, { text: loc("폐색전증","PE"), effect: { hp: -25, rep: -15 }, log: loc("자세와 관련 없음.","Not positional.") }, { text: loc("GERD","GERD"), effect: { hp: -25, rep: -15 }, log: loc("응급 진단을 우선 배제.","Rule out emergencies first.") }]) }; }
function generateDigoxinToxQuestion() { return { baseId: "digoxinTox", categoryKey: "adult", part: loc("약물 중독","Drug Toxicity"), emoji: "💊", title: loc("디곡신 중독","Digoxin Toxicity"), desc: loc(`디곡신 복용 환자에서 시야가 노랗게 보이고 오심·서맥이 나타날 때 가장 먼저 사정할 검사는?`,`Patient on digoxin: yellow vision, nausea, bradycardia. First lab to check?`), choices: shuffle([{ text: loc("혈청 디곡신·칼륨 농도","Serum digoxin level + potassium"), effect: { hp: -3, rep: 22 }, log: loc("정답. 저칼륨이 독성을 악화·치료농도 0.5~2 ng/mL.","Correct. Low K worsens toxicity; therapeutic 0.5-2 ng/mL.") }, { text: loc("간기능검사만","LFTs only"), effect: { hp: -25, rep: -15 }, log: loc("간 대사가 주가 아님.","Not primarily hepatic.") }, { text: loc("CBC","CBC"), effect: { hp: -22, rep: -12 }, log: loc("관련 없음.","Unrelated.") }, { text: loc("혈당","Glucose"), effect: { hp: -22, rep: -12 }, log: loc("관련 없음.","Unrelated.") }]) }; }
function generateFurosemideKQuestion() { return { baseId: "furosemideK", categoryKey: "adult", part: loc("이뇨제","Diuretics"), emoji: "💊", title: loc("Furosemide 환자 교육","Furosemide Teaching"), desc: loc(`Furosemide 복용 환자에게 권장하는 식품은?`,`Recommended foods for a patient on furosemide?`), choices: shuffle([{ text: loc("바나나·오렌지·시금치 등 칼륨 풍부 식품","K-rich foods: bananas, oranges, spinach"), effect: { hp: -2, rep: 22 }, log: loc("정답. 루프 이뇨제는 K 손실 - 보충 필요.","Correct. Loop diuretics deplete K — replenish.") }, { text: loc("저칼륨 식이 유지","Low-K diet"), effect: { hp: -32, rep: -22 }, log: loc("저칼륨혈증 위험.","Hypokalemia risk.") }, { text: loc("물 섭취 제한","Restrict water"), effect: { hp: -28, rep: -20 }, log: loc("탈수 위험.","Dehydration risk.") }, { text: loc("고염분식이","High-salt diet"), effect: { hp: -28, rep: -20 }, log: loc("이뇨 효과 무력화.","Negates diuretic effect.") }]) }; }
function generateCardiacCathQuestion() { return { baseId: "cardiacCath", categoryKey: "adult", part: loc("심혈관 시술","Cardiac Procedures"), emoji: "💉", title: loc("심도자술 후 간호","Post-Cardiac Cath Care"), desc: loc(`대퇴 동맥 접근 심도자술 직후 가장 우선 사정할 항목은?`,`Top priority assessment immediately after femoral access cardiac cath?`), choices: shuffle([{ text: loc("천자부위 출혈/혈종 + 말초맥박·색·온도","Puncture site bleeding/hematoma + distal pulses, color, warmth"), effect: { hp: -3, rep: 22 }, log: loc("정답. 출혈·동맥 폐쇄가 주요 합병증.","Correct. Bleeding/arterial occlusion are main complications.") }, { text: loc("기침 격려","Encourage coughing"), effect: { hp: -25, rep: -15 }, log: loc("천자부위 출혈 위험.","Risk of bleeding at puncture site.") }, { text: loc("환자 즉시 보행","Ambulate immediately"), effect: { hp: -28, rep: -20 }, log: loc("4~6시간 침상 안정 필요.","Need 4-6 hours bed rest.") }, { text: loc("단순 활력징후만","VS only"), effect: { hp: -28, rep: -20 }, log: loc("국소 사정도 필수.","Local assessment essential.") }]) }; }
function generateAsthmaSeverityQuestion() { return { baseId: "asthmaSeverity", categoryKey: "adult", part: loc("호흡기","Respiratory"), emoji: "💨", title: loc("천식 중증도 분류","Asthma Severity"), desc: loc(`주간 증상 매일·야간 증상 주 1회 이상·PEFR 60~80% 환자의 천식 중증도는?`,`Daily daytime symptoms, weekly nocturnal, PEFR 60-80%. Asthma severity?`), choices: shuffle([{ text: loc("중등도 지속성(Moderate persistent)","Moderate persistent"), effect: { hp: -2, rep: 22 }, log: loc("정답. 흡입 ICS+LABA가 표준.","Correct. ICS + LABA standard treatment.") }, { text: loc("간헐적(Intermittent)","Intermittent"), effect: { hp: -25, rep: -15 }, log: loc("주 ≤2회·야간 ≤2회/달.","Symptoms ≤2/wk, nighttime ≤2/mo.") }, { text: loc("경증 지속성","Mild persistent"), effect: { hp: -25, rep: -15 }, log: loc("주 >2회 but 매일 아님.","More than 2/wk but not daily.") }, { text: loc("중증 지속성","Severe persistent"), effect: { hp: -22, rep: -12 }, log: loc("PEFR <60%·전일 증상.","PEFR <60%, continuous.") }]) }; }
function generateCOPDGOLDQuestion() { return { baseId: "copdGold", categoryKey: "adult", part: loc("호흡기","Respiratory"), emoji: "🫁", title: loc("COPD GOLD 분류","COPD GOLD Stage"), desc: loc(`COPD 환자의 FEV1이 정상의 45%로 측정됐다. GOLD 단계는?`,`COPD patient with FEV1 = 45% of predicted. GOLD stage?`), choices: shuffle([{ text: loc("GOLD 3 (중증) - 30~50%","GOLD 3 (Severe) — 30-50%"), effect: { hp: -2, rep: 22 }, log: loc("정답. GOLD 1≥80%, 2:50-79%, 3:30-49%, 4<30%.","Correct. GOLD 1≥80%, 2:50-79%, 3:30-49%, 4<30%.") }, { text: loc("GOLD 1 (경증)","GOLD 1 (Mild)"), effect: { hp: -22, rep: -12 }, log: loc("≥80%이어야 함.","Should be ≥80%.") }, { text: loc("GOLD 2 (중등도)","GOLD 2 (Moderate)"), effect: { hp: -22, rep: -12 }, log: loc("50~79% 범위.","50-79% range.") }, { text: loc("GOLD 4 (매우 중증)","GOLD 4 (Very severe)"), effect: { hp: -22, rep: -12 }, log: loc("<30%이어야 함.","Should be <30%.") }]) }; }
function generateCAPOrganismQuestion() { return { baseId: "capOrganism", categoryKey: "adult", part: loc("호흡기 감염","Respiratory Infection"), emoji: "🦠", title: loc("지역사회 폐렴 원인","CAP Most Common Cause"), desc: loc(`성인 지역사회 획득 폐렴(CAP)에서 가장 흔한 원인균은?`,`Most common organism in community-acquired pneumonia (CAP) in adults?`), choices: shuffle([{ text: loc("Streptococcus pneumoniae","Streptococcus pneumoniae"), effect: { hp: -2, rep: 22 }, log: loc("정답. CAP 1위 원인.","Correct. #1 cause of CAP.") }, { text: loc("Pseudomonas aeruginosa","Pseudomonas aeruginosa"), effect: { hp: -22, rep: -12 }, log: loc("HAP·중환자에서 흔함.","More common in HAP/ICU.") }, { text: loc("MRSA","MRSA"), effect: { hp: -22, rep: -12 }, log: loc("HAP에서 더 흔함.","More common in HAP.") }, { text: loc("Mycobacterium tuberculosis","Mycobacterium tuberculosis"), effect: { hp: -22, rep: -12 }, log: loc("결핵은 별도 질환.","TB is separate.") }]) }; }
function generateTBPrecautionsQuestion() { return { baseId: "tbPrec", categoryKey: "adult", part: loc("결핵 격리","TB Isolation"), emoji: "😷", title: loc("결핵 환자 보호장구","TB Precautions"), desc: loc(`활동성 폐결핵 환자 병실 진입 시 간호사가 착용해야 할 보호장구는?`,`PPE for entering an active pulmonary TB patient's room?`), choices: shuffle([{ text: loc("N95 마스크 + 음압 격리실","N95 respirator + negative-pressure room"), effect: { hp: -3, rep: 22 }, log: loc("정답. 공기주의 표준 격리.","Correct. Standard airborne precautions.") }, { text: loc("일반 외과용 마스크만","Surgical mask only"), effect: { hp: -38, rep: -28 }, log: loc("결핵에는 부족.","Inadequate for TB.") }, { text: loc("장갑만","Gloves only"), effect: { hp: -42, rep: -30 }, log: loc("호흡기 감염은 호흡기 보호 필요.","Need airway protection.") }, { text: loc("PPE 불요","No PPE needed"), effect: { hp: -45, rep: -32 }, log: loc("심각한 노출 위험.","Serious exposure risk.") }]) }; }
function generateTrachSuctionQuestion() { return { baseId: "trachSuction", categoryKey: "fundamentals", part: loc("기관절개","Tracheostomy"), emoji: "🫁", title: loc("기관절개 흡인","Tracheostomy Suctioning"), desc: loc(`기관절개관 흡인 시 한 번에 흡인 시간은 얼마를 넘기지 않아야 하는가?`,`Tracheostomy suctioning — what's the max time per pass?`), choices: shuffle([{ text: loc("10~15초 이내","10-15 seconds maximum"), effect: { hp: -2, rep: 22 }, log: loc("정답. 더 길면 저산소·점막 손상.","Correct. Longer = hypoxia/mucosal damage.") }, { text: loc("60초","60 seconds"), effect: { hp: -32, rep: -22 }, log: loc("저산소 위험.","Hypoxia risk.") }, { text: loc("30초","30 seconds"), effect: { hp: -28, rep: -20 }, log: loc("너무 길음.","Too long.") }, { text: loc("3~5초","3-5 seconds"), effect: { hp: -22, rep: -12 }, log: loc("너무 짧아 효과 없음.","Too short, ineffective.") }]) }; }

// ========= 배치 8: 신장·내분비·소화기 10문제 =========
function generateCBIQuestion() { return { baseId: "cbi", categoryKey: "adult", part: loc("비뇨기","Urology"), emoji: "💧", title: loc("연속방광세척","Continuous Bladder Irrigation"), desc: loc(`TURP 후 CBI(연속 방광 세척) 중 환자의 소변이 짙은 빨간색이며 응고가 보일 때 1차 처치는?`,`Post-TURP patient on CBI: dark red urine with clots. First action?`), choices: shuffle([{ text: loc("CBI 속도 증가 + 의사에게 보고, 도뇨관 폐쇄 확인","Increase CBI rate, notify MD, check for catheter obstruction"), effect: { hp: -3, rep: 22 }, log: loc("정답. 핑크빛이 정상, 짙은 빨강은 출혈 의심.","Correct. Pink is normal; dark red suggests hemorrhage.") }, { text: loc("CBI 즉시 중단","Stop CBI immediately"), effect: { hp: -32, rep: -22 }, log: loc("응고로 도뇨관 폐쇄 위험 증가.","Clots may obstruct catheter.") }, { text: loc("도뇨관 즉시 제거","Remove catheter immediately"), effect: { hp: -38, rep: -28 }, log: loc("출혈을 더 악화.","Worsens bleeding.") }, { text: loc("관찰만 12시간","Just observe for 12 hours"), effect: { hp: -32, rep: -22 }, log: loc("출혈성 쇼크 위험.","Hemorrhagic shock risk.") }]) }; }
function generateHDAccessQuestion() { return { baseId: "hdAccess", categoryKey: "adult", part: loc("투석 접근로","HD Access"), emoji: "🩺", title: loc("투석 접근로 종류","HD Access Types"), desc: loc(`혈액투석 환자에게 가장 권장되는 영구적 접근로는?`,`Most recommended permanent HD access?`), choices: shuffle([{ text: loc("동정맥루(AVF) - 자기 혈관 사용","Arteriovenous fistula (AVF) — uses own vessels"), effect: { hp: -2, rep: 22 }, log: loc("정답. 감염·혈전 위험 가장 낮음.","Correct. Lowest infection/clot risk.") }, { text: loc("중심정맥관(CVC)","Central venous catheter (CVC)"), effect: { hp: -22, rep: -12 }, log: loc("응급/임시용·감염 위험 큼.","Emergency/temporary; infection risk high.") }, { text: loc("말초 IV","Peripheral IV"), effect: { hp: -32, rep: -22 }, log: loc("HD에 부적합.","Inadequate for HD.") }, { text: loc("동정맥 인조혈관(AVG)","AV graft (AVG)"), effect: { hp: -22, rep: -12 }, log: loc("AVF 어려울 때 대안.","Alternative when AVF impossible.") }]) }; }
function generatePDQuestion() { return { baseId: "peritonealDialysis", categoryKey: "adult", part: loc("투석","Dialysis"), emoji: "🫘", title: loc("복막투석 합병증","PD Complications"), desc: loc(`복막투석 환자의 배출액이 혼탁하고 발열·복통이 동반된다. 가장 가능성 높은 합병증은?`,`PD patient: cloudy effluent, fever, abdominal pain. Most likely?`), choices: shuffle([{ text: loc("복막염","Peritonitis"), effect: { hp: -3, rep: 22 }, log: loc("정답. 혼탁 효과액·복통이 진단의 핵심.","Correct. Cloudy effluent + pain are hallmark.") }, { text: loc("수액 과다","Fluid overload"), effect: { hp: -25, rep: -15 }, log: loc("발열·혼탁이 안 맞음.","Fever/cloudiness don't fit.") }, { text: loc("저혈당","Hypoglycemia"), effect: { hp: -28, rep: -20 }, log: loc("PD 액 자체에 포도당.","PD fluid contains glucose.") }, { text: loc("정상","Normal"), effect: { hp: -42, rep: -30 }, log: loc("응급 - 즉각 항생제.","Emergency — antibiotics immediately.") }]) }; }
function generateInsulinPumpQuestion() { return { baseId: "insulinPump", categoryKey: "adult", part: loc("당뇨","Diabetes"), emoji: "💉", title: loc("인슐린 펌프 교육","Insulin Pump Teaching"), desc: loc(`인슐린 펌프를 처음 사용하는 환자에게 가장 중요한 교육 내용은?`,`Most important teaching for a patient new to insulin pump?`), choices: shuffle([{ text: loc("기본 주입(basal)+식사 추가(bolus) 개념·고혈당 시 펌프 점검·DKA 위험","Basal+bolus concept, check pump in hyperglycemia, DKA risk"), effect: { hp: -3, rep: 22 }, log: loc("정답. 펌프 고장 시 인슐린 결핍 → DKA 빠르게 진행.","Correct. Pump failure → rapid DKA.") }, { text: loc("펌프는 평생 안전 - 점검 불요","Pump is forever safe — no checks needed"), effect: { hp: -38, rep: -28 }, log: loc("정기 점검·세트 교환 필수.","Regular checks/set changes essential.") }, { text: loc("음식 섭취량 무관","Diet doesn't matter"), effect: { hp: -32, rep: -22 }, log: loc("탄수화물 계산이 핵심.","Carb counting is key.") }, { text: loc("샤워 시에도 절대 분리 금지","Never disconnect — even for showers"), effect: { hp: -25, rep: -15 }, log: loc("일부 펌프는 분리 가능.","Some pumps detach.") }]) }; }
function generateSlidingScaleQuestion() { return { baseId: "slidingScale", categoryKey: "adult", part: loc("당뇨 투약","DM Medication"), emoji: "💊", title: loc("Sliding Scale 인슐린","Sliding Scale Insulin"), desc: loc(`혈당 350 mg/dL에서 sliding scale 처방대로 인슐린 8단위 투여 후 가장 우선 모니터링은?`,`After 8 units sliding scale insulin for glucose 350 mg/dL. Top monitoring priority?`), choices: shuffle([{ text: loc("저혈당 증상 + 1시간 후 혈당 재측정","Hypoglycemia signs + recheck glucose in 1 hour"), effect: { hp: -2, rep: 22 }, log: loc("정답. 효과 발현 시 저혈당 위험.","Correct. Hypoglycemia risk at peak.") }, { text: loc("심전도","ECG"), effect: { hp: -25, rep: -15 }, log: loc("우선순위 아님.","Not the priority.") }, { text: loc("간기능","Liver function"), effect: { hp: -25, rep: -15 }, log: loc("관련 없음.","Unrelated.") }, { text: loc("관찰만","Just observe"), effect: { hp: -32, rep: -22 }, log: loc("저혈당 발견을 놓침.","Misses hypoglycemia.") }]) }; }
function generateHashimotoQuestion() { return { baseId: "hashimoto", categoryKey: "adult", part: loc("내분비","Endocrine"), emoji: "🦋", title: loc("하시모토 갑상선염","Hashimoto's Thyroiditis"), desc: loc(`갑상선 항체 양성·진행성 갑상선기능저하를 보이는 자가면역 질환은?`,`Autoimmune disease with positive thyroid antibodies and progressive hypothyroidism?`), choices: shuffle([{ text: loc("하시모토 갑상선염","Hashimoto's thyroiditis"), effect: { hp: -2, rep: 22 }, log: loc("정답. 가장 흔한 갑상선기능저하 원인.","Correct. Most common cause of hypothyroidism.") }, { text: loc("그레이브스병","Graves' disease"), effect: { hp: -22, rep: -12 }, log: loc("갑상선기능항진증.","Hyperthyroidism.") }, { text: loc("아급성 갑상선염","Subacute thyroiditis"), effect: { hp: -22, rep: -12 }, log: loc("바이러스성·일시적.","Viral, transient.") }, { text: loc("갑상선암","Thyroid cancer"), effect: { hp: -22, rep: -12 }, log: loc("결절·림프절·자가항체와 무관.","Different presentation.") }]) }; }
function generateUlcerativeColitisQuestion() { return { baseId: "ulcerativeColitis", categoryKey: "adult", part: loc("소화기","GI"), emoji: "🩸", title: loc("궤양성 대장염","Ulcerative Colitis"), desc: loc(`혈변·복통·체중 감소를 보이는 환자에서 대장에만 국한된 연속적 궤양이 보였다. 진단은?`,`Bloody diarrhea, abdominal pain, weight loss; continuous ulceration limited to colon. Dx?`), choices: shuffle([{ text: loc("궤양성 대장염(UC) - 대장만, 연속적","Ulcerative colitis — colon only, continuous"), effect: { hp: -2, rep: 22 }, log: loc("정답. UC: 대장·연속·점막만. Crohn's: 전소화관·skip lesion·전층.","Correct. UC: colon, continuous, mucosal. Crohn's: GI tract, skip, transmural.") }, { text: loc("크론병","Crohn's disease"), effect: { hp: -22, rep: -12 }, log: loc("Crohn은 skip lesion이 특징.","Crohn's has skip lesions.") }, { text: loc("IBS","Irritable bowel syndrome"), effect: { hp: -25, rep: -15 }, log: loc("IBS는 궤양 없음.","No ulceration in IBS.") }, { text: loc("게실염","Diverticulitis"), effect: { hp: -25, rep: -15 }, log: loc("국소적 게실 염증.","Localized diverticular inflammation.") }]) }; }
function generateCrohnsQuestion() { return { baseId: "crohns", categoryKey: "adult", part: loc("소화기","GI"), emoji: "🌀", title: loc("크론병 특징","Crohn's Disease"), desc: loc(`크론병의 고유한 병리학적 특징은?`,`Pathognomonic feature of Crohn's disease?`), choices: shuffle([{ text: loc("Skip lesion·전층 침범·종종 누공 형성","Skip lesions, transmural, often fistulas"), effect: { hp: -2, rep: 22 }, log: loc("정답. 입~항문 전체 GI 가능.","Correct. Anywhere mouth to anus.") }, { text: loc("대장만 연속적 침범","Continuous, colon only"), effect: { hp: -22, rep: -12 }, log: loc("UC 특징.","UC features.") }, { text: loc("점막만 침범","Mucosa only"), effect: { hp: -22, rep: -12 }, log: loc("UC 특징.","UC features.") }, { text: loc("위에만 국한","Confined to stomach"), effect: { hp: -28, rep: -20 }, log: loc("크론은 어디든 가능.","Crohn's is GI-wide.") }]) }; }
function generateCirrhosisDietQuestion() { return { baseId: "cirrhosisDiet", categoryKey: "adult", part: loc("간 질환","Liver"), emoji: "🟡", title: loc("간경화 식이","Cirrhosis Diet"), desc: loc(`간성 뇌증 위험이 있는 간경화 환자에게 권장되는 식이는?`,`Cirrhosis patient at risk for hepatic encephalopathy. Recommended diet?`), choices: shuffle([{ text: loc("적당한 단백질 + 충분한 칼로리, 저나트륨, 식사 자주 분할","Moderate protein + adequate calories, low-sodium, frequent small meals"), effect: { hp: -2, rep: 22 }, log: loc("정답. 단백질 과제한은 영양실조 - 적정량.","Correct. Protein restriction risks malnutrition — moderate is best.") }, { text: loc("고단백·고지방","High-protein, high-fat"), effect: { hp: -28, rep: -20 }, log: loc("암모니아·지방간 악화.","Worsens NH3/steatosis.") }, { text: loc("절대 금식","NPO"), effect: { hp: -38, rep: -28 }, log: loc("영양실조 가속.","Accelerates malnutrition.") }, { text: loc("고염분","High-salt"), effect: { hp: -32, rep: -22 }, log: loc("복수 악화.","Worsens ascites.") }]) }; }
function generateHepatitisCompareQuestion() { return { baseId: "hepCompare", categoryKey: "community", part: loc("간염","Hepatitis"), emoji: "🦠", title: loc("Hepatitis A vs B 전파","Hep A vs B Transmission"), desc: loc(`Hepatitis A의 주요 전파 경로는?`,`Primary transmission route of Hepatitis A?`), choices: shuffle([{ text: loc("분변-구강(오염된 음식·물)","Fecal-oral (contaminated food/water)"), effect: { hp: -2, rep: 22 }, log: loc("정답. HAV는 분변-구강. HBV/HCV는 혈액·체액.","Correct. HAV is fecal-oral; HBV/HCV are bloodborne.") }, { text: loc("혈액·체액","Blood/body fluids"), effect: { hp: -22, rep: -12 }, log: loc("HBV·HCV의 경로.","HBV/HCV route.") }, { text: loc("공기","Airborne"), effect: { hp: -28, rep: -20 }, log: loc("호흡기 감염이 아님.","Not respiratory.") }, { text: loc("성접촉만","Sex only"), effect: { hp: -25, rep: -15 }, log: loc("HBV는 가능하나 HAV는 분변-구강이 주.","HBV possible but HAV mainly fecal-oral.") }]) }; }

// ========= 배치 9: 신경·소아 10문제 =========
function generateALSQuestion() { return { baseId: "als", categoryKey: "adult", part: loc("신경계","Neuro"), emoji: "🦴", title: loc("루게릭병(ALS)","Amyotrophic Lateral Sclerosis"), desc: loc(`진행성 근육 약화·근위축이 있으나 인지기능과 감각이 보존되는 질환은?`,`Progressive muscle weakness/atrophy with preserved cognition and sensation?`), choices: shuffle([{ text: loc("ALS - 운동신경원 질환","ALS — motor neuron disease"), effect: { hp: -2, rep: 22 }, log: loc("정답. 상·하 운동신경원 침범, 감각·인지 정상.","Correct. Upper + lower motor neuron, sensory/cognition intact.") }, { text: loc("MS","Multiple sclerosis"), effect: { hp: -22, rep: -12 }, log: loc("MS는 시력·감각 침범 흔함.","MS often affects vision/sensation.") }, { text: loc("파킨슨병","Parkinson's"), effect: { hp: -22, rep: -12 }, log: loc("진전·서동·강직이 특징.","Tremor, bradykinesia, rigidity.") }, { text: loc("근위축성 척수성근위축증","SMA"), effect: { hp: -22, rep: -12 }, log: loc("주로 영아기 발병.","Mostly infant-onset.") }]) }; }
function generateMigraineCompareQuestion() { return { baseId: "migraineCompare", categoryKey: "adult", part: loc("두통","Headache"), emoji: "🤕", title: loc("편두통 vs 군발두통","Migraine vs Cluster"), desc: loc(`항상 한쪽 눈 주위에 극심한 통증이 15~180분 발작적으로 나타나는 두통은?`,`Excruciating periorbital pain, always one-sided, lasting 15-180 min in clusters. Type?`), choices: shuffle([{ text: loc("군발두통(Cluster)","Cluster headache"), effect: { hp: -2, rep: 22 }, log: loc("정답. \"자살 두통\"이라 불림. 고용량 산소가 응급 치료.","Correct. Called \"suicide headache\". High-flow O2 abortive.") }, { text: loc("편두통","Migraine"), effect: { hp: -22, rep: -12 }, log: loc("편두통은 4~72시간·구역 동반.","Migraine: 4-72 hours, often with nausea.") }, { text: loc("긴장성 두통","Tension headache"), effect: { hp: -22, rep: -12 }, log: loc("양측·압박감.","Bilateral, band-like.") }, { text: loc("부비동 두통","Sinus headache"), effect: { hp: -22, rep: -12 }, log: loc("얼굴·이마 압통, 코 증상.","Facial/forehead, with sinus symptoms.") }]) }; }
function generateSAHQuestion() { return { baseId: "sah", categoryKey: "adult", part: loc("뇌출혈","Hemorrhagic Stroke"), emoji: "🧠", title: loc("거미막하 출혈","Subarachnoid Hemorrhage"), desc: loc(`갑작스러운 \"평생 가장 심한 두통\"과 목 경직을 호소하는 환자의 진단은?`,`Sudden \"worst headache of life\" with neck stiffness. Diagnosis?`), choices: shuffle([{ text: loc("거미막하 출혈(SAH) - 동맥류 파열 의심","Subarachnoid hemorrhage (SAH) — suspect aneurysm rupture"), effect: { hp: -3, rep: 22 }, log: loc("정답. CT 음성이라도 LP로 RBC·xanthochromia 확인.","Correct. CT may miss; LP shows RBCs/xanthochromia.") }, { text: loc("긴장성 두통","Tension headache"), effect: { hp: -42, rep: -32 }, log: loc("응급을 놓침.","Misses emergency.") }, { text: loc("편두통","Migraine"), effect: { hp: -38, rep: -28 }, log: loc("\"평생 가장 심한\"은 적색 깃발.","\"Worst of life\" is red flag.") }, { text: loc("부비동염","Sinusitis"), effect: { hp: -38, rep: -28 }, log: loc("응급을 놓침.","Misses emergency.") }]) }; }
function generateMyastheniaCrisisQuestion() { return { baseId: "myastheniaCrisis", categoryKey: "adult", part: loc("신경계","Neuro"), emoji: "💪", title: loc("근무력증 위기 vs 콜린성","MG Crisis vs Cholinergic Crisis"), desc: loc(`MG 환자에서 호흡 곤란이 발생했다. 동공 축소·과도한 침분비·복부 경련이 동반되면 의심되는 위기는?`,`MG patient develops respiratory distress + miosis, hypersalivation, abdominal cramping. Crisis type?`), choices: shuffle([{ text: loc("콜린성 위기 - 약물 과다, Atropine 처치","Cholinergic crisis — drug overdose, give atropine"), effect: { hp: -3, rep: 22 }, log: loc("정답. 부교감 항진 = 콜린성. 근무력증 위기는 약물 부족.","Correct. Excess parasympathetic = cholinergic. Myasthenic crisis is undertreatment.") }, { text: loc("근무력증 위기 - 약물 증량","Myasthenic crisis — increase dose"), effect: { hp: -42, rep: -30 }, log: loc("증상이 콜린성 - 더 주면 사망 위험.","Symptoms are cholinergic — more drug = fatal.") }, { text: loc("정상 변이","Normal variant"), effect: { hp: -45, rep: -32 }, log: loc("응급 상태.","Emergency.") }, { text: loc("아나필락시스","Anaphylaxis"), effect: { hp: -32, rep: -22 }, log: loc("두드러기·천명음이 다름.","Different presentation.") }]) }; }
function generateCranialNerveQuestion() { return { baseId: "cranialNerve", categoryKey: "adult", part: loc("뇌신경","Cranial Nerves"), emoji: "👁️", title: loc("뇌신경 식별","Cranial Nerves"), desc: loc(`눈을 위·아래·내측으로 움직이는 데 관여하는 뇌신경은?`,`Cranial nerve responsible for upward, downward, and medial eye movement?`), choices: shuffle([{ text: loc("CN III (동안신경, Oculomotor)","CN III (Oculomotor)"), effect: { hp: -2, rep: 22 }, log: loc("정답. III=대부분 안구 운동, IV=하방·외측, VI=외측.","Correct. III=most eye movement; IV=down/in; VI=lateral.") }, { text: loc("CN II (시신경)","CN II (Optic)"), effect: { hp: -22, rep: -12 }, log: loc("II는 시각이지 운동이 아님.","II is vision, not motor.") }, { text: loc("CN VII (안면신경)","CN VII (Facial)"), effect: { hp: -22, rep: -12 }, log: loc("VII는 안면 표정.","VII is facial expression.") }, { text: loc("CN V (삼차신경)","CN V (Trigeminal)"), effect: { hp: -22, rep: -12 }, log: loc("V는 안면 감각·저작.","V is facial sensation/chewing.") }]) }; }
function generatePedBLSQuestion() { return { baseId: "pedBLS", categoryKey: "pediatric", part: loc("소아 BLS","Pediatric BLS"), emoji: "👶", title: loc("소아 CPR 비율","Pediatric CPR Ratio"), desc: loc(`1인 구조자 소아 CPR에서 압박:인공호흡 비율은?`,`Compression-to-ventilation ratio in 1-rescuer pediatric CPR?`), choices: shuffle([{ text: loc("30:2 (성인과 동일)","30:2 (same as adult)"), effect: { hp: -3, rep: 22 }, log: loc("정답. 1인은 30:2. 2인 이상은 15:2.","Correct. 1-rescuer = 30:2. 2+ rescuers = 15:2.") }, { text: loc("15:2","15:2"), effect: { hp: -22, rep: -12 }, log: loc("15:2는 2인 이상 구조 시.","15:2 is for 2+ rescuers.") }, { text: loc("5:1","5:1"), effect: { hp: -32, rep: -22 }, log: loc("구식 비율.","Outdated ratio.") }, { text: loc("100:1","100:1"), effect: { hp: -38, rep: -28 }, log: loc("말이 안 됨.","Nonsense.") }]) }; }
function generateEpiglottitisQuestion() { return { baseId: "epiglottitis", categoryKey: "pediatric", part: loc("소아 응급","Pediatric Emergency"), emoji: "🫁", title: loc("후두개염 vs 크룹","Epiglottitis vs Croup"), desc: loc(`고열·침흘림·\"3중자세(tripod position)\"·말 못함을 보이는 아동의 진단은?`,`Child with high fever, drooling, tripod position, muffled voice. Diagnosis?`), choices: shuffle([{ text: loc("후두개염 - 응급 기도 확보","Epiglottitis — emergency airway"), effect: { hp: -3, rep: 22 }, log: loc("정답. 인후 검사 절대 금기 - 기도 폐쇄 위험.","Correct. Don't examine throat — airway obstruction risk.") }, { text: loc("크룹","Croup"), effect: { hp: -25, rep: -15 }, log: loc("크룹은 \"개 짖는 기침\"·일반적으로 덜 응급.","Croup: barking cough; less acutely emergent.") }, { text: loc("천식","Asthma"), effect: { hp: -28, rep: -20 }, log: loc("천명음이 특징.","Wheezing characteristic.") }, { text: loc("일반 감기","Common cold"), effect: { hp: -42, rep: -30 }, log: loc("응급을 놓침.","Misses emergency.") }]) }; }
function generateFifthDiseaseQuestion() { return { baseId: "fifthDisease", categoryKey: "pediatric", part: loc("소아 감염","Pediatric Infection"), emoji: "👶", title: loc("전염성 홍반(5번째 병)","Erythema Infectiosum (5th Disease)"), desc: loc(`아동의 양 뺨에 \"slapped cheek\" 발진이 보이는 질환과 격리는?`,`Child with \"slapped cheek\" rash. Disease and isolation?`), choices: shuffle([{ text: loc("전염성 홍반(Parvovirus B19) - 발진 발생 후엔 전염성 없어 격리 불요","Erythema infectiosum (Parvo B19) — non-contagious once rash appears, no isolation"), effect: { hp: -2, rep: 22 }, log: loc("정답. 임신부·면역결핍자에게는 위험.","Correct. Dangerous to pregnant/immunocompromised.") }, { text: loc("수두 - 공기+접촉 격리","Varicella — airborne+contact"), effect: { hp: -28, rep: -20 }, log: loc("수두는 다른 발진 양상.","Varicella has different rash.") }, { text: loc("홍역 - 공기 격리","Measles — airborne"), effect: { hp: -28, rep: -20 }, log: loc("홍역은 발열·코플릭반점.","Measles: fever, Koplik spots.") }, { text: loc("풍진","Rubella"), effect: { hp: -25, rep: -15 }, log: loc("풍진은 림프절 종대·연한 발진.","Rubella: lymphadenopathy, milder rash.") }]) }; }
function generateFTTQuestion() { return { baseId: "ftt", categoryKey: "pediatric", part: loc("성장 발달","Growth & Development"), emoji: "📉", title: loc("성장 부진","Failure to Thrive"), desc: loc(`체중이 5번째 백분위 이하이며 성장 곡선에서 떨어지는 영아의 1차 평가는?`,`Infant <5th percentile and falling off growth curve. Initial assessment?`), choices: shuffle([{ text: loc("영양 섭취·수유 패턴·환경(부모-아이 상호작용)","Nutritional intake, feeding patterns, environment (parent-child interaction)"), effect: { hp: -2, rep: 22 }, log: loc("정답. 다학제 평가 - 의학적·심리사회적 원인 모두.","Correct. Multidisciplinary — medical and psychosocial.") }, { text: loc("즉시 정맥영양","Immediate parenteral nutrition"), effect: { hp: -32, rep: -22 }, log: loc("심한 경우 외엔 우선 평가.","Assess first unless severe.") }, { text: loc("관찰만","Just observe"), effect: { hp: -38, rep: -28 }, log: loc("발달 지연 위험.","Risk of developmental delay.") }, { text: loc("강제 수유","Force feeding"), effect: { hp: -32, rep: -22 }, log: loc("외상·구토 유발.","Causes trauma/vomiting.") }]) }; }
function generateLactoseIntoleranceQuestion() { return { baseId: "lactose", categoryKey: "pediatric", part: loc("영양","Nutrition"), emoji: "🥛", title: loc("유당 불내증","Lactose Intolerance"), desc: loc(`유당 불내증 아동의 영양 보충에서 가장 우선되는 영양소는?`,`Top nutrient priority in a child with lactose intolerance?`), choices: shuffle([{ text: loc("칼슘 + 비타민 D (유제품 대체원에서)","Calcium + Vitamin D (from non-dairy sources)"), effect: { hp: -2, rep: 22 }, log: loc("정답. 골 성장에 필수.","Correct. Essential for bone growth.") }, { text: loc("탄수화물","Carbohydrates"), effect: { hp: -22, rep: -12 }, log: loc("일반적으로 충분.","Usually adequate.") }, { text: loc("단백질만","Protein only"), effect: { hp: -25, rep: -15 }, log: loc("필요하지만 단독으론 부족.","Needed but not alone.") }, { text: loc("철분만","Iron only"), effect: { hp: -25, rep: -15 }, log: loc("관련 없음.","Unrelated.") }]) }; }

// ========= 배치 10: 모성·정신 10문제 =========
function generatePROMQuestion() { return { baseId: "prom", categoryKey: "maternal", part: loc("분만 합병증","Labor Complications"), emoji: "💧", title: loc("조기 양막 파막","PROM"), desc: loc(`만삭 산모가 양막이 터졌으나 진통이 24시간 내에 시작되지 않을 때 가장 큰 위험은?`,`Term mother with ROM but no labor onset within 24 hours. Greatest risk?`), choices: shuffle([{ text: loc("자궁 내 감염(융모양막염)","Intrauterine infection (chorioamnionitis)"), effect: { hp: -2, rep: 22 }, log: loc("정답. 18시간 이상 ROM은 감염 위험 급증.","Correct. ROM >18h dramatically increases infection risk.") }, { text: loc("정상 변이","Normal variant"), effect: { hp: -32, rep: -22 }, log: loc("응급 평가 필요.","Needs urgent evaluation.") }, { text: loc("태반조기박리","Placental abruption"), effect: { hp: -25, rep: -15 }, log: loc("PROM과 다른 진단.","Different diagnosis.") }, { text: loc("저체온증","Hypothermia"), effect: { hp: -28, rep: -20 }, log: loc("우선 위험이 아님.","Not the primary risk.") }]) }; }
function generateGBSProphylaxisQuestion() { return { baseId: "gbsProphylaxis", categoryKey: "maternal", part: loc("산전 예방","Antepartum Prophylaxis"), emoji: "💉", title: loc("GBS 예방요법","GBS Prophylaxis"), desc: loc(`GBS 양성 산모의 분만 중 항생제 예방 투여 약물은?`,`Antibiotic prophylaxis for GBS-positive mother in labor?`), choices: shuffle([{ text: loc("Penicillin G IV (페니실린 알레르기 시 Cefazolin)","IV Penicillin G (Cefazolin if allergic)"), effect: { hp: -2, rep: 22 }, log: loc("정답. 신생아 GBS 패혈증 예방.","Correct. Prevents neonatal GBS sepsis.") }, { text: loc("Vancomycin 무조건","Always Vancomycin"), effect: { hp: -25, rep: -15 }, log: loc("심한 알레르기·내성 시만.","Only severe allergy/resistance.") }, { text: loc("Erythromycin","Erythromycin"), effect: { hp: -22, rep: -12 }, log: loc("권장 1차약 아님.","Not first-line.") }, { text: loc("항생제 불요","No antibiotics"), effect: { hp: -38, rep: -28 }, log: loc("신생아 패혈증 위험.","Neonatal sepsis risk.") }]) }; }
function generatePostpartumDVTQuestion() { return { baseId: "ppDVT", categoryKey: "maternal", part: loc("산후","Postpartum"), emoji: "🦵", title: loc("산후 DVT","Postpartum DVT"), desc: loc(`산후 산모가 한쪽 종아리의 부종·열감·통증을 호소한다. 1차 사정·중재는?`,`Postpartum mother: unilateral calf swelling, warmth, pain. First action?`), choices: shuffle([{ text: loc("환부 마사지 금지·도플러 검사·항응고 시작","Don't massage, Doppler, start anticoagulation"), effect: { hp: -3, rep: 22 }, log: loc("정답. 마사지는 색전증 위험.","Correct. Massage risks embolism.") }, { text: loc("환부를 강하게 마사지","Vigorously massage"), effect: { hp: -45, rep: -32 }, log: loc("폐색전증 유발.","Causes PE.") }, { text: loc("뜨거운 찜질","Hot compress"), effect: { hp: -25, rep: -15 }, log: loc("정확한 진단 후에.","Only after diagnosis.") }, { text: loc("관찰만","Just observe"), effect: { hp: -32, rep: -22 }, log: loc("PE 위험.","PE risk.") }]) }; }
function generateOxytocinQuestion() { return { baseId: "oxytocin", categoryKey: "maternal", part: loc("유도분만","Labor Induction"), emoji: "💉", title: loc("Oxytocin 부작용 모니터","Oxytocin Monitoring"), desc: loc(`Oxytocin 유도분만 중 자궁수축이 90초 이상 지속될 때 1차 처치는?`,`During oxytocin induction, contraction lasts >90 seconds. First action?`), choices: shuffle([{ text: loc("Oxytocin 즉시 중단·좌측위·산소·수액 증량","Stop oxytocin, left-lateral, oxygen, increase IV fluids"), effect: { hp: -3, rep: 22 }, log: loc("정답. 자궁 과활동·태아 곤란 예방.","Correct. Prevents tachysystole/fetal distress.") }, { text: loc("용량 즉시 증량","Increase dose immediately"), effect: { hp: -45, rep: -32 }, log: loc("자궁 파열·태아 사망 위험.","Risk of uterine rupture/fetal death.") }, { text: loc("관찰만","Just observe"), effect: { hp: -38, rep: -28 }, log: loc("응급 - 즉시 중단.","Emergency — stop now.") }, { text: loc("산모에게 일어나라고 함","Have mother stand"), effect: { hp: -28, rep: -20 }, log: loc("부적절.","Inappropriate.") }]) }; }
function generateGestationalAgeQuestion() { return { baseId: "gestationalAge", categoryKey: "maternal", part: loc("산전","Antepartum"), emoji: "🤰", title: loc("임신 주수 분류","Gestational Age Classification"), desc: loc(`임신 35주 6일에 분만한 신생아의 분류는?`,`A baby born at 35 weeks 6 days is classified as?`), choices: shuffle([{ text: loc("후기 미숙아(Late preterm) - 34~36+6주","Late preterm — 34 to 36+6 weeks"), effect: { hp: -2, rep: 22 }, log: loc("정답. 만삭 미만이면 미숙아 카테고리.","Correct. Below term = preterm category.") }, { text: loc("만삭(Term)","Term"), effect: { hp: -22, rep: -12 }, log: loc("만삭은 37주 이상.","Term is ≥37 weeks.") }, { text: loc("후산기(Postterm)","Post-term"), effect: { hp: -28, rep: -20 }, log: loc("42주 이후.","≥42 weeks.") }, { text: loc("초미숙(Extremely preterm)","Extremely preterm"), effect: { hp: -25, rep: -15 }, log: loc("28주 미만.","<28 weeks.") }]) }; }
function generateLithiumTeachingQuestion() { return { baseId: "lithiumTeach", categoryKey: "psych", part: loc("리튬","Lithium"), emoji: "💊", title: loc("리튬 환자 교육","Lithium Patient Teaching"), desc: loc(`양극성 환자의 리튬 복용 교육에서 가장 중요한 내용은?`,`Most important Lithium teaching for a bipolar patient?`), choices: shuffle([{ text: loc("일정한 수분·소금 섭취 유지·정기적 혈중농도·신·갑상선 검사","Steady fluid/salt intake, regular drug levels and renal/thyroid checks"), effect: { hp: -3, rep: 22 }, log: loc("정답. 좁은 치료영역 - 탈수가 즉시 독성 유발.","Correct. Narrow therapeutic window — dehydration → toxicity.") }, { text: loc("저염식이","Low-salt diet"), effect: { hp: -38, rep: -28 }, log: loc("저염은 리튬 농도 상승 → 독성.","Low salt raises lithium levels.") }, { text: loc("수분 제한","Restrict fluids"), effect: { hp: -38, rep: -28 }, log: loc("탈수 → 독성.","Dehydration → toxicity.") }, { text: loc("증상 호전 시 즉시 중단","Stop when symptoms improve"), effect: { hp: -32, rep: -22 }, log: loc("재발률이 매우 높음.","Very high relapse rate.") }]) }; }
function generateSSRIDiscontQuestion() { return { baseId: "ssriDiscont", categoryKey: "psych", part: loc("항우울제","Antidepressants"), emoji: "💊", title: loc("SSRI 중단 증후군","SSRI Discontinuation Syndrome"), desc: loc(`SSRI를 갑자기 중단한 환자가 어지럼·감각 이상·불면·짜증을 호소한다. 가장 적절한 처치는?`,`Patient stops SSRI abruptly: dizziness, paresthesia, insomnia, irritability. Best action?`), choices: shuffle([{ text: loc("이전 용량 재시작 후 점진적 감량","Restart previous dose, then taper gradually"), effect: { hp: -2, rep: 22 }, log: loc("정답. SSRI는 점진적 감량(2~4주 이상).","Correct. SSRIs need gradual taper (2-4+ weeks).") }, { text: loc("즉시 다른 SSRI로 교체","Switch immediately to another SSRI"), effect: { hp: -28, rep: -20 }, log: loc("우선 안정화 후 결정.","Stabilize first.") }, { text: loc("증상은 일시적이므로 관찰만","Just observe — transient"), effect: { hp: -25, rep: -15 }, log: loc("매우 불편하고 자해 위험 가능.","Very distressing, possible self-harm risk.") }, { text: loc("벤조디아제핀 영구 시작","Start benzo permanently"), effect: { hp: -32, rep: -22 }, log: loc("의존성 위험.","Dependency risk.") }]) }; }
function generateTardiveDyskinesiaQuestion() { return { baseId: "td", categoryKey: "psych", part: loc("EPS","EPS"), emoji: "👅", title: loc("지연성 운동이상증","Tardive Dyskinesia"), desc: loc(`장기간 항정신병약 복용 환자에서 입술 빨기·혀 굴리기·얼굴 찌푸림 같은 비자발 운동이 나타난다. 진단은?`,`Long-term antipsychotic patient: lip-smacking, tongue-rolling, facial grimacing. Dx?`), choices: shuffle([{ text: loc("지연성 운동이상증(Tardive Dyskinesia) - 종종 비가역","Tardive dyskinesia — often irreversible"), effect: { hp: -3, rep: 22 }, log: loc("정답. 비정형 약물로 변경 검토·VMAT2 억제제.","Correct. Switch to atypical or use VMAT2 inhibitor.") }, { text: loc("급성 근긴장이상","Acute dystonia"), effect: { hp: -22, rep: -12 }, log: loc("급성 근긴장은 24~96시간 내·근육 비틀림.","Dystonia is acute, twisting movements.") }, { text: loc("정좌불능증(Akathisia)","Akathisia"), effect: { hp: -22, rep: -12 }, log: loc("주관적 안절부절못함.","Subjective restlessness.") }, { text: loc("정상 변이","Normal variant"), effect: { hp: -38, rep: -28 }, log: loc("심각한 부작용.","Serious side effect.") }]) }; }
function generateAntipsychoticChoiceQuestion() { return { baseId: "atypicalAntipsych", categoryKey: "psych", part: loc("항정신병약","Antipsychotics"), emoji: "💊", title: loc("정형 vs 비정형 항정신병약","Typical vs Atypical"), desc: loc(`초발 정신증 환자에게 비정형 항정신병약(예: Risperidone)을 1차 선택하는 가장 큰 이유는?`,`Why are atypical antipsychotics (e.g., risperidone) first-line for first-episode psychosis?`), choices: shuffle([{ text: loc("EPS·TD 위험이 정형보다 낮고 음성증상에도 효과","Lower EPS/TD risk, also helps negative symptoms"), effect: { hp: -2, rep: 22 }, log: loc("정답. 단점은 대사성 부작용(체중·혈당).","Correct. Trade-off: metabolic side effects.") }, { text: loc("저렴해서","Cheaper"), effect: { hp: -25, rep: -15 }, log: loc("실제로는 더 비쌈.","Actually more expensive.") }, { text: loc("진정 효과가 빠르므로","Faster sedation"), effect: { hp: -22, rep: -12 }, log: loc("주된 이유 아님.","Not the main reason.") }, { text: loc("만성에서만 효과","Only effective in chronic"), effect: { hp: -28, rep: -20 }, log: loc("초발에도 효과.","Effective in first-episode too.") }]) }; }
function generateBenzoTaperQuestion() { return { baseId: "benzoTaper", categoryKey: "psych", part: loc("벤조다이아제핀","Benzodiazepines"), emoji: "💊", title: loc("벤조 장기 사용 후 감량","Long-term Benzo Taper"), desc: loc(`6개월 이상 벤조디아제핀을 복용한 환자가 중단을 원할 때 가장 안전한 방법은?`,`Patient on benzo >6 months wants to stop. Safest approach?`), choices: shuffle([{ text: loc("점진적 감량(주당 10~25%)·필요 시 다른 약물로 가교","Slow taper (10-25% per week), bridge with another drug if needed"), effect: { hp: -2, rep: 22 }, log: loc("정답. 갑자기 중단 시 발작·금단 위험.","Correct. Abrupt stop risks seizures/withdrawal.") }, { text: loc("즉시 중단","Stop immediately"), effect: { hp: -45, rep: -32 }, log: loc("발작 위험.","Seizure risk.") }, { text: loc("용량을 절반으로","Cut dose in half"), effect: { hp: -28, rep: -20 }, log: loc("너무 빠른 감량.","Too rapid.") }, { text: loc("아침에만 복용","Only take in morning"), effect: { hp: -32, rep: -22 }, log: loc("총 용량 변화 없음.","Doesn't change total dose.") }]) }; }

// ========= 배치 11: 약리·기본간호 10문제 =========
function generateHeparinAntidoteQuestion() { return { baseId: "heparinAntidote", categoryKey: "adult", part: loc("항응고제","Anticoagulants"), emoji: "💉", title: loc("Heparin 해독제","Heparin Antidote"), desc: loc(`Heparin 과량 출혈 시 해독제는?`,`Antidote for heparin overdose with bleeding?`), choices: shuffle([{ text: loc("Protamine sulfate","Protamine sulfate"), effect: { hp: -2, rep: 22 }, log: loc("정답. 1mg가 100단위 헤파린 길항.","Correct. 1mg neutralizes 100 units heparin.") }, { text: loc("Vitamin K","Vitamin K"), effect: { hp: -28, rep: -20 }, log: loc("Warfarin 해독제.","That's for warfarin.") }, { text: loc("Naloxone","Naloxone"), effect: { hp: -32, rep: -22 }, log: loc("아편제 해독제.","Opioid antidote.") }, { text: loc("FFP만","FFP only"), effect: { hp: -25, rep: -15 }, log: loc("Protamine이 1차.","Protamine is first-line.") }]) }; }
function generateWarfarinQuestion() { return { baseId: "warfarin", categoryKey: "adult", part: loc("항응고제","Anticoagulants"), emoji: "💊", title: loc("Warfarin 모니터링","Warfarin Monitoring"), desc: loc(`Warfarin 복용 환자에서 모니터링 검사·목표 INR(심방세동 시)은?`,`Lab to monitor and target INR for A-fib in a warfarin patient?`), choices: shuffle([{ text: loc("INR (PT) - 목표 2.0~3.0","INR (PT) — target 2.0-3.0"), effect: { hp: -2, rep: 22 }, log: loc("정답. 인공판막은 2.5~3.5.","Correct. Mechanical valves: 2.5-3.5.") }, { text: loc("aPTT - 헤파린에 적합","aPTT — for heparin"), effect: { hp: -22, rep: -12 }, log: loc("aPTT는 헤파린.","aPTT is for heparin.") }, { text: loc("Plt count","Platelet count"), effect: { hp: -25, rep: -15 }, log: loc("HIT 모니터링용.","For HIT.") }, { text: loc("Bleeding time","Bleeding time"), effect: { hp: -25, rep: -15 }, log: loc("일반적 모니터링이 아님.","Not standard.") }]) }; }
function generateBetaBlockerOverdoseQuestion() { return { baseId: "bbOverdose", categoryKey: "adult", part: loc("약물 중독","Drug Toxicity"), emoji: "💊", title: loc("베타차단제 과량","Beta-Blocker Overdose"), desc: loc(`베타차단제 과량 복용 후 서맥·저혈압이 심한 환자의 1차 처치는?`,`Severe bradycardia/hypotension after beta-blocker overdose. First treatment?`), choices: shuffle([{ text: loc("Glucagon IV (1차) + 수액·atropine","IV glucagon (first-line) + fluids/atropine"), effect: { hp: -3, rep: 22 }, log: loc("정답. Glucagon이 베타차단제 길항제.","Correct. Glucagon is the antidote.") }, { text: loc("Naloxone","Naloxone"), effect: { hp: -38, rep: -28 }, log: loc("아편제 해독제.","Opioid antidote.") }, { text: loc("관찰만","Just observe"), effect: { hp: -42, rep: -32 }, log: loc("심정지 위험.","Cardiac arrest risk.") }, { text: loc("베타차단제 추가","More beta-blocker"), effect: { hp: -50, rep: -38 }, log: loc("절대 금기.","Absolutely contraindicated.") }]) }; }
function generateCCBOverdoseQuestion() { return { baseId: "ccbOverdose", categoryKey: "adult", part: loc("약물 중독","Drug Toxicity"), emoji: "💊", title: loc("칼슘차단제 과량","CCB Overdose"), desc: loc(`Verapamil 과량 환자에서 1차 해독제는?`,`Antidote for verapamil overdose?`), choices: shuffle([{ text: loc("Calcium gluconate IV + 고용량 인슐린·수액","IV calcium gluconate + high-dose insulin/fluids"), effect: { hp: -3, rep: 22 }, log: loc("정답. 칼슘 보충이 1차, HIET가 보조.","Correct. Calcium first; high-dose insulin is adjunct.") }, { text: loc("Naloxone","Naloxone"), effect: { hp: -38, rep: -28 }, log: loc("관련 없음.","Unrelated.") }, { text: loc("Activated charcoal만","Activated charcoal only"), effect: { hp: -32, rep: -22 }, log: loc("부족.","Insufficient.") }, { text: loc("관찰만","Just observe"), effect: { hp: -42, rep: -32 }, log: loc("심정지 위험.","Cardiac arrest risk.") }]) }; }
function generateLevothyroxineQuestion() { return { baseId: "levothyroxine", categoryKey: "adult", part: loc("갑상선 약물","Thyroid Drugs"), emoji: "💊", title: loc("Levothyroxine 복용 교육","Levothyroxine Teaching"), desc: loc(`Levothyroxine을 복용하는 환자에게 옳은 교육은?`,`Correct teaching for levothyroxine?`), choices: shuffle([{ text: loc("아침 공복에 복용·30~60분 후 식사·평생 복용","Take in the morning fasting; eat 30-60 min later; lifelong therapy"), effect: { hp: -2, rep: 22 }, log: loc("정답. 칼슘·철분과 4시간 이상 간격.","Correct. Separate from Ca/Fe by 4+ hours.") }, { text: loc("증상 완화 시 즉시 중단","Stop when symptoms resolve"), effect: { hp: -32, rep: -22 }, log: loc("재발 - 평생 복용.","Recurs — lifelong.") }, { text: loc("우유와 함께 복용","Take with milk"), effect: { hp: -25, rep: -15 }, log: loc("흡수 저하.","Reduces absorption.") }, { text: loc("취침 전","At bedtime"), effect: { hp: -22, rep: -12 }, log: loc("아침 공복이 표준.","Morning fasting is standard.") }]) }; }
function generateNGInsertionQuestion() { return { baseId: "ngInsertion", categoryKey: "fundamentals", part: loc("비위관 삽입","NG Insertion"), emoji: "👃", title: loc("NG 삽입 시 환자 자세","NG Insertion Position"), desc: loc(`NG tube 삽입 시 환자에게 가장 적절한 자세는?`,`Best position for NG tube insertion?`), choices: shuffle([{ text: loc("좌위(High Fowler's) + 통과 시 턱을 가슴쪽으로","High Fowler's + chin to chest as tube advances"), effect: { hp: -2, rep: 22 }, log: loc("정답. 흡인 예방·식도 진입.","Correct. Prevents aspiration, aids esophageal entry.") }, { text: loc("앙와위","Supine"), effect: { hp: -28, rep: -20 }, log: loc("흡인 위험 증가.","Increased aspiration risk.") }, { text: loc("Trendelenburg","Trendelenburg"), effect: { hp: -32, rep: -22 }, log: loc("부적절.","Inappropriate.") }, { text: loc("복위","Prone"), effect: { hp: -38, rep: -28 }, log: loc("불가능.","Impossible.") }]) }; }
function generateSterileGloveQuestion() { return { baseId: "sterileGlove", categoryKey: "fundamentals", part: loc("멸균술","Sterile Technique"), emoji: "🧤", title: loc("멸균 장갑 착용","Sterile Gloving"), desc: loc(`멸균 장갑 착용 시 절대 금기인 행동은?`,`What is absolutely forbidden when donning sterile gloves?`), choices: shuffle([{ text: loc("장갑 외부를 맨손으로 만짐","Touching the outside of the glove with bare skin"), effect: { hp: -3, rep: 22 }, log: loc("정답. 손은 cuff 안쪽만 만짐.","Correct. Bare skin only touches the cuff inside.") }, { text: loc("두 번째 장갑은 외부를 맨 장갑으로 만짐","Pick up the 2nd glove with the gloved hand on outside"), effect: { hp: -22, rep: -12 }, log: loc("이는 올바른 방법.","That's correct technique.") }, { text: loc("cuff를 펼친 채로 손을 넣음","Insert hand with cuff unfolded"), effect: { hp: -22, rep: -12 }, log: loc("올바른 방법.","Correct technique.") }, { text: loc("장갑을 허리 위에서만 유지","Keep gloves above waist"), effect: { hp: -22, rep: -12 }, log: loc("올바른 원칙.","Correct principle.") }]) }; }
function generateSpongeBathQuestion() { return { baseId: "spongeBath", categoryKey: "fundamentals", part: loc("간호","Hygiene"), emoji: "🛁", title: loc("스폰지 목욕 순서","Sponge Bath Order"), desc: loc(`전신 스폰지 목욕 시 가장 처음 닦아야 할 부위는?`,`Which area is washed first in a complete sponge bath?`), choices: shuffle([{ text: loc("얼굴(눈→코→이마→뺨)","Face (eyes → nose → forehead → cheeks)"), effect: { hp: -2, rep: 22 }, log: loc("정답. 가장 청결한 부위부터 → 더러운 부위로.","Correct. Cleanest first → dirtiest last.") }, { text: loc("발","Feet"), effect: { hp: -22, rep: -12 }, log: loc("발은 마지막.","Feet last.") }, { text: loc("회음부","Perineum"), effect: { hp: -25, rep: -15 }, log: loc("회음부는 마지막.","Perineum last.") }, { text: loc("등","Back"), effect: { hp: -22, rep: -12 }, log: loc("등은 중간 단계.","Back is middle.") }]) }; }
function generateNasalCannulaO2Question() { return { baseId: "nasalCannulaO2", categoryKey: "fundamentals", part: loc("산소요법","Oxygen Therapy"), emoji: "🫁", title: loc("비강캐뉼라 최대 유속","Max Nasal Cannula Flow"), desc: loc(`비강캐뉼라로 안전하게 투여 가능한 최대 유속과 그때의 FiO2는?`,`Maximum safe flow and FiO2 with nasal cannula?`), choices: shuffle([{ text: loc("6 L/min, 약 44%","6 L/min, ~44%"), effect: { hp: -2, rep: 22 }, log: loc("정답. 1L=24%, 2L=28%, 4L=36%, 6L=44%.","Correct. 1L=24%, 2L=28%, 4L=36%, 6L=44%.") }, { text: loc("15 L/min, 100%","15 L/min, 100%"), effect: { hp: -32, rep: -22 }, log: loc("이는 비재호흡 마스크.","That's a non-rebreather.") }, { text: loc("10 L/min","10 L/min"), effect: { hp: -28, rep: -20 }, log: loc("점막 자극·고농도 위험.","Mucosal damage, high FiO2 risk.") }, { text: loc("0.5 L/min, 21%","0.5 L/min, 21%"), effect: { hp: -25, rep: -15 }, log: loc("최대가 아닌 최소.","Minimum, not max.") }]) }; }
function generateBMIQuestion() { return { baseId: "bmi", categoryKey: "community", part: loc("BMI","BMI"), emoji: "📏", title: loc("BMI 분류","BMI Categories"), desc: loc(`BMI 32 kg/m²인 환자의 분류는?`,`Patient with BMI 32 kg/m². Classification?`), choices: shuffle([{ text: loc("비만 1단계(Class I obesity, 30~34.9)","Class I obesity (30-34.9)"), effect: { hp: -2, rep: 22 }, log: loc("정답. 정상 18.5-24.9, 과체중 25-29.9, 비만I 30-34.9, II 35-39.9, III ≥40.","Correct. 18.5-24.9 normal, 25-29.9 overweight, 30-34.9 Class I, 35-39.9 II, ≥40 III.") }, { text: loc("정상 체중","Normal weight"), effect: { hp: -28, rep: -20 }, log: loc("18.5~24.9가 정상.","Normal is 18.5-24.9.") }, { text: loc("과체중","Overweight"), effect: { hp: -22, rep: -12 }, log: loc("25~29.9가 과체중.","Overweight is 25-29.9.") }, { text: loc("초고도비만","Class III"), effect: { hp: -22, rep: -12 }, log: loc("≥40이 Class III.","≥40 is Class III.") }]) }; }

// ========= 배치 12: 심혈관 고급 10문제 =========
function generateMitralStenosisQuestion() { return { baseId: "mitralStenosis", categoryKey: "adult", part: loc("판막","Valves"), emoji: "🫀", title: loc("승모판 협착","Mitral Stenosis"), desc: loc(`승모판 협착증의 가장 흔한 원인은?`,`Most common cause of mitral stenosis?`), choices: shuffle([{ text: loc("류마티스열","Rheumatic fever"), effect: { hp: -2, rep: 22 }, log: loc("정답. 어린 시절 연쇄상구균 감염 후유증.","Correct. Sequela of childhood strep infection.") }, { text: loc("선천성 기형","Congenital malformation"), effect: { hp: -22, rep: -12 }, log: loc("드뭄.","Rare.") }, { text: loc("MI","Myocardial infarction"), effect: { hp: -25, rep: -15 }, log: loc("MI는 승모판 역류 유발.","MI causes regurgitation, not stenosis.") }, { text: loc("고혈압","Hypertension"), effect: { hp: -25, rep: -15 }, log: loc("주된 원인 아님.","Not main cause.") }]) }; }
function generateAorticStenosisMurmurQuestion() { return { baseId: "asMurmur", categoryKey: "adult", part: loc("심음","Heart Sounds"), emoji: "🎵", title: loc("대동맥 협착 청진","AS Auscultation"), desc: loc(`대동맥판 협착의 특징적 잡음은?`,`Characteristic murmur of aortic stenosis?`), choices: shuffle([{ text: loc("우상흉골연 수축기 분출성 잡음(crescendo-decrescendo)","Right upper sternal border systolic ejection murmur"), effect: { hp: -2, rep: 22 }, log: loc("정답. 경동맥으로 방사.","Correct. Radiates to carotids.") }, { text: loc("심첨부 이완기 잡음","Apical diastolic murmur"), effect: { hp: -22, rep: -12 }, log: loc("승모판 협착 패턴.","Pattern for mitral stenosis.") }, { text: loc("좌하흉골연 수축기 잡음","Left lower sternal border systolic"), effect: { hp: -22, rep: -12 }, log: loc("VSD에서 더 흔함.","More common in VSD.") }, { text: loc("연속성 잡음","Continuous machine murmur"), effect: { hp: -22, rep: -12 }, log: loc("PDA의 특징.","PDA characteristic.") }]) }; }
function generateEndocarditisProphyQuestion() { return { baseId: "endoProphy", categoryKey: "adult", part: loc("감염성 심내막염","IE Prophylaxis"), emoji: "🦷", title: loc("심내막염 예방","Endocarditis Prophylaxis"), desc: loc(`인공 판막 환자가 치과 발치를 받을 때 권장되는 예방 약물·시점은?`,`Patient with prosthetic valve undergoing dental extraction. Prophylaxis?`), choices: shuffle([{ text: loc("Amoxicillin 2g 경구, 시술 30~60분 전","Amoxicillin 2g PO 30-60 min before procedure"), effect: { hp: -2, rep: 22 }, log: loc("정답. 알레르기 시 Clindamycin.","Correct. Clindamycin if allergic.") }, { text: loc("시술 후 즉시 정맥 항생제","IV antibiotic right after procedure"), effect: { hp: -25, rep: -15 }, log: loc("시술 전 투여가 표준.","Before procedure is standard.") }, { text: loc("예방 불필요","No prophylaxis needed"), effect: { hp: -32, rep: -22 }, log: loc("인공판막은 고위험군.","Prosthetic valve = high risk.") }, { text: loc("Vancomycin만","Vancomycin only"), effect: { hp: -22, rep: -12 }, log: loc("심한 알레르기 시.","Only for severe allergy.") }]) }; }
function generatePADQuestion() { return { baseId: "pad", categoryKey: "adult", part: loc("말초혈관","Vascular"), emoji: "🦵", title: loc("PAD vs DVT","PAD vs DVT"), desc: loc(`다리 통증이 보행 시 악화되고 휴식 시 호전되는 환자의 진단은?`,`Leg pain worse with walking, better with rest. Diagnosis?`), choices: shuffle([{ text: loc("말초동맥질환(PAD) - 간헐성 파행","Peripheral arterial disease — claudication"), effect: { hp: -2, rep: 22 }, log: loc("정답. ABI 측정으로 진단.","Correct. Diagnosed with ABI.") }, { text: loc("DVT","Deep vein thrombosis"), effect: { hp: -25, rep: -15 }, log: loc("DVT는 부동·열감·부종.","DVT: stationary, warmth, swelling.") }, { text: loc("정상 노화","Normal aging"), effect: { hp: -28, rep: -20 }, log: loc("재현 가능한 증상.","Reproducible symptom.") }, { text: loc("관절염","Arthritis"), effect: { hp: -28, rep: -20 }, log: loc("관절통 패턴이 다름.","Joint pain pattern differs.") }]) }; }
function generateRaynaudQuestion() { return { baseId: "raynaud", categoryKey: "adult", part: loc("말초혈관","Vascular"), emoji: "🤏", title: loc("레이노 현상","Raynaud Phenomenon"), desc: loc(`찬 노출이나 스트레스 시 손가락이 흰색→파란색→빨간색으로 변하는 환자에 대한 핵심 교육은?`,`Fingers turn white→blue→red with cold/stress. Key teaching?`), choices: shuffle([{ text: loc("추위·금연·카페인 회피, 손 보온","Avoid cold/smoking/caffeine; keep hands warm"), effect: { hp: -2, rep: 22 }, log: loc("정답. 심한 경우 CCB(Nifedipine).","Correct. Severe cases: CCB (nifedipine).") }, { text: loc("얼음찜질 권장","Encourage ice packs"), effect: { hp: -32, rep: -22 }, log: loc("증상을 더 유발.","Provokes symptoms.") }, { text: loc("강한 운동만","Just vigorous exercise"), effect: { hp: -22, rep: -12 }, log: loc("불충분.","Insufficient.") }, { text: loc("관찰만","Just observe"), effect: { hp: -25, rep: -15 }, log: loc("교육이 핵심.","Teaching is key.") }]) }; }
function generateCardiogenicShockQuestion() { return { baseId: "cardiogenicShock", categoryKey: "adult", part: loc("쇼크","Shock"), emoji: "💔", title: loc("심인성 쇼크","Cardiogenic Shock"), desc: loc(`MI 후 환자가 저혈압·핍뇨·차고 축축한 피부를 보인다. 1차 약물 치료 목표는?`,`Post-MI patient: hypotension, oliguria, cold clammy skin. First drug goal?`), choices: shuffle([{ text: loc("심박출량 증가(Dobutamine·Norepinephrine)","Increase cardiac output (dobutamine, norepinephrine)"), effect: { hp: -3, rep: 22 }, log: loc("정답. 수액은 신중·심실 부하 증가 위험.","Correct. Cautious with fluids — preload risk.") }, { text: loc("대량 IV 식염수","Large IV saline boluses"), effect: { hp: -32, rep: -22 }, log: loc("폐부종 악화.","Worsens pulmonary edema.") }, { text: loc("이뇨제만","Diuretics only"), effect: { hp: -28, rep: -20 }, log: loc("저혈압 악화.","Worsens hypotension.") }, { text: loc("관찰만","Just observe"), effect: { hp: -42, rep: -32 }, log: loc("응급.","Emergency.") }]) }; }
function generateUnstableAnginaQuestion() { return { baseId: "unstableAngina", categoryKey: "adult", part: loc("협심증","Angina"), emoji: "💔", title: loc("안정 vs 불안정 협심증","Stable vs Unstable Angina"), desc: loc(`평소 활동 정도에서도 흉통이 발생하고 점차 빈도·강도가 증가하는 협심증은?`,`Angina occurring with progressively less exertion, increasing in frequency. Type?`), choices: shuffle([{ text: loc("불안정 협심증 - ACS로 분류, 응급 평가","Unstable angina — classified as ACS, emergent eval"), effect: { hp: -3, rep: 22 }, log: loc("정답. MI로 진행 위험 큼.","Correct. High risk of progression to MI.") }, { text: loc("안정 협심증","Stable angina"), effect: { hp: -28, rep: -20 }, log: loc("안정은 예측 가능·휴식으로 호전.","Stable is predictable, relieved by rest.") }, { text: loc("프린즈메탈 협심증","Prinzmetal's angina"), effect: { hp: -25, rep: -15 }, log: loc("관상동맥 경련, 휴식 시 발생.","Coronary spasm, occurs at rest.") }, { text: loc("정상 가슴 두근거림","Normal palpitations"), effect: { hp: -32, rep: -22 }, log: loc("응급을 놓침.","Misses emergency.") }]) }; }
function generateRheumaticFeverQuestion() { return { baseId: "rheumaticFever", categoryKey: "pediatric", part: loc("급성 류마티스열","Rheumatic Fever"), emoji: "🌡️", title: loc("Jones 진단 기준","Jones Criteria"), desc: loc(`급성 류마티스열의 Jones 주(Major) 기준에 해당하지 않는 것은?`,`Which is NOT a Jones MAJOR criterion for rheumatic fever?`), choices: shuffle([{ text: loc("발열","Fever"), effect: { hp: -2, rep: 22 }, log: loc("정답(이게 minor). Major: 심염·다발성관절염·무도병·홍반·피하결절(JONES).","Correct (this is MINOR). Majors: carditis, polyarthritis, chorea, erythema, nodules.") }, { text: loc("이동성 다발성관절염","Migratory polyarthritis"), effect: { hp: -22, rep: -12 }, log: loc("Major 기준.","Major criterion.") }, { text: loc("심염","Carditis"), effect: { hp: -22, rep: -12 }, log: loc("Major 기준.","Major.") }, { text: loc("무도병(Sydenham chorea)","Sydenham chorea"), effect: { hp: -22, rep: -12 }, log: loc("Major 기준.","Major.") }]) }; }
function generateBetaBlockerContraQuestion() { return { baseId: "bbContra", categoryKey: "adult", part: loc("약물 금기","Drug Contraindications"), emoji: "💊", title: loc("베타차단제 금기","Beta-Blocker Contraindications"), desc: loc(`다음 중 베타차단제(예: Metoprolol)의 절대 금기는?`,`Absolute contraindication for a beta-blocker (e.g., metoprolol)?`), choices: shuffle([{ text: loc("심한 천식·2도 이상의 방실차단","Severe asthma · 2nd-degree+ AV block"), effect: { hp: -3, rep: 22 }, log: loc("정답. 기관지경련·서맥 악화.","Correct. Bronchospasm, worsens bradycardia.") }, { text: loc("고혈압","Hypertension"), effect: { hp: -25, rep: -15 }, log: loc("이는 적응증.","That's an indication.") }, { text: loc("심부전","Heart failure"), effect: { hp: -25, rep: -15 }, log: loc("HFrEF에 권장.","Recommended for HFrEF.") }, { text: loc("MI 후","Post-MI"), effect: { hp: -25, rep: -15 }, log: loc("적응증 - 사망률 감소.","Indicated — reduces mortality.") }]) }; }
function generateCardiacRehabQuestion() { return { baseId: "cardiacRehab", categoryKey: "adult", part: loc("심장재활","Cardiac Rehab"), emoji: "🏃", title: loc("심장재활 단계","Cardiac Rehab Phases"), desc: loc(`MI 후 입원 중 환자에게 시행되는 단계는?`,`Cardiac rehab phase given to a patient still hospitalized after MI?`), choices: shuffle([{ text: loc("Phase I (입원 단계) - 침상 활동·자기관리 교육","Phase I (inpatient) — bed activities, self-care education"), effect: { hp: -2, rep: 22 }, log: loc("정답. II=외래 감독, III=유지·운동, IV=장기 자율.","Correct. II=outpatient supervised, III=maintenance, IV=independent.") }, { text: loc("Phase II - 자가 운동","Phase II — independent exercise"), effect: { hp: -22, rep: -12 }, log: loc("Phase II는 외래 감독 운동.","Phase II is supervised outpatient.") }, { text: loc("Phase III","Phase III"), effect: { hp: -22, rep: -12 }, log: loc("유지 단계.","Maintenance phase.") }, { text: loc("Phase IV","Phase IV"), effect: { hp: -22, rep: -12 }, log: loc("장기 자율 단계.","Long-term independent.") }]) }; }

// ========= 배치 13: 호흡기·감염 10문제 =========
function generateWellsScoreQuestion() { return { baseId: "wellsScore", categoryKey: "adult", part: loc("PE 위험","PE Risk"), emoji: "🫁", title: loc("Wells 점수","Wells Score"), desc: loc(`Wells 점수에서 가장 높은 점수(3점)에 해당하는 항목은?`,`Highest-scoring (3 points) item on the Wells PE score?`), choices: shuffle([{ text: loc("PE보다 가능성 큰 다른 진단 없음 + DVT 임상 징후","PE more likely than alternative + clinical signs of DVT"), effect: { hp: -2, rep: 22 }, log: loc("정답. 두 항목 각각 3점.","Correct. Each item scores 3 points.") }, { text: loc("이전 PE/DVT 병력","Prior PE/DVT"), effect: { hp: -22, rep: -12 }, log: loc("1.5점.","1.5 points.") }, { text: loc("심박수 >100","HR >100"), effect: { hp: -22, rep: -12 }, log: loc("1.5점.","1.5 points.") }, { text: loc("객혈","Hemoptysis"), effect: { hp: -22, rep: -12 }, log: loc("1점.","1 point.") }]) }; }
function generateSleepApneaQuestion() { return { baseId: "sleepApnea", categoryKey: "adult", part: loc("수면장애","Sleep Disorder"), emoji: "😴", title: loc("폐쇄성 수면무호흡","OSA"), desc: loc(`OSA로 진단받은 환자의 1차 치료는?`,`First-line treatment for confirmed OSA?`), choices: shuffle([{ text: loc("CPAP 야간 적용 + 체중 감량·자세 교정","Nightly CPAP + weight loss/positional therapy"), effect: { hp: -2, rep: 22 }, log: loc("정답. 심혈관·인지 합병증 예방.","Correct. Prevents cardiac/cognitive complications.") }, { text: loc("수면제만","Sleeping pills only"), effect: { hp: -32, rep: -22 }, log: loc("호흡억제로 악화.","Worsens by depressing respiration.") }, { text: loc("관찰만","Just observe"), effect: { hp: -28, rep: -20 }, log: loc("뇌졸중·MI 위험.","Stroke/MI risk.") }, { text: loc("기관절개술 즉시","Immediate tracheostomy"), effect: { hp: -25, rep: -15 }, log: loc("최후 수단.","Last resort.") }]) }; }
function generateSpirometryQuestion() { return { baseId: "spirometry", categoryKey: "adult", part: loc("폐기능검사","PFT"), emoji: "📊", title: loc("FEV1/FVC 비율","FEV1/FVC Ratio"), desc: loc(`FEV1/FVC <70%·FEV1 60% 환자에서 의심되는 폐질환은?`,`FEV1/FVC <70% with FEV1 60%. Lung disease pattern?`), choices: shuffle([{ text: loc("폐쇄성 질환(COPD·천식)","Obstructive disease (COPD/asthma)"), effect: { hp: -2, rep: 22 }, log: loc("정답. <70% = obstructive. 제한성은 ≥70%·FVC↓.","Correct. <70% = obstructive. Restrictive: ≥70% with low FVC.") }, { text: loc("제한성 질환","Restrictive disease"), effect: { hp: -22, rep: -12 }, log: loc("FEV1/FVC 정상 또는 증가.","FEV1/FVC normal or up.") }, { text: loc("정상","Normal"), effect: { hp: -28, rep: -20 }, log: loc("70% 미만은 비정상.","<70% is abnormal.") }, { text: loc("혼합형","Mixed"), effect: { hp: -22, rep: -12 }, log: loc("FVC도 감소해야 함.","FVC must also drop.") }]) }; }
function generateCOPoisoningQuestion() { return { baseId: "coPoisoning", categoryKey: "adult", part: loc("중독","Toxicology"), emoji: "🔥", title: loc("일산화탄소 중독","CO Poisoning"), desc: loc(`화재 후 두통·어지럼·체리색 피부의 환자에서 1차 처치는?`,`Post-fire patient: headache, dizziness, cherry-red skin. First action?`), choices: shuffle([{ text: loc("100% 산소 비재호흡 마스크 (필요시 고압산소)","100% oxygen via non-rebreather (HBO if severe)"), effect: { hp: -3, rep: 22 }, log: loc("정답. CO 반감기를 300분 → 90분으로 단축.","Correct. Reduces CO half-life from 300 to 90 min.") }, { text: loc("실내 공기로 충분","Room air is enough"), effect: { hp: -42, rep: -32 }, log: loc("CO는 산소화로 제거.","CO requires oxygen.") }, { text: loc("관찰만","Just observe"), effect: { hp: -45, rep: -32 }, log: loc("뇌 손상·사망 위험.","Brain damage/death risk.") }, { text: loc("이뇨제만","Diuretics only"), effect: { hp: -38, rep: -28 }, log: loc("관련 없음.","Unrelated.") }]) }; }
function generateInfluenzaVaccineQuestion() { return { baseId: "fluVaccine", categoryKey: "community", part: loc("예방접종","Immunization"), emoji: "💉", title: loc("인플루엔자 백신","Influenza Vaccine"), desc: loc(`인플루엔자 백신을 매년 맞아야 하는 가장 큰 이유는?`,`Why must influenza vaccine be given every year?`), choices: shuffle([{ text: loc("바이러스 항원 변이 + 면역 감퇴","Antigenic drift/shift + waning immunity"), effect: { hp: -2, rep: 22 }, log: loc("정답. 매 시즌 균주 업데이트.","Correct. Strain updated each season.") }, { text: loc("백신 효과가 24시간만 지속","Effect lasts only 24 hours"), effect: { hp: -28, rep: -20 }, log: loc("그렇게 짧지 않음.","Not that short.") }, { text: loc("법으로 의무","Required by law"), effect: { hp: -25, rep: -15 }, log: loc("권장이지 의무 아님(일부 직군 제외).","Recommended, not mandatory (some occupations).") }, { text: loc("주는 안 맞아도 됨","Skip a year is fine"), effect: { hp: -25, rep: -15 }, log: loc("취약군은 매년 권장.","Annual for vulnerable.") }]) }; }
function generateMRSAIsolationQuestion() { return { baseId: "mrsaIsolation", categoryKey: "fundamentals", part: loc("격리","Isolation"), emoji: "🦠", title: loc("MRSA 격리","MRSA Isolation"), desc: loc(`MRSA 보균자 환자 간호 시 적용해야 할 격리는?`,`Isolation precautions for an MRSA carrier?`), choices: shuffle([{ text: loc("접촉주의(Contact)·1인실·전용 장비","Contact precautions, private room, dedicated equipment"), effect: { hp: -2, rep: 22 }, log: loc("정답. 장갑·가운 착용·손위생.","Correct. Gloves, gown, hand hygiene.") }, { text: loc("공기주의","Airborne"), effect: { hp: -22, rep: -12 }, log: loc("결핵·수두 등에 적용.","For TB, varicella, etc.") }, { text: loc("표준주의만","Standard only"), effect: { hp: -28, rep: -20 }, log: loc("MRSA는 추가 접촉주의 필요.","MRSA needs added contact precautions.") }, { text: loc("역격리","Reverse isolation"), effect: { hp: -25, rep: -15 }, log: loc("면역결핍 환자 보호용.","For immunocompromised protection.") }]) }; }
function generateCDiffQuestion() { return { baseId: "cdiff", categoryKey: "adult", part: loc("감염","Infection"), emoji: "💩", title: loc("C. difficile 진단·치료","C. difficile"), desc: loc(`항생제 치료 중 환자가 빈번한 수양성 설사·복통을 호소한다. 1차 치료는?`,`Patient on antibiotics: frequent watery diarrhea, abdominal pain. First-line treatment?`), choices: shuffle([{ text: loc("원인 항생제 중단 + 경구 Vancomycin 또는 Fidaxomicin","Stop offending antibiotic + oral vancomycin or fidaxomicin"), effect: { hp: -3, rep: 22 }, log: loc("정답. Metronidazole은 더 이상 1차 아님.","Correct. Metronidazole no longer first-line.") }, { text: loc("Loperamide로 설사 멎춤","Stop diarrhea with loperamide"), effect: { hp: -38, rep: -28 }, log: loc("독성 거대결장 위험.","Toxic megacolon risk.") }, { text: loc("기존 항생제 계속 + 추가 항생제","Continue antibiotics + add more"), effect: { hp: -32, rep: -22 }, log: loc("악화.","Worsens.") }, { text: loc("관찰만","Just observe"), effect: { hp: -32, rep: -22 }, log: loc("심해질 수 있음.","Can deteriorate.") }]) }; }
function generateMERSCOVQuestion() { return { baseId: "mersCov", categoryKey: "community", part: loc("신종 감염","Emerging Infection"), emoji: "😷", title: loc("MERS-CoV 격리","MERS-CoV Isolation"), desc: loc(`MERS 의심 환자의 격리 기준은?`,`Isolation precaution for suspected MERS?`), choices: shuffle([{ text: loc("공기주의 + 접촉주의 + 표준주의 + N95","Airborne + contact + standard + N95"), effect: { hp: -3, rep: 22 }, log: loc("정답. 음압격리실·1인실.","Correct. Negative-pressure private room.") }, { text: loc("표준주의만","Standard only"), effect: { hp: -45, rep: -32 }, log: loc("심각한 감염 위험.","Serious transmission risk.") }, { text: loc("비말주의만","Droplet only"), effect: { hp: -32, rep: -22 }, log: loc("공기·접촉도 필요.","Need airborne+contact too.") }, { text: loc("격리 불필요","No isolation"), effect: { hp: -45, rep: -32 }, log: loc("심각한 위반.","Serious violation.") }]) }; }
function generateBordertelosisQuestion() { return { baseId: "lyme", categoryKey: "community", part: loc("벡터 매개 감염","Vector-Borne"), emoji: "🦟", title: loc("라임병","Lyme Disease"), desc: loc(`사슴 진드기에 물린 후 \"황소눈(target)\" 발진이 나타난 환자의 1차 치료는?`,`Bull's-eye rash after deer tick bite. First-line treatment?`), choices: shuffle([{ text: loc("Doxycycline 경구 14~21일","Oral doxycycline 14-21 days"), effect: { hp: -2, rep: 22 }, log: loc("정답. 임신부·8세 미만은 Amoxicillin.","Correct. Amoxicillin if pregnant or <8 yrs.") }, { text: loc("관찰만","Just observe"), effect: { hp: -38, rep: -28 }, log: loc("만성 라임병 위험.","Chronic Lyme risk.") }, { text: loc("Acyclovir","Acyclovir"), effect: { hp: -25, rep: -15 }, log: loc("바이러스용.","For viruses.") }, { text: loc("스테로이드","Steroids"), effect: { hp: -32, rep: -22 }, log: loc("감염 악화.","Worsens infection.") }]) }; }
function generateNeedleSafetyQuestion() { return { baseId: "needleSafety", categoryKey: "fundamentals", part: loc("바늘 안전","Needle Safety"), emoji: "💉", title: loc("바늘 안전 처리","Needle Safety"), desc: loc(`사용한 주삿바늘 처리 시 가장 안전한 방법은?`,`Safest method for handling a used needle?`), choices: shuffle([{ text: loc("재캡핑하지 말고 즉시 sharps container에 폐기","Do NOT recap; dispose directly in sharps container"), effect: { hp: -2, rep: 22 }, log: loc("정답. 재캡핑이 가장 흔한 자상 원인.","Correct. Recapping is #1 needlestick cause.") }, { text: loc("두 손으로 재캡핑 후 폐기","Two-handed recap, then dispose"), effect: { hp: -38, rep: -28 }, log: loc("절대 금기.","Absolutely contraindicated.") }, { text: loc("일반 휴지통에 폐기","Toss in regular trash"), effect: { hp: -45, rep: -32 }, log: loc("환경미화원 노출 위험.","Risk to sanitation workers.") }, { text: loc("물에 담가 소독","Soak in water"), effect: { hp: -32, rep: -22 }, log: loc("부적절.","Inappropriate.") }]) }; }

// ========= 배치 14: 다중 시나리오 (각 4-6 변이) 10문제 =========
function generateAgeVitalSignsQuestion() {
    const ages = [
        { ageKo: "신생아(0-1개월)", ageEn: "Newborn (0-1 mo)", correctKo: "심박 100~205, 호흡 30~60", correctEn: "HR 100-205, RR 30-60" },
        { ageKo: "영아(1-12개월)", ageEn: "Infant (1-12 mo)", correctKo: "심박 100~180, 호흡 24~40", correctEn: "HR 100-180, RR 24-40" },
        { ageKo: "유아(1-3세)", ageEn: "Toddler (1-3 yr)", correctKo: "심박 80~140, 호흡 20~30", correctEn: "HR 80-140, RR 20-30" },
        { ageKo: "학령전(3-6세)", ageEn: "Preschool (3-6 yr)", correctKo: "심박 70~120, 호흡 20~28", correctEn: "HR 70-120, RR 20-28" },
        { ageKo: "학령기(6-12세)", ageEn: "School age (6-12)", correctKo: "심박 65~110, 호흡 18~25", correctEn: "HR 65-110, RR 18-25" },
        { ageKo: "청소년(12세+)", ageEn: "Adolescent (12+)", correctKo: "심박 60~100, 호흡 12~20", correctEn: "HR 60-100, RR 12-20" },
    ];
    const target = pick(ages);
    const wrong = ages.filter(a => a !== target);
    return { baseId: "ageVitals", categoryKey: "pediatric", part: loc("연령별 활력징후","Age VS"), emoji: "👶",
        title: loc("연령별 정상 활력징후","Age-Specific Normal VS"),
        desc: loc(`${loc(target.ageKo, target.ageEn)}의 정상 심박수·호흡수 범위는?`,`Normal HR/RR for ${loc(target.ageKo, target.ageEn)}?`),
        choices: shuffle([
            { text: loc(target.correctKo, target.correctEn), effect: { hp: -2, rep: 22 }, log: loc("정답.","Correct.") },
            { text: loc(wrong[0].correctKo, wrong[0].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 연령대.","Different age group.") },
            { text: loc(wrong[1].correctKo, wrong[1].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 연령대.","Different age group.") },
            { text: loc(wrong[2].correctKo, wrong[2].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 연령대.","Different age group.") }
        ])
    };
}
function generateImmunizationByAgeQuestion() {
    const schedules = [
        { ageKo: "출생", ageEn: "Birth", correctKo: "B형간염 1차", correctEn: "Hepatitis B (1st dose)" },
        { ageKo: "4주 이내", ageEn: "Within 4 weeks", correctKo: "BCG (결핵)", correctEn: "BCG (tuberculosis)" },
        { ageKo: "2개월", ageEn: "2 months", correctKo: "DTaP/IPV/Hib/PCV/Rotavirus 1차", correctEn: "DTaP/IPV/Hib/PCV/Rotavirus (1st)" },
        { ageKo: "12-15개월", ageEn: "12-15 months", correctKo: "MMR + 수두 1차", correctEn: "MMR + Varicella (1st)" },
        { ageKo: "만 4-6세", ageEn: "4-6 years", correctKo: "DTaP/IPV/MMR/수두 추가접종", correctEn: "DTaP/IPV/MMR/Varicella boosters" },
    ];
    const target = pick(schedules);
    const wrong = schedules.filter(s => s !== target);
    return { baseId: "immunByAge", categoryKey: "pediatric", part: loc("예방접종","Immunization"), emoji: "💉",
        title: loc("연령별 예방접종","Age-Based Immunization"),
        desc: loc(`${loc(target.ageKo, target.ageEn)}에 시행하는 표준 예방접종은?`,`Routine immunization at ${loc(target.ageKo, target.ageEn)}?`),
        choices: shuffle([
            { text: loc(target.correctKo, target.correctEn), effect: { hp: -2, rep: 22 }, log: loc("정답.","Correct.") },
            { text: loc(wrong[0].correctKo, wrong[0].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 시기.","Different age.") },
            { text: loc(wrong[1].correctKo, wrong[1].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 시기.","Different age.") },
            { text: loc(wrong[2].correctKo, wrong[2].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 시기.","Different age.") }
        ])
    };
}
function generatePostopComplicationQuestion() {
    const days = [
        { dayKo: "수술 24시간 이내", dayEn: "Within 24 hours", correctKo: "출혈·쇼크 모니터링", correctEn: "Monitor for bleeding/shock" },
        { dayKo: "수술 1-2일", dayEn: "POD 1-2", correctKo: "무기폐·폐렴 예방(IS·심호흡)", correctEn: "Prevent atelectasis (IS, deep breathing)" },
        { dayKo: "수술 3-5일", dayEn: "POD 3-5", correctKo: "감염 징후·DVT", correctEn: "Infection signs + DVT" },
        { dayKo: "수술 5-7일", dayEn: "POD 5-7", correctKo: "상처 열개 위험", correctEn: "Wound dehiscence risk" },
        { dayKo: "수술 1-2주", dayEn: "Week 1-2", correctKo: "재활·보행 격려", correctEn: "Rehabilitation, ambulation" },
    ];
    const target = pick(days);
    const wrong = days.filter(d => d !== target);
    return { baseId: "postopByDay", categoryKey: "adult", part: loc("수술 후 간호","Postop Care"), emoji: "🏨",
        title: loc("수술 후 일자별 우선순위","Postop Day Priority"),
        desc: loc(`${loc(target.dayKo, target.dayEn)} 수술 후 환자에서 가장 우선 사정해야 할 것은?`,`Top assessment priority ${loc(target.dayKo, target.dayEn)} after surgery?`),
        choices: shuffle([
            { text: loc(target.correctKo, target.correctEn), effect: { hp: -2, rep: 22 }, log: loc("정답.","Correct.") },
            { text: loc(wrong[0].correctKo, wrong[0].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 시기 우선순위.","Priority for different day.") },
            { text: loc(wrong[1].correctKo, wrong[1].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 시기 우선순위.","Priority for different day.") },
            { text: loc(wrong[2].correctKo, wrong[2].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 시기 우선순위.","Priority for different day.") }
        ])
    };
}
function generateLabAbnormalQuestion() {
    const labs = [
        { lab: "Sodium", valKo: "120 mEq/L", valEn: "120 mEq/L", normalKo: "135-145", correctKo: "저나트륨혈증 - 발작·뇌부종 위험", correctEn: "Hyponatremia — seizure, cerebral edema risk" },
        { lab: "Potassium", valKo: "6.5 mEq/L", valEn: "6.5 mEq/L", normalKo: "3.5-5.0", correctKo: "고칼륨혈증 - 부정맥·심정지 위험", correctEn: "Hyperkalemia — arrhythmia, arrest risk" },
        { lab: "Calcium", valKo: "7.2 mg/dL", valEn: "7.2 mg/dL", normalKo: "8.5-10.5", correctKo: "저칼슘혈증 - 후두경련·테타니", correctEn: "Hypocalcemia — laryngospasm, tetany" },
        { lab: "Magnesium", valKo: "1.0 mg/dL", valEn: "1.0 mg/dL", normalKo: "1.7-2.2", correctKo: "저마그네슘혈증 - 부정맥·발작", correctEn: "Hypomagnesemia — arrhythmia, seizure" },
        { lab: "Glucose", valKo: "45 mg/dL", valEn: "45 mg/dL", normalKo: "70-110", correctKo: "저혈당 - 즉시 포도당 투여", correctEn: "Hypoglycemia — give glucose now" },
    ];
    const target = pick(labs);
    const wrong = labs.filter(l => l !== target);
    return { baseId: "labAbnormal", categoryKey: "adult", part: loc("검사 해석","Lab Interpretation"), emoji: "🧪",
        title: loc("이상 검사 해석","Abnormal Lab Interpretation"),
        desc: loc(`${target.lab} ${loc(target.valKo, target.valEn)}(정상 ${target.normalKo})인 환자의 가장 우선되는 임상 의의는?`,`${target.lab} ${loc(target.valKo, target.valEn)} (normal ${target.normalKo}). Top clinical significance?`),
        choices: shuffle([
            { text: loc(target.correctKo, target.correctEn), effect: { hp: -2, rep: 22 }, log: loc("정답.","Correct.") },
            { text: loc(wrong[0].correctKo, wrong[0].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 검사 결과.","Different lab.") },
            { text: loc(wrong[1].correctKo, wrong[1].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 검사 결과.","Different lab.") },
            { text: loc(wrong[2].correctKo, wrong[2].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 검사 결과.","Different lab.") }
        ])
    };
}
function generatePregnancyTrimesterQuestion() {
    const trimesters = [
        { triKo: "1삼분기(0~13주)", triEn: "1st (0-13 wk)", correctKo: "엽산 보충·기형 위험·입덧 관리", correctEn: "Folic acid + teratogen risk + nausea care" },
        { triKo: "2삼분기(14~27주)", triEn: "2nd (14-27 wk)", correctKo: "안태기·태동 인지·다운/이분척추 선별", correctEn: "Quickening, Down/spina bifida screening" },
        { triKo: "3삼분기(28주~)", triEn: "3rd (28+ wk)", correctKo: "임신성 고혈압·당뇨 선별·태동 모니터링", correctEn: "PIH/GDM screening, fetal kick counts" },
    ];
    const target = pick(trimesters);
    const wrong = trimesters.filter(t => t !== target);
    return { baseId: "pregTrimester", categoryKey: "maternal", part: loc("산전관리","Antepartum Care"), emoji: "🤰",
        title: loc("임신 삼분기별 핵심","Trimester-Specific Care"),
        desc: loc(`${loc(target.triKo, target.triEn)} 산모의 핵심 간호·교육은?`,`Key care/teaching for ${loc(target.triKo, target.triEn)} pregnancy?`),
        choices: shuffle([
            { text: loc(target.correctKo, target.correctEn), effect: { hp: -2, rep: 22 }, log: loc("정답.","Correct.") },
            { text: loc(wrong[0].correctKo, wrong[0].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 삼분기.","Different trimester.") },
            { text: loc(wrong[1].correctKo, wrong[1].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 삼분기.","Different trimester.") },
            { text: loc("매일 강한 운동 권장","Encourage vigorous daily exercise"), effect: { hp: -25, rep: -15 }, log: loc("절대 금기 행동.","Inappropriate action.") }
        ])
    };
}
function generateChemoSideEffectVarsQuestion() {
    const drugs = [
        { drugKo: "Doxorubicin", drugEn: "Doxorubicin", correctKo: "심독성 - LVEF 모니터", correctEn: "Cardiotoxicity — monitor LVEF" },
        { drugKo: "Cisplatin", drugEn: "Cisplatin", correctKo: "신독성·이독성 - BUN/Cr·청력 모니터", correctEn: "Nephro/ototoxicity — BUN/Cr, hearing" },
        { drugKo: "Vincristine", drugEn: "Vincristine", correctKo: "신경독성 - 사지 저림·발기능 변화", correctEn: "Neurotoxicity — paresthesia, foot drop" },
        { drugKo: "Bleomycin", drugEn: "Bleomycin", correctKo: "폐섬유증 - PFT 모니터", correctEn: "Pulmonary fibrosis — monitor PFTs" },
        { drugKo: "Methotrexate", drugEn: "Methotrexate", correctKo: "골수억제·간독성 - Leucovorin 구조", correctEn: "Marrow/hepatotoxicity — leucovorin rescue" },
    ];
    const target = pick(drugs);
    const wrong = drugs.filter(d => d !== target);
    return { baseId: "chemoSideEffect", categoryKey: "adult", part: loc("항암제 부작용","Chemo Side Effects"), emoji: "💊",
        title: loc("항암제별 특이 부작용","Drug-Specific Chemo Toxicity"),
        desc: loc(`${loc(target.drugKo, target.drugEn)}의 특징적·약물별 고유 부작용은?`,`Drug-specific toxicity of ${loc(target.drugKo, target.drugEn)}?`),
        choices: shuffle([
            { text: loc(target.correctKo, target.correctEn), effect: { hp: -2, rep: 22 }, log: loc("정답.","Correct.") },
            { text: loc(wrong[0].correctKo, wrong[0].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 약물의 특징.","Different drug.") },
            { text: loc(wrong[1].correctKo, wrong[1].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 약물의 특징.","Different drug.") },
            { text: loc(wrong[2].correctKo, wrong[2].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 약물의 특징.","Different drug.") }
        ])
    };
}
function generatePsychDelusionTypesQuestion() {
    const types = [
        { delKo: "피해망상 - \"누가 나를 죽이려 한다\"", delEn: "Persecutory — 'Someone is trying to kill me'", correctKo: "공감하되 망상은 부정·논쟁 안 함, 안전 사정", correctEn: "Empathize without arguing, assess safety" },
        { delKo: "과대망상 - \"나는 세계를 구할 메시아다\"", delEn: "Grandiose — 'I am the savior'", correctKo: "조현병·양극성 의심, 환자 자존감 보호하며 현실 검증", correctEn: "Suspect schizophrenia/bipolar; reality test gently" },
        { delKo: "관계망상 - \"TV가 나에게 메시지를 보낸다\"", delEn: "Referential — 'TV is sending me messages'", correctKo: "환자의 두려움 인정, 자극 줄이기·약물 검토", correctEn: "Acknowledge fear, reduce stimuli, review meds" },
        { delKo: "신체망상 - \"내 장기가 썩고 있다\"", delEn: "Somatic — 'My organs are rotting'", correctKo: "신체 호소 진지하게, 의학적 검사로 배제 후 정신과 협진", correctEn: "Take seriously, rule out medically, then refer to psych" },
    ];
    const target = pick(types);
    const wrong = types.filter(t => t !== target);
    return { baseId: "delusionTypes", categoryKey: "psych", part: loc("망상 유형","Delusion Types"), emoji: "🧠",
        title: loc("망상 유형별 대응","Type-Specific Delusion Care"),
        desc: loc(`환자가 \"${loc(target.delKo, target.delEn)}\"라고 말한다. 가장 적절한 1차 간호는?`,`Patient says "${loc(target.delKo, target.delEn)}". Best initial care?`),
        choices: shuffle([
            { text: loc(target.correctKo, target.correctEn), effect: { hp: -2, rep: 22 }, log: loc("정답.","Correct.") },
            { text: loc(wrong[0].correctKo, wrong[0].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 유형 대응.","For a different delusion type.") },
            { text: loc("논리적으로 망상이 거짓임을 증명","Logically prove the delusion is false"), effect: { hp: -28, rep: -20 }, log: loc("망상은 논리로 풀리지 않음.","Delusions don't yield to logic.") },
            { text: loc("환자의 말을 무시하고 다른 주제","Ignore and change subject"), effect: { hp: -25, rep: -15 }, log: loc("비치료적.","Non-therapeutic.") }
        ])
    };
}
function generateNutritionalDeficiencyQuestion() {
    const defs = [
        { vitKo: "비타민 B12", vitEn: "Vitamin B12", correctKo: "거대적아구성 빈혈 + 신경병증", correctEn: "Megaloblastic anemia + neuropathy" },
        { vitKo: "엽산(Folate)", vitEn: "Folate", correctKo: "거대적아구성 빈혈, 신경계 정상, 임신 시 신경관 결손", correctEn: "Megaloblastic anemia, neuro spared, NTD in pregnancy" },
        { vitKo: "철분", vitEn: "Iron", correctKo: "소구성 저색소성 빈혈 + 피로·창백", correctEn: "Microcytic hypochromic anemia + fatigue/pallor" },
        { vitKo: "비타민 D", vitEn: "Vitamin D", correctKo: "성인 골연화증·소아 구루병", correctEn: "Adult osteomalacia, child rickets" },
        { vitKo: "비타민 K", vitEn: "Vitamin K", correctKo: "출혈 경향 - PT 연장", correctEn: "Bleeding tendency — prolonged PT" },
    ];
    const target = pick(defs);
    const wrong = defs.filter(d => d !== target);
    return { baseId: "nutritionalDef", categoryKey: "adult", part: loc("영양 결핍","Nutritional Deficiency"), emoji: "🥗",
        title: loc("영양소 결핍 임상","Nutrient Deficiency"),
        desc: loc(`${loc(target.vitKo, target.vitEn)} 결핍의 가장 특징적인 임상 양상은?`,`Most characteristic clinical picture of ${loc(target.vitKo, target.vitEn)} deficiency?`),
        choices: shuffle([
            { text: loc(target.correctKo, target.correctEn), effect: { hp: -2, rep: 22 }, log: loc("정답.","Correct.") },
            { text: loc(wrong[0].correctKo, wrong[0].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 영양소 결핍.","Different nutrient.") },
            { text: loc(wrong[1].correctKo, wrong[1].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 영양소 결핍.","Different nutrient.") },
            { text: loc(wrong[2].correctKo, wrong[2].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 영양소 결핍.","Different nutrient.") }
        ])
    };
}
function generateBLSPriorityQuestion() {
    const scenarios = [
        { sceneKo: "성인 환자가 갑자기 쓰러짐", sceneEn: "Adult collapses suddenly", correctKo: "반응 확인 → 도움 요청·119 → 가슴압박 30:2", correctEn: "Check response → call 911/team → 30:2 compressions" },
        { sceneKo: "1세 영아가 무반응", sceneEn: "1-year-old infant unresponsive", correctKo: "반응 확인 → 가슴압박 30:2 (1인) 또는 15:2 (2인+)", correctEn: "Check response → 30:2 (1 rescuer) or 15:2 (2+ rescuers)" },
        { sceneKo: "성인이 음식이 목에 걸려 말 못함", sceneEn: "Adult choking, can't speak", correctKo: "Heimlich(복부밀어내기), 의식 잃으면 CPR", correctEn: "Heimlich (abdominal thrusts); CPR if unconscious" },
        { sceneKo: "익수 직후 무반응", sceneEn: "Just-rescued drowning, unresponsive", correctKo: "5회 인공호흡 먼저 → 그 후 표준 CPR", correctEn: "5 rescue breaths first → then standard CPR" },
    ];
    const target = pick(scenarios);
    const wrong = scenarios.filter(s => s !== target);
    return { baseId: "blsPriority", categoryKey: "fundamentals", part: loc("BLS","Basic Life Support"), emoji: "🚑",
        title: loc("BLS 시나리오 우선순위","BLS Scenario Priority"),
        desc: loc(`상황: ${loc(target.sceneKo, target.sceneEn)}. 1차 처치는?`,`Scenario: ${loc(target.sceneKo, target.sceneEn)}. First action?`),
        choices: shuffle([
            { text: loc(target.correctKo, target.correctEn), effect: { hp: -2, rep: 22 }, log: loc("정답.","Correct.") },
            { text: loc(wrong[0].correctKo, wrong[0].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 시나리오.","Different scenario.") },
            { text: loc(wrong[1].correctKo, wrong[1].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 시나리오.","Different scenario.") },
            { text: loc("관찰만 하며 응급 도움 대기","Just observe and wait"), effect: { hp: -42, rep: -32 }, log: loc("응급 - 즉시 행동.","Emergency — act now.") }
        ])
    };
}
function generateAntibioticClassQuestion() {
    const abx = [
        { drugKo: "Aminoglycosides (Gentamicin 등)", drugEn: "Aminoglycosides (Gentamicin)", correctKo: "신독성·이독성 - peak/trough 모니터", correctEn: "Nephro/ototoxic — monitor peak/trough" },
        { drugKo: "Vancomycin", drugEn: "Vancomycin", correctKo: "Red Man·신독성·이독성·trough 모니터", correctEn: "Red man, nephro/ototoxic, trough monitoring" },
        { drugKo: "Fluoroquinolones (Cipro 등)", drugEn: "Fluoroquinolones (Cipro)", correctKo: "건염·QT 연장·소아 금기", correctEn: "Tendinitis, QT prolongation, avoid in kids" },
        { drugKo: "Sulfonamides (Bactrim)", drugEn: "Sulfonamides (Bactrim)", correctKo: "Stevens-Johnson·신결정·고칼륨", correctEn: "SJS, crystalluria, hyperkalemia" },
        { drugKo: "Tetracyclines", drugEn: "Tetracyclines", correctKo: "광과민성·치아 착색·임신·8세 미만 금기", correctEn: "Photosensitivity, teeth staining, avoid in pregnancy/<8 yr" },
    ];
    const target = pick(abx);
    const wrong = abx.filter(a => a !== target);
    return { baseId: "abxClass", categoryKey: "adult", part: loc("항생제 부작용","Antibiotic Side Effects"), emoji: "💊",
        title: loc("항생제 계열별 부작용","Class-Specific Antibiotic Effects"),
        desc: loc(`${loc(target.drugKo, target.drugEn)}의 주요 부작용·모니터링 포인트는?`,`Main side effect/monitoring of ${loc(target.drugKo, target.drugEn)}?`),
        choices: shuffle([
            { text: loc(target.correctKo, target.correctEn), effect: { hp: -2, rep: 22 }, log: loc("정답.","Correct.") },
            { text: loc(wrong[0].correctKo, wrong[0].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 계열.","Different class.") },
            { text: loc(wrong[1].correctKo, wrong[1].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 계열.","Different class.") },
            { text: loc(wrong[2].correctKo, wrong[2].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 계열.","Different class.") }
        ])
    };
}

// ========= 배치 15: 다중 시나리오 10문제 =========
function generateBabyDevelopmentQuestion() {
    const ms = [
        { ageKo: "2개월", ageEn: "2 months", correctKo: "사회적 미소·고개 들기", correctEn: "Social smile, head lift" },
        { ageKo: "4개월", ageEn: "4 months", correctKo: "옹알이·머리 가눔·구르기", correctEn: "Cooing, head control, rolling" },
        { ageKo: "9개월", ageEn: "9 months", correctKo: "기어다님·낯가림", correctEn: "Crawling, stranger anxiety" },
        { ageKo: "18개월", ageEn: "18 months", correctKo: "10단어·계단 오르기", correctEn: "10 words, climbs stairs" },
        { ageKo: "3세", ageEn: "3 years", correctKo: "세발자전거·완전한 문장", correctEn: "Tricycle, full sentences" },
    ];
    const t = pick(ms); const w = ms.filter(m => m !== t);
    return { baseId: "babyDevel", categoryKey: "pediatric", part: loc("발달 지표","Developmental Milestones"), emoji: "👶",
        title: loc("연령별 발달 지표","Age-Specific Milestones"),
        desc: loc(`${loc(t.ageKo, t.ageEn)} 영유아의 정상 발달 지표는?`,`Normal milestones at ${loc(t.ageKo, t.ageEn)}?`),
        choices: shuffle([
            { text: loc(t.correctKo, t.correctEn), effect: { hp: -2, rep: 22 }, log: loc("정답.","Correct.") },
            { text: loc(w[0].correctKo, w[0].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 시기.","Different age.") },
            { text: loc(w[1].correctKo, w[1].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 시기.","Different age.") },
            { text: loc(w[2].correctKo, w[2].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 시기.","Different age.") }
        ])
    };
}
function generateGriefStagesVarsQuestion() {
    const stages = [
        { quoteKo: "\"이게 사실이 아닐 거야\"", quoteEn: "\"This can't be true\"", correctKo: "부정(Denial)", correctEn: "Denial" },
        { quoteKo: "\"왜 하필 나야! 불공평해\"", quoteEn: "\"Why me! It's unfair\"", correctKo: "분노(Anger)", correctEn: "Anger" },
        { quoteKo: "\"손주 결혼식까지만 살게 해주세요\"", quoteEn: "\"Just let me see the grandkids' wedding\"", correctKo: "타협(Bargaining)", correctEn: "Bargaining" },
        { quoteKo: "환자가 식사·대화 없이 무기력함", quoteEn: "Patient withdrawn, not eating or talking", correctKo: "우울(Depression)", correctEn: "Depression" },
        { quoteKo: "\"이제 마음의 준비가 됐어요\"", quoteEn: "\"I'm ready now\"", correctKo: "수용(Acceptance)", correctEn: "Acceptance" },
    ];
    const t = pick(stages); const w = stages.filter(s => s !== t);
    return { baseId: "griefStagesVars", categoryKey: "psych", part: loc("애도 단계","Grief Stages"), emoji: "💔",
        title: loc("Kübler-Ross 단계 식별","Identify K-R Stage"),
        desc: loc(`말기 환자가 ${loc(t.quoteKo, t.quoteEn)} 보인다. 어느 단계?`,`Terminal patient: ${loc(t.quoteKo, t.quoteEn)}. Which stage?`),
        choices: shuffle([
            { text: loc(t.correctKo, t.correctEn), effect: { hp: -2, rep: 22 }, log: loc("정답.","Correct.") },
            { text: loc(w[0].correctKo, w[0].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 단계.","Different stage.") },
            { text: loc(w[1].correctKo, w[1].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 단계.","Different stage.") },
            { text: loc(w[2].correctKo, w[2].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 단계.","Different stage.") }
        ])
    };
}
function generateThyroidLabQuestion() {
    const cases = [
        { tshKo: "TSH 0.1, T4 18", tshEn: "TSH 0.1, T4 18", correctKo: "원발성 갑상선기능항진증", correctEn: "Primary hyperthyroidism" },
        { tshKo: "TSH 12, T4 4", tshEn: "TSH 12, T4 4", correctKo: "원발성 갑상선기능저하증", correctEn: "Primary hypothyroidism" },
        { tshKo: "TSH 8, T4 정상", tshEn: "TSH 8, T4 normal", correctKo: "잠재성 갑상선기능저하", correctEn: "Subclinical hypothyroidism" },
        { tshKo: "TSH 0.3, T4 정상", tshEn: "TSH 0.3, T4 normal", correctKo: "잠재성 갑상선기능항진", correctEn: "Subclinical hyperthyroidism" },
    ];
    const t = pick(cases); const w = cases.filter(c => c !== t);
    return { baseId: "thyroidLab", categoryKey: "adult", part: loc("갑상선 검사","Thyroid Labs"), emoji: "🦋",
        title: loc("TSH/T4 해석","TSH/T4 Interpretation"),
        desc: loc(`${loc(t.tshKo, t.tshEn)}인 환자의 진단은?`,`Patient with ${loc(t.tshKo, t.tshEn)}. Diagnosis?`),
        choices: shuffle([
            { text: loc(t.correctKo, t.correctEn), effect: { hp: -2, rep: 22 }, log: loc("정답.","Correct.") },
            { text: loc(w[0].correctKo, w[0].correctEn), effect: { hp: -22, rep: -12 }, log: loc("검사 패턴 다름.","Different lab pattern.") },
            { text: loc(w[1].correctKo, w[1].correctEn), effect: { hp: -22, rep: -12 }, log: loc("검사 패턴 다름.","Different lab pattern.") },
            { text: loc(w[2].correctKo, w[2].correctEn), effect: { hp: -22, rep: -12 }, log: loc("검사 패턴 다름.","Different lab pattern.") }
        ])
    };
}
function generateMurmurLocationQuestion() {
    const cases = [
        { locKo: "우상흉골연 2번째 늑간 수축기", locEn: "RUSB 2nd ICS systolic", correctKo: "대동맥판 협착(AS)", correctEn: "Aortic stenosis (AS)" },
        { locKo: "심첨부 이완기", locEn: "Apex diastolic", correctKo: "승모판 협착(MS)", correctEn: "Mitral stenosis (MS)" },
        { locKo: "심첨부 수축기 - 액와 방사", locEn: "Apex systolic, radiates to axilla", correctKo: "승모판 역류(MR)", correctEn: "Mitral regurgitation (MR)" },
        { locKo: "좌상흉골연 이완기", locEn: "LUSB diastolic", correctKo: "대동맥판 역류(AR)", correctEn: "Aortic regurgitation (AR)" },
    ];
    const t = pick(cases); const w = cases.filter(c => c !== t);
    return { baseId: "murmurLoc", categoryKey: "adult", part: loc("심잡음","Heart Murmur"), emoji: "🎵",
        title: loc("심잡음 위치별 진단","Murmur by Location"),
        desc: loc(`${loc(t.locKo, t.locEn)} 잡음이 들리는 환자의 가능성 높은 진단은?`,`Murmur at ${loc(t.locKo, t.locEn)}. Most likely?`),
        choices: shuffle([
            { text: loc(t.correctKo, t.correctEn), effect: { hp: -2, rep: 22 }, log: loc("정답.","Correct.") },
            { text: loc(w[0].correctKo, w[0].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 잡음.","Different murmur.") },
            { text: loc(w[1].correctKo, w[1].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 잡음.","Different murmur.") },
            { text: loc(w[2].correctKo, w[2].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 잡음.","Different murmur.") }
        ])
    };
}
function generateBurnAreaCalcQuestion() {
    const cases = [
        { areaKo: "양 팔 전체 + 머리 전체", areaEn: "Both whole arms + whole head", correctKo: "27% (9% × 3)", correctEn: "27% (9% × 3)" },
        { areaKo: "몸통 앞 전체 + 한쪽 다리 앞", areaEn: "Anterior trunk + anterior of one leg", correctKo: "27% (18% + 9%)", correctEn: "27% (18% + 9%)" },
        { areaKo: "양 다리 전체", areaEn: "Both whole legs", correctKo: "36% (18% × 2)", correctEn: "36% (18% × 2)" },
        { areaKo: "회음부 + 한쪽 팔 전체", areaEn: "Perineum + one whole arm", correctKo: "10% (1% + 9%)", correctEn: "10% (1% + 9%)" },
    ];
    const t = pick(cases); const w = cases.filter(c => c !== t);
    return { baseId: "burnAreaCalc", categoryKey: "adult", part: loc("화상 면적","Burn TBSA"), emoji: "🔥",
        title: loc("9의 법칙 계산","Rule of Nines Calculation"),
        desc: loc(`성인 환자가 ${loc(t.areaKo, t.areaEn)}에 화상을 입었다. 총 %TBSA는?`,`Adult burn over ${loc(t.areaKo, t.areaEn)}. Total %TBSA?`),
        choices: shuffle([
            { text: loc(t.correctKo, t.correctEn), effect: { hp: -2, rep: 22 }, log: loc("정답.","Correct.") },
            { text: loc(w[0].correctKo, w[0].correctEn), effect: { hp: -22, rep: -12 }, log: loc("계산 오류.","Calculation error.") },
            { text: loc(w[1].correctKo, w[1].correctEn), effect: { hp: -22, rep: -12 }, log: loc("계산 오류.","Calculation error.") },
            { text: loc(w[2].correctKo, w[2].correctEn), effect: { hp: -22, rep: -12 }, log: loc("계산 오류.","Calculation error.") }
        ])
    };
}
function generateInsulinTimingQuestion() {
    const cases = [
        { insKo: "Lispro/Aspart (초속효성)", insEn: "Lispro/Aspart (rapid)", correctKo: "식사 직전(15분 전 이내)", correctEn: "Right before meal (within 15 min)" },
        { insKo: "Regular (속효성)", insEn: "Regular (short-acting)", correctKo: "식사 30분 전", correctEn: "30 min before meal" },
        { insKo: "NPH (중간형)", insEn: "NPH (intermediate)", correctKo: "아침·저녁 식전 또는 자기 전", correctEn: "Before breakfast/dinner or bedtime" },
        { insKo: "Glargine (지속형)", insEn: "Glargine (long-acting)", correctKo: "하루 1번 같은 시간 (식사와 무관)", correctEn: "Once daily at same time (regardless of meals)" },
    ];
    const t = pick(cases); const w = cases.filter(c => c !== t);
    return { baseId: "insulinTiming", categoryKey: "adult", part: loc("인슐린 투여","Insulin Timing"), emoji: "💉",
        title: loc("인슐린 종류별 투여 시간","Insulin Timing by Type"),
        desc: loc(`${loc(t.insKo, t.insEn)} 인슐린의 적절한 투여 시점은?`,`When to administer ${loc(t.insKo, t.insEn)} insulin?`),
        choices: shuffle([
            { text: loc(t.correctKo, t.correctEn), effect: { hp: -2, rep: 22 }, log: loc("정답.","Correct.") },
            { text: loc(w[0].correctKo, w[0].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 종류.","Different type.") },
            { text: loc(w[1].correctKo, w[1].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 종류.","Different type.") },
            { text: loc(w[2].correctKo, w[2].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 종류.","Different type.") }
        ])
    };
}
function generateOxygenDeviceFlowQuestion() {
    const cases = [
        { deviceKo: "비강캐뉼라 2 L/min", deviceEn: "Nasal cannula 2 L/min", correctKo: "약 28% FiO2", correctEn: "~28% FiO2" },
        { deviceKo: "비강캐뉼라 4 L/min", deviceEn: "Nasal cannula 4 L/min", correctKo: "약 36% FiO2", correctEn: "~36% FiO2" },
        { deviceKo: "단순 마스크 6-10 L/min", deviceEn: "Simple mask 6-10 L/min", correctKo: "약 35-50% FiO2", correctEn: "~35-50% FiO2" },
        { deviceKo: "비재호흡 마스크 10-15 L/min", deviceEn: "Non-rebreather 10-15 L/min", correctKo: "약 60-100% FiO2", correctEn: "~60-100% FiO2" },
        { deviceKo: "Venturi 마스크 24% 설정", deviceEn: "Venturi mask 24% setting", correctKo: "정확히 24% FiO2", correctEn: "Precisely 24% FiO2" },
    ];
    const t = pick(cases); const w = cases.filter(c => c !== t);
    return { baseId: "oxygenFlow", categoryKey: "fundamentals", part: loc("산소요법","Oxygen Therapy"), emoji: "🫁",
        title: loc("산소 기구별 FiO2","FiO2 by Oxygen Device"),
        desc: loc(`${loc(t.deviceKo, t.deviceEn)}로 공급되는 대략적 FiO2는?`,`Approximate FiO2 with ${loc(t.deviceKo, t.deviceEn)}?`),
        choices: shuffle([
            { text: loc(t.correctKo, t.correctEn), effect: { hp: -2, rep: 22 }, log: loc("정답.","Correct.") },
            { text: loc(w[0].correctKo, w[0].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 기구.","Different device.") },
            { text: loc(w[1].correctKo, w[1].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 기구.","Different device.") },
            { text: loc(w[2].correctKo, w[2].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 기구.","Different device.") }
        ])
    };
}
function generatePainTeachingTypeQuestion() {
    const cases = [
        { typeKo: "급성 수술 후 통증", typeEn: "Acute postoperative pain", correctKo: "정해진 시간 진통제·환자조절진통(PCA)·다중 약물", correctEn: "Scheduled analgesics, PCA, multimodal" },
        { typeKo: "만성 비암성 통증", typeEn: "Chronic non-cancer pain", correctKo: "비약물 우선·비아편제 1차·기능 향상 목표", correctEn: "Non-pharm first, non-opioid first-line, function-focused" },
        { typeKo: "암성 통증", typeEn: "Cancer pain", correctKo: "WHO 사다리·정해진 간격·돌발통 예비량", correctEn: "WHO ladder, scheduled, breakthrough doses" },
        { typeKo: "신경병성 통증", typeEn: "Neuropathic pain", correctKo: "Gabapentin·Duloxetine·TCA가 1차", correctEn: "Gabapentin, duloxetine, TCAs first-line" },
    ];
    const t = pick(cases); const w = cases.filter(c => c !== t);
    return { baseId: "painTeachingType", categoryKey: "fundamentals", part: loc("통증 관리","Pain Management"), emoji: "🩹",
        title: loc("통증 유형별 관리","Type-Specific Pain Management"),
        desc: loc(`${loc(t.typeKo, t.typeEn)} 환자의 핵심 약물·전략은?`,`Key meds/strategy for ${loc(t.typeKo, t.typeEn)}?`),
        choices: shuffle([
            { text: loc(t.correctKo, t.correctEn), effect: { hp: -2, rep: 22 }, log: loc("정답.","Correct.") },
            { text: loc(w[0].correctKo, w[0].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 유형.","Different type.") },
            { text: loc(w[1].correctKo, w[1].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 유형.","Different type.") },
            { text: loc(w[2].correctKo, w[2].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 유형.","Different type.") }
        ])
    };
}
function generateContraceptionQuestion() {
    const cases = [
        { methodKo: "복합 경구피임약", methodEn: "Combined oral contraceptives", correctKo: "흡연 35세+ 금기·DVT/MI 위험", correctEn: "Contraindicated if smoker + 35+, DVT/MI risk" },
        { methodKo: "구리 IUD", methodEn: "Copper IUD", correctKo: "10년 사용·월경량 증가·골반 감염 후 금기", correctEn: "10-yr use, heavier menses, contraind. after PID" },
        { methodKo: "DMPA(Depo-Provera)", methodEn: "DMPA (Depo-Provera)", correctKo: "3개월 1회 주사·골밀도 감소·체중 증가", correctEn: "Quarterly injection, BMD loss, weight gain" },
        { methodKo: "응급 피임약(레보놀게스트렐)", methodEn: "Emergency (levonorgestrel)", correctKo: "성관계 후 72시간 이내 효과적", correctEn: "Effective within 72 hours of intercourse" },
    ];
    const t = pick(cases); const w = cases.filter(c => c !== t);
    return { baseId: "contraception", categoryKey: "maternal", part: loc("피임","Contraception"), emoji: "💊",
        title: loc("피임법 특징","Contraceptive Features"),
        desc: loc(`${loc(t.methodKo, t.methodEn)}의 특징·주의점은?`,`Features/cautions for ${loc(t.methodKo, t.methodEn)}?`),
        choices: shuffle([
            { text: loc(t.correctKo, t.correctEn), effect: { hp: -2, rep: 22 }, log: loc("정답.","Correct.") },
            { text: loc(w[0].correctKo, w[0].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 방법.","Different method.") },
            { text: loc(w[1].correctKo, w[1].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 방법.","Different method.") },
            { text: loc(w[2].correctKo, w[2].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 방법.","Different method.") }
        ])
    };
}
function generateInfectionPrecautionVarsQuestion() {
    const cases = [
        { dxKo: "수두(Varicella)", dxEn: "Varicella", correctKo: "공기주의 + 접촉주의", correctEn: "Airborne + Contact" },
        { dxKo: "결핵 활동성", dxEn: "Active TB", correctKo: "공기주의 (음압실·N95)", correctEn: "Airborne (negative-pressure, N95)" },
        { dxKo: "백일해", dxEn: "Pertussis", correctKo: "비말주의", correctEn: "Droplet" },
        { dxKo: "MRSA", dxEn: "MRSA", correctKo: "접촉주의", correctEn: "Contact" },
        { dxKo: "C. difficile", dxEn: "C. difficile", correctKo: "접촉주의 + 비누·물 손씻기 (알코올 무효)", correctEn: "Contact + soap-and-water (alcohol ineffective)" },
        { dxKo: "Norovirus", dxEn: "Norovirus", correctKo: "접촉주의 + 비누·물 손씻기", correctEn: "Contact + soap-and-water" },
    ];
    const t = pick(cases); const w = cases.filter(c => c !== t);
    return { baseId: "infectionPrecVars", categoryKey: "fundamentals", part: loc("감염 격리","Infection Precaution"), emoji: "🦠",
        title: loc("질환별 격리 지침","Disease-Specific Precaution"),
        desc: loc(`${loc(t.dxKo, t.dxEn)} 환자에게 적용해야 할 격리 지침은?`,`Precaution for ${loc(t.dxKo, t.dxEn)}?`),
        choices: shuffle([
            { text: loc(t.correctKo, t.correctEn), effect: { hp: -2, rep: 22 }, log: loc("정답.","Correct.") },
            { text: loc(w[0].correctKo, w[0].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 질환.","Different disease.") },
            { text: loc(w[1].correctKo, w[1].correctEn), effect: { hp: -22, rep: -12 }, log: loc("다른 질환.","Different disease.") },
            { text: loc("표준주의만","Standard only"), effect: { hp: -28, rep: -20 }, log: loc("표준주의만으론 부족.","Standard alone insufficient.") }
        ])
    };
}

// ========= 이미지 문제 3차: 10개 추가 =========
function generateAuscultationAreasQuestion() {
    const svg = `<svg viewBox="0 0 600 240" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="240" fill="#fef3f7"/><g transform="translate(150,20)"><path d="M 50 10 Q 30 60 60 100 L 70 200 Q 100 220 130 220 Q 160 220 190 200 L 200 100 Q 230 60 200 10 Q 175 -5 150 10 Q 125 -5 100 10 Q 75 -5 50 10 Z" fill="#fecaca" stroke="#991b1b" stroke-width="2"/><circle cx="80" cy="60" r="12" fill="#dc2626"/><text x="80" y="65" text-anchor="middle" font-size="11" fill="white" font-weight="700">A</text><circle cx="170" cy="60" r="12" fill="#dc2626"/><text x="170" y="65" text-anchor="middle" font-size="11" fill="white" font-weight="700">B</text><circle cx="125" cy="100" r="12" fill="#dc2626"/><text x="125" y="105" text-anchor="middle" font-size="11" fill="white" font-weight="700">C</text><circle cx="155" cy="135" r="12" fill="#dc2626"/><text x="155" y="140" text-anchor="middle" font-size="11" fill="white" font-weight="700">D</text><circle cx="115" cy="170" r="12" fill="#dc2626"/><text x="115" y="175" text-anchor="middle" font-size="11" fill="white" font-weight="700">E</text></g><text x="470" y="40" font-size="11">${loc("APE To Man","APE To Man")}</text><text x="470" y="58" font-size="10" fill="#64748b">A: ${loc("대동맥","Aortic")}</text><text x="470" y="75" font-size="10" fill="#64748b">B: ${loc("폐동맥","Pulmonic")}</text><text x="470" y="92" font-size="10" fill="#64748b">C: ${loc("Erb's","Erb's")}</text><text x="470" y="109" font-size="10" fill="#64748b">D: ${loc("삼첨판","Tricuspid")}</text><text x="470" y="126" font-size="10" fill="#64748b">E: ${loc("승모판","Mitral")}</text></svg>`;
    return { baseId: "auscultationAreas", categoryKey: "adult", part: loc("심청진","Cardiac Auscultation"), emoji: "🩺",
        title: loc("심음 청진 부위","Heart Auscultation Areas"),
        desc: loc("승모판 협착의 이완기 잡음을 가장 잘 들을 수 있는 부위는?","Best location to hear the diastolic murmur of mitral stenosis?"),
        image: svg,
        choices: shuffle([
            { text: loc("E (심첨부, 승모판)","E (Apex, Mitral)"), effect: { hp: -2, rep: 22 }, log: loc("정답. 승모판은 심첨부.","Correct. Mitral = apex.") },
            { text: loc("A (우상흉골연, 대동맥)","A (RUSB, Aortic)"), effect: { hp: -22, rep: -12 }, log: loc("AS 잡음을 듣는 곳.","Hear AS here.") },
            { text: loc("B (좌상흉골연, 폐동맥)","B (LUSB, Pulmonic)"), effect: { hp: -22, rep: -12 }, log: loc("PS 잡음.","Pulmonic stenosis.") },
            { text: loc("D (좌하흉골연, 삼첨판)","D (LLSB, Tricuspid)"), effect: { hp: -22, rep: -12 }, log: loc("VSD·삼첨 역류.","VSD/TR.") }
        ])
    };
}
function generateIMSitesQuestion() {
    const svg = `<svg viewBox="0 0 600 240" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="240" fill="#f0f9ff"/><g transform="translate(50,20)"><circle cx="60" cy="40" r="22" fill="#fed7aa" stroke="#9a3412"/><rect x="38" y="62" width="44" height="80" fill="#fecaca" stroke="#991b1b" rx="4"/><rect x="20" y="80" width="20" height="60" fill="#fecaca" stroke="#991b1b" rx="4"/><rect x="80" y="80" width="20" height="60" fill="#fecaca" stroke="#991b1b" rx="4"/><rect x="40" y="140" width="20" height="60" fill="#fecaca" stroke="#991b1b" rx="4"/><rect x="60" y="140" width="20" height="60" fill="#fecaca" stroke="#991b1b" rx="4"/><circle cx="30" cy="92" r="6" fill="#dc2626"/><text x="30" y="96" text-anchor="middle" font-size="9" fill="white" font-weight="700">A</text><circle cx="55" cy="160" r="6" fill="#dc2626"/><text x="55" y="164" text-anchor="middle" font-size="9" fill="white" font-weight="700">B</text><text x="60" y="225" text-anchor="middle" font-size="11" font-weight="700">${loc("성인","Adult")}</text></g><g transform="translate(280,20)"><circle cx="60" cy="40" r="22" fill="#fed7aa" stroke="#9a3412"/><rect x="38" y="62" width="44" height="80" fill="#fecaca" stroke="#991b1b" rx="4"/><rect x="20" y="80" width="20" height="50" fill="#fecaca" stroke="#991b1b" rx="4"/><rect x="80" y="80" width="20" height="50" fill="#fecaca" stroke="#991b1b" rx="4"/><rect x="40" y="140" width="20" height="60" fill="#fecaca" stroke="#991b1b" rx="4"/><rect x="60" y="140" width="20" height="60" fill="#fecaca" stroke="#991b1b" rx="4"/><circle cx="50" cy="160" r="6" fill="#dc2626"/><text x="50" y="164" text-anchor="middle" font-size="9" fill="white" font-weight="700">C</text><text x="60" y="225" text-anchor="middle" font-size="11" font-weight="700">${loc("영아","Infant")}</text></g><g transform="translate(450,30)"><text x="0" y="20" font-size="11" font-weight="700">${loc("부위","Sites")}</text><text x="0" y="42" font-size="10" fill="#64748b">A: ${loc("삼각근","Deltoid")}</text><text x="0" y="60" font-size="10" fill="#64748b">B: ${loc("배둔부","Ventrogluteal")}</text><text x="0" y="78" font-size="10" fill="#64748b">C: ${loc("외측광근","Vastus lateralis")}</text></g></svg>`;
    return { baseId: "imSites", categoryKey: "fundamentals", part: loc("근육주사 부위","IM Injection Site"), emoji: "💉",
        title: loc("IM 주사 부위 선택","Choose IM Site"),
        desc: loc("12개월 미만 영아에게 가장 안전한 IM 주사 부위는?","Safest IM injection site for infant <12 months?"),
        image: svg,
        choices: shuffle([
            { text: loc("C (외측광근, vastus lateralis)","C (Vastus lateralis)"), effect: { hp: -2, rep: 22 }, log: loc("정답. 영아는 둔근 발달 미완성으로 외측광근이 표준.","Correct. Infant gluteal muscle is underdeveloped.") },
            { text: loc("A (삼각근)","A (Deltoid)"), effect: { hp: -28, rep: -20 }, log: loc("영아는 근육량 부족.","Insufficient muscle mass in infants.") },
            { text: loc("B (배둔부)","B (Ventrogluteal)"), effect: { hp: -22, rep: -12 }, log: loc("성인·소아의 첫 선택, 영아는 X.","First-line for adults/children, not infants.") },
            { text: loc("등둔부(Dorsogluteal)","Dorsogluteal"), effect: { hp: -32, rep: -22 }, log: loc("좌골신경 손상 위험으로 권장 안 함.","Sciatic nerve risk — discouraged.") }
        ])
    };
}
function generatePostureQuestion() {
    const svg = `<svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="200" fill="#fff5f5"/><g transform="translate(40,30)"><rect x="0" y="100" width="160" height="14" fill="#94a3b8"/><circle cx="40" cy="60" r="14" fill="#fed7aa"/><rect x="35" y="70" width="50" height="50" fill="#fecaca" stroke="#991b1b" rx="3"/><line x1="35" y1="78" x2="15" y2="100" stroke="#1e293b" stroke-width="3"/><line x1="85" y1="78" x2="105" y2="100" stroke="#1e293b" stroke-width="3"/><line x1="20" y1="100" x2="20" y2="60" stroke="#1e293b" stroke-width="3"/><line x1="100" y1="100" x2="100" y2="60" stroke="#1e293b" stroke-width="3"/><text x="60" y="155" text-anchor="middle" font-size="13" font-weight="700">A</text><text x="60" y="175" text-anchor="middle" font-size="10" fill="#64748b">${loc("팔 굴곡, 다리 내전·신전","Arms flexed, legs ext")}</text></g><g transform="translate(220,30)"><rect x="0" y="100" width="160" height="14" fill="#94a3b8"/><circle cx="40" cy="60" r="14" fill="#fed7aa"/><rect x="35" y="70" width="50" height="50" fill="#fecaca" stroke="#991b1b" rx="3"/><line x1="35" y1="100" x2="15" y2="78" stroke="#1e293b" stroke-width="3"/><line x1="85" y1="100" x2="105" y2="78" stroke="#1e293b" stroke-width="3"/><line x1="20" y1="100" x2="20" y2="60" stroke="#1e293b" stroke-width="3"/><line x1="100" y1="100" x2="100" y2="60" stroke="#1e293b" stroke-width="3"/><text x="60" y="155" text-anchor="middle" font-size="13" font-weight="700">B</text><text x="60" y="175" text-anchor="middle" font-size="10" fill="#64748b">${loc("팔 신전·내회전","Arms ext, internally rot")}</text></g><g transform="translate(400,30)"><rect x="0" y="100" width="160" height="14" fill="#94a3b8"/><circle cx="40" cy="60" r="14" fill="#fed7aa"/><rect x="35" y="70" width="50" height="50" fill="#fecaca" stroke="#991b1b" rx="3"/><line x1="35" y1="78" x2="15" y2="60" stroke="#1e293b" stroke-width="3"/><line x1="85" y1="78" x2="105" y2="60" stroke="#1e293b" stroke-width="3"/><line x1="20" y1="100" x2="50" y2="80" stroke="#1e293b" stroke-width="3"/><line x1="100" y1="100" x2="70" y2="80" stroke="#1e293b" stroke-width="3"/><text x="60" y="155" text-anchor="middle" font-size="13" font-weight="700">C</text><text x="60" y="175" text-anchor="middle" font-size="10" fill="#64748b">${loc("정상","Normal")}</text></g></svg>`;
    return { baseId: "decerebratePosture", categoryKey: "adult", part: loc("의식 사정","Consciousness"), emoji: "🧠",
        title: loc("이상 자세 식별","Abnormal Posturing"),
        desc: loc("그림 B는 팔이 신전·내회전된 자세입니다. 무엇이며 임상 의의는?","Diagram B: arms extended, internally rotated. Name and significance?"),
        image: svg,
        choices: shuffle([
            { text: loc("Decerebrate(제뇌경직) - 뇌간 손상, 더 나쁜 예후","Decerebrate — brainstem injury, worse prognosis"), effect: { hp: -3, rep: 22 }, log: loc("정답. 중뇌·교 수준 손상.","Correct. Midbrain/pons damage.") },
            { text: loc("Decorticate(제피질경직) - 그림 A","Decorticate — that's diagram A"), effect: { hp: -22, rep: -12 }, log: loc("A는 decorticate.","A is decorticate.") },
            { text: loc("정상 자세","Normal"), effect: { hp: -32, rep: -22 }, log: loc("심각한 신경 손상.","Severe neuro damage.") },
            { text: loc("발작 후 자세","Postictal"), effect: { hp: -28, rep: -20 }, log: loc("발작 후엔 보통 이완성.","Usually flaccid post-seizure.") }
        ])
    };
}
function generatePupilExamQuestion() {
    const pupil = (cx, irisR, pupilR) => `<circle cx="${cx}" cy="40" r="22" fill="white" stroke="#1e293b" stroke-width="1.5"/><circle cx="${cx}" cy="40" r="${irisR}" fill="#3b82f6"/><circle cx="${cx}" cy="40" r="${pupilR}" fill="#1e293b"/>`;
    const svg = `<svg viewBox="0 0 600 130" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="130" fill="#fff"/><g transform="translate(20,10)">${pupil(40, 16, 5)}<text x="40" y="80" text-anchor="middle" font-size="13" font-weight="700">A</text><text x="40" y="100" text-anchor="middle" font-size="10" fill="#64748b">${loc("정상 3-5mm","Normal 3-5mm")}</text></g><g transform="translate(160,10)">${pupil(40, 16, 1.5)}<text x="40" y="80" text-anchor="middle" font-size="13" font-weight="700">B</text><text x="40" y="100" text-anchor="middle" font-size="10" fill="#64748b">${loc("바늘구멍 <2mm","Pinpoint <2mm")}</text></g><g transform="translate(300,10)">${pupil(40, 16, 11)}<text x="40" y="80" text-anchor="middle" font-size="13" font-weight="700">C</text><text x="40" y="100" text-anchor="middle" font-size="10" fill="#64748b">${loc("산동 >7mm","Dilated >7mm")}</text></g><g transform="translate(440,10)">${pupil(30, 16, 4)}${pupil(100, 16, 11)}<text x="65" y="80" text-anchor="middle" font-size="13" font-weight="700">D</text><text x="65" y="100" text-anchor="middle" font-size="10" fill="#64748b">${loc("부동 동공","Anisocoria")}</text></g></svg>`;
    return { baseId: "pupilExam", categoryKey: "adult", part: loc("동공 사정","Pupil Exam"), emoji: "👁️",
        title: loc("동공 소견 식별","Pupil Findings"),
        desc: loc("아편제 과량 환자에서 가장 흔히 보이는 동공 소견은?","Most common pupil finding in opioid overdose?"),
        image: svg,
        choices: shuffle([
            { text: loc("B (바늘구멍 동공, miosis)","B (Pinpoint, miosis)"), effect: { hp: -2, rep: 22 }, log: loc("정답. 아편제는 부교감 자극 → miosis.","Correct. Opioids cause miosis.") },
            { text: loc("C (산동, mydriasis)","C (Mydriasis)"), effect: { hp: -22, rep: -12 }, log: loc("교감 항진제·항콜린제·MDMA에서.","Sympathomimetics, anticholinergics.") },
            { text: loc("D (부동 동공)","D (Anisocoria)"), effect: { hp: -25, rep: -15 }, log: loc("뇌압 상승·뇌탈출 시.","Increased ICP/herniation.") },
            { text: loc("A (정상)","A (Normal)"), effect: { hp: -28, rep: -20 }, log: loc("아편제는 비정상.","Opioids cause abnormality.") }
        ])
    };
}
function generateAEDPadsQuestion() {
    const svg = `<svg viewBox="0 0 600 220" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="220" fill="#fef9c3"/><g transform="translate(160,20)"><rect x="0" y="20" width="280" height="180" fill="#fecaca" stroke="#991b1b" stroke-width="2" rx="20"/><circle cx="50" cy="65" r="14" fill="#fff" stroke="#1e293b"/><circle cx="230" cy="65" r="14" fill="#fff" stroke="#1e293b"/><rect x="40" y="40" width="50" height="40" fill="#fbbf24" stroke="#1e293b" stroke-width="2" rx="4"/><text x="65" y="65" text-anchor="middle" font-size="12" font-weight="700">A</text><rect x="200" y="120" width="60" height="50" fill="#fbbf24" stroke="#1e293b" stroke-width="2" rx="4"/><text x="230" y="150" text-anchor="middle" font-size="12" font-weight="700">B</text><text x="140" y="215" text-anchor="middle" font-size="11" fill="#64748b">${loc("성인 AED 패드 위치","Adult AED Pad Placement")}</text></g></svg>`;
    return { baseId: "aedPads", categoryKey: "fundamentals", part: loc("AED","AED"), emoji: "⚡",
        title: loc("AED 패드 위치","AED Pad Placement"),
        desc: loc("성인 환자 AED 사용 시 두 패드의 정확한 위치는?","Correct AED pad placement on adult?"),
        image: svg,
        choices: shuffle([
            { text: loc("A: 우측 상흉부 빗장뼈 아래, B: 좌측 외측 흉부 (앞-외측)","A: right upper chest below clavicle, B: left lateral chest"), effect: { hp: -2, rep: 22 }, log: loc("정답. 심장 사이로 전류가 흐르도록 배치.","Correct. Allows current across the heart.") },
            { text: loc("두 패드 모두 흉골 정중앙","Both pads on sternum midline"), effect: { hp: -32, rep: -22 }, log: loc("전류가 심장을 통과하지 않음.","Current bypasses the heart.") },
            { text: loc("두 패드를 등에 부착","Both on back"), effect: { hp: -38, rep: -28 }, log: loc("심실 자극 안 됨.","Won't capture ventricles.") },
            { text: loc("패드 위치는 무관","Position doesn't matter"), effect: { hp: -45, rep: -32 }, log: loc("심각한 오해.","Serious misconception.") }
        ])
    };
}
function generateFontanelleQuestion() {
    const svg = `<svg viewBox="0 0 600 240" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="240" fill="#fef3f7"/><g transform="translate(40,20)"><ellipse cx="80" cy="100" rx="70" ry="80" fill="#fed7aa" stroke="#9a3412" stroke-width="2"/><polygon points="80,40 65,80 95,80" fill="#fbbf24" stroke="#92400e" stroke-width="1.5"/><polygon points="80,150 70,170 90,170" fill="#fbbf24" stroke="#92400e" stroke-width="1.5"/><text x="80" y="65" text-anchor="middle" font-size="11" font-weight="700">A</text><text x="80" y="167" text-anchor="middle" font-size="11" font-weight="700">B</text><text x="80" y="220" text-anchor="middle" font-size="11" fill="#64748b">${loc("정상 신생아","Normal Newborn")}</text></g><g transform="translate(260,30)"><text x="0" y="20" font-size="11" font-weight="700">${loc("폐쇄 시기","Closure Time")}</text><text x="0" y="42" font-size="11">A: ${loc("대천문 (전방)","Anterior fontanel")}</text><text x="20" y="60" font-size="10" fill="#64748b">${loc("12-18개월에 폐쇄","Closes 12-18 months")}</text><text x="0" y="82" font-size="11">B: ${loc("소천문 (후방)","Posterior fontanel")}</text><text x="20" y="100" font-size="10" fill="#64748b">${loc("2-3개월에 폐쇄","Closes 2-3 months")}</text><text x="0" y="135" font-size="11" font-weight="700" fill="#dc2626">${loc("이상 소견","Abnormal")}</text><text x="0" y="155" font-size="10">${loc("• 함몰 = 탈수","• Sunken = dehydration")}</text><text x="0" y="173" font-size="10">${loc("• 팽창 = 뇌압 ↑","• Bulging = ICP ↑")}</text></g></svg>`;
    return { baseId: "fontanelle", categoryKey: "pediatric", part: loc("천문","Fontanelle"), emoji: "👶",
        title: loc("천문 폐쇄 시기","Fontanelle Closure"),
        desc: loc("후천문(B)이 정상적으로 폐쇄되는 시기는?","When does the posterior fontanelle (B) normally close?"),
        image: svg,
        choices: shuffle([
            { text: loc("2~3개월","2-3 months"), effect: { hp: -2, rep: 22 }, log: loc("정답. 대천문은 12-18개월.","Correct. Anterior closes at 12-18 months.") },
            { text: loc("12~18개월","12-18 months"), effect: { hp: -22, rep: -12 }, log: loc("대천문 폐쇄 시기.","That's the anterior.") },
            { text: loc("출생 시","At birth"), effect: { hp: -25, rep: -15 }, log: loc("정상 신생아는 둘 다 열려 있음.","Both open at birth.") },
            { text: loc("3년","3 years"), effect: { hp: -28, rep: -20 }, log: loc("너무 늦음.","Too late.") }
        ])
    };
}
function generateOstomyTypesQuestion() {
    const svg = `<svg viewBox="0 0 600 240" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="240" fill="#fff5f5"/><g transform="translate(20,20)"><rect width="170" height="180" fill="#fde68a" rx="10"/><circle cx="50" cy="90" r="14" fill="#dc2626" stroke="#7f1d1d" stroke-width="2"/><circle cx="50" cy="90" r="6" fill="#7f1d1d"/><text x="85" y="55" text-anchor="middle" font-size="13" font-weight="700">A</text><text x="85" y="155" text-anchor="middle" font-size="10" fill="#64748b">${loc("우상복부, 액상","RUQ, liquid")}</text></g><g transform="translate(215,20)"><rect width="170" height="180" fill="#fde68a" rx="10"/><circle cx="120" cy="100" r="14" fill="#dc2626" stroke="#7f1d1d" stroke-width="2"/><circle cx="120" cy="100" r="6" fill="#7f1d1d"/><text x="85" y="55" text-anchor="middle" font-size="13" font-weight="700">B</text><text x="85" y="155" text-anchor="middle" font-size="10" fill="#64748b">${loc("좌하복부, 형성된 변","LLQ, formed stool")}</text></g><g transform="translate(410,20)"><rect width="170" height="180" fill="#fde68a" rx="10"/><circle cx="85" cy="120" r="14" fill="#fbbf24" stroke="#92400e" stroke-width="2"/><circle cx="85" cy="120" r="6" fill="#92400e"/><text x="85" y="55" text-anchor="middle" font-size="13" font-weight="700">C</text><text x="85" y="155" text-anchor="middle" font-size="10" fill="#64748b">${loc("정중하복부, 노란색","Lower midline, yellow")}</text></g></svg>`;
    return { baseId: "ostomyTypes", categoryKey: "fundamentals", part: loc("장루","Ostomy"), emoji: "🩹",
        title: loc("장루 유형 식별","Identify Ostomy Type"),
        desc: loc("그림 B (좌하복부·형성된 변)는 어떤 종류의 장루인가요?","Diagram B (LLQ, formed stool). What type of ostomy?"),
        image: svg,
        choices: shuffle([
            { text: loc("S상결장루(Sigmoid colostomy)","Sigmoid colostomy"), effect: { hp: -2, rep: 22 }, log: loc("정답. LLQ + 형성된 변 = sigmoid.","Correct. LLQ + formed stool = sigmoid.") },
            { text: loc("회장루(Ileostomy)","Ileostomy"), effect: { hp: -22, rep: -12 }, log: loc("RUQ + 액상 = A.","RUQ + liquid = A.") },
            { text: loc("요루(Urostomy)","Urostomy"), effect: { hp: -22, rep: -12 }, log: loc("정중·노란 소변 = C.","Midline + yellow urine = C.") },
            { text: loc("위루(Gastrostomy)","Gastrostomy"), effect: { hp: -25, rep: -15 }, log: loc("위에 있고 영양 공급용.","On stomach for feeding.") }
        ])
    };
}
function generateWoundColorQuestion() {
    const svg = `<svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="200" fill="#fff5f5"/><g transform="translate(20,20)"><rect width="140" height="140" fill="#fde68a" rx="8"/><ellipse cx="70" cy="70" rx="40" ry="30" fill="#dc2626"/><text x="70" y="125" text-anchor="middle" font-size="13" font-weight="700">A</text><text x="70" y="175" text-anchor="middle" font-size="10" fill="#64748b">${loc("선홍색","Red")}</text></g><g transform="translate(170,20)"><rect width="140" height="140" fill="#fde68a" rx="8"/><ellipse cx="70" cy="70" rx="40" ry="30" fill="#facc15"/><text x="70" y="125" text-anchor="middle" font-size="13" font-weight="700">B</text><text x="70" y="175" text-anchor="middle" font-size="10" fill="#64748b">${loc("노란색·조직","Yellow slough")}</text></g><g transform="translate(320,20)"><rect width="140" height="140" fill="#fde68a" rx="8"/><ellipse cx="70" cy="70" rx="40" ry="30" fill="#1e293b"/><text x="70" y="125" text-anchor="middle" font-size="13" font-weight="700">C</text><text x="70" y="175" text-anchor="middle" font-size="10" fill="#64748b">${loc("검은색·괴사","Black eschar")}</text></g><g transform="translate(470,20)"><rect width="110" height="140" fill="#fde68a" rx="8"/><ellipse cx="55" cy="70" rx="35" ry="25" fill="#fda4af"/><text x="55" y="125" text-anchor="middle" font-size="13" font-weight="700">D</text><text x="55" y="175" text-anchor="middle" font-size="10" fill="#64748b">${loc("핑크·표피","Pink/epithelialized")}</text></g></svg>`;
    return { baseId: "woundColor", categoryKey: "fundamentals", part: loc("상처 사정","Wound Assessment"), emoji: "🩹",
        title: loc("상처 색깔 분류 (RYB)","Wound Color (RYB)"),
        desc: loc("검은색 괴사 조직(C)이 보이는 상처에서 가장 우선되는 처치는?","Wound with black eschar (C). Top priority intervention?"),
        image: svg,
        choices: shuffle([
            { text: loc("괴사조직 제거(debridement) - 효소·자가용해·외과","Debridement — enzymatic, autolytic, or surgical"), effect: { hp: -3, rep: 22 }, log: loc("정답. 검은색은 죽은 조직, 치유 차단.","Correct. Black = dead tissue, blocks healing.") },
            { text: loc("그대로 보존","Preserve as is"), effect: { hp: -38, rep: -28 }, log: loc("감염원·치유 차단.","Becomes infection source/blocks healing.") },
            { text: loc("얼음 적용","Apply ice"), effect: { hp: -32, rep: -22 }, log: loc("관련 없음.","Unrelated.") },
            { text: loc("뜨거운 물로 씻기","Wash with hot water"), effect: { hp: -32, rep: -22 }, log: loc("화상 위험.","Burn risk.") }
        ])
    };
}
function generateRespDistressPostureQuestion() {
    const svg = `<svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="200" fill="#f0f9ff"/><g transform="translate(40,40)"><rect x="0" y="100" width="120" height="14" fill="#94a3b8"/><line x1="60" y1="100" x2="60" y2="60" stroke="#1e293b" stroke-width="3"/><circle cx="60" cy="50" r="10" fill="#fed7aa"/><line x1="60" y1="65" x2="40" y2="100" stroke="#1e293b" stroke-width="3"/><line x1="60" y1="65" x2="80" y2="100" stroke="#1e293b" stroke-width="3"/><text x="60" y="155" text-anchor="middle" font-size="13" font-weight="700">A</text><text x="60" y="175" text-anchor="middle" font-size="10" fill="#64748b">${loc("앙와위","Supine")}</text></g><g transform="translate(220,30)"><rect x="0" y="120" width="120" height="14" fill="#94a3b8"/><circle cx="60" cy="40" r="10" fill="#fed7aa"/><line x1="60" y1="50" x2="60" y2="90" stroke="#1e293b" stroke-width="3"/><line x1="60" y1="60" x2="30" y2="100" stroke="#1e293b" stroke-width="3"/><line x1="60" y1="60" x2="90" y2="100" stroke="#1e293b" stroke-width="3"/><line x1="30" y1="100" x2="20" y2="120" stroke="#1e293b" stroke-width="3"/><line x1="90" y1="100" x2="100" y2="120" stroke="#1e293b" stroke-width="3"/><line x1="60" y1="90" x2="40" y2="120" stroke="#1e293b" stroke-width="3"/><line x1="60" y1="90" x2="80" y2="120" stroke="#1e293b" stroke-width="3"/><text x="60" y="155" text-anchor="middle" font-size="13" font-weight="700">B</text><text x="60" y="175" text-anchor="middle" font-size="10" fill="#64748b">${loc("3중 자세(Tripod)","Tripod position")}</text></g><g transform="translate(420,30)"><rect x="0" y="120" width="120" height="14" fill="#94a3b8"/><circle cx="40" cy="60" r="10" fill="#fed7aa"/><line x1="40" y1="70" x2="80" y2="100" stroke="#1e293b" stroke-width="3"/><line x1="80" y1="100" x2="100" y2="120" stroke="#1e293b" stroke-width="3"/><line x1="40" y1="80" x2="20" y2="120" stroke="#1e293b" stroke-width="3"/><text x="60" y="155" text-anchor="middle" font-size="13" font-weight="700">C</text><text x="60" y="175" text-anchor="middle" font-size="10" fill="#64748b">${loc("좌위 + 베개","Sit + pillow")}</text></g></svg>`;
    return { baseId: "respDistressPosture", categoryKey: "adult", part: loc("호흡곤란 자세","Respiratory Distress Posture"), emoji: "🫁",
        title: loc("호흡 곤란 환자 자세","Respiratory Distress Position"),
        desc: loc("천식 발작·후두개염·심한 폐기종 환자에서 호흡을 돕는 그림 속 자세는?","Position assumed by patients with severe asthma, epiglottitis, or COPD?"),
        image: svg,
        choices: shuffle([
            { text: loc("B (3중 자세, Tripod) - 보조호흡근 활용","B (Tripod) — uses accessory muscles"), effect: { hp: -2, rep: 22 }, log: loc("정답. 호흡 곤란의 적색 깃발.","Correct. Red flag for distress.") },
            { text: loc("A (앙와위)","A (Supine)"), effect: { hp: -28, rep: -20 }, log: loc("앙와위는 호흡 더 어렵게.","Supine worsens breathing.") },
            { text: loc("C (좌위 + 베개, Orthopneic)","C (Orthopneic)"), effect: { hp: -22, rep: -12 }, log: loc("CHF 폐부종에 흔함.","Common in CHF/pulmonary edema.") },
            { text: loc("측와위","Lateral"), effect: { hp: -25, rep: -15 }, log: loc("호흡곤란 응대로 부적절.","Inappropriate for respiratory distress.") }
        ])
    };
}
function generatePulsePointsQuestion() {
    const svg = `<svg viewBox="0 0 600 240" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="240" fill="#fef3f7"/><g transform="translate(220,20)"><circle cx="80" cy="30" r="22" fill="#fed7aa" stroke="#9a3412" stroke-width="2"/><rect x="58" y="52" width="44" height="80" fill="#fecaca" stroke="#991b1b" stroke-width="2" rx="4"/><rect x="40" y="60" width="20" height="80" fill="#fecaca" stroke="#991b1b" stroke-width="2" rx="4"/><rect x="100" y="60" width="20" height="80" fill="#fecaca" stroke="#991b1b" stroke-width="2" rx="4"/><rect x="62" y="135" width="16" height="80" fill="#fecaca" stroke="#991b1b" stroke-width="2" rx="4"/><rect x="82" y="135" width="16" height="80" fill="#fecaca" stroke="#991b1b" stroke-width="2" rx="4"/><circle cx="65" cy="48" r="5" fill="#dc2626"/><text x="65" y="52" text-anchor="middle" font-size="9" fill="white" font-weight="700">A</text><circle cx="44" cy="135" r="5" fill="#dc2626"/><text x="44" y="139" text-anchor="middle" font-size="9" fill="white" font-weight="700">B</text><circle cx="63" cy="142" r="5" fill="#dc2626"/><text x="63" y="146" text-anchor="middle" font-size="9" fill="white" font-weight="700">C</text><circle cx="78" cy="215" r="5" fill="#dc2626"/><text x="78" y="219" text-anchor="middle" font-size="9" fill="white" font-weight="700">D</text></g><g transform="translate(450,30)"><text x="0" y="20" font-size="11" font-weight="700">${loc("맥박 부위","Pulse Points")}</text><text x="0" y="42" font-size="10">A: ${loc("경동맥","Carotid")}</text><text x="0" y="60" font-size="10">B: ${loc("요골동맥","Radial")}</text><text x="0" y="78" font-size="10">C: ${loc("대퇴동맥","Femoral")}</text><text x="0" y="96" font-size="10">D: ${loc("후경골/족배","Post tib/Dorsalis")}</text></g></svg>`;
    return { baseId: "pulsePoints", categoryKey: "fundamentals", part: loc("맥박 사정","Pulse Assessment"), emoji: "🩺",
        title: loc("CPR 시 사용하는 맥박 부위","Pulse Used in CPR"),
        desc: loc("성인 CPR 시 맥박 확인에 사용되는 부위는?","Which pulse is checked during adult CPR?"),
        image: svg,
        choices: shuffle([
            { text: loc("A (경동맥, Carotid)","A (Carotid)"), effect: { hp: -2, rep: 22 }, log: loc("정답. 영아는 상완 동맥(Brachial).","Correct. Infants use brachial.") },
            { text: loc("B (요골동맥)","B (Radial)"), effect: { hp: -25, rep: -15 }, log: loc("저혈압 시 안 만져질 수 있음.","May not be palpable in hypotension.") },
            { text: loc("C (대퇴동맥)","C (Femoral)"), effect: { hp: -25, rep: -15 }, log: loc("두 번째 선택이지만 경동맥이 표준.","Second-choice; carotid is standard.") },
            { text: loc("D (족배·후경골)","D (Dorsalis pedis/post tib)"), effect: { hp: -28, rep: -20 }, log: loc("말초 평가용.","For peripheral assessment.") }
        ])
    };
}

// ========= 이미지 문제 2차: 10개 추가 =========
function generatePainScaleQuestion() {
    const face = (x, mouth, color) => `<g transform="translate(${x},10)"><circle cx="35" cy="35" r="32" fill="${color}" stroke="#1e293b" stroke-width="2"/><circle cx="24" cy="30" r="2.5" fill="#1e293b"/><circle cx="46" cy="30" r="2.5" fill="#1e293b"/>${mouth}</g>`;
    const m0 = `<path d="M 22 44 Q 35 54 48 44" stroke="#1e293b" stroke-width="2" fill="none"/>`;
    const m2 = `<path d="M 24 46 Q 35 50 46 46" stroke="#1e293b" stroke-width="2" fill="none"/>`;
    const m4 = `<line x1="24" y1="46" x2="46" y2="46" stroke="#1e293b" stroke-width="2"/>`;
    const m6 = `<path d="M 24 48 Q 35 44 46 48" stroke="#1e293b" stroke-width="2" fill="none"/>`;
    const m8 = `<path d="M 22 50 Q 35 38 48 50" stroke="#1e293b" stroke-width="2" fill="none"/><path d="M 22 26 L 28 22 M 42 22 L 48 26" stroke="#1e293b" stroke-width="1.5" fill="none"/>`;
    const m10 = `<ellipse cx="35" cy="50" rx="12" ry="6" fill="#1e293b"/><line x1="22" y1="22" x2="28" y2="28" stroke="#1e293b" stroke-width="1.5"/><line x1="42" y1="28" x2="48" y2="22" stroke="#1e293b" stroke-width="1.5"/><path d="M 12 28 Q 16 38 12 48" stroke="#3b82f6" stroke-width="2" fill="none"/><path d="M 58 28 Q 54 38 58 48" stroke="#3b82f6" stroke-width="2" fill="none"/>`;
    const num = (x, t) => `<text x="${x+35}" y="100" text-anchor="middle" font-size="14" font-weight="700">${t}</text>`;
    const svg = `<svg viewBox="0 0 600 110" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="110" fill="#fefce8"/>${face(20, m0, '#86efac')}${num(20,'0')}${face(115, m2, '#bbf7d0')}${num(115,'2')}${face(210, m4, '#fde68a')}${num(210,'4')}${face(305, m6, '#fdba74')}${num(305,'6')}${face(400, m8, '#fb923c')}${num(400,'8')}${face(495, m10, '#ef4444')}${num(495,'10')}</svg>`;
    return { baseId: "painScaleImg", categoryKey: "fundamentals", part: loc("통증 사정","Pain Assessment"), emoji: "😢",
        title: loc("Wong-Baker 얼굴 통증 척도","Wong-Baker FACES Pain Scale"),
        desc: loc("환자가 그림의 가장 오른쪽 얼굴을 가리킨다. 점수는 무엇이며 어떤 처치가 필요한가?","Patient points to the rightmost face. What score and what action?"),
        image: svg,
        choices: shuffle([
            { text: loc("10 - 가장 심한 통증, 즉시 강한 진통제(예: 아편제) 평가","10 — worst possible pain; rapid analgesic (e.g., opioid) evaluation"), effect: { hp: -2, rep: 22 }, log: loc("정답. 7~10은 중증으로 분류.","Correct. 7-10 is severe.") },
            { text: loc("0 - 통증 없음, 처치 불요","0 — no pain, no action"), effect: { hp: -32, rep: -22 }, log: loc("울고 있는 얼굴은 0이 아닙니다.","The crying face isn't 0.") },
            { text: loc("4 - 중등도, 비스테로이드성 항염제만","4 — moderate, NSAIDs only"), effect: { hp: -25, rep: -15 }, log: loc("가장 오른쪽은 10점.","Rightmost = 10.") },
            { text: loc("6 - NSAID로 충분","6 — NSAIDs are enough"), effect: { hp: -25, rep: -15 }, log: loc("점수 해석 오류.","Score misinterpreted.") }
        ])
    };
}
function generateInsulinSyringeQuestion() {
    const svg = `<svg viewBox="0 0 600 140" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="140" fill="#f0f9ff"/><g transform="translate(40,40)"><rect x="0" y="20" width="450" height="40" fill="#fff" stroke="#1e293b" stroke-width="2"/><rect x="0" y="20" width="180" height="40" fill="#bfdbfe"/><line x1="0" y1="20" x2="450" y2="20" stroke="#1e293b" stroke-width="2"/><line x1="0" y1="60" x2="450" y2="60" stroke="#1e293b" stroke-width="2"/>${[0,5,10,15,20,25,30,35,40,45,50].map(n=>`<line x1="${n*9}" y1="20" x2="${n*9}" y2="${n%10===0?5:12}" stroke="#1e293b" stroke-width="${n%10===0?2:1}"/><text x="${n*9}" y="${n%10===0?'-2':'-8'}" font-size="${n%10===0?'12':'9'}" text-anchor="middle" fill="#1e293b">${n%10===0?n:''}</text>`).join('')}<rect x="450" y="25" width="50" height="30" fill="#94a3b8" stroke="#1e293b" stroke-width="2"/><line x1="500" y1="40" x2="540" y2="40" stroke="#1e293b" stroke-width="3"/><polygon points="540,35 555,40 540,45" fill="#1e293b"/><rect x="170" y="20" width="14" height="40" fill="#1e293b"/><text x="225" y="92" text-anchor="middle" font-size="13" font-weight="700">${loc("플런저 끝 위치","Plunger position")}</text></g></svg>`;
    return { baseId: "insulinSyringe", categoryKey: "fundamentals", part: loc("투약 - 인슐린","Medication — Insulin"), emoji: "💉",
        title: loc("인슐린 주사기 단위 읽기","Reading Insulin Syringe Units"),
        desc: loc("그림의 100단위(U-100) 인슐린 주사기에 음영 처리된 약 부위는 몇 단위인가?","On this U-100 insulin syringe, how many units is the shaded amount?"),
        image: svg,
        choices: shuffle([
            { text: loc("20 단위","20 units"), effect: { hp: -2, rep: 22 }, log: loc("정답. 0~50 눈금에서 약 20 위치.","Correct. ~20 mark on the 0-50 scale.") },
            { text: loc("2 단위","2 units"), effect: { hp: -28, rep: -20 }, log: loc("눈금 단위 오해.","Misreading the scale.") },
            { text: loc("50 단위","50 units"), effect: { hp: -28, rep: -20 }, log: loc("끝까지 차 있지 않음.","Not all the way to 50.") },
            { text: loc("10 단위","10 units"), effect: { hp: -25, rep: -15 }, log: loc("10보다 더 차있음.","More than the 10 mark.") }
        ])
    };
}
function generateWoundTypesQuestion() {
    const svg = `<svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="200" fill="#fff5f5"/><g transform="translate(20,20)"><rect width="140" height="140" fill="#fde68a" rx="8"/><path d="M 30 70 Q 70 50 110 70" stroke="#991b1b" stroke-width="6" fill="none"/><text x="70" y="125" text-anchor="middle" font-size="13" font-weight="700">A</text><text x="70" y="155" text-anchor="middle" font-size="11" fill="#64748b">${loc("긁힌 자국","Scratch")}</text></g><g transform="translate(170,20)"><rect width="140" height="140" fill="#fde68a" rx="8"/><line x1="30" y1="70" x2="110" y2="70" stroke="#991b1b" stroke-width="4"/><text x="70" y="125" text-anchor="middle" font-size="13" font-weight="700">B</text><text x="70" y="155" text-anchor="middle" font-size="11" fill="#64748b">${loc("깔끔한 직선 절단","Clean cut")}</text></g><g transform="translate(320,20)"><rect width="140" height="140" fill="#fde68a" rx="8"/><path d="M 30 70 L 50 60 L 70 75 L 90 55 L 110 70" stroke="#991b1b" stroke-width="4" fill="none"/><text x="70" y="125" text-anchor="middle" font-size="13" font-weight="700">C</text><text x="70" y="155" text-anchor="middle" font-size="11" fill="#64748b">${loc("들쭉날쭉 찢어짐","Jagged tear")}</text></g><g transform="translate(470,20)"><rect width="110" height="140" fill="#fde68a" rx="8"/><circle cx="55" cy="65" r="6" fill="#991b1b"/><text x="55" y="125" text-anchor="middle" font-size="13" font-weight="700">D</text><text x="55" y="155" text-anchor="middle" font-size="11" fill="#64748b">${loc("작은 구멍","Puncture")}</text></g></svg>`;
    return { baseId: "woundTypes", categoryKey: "fundamentals", part: loc("상처","Wound"), emoji: "🩹",
        title: loc("상처 유형 식별","Identify Wound Type"),
        desc: loc("그림 C는 들쭉날쭉하게 찢어진 상처입니다. 무엇인가요?","Diagram C shows a jagged tear. What is it?"),
        image: svg,
        choices: shuffle([
            { text: loc("열상(Laceration)","Laceration"), effect: { hp: -2, rep: 22 }, log: loc("정답. 둔력에 의한 들쭉날쭉 찢김.","Correct. Jagged tear from blunt force.") },
            { text: loc("절상(Incision)","Incision"), effect: { hp: -22, rep: -12 }, log: loc("절상은 그림 B (날카로운 직선).","Incision is B (clean straight cut).") },
            { text: loc("찰과상(Abrasion)","Abrasion"), effect: { hp: -22, rep: -12 }, log: loc("찰과상은 그림 A (긁힘).","Abrasion is A (scratch).") },
            { text: loc("자상(Puncture)","Puncture"), effect: { hp: -22, rep: -12 }, log: loc("자상은 그림 D (작은 구멍).","Puncture is D (small hole).") }
        ])
    };
}
function generateBurnDepthQuestion() {
    const svg = `<svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="200" fill="#fff5f0"/><g transform="translate(20,20)"><rect width="170" height="160" fill="#fef3c7" rx="8" stroke="#92400e" stroke-width="2"/><rect x="0" y="0" width="170" height="20" fill="#fb923c"/><text x="85" y="50" text-anchor="middle" font-size="12" font-weight="700">A</text><text x="85" y="80" text-anchor="middle" font-size="11">${loc("표피만","Epidermis only")}</text><text x="85" y="100" text-anchor="middle" font-size="10" fill="#64748b">${loc("발적·통증","Red, painful")}</text><text x="85" y="120" text-anchor="middle" font-size="10" fill="#64748b">${loc("물집 없음","No blister")}</text></g><g transform="translate(215,20)"><rect width="170" height="160" fill="#fef3c7" rx="8" stroke="#92400e" stroke-width="2"/><rect x="0" y="0" width="170" height="50" fill="#dc2626"/><circle cx="60" cy="30" r="14" fill="#fbbf24" stroke="#78350f" stroke-width="2"/><circle cx="120" cy="30" r="11" fill="#fbbf24" stroke="#78350f" stroke-width="2"/><text x="85" y="80" text-anchor="middle" font-size="12" font-weight="700">B</text><text x="85" y="105" text-anchor="middle" font-size="11">${loc("표피 + 진피 일부","Epi + part dermis")}</text><text x="85" y="125" text-anchor="middle" font-size="10" fill="#64748b">${loc("물집·심한 통증","Blisters, severe pain")}</text></g><g transform="translate(410,20)"><rect width="170" height="160" fill="#fef3c7" rx="8" stroke="#92400e" stroke-width="2"/><rect x="0" y="0" width="170" height="80" fill="#1e293b"/><text x="85" y="100" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">C</text><text x="85" y="125" text-anchor="middle" font-size="11">${loc("전층 + 피하","Full + subq")}</text><text x="85" y="145" text-anchor="middle" font-size="10" fill="#64748b">${loc("검고·무통증·가죽질","Black, painless, leathery")}</text></g></svg>`;
    return { baseId: "burnDepth", categoryKey: "adult", part: loc("화상 깊이","Burn Depth"), emoji: "🔥",
        title: loc("화상 깊이 분류","Classify Burn Depth"),
        desc: loc("그림 C는 검고·무통증·가죽질 외관입니다. 어느 단계인가요?","Diagram C: black, painless, leathery. Which depth?"),
        image: svg,
        choices: shuffle([
            { text: loc("3도(전층) 화상","Third-degree (full-thickness)"), effect: { hp: -3, rep: 22 }, log: loc("정답. 신경 파괴로 무통증, 피부이식 필요.","Correct. Nerve destruction → painless; needs skin graft.") },
            { text: loc("1도 화상","First-degree"), effect: { hp: -25, rep: -15 }, log: loc("1도는 표피만·발적·통증.","1st: epidermis only, red, painful.") },
            { text: loc("표재성 2도","Superficial 2nd-degree"), effect: { hp: -25, rep: -15 }, log: loc("물집·심한 통증.","Blisters, severe pain.") },
            { text: loc("정상 피부","Normal skin"), effect: { hp: -32, rep: -22 }, log: loc("심각한 화상입니다.","Severe burn.") }
        ])
    };
}
function generateGCSImgQuestion() {
    const svg = `<svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="200" fill="#f0f9ff"/><g><rect x="20" y="20" width="180" height="160" fill="#fff" stroke="#1e293b" stroke-width="2" rx="6"/><text x="110" y="40" text-anchor="middle" font-size="14" font-weight="800">${loc("눈 (E)","Eye (E)")}</text><text x="40" y="62" font-size="11">4 ${loc("자발적","Spontaneous")}</text><text x="40" y="82" font-size="11">3 ${loc("말소리","To voice")}</text><text x="40" y="102" font-size="11" font-weight="800" fill="#dc2626">2 ${loc("통증자극","To pain")}</text><text x="40" y="122" font-size="11">1 ${loc("반응 없음","None")}</text></g><g><rect x="210" y="20" width="180" height="160" fill="#fff" stroke="#1e293b" stroke-width="2" rx="6"/><text x="300" y="40" text-anchor="middle" font-size="14" font-weight="800">${loc("언어 (V)","Verbal (V)")}</text><text x="230" y="62" font-size="11">5 ${loc("지남력 정상","Oriented")}</text><text x="230" y="82" font-size="11">4 ${loc("혼동","Confused")}</text><text x="230" y="102" font-size="11" font-weight="800" fill="#dc2626">3 ${loc("부적절 단어","Inappropriate")}</text><text x="230" y="122" font-size="11">2 ${loc("이해 불가 소리","Sounds")}</text><text x="230" y="142" font-size="11">1 ${loc("반응 없음","None")}</text></g><g><rect x="400" y="20" width="180" height="160" fill="#fff" stroke="#1e293b" stroke-width="2" rx="6"/><text x="490" y="40" text-anchor="middle" font-size="14" font-weight="800">${loc("운동 (M)","Motor (M)")}</text><text x="420" y="62" font-size="11">6 ${loc("명령 따름","Obeys")}</text><text x="420" y="82" font-size="11">5 ${loc("통증 국소화","Localizes")}</text><text x="420" y="102" font-size="11" font-weight="800" fill="#dc2626">4 ${loc("회피반응","Withdraws")}</text><text x="420" y="122" font-size="11">3 ${loc("이상 굴곡","Abn flexion")}</text><text x="420" y="142" font-size="11">2 ${loc("이상 신전","Abn extension")}</text><text x="420" y="162" font-size="11">1 ${loc("반응 없음","None")}</text></g></svg>`;
    return { baseId: "gcsImg", categoryKey: "adult", part: loc("의식 사정","Consciousness Assessment"), emoji: "👁️",
        title: loc("GCS 점수 계산 #2","GCS Calculation #2"),
        desc: loc("그림에서 빨간색으로 표시된 항목을 합산했을 때 GCS 총점과 의미는?","Sum the red-highlighted items. GCS total and meaning?"),
        image: svg,
        choices: shuffle([
            { text: loc("9점, 중등도 의식장애","9 — moderate impairment"), effect: { hp: -2, rep: 22 }, log: loc("정답. E2+V3+M4=9. 9~12=중등도.","Correct. E2+V3+M4=9. 9-12=moderate.") },
            { text: loc("3점, 깊은 혼수","3 — deep coma"), effect: { hp: -25, rep: -15 }, log: loc("3점은 모든 항목 최저.","3 = all minimum.") },
            { text: loc("15점, 정상","15 — normal"), effect: { hp: -25, rep: -15 }, log: loc("15는 모든 항목 만점.","15 = all maximum.") },
            { text: loc("12점, 경증","12 — mild"), effect: { hp: -22, rep: -12 }, log: loc("계산 오류.","Calculation error.") }
        ])
    };
}
function generateLungLobesQuestion() {
    const svg = `<svg viewBox="0 0 600 240" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="240" fill="#fef3c7"/><g transform="translate(150,20)"><path d="M 60 20 Q 30 10 20 60 L 30 200 Q 50 220 90 220 Q 130 220 150 200 L 160 60 Q 150 10 120 20 L 90 30 Z" fill="#fee2e2" stroke="#991b1b" stroke-width="2"/><line x1="30" y1="100" x2="90" y2="100" stroke="#991b1b" stroke-width="2"/><line x1="90" y1="100" x2="160" y2="100" stroke="#991b1b" stroke-width="2"/><line x1="90" y1="160" x2="160" y2="160" stroke="#991b1b" stroke-width="2"/><text x="60" y="60" text-anchor="middle" font-size="13" font-weight="700">A</text><text x="120" y="60" text-anchor="middle" font-size="13" font-weight="700">B</text><text x="60" y="160" text-anchor="middle" font-size="13" font-weight="700">D</text><text x="120" y="135" text-anchor="middle" font-size="13" font-weight="700">C</text><text x="120" y="190" text-anchor="middle" font-size="13" font-weight="700">E</text><text x="90" y="240" text-anchor="middle" font-size="11" fill="#64748b">${loc("환자 시점에서 본 폐","Lungs (patient view)")}</text></g></svg>`;
    return { baseId: "lungLobes", categoryKey: "adult", part: loc("호흡기 해부","Pulmonary Anatomy"), emoji: "🫁",
        title: loc("폐엽 식별","Identify Lung Lobe"),
        desc: loc("그림에서 환자 우측에만 존재하는 \"중엽(Middle lobe)\"은 어디인가요?","Where is the right middle lobe (only on the right side)?"),
        image: svg,
        choices: shuffle([
            { text: loc("C (우측 중엽)","C (Right Middle Lobe)"), effect: { hp: -2, rep: 22 }, log: loc("정답. 우측만 3엽(상·중·하), 좌측은 2엽 + 설.","Correct. Right has 3 lobes (upper/middle/lower); left has 2 + lingula.") },
            { text: loc("A (우측 상엽)","A (Right Upper Lobe)"), effect: { hp: -22, rep: -12 }, log: loc("A는 우상엽.","A = right upper lobe.") },
            { text: loc("D (우측 하엽)","D (Right Lower Lobe)"), effect: { hp: -22, rep: -12 }, log: loc("D는 우하엽.","D = right lower lobe.") },
            { text: loc("B (좌측 상엽)","B (Left Upper Lobe)"), effect: { hp: -22, rep: -12 }, log: loc("B는 좌상엽.","B = left upper lobe.") }
        ])
    };
}
function generateCrutchGaitImgQuestion() {
    const svg = `<svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="200" fill="#f0fdf4"/><g transform="translate(40,20)"><circle cx="40" cy="20" r="12" fill="#fde68a"/><line x1="40" y1="32" x2="40" y2="100" stroke="#1e293b" stroke-width="3"/><line x1="40" y1="100" x2="20" y2="160" stroke="#1e293b" stroke-width="3"/><line x1="40" y1="100" x2="60" y2="140" stroke="#1e293b" stroke-width="3" stroke-dasharray="6,4"/><line x1="20" y1="60" x2="5" y2="160" stroke="#dc2626" stroke-width="2.5"/><line x1="60" y1="60" x2="80" y2="160" stroke="#dc2626" stroke-width="2.5"/><text x="40" y="180" text-anchor="middle" font-size="13" font-weight="700">A</text></g><g transform="translate(180,20)"><circle cx="40" cy="20" r="12" fill="#fde68a"/><line x1="40" y1="32" x2="40" y2="100" stroke="#1e293b" stroke-width="3"/><line x1="40" y1="100" x2="20" y2="160" stroke="#1e293b" stroke-width="3"/><line x1="40" y1="100" x2="60" y2="160" stroke="#1e293b" stroke-width="3"/><line x1="20" y1="60" x2="0" y2="120" stroke="#dc2626" stroke-width="2.5"/><line x1="60" y1="60" x2="80" y2="120" stroke="#dc2626" stroke-width="2.5"/><text x="40" y="180" text-anchor="middle" font-size="13" font-weight="700">B</text></g><g transform="translate(320,20)"><circle cx="40" cy="20" r="12" fill="#fde68a"/><line x1="40" y1="32" x2="40" y2="100" stroke="#1e293b" stroke-width="3"/><line x1="40" y1="100" x2="40" y2="170" stroke="#1e293b" stroke-width="3"/><line x1="20" y1="60" x2="-10" y2="170" stroke="#dc2626" stroke-width="2.5"/><line x1="60" y1="60" x2="90" y2="170" stroke="#dc2626" stroke-width="2.5"/><text x="40" y="195" text-anchor="middle" font-size="13" font-weight="700">C</text></g><text x="450" y="100" font-size="13" fill="#1e293b">${loc("점선=비체중부하","Dashed = non-weight-bearing")}</text></svg>`;
    return { baseId: "crutchGaitImg", categoryKey: "fundamentals", part: loc("보행 보조","Mobility"), emoji: "🦯",
        title: loc("목발 걸음 식별","Identify Crutch Gait"),
        desc: loc("그림 C: 한쪽 다리는 부하 불가, 양쪽 목발과 성한 다리만으로 이동. 어떤 걸음인가요?","C: one leg non-weight-bearing, both crutches + good leg only. Which gait?"),
        image: svg,
        choices: shuffle([
            { text: loc("3점 걸음(Three-point)","Three-point gait"), effect: { hp: -2, rep: 22 }, log: loc("정답. 비체중부하 + 양쪽 목발 = 3점 걸음.","Correct. Non-weight-bearing + both crutches = 3-point.") },
            { text: loc("2점 걸음","Two-point gait"), effect: { hp: -22, rep: -12 }, log: loc("2점은 부분 체중부하용.","2-point: partial weight-bearing.") },
            { text: loc("4점 걸음","Four-point gait"), effect: { hp: -22, rep: -12 }, log: loc("4점은 양쪽 다리 모두 체중부하 가능 시.","4-point: both legs bear weight.") },
            { text: loc("Swing-through","Swing-through"), effect: { hp: -22, rep: -12 }, log: loc("양 다리 마비 시 사용.","For both legs paralyzed.") }
        ])
    };
}
function generateBodyPositionQuestion() {
    const svg = `<svg viewBox="0 0 600 180" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="180" fill="#fef3f7"/><g transform="translate(30,40)"><rect x="0" y="40" width="160" height="14" fill="#94a3b8"/><ellipse cx="30" cy="30" rx="20" ry="10" fill="#fed7aa" stroke="#9a3412" stroke-width="1.5"/><rect x="50" y="22" width="80" height="16" fill="#fecaca" stroke="#991b1b" stroke-width="1.5" rx="4"/><circle cx="135" cy="35" r="6" fill="#fed7aa"/><text x="80" y="100" text-anchor="middle" font-size="13" font-weight="700">A</text><text x="80" y="120" text-anchor="middle" font-size="10" fill="#64748b">${loc("등을 대고 누움","On back")}</text></g><g transform="translate(220,40)"><rect x="0" y="40" width="160" height="14" fill="#94a3b8"/><ellipse cx="30" cy="50" rx="20" ry="10" fill="#fed7aa" stroke="#9a3412" stroke-width="1.5"/><rect x="50" y="42" width="80" height="16" fill="#fecaca" stroke="#991b1b" stroke-width="1.5" rx="4"/><text x="80" y="100" text-anchor="middle" font-size="13" font-weight="700">B</text><text x="80" y="120" text-anchor="middle" font-size="10" fill="#64748b">${loc("배를 대고 엎드림","On stomach")}</text></g><g transform="translate(410,40)"><rect x="0" y="40" width="160" height="14" fill="#94a3b8"/><circle cx="40" cy="35" r="14" fill="#fed7aa" stroke="#9a3412" stroke-width="1.5"/><ellipse cx="100" cy="35" rx="40" ry="14" fill="#fecaca" stroke="#991b1b" stroke-width="1.5"/><text x="80" y="100" text-anchor="middle" font-size="13" font-weight="700">C</text><text x="80" y="120" text-anchor="middle" font-size="10" fill="#64748b">${loc("옆으로 누움","Side-lying")}</text></g></svg>`;
    return { baseId: "bodyPosition", categoryKey: "fundamentals", part: loc("체위 식별","Position ID"), emoji: "🛏️",
        title: loc("환자 체위","Patient Position"),
        desc: loc("ARDS·심한 저산소혈증 환자에게서 산소화를 향상시키는 그림 속 체위는?","Position that improves oxygenation in ARDS/severe hypoxemia?"),
        image: svg,
        choices: shuffle([
            { text: loc("B (복위, Prone)","B (Prone)"), effect: { hp: -3, rep: 22 }, log: loc("정답. ARDS에서 prone position이 산소화·생존율 향상.","Correct. Prone improves oxygenation/mortality in ARDS.") },
            { text: loc("A (앙와위, Supine)","A (Supine)"), effect: { hp: -25, rep: -15 }, log: loc("앙와위는 ARDS에서 권장되지 않음.","Supine isn't preferred in ARDS.") },
            { text: loc("C (측와위, Lateral)","C (Lateral)"), effect: { hp: -25, rep: -15 }, log: loc("측와위는 흡인 예방 등 다른 목적.","Lateral for aspiration prevention etc.") },
            { text: loc("Trendelenburg","Trendelenburg"), effect: { hp: -28, rep: -20 }, log: loc("심한 저산소혈증에 부적합.","Inappropriate for severe hypoxemia.") }
        ])
    };
}
function generateDTRGradingQuestion() {
    const svg = `<svg viewBox="0 0 600 180" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="180" fill="#f0f9ff"/><g><rect x="20" y="20" width="560" height="140" fill="#fff" stroke="#1e293b" stroke-width="2" rx="6"/><text x="300" y="40" text-anchor="middle" font-size="14" font-weight="800">${loc("심부건반사(DTR) 등급","DTR Grading Scale")}</text><line x1="40" y1="60" x2="560" y2="60" stroke="#1e293b" stroke-width="1.5"/><text x="60" y="80" font-size="12" font-weight="700">0</text><text x="100" y="80" font-size="11">${loc("반응 없음","Absent")}</text><text x="60" y="100" font-size="12" font-weight="700">1+</text><text x="100" y="100" font-size="11">${loc("감소·약간","Diminished")}</text><text x="60" y="120" font-size="12" font-weight="700">2+</text><text x="100" y="120" font-size="11" fill="#16a34a">${loc("정상","Normal")}</text><text x="60" y="140" font-size="12" font-weight="700">3+</text><text x="100" y="140" font-size="11">${loc("증가·기준선 근접","Brisker than normal")}</text><text x="320" y="80" font-size="12" font-weight="700" fill="#dc2626">4+</text><text x="360" y="80" font-size="11" fill="#dc2626">${loc("매우 증가·간헐적 클로누스","Very brisk, clonus")}</text><text x="300" y="115" text-anchor="middle" font-size="11" fill="#64748b">${loc("산모 4+ 자간증 위험","4+ in pregnancy = eclampsia risk")}</text></g></svg>`;
    return { baseId: "dtrGrading", categoryKey: "maternal", part: loc("DTR 등급","DTR Grading"), emoji: "🔨",
        title: loc("DTR 등급 해석","DTR Grade Interpretation"),
        desc: loc("자간증 산모에서 DTR이 4+로 측정됐다. 의미는?","Pregnant patient with DTR 4+. What does it indicate?"),
        image: svg,
        choices: shuffle([
            { text: loc("자간증·뇌 자극 증가 - 즉시 MgSO4 점검","Eclampsia/CNS hyperexcitability — check MgSO4 levels"), effect: { hp: -3, rep: 22 }, log: loc("정답. 4+는 매우 증가 - 발작 임박 가능.","Correct. 4+ = hyperreflexia, possible impending seizure.") },
            { text: loc("정상 - 처치 불요","Normal — no action"), effect: { hp: -38, rep: -28 }, log: loc("4+는 정상이 아닙니다. 정상은 2+.","4+ is not normal. Normal is 2+.") },
            { text: loc("MgSO4 독성으로 즉시 중단","MgSO4 toxicity — discontinue"), effect: { hp: -32, rep: -22 }, log: loc("MgSO4 독성은 DTR 소실(0).","Mg toxicity = absent DTR (0).") },
            { text: loc("저칼슘혈증 의심","Suspect hypocalcemia"), effect: { hp: -25, rep: -15 }, log: loc("저Ca도 DTR 증가하지만 산모 4+는 자간증 우선.","Hypocalcemia also raises DTR but pregnant context = eclampsia first.") }
        ])
    };
}
function generateIVDripCalcQuestion() {
    const total = 1000; const hours = 8; const factor = 15;
    const rate = Math.round((total / (hours * 60)) * factor);
    const svg = `<svg viewBox="0 0 600 180" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="180" fill="#f0f9ff"/><g transform="translate(40,20)"><rect x="0" y="0" width="120" height="100" fill="#dbeafe" stroke="#1e40af" stroke-width="2" rx="4"/><text x="60" y="30" text-anchor="middle" font-size="13" font-weight="700">${loc("수액","IV Fluid")}</text><text x="60" y="55" text-anchor="middle" font-size="20" font-weight="800" fill="#1e40af">${total} mL</text><text x="60" y="80" text-anchor="middle" font-size="13" fill="#64748b">D5W</text></g><g transform="translate(220,20)"><line x1="0" y1="50" x2="80" y2="50" stroke="#1e293b" stroke-width="3"/><polygon points="80,40 100,50 80,60" fill="#1e293b"/><text x="50" y="35" text-anchor="middle" font-size="13" font-weight="700">${hours} ${loc("시간","hours")}</text><text x="50" y="80" text-anchor="middle" font-size="11" fill="#64748b">${loc("총 시간","total time")}</text></g><g transform="translate(360,20)"><circle cx="50" cy="50" r="40" fill="#fef3c7" stroke="#92400e" stroke-width="2"/><text x="50" y="45" text-anchor="middle" font-size="11" font-weight="700">drop</text><text x="50" y="62" text-anchor="middle" font-size="14" font-weight="800">${factor}</text><text x="50" y="78" text-anchor="middle" font-size="9">gtt/mL</text></g><text x="300" y="160" text-anchor="middle" font-size="14" font-weight="700">${loc("주입속도(gtt/min)는?","Drip rate (gtt/min) = ?")}</text></svg>`;
    return { baseId: "ivDripCalc", categoryKey: "fundamentals", part: loc("수액 계산","IV Calculation"), emoji: "💧",
        title: loc("IV Drip 속도 계산","IV Drip Rate Calculation"),
        desc: loc("D5W 1000 mL를 8시간에 주입. drop factor 15 gtt/mL. 분당 점적 수는?","D5W 1000 mL over 8 hours, drop factor 15 gtt/mL. Drops per minute?"),
        image: svg,
        choices: shuffle([
            { text: `${rate} gtt/min`, effect: { hp: -2, rep: 22 }, log: loc(`정답. (${total}÷${hours*60})×${factor}=${rate}.`,`Correct. (${total}÷${hours*60})×${factor}=${rate}.`) },
            { text: `${Math.round(rate*2)} gtt/min`, effect: { hp: -25, rep: -15 }, log: loc("두 배입니다.","Doubled.") },
            { text: `${Math.round(rate/2)} gtt/min`, effect: { hp: -25, rep: -15 }, log: loc("절반입니다.","Halved.") },
            { text: `${total/hours} mL/hr`, effect: { hp: -22, rep: -12 }, log: loc("이는 시간당 mL이지 gtt/min이 아닙니다.","That's mL/hr, not gtt/min.") }
        ])
    };
}

function generatePressureUlcerStageQuestion() {
    const svg = `<svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="200" fill="#fff8f7"/><g transform="translate(20,20)"><circle cx="50" cy="60" r="42" fill="#fecaca" stroke="#dc2626" stroke-width="2"/><text x="50" y="135" text-anchor="middle" font-size="14" font-weight="700" fill="#1e293b">A</text><text x="50" y="155" text-anchor="middle" font-size="11" fill="#64748b">${loc("발적·온감","Erythema/warmth")}</text></g><g transform="translate(170,20)"><ellipse cx="50" cy="60" rx="44" ry="34" fill="#fecaca"/><ellipse cx="50" cy="60" rx="22" ry="16" fill="#fda4af" stroke="#be123c" stroke-width="1.5"/><text x="50" y="135" text-anchor="middle" font-size="14" font-weight="700" fill="#1e293b">B</text><text x="50" y="155" text-anchor="middle" font-size="11" fill="#64748b">${loc("부분층 손실","Partial loss")}</text></g><g transform="translate(320,20)"><ellipse cx="50" cy="60" rx="46" ry="36" fill="#f87171"/><ellipse cx="50" cy="60" rx="28" ry="20" fill="#fef3c7" stroke="#a16207" stroke-width="1.5"/><circle cx="50" cy="60" r="10" fill="#dc2626"/><text x="50" y="135" text-anchor="middle" font-size="14" font-weight="700" fill="#1e293b">C</text><text x="50" y="155" text-anchor="middle" font-size="11" fill="#64748b">${loc("피하지방 노출","Subq fat exposed")}</text></g><g transform="translate(470,20)"><ellipse cx="50" cy="60" rx="46" ry="36" fill="#f87171"/><ellipse cx="50" cy="60" rx="30" ry="22" fill="#92400e" stroke="#1e293b" stroke-width="1.5"/><circle cx="50" cy="62" r="14" fill="#1e293b"/><text x="44" y="66" font-size="10" fill="white">${loc("뼈","Bone")}</text><text x="50" y="135" text-anchor="middle" font-size="14" font-weight="700" fill="#1e293b">D</text><text x="50" y="155" text-anchor="middle" font-size="11" fill="#64748b">${loc("뼈/근육 노출","Bone/muscle")}</text></g></svg>`;
    return { baseId: "pressureStage", categoryKey: "fundamentals", part: loc("욕창","Pressure Ulcer"), emoji: "🛌",
        title: loc("욕창 단계 식별","Identify the Pressure Ulcer Stage"),
        desc: loc("그림 D는 뼈/근육이 노출된 상태입니다. 어느 단계인가요?","Diagram D shows exposed bone/muscle. Which stage?"),
        image: svg,
        choices: shuffle([
            { text: loc("4단계 - 뼈·근육·힘줄 노출","Stage 4 — bone, muscle, tendon exposed"), effect: { hp: -3, rep: 22 }, log: loc("정답. 4단계는 깊은 전층 손실로 골수염 위험.","Correct. Stage 4 = deep full-thickness loss with osteomyelitis risk.") },
            { text: loc("1단계 - 비창백성 발적","Stage 1 — non-blanchable erythema"), effect: { hp: -25, rep: -15 }, log: loc("1단계는 표피 무손상.","Stage 1: skin intact.") },
            { text: loc("2단계 - 부분층 손실","Stage 2 — partial-thickness loss"), effect: { hp: -25, rep: -15 }, log: loc("2단계는 표피·진피 일부.","Stage 2: epidermis + partial dermis.") },
            { text: loc("3단계 - 전층 손실, 피하지방까지","Stage 3 — full-thickness, subq fat visible"), effect: { hp: -25, rep: -15 }, log: loc("3단계는 뼈·근육 노출 없음.","Stage 3: no bone/muscle exposed.") }
        ])
    };
}

// =========================
// 라우터 및 렌더링 (중복 방지 적용)
// =========================
function generateClinicalEventByCategory(categoryKey = null, baseIdFilter = null, partFilter = null) {
    let pool = [];
    for (let generator of clinicalGenerators) {
        const ev = generator();
        normalizeEvent(ev);
        const catOk = !categoryKey || ev.categoryKey === categoryKey;
        const idOk = !baseIdFilter || baseIdFilter.includes(ev.baseId);
        const partOk = !partFilter || ev.part === partFilter;
        if (catOk && idOk && partOk && !recentlyUsed(ev.baseId)) pool.push(ev);
    }
    if (pool.length === 0) {
        gameState.recentIds = [];
        for (let generator of clinicalGenerators) {
            const ev = generator();
            normalizeEvent(ev);
            const catOk = !categoryKey || ev.categoryKey === categoryKey;
            const idOk = !baseIdFilter || baseIdFilter.includes(ev.baseId);
            const partOk = !partFilter || ev.part === partFilter;
            if (catOk && idOk && partOk) pool.push(ev);
        }
    }
    if (pool.length === 0) return null; // 빈 풀(예: 오답이 없을 때)
    const selected = pick(pool);
    rememberQuestion(selected.baseId);
    return selected;
}

function renderSceneCard(ev, options = {}) {
    const { mode = "survival", questionIndex = null, meta = [] } = options;
    const tag = ev.category ? `<div class="category-tag">${ev.category}${ev.part ? ` <span class="part">· ${ev.part}</span>` : ""}</div>` : "";
    const metaRow = meta.length ? `<div class="meta-row">${meta.map((m) => `<span class="meta-chip">${m}</span>`).join("")}</div>` : "";

    const imageBlock = ev.image ? `<div class="scene-image">${ev.image}</div>` : "";
    UI.gameArea.innerHTML = `
    <div class="scene-card card">
      ${tag}${metaRow}
      <span class="scene-emoji">${ev.emoji || "🩺"}</span>
      <h2 class="scene-title">${questionIndex !== null ? `[Q${questionIndex}] ` : ""}${ev.title}</h2>
      ${imageBlock}
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
        btn.setAttribute("aria-label", `${loc("선택지","Choice")} ${idx+1}: ${choice.text.replace(/<[^>]*>/g,"")}`);
        btn.onclick = () => {
            try {
                if (mode === "survival") handleSurvivalChoice(choice, ev);
                else handleQuizChoice(choice, ev, idx);
            } catch (e) { showErrorRecovery(e); }
        };
        listEl.appendChild(btn);
    });
    // 카드에도 ARIA
    const card = UI.gameArea.querySelector(".scene-card");
    if (card) {
        card.setAttribute("role", "region");
        card.setAttribute("aria-label", `${ev.title}`);
    }
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
    gameState.partFilter = null;
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
    // ===== 신규 12개 일상 이벤트 =====
    () => ({ baseId: "longStayDC", categoryKey: "flavor", part: loc("퇴원 순간","Discharge Moment"), emoji: "🎉", title: loc("3개월 만의 퇴원","Discharge After 3 Months"), desc: loc("3개월 입원했던 환자가 휠체어에서 일어나 직접 걸어 퇴원합니다. 가족이 박수를 칩니다.","A patient who was admitted for 3 months stands from the wheelchair and walks out. Family applauds."), choices: shuffle([
        { text: loc("환자·가족과 함께 기뻐하고 따뜻하게 배웅","Celebrate with patient/family and offer a warm sendoff"), effect: { hp: 15, rep: 18 }, log: loc("이 순간이 간호의 보람입니다.","This is why we do this work.") },
        { text: loc("형식적인 작별 인사만 한다","Give a perfunctory goodbye"), effect: { hp: -3, rep: -4 }, log: loc("기회를 놓쳤습니다.","A missed moment.") },
        { text: loc("바쁘다며 자리를 피한다","Slip away citing busyness"), effect: { hp: -8, rep: -10 }, log: loc("환자가 섭섭해합니다.","The patient feels let down.") },
        { text: loc("퇴원 교육 자료만 건네고 끝","Hand over discharge papers only"), effect: { hp: -2, rep: 2 }, log: loc("필요한 일은 했지만 마음은 못 전했습니다.","Did the task but missed the moment.") }
    ]) }),
    () => ({ baseId: "coworkerPregnancy", categoryKey: "flavor", part: loc("동료 소식","Coworker News"), emoji: "🤰", title: loc("동료의 임신 소식","Coworker's Pregnancy"), desc: loc("동료가 \"저 임신 12주예요\"라고 조용히 알려옵니다. 그동안 아침마다 화장실로 뛰어가던 게 이해됩니다.","A coworker quietly says, \"I'm 12 weeks pregnant.\" Suddenly the morning bathroom dashes make sense."), choices: shuffle([
        { text: loc("축하하고 무거운 환자 이동·방사선 노출 업무를 자청해서 분담","Congratulate and offer to take heavy lifting/radiation duties"), effect: { hp: -3, rep: 16 }, log: loc("팀 분위기가 따뜻해졌습니다.","Team warmth grows.") },
        { text: loc("축하만 하고 평소대로 분담","Just congratulate; keep normal assignments"), effect: { hp: 0, rep: 4 }, log: loc("좋지만 적극적 배려는 부족.","Nice, but not proactive.") },
        { text: loc("\"이번 분기에 시간을 잘 빼시네요\"라고 농담","Joke \"Convenient timing this quarter\""), effect: { hp: -10, rep: -14 }, log: loc("심한 농담입니다.","Crossed a line.") },
        { text: loc("수간호사에게 즉시 알려 업무 조정 요청","Immediately notify head nurse to redistribute"), effect: { hp: -6, rep: 8 }, log: loc("동료 의사 확인 없이 보고는 성급.","Reporting without coworker's consent is hasty.") }
    ]) }),
    () => ({ baseId: "powerOutage", categoryKey: "flavor", part: loc("정전","Power Outage"), emoji: "🔌", title: loc("병동 정전","Unit Blackout"), desc: loc("천둥소리와 함께 병동 절반의 전기가 나갔습니다. 인공호흡기 환자가 있습니다.","Thunder, then half the unit goes dark. A vented patient is on this floor."), choices: shuffle([
        { text: loc("벤틸레이터 환자 즉시 확인 + Ambu bag 준비, 비상 발전기 상태 확인","Immediately check vented patient + ready Ambu bag, verify backup generator"), effect: { hp: -8, rep: 22 }, log: loc("우선순위 판단이 정확합니다.","Spot-on priority judgment.") },
        { text: loc("핸드폰 손전등으로 차팅을 계속","Keep charting using phone flashlight"), effect: { hp: -25, rep: -20 }, log: loc("환자가 우선입니다.","Patients first.") },
        { text: loc("환자에게 \"전기 들어올 때까지 기다리세요\"","Tell patients \"Wait until power's back\""), effect: { hp: -28, rep: -22 }, log: loc("위급환자 사정이 안 됐습니다.","Critical patient assessment skipped.") },
        { text: loc("바로 휴게실로 대피","Evacuate to the break room yourself"), effect: { hp: -20, rep: -28 }, log: loc("책임 회피.","Abandoning duty.") }
    ]) }),
    () => ({ baseId: "vipCelebrity", categoryKey: "flavor", part: loc("연예인 입원","Celebrity Patient"), emoji: "📸", title: loc("유명 연예인 입실","Celebrity Admission"), desc: loc("유명 연예인이 익명으로 입원했습니다. 다른 환자들이 알아채고 사진을 찍으려 합니다.","A celebrity is admitted under an alias. Other patients notice and try to take photos."), choices: shuffle([
        { text: loc("타 환자에게 정중히 사진 금지를 안내하고 환자 사생활 보호","Politely tell others no photos and protect the patient's privacy"), effect: { hp: -4, rep: 18 }, log: loc("프로다운 응대.","Professional response.") },
        { text: loc("연예인에게 사인 부탁","Ask the celebrity for an autograph"), effect: { hp: -15, rep: -20 }, log: loc("심각한 직업윤리 위반.","Serious professional ethics violation.") },
        { text: loc("동료 단톡방에 알린다","Share in the team group chat"), effect: { hp: -25, rep: -28 }, log: loc("개인정보보호법 위반 위험.","Risks privacy law violation.") },
        { text: loc("그냥 무시하고 다른 일 한다","Ignore it, do other work"), effect: { hp: -10, rep: -8 }, log: loc("타 환자 행동 통제 의무가 있습니다.","Duty to manage other patients' behavior.") }
    ]) }),
    () => ({ baseId: "spiritual", categoryKey: "flavor", part: loc("영적 돌봄","Spiritual Care"), emoji: "🕊️", title: loc("환자의 영적 요청","Spiritual Request"), desc: loc("말기 환자가 \"기도해 주실 수 있나요?\"라고 묻습니다. 당신은 환자와 종교가 다릅니다.","A terminal patient asks, \"Could you pray with me?\" You don't share their religion."), choices: shuffle([
        { text: loc("환자 곁에 함께 머무르며 침묵의 동행을 제공, 원목·종교인 연결 제안","Stay with the patient in silent presence, offer chaplain referral"), effect: { hp: -3, rep: 18 }, log: loc("문화·종교적 민감성을 갖춘 응대.","Culturally and spiritually sensitive.") },
        { text: loc("\"저는 그 종교가 아니라서요\"라고 거절","Refuse: \"I don't share that religion\""), effect: { hp: -15, rep: -18 }, log: loc("영적 욕구 외면.","Dismisses spiritual needs.") },
        { text: loc("자신의 종교로 강하게 인도","Try to guide them to your own religion"), effect: { hp: -25, rep: -25 }, log: loc("종교 강요는 비윤리적.","Imposing religion is unethical.") },
        { text: loc("어색해서 자리를 피한다","Slip away awkwardly"), effect: { hp: -12, rep: -14 }, log: loc("말기 환자에게 외면은 큰 상처.","Avoidance hurts terminal patients deeply.") }
    ]) }),
    () => ({ baseId: "shiftSwap", categoryKey: "flavor", part: loc("교대 부탁","Shift Swap"), emoji: "🔄", title: loc("동료의 교대 부탁","Coworker's Shift Swap"), desc: loc("동료가 \"내일 가족 결혼식인데 N1을 바꿔줄 수 있어?\"라고 부탁합니다. 당신은 이미 4일 연속 근무 중입니다.","A coworker asks, \"My family's wedding is tomorrow — can you swap my night shift?\" You're already on day 4 of consecutive shifts."), choices: shuffle([
        { text: loc("자신의 한계를 솔직히 설명하고 다른 가능한 동료를 함께 찾는다","Honestly explain your limit and help find another colleague"), effect: { hp: 4, rep: 14 }, log: loc("자기 돌봄과 동료애의 균형.","Self-care + collegial support balanced.") },
        { text: loc("거절을 두려워해 무리하게 수락","Accept against your better judgment"), effect: { hp: -22, rep: 6 }, log: loc("환자 안전이 위협됩니다.","Patient safety at risk.") },
        { text: loc("이유 없이 단호하게 거절","Bluntly refuse without explanation"), effect: { hp: 2, rep: -14 }, log: loc("팀워크가 손상.","Damages teamwork.") },
        { text: loc("\"내가 왜?\"라며 화를 낸다","Snap \"Why me?\""), effect: { hp: -8, rep: -22 }, log: loc("관계가 깨집니다.","Relationship broken.") }
    ]) }),
    () => ({ baseId: "preceptee", categoryKey: "flavor", part: loc("프리셉티 평가","Preceptee Evaluation"), emoji: "📝", title: loc("프리셉티 평가","Evaluation Time"), desc: loc("당신이 가르치고 있는 신규 간호사가 발전 속도가 느립니다. 분기 평가 시간이 다가옵니다.","The new grad you're precepting is slow to progress. Quarterly review is coming up."), choices: shuffle([
        { text: loc("구체적 사례·수치로 강점·약점·개선 계획을 함께 작성","Co-write strengths/weaknesses/improvement plan with specific examples"), effect: { hp: -4, rep: 18 }, log: loc("객관적이고 발전적인 평가.","Objective and growth-oriented.") },
        { text: loc("\"잘 하고 있다\"고 일반적으로 칭찬만","Generic praise: \"You're doing fine\""), effect: { hp: 0, rep: -8 }, log: loc("발전 기회를 뺏습니다.","Robs them of growth.") },
        { text: loc("불만을 다른 동료들에게 토로","Complain about them to other coworkers"), effect: { hp: -8, rep: -22 }, log: loc("뒷담화는 직장 내 괴롭힘.","Workplace gossip is bullying.") },
        { text: loc("아무 평가도 하지 않고 미룬다","Skip the evaluation entirely"), effect: { hp: -5, rep: -16 }, log: loc("선임으로서의 의무 회피.","Avoiding senior duty.") }
    ]) }),
    () => ({ baseId: "dischargeRefusal", categoryKey: "flavor", part: loc("퇴원 거부","Discharge Refusal"), emoji: "🚪", title: loc("퇴원 거부 환자","Patient Refusing Discharge"), desc: loc("의학적으로 안정된 환자가 \"집에 가면 누가 돌봐줘요?\"라며 퇴원을 거부합니다.","A medically stable patient refuses discharge: \"Who'll take care of me at home?\""), choices: shuffle([
        { text: loc("사회복지팀 의뢰 + 가정간호 연계 + 가족 상담","Social work consult + home health referral + family counseling"), effect: { hp: -3, rep: 18 }, log: loc("다학제적 접근.","Multidisciplinary approach.") },
        { text: loc("\"규정상 퇴원해야 합니다\"라고 단호히 통보","\"Policy says you must leave\""), effect: { hp: -15, rep: -16 }, log: loc("환자 중심이 부족.","Not patient-centered.") },
        { text: loc("환자 동의 없이 강제 퇴원","Force discharge without consent"), effect: { hp: -32, rep: -28 }, log: loc("법적 문제 가능성.","Possible legal liability.") },
        { text: loc("입원 연장만 막연히 약속","Vaguely promise extended stay"), effect: { hp: -10, rep: -10 }, log: loc("실현되지 않을 약속.","An unkeepable promise.") }
    ]) }),
    () => ({ baseId: "languageBarrier", categoryKey: "flavor", part: loc("언어 장벽","Language Barrier"), emoji: "🗣️", title: loc("외국인 환자","Foreign Patient"), desc: loc("한국어를 못하는 외국인 환자가 통증을 호소합니다. 보호자도 영어밖에 못 합니다.","A non-Korean-speaking foreign patient is in pain. Their family only speaks English."), choices: shuffle([
        { text: loc("의료통역사·의료통역 앱·픽토그램·통증척도 사용","Use medical interpreter, translation apps, pictograms, pain scale"), effect: { hp: -3, rep: 18 }, log: loc("환자 안전과 권리를 모두 보장.","Safeguards both safety and rights.") },
        { text: loc("동료 의사가 영어 좀 한다며 무료로 통역 부탁","Ask a coworker who knows some English to translate for free"), effect: { hp: -14, rep: -10 }, log: loc("의료적으로 정확하지 않을 수 있음.","Risk of medical inaccuracy.") },
        { text: loc("그냥 한국어로 천천히 크게 말한다","Just speak Korean slowly and loudly"), effect: { hp: -22, rep: -18 }, log: loc("의사소통이 안 됩니다.","Communication fails.") },
        { text: loc("진통제만 무조건 투여","Just give analgesics regardless"), effect: { hp: -28, rep: -22 }, log: loc("사정 없이 처치는 위험.","Treatment without assessment is dangerous.") }
    ]) }),
    () => ({ baseId: "noiseComplaint", categoryKey: "flavor", part: loc("소음 민원","Noise Complaint"), emoji: "🔊", title: loc("병실 소음 민원","Roommate Noise Complaint"), desc: loc("4인실 환자 한 명이 \"옆 환자 코골이 때문에 잠을 못 잔다\"고 호소합니다.","A patient in a 4-bed room complains: \"The roommate's snoring keeps me up.\""), choices: shuffle([
        { text: loc("귀마개 제공 + 의사에게 수면제 처방 검토 요청, 가능 시 침상 재배정","Provide earplugs + ask physician for sleep aid review, reassign bed if possible"), effect: { hp: -3, rep: 16 }, log: loc("실용적 다단계 접근.","Practical multi-step approach.") },
        { text: loc("코골이 환자를 깨워 자세를 바꾼다","Wake the snoring patient to reposition"), effect: { hp: -20, rep: -14 }, log: loc("코골이 환자의 수면 권리도 침해.","Violates the snorer's right to sleep.") },
        { text: loc("\"참으세요\"라고 말한다","Just say \"Bear with it\""), effect: { hp: -16, rep: -16 }, log: loc("환자 응대로 부적절.","Inappropriate response.") },
        { text: loc("민원을 무시","Ignore the complaint"), effect: { hp: -12, rep: -16 }, log: loc("환자 만족도 저하.","Lowers satisfaction scores.") }
    ]) }),
    () => ({ baseId: "lostBelongings", categoryKey: "flavor", part: loc("물품 분실","Lost Belongings"), emoji: "💍", title: loc("환자 귀중품 분실","Lost Patient Belongings"), desc: loc("입원 중 환자의 결혼반지가 사라졌습니다. 가족이 분노합니다.","A patient's wedding ring has gone missing. The family is furious."), choices: shuffle([
        { text: loc("즉시 사실대로 보고하고 사고보고서 작성, 병원 측 조사 의뢰","Honestly report immediately + incident report + hospital investigation"), effect: { hp: -5, rep: 16 }, log: loc("투명한 절차가 신뢰를 회복.","Transparent process rebuilds trust.") },
        { text: loc("환자가 잘못 두었을 거라며 책임 회피","Blame patient for misplacing it"), effect: { hp: -22, rep: -22 }, log: loc("관계가 더 악화.","Relationship gets worse.") },
        { text: loc("개인 돈으로 비슷한 반지를 사서 보상","Buy a similar ring with personal money"), effect: { hp: -15, rep: -10 }, log: loc("절차 위반이며 추후 문제 가능.","Violates procedure, may backfire.") },
        { text: loc("아무 일 없었던 것처럼 무시","Ignore as if nothing happened"), effect: { hp: -28, rep: -28 }, log: loc("법적 문제 가능성.","Possible legal liability.") }
    ]) }),
    () => ({ baseId: "selfDoubt", categoryKey: "flavor", part: loc("자기 의심","Self-Doubt"), emoji: "🤔", title: loc("실수 후의 자책","Self-Doubt After a Mistake"), desc: loc("실수로 환자에게 잘못된 시간에 약을 줄 뻔했습니다. 동료가 미리 잡아줬습니다. 마음이 무너집니다.","You almost gave the wrong dose at the wrong time. A coworker caught it. You're shaken."), choices: shuffle([
        { text: loc("near-miss 보고서를 작성하고 시스템 개선 회의에 참여","File a near-miss report and join the safety improvement meeting"), effect: { hp: -3, rep: 20 }, log: loc("개인 실수를 시스템 학습으로 전환.","Turns personal error into systemic learning.") },
        { text: loc("아무에게도 말하지 않고 자책하며 일을 계속","Tell no one and keep working in silence"), effect: { hp: -22, rep: -8 }, log: loc("학습 기회 상실 + 번아웃 위험.","Lost learning + burnout risk.") },
        { text: loc("동료를 탓한다","Blame the coworker who caught it"), effect: { hp: -16, rep: -22 }, log: loc("관계와 안전문화 모두 손상.","Damages relationship and safety culture.") },
        { text: loc("아무것도 아닌 일이라며 잊는다","Brush it off as nothing"), effect: { hp: -12, rep: -14 }, log: loc("재발 위험을 무시.","Ignores recurrence risk.") }
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

    const wrongCount = gameState.studyTools.wrongIds.length;
    const bookmarkCount = gameState.studyTools.bookmarkIds.length;
    const dueCount = getSrsDueIds().length;
    UI.gameArea.innerHTML = `
    <div class="scene-card card">
      <span class="scene-emoji">📖</span>
      <h2 class="scene-title">${t("trainingTitle")}</h2>
      <p class="scene-desc">${t("trainingDesc")}</p>
      <div class="choice-list">
        ${CATEGORY_KEYS.map((key) => `<button class="choice-btn primary" data-cat="${key}">${catName(key)}</button>`).join("")}
        <hr style="border:0; border-top:1px dashed rgba(99,102,241,0.2); margin: 14px 0 10px;">
        <button class="choice-btn ghost" data-tool="srs">${t("srsBtn")} <span class="tool-count">${dueCount}</span></button>
        <button class="choice-btn ghost" data-tool="wrong">${t("wrongReviewBtn")} <span class="tool-count">${wrongCount}</span></button>
        <button class="choice-btn ghost" data-tool="bookmark">${t("bookmarkBtn")} <span class="tool-count">${bookmarkCount}</span></button>
        <button class="choice-btn ghost" data-tool="timed">${t("timedExamBtn")}</button>
        <button class="choice-btn center" onclick="goHome()">${t("backMenu")}</button>
      </div>
    </div>
  `;
    UI.gameArea.querySelectorAll("[data-cat]").forEach(btn => {
        btn.addEventListener("click", () => pickCategory(btn.dataset.cat));
    });
    UI.gameArea.querySelectorAll("[data-tool]").forEach(btn => {
        btn.addEventListener("click", () => {
            if (btn.dataset.tool === "wrong") startWrongReview();
            else if (btn.dataset.tool === "bookmark") startBookmarkReview();
            else if (btn.dataset.tool === "timed") startTimedExam();
            else if (btn.dataset.tool === "srs") startSrsReview();
        });
    });
}

// SRS 모드 — 도래(due)한 카드만 풀이
function startSrsReview() {
    const due = getSrsDueIds();
    if (due.length === 0) {
        showToast(t(Object.keys(gameState.srs.cards).length === 0 ? "srsAllNew" : "srsEmpty"));
        return;
    }
    gameState.mode = "srs_review"; gameState.quizCategory = null; gameState.quizSolved = 0;
    UI.logBar.innerHTML = ""; addLog(t("srsBtn"), "log-important");
    renderNextQuizQuestion();
}

// 카테고리 안의 서브토픽 목록을 수집
function getPartsForCategory(categoryKey) {
    const parts = new Map(); // koPart -> count
    for (const gen of clinicalGenerators) {
        const ev = gen();
        normalizeEvent(ev);
        if (ev.categoryKey === categoryKey && ev.part) {
            // 양 언어 part 보존을 위해 원본을 다시 추출 - 현재 lang의 part가 키
            parts.set(ev.part, (parts.get(ev.part) || 0) + 1);
        }
    }
    return Array.from(parts.entries()); // [[partLabel, count], ...]
}

// 카테고리 클릭 → 서브토픽 선택 화면 (part 카운트가 1개면 바로 시작)
function pickCategory(categoryKey) {
    const parts = getPartsForCategory(categoryKey);
    if (parts.length <= 1) { startQuiz(categoryKey, null); return; }
    gameState.mode = "subtopic_picker"; gameState.quizCategory = categoryKey;
    showCoreUI(); UI.logBar.innerHTML = "";
    UI.gameArea.innerHTML = `
    <div class="scene-card card">
      <span class="scene-emoji">🔍</span>
      <h2 class="scene-title">${catName(categoryKey)}</h2>
      <p class="scene-desc">${t("chooseTopic")}</p>
      <div class="choice-list">
        <button class="choice-btn primary" data-part="__all__">${t("allTopics")}</button>
        ${parts.map(([p, n]) => `<button class="choice-btn ghost" data-part="${encodeURIComponent(p)}">${p} <span class="tool-count">${n}</span></button>`).join("")}
        <button class="choice-btn center" onclick="renderQuizMenu()">${t("backMenu")}</button>
      </div>
    </div>`;
    UI.gameArea.querySelectorAll("[data-part]").forEach(btn => {
        btn.addEventListener("click", () => {
            const p = btn.dataset.part;
            startQuiz(categoryKey, p === "__all__" ? null : decodeURIComponent(p));
        });
    });
}

function startQuiz(categoryKey, partFilter) {
    gameState.mode = "quiz"; gameState.quizCategory = categoryKey; gameState.quizSolved = 0;
    gameState.partFilter = partFilter || null;
    UI.logBar.innerHTML = ""; addLog(`${catName(categoryKey)}${partFilter ? " · " + partFilter : ""} ${t("trainingStart")}`, "log-important");
    renderNextQuizQuestion();
}

// 오답노트 모드 — 사용자가 틀린 적 있는 문제만 풀이
function startWrongReview() {
    if (gameState.studyTools.wrongIds.length === 0) {
        showToast(t("wrongEmpty"));
        return;
    }
    gameState.mode = "review_wrong"; gameState.quizCategory = null; gameState.quizSolved = 0;
    UI.logBar.innerHTML = ""; addLog(t("wrongReviewBtn"), "log-important");
    renderNextQuizQuestion();
}

// 북마크 모드 — 사용자가 별표한 문제만 풀이
function startBookmarkReview() {
    if (gameState.studyTools.bookmarkIds.length === 0) {
        showToast(t("bookmarkEmpty"));
        return;
    }
    gameState.mode = "review_bookmark"; gameState.quizCategory = null; gameState.quizSolved = 0;
    UI.logBar.innerHTML = ""; addLog(t("bookmarkBtn"), "log-important");
    renderNextQuizQuestion();
}

// 모의시험 — 30문항·30분 카운트다운
function startTimedExam() {
    gameState.mode = "timed_exam"; gameState.quizCategory = null; gameState.quizSolved = 0;
    gameState.correctCount = 0; gameState.wrongCount = 0;
    gameState.recentIds = [];
    gameState.timedExam = {
        startMs: Date.now(),
        durationMs: 30 * 60 * 1000,
        total: 30,
        done: 0,
        correct: 0,
        wrong: 0,
        tickHandle: null,
    };
    UI.logBar.innerHTML = ""; addLog(t("timedExamBtn"), "log-important");
    renderNextQuizQuestion();
    startExamTicker();
}

function startExamTicker() {
    const exam = gameState.timedExam;
    if (!exam) return;
    if (exam.tickHandle) clearInterval(exam.tickHandle);
    const tick = () => {
        if (gameState.mode !== "timed_exam") { clearInterval(exam.tickHandle); return; }
        const elapsed = Date.now() - exam.startMs;
        const remaining = Math.max(0, exam.durationMs - elapsed);
        const el = document.getElementById("exam-timer");
        if (el) el.textContent = formatMs(remaining);
        if (remaining === 0) { clearInterval(exam.tickHandle); finishTimedExam(true); }
    };
    tick();
    exam.tickHandle = setInterval(tick, 1000);
}
function formatMs(ms) {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60); const s = total % 60;
    return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}
function finishTimedExam(timeUp) {
    const exam = gameState.timedExam;
    if (exam && exam.tickHandle) clearInterval(exam.tickHandle);
    const elapsed = exam ? Date.now() - exam.startMs : 0;
    const correct = exam ? exam.correct : gameState.correctCount;
    const wrong = exam ? exam.wrong : gameState.wrongCount;
    const total = correct + wrong;
    const acc = total > 0 ? Math.round((correct / total) * 100) : 0;
    const title = timeUp ? t("examTimeUp") : t("examFinishTitle");
    const desc = `${t("examScoreLabel")}: ${correct} / ${exam ? exam.total : total}\n${t("accuracyLabel")}: ${acc}%\n${t("examTimeUsed")}: ${formatMs(elapsed)}`;
    gameState.timedExam = null;
    showGameOver(title, desc);
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
    let baseIdFilter = null;
    let categoryKey = gameState.quizCategory;
    if (gameState.mode === "review_wrong")     baseIdFilter = gameState.studyTools.wrongIds.slice();
    if (gameState.mode === "review_bookmark")  baseIdFilter = gameState.studyTools.bookmarkIds.slice();
    if (gameState.mode === "srs_review")       baseIdFilter = getSrsDueIds();
    if (gameState.mode === "timed_exam")       categoryKey = null;
    const partFilter = (gameState.mode === "quiz") ? (gameState.partFilter || null) : null;
    const ev = generateClinicalEventByCategory(categoryKey, baseIdFilter, partFilter);
    if (!ev) {
        showGameOver(loc("📋 풀이 종료","📋 Done"), loc("더 이상 풀 문제가 없습니다.","No more questions to review."));
        return;
    }
    const meta = [];
    if (gameState.mode === "timed_exam" && gameState.timedExam) {
        meta.push(`${t("examQNumLabel")} ${gameState.timedExam.done + 1}/${gameState.timedExam.total}`);
        meta.push(`<span id="exam-timer">${formatMs(gameState.timedExam.durationMs - (Date.now() - gameState.timedExam.startMs))}</span>`);
    } else if (gameState.mode === "review_wrong") {
        meta.push(t("wrongReviewBtn"));
    } else if (gameState.mode === "review_bookmark") {
        meta.push(t("bookmarkBtn"));
    } else if (gameState.mode === "srs_review") {
        const card = gameState.srs.cards[ev.baseId];
        meta.push(t("srsBtn"));
        if (card) meta.push(`${t("srsBoxLabel")} ${card.box}/5`);
    } else {
        meta.push(`${catName(gameState.quizCategory)}`);
        if (gameState.partFilter) meta.push(`🔍 ${gameState.partFilter}`);
        meta.push(`${loc("해결","Solved")}: ${gameState.quizSolved}`);
    }
    renderSceneCard(ev, { mode: "quiz", questionIndex: gameState.quizSolved + 1, meta });
}

function handleQuizChoice(choice, ev) {
    document.querySelectorAll("#choice-list .choice-btn").forEach((b) => (b.disabled = true));
    const isCorrect = (choice.effect?.rep || 0) > 0;
    const correctChoice = ev.choices.find(c => (c.effect?.rep || 0) > 0);
    const isExam = gameState.mode === "timed_exam";

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
        <button class="choice-btn ghost center" id="bookmark-btn">${isBookmarked(ev.baseId) ? t("bookmarkRemove") : t("bookmarkAdd")}</button>
        <button class="choice-btn primary center" id="next-btn">${isExam ? t("nextExamQ") : t("nextQuestion")}</button>
        ${isExam ? `<button class="choice-btn center" onclick="finishTimedExam(false)">${t("finishExamBtn")}</button>` : `<button class="choice-btn center" onclick="renderQuizMenu()">${t("changeSubject")}</button>`}
      </div>`;
    document.getElementById("feedback-zone").innerHTML = feedbackHtml;

    document.getElementById("bookmark-btn").onclick = () => {
        const added = toggleBookmark(ev.baseId);
        showToast(added ? t("bookmarkSaved") : t("bookmarkRemoved"));
        document.getElementById("bookmark-btn").textContent = added ? t("bookmarkRemove") : t("bookmarkAdd");
    };
    document.getElementById("next-btn").onclick = goNextQuiz;

    const correctTag = loc("[정답]", "[Correct]");
    const wrongTag = loc("[오답]", "[Wrong]");
    if (isCorrect) {
        gameState.rep += 6;
        gameState.quizSolved += 1;
        gameState.correctCount += 1;
        gameState.lifetime.totalQuizSolved += 1;
        // 정복: 오답노트에서 제거
        if (gameState.studyTools.wrongIds.includes(ev.baseId)) {
            removeWrongId(ev.baseId);
            addLog(t("masteredFromWrong"), "log-good");
        }
        saveSettings();
        addLog(`${correctTag} ${choice.log}`, "log-good");
    } else {
        gameState.hp -= Math.round(4 * gameState.difficulty);
        gameState.wrongCount += 1;
        // 자동 오답노트 추가
        addWrongId(ev.baseId);
        addLog(`${wrongTag} ${choice.log}`, "log-bad");
        if (correctChoice) addLog(`${t("correctAnswer")}: ${correctChoice.text}`, "log-important");
    }
    // 모든 답 후 SRS 카드 업데이트 (간격반복)
    srsAnswered(ev.baseId, isCorrect);
    gameState.hp = clamp(gameState.hp, 0, 100);

    // 모의시험 카운터 갱신·종료 처리
    if (isExam && gameState.timedExam) {
        gameState.timedExam.done += 1;
        if (isCorrect) gameState.timedExam.correct += 1; else gameState.timedExam.wrong += 1;
        if (gameState.timedExam.done >= gameState.timedExam.total) {
            setTimeout(() => finishTimedExam(false), 800);
        }
    }
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
// 전역 에러 바운더리 — 생성기 throw 시 앱이 멈추지 않게
// =========================
function showErrorRecovery(err) {
    try {
        const safeMsg = (err && err.message ? String(err.message) : String(err)).slice(0, 240);
        if (UI && UI.gameArea) {
            UI.gameArea.innerHTML = `
              <div class="card" role="alert">
                <span class="scene-emoji">⚠️</span>
                <h2 class="scene-title">${loc("문제가 발생했어요","Something went wrong")}</h2>
                <p class="scene-desc">${loc("앱이 일시적인 오류를 만났습니다. 메인으로 돌아가거나 다시 시도해주세요.","The app hit a transient error. Return home or try again.")}</p>
                <details style="font-size:0.8rem; color:#64748b; margin-bottom:14px;"><summary>${loc("기술 정보","Technical info")}</summary><pre style="white-space:pre-wrap; word-break:break-word;">${safeMsg}</pre></details>
                <button class="choice-btn primary" onclick="location.reload()">${loc("앱 다시 시작","Restart App")}</button>
                <button class="choice-btn ghost center" onclick="goHome()">${loc("메인 메뉴","Main Menu")}</button>
              </div>`;
        }
    } catch (_e) { /* 에러 표시 자체가 실패하면 무시 */ }
}
window.addEventListener("error", (e) => { showErrorRecovery(e.error || e.message); });
window.addEventListener("unhandledrejection", (e) => { showErrorRecovery(e.reason); });

// =========================
// 초기화
// =========================
loadSettings();
window.addEventListener("DOMContentLoaded", () => {
    try {
        syncLangButtons();
        renderMainMenu();
        if (!gameState.disclaimerAccepted) {
            setTimeout(() => showDisclaimer(true), 200);
        }
    } catch (e) { showErrorRecovery(e); }
});

// 서비스 워커 등록 (오프라인 PWA)
if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    });
}