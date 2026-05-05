// =========================
// 상태
// =========================
const MAX_PROGRESS_EVENTS = 20;

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
};

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
    // 최근 25개의 문제 유형을 기억하여 중복을 원천 차단
    if (gameState.recentIds.length > 25) {
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

    if (gameState.mode === "survival") UI.progressText.textContent = "듀티 진행도";
    else if (gameState.mode === "quiz") UI.progressText.textContent = `학습 진행도 · ${gameState.quizCategory || ""}`;
    else UI.progressText.textContent = "진행도";

    UI.inventory.innerHTML = "";
    const shiftBadge = document.createElement("span");
    shiftBadge.className = "badge accent";
    shiftBadge.textContent = `근무: ${gameState.currentShift}`;
    UI.inventory.appendChild(shiftBadge);

    const statusBadge = document.createElement("span");
    statusBadge.className = "badge";
    statusBadge.textContent = gameState.mode === "survival" ? "상태: 실전 모드" : gameState.mode === "quiz" ? "상태: 트레이닝" : "상태: 대기";
    UI.inventory.appendChild(statusBadge);

    if (gameState.quizSolved > 0) {
        const solvedBadge = document.createElement("span");
        solvedBadge.className = "badge success";
        solvedBadge.textContent = `학습 완료: ${gameState.quizSolved}문제`;
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
    generatePostOpQuestion, generateHeartFailureQuestion
];

function generateABGAQuestion() {
    const isAcidosis = Math.random() < 0.5; const isResp = Math.random() < 0.5;
    let pH, PaCO2, HCO3, correctType;
    if (isAcidosis && isResp) { pH = (7.20 + Math.random() * 0.1).toFixed(2); PaCO2 = rand(46, 60); HCO3 = rand(22, 26); correctType = "호흡성 산증"; } 
    else if (isAcidosis && !isResp) { pH = (7.20 + Math.random() * 0.1).toFixed(2); PaCO2 = rand(35, 45); HCO3 = rand(15, 21); correctType = "대사성 산증"; } 
    else if (!isAcidosis && isResp) { pH = (7.46 + Math.random() * 0.1).toFixed(2); PaCO2 = rand(20, 34); HCO3 = rand(22, 26); correctType = "호흡성 알칼리증"; } 
    else { pH = (7.46 + Math.random() * 0.1).toFixed(2); PaCO2 = rand(35, 45); HCO3 = rand(27, 35); correctType = "대사성 알칼리증"; }
    const types = ["호흡성 산증", "대사성 산증", "호흡성 알칼리증", "대사성 알칼리증"]; const wrongs = types.filter(t => t !== correctType);
    return { baseId: "abga", category: "성인간호학", part: "호흡/ABGA", emoji: "🩸", title: "ABGA 판독", desc: `pH ${pH}, PaCO2 ${PaCO2}, HCO3- ${HCO3}\n이 환자의 상태는?`, choices: shuffle([{ text: correctType, effect: { hp: -5, rep: 25 }, log: "정답입니다. pH와 PaCO2, HCO3 수치 해석이 정확합니다." }, { text: wrongs[0], effect: { hp: -30, rep: -15 }, log: "수치 해석 오류입니다." }, { text: wrongs[1], effect: { hp: -30, rep: -15 }, log: "수치 해석 오류입니다." }, { text: wrongs[2], effect: { hp: -30, rep: -15 }, log: "수치 해석 오류입니다." }]) };
}
function generateTriageQuestion() { return { baseId: "triage", category: "지역사회간호학", part: "재난간호", emoji: "🚨", title: "START 분류", desc: `기도 유지 후에도 무호흡인 환자의 중증도 분류 색상은?`, choices: shuffle([{ text: "흑색 (Black / 사망 또는 지연)", effect: { hp: -5, rep: 20 }, log: "정답. 기도 개방 후에도 무호흡이면 흑색입니다." }, { text: "적색 (Red / 긴급)", effect: { hp: -25, rep: -15 }, log: "적색은 생존 가능한 중증 환자입니다." }, { text: "황색 (Yellow / 응급)", effect: { hp: -20, rep: -10 }, log: "황색은 수시간 내 처치가 필요한 환자입니다." }, { text: "녹색 (Green / 비응급)", effect: { hp: -15, rep: -5 }, log: "녹색은 경증 환자입니다." }]) }; }
function generatePositionQuestion() { return { baseId: "position", category: "기본간호학", part: "체위", emoji: "🛏️", title: "목적에 맞는 체위", desc: `관장(Enema) 시 용액이 잘 들어가도록 가장 적절히 취해줄 체위는?`, choices: shuffle([{ text: "좌측 심스위(Sims')", effect: { hp: -2, rep: 15 }, log: "정답. 구불결장으로 용액이 잘 흘러갑니다." }, { text: "파울러씨위", effect: { hp: -15, rep: -10 }, log: "호흡곤란 시 취하는 체위입니다." }, { text: "트렌델렌버그위", effect: { hp: -20, rep: -15 }, log: "쇼크 시 다리 거상 체위입니다." }, { text: "배횡와위", effect: { hp: -15, rep: -10 }, log: "여성 인공도뇨 시 취하는 체위입니다." }]) }; }
function generateVaccineQuestion() { return { baseId: "vaccine", category: "아동간호학", part: "예방접종", emoji: "💉", title: "정기 예방접종", desc: `생후 12~15개월에 접종해야 하는 백신은?`, choices: shuffle([{ text: "MMR (홍역, 볼거리, 풍진)", effect: { hp: -2, rep: 18 }, log: "정답. 수두와 함께 12~15개월 접종입니다." }, { text: "BCG (결핵)", effect: { hp: -25, rep: -15 }, log: "생후 4주 이내 접종합니다." }, { text: "B형 간염", effect: { hp: -20, rep: -10 }, log: "0, 1, 6개월 접종입니다." }, { text: "DTaP", effect: { hp: -15, rep: -10 }, log: "2, 4, 6개월 접종입니다." }]) }; }
function generateTransfusionQuestion() { return { baseId: "transfusion", category: "기본간호학", part: "수혈", emoji: "🩸", title: "수혈 부작용", desc: `수혈 15분 후 환자가 요통, 오한, 발열을 호소한다. 우선 중재는?`, choices: shuffle([{ text: "수혈을 중단하고 N/S를 연결한다", effect: { hp: -5, rep: 22 }, log: "정답. 용혈성 반응 의심 시 즉각 중단이 필수입니다." }, { text: "의사에게 먼저 보고하고 지시를 기다린다", effect: { hp: -30, rep: -15 }, log: "보고보다 원인 차단(중단)이 먼저입니다." }, { text: "주입 속도를 줄이고 활력징후를 재측정한다", effect: { hp: -40, rep: -20 }, log: "속도 조절이 아니라 완전 중단해야 합니다." }, { text: "처방된 항히스타민제를 투여한다", effect: { hp: -25, rep: -10 }, log: "알레르기 반응이 아닐 수 있으며 중단이 먼저입니다." }]) }; }
function generateIICPQuestion() { return { baseId: "iicp", category: "성인간호학", part: "신경계", emoji: "🧠", title: "두개내압 상승", desc: `IICP(두개내압 상승) 환자에게 적절한 간호중재는?`, choices: shuffle([{ text: "침상 머리를 15~30도 올려 정맥 귀환을 돕는다", effect: { hp: -5, rep: 20 }, log: "정답. 뇌압 하강을 돕는 기본 체위입니다." }, { text: "객담 배출을 위해 기침과 심호흡을 강하게 유도한다", effect: { hp: -40, rep: -25 }, log: "발살바 수기, 기침은 뇌압을 급상승시킵니다." }, { text: "다리를 올려주는 트렌델렌버그 체위를 취한다", effect: { hp: -40, rep: -25 }, log: "뇌로 혈류가 몰려 뇌압이 크게 오릅니다." }, { text: "탈수를 막기 위해 수분 섭취를 적극 권장한다", effect: { hp: -20, rep: -10 }, log: "수분 제한 및 만니톨 투여가 필요합니다." }]) }; }
function generateFHRQuestion() { return { baseId: "fhr", category: "모성간호학", part: "분만", emoji: "🤰", title: "태아심음 하강", desc: `자궁수축 정점 이후 태아심음이 떨어지는 '후기하강' 발생 시 올바른 중재는?`, choices: shuffle([{ text: "좌측위를 취해주고 산소를 공급한다", effect: { hp: -6, rep: 24 }, log: "정답. 태반 관류 부족이 원인이므로 체위변경과 산소가 핵심입니다." }, { text: "제대 압박이 원인이므로 슬흉위를 취해준다", effect: { hp: -20, rep: -10 }, log: "슬흉위는 가변성 하강의 중재입니다." }, { text: "정상적인 아두 압박 과정이므로 관찰한다", effect: { hp: -25, rep: -15 }, log: "조기하강에 대한 설명입니다. 후기하강은 응급입니다." }, { text: "유도분만제(옥시토신)의 주입 속도를 높인다", effect: { hp: -40, rep: -30 }, log: "수축을 촉진하면 태아가 더 위험해집니다. 즉시 중단해야 합니다." }]) }; }
function generateLawQuestion() { return { baseId: "law", category: "보건의약관계법규", part: "감염병예방법", emoji: "⚖️", title: "감염병 신고", desc: `간호사가 법정감염병인 결핵 환자를 발견했다. 올바른 신고 절차는?`, choices: shuffle([{ text: "소속 의료기관의 장에게 즉시 보고한다", effect: { hp: -5, rep: 20 }, log: "정답. 의료인은 기관장에게 보고하고, 기관장이 보건소에 신고합니다." }, { text: "질병관리청장에게 즉시 전화로 유선 신고한다", effect: { hp: -20, rep: -10 }, log: "직접 신고 대상이 아닙니다." }, { text: "관할 경찰서에 먼저 알린다", effect: { hp: -20, rep: -10 }, log: "경찰 소관이 아닙니다." }, { text: "환자가 직접 보건소에 방문하도록 안내하고 끝낸다", effect: { hp: -30, rep: -20 }, log: "의료인의 신고 의무 위반입니다." }]) }; }
function generateDopamineQuestion() { const w = rand(50, 70); const c = +(5*w*60/1000).toFixed(1); return { baseId: "dopamine", category: "기본간호학", part: "계산", emoji: "🔢", title: "약물 용량 계산", desc: `Dopamine 5mcg/kg/min 처방. 체중 ${w}kg, 약제 농도 1mg/ml일 때 주입 속도는?`, choices: shuffle([{ text: `${c} ml/hr`, effect: { hp: -2, rep: 15 }, log: "정답입니다. 정확한 계산입니다." }, { text: `${+(c*2).toFixed(1)} ml/hr`, effect: { hp: -20, rep: -10 }, log: "과용량입니다. 단위 변환을 확인하세요." }, { text: `${+(c/2).toFixed(1)} ml/hr`, effect: { hp: -20, rep: -10 }, log: "소용량입니다. 계산 오류." }, { text: `${+(c+5).toFixed(1)} ml/hr`, effect: { hp: -15, rep: -5 }, log: "오답입니다." }]) }; }
function generateSepsisQuestion() { return { baseId: "sepsis", category: "성인간호학", part: "감염", emoji: "🌡️", title: "패혈증(Sepsis) 번들", desc: "환자가 혈압 80/50, 체온 39도, 의식 저하를 보일 때 우선 간호중재는?", choices: shuffle([{ text: "혈액배양 검사를 먼저 나간 후 광범위 항생제를 투여한다", effect: { hp: -2, rep: 15 }, log: "정답. 항생제 투여 전 혈액배양이 필수입니다." }, { text: "해열제를 최우선으로 투여하여 체온을 떨어뜨린다", effect: { hp: -20, rep: -10 }, log: "해열보다 관류 유지와 배양이 먼저입니다." }, { text: "스테로이드를 즉시 IV로 투여한다", effect: { hp: -20, rep: -10 }, log: "1차 선택약이 아닙니다." }, { text: "수분 섭취를 격려하고 경과를 관찰한다", effect: { hp: -30, rep: -20 }, log: "응급 수액 요법이 필요한 쇼크 상태입니다." }]) }; }
function generatePsychQuestion() { return { baseId: "psych", category: "정신간호학", part: "망상", emoji: "🧠", title: "망상 환자 대화", desc: "환자가 '밥에 독을 탔다'며 식사를 강하게 거부할 때 적절한 반응은?", choices: shuffle([{ text: "두려운 감정을 수용하고 팩 포장된 음식을 제공해 본다", effect: { hp: -2, rep: 15 }, log: "정답. 망상에 논쟁하지 않고 불안을 감소시킵니다." }, { text: "밥에 독이 없다는 것을 과학적으로 증명해준다", effect: { hp: -15, rep: -10 }, log: "망상은 논리로 설득되지 않습니다." }, { text: "환자의 말을 무시하고 다른 주제로 대화를 돌린다", effect: { hp: -10, rep: -5 }, log: "환자의 감정을 외면하는 태도입니다." }, { text: "식사를 안 하면 콧줄(L-tube)을 꽂겠다고 단호히 말한다", effect: { hp: -30, rep: -20 }, log: "강압적인 태도는 불신을 더 키웁니다." }]) }; }
function generateElectrolyteQuestion() { return { baseId: "electrolyte", category: "성인간호학", part: "전해질", emoji: "⚡", title: "고칼륨혈증 응급간호", desc: "혈청 K(칼륨) 수치가 7.0 mEq/L인 환자의 즉각적인 심근 보호를 위해 **가장 먼저** 투여해야 할 약물은?", choices: shuffle([{ text: "Calcium gluconate IV", effect: { hp: -3, rep: 22 }, log: "정답. 심근 세포막을 안정시켜 부정맥을 즉시 예방합니다." }, { text: "처방된 KCL(염화칼륨) IV push", effect: { hp: -50, rep: -40 }, log: "절대 금기. 즉각적인 심정지를 유발합니다." }, { text: "포도당+인슐린 IV (단독)", effect: { hp: -20, rep: -10 }, log: "칼륨을 세포 내로 이동시키나, 심근 안정화가 우선입니다." }, { text: "칼리메이트(Kalimate) 관장 (단독)", effect: { hp: -20, rep: -10 }, log: "장기적 칼륨 배출제로 응급 1차가 아닙니다." }]) }; }
function generatePedsPriorityQuestion() { return { baseId: "peds", category: "아동간호학", part: "호흡기계", emoji: "🧸", title: "아동 호흡곤란 우선순위", desc: "영아가 코벌렁임(비익호흡)과 흉벽 함몰을 보이며 칭얼거릴 때 가장 우선할 간호는?", choices: shuffle([{ text: "기도 유지와 호흡 상태를 사정하고 산소화를 준비한다", effect: { hp: -2, rep: 15 }, log: "정답. 소아는 호흡 문제가 가장 치명적으로 빠르게 악화됩니다." }, { text: "환아의 상태 변화를 차트에 상세히 기록한다", effect: { hp: -20, rep: -10 }, log: "기록보다 즉각적인 환아 사정과 처치가 먼저입니다." }, { text: "놀란 보호자를 병실 밖으로 안내하여 진정시킨다", effect: { hp: -15, rep: -5 }, log: "보호자 안위보다 환아 생명 유지가 먼저입니다." }, { text: "열이 있는지 확인 후 해열제부터 경구 투여한다", effect: { hp: -20, rep: -10 }, log: "호흡곤란 영아에게 경구 투여는 흡인 위험이 큽니다." }]) }; }
function generateOBQuestion() { return { baseId: "ob", category: "모성간호학", part: "산후출혈", emoji: "🩸", title: "자궁이완성 출혈 중재", desc: "분만 1시간 뒤 산모의 패드가 다 젖고 자궁저부가 물렁하게 만져질 때 우선 중재는?", choices: shuffle([{ text: "즉시 자궁저부를 둥글게 마사지한다", effect: { hp: -2, rep: 15 }, log: "정답. 자궁 수축을 유도하는 가장 빠르고 필수적인 1차 중재입니다." }, { text: "마사지 없이 의사가 올 때까지 출혈량만 체크한다", effect: { hp: -20, rep: -10 }, log: "지연되면 출혈성 쇼크에 빠집니다." }, { text: "회복을 위해 복도 보행을 적극적으로 유도한다", effect: { hp: -30, rep: -15 }, log: "출혈 환자는 절대 안정(ABR)해야 합니다." }, { text: "따뜻한 물을 많이 마시도록 격려한다", effect: { hp: -15, rep: -5 }, log: "우선순위에서 크게 밀리는 행동입니다." }]) }; }
function generateManagementQuestion() { return { baseId: "management", category: "간호관리학", part: "안전", emoji: "📑", title: "환자 안전과 보고", desc: "근무 종료 직전, 환자에게 투여할 약물이 바뀐 것을 당신이 발견했습니다. 올바른 행동은?", choices: shuffle([{ text: "환자 상태를 즉시 살피고 책임자에게 정직하게 보고한다", effect: { hp: -2, rep: 15 }, log: "정답. 환자 안전을 위한 투명한 보고 문화가 가장 중요합니다." }, { text: "환자에게 증상이 없으므로 아무에게도 말하지 않고 은폐한다", effect: { hp: -50, rep: -50 }, log: "은폐는 추후 환자 생명에 치명적인 결과를 낳습니다." }, { text: "환자에게 몰래 사과만 하고 투약 기록을 임의로 수정한다", effect: { hp: -40, rep: -40 }, log: "기록 조작은 심각한 범죄 행위입니다." }, { text: "동료 간호사에게만 털어놓고 의사에게는 숨긴다", effect: { hp: -30, rep: -20 }, log: "공식적인 사고 보고 절차를 위반했습니다." }]) }; }
function generateRespQuestion() { return { baseId: "resp", category: "성인간호학", part: "호흡기계", emoji: "🫁", title: "저산소증 응급", desc: "병실 환자가 갑자기 SpO2 85%로 떨어지며 청색증을 보일 때 가장 먼저 할 조치는?", choices: shuffle([{ text: "기도를 확인하고 즉각적으로 산소 투여 및 반좌위를 취한다", effect: { hp: -2, rep: 15 }, log: "정답. ABC(기도, 호흡) 확보 및 산소화가 최우선입니다." }, { text: "일시적 현상일 수 있으니 30분 뒤 재측정한다", effect: { hp: -30, rep: -20 }, log: "저산소증을 방치하면 뇌손상이나 심정지가 옵니다." }, { text: "상황을 간호기록지에 먼저 상세히 남긴다", effect: { hp: -15, rep: -10 }, log: "처치가 기록보다 무조건 선행되어야 합니다." }, { text: "불안해하므로 수면제를 투여하여 재운다", effect: { hp: -40, rep: -30 }, log: "호흡을 억제시켜 환자를 사망하게 할 수 있습니다." }]) }; }
function generateSafetyPriorityQuestion() { return { baseId: "priority", category: "성인간호학", part: "우선순위", emoji: "🚑", title: "응급 환자 분류", desc: "응급실에 4명의 환자가 도착했습니다. 가장 먼저 처치해야 할 환자는?", choices: shuffle([{ text: "갑작스러운 흉통과 식은땀을 흘리며 의식이 흐려지는 환자", effect: { hp: -2, rep: 15 }, log: "정답. 심근경색 의심 증상으로 즉각적 생명 위협이 있습니다." }, { text: "단순 열상으로 피가 조금 나며 퇴원 약을 기다리는 환자", effect: { hp: -10, rep: -5 }, log: "가장 후순위 환자입니다." }, { text: "수술 후 상처 부위 통증 5점(NRS)을 호소하는 환자", effect: { hp: -15, rep: -5 }, log: "통증 조절은 필요하나 생명 위협은 적습니다." }, { text: "아침 식사가 맛없다며 병동에서 난동을 피우는 환자", effect: { hp: -15, rep: -5 }, log: "의학적 응급상황이 아닙니다." }]) }; }
function generateMIQuestion() { return { baseId: "mi", category: "성인간호학", part: "심혈관계", emoji: "💔", title: "급성 심근경색(MI)", desc: "니트로글리세린(NTG) 설하 투여에도 가라앉지 않는 쥐어짜는 듯한 흉통 환자 중재는?", choices: shuffle([{ text: "모니터링(ECG)하며 산소를 공급하고 처방된 모르핀을 투여한다(MONA)", effect: { hp: -2, rep: 15 }, log: "정답. 급성 MI의 표준 초기 중재(MONA)입니다." }, { text: "혈전 방지를 위해 복도 걷기 운동을 30분간 강제한다", effect: { hp: -30, rep: -20 }, log: "심근 산소요구량을 줄이기 위해 절대안정(ABR)해야 합니다." }, { text: "효과가 나타날 때까지 NTG를 1분 간격으로 계속 무한정 투여한다", effect: { hp: -25, rep: -15 }, log: "NTG는 5분 간격 3회까지만 투여합니다." }, { text: "호흡을 편하게 하기 위해 종이봉투를 입에 대고 심호흡을 시킨다", effect: { hp: -20, rep: -10 }, log: "과호흡 증후군 처치법입니다. MI에는 산소를 공급해야 합니다." }]) }; }
function generateNaegeleQuestion() { const m = rand(1, 12); const d = rand(1, 20); let eddMonth = m - 3 <= 0 ? m + 9 : m - 3; let eddDay = d + 7; return { baseId: "naegele", category: "모성간호학", part: "임신", emoji: "📅", title: "분만예정일 계산", desc: `마지막 월경일(LMP)이 ${m}월 ${d}일인 임부의 분만예정일(EDD)은?`, choices: shuffle([{ text: `${eddMonth}월 ${eddDay}일`, effect: { hp: -2, rep: 20 }, log: "정답. 네겔법(월 -3/+9, 일 +7) 계산입니다." }, { text: `${eddMonth === 12 ? 1 : eddMonth + 1}월 ${eddDay}일`, effect: { hp: -15, rep: -10 }, log: "월 계산 오류입니다." }, { text: `${eddMonth}월 ${d - 7 > 0 ? d - 7 : d + 14}일`, effect: { hp: -15, rep: -10 }, log: "일 계산 오류입니다." }, { text: `${eddMonth === 1 ? 12 : eddMonth - 1}월 ${eddDay + 7}일`, effect: { hp: -20, rep: -15 }, log: "계산 공식 적용 실패입니다." }]) }; }
function generateApgarQuestion() { const score = pick([4,5,6,7,8,9]); return { baseId: "apgar", category: "아동간호학", part: "신생아", emoji: "👶", title: "아프가 점수 계산", desc: `신생아가 심박동 100회 미만(1), 호흡 느림(1), 사지 약간 굽힘(1), 자극에 찡그림(1), 몸은 분홍 사지는 청색(1)이다. 점수는? (현재 ${score}점 예시 상황 가정)`, choices: shuffle([{ text: "5점", effect: { hp: -2, rep: 20 }, log: "정답. 1+1+1+1+1 = 5점입니다." }, { text: "3점", effect: { hp: -15, rep: -10 }, log: "계산 오류입니다." }, { text: "7점", effect: { hp: -15, rep: -10 }, log: "계산 오류입니다." }, { text: "9점", effect: { hp: -20, rep: -15 }, log: "정상 소견이 아닙니다." }]) }; }
function generateBurnQuestion() { const bsa = pick([18, 27, 36, 45]); return { baseId: "burn", category: "성인간호학", part: "화상", emoji: "🔥", title: "9의 법칙 화상 면적", desc: `몸통 앞면 전체(18%)와 오른쪽 다리 전체(18%)에 화상을 입었다. 총 체표면적은?`, choices: shuffle([{ text: "36%", effect: { hp: -2, rep: 20 }, log: "정답. 18 + 18 = 36% 입니다." }, { text: "27%", effect: { hp: -15, rep: -10 }, log: "비율 적용 오류입니다." }, { text: "45%", effect: { hp: -15, rep: -10 }, log: "비율 적용 오류입니다." }, { text: "18%", effect: { hp: -20, rep: -15 }, log: "한 부위만 계산했습니다." }]) }; }
function generateShockQuestion() { return { baseId: "shock", category: "성인간호학", part: "쇼크", emoji: "😰", title: "쇼크 분류", desc: `벌에 쏘이거나 페니실린 주사 후 두드러기와 심한 호흡곤란(천명음)이 발생하는 쇼크는?`, choices: shuffle([{ text: "아나필락시스 쇼크", effect: { hp: -2, rep: 20 }, log: "정답. 알레르기 반응에 의한 쇼크입니다." }, { text: "저혈량성 쇼크", effect: { hp: -15, rep: -10 }, log: "출혈 등에 의한 쇼크입니다." }, { text: "심인성 쇼크", effect: { hp: -15, rep: -10 }, log: "심근경색 등에 의한 심박출량 감소 쇼크입니다." }, { text: "패혈성 쇼크", effect: { hp: -15, rep: -10 }, log: "감염에 의한 쇼크입니다." }]) }; }
function generateDiabeticQuestion() { return { baseId: "diabetic", category: "성인간호학", part: "내분비계", emoji: "🩸", title: "당뇨 응급상황", desc: `당뇨 환자가 식은땀, 빈맥, 손떨림을 호소하며 의식이 혼미해질 때 의심할 상황은?`, choices: shuffle([{ text: "저혈당증", effect: { hp: -2, rep: 20 }, log: "정답. 전형적인 저혈당 징후입니다." }, { text: "당뇨병성 케톤산증(DKA)", effect: { hp: -20, rep: -15 }, log: "고혈당 시 나타납니다 (과일냄새 호흡 등)." }, { text: "아나필락시스 쇼크", effect: { hp: -15, rep: -10 }, log: "알레르기 징후와 다릅니다." }, { text: "요붕증", effect: { hp: -15, rep: -10 }, log: "다뇨와 갈증이 주증상입니다." }]) }; }
function generateAsepticQuestion() { return { baseId: "aseptic", category: "기본간호학", part: "무균술", emoji: "🧤", title: "외과적 무균술", desc: `외과적 무균술 원칙 중 **틀린** 것은?`, choices: shuffle([{ text: "시야에서 벗어난 멸균 물품도 계속 멸균 상태로 간주한다.", effect: { hp: -2, rep: 20 }, log: "정답(이것이 틀린 설명). 시야를 벗어나면 오염으로 간주합니다." }, { text: "멸균 물품이 습기나 물에 젖으면 오염으로 간주한다.", effect: { hp: -15, rep: -10 }, log: "올바른 원칙입니다." }, { text: "멸균포의 가장자리 2.5cm는 오염된 것으로 간주한다.", effect: { hp: -15, rep: -10 }, log: "올바른 원칙입니다." }, { text: "멸균 물품은 멸균된 물품과 접촉할 때만 멸균이 유지된다.", effect: { hp: -15, rep: -10 }, log: "올바른 원칙입니다." }]) }; }

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

// =========================
// 라우터 및 렌더링 (중복 방지 적용)
// =========================
function generateClinicalEventByCategory(category = null) {
    let pool = [];
    
    // 24개의 생성기를 모두 돌려 조건(과목, 중복여부)에 맞는 문제를 pool에 담습니다.
    for (let generator of clinicalGenerators) {
        const ev = generator();
        if ((!category || ev.category === category) && !recentlyUsed(ev.baseId)) {
            pool.push(ev);
        }
    }

    // 만약 풀이 비어있다면 (모든 문제가 최근 15번 안에 나왔다면) 기록을 초기화하고 다시 담습니다.
    if (pool.length === 0) {
        gameState.recentIds = [];
        for (let generator of clinicalGenerators) {
            const ev = generator();
            if (!category || ev.category === category) {
                pool.push(ev);
            }
        }
    }

    // 풀에서 하나를 뽑고, Base ID를 기록합니다.
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
}

function initSurvival() {
    resetStateForMode(); gameState.mode = "survival"; gameState.quizCategory = null;
    showCoreUI(); UI.logBar.innerHTML = "";
    addLog("듀티가 시작되었습니다. 첫 판단부터 중요합니다.", "log-important");
    renderSurvivalEvent("intro");
}

function renderQuizMenu() {
    gameState.mode = "quiz_menu"; resetStateForMode(); showCoreUI(); UI.logBar.innerHTML = "";
    addLog("국가고시 8과목 트레이닝 모드입니다.", "log-important");
    updateStats();

    const categories = ["기본간호학", "성인간호학", "모성간호학", "아동간호학", "지역사회간호학", "정신간호학", "간호관리학", "보건의약관계법규"];
    UI.gameArea.innerHTML = `
    <div class="scene-card card">
      <span class="scene-emoji">📖</span>
      <h2 class="scene-title">국가고시 8과목 트레이닝</h2>
      <p class="scene-desc">숫자와 상황이 계속 변하는 <strong>무한 랜덤 기출 변형 (4지선다)</strong>이 제공됩니다.</p>
      <div class="choice-list">
        ${categories.map((cat) => `<button class="choice-btn primary" onclick="startQuiz('${cat}')">${cat}</button>`).join("")}
        <button class="choice-btn center" onclick="location.reload()">메인 메뉴</button>
      </div>
    </div>
  `;
}

function startQuiz(category) {
    gameState.mode = "quiz"; gameState.quizCategory = category; gameState.quizSolved = 0;
    UI.logBar.innerHTML = ""; addLog(`${category} 기출 변형 풀이를 시작합니다.`, "log-important");
    renderNextQuizQuestion();
}

function renderSurvivalEvent(eventId) {
    let ev;
    if (eventId === "intro") {
        ev = {
            baseId: "intro", category: "", title: "듀티의 시작", emoji: "🏥", desc: "병동 문이 열리고 특유의 긴장감이 밀려옵니다.",
            choices: [
                { text: "심호흡하고 인계 핵심부터 정리한다", effect: { hp: -4, rep: 6 }, log: "기본기부터 챙겼습니다.", next: "random_hub" },
                { text: "물품부터 챙긴다", effect: { hp: -2, item: "토니켓" }, log: "준비성이 좋습니다.", next: "random_hub" },
            ],
        };
    } else {
        const chooseClinical = Math.random() < 0.9;
        ev = chooseClinical ? generateClinicalEventByCategory(null) : pick([{ baseId:"rest", title:"휴식", emoji:"☕", desc:"잠깐 쉴 틈이 생겼습니다.", choices:[{text:"물 마시기", effect:{hp:15, rep:0}, log:"체력을 회복했습니다."}, {text:"스트레칭", effect:{hp:10, rep:2}, log:"몸이 풀립니다."}]}]);
        gameState.eventCount += 1;
    }
    renderSceneCard(ev, { mode: "survival", meta: [`난이도: ${gameState.currentShift}`, `누적: ${gameState.eventCount}건`] });
}

function handleSurvivalChoice(choice) {
    applyChoiceEffect(choice);
    if (choice.log) addLog(choice.log, (choice.effect?.rep || 0) > 0 ? "log-good" : (choice.effect?.rep || 0) < 0 ? "log-bad" : "");

    if (gameState.hp <= 0) return showGameOver("체력 고갈", "번아웃 되었습니다. 환자 안전을 위해 퇴근하세요.");
    if (gameState.rep < -60) return showGameOver("평판 실추", "치명적인 실수 누적으로 투약 사고 위기입니다.");
    if (gameState.eventCount >= MAX_PROGRESS_EVENTS) return showGameOver("듀티 무사 완수!", "수고하셨습니다. 당신은 훌륭한 간호사입니다.");

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
      <div class="feedback-title">${isCorrect ? "✅ 정답" : "❌ 오답"}</div>
      <div class="feedback-text">${choice.log || "해설이 없습니다."}</div>
    </div>
    <div class="choice-list" style="margin-top:12px;">
      <button class="choice-btn primary center" onclick="goNextQuiz()">다음 문제</button>
      <button class="choice-btn center" onclick="renderQuizMenu()">과목 변경</button>
    </div>
  `;

    if (isCorrect) { gameState.rep += 6; gameState.quizSolved += 1; addLog(`[정답] ${choice.log}`, "log-good"); } 
    else { gameState.hp -= Math.round(4 * gameState.difficulty); addLog(`[오답] ${choice.log}`, "log-bad"); }
    gameState.hp = clamp(gameState.hp, 0, 100);
    updateStats();
}

function goNextQuiz() {
    if (gameState.hp <= 0) return showGameOver("학습 종료", "머리가 과열됐습니다. 오늘은 여기까지!");
    renderNextQuizQuestion();
}

// =========================
// 승급 심사 (무한 랜덤 생성)
// =========================
function showGameOver(title, desc) {
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-desc").textContent = desc;
    document.getElementById("modal-stats").innerHTML = `
    최종 체력: <span class="highlight">${clamp(gameState.hp, 0, 100)}</span><br>
    최종 평판: <span class="highlight">${gameState.rep}</span><br>
    처리한 상황: <span class="highlight">${gameState.eventCount}</span>건
  `;
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
        let rank = "신규 간호사 (SN/RN)";
        if (score >= 10) rank = "RN 2년차 (1인분 가능)";
        if (score >= 30) rank = "RN 5년차 (에이스)";
        if (score >= 50) rank = "차지 널스 (Charge)";
        if (score >= 100) rank = "수간호사 (HN)";
        document.getElementById("rank").innerText = rank;
    }

    loadQuestion();
}