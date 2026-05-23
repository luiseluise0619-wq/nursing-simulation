// =========================================================================
// 문제 생성기 모듈 (UMD 스타일: 브라우저/Node 양쪽 모두 사용 가능)
// 모든 generator 는 다음 형식의 객체를 반환:
//   { baseId, category, part, emoji, title, desc, choices: [...] }
// 정답 선택지에는 반드시 `correct: true` 가 있어야 합니다.
// =========================================================================
(function (root, factory) {
    const mod = factory();
    if (typeof module !== "undefined" && module.exports) module.exports = mod;
    else root.NurseQuestions = mod;
})(typeof self !== "undefined" ? self : this, function () {

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

    function generateABGAQuestion() {
        const isAcidosis = Math.random() < 0.5; const isResp = Math.random() < 0.5;
        let pH, PaCO2, HCO3, correctType;
        if (isAcidosis && isResp) { pH = (7.20 + Math.random() * 0.1).toFixed(2); PaCO2 = rand(46, 60); HCO3 = rand(22, 26); correctType = "호흡성 산증"; }
        else if (isAcidosis && !isResp) { pH = (7.20 + Math.random() * 0.1).toFixed(2); PaCO2 = rand(35, 45); HCO3 = rand(15, 21); correctType = "대사성 산증"; }
        else if (!isAcidosis && isResp) { pH = (7.46 + Math.random() * 0.1).toFixed(2); PaCO2 = rand(20, 34); HCO3 = rand(22, 26); correctType = "호흡성 알칼리증"; }
        else { pH = (7.46 + Math.random() * 0.1).toFixed(2); PaCO2 = rand(35, 45); HCO3 = rand(27, 35); correctType = "대사성 알칼리증"; }
        const types = ["호흡성 산증", "대사성 산증", "호흡성 알칼리증", "대사성 알칼리증"];
        const wrongs = types.filter(t => t !== correctType);
        return { baseId: "abga", category: "성인간호학", part: "호흡/ABGA", emoji: "🩸", title: "ABGA 판독",
            desc: `pH ${pH}, PaCO2 ${PaCO2}, HCO3- ${HCO3}\n이 환자의 상태는?`,
            choices: shuffle([
                { text: correctType, correct: true, effect: { hp: -5, rep: 25 }, log: "정답입니다. 수치 해석이 정확합니다." },
                { text: wrongs[0], effect: { hp: -30, rep: -15 }, log: "수치 해석 오류입니다." },
                { text: wrongs[1], effect: { hp: -30, rep: -15 }, log: "수치 해석 오류입니다." },
                { text: wrongs[2], effect: { hp: -30, rep: -15 }, log: "수치 해석 오류입니다." }
            ]) };
    }

    function generateTriageQuestion() {
        return { baseId: "triage", category: "지역사회간호학", part: "재난간호", emoji: "🚨", title: "START 분류",
            desc: `기도 유지 후에도 무호흡인 환자의 중증도 분류 색상은?`,
            choices: shuffle([
                { text: "흑색 (Black / 사망 또는 지연)", correct: true, effect: { hp: -5, rep: 20 }, log: "정답. 기도 개방 후에도 무호흡이면 흑색입니다." },
                { text: "적색 (Red / 긴급)", effect: { hp: -25, rep: -15 }, log: "적색은 생존 가능한 중증 환자입니다." },
                { text: "황색 (Yellow / 응급)", effect: { hp: -20, rep: -10 }, log: "황색은 수시간 내 처치가 필요한 환자입니다." },
                { text: "녹색 (Green / 비응급)", effect: { hp: -15, rep: -5 }, log: "녹색은 경증 환자입니다." }
            ]) };
    }

    function generatePositionQuestion() {
        return { baseId: "position", category: "기본간호학", part: "체위", emoji: "🛏️", title: "목적에 맞는 체위",
            desc: `관장(Enema) 시 용액이 잘 들어가도록 가장 적절히 취해줄 체위는?`,
            choices: shuffle([
                { text: "좌측 심스위(Sims')", correct: true, effect: { hp: -2, rep: 15 }, log: "정답. 구불결장으로 용액이 잘 흘러갑니다." },
                { text: "파울러씨위", effect: { hp: -15, rep: -10 }, log: "호흡곤란 시 취하는 체위입니다." },
                { text: "트렌델렌버그위", effect: { hp: -20, rep: -15 }, log: "쇼크 시 다리 거상 체위입니다." },
                { text: "배횡와위", effect: { hp: -15, rep: -10 }, log: "여성 인공도뇨 시 취하는 체위입니다." }
            ]) };
    }

    function generateVaccineQuestion() {
        return { baseId: "vaccine", category: "아동간호학", part: "예방접종", emoji: "💉", title: "정기 예방접종",
            desc: `생후 12~15개월에 접종해야 하는 백신은?`,
            choices: shuffle([
                { text: "MMR (홍역, 볼거리, 풍진)", correct: true, effect: { hp: -2, rep: 18 }, log: "정답. 수두와 함께 12~15개월 접종입니다." },
                { text: "BCG (결핵)", effect: { hp: -25, rep: -15 }, log: "생후 4주 이내 접종합니다." },
                { text: "B형 간염", effect: { hp: -20, rep: -10 }, log: "0, 1, 6개월 접종입니다." },
                { text: "DTaP", effect: { hp: -15, rep: -10 }, log: "2, 4, 6개월 접종입니다." }
            ]) };
    }

    function generateTransfusionQuestion() {
        return { baseId: "transfusion", category: "기본간호학", part: "수혈", emoji: "🩸", title: "수혈 부작용",
            desc: `수혈 15분 후 환자가 요통, 오한, 발열을 호소한다. 우선 중재는?`,
            choices: shuffle([
                { text: "수혈을 중단하고 N/S를 연결한다", correct: true, effect: { hp: -5, rep: 22 }, log: "정답. 용혈성 반응 의심 시 즉각 중단이 필수입니다." },
                { text: "의사에게 먼저 보고하고 지시를 기다린다", effect: { hp: -30, rep: -15 }, log: "보고보다 원인 차단(중단)이 먼저입니다." },
                { text: "주입 속도를 줄이고 활력징후를 재측정한다", effect: { hp: -40, rep: -20 }, log: "속도 조절이 아니라 완전 중단해야 합니다." },
                { text: "처방된 항히스타민제를 투여한다", effect: { hp: -25, rep: -10 }, log: "알레르기 반응이 아닐 수 있으며 중단이 먼저입니다." }
            ]) };
    }

    function generateIICPQuestion() {
        return { baseId: "iicp", category: "성인간호학", part: "신경계", emoji: "🧠", title: "두개내압 상승",
            desc: `IICP(두개내압 상승) 환자에게 적절한 간호중재는?`,
            choices: shuffle([
                { text: "침상 머리를 15~30도 올려 정맥 귀환을 돕는다", correct: true, effect: { hp: -5, rep: 20 }, log: "정답. 뇌압 하강을 돕는 기본 체위입니다." },
                { text: "객담 배출을 위해 기침과 심호흡을 강하게 유도한다", effect: { hp: -40, rep: -25 }, log: "발살바 수기, 기침은 뇌압을 급상승시킵니다." },
                { text: "다리를 올려주는 트렌델렌버그 체위를 취한다", effect: { hp: -40, rep: -25 }, log: "뇌로 혈류가 몰려 뇌압이 크게 오릅니다." },
                { text: "탈수를 막기 위해 수분 섭취를 적극 권장한다", effect: { hp: -20, rep: -10 }, log: "수분 제한 및 만니톨 투여가 필요합니다." }
            ]) };
    }

    function generateFHRQuestion() {
        return { baseId: "fhr", category: "모성간호학", part: "분만", emoji: "🤰", title: "태아심음 하강",
            desc: `자궁수축 정점 이후 태아심음이 떨어지는 '후기하강' 발생 시 올바른 중재는?`,
            choices: shuffle([
                { text: "좌측위를 취해주고 산소를 공급한다", correct: true, effect: { hp: -6, rep: 24 }, log: "정답. 태반 관류 부족이 원인이므로 체위변경과 산소가 핵심입니다." },
                { text: "제대 압박이 원인이므로 슬흉위를 취해준다", effect: { hp: -20, rep: -10 }, log: "슬흉위는 가변성 하강의 중재입니다." },
                { text: "정상적인 아두 압박 과정이므로 관찰한다", effect: { hp: -25, rep: -15 }, log: "조기하강에 대한 설명입니다. 후기하강은 응급입니다." },
                { text: "유도분만제(옥시토신)의 주입 속도를 높인다", effect: { hp: -40, rep: -30 }, log: "수축을 촉진하면 태아가 더 위험해집니다. 즉시 중단해야 합니다." }
            ]) };
    }

    function generateLawQuestion() {
        return { baseId: "law", category: "보건의약관계법규", part: "감염병예방법", emoji: "⚖️", title: "감염병 신고",
            desc: `간호사가 법정감염병인 결핵 환자를 발견했다. 올바른 신고 절차는?`,
            choices: shuffle([
                { text: "소속 의료기관의 장에게 즉시 보고한다", correct: true, effect: { hp: -5, rep: 20 }, log: "정답. 의료인은 기관장에게 보고하고, 기관장이 보건소에 신고합니다." },
                { text: "질병관리청장에게 즉시 전화로 유선 신고한다", effect: { hp: -20, rep: -10 }, log: "직접 신고 대상이 아닙니다." },
                { text: "관할 경찰서에 먼저 알린다", effect: { hp: -20, rep: -10 }, log: "경찰 소관이 아닙니다." },
                { text: "환자가 직접 보건소에 방문하도록 안내하고 끝낸다", effect: { hp: -30, rep: -20 }, log: "의료인의 신고 의무 위반입니다." }
            ]) };
    }

    function generateDopamineQuestion() {
        const w = rand(50, 70); const c = +(5 * w * 60 / 1000).toFixed(1);
        return { baseId: "dopamine", category: "기본간호학", part: "계산", emoji: "🔢", title: "약물 용량 계산",
            desc: `Dopamine 5mcg/kg/min 처방. 체중 ${w}kg, 약제 농도 1mg/ml일 때 주입 속도는?`,
            choices: shuffle([
                { text: `${c} ml/hr`, correct: true, effect: { hp: -2, rep: 15 }, log: "정답입니다. 정확한 계산입니다." },
                { text: `${+(c * 2).toFixed(1)} ml/hr`, effect: { hp: -20, rep: -10 }, log: "과용량입니다. 단위 변환을 확인하세요." },
                { text: `${+(c / 2).toFixed(1)} ml/hr`, effect: { hp: -20, rep: -10 }, log: "소용량입니다. 계산 오류." },
                { text: `${+(c + 5).toFixed(1)} ml/hr`, effect: { hp: -15, rep: -5 }, log: "오답입니다." }
            ]) };
    }

    function generateSepsisQuestion() {
        return { baseId: "sepsis", category: "성인간호학", part: "감염", emoji: "🌡️", title: "패혈증(Sepsis) 번들",
            desc: "환자가 혈압 80/50, 체온 39도, 의식 저하를 보일 때 우선 간호중재는?",
            choices: shuffle([
                { text: "혈액배양 검사를 먼저 나간 후 광범위 항생제를 투여한다", correct: true, effect: { hp: -2, rep: 15 }, log: "정답. 항생제 투여 전 혈액배양이 필수입니다." },
                { text: "해열제를 최우선으로 투여하여 체온을 떨어뜨린다", effect: { hp: -20, rep: -10 }, log: "해열보다 관류 유지와 배양이 먼저입니다." },
                { text: "스테로이드를 즉시 IV로 투여한다", effect: { hp: -20, rep: -10 }, log: "1차 선택약이 아닙니다." },
                { text: "수분 섭취를 격려하고 경과를 관찰한다", effect: { hp: -30, rep: -20 }, log: "응급 수액 요법이 필요한 쇼크 상태입니다." }
            ]) };
    }

    function generatePsychQuestion() {
        return { baseId: "psych", category: "정신간호학", part: "망상", emoji: "🧠", title: "망상 환자 대화",
            desc: "환자가 '밥에 독을 탔다'며 식사를 강하게 거부할 때 적절한 반응은?",
            choices: shuffle([
                { text: "두려운 감정을 수용하고 팩 포장된 음식을 제공해 본다", correct: true, effect: { hp: -2, rep: 15 }, log: "정답. 망상에 논쟁하지 않고 불안을 감소시킵니다." },
                { text: "밥에 독이 없다는 것을 과학적으로 증명해준다", effect: { hp: -15, rep: -10 }, log: "망상은 논리로 설득되지 않습니다." },
                { text: "환자의 말을 무시하고 다른 주제로 대화를 돌린다", effect: { hp: -10, rep: -5 }, log: "환자의 감정을 외면하는 태도입니다." },
                { text: "식사를 안 하면 콧줄(L-tube)을 꽂겠다고 단호히 말한다", effect: { hp: -30, rep: -20 }, log: "강압적인 태도는 불신을 더 키웁니다." }
            ]) };
    }

    function generateElectrolyteQuestion() {
        return { baseId: "electrolyte", category: "성인간호학", part: "전해질", emoji: "⚡", title: "고칼륨혈증 간호",
            desc: "혈청 K(칼륨) 수치가 7.0 mEq/L일 때 **절대 금기**인 행동은?",
            choices: shuffle([
                { text: "처방된 KCL(염화칼륨) 앰플을 IV push로 투여한다", correct: true, effect: { hp: -2, rep: 25 }, log: "정답. KCL 직접 정맥주사는 즉각적인 심정지를 유발합니다." },
                { text: "Calcium gluconate를 정맥 투여한다", effect: { hp: -20, rep: -15 }, log: "이는 심근을 안정시키는 치료법입니다." },
                { text: "포도당과 인슐린을 함께 정맥 투여한다", effect: { hp: -20, rep: -15 }, log: "칼륨을 세포 내로 이동시키는 치료법입니다." },
                { text: "칼리메이트(Kalimate) 관장을 시행한다", effect: { hp: -20, rep: -15 }, log: "칼륨을 배출시키는 치료법입니다." }
            ]) };
    }

    function generatePedsPriorityQuestion() {
        return { baseId: "peds", category: "아동간호학", part: "호흡기계", emoji: "🧸", title: "아동 호흡곤란 우선순위",
            desc: "영아가 코벌렁임(비익호흡)과 흉벽 함몰을 보이며 칭얼거릴 때 가장 우선할 간호는?",
            choices: shuffle([
                { text: "기도 유지와 호흡 상태를 사정하고 산소화를 준비한다", correct: true, effect: { hp: -2, rep: 15 }, log: "정답. 소아는 호흡 문제가 가장 치명적으로 빠르게 악화됩니다." },
                { text: "환아의 상태 변화를 차트에 상세히 기록한다", effect: { hp: -20, rep: -10 }, log: "기록보다 즉각적인 환아 사정과 처치가 먼저입니다." },
                { text: "놀란 보호자를 병실 밖으로 안내하여 진정시킨다", effect: { hp: -15, rep: -5 }, log: "보호자 안위보다 환아 생명 유지가 먼저입니다." },
                { text: "열이 있는지 확인 후 해열제부터 경구 투여한다", effect: { hp: -20, rep: -10 }, log: "호흡곤란 영아에게 경구 투여는 흡인 위험이 큽니다." }
            ]) };
    }

    function generateOBQuestion() {
        return { baseId: "ob", category: "모성간호학", part: "산후출혈", emoji: "🩸", title: "자궁이완성 출혈 중재",
            desc: "분만 1시간 뒤 산모의 패드가 다 젖고 자궁저부가 물렁하게 만져질 때 우선 중재는?",
            choices: shuffle([
                { text: "즉시 자궁저부를 둥글게 마사지한다", correct: true, effect: { hp: -2, rep: 15 }, log: "정답. 자궁 수축을 유도하는 1차 중재입니다." },
                { text: "마사지 없이 의사가 올 때까지 출혈량만 체크한다", effect: { hp: -20, rep: -10 }, log: "지연되면 출혈성 쇼크에 빠집니다." },
                { text: "회복을 위해 복도 보행을 적극적으로 유도한다", effect: { hp: -30, rep: -15 }, log: "출혈 환자는 절대 안정(ABR)해야 합니다." },
                { text: "따뜻한 물을 많이 마시도록 격려한다", effect: { hp: -15, rep: -5 }, log: "우선순위에서 크게 밀리는 행동입니다." }
            ]) };
    }

    function generateManagementQuestion() {
        return { baseId: "management", category: "간호관리학", part: "안전", emoji: "📑", title: "환자 안전과 보고",
            desc: "근무 종료 직전, 환자에게 투여할 약물이 바뀐 것을 당신이 발견했습니다. 올바른 행동은?",
            choices: shuffle([
                { text: "환자 상태를 즉시 살피고 책임자에게 정직하게 보고한다", correct: true, effect: { hp: -2, rep: 15 }, log: "정답. 환자 안전을 위한 투명한 보고 문화가 가장 중요합니다." },
                { text: "환자에게 증상이 없으므로 아무에게도 말하지 않고 은폐한다", effect: { hp: -50, rep: -50 }, log: "은폐는 추후 환자 생명에 치명적인 결과를 낳습니다." },
                { text: "환자에게 몰래 사과만 하고 투약 기록을 임의로 수정한다", effect: { hp: -40, rep: -40 }, log: "기록 조작은 심각한 범죄 행위입니다." },
                { text: "동료 간호사에게만 털어놓고 의사에게는 숨긴다", effect: { hp: -30, rep: -20 }, log: "공식적인 사고 보고 절차를 위반했습니다." }
            ]) };
    }

    function generateRespQuestion() {
        return { baseId: "resp", category: "성인간호학", part: "호흡기계", emoji: "🫁", title: "저산소증 응급",
            desc: "병실 환자가 갑자기 SpO2 85%로 떨어지며 청색증을 보일 때 가장 먼저 할 조치는?",
            choices: shuffle([
                { text: "기도를 확인하고 즉각적으로 산소 투여 및 반좌위를 취한다", correct: true, effect: { hp: -2, rep: 15 }, log: "정답. ABC(기도, 호흡) 확보 및 산소화가 최우선입니다." },
                { text: "일시적 현상일 수 있으니 30분 뒤 재측정한다", effect: { hp: -30, rep: -20 }, log: "저산소증을 방치하면 뇌손상이나 심정지가 옵니다." },
                { text: "상황을 간호기록지에 먼저 상세히 남긴다", effect: { hp: -15, rep: -10 }, log: "처치가 기록보다 무조건 선행되어야 합니다." },
                { text: "불안해하므로 수면제를 투여하여 재운다", effect: { hp: -40, rep: -30 }, log: "호흡을 억제시켜 환자를 사망하게 할 수 있습니다." }
            ]) };
    }

    function generateSafetyPriorityQuestion() {
        return { baseId: "priority", category: "성인간호학", part: "우선순위", emoji: "🚑", title: "응급 환자 분류",
            desc: "응급실에 4명의 환자가 도착했습니다. 가장 먼저 처치해야 할 환자는?",
            choices: shuffle([
                { text: "갑작스러운 흉통과 식은땀을 흘리며 의식이 흐려지는 환자", correct: true, effect: { hp: -2, rep: 15 }, log: "정답. 심근경색 의심 증상으로 즉각적 생명 위협이 있습니다." },
                { text: "단순 열상으로 피가 조금 나며 퇴원 약을 기다리는 환자", effect: { hp: -10, rep: -5 }, log: "가장 후순위 환자입니다." },
                { text: "수술 후 상처 부위 통증 5점(NRS)을 호소하는 환자", effect: { hp: -15, rep: -5 }, log: "통증 조절은 필요하나 생명 위협은 적습니다." },
                { text: "아침 식사가 맛없다며 병동에서 난동을 피우는 환자", effect: { hp: -15, rep: -5 }, log: "의학적 응급상황이 아닙니다." }
            ]) };
    }

    function generateMIQuestion() {
        return { baseId: "mi", category: "성인간호학", part: "심혈관계", emoji: "💔", title: "급성 심근경색(MI)",
            desc: "니트로글리세린(NTG) 설하 투여에도 가라앉지 않는 쥐어짜는 듯한 흉통 환자 중재는?",
            choices: shuffle([
                { text: "모니터링(ECG)하며 산소를 공급하고 처방된 모르핀을 투여한다(MONA)", correct: true, effect: { hp: -2, rep: 15 }, log: "정답. 급성 MI의 표준 초기 중재(MONA)입니다." },
                { text: "혈전 방지를 위해 복도 걷기 운동을 30분간 강제한다", effect: { hp: -30, rep: -20 }, log: "심근 산소요구량을 줄이기 위해 절대안정(ABR)해야 합니다." },
                { text: "효과가 나타날 때까지 NTG를 1분 간격으로 계속 무한정 투여한다", effect: { hp: -25, rep: -15 }, log: "NTG는 5분 간격 3회까지만 투여합니다." },
                { text: "호흡을 편하게 하기 위해 종이봉투를 입에 대고 심호흡을 시킨다", effect: { hp: -20, rep: -10 }, log: "과호흡 증후군 처치법입니다." }
            ]) };
    }

    function generateNaegeleQuestion() {
        const year = 2024;
        const m = rand(1, 12);
        const daysInMonth = new Date(year, m, 0).getDate();
        const d = rand(1, daysInMonth);
        const lmp = new Date(year, m - 1, d);
        const edd = new Date(lmp.getTime() + 280 * 24 * 60 * 60 * 1000);
        const eddMonth = edd.getMonth() + 1; const eddDay = edd.getDate();
        const wrongA = new Date(edd.getTime() + 7 * 86400000);
        const wrongB = new Date(edd.getTime() - 14 * 86400000);
        const wrongC = new Date(edd.getTime() + 30 * 86400000);
        return { baseId: "naegele", category: "모성간호학", part: "임신", emoji: "📅", title: "분만예정일 계산",
            desc: `마지막 월경일(LMP)이 ${m}월 ${d}일인 임부의 분만예정일(EDD)은?\n(네겔법: 월 -3 또는 +9, 일 +7)`,
            choices: shuffle([
                { text: `${eddMonth}월 ${eddDay}일`, correct: true, effect: { hp: -2, rep: 20 }, log: "정답. 네겔법으로 정확히 계산했습니다." },
                { text: `${wrongA.getMonth() + 1}월 ${wrongA.getDate()}일`, effect: { hp: -15, rep: -10 }, log: "일 계산 오류 — +14로 더했습니다." },
                { text: `${wrongB.getMonth() + 1}월 ${wrongB.getDate()}일`, effect: { hp: -15, rep: -10 }, log: "일 계산 오류 — 빼는 방향이 잘못되었습니다." },
                { text: `${wrongC.getMonth() + 1}월 ${wrongC.getDate()}일`, effect: { hp: -20, rep: -15 }, log: "월 계산 오류 — 한 달 더 셌습니다." }
            ]) };
    }

    function generateApgarQuestion() {
        const items = [
            { name: "심박동", desc: [["없음(0)", 0], ["100회 미만(1)", 1], ["100회 이상(2)", 2]] },
            { name: "호흡", desc: [["없음(0)", 0], ["느리고 불규칙(1)", 1], ["힘차게 운다(2)", 2]] },
            { name: "근긴장도", desc: [["축 늘어짐(0)", 0], ["사지 약간 굽힘(1)", 1], ["활발히 움직임(2)", 2]] },
            { name: "반사", desc: [["반응 없음(0)", 0], ["찡그림(1)", 1], ["기침/재채기(2)", 2]] },
            { name: "피부색", desc: [["전신 청색(0)", 0], ["몸은 분홍 사지는 청색(1)", 1], ["전신 분홍(2)", 2]] },
        ];
        const lines = []; let total = 0;
        items.forEach(it => { const c = pick(it.desc); lines.push(`${it.name}: ${c[0]}`); total += c[1]; });
        const candidates = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(n => n !== total);
        const wrongs = shuffle(candidates).slice(0, 3).map(n => `${n}점`);
        return { baseId: "apgar", category: "아동간호학", part: "신생아", emoji: "👶", title: "아프가 점수 계산",
            desc: `신생아 사정 결과:\n${lines.join("\n")}\n\n총 아프가 점수는?`,
            choices: shuffle([
                { text: `${total}점`, correct: true, effect: { hp: -2, rep: 20 }, log: `정답. 합산하면 ${total}점입니다.` },
                { text: wrongs[0], effect: { hp: -15, rep: -10 }, log: "합산 오류입니다." },
                { text: wrongs[1], effect: { hp: -15, rep: -10 }, log: "합산 오류입니다." },
                { text: wrongs[2], effect: { hp: -20, rep: -15 }, log: "합산 오류입니다." }
            ]) };
    }

    function generateBurnQuestion() {
        const parts = [
            { name: "머리/목 전체", value: 9 },
            { name: "몸통 앞면 전체", value: 18 },
            { name: "몸통 뒷면 전체", value: 18 },
            { name: "한쪽 팔 전체", value: 9 },
            { name: "한쪽 다리 전체", value: 18 },
            { name: "회음부", value: 1 },
        ];
        const selected = shuffle(parts).slice(0, rand(2, 3));
        const total = selected.reduce((s, p) => s + p.value, 0);
        const candidates = [9, 18, 19, 27, 28, 36, 37, 45, 46, 54].filter(n => n !== total);
        const wrongs = shuffle(candidates).slice(0, 3).map(n => `${n}%`);
        return { baseId: "burn", category: "성인간호학", part: "화상", emoji: "🔥", title: "9의 법칙 화상 면적",
            desc: `다음 부위에 화상을 입었다:\n${selected.map(p => `· ${p.name} (${p.value}%)`).join("\n")}\n\n총 체표면적(BSA)은?`,
            choices: shuffle([
                { text: `${total}%`, correct: true, effect: { hp: -2, rep: 20 }, log: `정답. ${selected.map(p => p.value).join(" + ")} = ${total}%` },
                { text: wrongs[0], effect: { hp: -15, rep: -10 }, log: "계산 오류입니다." },
                { text: wrongs[1], effect: { hp: -15, rep: -10 }, log: "계산 오류입니다." },
                { text: wrongs[2], effect: { hp: -20, rep: -15 }, log: "계산 오류입니다." }
            ]) };
    }

    function generateShockQuestion() {
        return { baseId: "shock", category: "성인간호학", part: "쇼크", emoji: "😰", title: "쇼크 분류",
            desc: `벌에 쏘이거나 페니실린 주사 후 두드러기와 심한 호흡곤란(천명음)이 발생하는 쇼크는?`,
            choices: shuffle([
                { text: "아나필락시스 쇼크", correct: true, effect: { hp: -2, rep: 20 }, log: "정답. 알레르기 반응에 의한 쇼크입니다." },
                { text: "저혈량성 쇼크", effect: { hp: -15, rep: -10 }, log: "출혈 등에 의한 쇼크입니다." },
                { text: "심인성 쇼크", effect: { hp: -15, rep: -10 }, log: "심근경색 등에 의한 심박출량 감소 쇼크입니다." },
                { text: "패혈성 쇼크", effect: { hp: -15, rep: -10 }, log: "감염에 의한 쇼크입니다." }
            ]) };
    }

    function generateDiabeticQuestion() {
        return { baseId: "diabetic", category: "성인간호학", part: "내분비계", emoji: "🩸", title: "당뇨 응급상황",
            desc: `당뇨 환자가 식은땀, 빈맥, 손떨림을 호소하며 의식이 혼미해질 때 의심할 상황은?`,
            choices: shuffle([
                { text: "저혈당증", correct: true, effect: { hp: -2, rep: 20 }, log: "정답. 전형적인 저혈당 징후입니다." },
                { text: "당뇨병성 케톤산증(DKA)", effect: { hp: -20, rep: -15 }, log: "고혈당 시 나타납니다 (과일냄새 호흡 등)." },
                { text: "아나필락시스 쇼크", effect: { hp: -15, rep: -10 }, log: "알레르기 징후와 다릅니다." },
                { text: "요붕증", effect: { hp: -15, rep: -10 }, log: "다뇨와 갈증이 주증상입니다." }
            ]) };
    }

    function generateAsepticQuestion() {
        return { baseId: "aseptic", category: "기본간호학", part: "무균술", emoji: "🧤", title: "외과적 무균술",
            desc: `외과적 무균술 원칙 중 **틀린** 것은?`,
            choices: shuffle([
                { text: "시야에서 벗어난 멸균 물품도 계속 멸균 상태로 간주한다.", correct: true, effect: { hp: -2, rep: 20 }, log: "정답(이것이 틀린 설명). 시야를 벗어나면 오염으로 간주합니다." },
                { text: "멸균 물품이 습기나 물에 젖으면 오염으로 간주한다.", effect: { hp: -15, rep: -10 }, log: "올바른 원칙입니다." },
                { text: "멸균포의 가장자리 2.5cm는 오염된 것으로 간주한다.", effect: { hp: -15, rep: -10 }, log: "올바른 원칙입니다." },
                { text: "멸균 물품은 멸균된 물품과 접촉할 때만 멸균이 유지된다.", effect: { hp: -15, rep: -10 }, log: "올바른 원칙입니다." }
            ]) };
    }

    // === 신규 문항 ===
    function generateECGQuestion() {
        const rhythms = [
            { name: "심실세동(VFib)", correct: "즉시 제세동(defibrillation)을 시행한다", log: "정답. VFib은 충격을 줘야 하는 리듬입니다." },
            { name: "무수축(Asystole)", correct: "CPR을 시작하고 에피네프린을 투여한다", log: "정답. Asystole은 제세동 금기, CPR과 약물이 핵심입니다." },
            { name: "심실빈맥(맥박 없음)", correct: "즉시 제세동(defibrillation)을 시행한다", log: "정답. 무맥성 VT는 VFib과 같이 처치합니다." },
            { name: "심방세동(AFib, 안정형)", correct: "심박수 조절과 항응고요법을 준비한다", log: "정답. 혈전 예방과 심박수 조절이 핵심입니다." },
        ];
        const r = pick(rhythms);
        const distractors = [
            "정상이므로 경과만 관찰한다",
            "수액 주입 속도만 두 배로 올린다",
            "환자를 일으켜 앉히고 심호흡을 시킨다",
            "혈관확장제를 정맥으로 빠르게 투여한다",
            "기도 흡인을 위해 머리를 낮춰준다"
        ].filter(t => t !== r.correct);
        const wrongs = shuffle(distractors).slice(0, 3);
        return { baseId: "ecg", category: "성인간호학", part: "심전도", emoji: "💗", title: "리듬 인식 및 중재",
            desc: `모니터에서 ${r.name} 이 확인되었다. 가장 적절한 중재는?`,
            choices: shuffle([
                { text: r.correct, correct: true, effect: { hp: -3, rep: 22 }, log: r.log },
                { text: wrongs[0], effect: { hp: -30, rep: -20 }, log: "리듬 인식 및 처치 우선순위가 잘못되었습니다." },
                { text: wrongs[1], effect: { hp: -30, rep: -20 }, log: "리듬 인식 및 처치 우선순위가 잘못되었습니다." },
                { text: wrongs[2], effect: { hp: -30, rep: -20 }, log: "리듬 인식 및 처치 우선순위가 잘못되었습니다." }
            ]) };
    }

    function generateLabValueQuestion() {
        const cases = [
            { lab: `Hgb 6.5 g/dL`, correct: "수혈 준비 및 활력징후 모니터링", log: "정답. 7 미만은 수혈 적응증입니다.", wrong: ["수분 섭취만 격려한다", "철분제를 경구 투여하고 외래로 보낸다", "운동 처방을 한다"] },
            { lab: `WBC 1,200/mm³`, correct: "역격리(보호격리) 적용 및 감염 예방", log: "정답. 중성구 감소 환자는 보호격리가 필요합니다.", wrong: ["다인실로 이동시킨다", "면회를 자유롭게 허용한다", "생채소와 생과일을 권장한다"] },
            { lab: `Na 118 mEq/L`, correct: "신경학적 사정 강화 및 수분 제한", log: "정답. 저나트륨혈증은 의식변화·경련 위험이 큽니다.", wrong: ["수분 섭취를 적극 권장한다", "이뇨제를 다량 투여한다", "Lasix를 IV로 빠르게 투여한다"] },
            { lab: `Glucose 38 mg/dL (의식 혼미)`, correct: "50% 포도당을 IV로 즉시 투여한다", log: "정답. 의식 저하 동반 저혈당은 IV 50DW가 1차입니다.", wrong: ["주스를 입에 부어준다", "인슐린을 추가로 투여한다", "수면을 권한다"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "lab", category: "성인간호학", part: "검사결과 해석", emoji: "🧪", title: "검사결과 우선 중재",
            desc: `검사 결과: ${c.lab}\n가장 적절한 간호중재는?`,
            choices: shuffle([
                { text: c.correct, correct: true, effect: { hp: -3, rep: 20 }, log: c.log },
                { text: wrongs[0], effect: { hp: -25, rep: -15 }, log: "결과 해석/중재가 잘못되었습니다." },
                { text: wrongs[1], effect: { hp: -25, rep: -15 }, log: "결과 해석/중재가 잘못되었습니다." },
                { text: wrongs[2], effect: { hp: -25, rep: -15 }, log: "결과 해석/중재가 잘못되었습니다." }
            ]) };
    }

    function generateCPRQuestion() {
        const cases = [
            { who: "성인", rate: "분당 100~120회, 깊이 5~6cm", wrong: ["분당 60회, 깊이 2cm", "분당 200회, 깊이 8cm", "분당 50회, 깊이 1cm"] },
            { who: "소아(1세 이상)", rate: "분당 100~120회, 깊이 가슴 두께 1/3 (약 5cm)", wrong: ["분당 60회, 깊이 1cm", "분당 200회, 가슴 두께 1/2", "분당 30회, 깊이 8cm"] },
            { who: "영아(1세 미만)", rate: "분당 100~120회, 깊이 약 4cm (가슴 두께 1/3)", wrong: ["분당 60회, 깊이 1cm", "분당 200회, 깊이 7cm", "분당 30회, 깊이 6cm"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "cpr", category: "성인간호학", part: "BLS", emoji: "🫀", title: "심폐소생술 압박",
            desc: `${c.who} 심정지 환자에게 시행하는 흉부압박의 속도와 깊이는?`,
            choices: shuffle([
                { text: c.rate, correct: true, effect: { hp: -3, rep: 22 }, log: `정답. ${c.who} 표준 CPR 지침입니다.` },
                { text: wrongs[0], effect: { hp: -25, rep: -15 }, log: "속도와 깊이가 부족합니다." },
                { text: wrongs[1], effect: { hp: -25, rep: -15 }, log: "지나치게 빠르고 깊습니다." },
                { text: wrongs[2], effect: { hp: -25, rep: -15 }, log: "기준에서 벗어났습니다." }
            ]) };
    }

    function generateInsulinQuestion() {
        const cases = [
            { name: "Lispro(휴마로그)", who: "초속효성", time: "식사 직전(15분 이내) 투여", wrong: ["식후 2시간 뒤 투여", "취침 전에만 투여", "공복에 투여하고 굶긴다"] },
            { name: "Regular(RI)", who: "속효성", time: "식전 30분에 투여", wrong: ["식사 직전 투여", "식후 1시간 후 투여", "야간에만 투여"] },
            { name: "NPH", who: "중간형", time: "주로 아침/취침 전 1~2회 투여 (피크: 6~12시간)", wrong: ["식전 30분에만 투여", "응급상황에 IV로 투여", "식후 4시간에 투여"] },
            { name: "Glargine(란투스)", who: "지속형", time: "하루 한 번 일정 시간에 피하주사 (피크 거의 없음)", wrong: ["식사 직전 빠른 주사", "응급 시 IV로 투여", "혼합해서 투여"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "insulin", category: "성인간호학", part: "내분비/약물", emoji: "💉", title: "인슐린 종류와 투여 시기",
            desc: `${c.name}(${c.who}) 인슐린의 올바른 투여 시기는?`,
            choices: shuffle([
                { text: c.time, correct: true, effect: { hp: -2, rep: 20 }, log: `정답. ${c.name}의 표준 투여 시기입니다.` },
                { text: wrongs[0], effect: { hp: -20, rep: -15 }, log: "투여 시기가 잘못되었습니다." },
                { text: wrongs[1], effect: { hp: -20, rep: -15 }, log: "투여 시기가 잘못되었습니다." },
                { text: wrongs[2], effect: { hp: -20, rep: -15 }, log: "투여 시기가 잘못되었습니다." }
            ]) };
    }

    function generatePainAssessmentQuestion() {
        const cases = [
            { who: "성인 의식 명료", tool: "NRS(숫자통증등급) 또는 VAS", wrong: ["FLACC", "CRIES", "PAINAD 만 사용"] },
            { who: "2개월 영아", tool: "FLACC 또는 NIPS", wrong: ["NRS", "VAS", "환자 자가 보고"] },
            { who: "치매로 의사소통 어려운 노인", tool: "PAINAD 등 행동 관찰 도구", wrong: ["NRS", "VAS", "자가보고만 신뢰"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "pain", category: "기본간호학", part: "통증사정", emoji: "🤕", title: "대상자별 통증 사정 도구",
            desc: `${c.who} 환자에게 가장 적절한 통증 사정 도구는?`,
            choices: shuffle([
                { text: c.tool, correct: true, effect: { hp: -2, rep: 18 }, log: `정답. ${c.who}에게는 ${c.tool}이 적절합니다.` },
                { text: wrongs[0], effect: { hp: -15, rep: -10 }, log: "대상자 특성과 맞지 않는 도구입니다." },
                { text: wrongs[1], effect: { hp: -15, rep: -10 }, log: "대상자 특성과 맞지 않는 도구입니다." },
                { text: wrongs[2], effect: { hp: -15, rep: -10 }, log: "대상자 특성과 맞지 않는 도구입니다." }
            ]) };
    }

    // =====================================================================
    // 추가 생성기 (카테고리 균형 확장 — 기본/모성/아동/정신/지역사회/관리/법규)
    // =====================================================================

    // ── 기본간호학 ──────────────────────────────────────────────────────
    function generateOxygenTherapyQuestion() {
        const cases = [
            { rate: "비강캐뉼라 4L/min", fio2: "약 36%", wrong: ["약 100%", "약 60%", "약 21%"] },
            { rate: "단순마스크 6L/min", fio2: "약 40~50%", wrong: ["약 21%", "약 90%", "약 100%"] },
            { rate: "비재호흡마스크(NRB) 10L/min", fio2: "약 80~95%", wrong: ["약 24%", "약 30%", "약 50%"] },
            { rate: "벤츄리마스크 24% 설정", fio2: "약 24%", wrong: ["약 100%", "약 60%", "측정 불가"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "oxygen", category: "기본간호학", part: "산소요법", emoji: "🫁", title: "산소 공급 장치별 FiO2",
            desc: `${c.rate} 적용 시 예상 흡입 산소농도(FiO2)는?`,
            choices: shuffle([
                { text: c.fio2, correct: true, effect: { hp: -2, rep: 18 }, log: `정답. ${c.rate} 의 표준 FiO2 입니다.` },
                { text: wrongs[0], effect: { hp: -18, rep: -12 }, log: "FiO2 추정이 잘못되었습니다." },
                { text: wrongs[1], effect: { hp: -18, rep: -12 }, log: "FiO2 추정이 잘못되었습니다." },
                { text: wrongs[2], effect: { hp: -18, rep: -12 }, log: "FiO2 추정이 잘못되었습니다." }
            ]) };
    }

    function generateUrinaryCathQuestion() {
        return { baseId: "foley", category: "기본간호학", part: "도뇨관 관리", emoji: "💧", title: "유치도뇨관 관리",
            desc: `유치도뇨(Foley) 환자의 요로감염(CAUTI) 예방을 위한 가장 우선되는 중재는?`,
            choices: shuffle([
                { text: "도뇨주머니는 항상 방광 아래에 위치시킨다", correct: true, effect: { hp: -2, rep: 20 }, log: "정답. 역류 방지를 위해 방광 높이 아래 유지가 핵심입니다." },
                { text: "주기적으로 도뇨관을 잠가둔다 (clamping)", effect: { hp: -18, rep: -12 }, log: "정체로 감염 위험만 증가시킵니다." },
                { text: "8시간마다 멸균 식염수로 방광 세척한다", effect: { hp: -20, rep: -14 }, log: "일상적 방광세척은 권장되지 않습니다." },
                { text: "삽입 부위에 항생제 연고를 도포한다", effect: { hp: -15, rep: -10 }, log: "근거 없는 중재입니다." }
            ]) };
    }

    function generateNGTubeQuestion() {
        return { baseId: "ng_tube", category: "기본간호학", part: "비위관 관리", emoji: "🥼", title: "비위관(NG tube) 위치 확인",
            desc: `비위관 삽입 후 위 내 위치 확인의 가장 신뢰할 수 있는 방법은?`,
            choices: shuffle([
                { text: "흉부 X-ray 촬영", correct: true, effect: { hp: -3, rep: 22 }, log: "정답. 영상학적 확인이 표준입니다." },
                { text: "공기를 주입하며 청진(whoosh sound) 확인", effect: { hp: -15, rep: -10 }, log: "전통적이지만 단독 사용은 권장되지 않습니다." },
                { text: "위 흡인액의 색만 확인", effect: { hp: -15, rep: -10 }, log: "단독으로는 신뢰성이 낮습니다." },
                { text: "삽입 길이 측정만으로 확인", effect: { hp: -18, rep: -12 }, log: "위치 확인 방법이 아닙니다." }
            ]) };
    }

    function generateWoundCareQuestion() {
        const cases = [
            { stage: "1단계 (Stage I) 욕창", action: "체위변경 강화 + 압력 분산 매트리스", wrong: ["습윤 드레싱만 적용", "데브리망(절제)", "항생제 정맥주입"] },
            { stage: "건강한 육아조직이 있는 2단계 욕창", action: "하이드로콜로이드 또는 폼 드레싱", wrong: ["거즈로 압박", "건조 상태 유지", "삼출물 무관 거즈 매일 교환"] },
            { stage: "감염 징후가 있는 깊은 욕창", action: "상처 배양 + 의사 보고 + 적절한 항생제", wrong: ["폐쇄성 드레싱 적용", "그대로 관찰", "심부 마사지"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "wound", category: "기본간호학", part: "상처 간호", emoji: "🩹", title: "욕창 단계별 중재",
            desc: `${c.stage} 환자에게 가장 적절한 중재는?`,
            choices: shuffle([
                { text: c.action, correct: true, effect: { hp: -2, rep: 20 }, log: `정답. ${c.stage} 의 표준 중재입니다.` },
                { text: wrongs[0], effect: { hp: -18, rep: -12 }, log: "단계에 맞지 않는 중재입니다." },
                { text: wrongs[1], effect: { hp: -18, rep: -12 }, log: "단계에 맞지 않는 중재입니다." },
                { text: wrongs[2], effect: { hp: -18, rep: -12 }, log: "단계에 맞지 않는 중재입니다." }
            ]) };
    }

    function generateRestraintQuestion() {
        return { baseId: "restraint", category: "기본간호학", part: "신체보호대", emoji: "🛡️", title: "신체보호대 적용 원칙",
            desc: `의사 처방 하에 신체보호대 적용 중인 환자의 관찰 및 관리 원칙은?`,
            choices: shuffle([
                { text: "최소 2시간마다 풀어주고 피부·순환 사정", correct: true, effect: { hp: -2, rep: 22 }, log: "정답. 2시간마다 해제·피부 사정이 표준입니다." },
                { text: "8시간마다 한 번씩만 사정", effect: { hp: -20, rep: -15 }, log: "간격이 너무 깁니다." },
                { text: "가족 동의만 있으면 의사 처방 없이도 적용 가능", effect: { hp: -25, rep: -18 }, log: "의사 처방이 반드시 필요합니다." },
                { text: "한 번 적용하면 24시간 유지 후 재평가", effect: { hp: -22, rep: -16 }, log: "최단 시간 사용이 원칙입니다." }
            ]) };
    }

    // ── 모성간호학 ──────────────────────────────────────────────────────
    function generateLochiaQuestion() {
        const cases = [
            { day: "분만 1~3일", color: "Lochia Rubra (선홍색)", wrong: ["Lochia Serosa (분홍/갈색)", "Lochia Alba (희끄무레)", "맑은 점액"] },
            { day: "분만 4~10일", color: "Lochia Serosa (분홍/갈색)", wrong: ["Lochia Rubra (선홍색)", "Lochia Alba (희끄무레)", "맑은 점액"] },
            { day: "분만 10일 이후~6주", color: "Lochia Alba (희끄무레/노랑)", wrong: ["Lochia Rubra (선홍색)", "Lochia Serosa (분홍/갈색)", "혈괴 다량"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "lochia", category: "모성간호학", part: "산후 사정", emoji: "🤱", title: "산후 오로(Lochia) 단계",
            desc: `${c.day} 산모에게서 관찰되는 정상 오로는?`,
            choices: shuffle([
                { text: c.color, correct: true, effect: { hp: -2, rep: 20 }, log: `정답. ${c.day} 의 정상 오로 양상입니다.` },
                { text: wrongs[0], effect: { hp: -15, rep: -10 }, log: "해당 시기 정상 양상이 아닙니다." },
                { text: wrongs[1], effect: { hp: -15, rep: -10 }, log: "해당 시기 정상 양상이 아닙니다." },
                { text: wrongs[2], effect: { hp: -15, rep: -10 }, log: "해당 시기 정상 양상이 아닙니다." }
            ]) };
    }

    function generatePreEclampsiaQuestion() {
        return { baseId: "preeclampsia", category: "모성간호학", part: "임신성 고혈압", emoji: "🤰", title: "중증 자간전증 사정",
            desc: `임신 32주 산모 BP 168/112mmHg, 단백뇨 3+, 두통/시야흐림 호소. 우선 중재는?`,
            choices: shuffle([
                { text: "자극 최소화한 좌측위 안정 + MgSO4 정맥 주입 준비", correct: true, effect: { hp: -3, rep: 25 }, log: "정답. 경련 예방을 위한 MgSO4 와 자극 차단이 우선입니다." },
                { text: "당장 분만 유도를 위한 옥시토신 시작", effect: { hp: -30, rep: -20 }, log: "혈압/경련 안정이 우선입니다." },
                { text: "조용한 환경에서 관찰만 진행", effect: { hp: -35, rep: -25 }, log: "중증 자간전증은 적극 중재가 필요합니다." },
                { text: "수분 부하를 위한 N/S 1L bolus", effect: { hp: -25, rep: -18 }, log: "폐부종 위험으로 신중해야 합니다." }
            ]) };
    }

    function generateBreastfeedingQuestion() {
        return { baseId: "breastfeed", category: "모성간호학", part: "모유수유", emoji: "🤱", title: "올바른 모유수유 자세 평가",
            desc: `초산모가 모유수유 중 유두통을 호소한다. 자세 교정의 핵심은?`,
            choices: shuffle([
                { text: "아기의 입이 유륜까지 깊게 물도록 유도", correct: true, effect: { hp: -2, rep: 20 }, log: "정답. 깊게 물기(deep latch) 가 유두 손상을 줄입니다." },
                { text: "수유 시간을 한 쪽 5분 이내로 제한", effect: { hp: -15, rep: -10 }, log: "충분한 수유시간 확보가 더 중요합니다." },
                { text: "분유로 보충 수유를 시작", effect: { hp: -18, rep: -12 }, log: "초기 수유 확립 전에는 권장되지 않습니다." },
                { text: "유방에 알코올 솜으로 소독 후 수유", effect: { hp: -20, rep: -15 }, log: "유두 건조와 자극을 유발합니다." }
            ]) };
    }

    function generateContractionQuestion() {
        return { baseId: "contraction", category: "모성간호학", part: "분만 진행", emoji: "👶", title: "자궁 수축 평가",
            desc: `분만 1기 활동기 산모의 자궁 수축 양상으로 가장 적절한 것은?`,
            choices: shuffle([
                { text: "3~5분 간격, 40~70초 지속, 중강도~강함", correct: true, effect: { hp: -2, rep: 22 }, log: "정답. 활동기 전형적 수축 양상입니다." },
                { text: "10분 간격, 30초 지속, 약함", effect: { hp: -15, rep: -10 }, log: "잠재기 양상에 가깝습니다." },
                { text: "1분 간격, 90초 지속, 매우 강함", effect: { hp: -18, rep: -12 }, log: "과강축으로 위험 신호입니다." },
                { text: "불규칙한 5~15분 간격, 강도 변화 큼", effect: { hp: -15, rep: -10 }, log: "가진통(false labor) 양상입니다." }
            ]) };
    }

    // ── 아동간호학 ──────────────────────────────────────────────────────
    function generateGrowthQuestion() {
        const cases = [
            { age: "2개월", milestone: "사회적 미소, 머리 들기", wrong: ["혼자 앉기", "기기", "두 단어 문장"] },
            { age: "6개월", milestone: "지지없이 앉기, 옹알이", wrong: ["혼자 걷기", "달리기", "5~6 단어 사용"] },
            { age: "12개월", milestone: "혼자 서기/한두 발자국, '엄마/아빠' 사용", wrong: ["뛰기", "세 단어 문장", "옷 단추 채우기"] },
            { age: "24개월", milestone: "두 단어 문장, 계단 오르내리기", wrong: ["혼자 앉기 시작", "출생체중의 2배", "사회적 미소"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "growth", category: "아동간호학", part: "발달이정표", emoji: "🧒", title: "영유아 발달이정표",
            desc: `${c.age} 영유아의 정상 발달 이정표는?`,
            choices: shuffle([
                { text: c.milestone, correct: true, effect: { hp: -2, rep: 20 }, log: `정답. ${c.age} 의 표준 발달 단계입니다.` },
                { text: wrongs[0], effect: { hp: -15, rep: -10 }, log: "해당 연령 발달 단계가 아닙니다." },
                { text: wrongs[1], effect: { hp: -15, rep: -10 }, log: "해당 연령 발달 단계가 아닙니다." },
                { text: wrongs[2], effect: { hp: -15, rep: -10 }, log: "해당 연령 발달 단계가 아닙니다." }
            ]) };
    }

    function generateFebrileSeizureQuestion() {
        return { baseId: "febrile_seizure", category: "아동간호학", part: "응급간호", emoji: "🌡️", title: "열성경련 응급 처치",
            desc: `15개월 영아가 발열 39.2℃ 중 전신 강직간대 경련 발생. 우선 중재는?`,
            choices: shuffle([
                { text: "옆으로 눕히고 기도 확보, 주변 안전 확보", correct: true, effect: { hp: -3, rep: 25 }, log: "정답. 측위·기도확보가 우선입니다." },
                { text: "입에 설압자를 물려 혀를 보호한다", effect: { hp: -30, rep: -22 }, log: "구강 내 삽입은 외상과 흡인 위험입니다." },
                { text: "팔다리를 잡아 경련을 멈춘다", effect: { hp: -28, rep: -20 }, log: "골절·관절 손상 위험. 절대 금지입니다." },
                { text: "얼음물로 즉시 전신을 닦는다", effect: { hp: -25, rep: -18 }, log: "혈관 수축과 떨림으로 체온이 오히려 상승합니다." }
            ]) };
    }

    function generateDehydrationQuestion() {
        const cases = [
            { sev: "경증 (체중감소 3~5%)", action: "경구수액(ORS) 시행", wrong: ["IV bolus 20ml/kg", "수액 제한", "관장 시행"] },
            { sev: "중등도 (체중감소 6~9%)", action: "ORS 시도 후 효과 없으면 IV", wrong: ["관찰만 진행", "관장 시행", "구토 시까지 ORS 중단"] },
            { sev: "중증 (체중감소 ≥10%, 쇼크 징후)", action: "IV 등장성 수액 20ml/kg bolus", wrong: ["ORS 단독 시도", "수분 제한", "이뇨제 투여"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "peds_dehydration", category: "아동간호학", part: "수분/전해질", emoji: "💧", title: "소아 탈수 중증도별 중재",
            desc: `${c.sev} 영아의 우선 중재는?`,
            choices: shuffle([
                { text: c.action, correct: true, effect: { hp: -3, rep: 22 }, log: `정답. ${c.sev} 의 표준 중재입니다.` },
                { text: wrongs[0], effect: { hp: -20, rep: -15 }, log: "중증도에 맞지 않는 중재입니다." },
                { text: wrongs[1], effect: { hp: -20, rep: -15 }, log: "중증도에 맞지 않는 중재입니다." },
                { text: wrongs[2], effect: { hp: -20, rep: -15 }, log: "중증도에 맞지 않는 중재입니다." }
            ]) };
    }

    function generatePedsDoseQuestion() {
        const wt = rand(8, 28);
        const dosePerKg = pick([10, 15, 20]);
        const dose = wt * dosePerKg;
        const wrong1 = dose * 2;
        const wrong2 = Math.round(dose / 2);
        const wrong3 = wt + dosePerKg;
        return { baseId: "peds_dose", category: "아동간호학", part: "약물 용량 계산", emoji: "💊", title: "소아 체중 기반 용량 계산",
            desc: `체중 ${wt}kg 의 아동에게 ${dosePerKg}mg/kg 처방 시 1회 용량은?`,
            choices: shuffle([
                { text: `${dose}mg`, correct: true, effect: { hp: -2, rep: 20 }, log: `정답. ${wt} × ${dosePerKg} = ${dose}mg.` },
                { text: `${wrong1}mg`, effect: { hp: -25, rep: -18 }, log: "용량 과다입니다." },
                { text: `${wrong2}mg`, effect: { hp: -22, rep: -16 }, log: "용량 부족입니다." },
                { text: `${wrong3}mg`, effect: { hp: -25, rep: -18 }, log: "계산 방식이 잘못되었습니다." }
            ]) };
    }

    // ── 정신간호학 ──────────────────────────────────────────────────────
    function generateSuicideRiskQuestion() {
        return { baseId: "suicide_risk", category: "정신간호학", part: "자살 위기", emoji: "🆘", title: "자살 위험 사정",
            desc: `우울증 환자가 "더 이상 살고 싶지 않다" 고 말한다. 간호사의 가장 적절한 반응은?`,
            choices: shuffle([
                { text: "구체적인 자살 계획이 있는지 직접 물어본다", correct: true, effect: { hp: -3, rep: 25 }, log: "정답. 직접 질문이 위험 평가의 표준입니다." },
                { text: "다른 화제로 돌려 환자를 안심시킨다", effect: { hp: -28, rep: -22 }, log: "회피는 위험 평가를 못 합니다." },
                { text: "그런 생각은 잘못된 것이라고 설명한다", effect: { hp: -25, rep: -20 }, log: "비판적 반응은 치료적이지 않습니다." },
                { text: "환자에게 비밀로 하고 다른 환자와 격리한다", effect: { hp: -22, rep: -18 }, log: "솔직한 평가와 다학제 대응이 필요합니다." }
            ]) };
    }

    function generateSchizophreniaQuestion() {
        return { baseId: "schizo_communication", category: "정신간호학", part: "치료적 의사소통", emoji: "🗨️", title: "환각·망상 환자 대응",
            desc: `조현병 환자가 "벽에서 누군가 내 이름을 부른다" 고 호소한다. 간호사의 적절한 반응은?`,
            choices: shuffle([
                { text: "\"저는 그 소리가 들리지 않지만 환자분께는 들린다는 것을 알겠습니다\"", correct: true, effect: { hp: -2, rep: 22 }, log: "정답. 환자의 경험을 부정하지 않으면서 현실을 제시합니다." },
                { text: "\"그건 환청이니까 신경 쓰지 마세요\"", effect: { hp: -22, rep: -18 }, log: "환자의 경험을 무시하는 반응입니다." },
                { text: "\"그 사람이 뭐라고 하는데요? 자세히 말해보세요\"", effect: { hp: -20, rep: -15 }, log: "환청 내용 탐색은 망상을 강화할 수 있습니다." },
                { text: "조용한 방에서 혼자 있게 한다", effect: { hp: -18, rep: -12 }, log: "고립은 증상을 악화시킬 수 있습니다." }
            ]) };
    }

    function generateAntipsychoticQuestion() {
        return { baseId: "antipsychotic", category: "정신간호학", part: "약물 부작용", emoji: "💊", title: "정형 항정신병약 추체외로 증상(EPS)",
            desc: `Haloperidol 투여 환자가 목이 한쪽으로 강하게 돌아가고 고열·근경직을 보인다. 의심해야 할 것은?`,
            choices: shuffle([
                { text: "신경이완제 악성증후군(NMS) — 즉시 중단 + 응급 처치", correct: true, effect: { hp: -5, rep: 30 }, log: "정답. NMS 는 치명적입니다. 즉시 약물 중단·해열·수액·dantrolene 고려." },
                { text: "단순 불안 반응", effect: { hp: -30, rep: -22 }, log: "고열·근경직은 NMS 의심 징후입니다." },
                { text: "약물 효과 부족 — 용량 증량 필요", effect: { hp: -35, rep: -25 }, log: "오히려 중단이 필요합니다." },
                { text: "단순 정좌불능(akathisia)", effect: { hp: -25, rep: -18 }, log: "akathisia 는 고열·근경직을 동반하지 않습니다." }
            ]) };
    }

    function generateBipolarQuestion() {
        return { baseId: "bipolar_mania", category: "정신간호학", part: "양극성 장애", emoji: "🎢", title: "조증 삽화 환자 간호",
            desc: `급성 조증 삽화 환자가 잠을 안 자고 끊임없이 말하며 다른 환자에게 시비를 건다. 우선 중재는?`,
            choices: shuffle([
                { text: "자극이 적은 조용한 환경으로 옮기고 안전 확보", correct: true, effect: { hp: -3, rep: 22 }, log: "정답. 자극 감소가 우선입니다." },
                { text: "함께 활동하며 긴 대화로 에너지를 소진시킨다", effect: { hp: -22, rep: -18 }, log: "오히려 자극을 늘립니다." },
                { text: "혼자 방에 두고 문을 잠근다", effect: { hp: -28, rep: -22 }, log: "법적·윤리적 문제 + 자해 위험." },
                { text: "흥분을 가라앉히기 위해 카페인 음료를 제공한다", effect: { hp: -25, rep: -20 }, log: "각성제는 절대 금기입니다." }
            ]) };
    }

    function generateMSEQuestion() {
        const cases = [
            { item: "지남력(Orientation)", q: "환자에게 \"오늘 며칠인가요?\" 라고 물어 평가하는 정신상태 항목은?" },
            { item: "사고형태(Thought Process)", q: "환자의 말이 주제와 무관하게 계속 튀는 것을 평가하는 항목은?" },
            { item: "정동(Affect)", q: "환자가 슬픈 이야기를 하며 웃는 부적절한 표정을 평가하는 항목은?" },
            { item: "통찰력(Insight)", q: "환자가 자신의 병에 대해 이해하는 정도를 평가하는 항목은?" },
        ];
        const c = pick(cases);
        const wrongs = shuffle(cases.filter(x => x.item !== c.item).map(x => x.item));
        return { baseId: "mse", category: "정신간호학", part: "정신상태검사", emoji: "🧠", title: "MSE 항목 식별",
            desc: c.q,
            choices: shuffle([
                { text: c.item, correct: true, effect: { hp: -2, rep: 18 }, log: `정답. ${c.item} 의 평가 방법입니다.` },
                { text: wrongs[0], effect: { hp: -15, rep: -10 }, log: "다른 MSE 항목입니다." },
                { text: wrongs[1], effect: { hp: -15, rep: -10 }, log: "다른 MSE 항목입니다." },
                { text: wrongs[2], effect: { hp: -15, rep: -10 }, log: "다른 MSE 항목입니다." }
            ]) };
    }

    // ── 지역사회간호학 ─────────────────────────────────────────────────
    function generateInfectionDiseaseQuestion() {
        const cases = [
            { disease: "결핵", grade: "제2급", wrong: ["제1급", "제3급", "제4급"] },
            { disease: "에볼라바이러스병", grade: "제1급", wrong: ["제2급", "제3급", "제4급"] },
            { disease: "B형간염", grade: "제3급", wrong: ["제1급", "제2급", "제4급"] },
            { disease: "수두", grade: "제2급", wrong: ["제1급", "제3급", "제4급"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "infection_law", category: "지역사회간호학", part: "법정감염병", emoji: "🦠", title: "법정감염병 등급 분류",
            desc: `${c.disease} 의 법정감염병 분류(2020 개정)는?`,
            choices: shuffle([
                { text: c.grade, correct: true, effect: { hp: -2, rep: 20 }, log: `정답. ${c.disease} 은(는) ${c.grade} 입니다.` },
                { text: wrongs[0], effect: { hp: -15, rep: -10 }, log: "분류가 다릅니다." },
                { text: wrongs[1], effect: { hp: -15, rep: -10 }, log: "분류가 다릅니다." },
                { text: wrongs[2], effect: { hp: -15, rep: -10 }, log: "분류가 다릅니다." }
            ]) };
    }

    function generateImmunizationScheduleQuestion() {
        const cases = [
            { vaccine: "BCG", age: "출생 후 4주 이내", wrong: ["12개월", "2개월", "6개월"] },
            { vaccine: "DTaP 1차", age: "생후 2개월", wrong: ["출생 직후", "12개월", "만 4세"] },
            { vaccine: "MMR 1차", age: "생후 12~15개월", wrong: ["생후 2개월", "생후 6개월", "만 6세"] },
            { vaccine: "일본뇌염 사백신 1차", age: "생후 12~23개월", wrong: ["출생 직후", "생후 2개월", "만 12세"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "imm_schedule", category: "지역사회간호학", part: "예방접종", emoji: "💉", title: "표준 예방접종 일정",
            desc: `${c.vaccine} 의 표준 첫 접종 시기는?`,
            choices: shuffle([
                { text: c.age, correct: true, effect: { hp: -2, rep: 18 }, log: `정답. ${c.vaccine} 표준 일정입니다.` },
                { text: wrongs[0], effect: { hp: -15, rep: -10 }, log: "표준 일정이 아닙니다." },
                { text: wrongs[1], effect: { hp: -15, rep: -10 }, log: "표준 일정이 아닙니다." },
                { text: wrongs[2], effect: { hp: -15, rep: -10 }, log: "표준 일정이 아닙니다." }
            ]) };
    }

    function generateMaternalChildQuestion() {
        return { baseId: "mch_program", category: "지역사회간호학", part: "모자보건", emoji: "👪", title: "모자보건사업",
            desc: `우리나라 모자보건법상 영유아 정기 건강검진의 주된 목적은?`,
            choices: shuffle([
                { text: "성장발달 평가 + 예방접종 확인 + 조기 이상 발견", correct: true, effect: { hp: -2, rep: 20 }, log: "정답. 통합적 영유아 건강관리 목적입니다." },
                { text: "치료 위주의 의료 서비스 제공", effect: { hp: -15, rep: -10 }, log: "예방·발견 중심입니다." },
                { text: "부모 면담을 통한 양육비 지원 심사", effect: { hp: -18, rep: -12 }, log: "사업 목적이 아닙니다." },
                { text: "감염병 발생 후 격리 조치 시행", effect: { hp: -18, rep: -12 }, log: "예방접종 중심입니다." }
            ]) };
    }

    function generateOccupationalHealthQuestion() {
        return { baseId: "occ_health", category: "지역사회간호학", part: "산업보건", emoji: "🏭", title: "산업재해 응급처치",
            desc: `염산이 작업자 눈에 튄 직장 보건실 응급처치의 우선 순위는?`,
            choices: shuffle([
                { text: "즉시 흐르는 미온수로 최소 15~20분 세척", correct: true, effect: { hp: -3, rep: 25 }, log: "정답. 화학물질 세척이 최우선입니다." },
                { text: "환자를 안정시키고 안과 진료 의뢰만 한다", effect: { hp: -30, rep: -22 }, log: "세척이 먼저입니다." },
                { text: "중화제(베이킹소다)를 즉시 점안한다", effect: { hp: -28, rep: -20 }, log: "중화 반응열로 추가 손상 가능." },
                { text: "안대를 적용한 후 이송한다", effect: { hp: -25, rep: -18 }, log: "세척 없이 안대는 손상을 키웁니다." }
            ]) };
    }

    function generateChronicDiseaseQuestion() {
        return { baseId: "chronic_dz", category: "지역사회간호학", part: "만성질환 관리", emoji: "📊", title: "고혈압 환자 교육",
            desc: `고혈압 환자 가정방문 시 가장 우선 교육해야 할 생활습관은?`,
            choices: shuffle([
                { text: "저염식(나트륨 2g/일 이하) + 규칙적 유산소 운동 + 금연", correct: true, effect: { hp: -2, rep: 22 }, log: "정답. 비약물 치료의 핵심입니다." },
                { text: "필요시에만 혈압을 측정하고 약은 증상 있을 때만 복용", effect: { hp: -25, rep: -20 }, log: "고혈압은 무증상이 흔합니다. 규칙적 복용 필수." },
                { text: "수분 섭취를 1일 500mL 로 제한", effect: { hp: -22, rep: -18 }, log: "탈수 위험. 적절한 수분 필요." },
                { text: "운동은 혈압이 정상화되면 중단", effect: { hp: -20, rep: -15 }, log: "지속적 운동이 필요합니다." }
            ]) };
    }

    // ── 간호관리학 ──────────────────────────────────────────────────────
    function generateLeadershipQuestion() {
        const cases = [
            { sit: "응급 코드블루 상황", style: "독재형(authoritarian) 리더십", wrong: ["자유방임형", "민주형", "변혁형"] },
            { sit: "병동 환경개선 위원회 운영", style: "민주형(democratic) 리더십", wrong: ["독재형", "자유방임형", "거래형"] },
            { sit: "고도 전문 연구팀 신약 개발", style: "자유방임형(laissez-faire) 리더십", wrong: ["독재형", "거래형", "민주형"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "leadership", category: "간호관리학", part: "리더십 이론", emoji: "🎯", title: "상황에 맞는 리더십 스타일",
            desc: `${c.sit} 에 가장 적합한 리더십 유형은?`,
            choices: shuffle([
                { text: c.style, correct: true, effect: { hp: -2, rep: 20 }, log: `정답. ${c.sit} 에 적합한 스타일입니다.` },
                { text: wrongs[0], effect: { hp: -15, rep: -10 }, log: "해당 상황에 맞지 않습니다." },
                { text: wrongs[1], effect: { hp: -15, rep: -10 }, log: "해당 상황에 맞지 않습니다." },
                { text: wrongs[2], effect: { hp: -15, rep: -10 }, log: "해당 상황에 맞지 않습니다." }
            ]) };
    }

    function generateDelegationQuestion() {
        return { baseId: "delegation", category: "간호관리학", part: "위임", emoji: "🤝", title: "위임의 5권리",
            desc: `간호사가 보조인력에게 업무를 위임할 때 따라야 할 '5권리'에 포함되지 않는 것은?`,
            choices: shuffle([
                { text: "올바른 환자의 가족 동의", correct: true, effect: { hp: -2, rep: 18 }, log: "정답. 위임 5권리는 과업·상황·인력·지시·감독입니다. 환자 가족 동의는 위임 권리에 포함되지 않습니다." },
                { text: "올바른 과업 (right task)", effect: { hp: -15, rep: -10 }, log: "5권리에 포함됩니다." },
                { text: "올바른 인력 (right person)", effect: { hp: -15, rep: -10 }, log: "5권리에 포함됩니다." },
                { text: "올바른 감독 (right supervision)", effect: { hp: -15, rep: -10 }, log: "5권리에 포함됩니다." }
            ]) };
    }

    function generatePatientSafetyQuestion() {
        return { baseId: "pt_safety", category: "간호관리학", part: "환자안전", emoji: "🛡️", title: "환자안전사고 분류 (적신호)",
            desc: `보고가 가장 시급한 '적신호(sentinel) 사건'으로 분류되는 것은?`,
            choices: shuffle([
                { text: "수술 부위 오류로 인한 환자 사망", correct: true, effect: { hp: -3, rep: 25 }, log: "정답. 적신호 사건은 사망·영구손상 등 중대 결과입니다." },
                { text: "투약 시 처방 확인을 미흡하게 한 근접오류(near miss)", effect: { hp: -15, rep: -10 }, log: "근접오류는 위해사건으로 진행되지 않은 사건입니다." },
                { text: "환자가 낙상했으나 부상이 없는 경우", effect: { hp: -18, rep: -12 }, log: "사고는 발생했지만 적신호는 아닙니다." },
                { text: "정맥주사 자국 발생", effect: { hp: -20, rep: -14 }, log: "경미한 사건입니다." }
            ]) };
    }

    function generateQIQuestion() {
        const cases = [
            { def: "Plan-Do-Check-Act 4단계 순환을 통한 지속적 개선 기법", name: "PDCA 사이클 (Deming Cycle)", wrong: ["Six Sigma", "Root Cause Analysis", "벤치마킹"] },
            { def: "결함률을 백만 분의 3.4 수준까지 줄이는 통계적 품질 관리 기법", name: "Six Sigma", wrong: ["PDCA 사이클", "벤치마킹", "Failure Mode Analysis"] },
            { def: "사건의 근본 원인을 다단계로 추적해 재발 방지책을 도출하는 분석", name: "Root Cause Analysis (RCA)", wrong: ["Six Sigma", "PDCA 사이클", "벤치마킹"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "qi", category: "간호관리학", part: "질 관리", emoji: "📈", title: "질 관리 기법 식별",
            desc: `다음 설명에 해당하는 기법은? "${c.def}"`,
            choices: shuffle([
                { text: c.name, correct: true, effect: { hp: -2, rep: 20 }, log: `정답. ${c.name} 의 정의입니다.` },
                { text: wrongs[0], effect: { hp: -15, rep: -10 }, log: "다른 기법입니다." },
                { text: wrongs[1], effect: { hp: -15, rep: -10 }, log: "다른 기법입니다." },
                { text: wrongs[2], effect: { hp: -15, rep: -10 }, log: "다른 기법입니다." }
            ]) };
    }

    // ── 보건의약관계법규 ───────────────────────────────────────────────
    function generateMedicalLawQuestion() {
        return { baseId: "medical_law_facility", category: "보건의약관계법규", part: "의료법", emoji: "⚖️", title: "의료기관 종별 구분",
            desc: `의료법상 30개 이상 100개 미만의 병상을 갖춘 의료기관의 종별은?`,
            choices: shuffle([
                { text: "병원", correct: true, effect: { hp: -2, rep: 20 }, log: "정답. 의료법상 병원은 30개 이상 병상을 가진 의료기관입니다." },
                { text: "의원", effect: { hp: -15, rep: -10 }, log: "의원은 외래 중심의 30 병상 미만 기관입니다." },
                { text: "종합병원", effect: { hp: -15, rep: -10 }, log: "종합병원은 100 병상 이상이며 진료과목 기준이 추가됩니다." },
                { text: "요양병원", effect: { hp: -15, rep: -10 }, log: "요양병원은 장기 요양이 필요한 환자를 위한 별도 종별입니다." }
            ]) };
    }

    function generateNarcoticLawQuestion() {
        return { baseId: "narcotic_law", category: "보건의약관계법규", part: "마약류관리법", emoji: "🔒", title: "마약류 보관 원칙",
            desc: `마약류 관리법상 마약(향정신성의약품 제외)의 보관 원칙으로 옳은 것은?`,
            choices: shuffle([
                { text: "이중 잠금장치가 있는 철제 금고에 마약만 분리 보관", correct: true, effect: { hp: -2, rep: 22 }, log: "정답. 마약은 이중 잠금 + 분리 보관이 법적 요구사항입니다." },
                { text: "다른 응급 약품과 함께 응급카트에 보관", effect: { hp: -25, rep: -18 }, log: "분리 보관 위반입니다." },
                { text: "병동 약품장에 일반약과 함께 보관", effect: { hp: -28, rep: -20 }, log: "법 위반입니다." },
                { text: "환자별 서랍에 처방 즉시 분배 보관", effect: { hp: -25, rep: -18 }, log: "잠금장치 의무를 위반합니다." }
            ]) };
    }

    function generateMentalHealthLawQuestion() {
        return { baseId: "mh_law_admit", category: "보건의약관계법규", part: "정신건강복지법", emoji: "📜", title: "정신건강복지법 입원 유형",
            desc: `정신건강복지법상 보호의무자 2명의 동의와 정신과 전문의 1인의 진단에 의한 입원 유형은?`,
            choices: shuffle([
                { text: "보호의무자에 의한 입원", correct: true, effect: { hp: -2, rep: 22 }, log: "정답. 보호의무자 2인 동의 + 전문의 1인 진단으로 진행됩니다." },
                { text: "자의입원", effect: { hp: -15, rep: -10 }, log: "자의입원은 본인 동의에 의한 입원입니다." },
                { text: "행정입원", effect: { hp: -15, rep: -10 }, log: "행정입원은 자·타해 위험으로 지자체장이 입원을 신청합니다." },
                { text: "응급입원", effect: { hp: -15, rep: -10 }, log: "응급입원은 의사·경찰 동의로 72시간 한정입니다." }
            ]) };
    }

    function generateBloodLawQuestion() {
        return { baseId: "blood_law", category: "보건의약관계법규", part: "혈액관리법", emoji: "🩸", title: "혈액관리법 채혈 기준",
            desc: `혈액관리법상 전혈 채혈의 채혈 간격은?`,
            choices: shuffle([
                { text: "동일인이 전혈 채혈 후 2개월(8주) 경과 후 재채혈 가능", correct: true, effect: { hp: -2, rep: 20 }, log: "정답. 전혈 채혈은 8주 간격이 원칙입니다." },
                { text: "1주 경과 후 재채혈 가능", effect: { hp: -25, rep: -18 }, log: "철 결핍 위험으로 부적절합니다." },
                { text: "1년 경과 후 재채혈 가능", effect: { hp: -18, rep: -12 }, log: "간격이 너무 길어 실제 규정과 다릅니다." },
                { text: "건강검진 결과에 따라 제한 없음", effect: { hp: -22, rep: -16 }, log: "법령상 최소 간격이 명시되어 있습니다." }
            ]) };
    }

    function generateInfectionLawGradeQuestion() {
        return { baseId: "infection_law_report", category: "보건의약관계법규", part: "감염병예방관리법", emoji: "📋", title: "감염병 신고 기한",
            desc: `제1급 감염병을 발견한 의사는 언제까지 신고해야 하는가?`,
            choices: shuffle([
                { text: "즉시 (지체 없이)", correct: true, effect: { hp: -2, rep: 22 }, log: "정답. 1급은 즉시 신고가 법적 의무입니다." },
                { text: "24시간 이내", effect: { hp: -15, rep: -10 }, log: "2급의 기준입니다." },
                { text: "7일 이내", effect: { hp: -18, rep: -12 }, log: "3급에 가까운 기준입니다." },
                { text: "월 1회 보고", effect: { hp: -22, rep: -16 }, log: "1급에는 맞지 않습니다." }
            ]) };
    }

    // ── 성인간호학 추가 ─────────────────────────────────────────────────
    function generateAnticoagulantQuestion() {
        const cases = [
            { drug: "Heparin (정맥)", lab: "aPTT — 정상의 1.5~2.5배", wrong: ["PT/INR 2.0~3.0", "혈소판만 모니터링", "ALT/AST 만 추적"] },
            { drug: "Warfarin (경구)", lab: "PT/INR — 보통 2.0~3.0", wrong: ["aPTT 1.5~2.5배", "BUN/Cr 추적", "전혈구 검사만"] },
            { drug: "Enoxaparin (LMWH)", lab: "Anti-Xa level (필요 시)", wrong: ["aPTT 일상 모니터링", "PT/INR 매일", "전해질만 추적"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "anticoag", category: "성인간호학", part: "혈액/약물", emoji: "💉", title: "항응고제 모니터링 검사",
            desc: `${c.drug} 사용 환자의 표준 모니터링 지표는?`,
            choices: shuffle([
                { text: c.lab, correct: true, effect: { hp: -2, rep: 22 }, log: `정답. ${c.drug} 의 표준 모니터링입니다.` },
                { text: wrongs[0], effect: { hp: -22, rep: -16 }, log: "해당 약물의 표준이 아닙니다." },
                { text: wrongs[1], effect: { hp: -22, rep: -16 }, log: "해당 약물의 표준이 아닙니다." },
                { text: wrongs[2], effect: { hp: -22, rep: -16 }, log: "해당 약물의 표준이 아닙니다." }
            ]) };
    }

    function generateChestTubeQuestion() {
        return { baseId: "chest_tube", category: "성인간호학", part: "호흡기/수술 후", emoji: "🫁", title: "흉관(Chest tube) 관리",
            desc: `흉관 배액 시스템의 물밀폐병(water seal) 에서 지속적인 거품이 보인다. 의미는?`,
            choices: shuffle([
                { text: "공기 누출(air leak) — 연결부 점검 후 의사 보고", correct: true, effect: { hp: -3, rep: 25 }, log: "정답. 지속적 bubbling 은 air leak 신호입니다." },
                { text: "정상 호흡 변동 — 관찰만 진행", effect: { hp: -28, rep: -20 }, log: "정상 변동은 호흡 따라 oscillation 만 나타납니다." },
                { text: "흡인 압력 과다 — 흡인 차단", effect: { hp: -22, rep: -16 }, log: "흡인 조절병의 bubbling 과 혼동입니다." },
                { text: "환자 회복 신호 — 흉관 제거 준비", effect: { hp: -25, rep: -18 }, log: "오히려 누출 의심 신호입니다." }
            ]) };
    }

    function generateRenalFailureQuestion() {
        const cases = [
            { stage: "AKI 1단계 (KDIGO)", finding: "Cr 1.5~1.9배 상승 또는 0.3mg/dL 증가", wrong: ["Cr 3배 이상", "투석 필요 수준", "정상 범위"] },
            { stage: "CKD 3단계", finding: "GFR 30~59mL/min/1.73㎡", wrong: ["GFR 90 이상", "GFR 15 미만 (말기)", "단백뇨만 있음"] },
            { stage: "ESRD (말기 신부전)", finding: "GFR 15 미만, 신대체요법 필요", wrong: ["GFR 60 이상", "GFR 45 수준", "급성 가역성 손상"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "renal_stage", category: "성인간호학", part: "신장/배뇨", emoji: "🫘", title: "신부전 단계 판정",
            desc: `${c.stage} 의 진단 기준은?`,
            choices: shuffle([
                { text: c.finding, correct: true, effect: { hp: -2, rep: 22 }, log: `정답. ${c.stage} 의 표준 정의입니다.` },
                { text: wrongs[0], effect: { hp: -18, rep: -12 }, log: "기준이 다릅니다." },
                { text: wrongs[1], effect: { hp: -18, rep: -12 }, log: "기준이 다릅니다." },
                { text: wrongs[2], effect: { hp: -18, rep: -12 }, log: "기준이 다릅니다." }
            ]) };
    }

    function generateStrokeQuestion() {
        return { baseId: "stroke_assess", category: "성인간호학", part: "신경계", emoji: "🧠", title: "급성 뇌졸중 신속 사정 (FAST)",
            desc: `응급실 도착 환자의 뇌졸중 의심 시 'FAST' 평가 항목이 아닌 것은?`,
            choices: shuffle([
                { text: "Fever (발열)", correct: true, effect: { hp: -2, rep: 20 }, log: "정답. FAST 는 Face/Arm/Speech/Time 입니다. 발열은 포함되지 않습니다." },
                { text: "Face (안면 비대칭)", effect: { hp: -15, rep: -10 }, log: "FAST 의 첫 항목입니다." },
                { text: "Arm (팔 처짐)", effect: { hp: -15, rep: -10 }, log: "FAST 의 두 번째 항목입니다." },
                { text: "Speech (말 어눌함)", effect: { hp: -15, rep: -10 }, log: "FAST 의 세 번째 항목입니다." }
            ]) };
    }

    function generateThyroidQuestion() {
        const cases = [
            { state: "갑상선기능항진증", finding: "체중감소, 빈맥, 발한, 안구돌출", wrong: ["체중증가, 서맥, 추위 인내성↓", "수면 과다, 무기력", "변비, 피부 건조"] },
            { state: "갑상선기능저하증", finding: "체중증가, 서맥, 추위 인내성↓, 변비", wrong: ["체중감소, 빈맥, 발한", "불면증, 흥분", "안구돌출, 발한"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "thyroid", category: "성인간호학", part: "내분비", emoji: "🦋", title: "갑상선 기능 이상 임상양상",
            desc: `${c.state} 환자의 전형적인 증상은?`,
            choices: shuffle([
                { text: c.finding, correct: true, effect: { hp: -2, rep: 20 }, log: `정답. ${c.state} 의 전형적인 양상입니다.` },
                { text: wrongs[0], effect: { hp: -18, rep: -12 }, log: "반대 상태의 양상입니다." },
                { text: wrongs[1], effect: { hp: -18, rep: -12 }, log: "다른 상태의 양상입니다." },
                { text: wrongs[2], effect: { hp: -18, rep: -12 }, log: "다른 상태의 양상입니다." }
            ]) };
    }

    // ── 비율 보정 라운드 (간호관리학 +3, 정신 +2, 지역 +2, 모성 +1, 아동 +1) ─

    function generateConflictMgmtQuestion() {
        return { baseId: "conflict_mgmt", category: "간호관리학", part: "갈등관리", emoji: "🤝", title: "Thomas-Kilmann 갈등관리 전략",
            desc: `간호사와 의사가 처방 변경 시점을 두고 의견 충돌. 둘 다 양보 의지가 있고 시간이 충분한 상황에서 가장 적절한 전략은?`,
            choices: shuffle([
                { text: "협력형(collaborating) — 양측 의견을 통합해 win-win 해결책 모색", correct: true, effect: { hp: -2, rep: 22 }, log: "정답. 시간·신뢰 여건이 충족되면 협력형이 최선." },
                { text: "회피형(avoiding) — 갈등을 무시", effect: { hp: -20, rep: -15 }, log: "근본 해결이 안 되고 환자 안전 위협." },
                { text: "강요형(forcing) — 본인 입장 관철", effect: { hp: -22, rep: -18 }, log: "권력 사용은 관계 악화." },
                { text: "타협형(compromising) — 일부씩 양보", effect: { hp: -10, rep: -3 }, log: "차선책이나 협력형이 더 우수합니다." }
            ]) };
    }

    function generateNursingRecordQuestion() {
        return { baseId: "nursing_record", category: "간호관리학", part: "간호기록", emoji: "📝", title: "간호기록의 법적 요건",
            desc: `간호기록 작성 시 가장 적절한 방식은?`,
            choices: shuffle([
                { text: "발생 사실 + 객관적 사정 + 중재 + 환자 반응을 즉시·구체적으로 기록", correct: true, effect: { hp: -2, rep: 20 }, log: "정답. 법적 효력 있는 기록의 4요소입니다." },
                { text: "주관적 인상과 본인 해석 중심으로 작성", effect: { hp: -22, rep: -16 }, log: "법적 분쟁 시 불리합니다." },
                { text: "환자 비난·의료진 간 갈등 내용을 솔직히 기록", effect: { hp: -28, rep: -22 }, log: "감정적 표현은 법적 증거로 부적절." },
                { text: "근무 종료 후 일괄 정리", effect: { hp: -25, rep: -18 }, log: "사후 기록은 신뢰성·법적 효력 저하." }
            ]) };
    }

    function generateStaffingMixQuestion() {
        const cases = [
            { lvl: "Level 1 (안정)", who: "RN 1명 + NA 1명 / 8병상", wrong: ["RN 4명 / 2병상", "NA 단독 8병상", "무인 모니터링"] },
            { lvl: "Level 3 (중환자)", who: "RN 1명 / 2병상 (1:2)", wrong: ["RN 1명 / 8병상", "NA 단독", "RN 1명 / 12병상"] },
            { lvl: "Level 4 (인공호흡기)", who: "RN 1명 / 1병상 (1:1)", wrong: ["RN 1명 / 4병상", "NA 동반 가능", "RN 1명 / 2병상"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "staff_mix", category: "간호관리학", part: "환자분류·인력배치", emoji: "👥", title: "환자 분류 체계별 적정 인력",
            desc: `${c.lvl} 환자에게 권장되는 표준 인력 배치는?`,
            choices: shuffle([
                { text: c.who, correct: true, effect: { hp: -2, rep: 20 }, log: `정답. ${c.lvl} 의 표준 배치입니다.` },
                { text: wrongs[0], effect: { hp: -18, rep: -12 }, log: "환자 안전 위협 또는 자원 낭비." },
                { text: wrongs[1], effect: { hp: -18, rep: -12 }, log: "환자 안전 위협 또는 자원 낭비." },
                { text: wrongs[2], effect: { hp: -18, rep: -12 }, log: "환자 안전 위협 또는 자원 낭비." }
            ]) };
    }

    function generateCBTechniqueQuestion() {
        return { baseId: "cbt_technique", category: "정신간호학", part: "치료적 의사소통", emoji: "💭", title: "치료적 의사소통 기법",
            desc: `환자가 "제 인생은 망했어요" 라고 말한다. 가장 치료적인 반응은?`,
            choices: shuffle([
                { text: "\"인생이 망했다고 느끼시는군요. 무엇이 그렇게 느끼게 하나요?\" (반영 + 개방형 질문)", correct: true, effect: { hp: -2, rep: 22 }, log: "정답. 감정 인정 + 탐색은 치료적 의사소통의 핵심." },
                { text: "\"그런 말 마세요, 살다보면 좋은 일도 있어요\" (잘못된 안심)", effect: { hp: -22, rep: -16 }, log: "감정을 부정하는 반응입니다." },
                { text: "\"왜요? 무슨 일이 있었는데요?\" (탐문)", effect: { hp: -15, rep: -8 }, log: "탐문은 방어적 반응 유발 가능." },
                { text: "\"이미 인생 망친 사람 많아요\" (일반화)", effect: { hp: -25, rep: -20 }, log: "환자 경험을 폄하합니다." }
            ]) };
    }

    function generateAddictionQuestion() {
        return { baseId: "addiction_withdrawal", category: "정신간호학", part: "물질 사용 장애", emoji: "🍷", title: "알코올 금단 증상",
            desc: `알코올 의존 환자가 입원 48시간 후 진전·환시·BP 168/100·심한 발한·혼란 호소. 의심해야 할 것은?`,
            choices: shuffle([
                { text: "진전섬망(Delirium Tremens) — 즉시 보고·벤조디아제핀·티아민·수액", correct: true, effect: { hp: -5, rep: 28 }, log: "정답. DT 는 치명적. 즉시 다학제 처치 필요." },
                { text: "단순 금연 금단 — 관찰만", effect: { hp: -32, rep: -25 }, log: "DT 는 사망률 5~25% 의 응급입니다." },
                { text: "조현병 발병", effect: { hp: -25, rep: -18 }, log: "병력·시점·증상이 DT 에 부합합니다." },
                { text: "수면 부족으로 인한 일시적 환각", effect: { hp: -28, rep: -22 }, log: "DT 인지 못하면 사망 위험." }
            ]) };
    }

    function generateSchoolHealthQuestion() {
        return { baseId: "school_health", category: "지역사회간호학", part: "학교보건", emoji: "🏫", title: "학교 보건실 응급 처치",
            desc: `초등학교 운동장에서 4학년 학생이 아나필락시스로 추정되는 호흡곤란·두드러기를 호소. 보건교사로서 우선 조치는?`,
            choices: shuffle([
                { text: "119 호출 + 학교 보유 EpiPen 즉시 IM + 부모 연락 + 의식·호흡 관찰", correct: true, effect: { hp: -3, rep: 28 }, log: "정답. 학교 보건실 응급 처치의 표준." },
                { text: "보건실로 옮기고 부모 도착 대기", effect: { hp: -32, rep: -25 }, log: "이송 + 지연은 치명적." },
                { text: "물을 마시게 하고 누워서 안정", effect: { hp: -28, rep: -22 }, log: "흡인 위험 + EpiPen 필요." },
                { text: "교장 결재 후 119 신고", effect: { hp: -30, rep: -25 }, log: "응급 신고는 즉시 — 결재 불필요." }
            ]) };
    }

    function generateHomeCareQuestion() {
        return { baseId: "home_care_indications", category: "지역사회간호학", part: "가정간호", emoji: "🏠", title: "가정간호 적응증",
            desc: `다음 중 한국 가정간호 사업 대상자로 가장 적절한 경우는?`,
            choices: shuffle([
                { text: "장기 욕창 관리·정맥 항생제 투여가 필요한 거동 불편 환자", correct: true, effect: { hp: -2, rep: 20 }, log: "정답. 의료적 처치 + 거동 제한이 핵심 적응증." },
                { text: "단순 감기로 외래 진료 어려운 학생", effect: { hp: -18, rep: -12 }, log: "외래 가능 환자는 적응증 아님." },
                { text: "특별한 의료 필요 없는 노인 말동무 요청", effect: { hp: -20, rep: -15 }, log: "복지 영역. 가정간호 사업 아님." },
                { text: "응급 처치가 필요한 외상 환자", effect: { hp: -22, rep: -16 }, log: "응급은 119 + 응급실." }
            ]) };
    }

    function generateFHRDecelQuestion() {
        const cases = [
            { type: "조기 감속(Early deceleration)", cause: "태아 두부 압박 — 정상 변이, 관찰만", wrong: ["즉시 응급 제왕절개", "옥시토신 증량", "태아 사망 의심"] },
            { type: "변이성 감속(Variable deceleration)", cause: "제대 압박 — 산모 체위 변경·산소·검사", wrong: ["관찰만 진행", "옥시토신 증량", "마그네슘 황산염 투여"] },
            { type: "지연성 감속(Late deceleration)", cause: "태반 기능 부전 — 응급 — 좌측위·산소·옥시토신 중단·의사 보고", wrong: ["정상 변이 — 관찰", "옥시토신 증량", "환자에게 식사 권유"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "fhr_decel", category: "모성간호학", part: "태아심음 모니터링", emoji: "📈", title: "태아심박수 감속 분류",
            desc: `분만 모니터링 중 ${c.type} 가 관찰된다. 적절한 간호 중재는?`,
            choices: shuffle([
                { text: c.cause, correct: true, effect: { hp: -3, rep: 22 }, log: `정답. ${c.type} 의 표준 중재입니다.` },
                { text: wrongs[0], effect: { hp: -22, rep: -16 }, log: "적절하지 않은 중재입니다." },
                { text: wrongs[1], effect: { hp: -22, rep: -16 }, log: "적절하지 않은 중재입니다." },
                { text: wrongs[2], effect: { hp: -22, rep: -16 }, log: "적절하지 않은 중재입니다." }
            ]) };
    }

    function generatePedsRespQuestion() {
        const cases = [
            { dz: "급성 후두기관기관지염(Croup)", finding: "쉰 목소리·견구지통(barking cough)·흡기성 천명", action: "찬 안개·습한 공기·dexamethasone·필요시 nebulized epinephrine" },
            { dz: "급성 후두개염(Epiglottitis)", finding: "고열·침흘림·tripod 자세·증상 급격", action: "환아 자극 최소화·즉시 기도 확보팀 호출·검진 자제" },
            { dz: "모세기관지염(Bronchiolitis)", finding: "RSV·천명음·무호흡·1세 미만", action: "산소·수액·체위·지지적 — 항생제·기관지확장제 일반 권고 아님" },
        ];
        const c = pick(cases);
        const wrongs = shuffle(cases.filter(x => x.dz !== c.dz).map(x => x.action));
        return { baseId: "peds_resp", category: "아동간호학", part: "호흡기 응급", emoji: "👶", title: "소아 호흡기 응급 감별",
            desc: `${c.finding} 양상의 ${c.dz} 환아에게 가장 적절한 중재는?`,
            choices: shuffle([
                { text: c.action, correct: true, effect: { hp: -3, rep: 22 }, log: `정답. ${c.dz} 의 표준 중재입니다.` },
                { text: wrongs[0], effect: { hp: -22, rep: -16 }, log: "다른 질환의 중재입니다." },
                { text: wrongs[1], effect: { hp: -22, rep: -16 }, log: "다른 질환의 중재입니다." },
                { text: "항생제 광범위 + 즉시 퇴원", effect: { hp: -25, rep: -18 }, log: "원인 진단 없이 부적절." }
            ]) };
    }

    const allGenerators = [
        generateDopamineQuestion, generateSepsisQuestion, generatePsychQuestion,
        generateElectrolyteQuestion, generatePedsPriorityQuestion, generateOBQuestion,
        generateManagementQuestion, generateRespQuestion, generateSafetyPriorityQuestion,
        generateTransfusionQuestion, generateIICPQuestion, generateFHRQuestion,
        generateLawQuestion, generateMIQuestion, generateABGAQuestion, generateTriageQuestion,
        generatePositionQuestion, generateVaccineQuestion, generateNaegeleQuestion,
        generateApgarQuestion, generateBurnQuestion, generateShockQuestion,
        generateDiabeticQuestion, generateAsepticQuestion,
        generateECGQuestion, generateLabValueQuestion, generateCPRQuestion,
        generateInsulinQuestion, generatePainAssessmentQuestion,
        // 신규 (기본간호학 5)
        generateOxygenTherapyQuestion, generateUrinaryCathQuestion, generateNGTubeQuestion,
        generateWoundCareQuestion, generateRestraintQuestion,
        // 신규 (모성간호학 4)
        generateLochiaQuestion, generatePreEclampsiaQuestion, generateBreastfeedingQuestion,
        generateContractionQuestion,
        // 신규 (아동간호학 4)
        generateGrowthQuestion, generateFebrileSeizureQuestion, generateDehydrationQuestion,
        generatePedsDoseQuestion,
        // 신규 (정신간호학 5)
        generateSuicideRiskQuestion, generateSchizophreniaQuestion, generateAntipsychoticQuestion,
        generateBipolarQuestion, generateMSEQuestion,
        // 신규 (지역사회간호학 5)
        generateInfectionDiseaseQuestion, generateImmunizationScheduleQuestion,
        generateMaternalChildQuestion, generateOccupationalHealthQuestion, generateChronicDiseaseQuestion,
        // 신규 (간호관리학 4)
        generateLeadershipQuestion, generateDelegationQuestion, generatePatientSafetyQuestion,
        generateQIQuestion,
        // 신규 (보건의약관계법규 5)
        generateMedicalLawQuestion, generateNarcoticLawQuestion, generateMentalHealthLawQuestion,
        generateBloodLawQuestion, generateInfectionLawGradeQuestion,
        // 신규 (성인간호학 5)
        generateAnticoagulantQuestion, generateChestTubeQuestion, generateRenalFailureQuestion,
        generateStrokeQuestion, generateThyroidQuestion,
        // 비율 보정 (간호관리학 +3, 정신 +2, 지역 +2, 모성 +1, 아동 +1)
        generateConflictMgmtQuestion, generateNursingRecordQuestion, generateStaffingMixQuestion,
        generateCBTechniqueQuestion, generateAddictionQuestion,
        generateSchoolHealthQuestion, generateHomeCareQuestion,
        generateFHRDecelQuestion, generatePedsRespQuestion,
    ];

    return {
        allGenerators,
        generateABGAQuestion, generateTriageQuestion, generatePositionQuestion,
        generateVaccineQuestion, generateTransfusionQuestion, generateIICPQuestion,
        generateFHRQuestion, generateLawQuestion, generateDopamineQuestion,
        generateSepsisQuestion, generatePsychQuestion, generateElectrolyteQuestion,
        generatePedsPriorityQuestion, generateOBQuestion, generateManagementQuestion,
        generateRespQuestion, generateSafetyPriorityQuestion, generateMIQuestion,
        generateNaegeleQuestion, generateApgarQuestion, generateBurnQuestion,
        generateShockQuestion, generateDiabeticQuestion, generateAsepticQuestion,
        generateECGQuestion, generateLabValueQuestion, generateCPRQuestion,
        generateInsulinQuestion, generatePainAssessmentQuestion,
        // v1.1 신규 (37개)
        generateOxygenTherapyQuestion, generateUrinaryCathQuestion, generateNGTubeQuestion,
        generateWoundCareQuestion, generateRestraintQuestion,
        generateLochiaQuestion, generatePreEclampsiaQuestion, generateBreastfeedingQuestion,
        generateContractionQuestion,
        generateGrowthQuestion, generateFebrileSeizureQuestion, generateDehydrationQuestion,
        generatePedsDoseQuestion,
        generateSuicideRiskQuestion, generateSchizophreniaQuestion, generateAntipsychoticQuestion,
        generateBipolarQuestion, generateMSEQuestion,
        generateInfectionDiseaseQuestion, generateImmunizationScheduleQuestion,
        generateMaternalChildQuestion, generateOccupationalHealthQuestion, generateChronicDiseaseQuestion,
        generateLeadershipQuestion, generateDelegationQuestion, generatePatientSafetyQuestion,
        generateQIQuestion,
        generateMedicalLawQuestion, generateNarcoticLawQuestion, generateMentalHealthLawQuestion,
        generateBloodLawQuestion, generateInfectionLawGradeQuestion,
        generateAnticoagulantQuestion, generateChestTubeQuestion, generateRenalFailureQuestion,
        generateStrokeQuestion, generateThyroidQuestion,
        generateConflictMgmtQuestion, generateNursingRecordQuestion, generateStaffingMixQuestion,
        generateCBTechniqueQuestion, generateAddictionQuestion,
        generateSchoolHealthQuestion, generateHomeCareQuestion,
        generateFHRDecelQuestion, generatePedsRespQuestion,
    };
});
