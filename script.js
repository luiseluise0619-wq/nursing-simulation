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
    // 최근 15개의 문제 유형을 기억하여 중복을 원천 차단
    if (gameState.recentIds.length > 15) {
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
    generateDiabeticQuestion, generateAsepticQuestion
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
function generateElectrolyteQuestion() { return { baseId: "electrolyte", category: "성인간호학", part: "전해질", emoji: "⚡", title: "고칼륨혈증 간호", desc: "혈청 K(칼륨) 수치가 7.0 mEq/L일 때 **절대 금기**인 행동은?", choices: shuffle([{ text: "처방된 KCL(염화칼륨) 앰플을 IV push로 투여한다", effect: { hp: -50, rep: -50 }, log: "정답(가장 위험). KCL 직접 정맥주사는 즉각적인 심정지를 유발합니다." }, { text: "Calcium gluconate를 정맥 투여한다", effect: { hp: -10, rep: -5 }, log: "이는 심근을 안정시키는 치료법입니다." }, { text: "포도당과 인슐린을 함께 정맥 투여한다", effect: { hp: -10, rep: -5 }, log: "칼륨을 세포 내로 이동시키는 치료법입니다." }, { text: "칼리메이트(Kalimate) 관장을 시행한다", effect: { hp: -10, rep: -5 }, log: "칼륨을 배출시키는 치료법입니다." }]) }; }
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
    const tag = ev.category ? `<div class="category-tag" style="font-weight:bold; color:var(--primary); margin-bottom:5px;">[${ev.category}] ${ev.part || ""}</div>` : "";
    const metaRow = meta.length ? `<div class="meta-row" style="margin-bottom:15px;">${meta.map((m) => `<div class="meta-chip" style="display:inline-block; margin-right:8px; font-size:12px; color:#64748b; background:#f1f5f9; padding:2px 6px; border-radius:4px;">${m}</div>`).join("")}</div>` : "";

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