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
            { name: "심실빈맥(맥박 없음)", correct: "즉시 제세동을 시행한다", log: "정답. 무맥성 VT는 VFib과 같이 처치합니다." },
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
        generateInsulinQuestion, generatePainAssessmentQuestion
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
    };
});
