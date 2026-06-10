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
        const cases = [
            { goal: "관장(Enema) 시 용액 주입", correct: "좌측 심스위(Sims')", image: "position:sims",
              wrongs: [{t:"파울러씨위",l:"호흡곤란 시 취하는 체위입니다."},{t:"트렌델렌버그위",l:"쇼크 시 다리 거상 체위입니다."},{t:"배횡와위",l:"여성 인공도뇨 시 취하는 체위입니다."}],
              logCorrect: "정답. 구불결장으로 용액이 잘 흘러갑니다." },
            { goal: "쇼크 환자 정맥 환류 증진", correct: "트렌델렌버그위 (Trendelenburg)", image: "position:trendelenburg",
              wrongs: [{t:"파울러씨위",l:"머리를 올리면 정맥 환류가 감소합니다."},{t:"좌측 심스위",l:"관장 시 체위입니다."},{t:"배횡와위",l:"산부인과 검진 체위입니다."}],
              logCorrect: "정답. 머리를 낮춰 정맥 환류를 늘립니다." },
            { goal: "호흡곤란 환자 호흡 보조", correct: "Fowler's (반좌위 45~60°)", image: "position:fowler",
              wrongs: [{t:"앙와위",l:"호흡곤란을 악화시킵니다."},{t:"트렌델렌버그",l:"호흡 부담을 늘립니다."},{t:"심스위",l:"관장 체위입니다."}],
              logCorrect: "정답. 횡격막 압박이 줄어 호흡이 편해집니다." },
            { goal: "ARDS 환자 산소화 개선", correct: "Prone (복와위)", image: "position:prone",
              wrongs: [{t:"앙와위",l:"ARDS 산소화에 불리합니다."},{t:"Fowler's",l:"폐 후방 환기 개선에 부족."},{t:"심스위",l:"관장 체위입니다."}],
              logCorrect: "정답. 복와위는 ARDS 의 표준 자세입니다." },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrongs);
        return { baseId: "position", category: "기본간호학", part: "체위", emoji: "🛏️", title: "목적에 맞는 체위",
            image: c.image,
            desc: `${c.goal} 을 위해 가장 적절한 체위는?`,
            choices: shuffle([
                { text: c.correct, correct: true, effect: { hp: -2, rep: 18 }, log: c.logCorrect },
                { text: wrongs[0].t, effect: { hp: -15, rep: -10 }, log: wrongs[0].l },
                { text: wrongs[1].t, effect: { hp: -15, rep: -10 }, log: wrongs[1].l },
                { text: wrongs[2].t, effect: { hp: -15, rep: -10 }, log: wrongs[2].l }
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
            desc: "환자가 혈압 80/50, 체온 39도, 의식 저하를 보일 때 1-hour 번들의 올바른 순서는?",
            choices: shuffle([
                { text: "혈액배양 2set 채취 → 광범위 항생제 → 30mL/kg 결정질 수액 → 젖산 재측정", correct: true, effect: { hp: -2, rep: 15 }, log: "정답. 배양 후 항생제, 동시에 수액·젖산 — SCCM 1-hour 번들." },
                { text: "광범위 항생제부터 즉시 투여하고 안정되면 혈액배양을 채취한다", effect: { hp: -22, rep: -14 }, log: "항생제 후 배양은 원인균 검출률을 떨어뜨립니다." },
                { text: "수액 부하 전 노르에피네프린 승압제부터 시작해 혈압을 올린다", effect: { hp: -22, rep: -14 }, log: "승압제는 충분한 수액 후에도 MAP<65일 때입니다." },
                { text: "해열제로 체온을 정상화한 뒤 배양과 항생제를 순차 진행한다", effect: { hp: -25, rep: -16 }, log: "해열은 우선순위가 아니며 관류·배양·항생제가 먼저." }
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
                { text: "기도 개방 확인 + 호흡 사정 + 산소화 준비(보호자 무릎에서 비강 산소)", correct: true, effect: { hp: -2, rep: 15 }, log: "정답. 소아는 호흡 악화가 가장 빠름 — 기도·산소가 1순위." },
                { text: "비익호흡은 영아 정상 변이일 수 있어 SpO2 측정 후 결정한다", effect: { hp: -22, rep: -12 }, log: "비익호흡+함몰은 호흡곤란 신호 — 즉시 기도·산소." },
                { text: "기관지확장제 분무를 먼저 시행해 흉벽 함몰을 줄인다", effect: { hp: -20, rep: -10 }, log: "원인 미확인 — 기도·산소화가 분무보다 먼저." },
                { text: "발열 동반 가능성이 있어 해열제부터 좌약으로 투여한다", effect: { hp: -22, rep: -12 }, log: "호흡곤란이 우선 — 해열은 후순위." }
            ]) };
    }

    function generateOBQuestion() {
        return { baseId: "ob", category: "모성간호학", part: "산후출혈", emoji: "🩸", title: "자궁이완성 출혈 중재",
            desc: "분만 1시간 뒤 산모의 패드가 다 젖고 자궁저부가 물렁하게 만져질 때 우선 중재는?",
            choices: shuffle([
                { text: "자궁저부 마사지를 즉시 시행하며 옥시토신 투여·출혈량 사정을 병행한다", correct: true, effect: { hp: -2, rep: 15 }, log: "정답. 자궁이완성 출혈 1차는 마사지 + 자궁수축제." },
                { text: "방광 충만이 원인일 수 있으니 도뇨로 방광을 비운 뒤 재평가한다", effect: { hp: -18, rep: -10 }, log: "방광 확인도 필요하나 물렁한 자궁엔 마사지·수축제가 먼저." },
                { text: "트렌델렌버그 체위로 눕히고 수액 속도만 빠르게 올린다", effect: { hp: -20, rep: -12 }, log: "수액·체위는 보조 — 출혈 원인(이완) 교정이 우선." },
                { text: "메덜진(메틸어고노빈)을 혈압 확인 없이 즉시 정맥 주사한다", effect: { hp: -22, rep: -14 }, log: "어고노빈은 고혈압 금기 — 혈압 확인 없는 IV는 위험." }
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
                { text: "기도 개방 확인 + 반좌위 + 고농도 산소 투여 후 의사 보고·원인 사정", correct: true, effect: { hp: -2, rep: 15 }, log: "정답. ABC 확보 + 산소화가 최우선, 동시에 원인 평가." },
                { text: "비강 캐뉼라 2L 유지하며 ABGA 결과가 나올 때까지 관찰한다", effect: { hp: -25, rep: -16 }, log: "85% 청색증엔 2L 부족 — 고농도 산소 + 즉시 평가." },
                { text: "기관지확장제 분무(네뷸라이저)부터 시행해 기도를 넓힌다", effect: { hp: -20, rep: -12 }, log: "원인 미확인 — 산소화·기도 확보가 분무보다 먼저." },
                { text: "앙와위로 눕힌 뒤 구강 흡인을 먼저 시행한다", effect: { hp: -22, rep: -14 }, log: "앙와위는 호흡을 악화 — 반좌위가 표준." }
            ]) };
    }

    function generateSafetyPriorityQuestion() {
        return { baseId: "priority", category: "성인간호학", part: "우선순위", emoji: "🚑", title: "응급 환자 분류",
            desc: "응급실에 4명이 동시 도착. 모두 처치가 필요하지만 가장 먼저 봐야 할 환자는?",
            choices: shuffle([
                { text: "흉통 + 식은땀 + 의식 흐려짐 (BP 88/54) — 활력징후 불안정", correct: true, effect: { hp: -2, rep: 15 }, log: "정답. ABC·순환 위협 — 즉각적 생명 위협이 1순위(ECG 우선)." },
                { text: "천식 환자 SpO2 93% + 말은 가능 + 흡입제 사용 후 호전 중", effect: { hp: -15, rep: -8 }, log: "B 문제지만 호전 중·SpO2 유지 — 흉통 쇼크보다 후순위." },
                { text: "복통 NRS 8 + 발열 38.2 + 활력징후 안정", effect: { hp: -15, rep: -8 }, log: "긴급하나 활력 안정 — 순환 불안정 환자가 먼저." },
                { text: "다리 열상 출혈 + 직접 압박으로 지혈됨 + 활력징후 정상", effect: { hp: -12, rep: -6 }, log: "지혈된 출혈은 안정 — 후순위." }
            ]) };
    }

    function generateMIQuestion() {
        return { baseId: "mi", category: "성인간호학", part: "심혈관계", emoji: "💔", title: "급성 심근경색(MI)",
            desc: "니트로글리세린(NTG) 설하 투여에도 가라앉지 않는 쥐어짜는 듯한 흉통 환자 중재는?",
            choices: shuffle([
                { text: "12-Lead ECG + 산소 + 아스피린 저작 + 처방된 모르핀 + 심도자실 콜(재관류)", correct: true, effect: { hp: -2, rep: 15 }, log: "정답. 지속 흉통은 재관류(PCI)가 핵심 — MONA + cath lab." },
                { text: "NTG를 5분 간격 3회까지 반복 투여하며 흉통 완화를 기다린다", effect: { hp: -22, rep: -14 }, log: "NTG 불응 흉통은 재관류 대상 — NTG 반복만으론 부족." },
                { text: "통증 조절을 위해 모르핀을 먼저 정맥 투여하고 경과를 본다", effect: { hp: -20, rep: -12 }, log: "진통 전 ECG·아스피린·재관류 준비가 우선." },
                { text: "활력징후 안정될 때까지 침상 안정시키고 다음 회진에 보고한다", effect: { hp: -28, rep: -18 }, log: "STEMI는 시간이 곧 심근 — 즉시 재관류 필요." }
            ]) };
    }

    function generateNaegeleQuestion() {
        const year = 2024;
        const m = rand(1, 12);
        const daysInMonth = new Date(year, m, 0).getDate();
        const d = rand(1, daysInMonth);
        // 네겔법(공식): 월 -3, 일 +7 (+1년). 학생이 배운 공식과 정답이 일치하도록 280일 대신 공식으로 계산.
        let edM = m - 3, edY = year + 1, edD = d + 7;
        if (edM <= 0) edM += 12;
        const dim = new Date(edY, edM, 0).getDate();
        if (edD > dim) { edD -= dim; edM += 1; if (edM > 12) { edM = 1; edY += 1; } }
        const edd = new Date(edY, edM - 1, edD);
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
            image: "rule-of-nines",
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
            { name: "심실세동(VFib)", image: "ecg:vfib", correct: "즉시 제세동(defibrillation)을 시행한다", log: "정답. VFib은 충격을 줘야 하는 리듬입니다." },
            { name: "무수축(Asystole)", image: "ecg:asystole", correct: "CPR을 시작하고 에피네프린을 투여한다", log: "정답. Asystole은 제세동 금기, CPR과 약물이 핵심입니다." },
            { name: "심실빈맥(맥박 없음)", image: "ecg:vtach", correct: "즉시 제세동(defibrillation)을 시행한다", log: "정답. 무맥성 VT는 VFib과 같이 처치합니다." },
            { name: "심방세동(AFib, 안정형)", image: "ecg:afib", correct: "심박수 조절과 항응고요법을 준비한다", log: "정답. 혈전 예방과 심박수 조절이 핵심입니다." },
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
            image: r.image,
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
            { stageDigit: 1, stage: "1단계 (Stage I) 욕창", action: "체위변경 강화 + 압력 분산 매트리스", wrong: ["습윤 드레싱만 적용", "데브리망(절제)", "항생제 정맥주입"] },
            { stageDigit: 2, stage: "2단계 (Stage II) 욕창", action: "하이드로콜로이드 또는 폼 드레싱", wrong: ["거즈로 압박", "건조 상태 유지", "삼출물 무관 거즈 매일 교환"] },
            { stageDigit: 3, stage: "3단계 (Stage III) 욕창", action: "습윤 드레싱 + 정기 세척 + 영양 평가", wrong: ["건조 거즈 유지", "냉찜질", "심부 마사지"] },
            { stageDigit: 4, stage: "4단계 (Stage IV) 감염 의심 욕창", action: "상처 배양 + 의사 보고 + 적절한 항생제 + 외과 협진 고려", wrong: ["폐쇄성 드레싱 적용", "그대로 관찰", "심부 마사지"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "wound", category: "기본간호학", part: "상처 간호", emoji: "🩹", title: "욕창 단계별 중재",
            image: `ulcer:${c.stageDigit}`,
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
            { key: "early", type: "조기 감속(Early deceleration)", cause: "태아 두부 압박 — 정상 변이, 관찰만", wrong: ["즉시 응급 제왕절개", "옥시토신 증량", "태아 사망 의심"] },
            { key: "variable", type: "변이성 감속(Variable deceleration)", cause: "제대 압박 — 산모 체위 변경·산소·검사", wrong: ["관찰만 진행", "옥시토신 증량", "마그네슘 황산염 투여"] },
            { key: "late", type: "지연성 감속(Late deceleration)", cause: "태반 기능 부전 — 응급 — 좌측위·산소·옥시토신 중단·의사 보고", wrong: ["정상 변이 — 관찰", "옥시토신 증량", "환자에게 식사 권유"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "fhr_decel", category: "모성간호학", part: "태아심음 모니터링", emoji: "📈", title: "태아심박수 감속 분류",
            image: `fhr:${c.key}`,
            desc: `분만 모니터링 중 ${c.type} 가 관찰된다. 적절한 간호 중재는?`,
            choices: shuffle([
                { text: c.cause, correct: true, effect: { hp: -3, rep: 22 }, log: `정답. ${c.type} 의 표준 중재입니다.` },
                { text: wrongs[0], effect: { hp: -22, rep: -16 }, log: "적절하지 않은 중재입니다." },
                { text: wrongs[1], effect: { hp: -22, rep: -16 }, log: "적절하지 않은 중재입니다." },
                { text: wrongs[2], effect: { hp: -22, rep: -16 }, log: "적절하지 않은 중재입니다." }
            ]) };
    }

    // ── 이미지 기반 식별/사정 문제 (v1.2 — SVG 시각자료) ────────────────
    function generateGCSAssessQuestion() {
        const cases = [
            { code: "E4V5M6", total: 15, interp: "정상 의식", action: "정상 — 일반 모니터링 진행", wrong: ["즉시 기관삽관 준비", "응급 두부 CT 의뢰", "Mannitol IV 즉시 투여"] },
            { code: "E3V4M5", total: 12, interp: "경도 의식 저하 (mild)", action: "신경학적 사정 강화 + 1시간 간격 GCS 재평가", wrong: ["정상이므로 관찰 불요", "즉시 기관삽관", "통증 자극 중단"] },
            { code: "E2V2M4", total: 8, interp: "중등도 의식 저하", action: "신경외과 콜 + 기도 보호 평가 + 응급 CT", wrong: ["관찰만 진행", "환자 깨우기 위해 큰소리·자극", "수면제 추가"] },
            { code: "E1V1M3", total: 5, interp: "중증 의식 저하 (혼수)", action: "즉시 기관삽관 + ICU 이송 + 응급 영상", wrong: ["관찰 + 수면 권유", "경구 식이 시도", "물리 자극으로 깨우기"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "gcs", category: "성인간호학", part: "신경학적 사정", emoji: "🧠", title: "GCS 점수 해석 및 중재",
            image: `gcs:${c.code}`,
            desc: `위 GCS 점수표 (${c.code} = ${c.total}점, "${c.interp}") 환자의 우선 중재는?`,
            choices: shuffle([
                { text: c.action, correct: true, effect: { hp: -3, rep: 22 }, log: `정답. GCS ${c.total}점 (${c.interp}) 의 표준 중재입니다.` },
                { text: wrongs[0], effect: { hp: -25, rep: -18 }, log: "GCS 해석에 적합하지 않은 중재입니다." },
                { text: wrongs[1], effect: { hp: -25, rep: -18 }, log: "GCS 해석에 적합하지 않은 중재입니다." },
                { text: wrongs[2], effect: { hp: -25, rep: -18 }, log: "GCS 해석에 적합하지 않은 중재입니다." }
            ]) };
    }

    function generateAEDPadQuestion() {
        const cases = [
            { who: "성인 (8세 이상)", img: "aed:adult", correct: "우상 흉골 (쇄골 아래) + 좌측 중액와선 (앞-옆 anterolateral)", wrong: ["양쪽 어깨 위", "복부 정중앙 양측", "양 측면 옆구리"] },
            { who: "소아 (1~8세)", img: "aed:child", correct: "앞가슴 + 등 (anterior-posterior 배치) 또는 소아용 패드", wrong: ["성인과 동일 위치 + 성인용 패드", "이마와 가슴", "양 발등"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "aed", category: "성인간호학", part: "응급 제세동", emoji: "⚡", title: "AED 패드 적용 위치",
            image: c.img,
            desc: `${c.who} 환자에게 AED 패드를 적용할 때 올바른 위치는?`,
            choices: shuffle([
                { text: c.correct, correct: true, effect: { hp: -2, rep: 22 }, log: `정답. ${c.who} 의 표준 AED 패드 위치입니다.` },
                { text: wrongs[0], effect: { hp: -28, rep: -22 }, log: "AED 효과 없음 + 환자 위해 가능성." },
                { text: wrongs[1], effect: { hp: -25, rep: -20 }, log: "AED 효과 없음." },
                { text: wrongs[2], effect: { hp: -28, rep: -22 }, log: "AED 효과 없음." }
            ]) };
    }

    function generateFundalHeightQuestion() {
        const cases = [
            { weeks: 12, finding: "치골결합 (pubis) 수준", wrongs: ["배꼽 (umbilicus) 수준", "검상돌기 아래", "치골과 배꼽 사이"] },
            { weeks: 20, finding: "배꼽 (umbilicus) 수준", wrongs: ["치골결합 수준", "검상돌기 수준", "검상돌기 아래"] },
            { weeks: 36, finding: "검상돌기 (xiphoid) 근처", wrongs: ["배꼽 아래 4cm", "치골결합 수준", "배꼽 수준"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrongs);
        return { baseId: "fundal", category: "모성간호학", part: "산전 사정", emoji: "🤰", title: "임신 주수별 자궁저부 높이",
            image: `fundal:${c.weeks}`,
            desc: `임신 ${c.weeks}주의 정상 자궁저부(fundal height) 높이는?`,
            choices: shuffle([
                { text: c.finding, correct: true, effect: { hp: -2, rep: 20 }, log: `정답. 임신 ${c.weeks}주의 정상 자궁저부 위치입니다.` },
                { text: wrongs[0], effect: { hp: -18, rep: -12 }, log: "정상 자궁저부 위치가 아닙니다." },
                { text: wrongs[1], effect: { hp: -18, rep: -12 }, log: "정상 자궁저부 위치가 아닙니다." },
                { text: wrongs[2], effect: { hp: -18, rep: -12 }, log: "정상 자궁저부 위치가 아닙니다." }
            ]) };
    }

    function generateApgarVisualQuestion() {
        const cases = [
            { scores: { appearance: 2, pulse: 2, grimace: 2, activity: 2, respiration: 2 }, total: 10, action: "정상 신생아 — 모-아 동침 + 모유수유 시작", wrong: ["즉시 인공호흡 시작", "산소 80% 적용 + 흡인", "복와위로 즉시 옮기기"] },
            { scores: { appearance: 1, pulse: 2, grimace: 1, activity: 2, respiration: 2 }, total: 8, action: "정상 범위 — 수건으로 닦고 모니터링 + 5분 재평가", wrong: ["즉시 NICU 호출", "기관삽관 준비", "포도당 IV bolus"] },
            { scores: { appearance: 1, pulse: 1, grimace: 1, activity: 1, respiration: 1 }, total: 5, action: "신생아 소생 시작 — 자극·산소·필요시 양압환기", wrong: ["정상 — 산모에게 안기기", "30분 후 재평가", "단순 흡인만 시행"] },
            { scores: { appearance: 0, pulse: 0, grimace: 0, activity: 0, respiration: 0 }, total: 0, action: "즉시 신생아 소생술 + 응급 의료팀 호출 + 양압환기·흉부압박", wrong: ["관찰만 진행", "단순 자극 시도", "체온 보온만 시행"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        const scoreKey = Object.entries(c.scores).map(([k, v]) => `${k}=${v}`).join(",");
        return { baseId: "apgar_visual", category: "아동간호학", part: "신생아 사정", emoji: "👶", title: "Apgar 점수 해석 및 중재",
            image: `apgar:${scoreKey}`,
            desc: `위 Apgar 점수표 (총 ${c.total}점) 신생아의 우선 중재는?`,
            choices: shuffle([
                { text: c.action, correct: true, effect: { hp: -3, rep: 22 }, log: `정답. Apgar ${c.total}점 의 표준 중재입니다.` },
                { text: wrongs[0], effect: { hp: -25, rep: -18 }, log: "Apgar 해석에 맞지 않습니다." },
                { text: wrongs[1], effect: { hp: -25, rep: -18 }, log: "Apgar 해석에 맞지 않습니다." },
                { text: wrongs[2], effect: { hp: -25, rep: -18 }, log: "Apgar 해석에 맞지 않습니다." }
            ]) };
    }

    function generateAuscultationQuestion() {
        const cases = [
            { key: "wheeze-lower", finding: "양측 하부에서 호기성 wheezing", interp: "급성 천식 발작", action: "산소 + 단시간작용 β2 작용제(SABA) 흡입 + 의사 보고", wrong: ["관찰만 진행", "베타차단제 IV 투여", "히스타민 점안"] },
            { key: "crackle-lower", finding: "양측 하부에서 흡기말 crackle (rales)", interp: "폐부종 또는 폐렴", action: "산소 + 침대 머리 거상 + 의사 보고 + 이뇨제 처방 확인", wrong: ["천명음으로 보고 SABA만 적용", "관찰만 진행", "흡인기로 강제 흡인"] },
            { key: "stridor-upper", finding: "상부 기도에서 흡기성 stridor", interp: "후두부종·기도 폐쇄 응급", action: "즉시 응급 콜 + 기도 확보 준비 + Epinephrine nebulizer 고려", wrong: ["관찰만 진행", "안정제 IV 투여", "복와위로 자세 변경"] },
            { key: "normal", finding: "양측 청정음 (clear)", interp: "정상 호흡음", action: "정상 — 추가 평가 불필요", wrong: ["즉시 기관삽관", "광범위 항생제 시작", "이뇨제 IV 투여"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "ausc", category: "성인간호학", part: "호흡 사정", emoji: "🩺", title: "흉부 청진 결과 해석",
            image: `ausc:${c.key}`,
            desc: `청진 결과: ${c.finding} (${c.interp}). 우선 중재는?`,
            choices: shuffle([
                { text: c.action, correct: true, effect: { hp: -3, rep: 22 }, log: `정답. ${c.interp} 의 표준 중재입니다.` },
                { text: wrongs[0], effect: { hp: -25, rep: -18 }, log: "청진 해석에 맞지 않습니다." },
                { text: wrongs[1], effect: { hp: -25, rep: -18 }, log: "청진 해석에 맞지 않습니다." },
                { text: wrongs[2], effect: { hp: -25, rep: -18 }, log: "청진 해석에 맞지 않습니다." }
            ]) };
    }

    function generateKramerJaundiceQuestion() {
        const cases = [
            { zone: 1, biliRange: "<6 mg/dL", action: "정상 범위 — 모유수유 강화 + 24시간 후 재평가", wrong: ["즉시 광선치료(phototherapy) 시작", "교환수혈 준비", "수액 IV bolus 시행"] },
            { zone: 3, biliRange: "약 9~12 mg/dL", action: "혈청 빌리루빈 검사 + 광선치료 적응 여부 평가 + 다음 평가 예약", wrong: ["정상이므로 무관찰", "교환수혈 즉시 준비", "환아 모유수유 중단"] },
            { zone: 5, biliRange: ">15 mg/dL", action: "응급 — 즉시 광선치료 시작 + 빌리루빈 검사 + 교환수혈 가능성 평가", wrong: ["관찰만 진행", "햇볕에 직접 노출", "수액 제한"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "kramer", category: "아동간호학", part: "신생아 황달", emoji: "👶", title: "신생아 황달 Zone 사정",
            image: `kramer:${c.zone}`,
            desc: `Kramer's zone ${c.zone} (${c.biliRange}) 의 신생아 중재는?`,
            choices: shuffle([
                { text: c.action, correct: true, effect: { hp: -3, rep: 22 }, log: `정답. Zone ${c.zone} 의 표준 중재입니다.` },
                { text: wrongs[0], effect: { hp: -25, rep: -18 }, log: "Zone 해석에 맞지 않는 중재입니다." },
                { text: wrongs[1], effect: { hp: -25, rep: -18 }, log: "Zone 해석에 맞지 않는 중재입니다." },
                { text: wrongs[2], effect: { hp: -25, rep: -18 }, log: "Zone 해석에 맞지 않는 중재입니다." }
            ]) };
    }

    // ── v1.2 다양성 라운드 (12 generator — 응급/노인/약물/검사/윤리/다문화) ──

    function generateHospicePainQuestion() {
        return { baseId: "hospice_pain", category: "성인간호학", part: "완화의료", emoji: "🕊️", title: "말기 환자 통증 조절",
            desc: `폐암 4기 환자가 NRS 9 통증, 기존 oxycodone 표준 용량으로도 조절 안 됨. 가장 적절한 다음 단계는?`,
            choices: shuffle([
                { text: "WHO 3단계 사다리 따라 강한 마약성 진통제 (morphine) 적정 + 부작용 예방 (변비·진정)", correct: true, effect: { hp: -3, rep: 25 }, log: "정답. WHO Pain Ladder + 완화의료 표준." },
                { text: "마약 중독 우려로 일반 진통제로 교체", effect: { hp: -32, rep: -28 }, log: "말기 통증 조절은 환자 권리. 중독 우려는 부적절." },
                { text: "통증은 견디라며 위로만", effect: { hp: -38, rep: -32 }, log: "완화의료의 기본 원칙 위반." },
                { text: "비스테로이드성 항염증제(NSAIDs)만 추가", effect: { hp: -25, rep: -20 }, log: "강한 통증에 NSAIDs 단독 부적절." }
            ]) };
    }

    function generateDNRQuestion() {
        return { baseId: "dnr", category: "간호관리학", part: "윤리·법", emoji: "📜", title: "DNR(소생술 거부) 의향서 — 가족 갈등",
            desc: `의식 명료한 말기 환자가 DNR 작성을 원한다. 자녀가 "절대 안 됩니다" 라며 반대. 간호사의 적절한 대응은?`,
            choices: shuffle([
                { text: "환자 자기결정권 우선 + 가족 감정 인정 + 다학제 (의사·사회복지·윤리위) 협의 + 환자 의사 문서화", correct: true, effect: { hp: -2, rep: 28 }, log: "정답. 의식 명료한 환자의 사전돌봄계획(ACP)은 자기결정권이 우선." },
                { text: "가족 동의 없으면 DNR 작성 불가", effect: { hp: -28, rep: -22 }, log: "연명의료결정법상 환자 의사가 우선입니다." },
                { text: "환자 의사를 무시하고 가족 의견 따름", effect: { hp: -32, rep: -28 }, log: "환자 자기결정권 침해." },
                { text: "본인이 직접 결정하라며 회피", effect: { hp: -20, rep: -15 }, log: "간호사의 옹호자 역할 회피." }
            ]) };
    }

    function generateBeersCriteriaQuestion() {
        const cases = [
            { drug: "Diphenhydramine (1세대 항히스타민)", risk: "노인에서 항콜린성 부작용·낙상·섬망 위험 — 회피", wrong: ["1차 선택 약물 — 안전", "노인에서 신장 보호 효과", "혈압 강하 효과 좋음"] },
            { drug: "벤조디아제핀 장기 사용", risk: "노인 낙상·인지 저하·의존 위험 — 신중 사용", wrong: ["노인에게 우선 권장", "심혈관 보호 효과", "항생제 작용"] },
            { drug: "NSAIDs (장기 사용)", risk: "노인에서 GI 출혈·신부전·심혈관 위험 — 회피 또는 단기만", wrong: ["노인에게 무제한 안전", "심부전 1차 치료제", "당뇨 치료제"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "beers", category: "성인간호학", part: "노인 약물 안전", emoji: "👴", title: "Beers Criteria — 노인 부적절 약물",
            desc: `${c.drug} 의 노인 환자 사용 시 주의사항은?`,
            choices: shuffle([
                { text: c.risk, correct: true, effect: { hp: -2, rep: 22 }, log: `정답. AGS Beers Criteria (2023) 권고.` },
                { text: wrongs[0], effect: { hp: -22, rep: -16 }, log: "노인 약물 안전 원칙에 어긋납니다." },
                { text: wrongs[1], effect: { hp: -22, rep: -16 }, log: "노인 약물 안전 원칙에 어긋납니다." },
                { text: wrongs[2], effect: { hp: -22, rep: -16 }, log: "노인 약물 안전 원칙에 어긋납니다." }
            ]) };
    }

    function generateHypothermiaQuestion() {
        return { baseId: "hypothermia", category: "성인간호학", part: "체온 응급", emoji: "🥶", title: "중증 저체온증 응급 처치",
            desc: `등산객 의식 저하 + 떨림 없음 + 심부체온 28℃. 우선 중재는?`,
            choices: shuffle([
                { text: "조심스러운 이동(VFib 유발 방지) + 따뜻한 IV 수액 + 가온 담요 + 능동적 중심부 가온", correct: true, effect: { hp: -3, rep: 25 }, log: "정답. 중증 저체온증(<30℃)은 거친 이동 시 VFib 유발 위험." },
                { text: "즉시 뜨거운 물 샤워", effect: { hp: -32, rep: -25 }, log: "급격한 가온은 afterdrop + 부정맥 유발." },
                { text: "사지 마사지로 혈액순환 촉진", effect: { hp: -28, rep: -22 }, log: "사지 가온은 차가운 혈액을 중심부로 보내 위험." },
                { text: "알코올 음료로 체온 상승 유도", effect: { hp: -32, rep: -28 }, log: "알코올은 혈관 확장 + 체온 손실 가속." }
            ]) };
    }

    function generateHeatStrokeQuestion() {
        return { baseId: "heat_stroke", category: "성인간호학", part: "체온 응급", emoji: "🥵", title: "열사병 응급 처치",
            desc: `폭염 노동자 의식 저하 + 발한 없음 + 체온 41.5℃. 우선 중재는?`,
            choices: shuffle([
                { text: "즉시 시원한 환경 이동 + 능동적 냉각(찬물 + 얼음 마사지 + 강한 송풍) + IV 수액 + 심부체온 모니터", correct: true, effect: { hp: -3, rep: 25 }, log: "정답. 고전형 열사병은 능동적 냉각이 사망률을 좌우." },
                { text: "해열제(acetaminophen) 즉시 투여", effect: { hp: -30, rep: -22 }, log: "외인성 고열이라 해열제 무효." },
                { text: "환자 옷 덮어 체온 유지", effect: { hp: -38, rep: -32 }, log: "체온 상승 가속 — 절대 금기." },
                { text: "수분 섭취만 권유", effect: { hp: -32, rep: -25 }, log: "의식 저하 환자에 경구 위험 + 냉각이 우선." }
            ]) };
    }

    function generateAnaphylaxisDrugQuestion() {
        return { baseId: "anaphylaxis_drug", category: "성인간호학", part: "응급 약물", emoji: "💉", title: "아나필락시스 — 1차 약물",
            desc: `Penicillin 주입 5분 후 환자 호흡곤란 + 안면부종 + 두드러기 + BP 80/50. 1차 약물은?`,
            choices: shuffle([
                { text: "Epinephrine 0.3~0.5mg IM 외측 대퇴 — 즉시 (5~15분 간격 반복 가능)", correct: true, effect: { hp: -3, rep: 28 }, log: "정답. 아나필락시스 1차 약물은 IM epinephrine (WAO/AAAAI)." },
                { text: "Diphenhydramine 25mg IV 만으로 처치", effect: { hp: -32, rep: -28 }, log: "항히스타민은 보조 — 1차 절대 아님." },
                { text: "Methylprednisolone 125mg IV 만으로 처치", effect: { hp: -35, rep: -30 }, log: "스테로이드는 지연성 반응 예방 — 즉시 효과 없음." },
                { text: "관찰 + 의사 콜만 진행", effect: { hp: -42, rep: -35 }, log: "아나필락시스는 분 단위로 사망 가능." }
            ]) };
    }

    function generateNaloxoneQuestion() {
        return { baseId: "naloxone", category: "성인간호학", part: "응급 약물", emoji: "💊", title: "마약성 진통제 과량 — Naloxone 사용",
            desc: `Morphine PCA 환자 RR 6, SpO2 84%, 핀포인트 동공, GCS 8. 우선 중재는?`,
            choices: shuffle([
                { text: "산소 + bag-mask 환기 준비 + Naloxone 0.04~0.4mg IV 적정 (분할 반복 가능)", correct: true, effect: { hp: -3, rep: 25 }, log: "정답. 마약 과량 진단 + Naloxone 적정 투여." },
                { text: "Flumazenil IV push", effect: { hp: -32, rep: -28 }, log: "Flumazenil 은 벤조 길항제 — 마약에 무효." },
                { text: "Epinephrine IV push", effect: { hp: -32, rep: -28 }, log: "마약 호흡 억제는 Epi 적응증 아님." },
                { text: "관찰만 진행 + 환자 깨우기 시도", effect: { hp: -38, rep: -32 }, log: "호흡 정지 위험. 즉시 약물." }
            ]) };
    }

    function generateChemoExtravasationQuestion() {
        return { baseId: "chemo_extra", category: "성인간호학", part: "종양 응급", emoji: "🧪", title: "항암제 외삼출 응급",
            desc: `Doxorubicin 정맥 주입 중 환자가 \"주사 부위가 화끈해요\" 호소. 부위 부종·발적 확인. 우선 조치는?`,
            choices: shuffle([
                { text: "즉시 주입 중단 + 카테터로 잔여 약물 흡인 + 카테터 유지 후 의사 보고 + 차가운 찜질 (vesicant 특이 antidote 검토)", correct: true, effect: { hp: -3, rep: 28 }, log: "정답. 발포제(vesicant) 외삼출 표준 (ONS Guidelines)." },
                { text: "주입 그대로 계속 + 진통제 추가", effect: { hp: -38, rep: -32 }, log: "조직 괴사로 영구 손상." },
                { text: "주입 중단 + 카테터 즉시 제거", effect: { hp: -28, rep: -22 }, log: "카테터를 통해 잔여 약물 흡인 후 제거가 표준." },
                { text: "따뜻한 찜질 적용", effect: { hp: -25, rep: -20 }, log: "Doxorubicin 은 차가운 찜질 (vinca alkaloid 는 따뜻한 찜질)." }
            ]) };
    }

    function generateCBCInterpretationQuestion() {
        const cases = [
            { finding: "Hgb 6.8 / Hct 21 / RBC 2.5M / MCV 70", interp: "소구성 빈혈 — 철 결핍 가능", action: "원인 평가 (대변 잠혈·생리·내시경) + 철분 보충 + 식이 교육", wrong: ["응급 수혈 즉시", "EPO IV 즉시 시작", "단순 관찰"] },
            { finding: "WBC 24,000 (호중구 90%) / 좌방이동", interp: "세균감염 또는 패혈증 의심", action: "혈배 + 광범위 항생제 + V/S 모니터 + 의사 보고", wrong: ["바이러스 감염으로 보고 관찰", "항히스타민 적용", "관찰만 진행"] },
            { finding: "혈소판 12,000 / 점상출혈 + 자반", interp: "혈소판 감소증 — DIC/ITP/TTP 감별", action: "원인 검사 + 출혈 사정 + 혈소판 수혈 검토 + 의사 보고", wrong: ["아스피린 추가", "관찰 + 다음 검사", "헤파린 시작"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "cbc", category: "성인간호학", part: "검사 판독", emoji: "🩸", title: "CBC 결과 해석",
            desc: `${c.finding} — ${c.interp}. 우선 중재는?`,
            choices: shuffle([
                { text: c.action, correct: true, effect: { hp: -3, rep: 22 }, log: `정답. ${c.interp} 의 표준 중재입니다.` },
                { text: wrongs[0], effect: { hp: -22, rep: -16 }, log: "검사 해석에 맞지 않는 중재입니다." },
                { text: wrongs[1], effect: { hp: -22, rep: -16 }, log: "검사 해석에 맞지 않는 중재입니다." },
                { text: wrongs[2], effect: { hp: -22, rep: -16 }, log: "검사 해석에 맞지 않는 중재입니다." }
            ]) };
    }

    function generateDiabetesEducationQuestion() {
        return { baseId: "dm_edu", category: "성인간호학", part: "환자 교육", emoji: "📚", title: "당뇨 환자 자기관리 교육",
            desc: `새로 1형 당뇨 진단된 18세 환자의 퇴원 교육 시 가장 우선되는 내용은?`,
            choices: shuffle([
                { text: "혈당 모니터링 + 인슐린 자가주사 + 저혈당 인지·대처 + 응급실 방문 기준", correct: true, effect: { hp: -2, rep: 25 }, log: "정답. 1형 당뇨 신환의 핵심 자기관리 교육." },
                { text: "운동만 강조 — 식이는 일반인과 동일", effect: { hp: -22, rep: -16 }, log: "운동·식이·약물 통합 교육 필요." },
                { text: "약은 의사가 결정하므로 환자는 알 필요 없음", effect: { hp: -28, rep: -22 }, log: "자기관리는 환자 교육의 핵심." },
                { text: "당뇨는 평생 약 없이 식이만으로 조절 가능", effect: { hp: -32, rep: -28 }, log: "1형 당뇨는 인슐린 평생 필수." }
            ]) };
    }

    function generateStomaCareQuestion() {
        return { baseId: "stoma", category: "기본간호학", part: "장루 관리", emoji: "🩹", title: "결장루(colostomy) 환자 관리",
            desc: `결장루 수술 후 3일차 환자 장루 점막 색깔 검정으로 변화. 우선 조치는?`,
            choices: shuffle([
                { text: "장루 허혈/괴사 의심 — 즉시 의사 보고 + V/S + 사진 기록", correct: true, effect: { hp: -3, rep: 25 }, log: "정답. 검은색 변화는 허혈/괴사 신호 — 응급." },
                { text: "정상 변이로 보고 일반 관리", effect: { hp: -38, rep: -32 }, log: "검정 변화는 절대 정상 아님." },
                { text: "물로 직접 세척", effect: { hp: -28, rep: -22 }, log: "응급 보고가 우선." },
                { text: "직접 절제 시도", effect: { hp: -45, rep: -38 }, log: "절대 금기. 외과 의사 영역." }
            ]) };
    }

    function generateInformedConsentQuestion() {
        return { baseId: "informed_consent", category: "간호관리학", part: "윤리·법", emoji: "✍️", title: "수술 동의서 — 환자 권리",
            desc: `수술 전 동의서를 받는 도중 환자가 \"무슨 내용인지 잘 모르겠어요\" 라고 말한다. 간호사의 적절한 대응은?`,
            choices: shuffle([
                { text: "동의 절차 일시 중단 + 의사에게 추가 설명 요청 + 환자가 이해할 때까지 진행 보류", correct: true, effect: { hp: -2, rep: 28 }, log: "정답. Informed consent = 충분한 이해 + 자발적 동의." },
                { text: "\"그냥 사인해주세요\" 라며 절차 진행", effect: { hp: -32, rep: -28 }, log: "법적 무효 + 의료법 위반." },
                { text: "본인이 직접 추가 설명 후 사인 받음", effect: { hp: -22, rep: -16 }, log: "수술 설명은 시술 의사 의무." },
                { text: "가족에게 대신 사인하도록 안내", effect: { hp: -28, rep: -22 }, log: "의식 명료 환자에게 대리 동의는 위반." }
            ]) };
    }

    function generateMultiCulturalQuestion() {
        return { baseId: "multicultural", category: "지역사회간호학", part: "다문화 간호", emoji: "🌏", title: "다문화 환자 의사소통",
            desc: `한국어 미숙한 동남아 출신 환자가 통증 호소하나 정확한 양상 파악 어려움. 가장 적절한 접근은?`,
            choices: shuffle([
                { text: "공식 의료 통역 서비스 호출 (모바일/전화 통역도 가능) + 통증 그림 척도 활용 + 문화적 표현 차이 고려", correct: true, effect: { hp: -2, rep: 25 }, log: "정답. 다문화 의료에서 공식 통역 + 시각적 도구가 표준." },
                { text: "가족이 통역하도록 요청 (가족만 신뢰)", effect: { hp: -22, rep: -16 }, log: "가족 통역은 개인정보·정확성 문제." },
                { text: "한국어로만 진행 + 환자가 알아들으리라 가정", effect: { hp: -28, rep: -22 }, log: "환자 안전 위협." },
                { text: "본인이 번역 앱으로 대화", effect: { hp: -18, rep: -10 }, log: "공식 통역이 의료 정확성 보장." }
            ]) };
    }

    // ── v1.2 균형 보정 라운드 (모성·아동·정신·지역·관리·법규 20종) ─────

    // 모성간호학 +4
    function generateGestationalDMQuestion() {
        return { baseId: "gdm", category: "모성간호학", part: "임신성 당뇨", emoji: "🤰", title: "임신성 당뇨 관리",
            desc: `임신 28주 산모 75g 경구당부하검사: 공복 95 / 1h 195 / 2h 165 mg/dL. 진단 및 우선 중재는?`,
            choices: shuffle([
                { text: "GDM 진단 (1h ≥180) — 식이·운동 교육 + 자가 혈당 측정 + 산과·내과 협진", correct: true, effect: { hp: -2, rep: 22 }, log: "정답. ADA/대한당뇨병학회 GDM 진단 기준." },
                { text: "정상 — 추가 검사 불필요", effect: { hp: -22, rep: -16 }, log: "1h 결과가 진단 기준 초과." },
                { text: "즉시 인슐린 처방 의뢰", effect: { hp: -18, rep: -12 }, log: "식이·운동이 1차. 효과 부족 시 인슐린." },
                { text: "단순 일시적 상승으로 관찰", effect: { hp: -22, rep: -16 }, log: "GDM 진단 누락 = 태아 거대아·합병증 위험." }
            ]) };
    }

    function generatePostpartumDepressionQuestion() {
        return { baseId: "ppd", category: "모성간호학", part: "산후 정신건강", emoji: "🤱", title: "산후 우울 사정",
            desc: `분만 3주 후 산모 \"아기 보기 싫어요, 죽고 싶어요\" 호소. Edinburgh 점수 19점.`,
            choices: shuffle([
                { text: "자살 위험 즉시 평가 + 정신과 응급 협진 + 안전한 환경 + 가족 지원 + 모유수유 약물 호환 검토", correct: true, effect: { hp: -3, rep: 28 }, log: "정답. 산후 우울 + 자살 사고는 응급 (Edinburgh ≥13 우울)." },
                { text: "단순 산후 우울감(baby blues) 으로 관찰", effect: { hp: -38, rep: -32 }, log: "Baby blues 는 2주 이내 호전. 3주 + 자살 사고는 PPD/PPP." },
                { text: "약물 부담으로 정신과 협진 보류", effect: { hp: -32, rep: -28 }, log: "수유 호환 약물 다수 존재. 협진 우선." },
                { text: "남편에게만 알리고 환자는 안정", effect: { hp: -28, rep: -22 }, log: "환자 단독 평가 + 전문가 협진 필요." }
            ]) };
    }

    function generateRhIncompatibilityQuestion() {
        return { baseId: "rh_incompatibility", category: "모성간호학", part: "면역", emoji: "🩸", title: "Rh 부적합 — RhoGAM 투여",
            desc: `Rh(-) 산모 임신 28주 정기 진찰. 항-D 항체 음성. 우선 중재는?`,
            choices: shuffle([
                { text: "RhoGAM (anti-D 면역글로불린) 300μg IM — 임신 28주 + 분만 후 72시간 내 표준", correct: true, effect: { hp: -2, rep: 22 }, log: "정답. ACOG 표준 — Rh(-) 산모 28주 + 분만 후 72시간." },
                { text: "분만 후에만 1회 투여", effect: { hp: -22, rep: -16 }, log: "28주 + 분만 후 2회 투여가 표준." },
                { text: "항체 양성이어야 RhoGAM 투여", effect: { hp: -25, rep: -20 }, log: "음성에서 예방적 투여가 RhoGAM 역할." },
                { text: "Rh(+) 산모에게만 투여", effect: { hp: -28, rep: -22 }, log: "RhoGAM 은 Rh(-) 산모용." }
            ]) };
    }

    function generateNeonatalResuscitationQuestion() {
        return { baseId: "nrp", category: "모성간호학", part: "신생아 소생", emoji: "🍼", title: "분만실 신생아 소생술",
            desc: `분만 직후 신생아 청색·근긴장 저하·호흡 미약. Apgar 1분 3점. 우선 중재는?`,
            choices: shuffle([
                { text: "Warmer 이동 + 흡인 + 자극 (30초 평가) → 호흡·HR 평가 후 양압환기 (PPV) 시작", correct: true, effect: { hp: -3, rep: 25 }, log: "정답. NRP (Neonatal Resuscitation Program) 표준 알고리듬." },
                { text: "즉시 흉부압박 시작", effect: { hp: -28, rep: -22 }, log: "흉부압박은 PPV 후 HR <60 일 때." },
                { text: "epinephrine 즉시 IV", effect: { hp: -32, rep: -28 }, log: "약물은 NRP 마지막 단계." },
                { text: "산모에게 안기게 한 후 관찰", effect: { hp: -38, rep: -32 }, log: "Apgar 3점은 적극 소생." }
            ]) };
    }

    // 아동간호학 +4
    function generateKawasakiQuestion() {
        return { baseId: "kawasaki", category: "아동간호학", part: "감염·면역", emoji: "👶", title: "가와사키병 진단·치료",
            desc: `4세 아동 5일째 고열, 결막충혈, 입술 균열, 손발 부종, 림프절 비대, 발진. 우선 치료는?`,
            choices: shuffle([
                { text: "IVIG (2g/kg) + 고용량 aspirin — 발열 시작 10일 내 시작 (관상동맥류 예방)", correct: true, effect: { hp: -3, rep: 25 }, log: "정답. 가와사키병 표준 치료 (AAP/AHA)." },
                { text: "광범위 항생제만 시작", effect: { hp: -28, rep: -22 }, log: "세균감염 아님. 면역 매개." },
                { text: "스테로이드 IV 단독 시작", effect: { hp: -22, rep: -16 }, log: "1차는 IVIG. 스테로이드는 IVIG 저항 시." },
                { text: "관찰 + 해열제만", effect: { hp: -32, rep: -28 }, log: "10일 내 치료 안 하면 관상동맥류 위험." }
            ]) };
    }

    function generateChildAsthmaQuestion() {
        return { baseId: "peds_asthma", category: "아동간호학", part: "호흡기", emoji: "👦", title: "소아 천식 발작",
            desc: `8세 아동 천명음 + SpO2 89% + 호흡곤란 + 말 짧게 끊김. 1차 치료는?`,
            choices: shuffle([
                { text: "산소 + SABA(salbutamol) nebulizer 5mg + 전신 스테로이드 + 의사 콜", correct: true, effect: { hp: -3, rep: 25 }, log: "정답. GINA 가이드 소아 급성 천식 1차 치료." },
                { text: "베타차단제 IV", effect: { hp: -38, rep: -32 }, log: "베타차단제는 기관지수축. 절대 금기." },
                { text: "이뇨제 IV", effect: { hp: -28, rep: -22 }, log: "천식과 무관." },
                { text: "심리적 안정만 진행", effect: { hp: -32, rep: -25 }, log: "약물 치료가 필수." }
            ]) };
    }

    function generateChildAbuseQuestion() {
        return { baseId: "child_abuse", category: "아동간호학", part: "아동학대", emoji: "🚨", title: "아동학대 의심 평가",
            desc: `3세 아동 응급실 도착, 다단계 멍 + 화상 자국 + 부모 진술 모순. 의료인의 의무는?`,
            choices: shuffle([
                { text: "아동학대 신고 의무 — 112 또는 아동보호전문기관 즉시 신고 + 사진 기록 + 단독 평가 + 보호조치", correct: true, effect: { hp: -3, rep: 28 }, log: "정답. 아동복지법 의료인 신고 의무." },
                { text: "부모 진술 그대로 수용", effect: { hp: -38, rep: -32 }, log: "신고 의무 위반 + 환아 위험." },
                { text: "사회복지에만 알리고 신고는 보류", effect: { hp: -32, rep: -28 }, log: "법적 신고 의무 — 즉시." },
                { text: "본인이 직접 부모 추궁", effect: { hp: -25, rep: -20 }, log: "환아 위험 + 증거 보존 위협." }
            ]) };
    }

    function generateChildDevelopmentQuestion() {
        const cases = [
            { age: "18개월", expected: "혼자 걷기 + 단어 5~10개 사용 + 컵으로 마시기", concern: "걷지 못하거나 단어 0개 사용", wrong: ["문장 형성", "계단 오르내리기 가능"] },
            { age: "3세", expected: "두세 단어 문장 + 세발자전거 + 본인 이름 알기", concern: "단어 단독만 사용 + 이름 모름", wrong: ["글자 읽기", "단추 채우기"] },
            { age: "5세", expected: "복잡한 문장 + 옷 입기 + 한 발 뛰기 + 색 구분", concern: "단어 짧은 문장 + 색 구분 못 함", wrong: ["글쓰기 능숙", "독립적 식사 준비"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle([c.concern, ...c.wrong]);
        return { baseId: "child_dev", category: "아동간호학", part: "발달 사정", emoji: "🧒", title: "아동 발달 지연 의심",
            desc: `${c.age} 아동의 정상 발달 이정표는?`,
            choices: shuffle([
                { text: c.expected, correct: true, effect: { hp: -2, rep: 22 }, log: `정답. ${c.age} 의 표준 발달 (CDC/AAP).` },
                { text: wrongs[0], effect: { hp: -18, rep: -12 }, log: "발달 지연 의심 신호 또는 다른 연령." },
                { text: wrongs[1], effect: { hp: -18, rep: -12 }, log: "발달 지연 의심 신호 또는 다른 연령." },
                { text: wrongs[2], effect: { hp: -18, rep: -12 }, log: "발달 지연 의심 신호 또는 다른 연령." }
            ]) };
    }

    // 정신간호학 +4
    function generateAnxietyDisorderQuestion() {
        return { baseId: "anxiety", category: "정신간호학", part: "불안장애", emoji: "😰", title: "공황발작 환자 케어",
            desc: `갑자기 가슴이 답답하고 죽을 것 같다며 응급실 도착. ECG 정상, V/S 정상. 공황발작 진단.`,
            choices: shuffle([
                { text: "조용한 환경 + 천천히 호흡 코칭 + 환자 옆 동행 + 안심 + 정신과 외래 연계", correct: true, effect: { hp: -2, rep: 25 }, log: "정답. 공황발작은 비약물 + 정서 지지가 1차." },
                { text: "즉시 lorazepam IV push", effect: { hp: -22, rep: -16 }, log: "처방 없는 임의 투여 + 의존 위험." },
                { text: "단순 불안이라며 일축", effect: { hp: -28, rep: -22 }, log: "환자 고통 무시." },
                { text: "흥분 위해 카페인 음료 제공", effect: { hp: -32, rep: -28 }, log: "각성제는 절대 금기." }
            ]) };
    }

    function generatePTSDQuestion() {
        return { baseId: "ptsd", category: "정신간호학", part: "외상후 스트레스", emoji: "😔", title: "PTSD 환자 의사소통",
            desc: `교통사고 6개월 후 환자가 \"운전대만 봐도 손이 떨려요, 잠도 못 자요\" 호소. PTSD 의심.`,
            choices: shuffle([
                { text: "증상 정상화 (PTSD 는 흔함) + 외상 사건 강요 X + 정신과·트라우마 전문가 연계 + 자조모임 안내", correct: true, effect: { hp: -2, rep: 25 }, log: "정답. PTSD 는 정상화 + 전문가 연계가 표준." },
                { text: "사건 자세히 다시 말하라며 노출치료", effect: { hp: -25, rep: -20 }, log: "비전문가 노출은 재외상화 위험." },
                { text: "\"잊으세요\" 라며 위로", effect: { hp: -22, rep: -16 }, log: "PTSD 는 의지로 잊는 게 아님." },
                { text: "수면제만 처방 요청", effect: { hp: -20, rep: -15 }, log: "수면제만으로는 PTSD 치료 부족." }
            ]) };
    }

    function generateEatingDisorderQuestion() {
        return { baseId: "eating_disorder", category: "정신간호학", part: "섭식장애", emoji: "🍽️", title: "신경성 식욕부진증 응급",
            desc: `17세 여자 BMI 13.5, K+ 2.8, BP 80/50, HR 38, 의식 명료. 우선 중재는?`,
            choices: shuffle([
                { text: "재영양 증후군 위험 — 천천히 재급식 (10~20kcal/kg/d 시작) + 인산·K·Mg 모니터 + 다학제 협진", correct: true, effect: { hp: -3, rep: 28 }, log: "정답. 신경성 식욕부진증 재영양은 refeeding syndrome 예방이 핵심." },
                { text: "정상 식이 즉시 시작 (1500kcal/d)", effect: { hp: -32, rep: -28 }, log: "Refeeding syndrome — 인산저하·심부전 위험." },
                { text: "TPN 즉시 시작", effect: { hp: -28, rep: -22 }, log: "경구·경관 영양 우선." },
                { text: "환자에게 빨리 먹으라 압박", effect: { hp: -32, rep: -28 }, log: "정신적 + 신체적 위해." }
            ]) };
    }

    function generateDementiaBehaviorQuestion() {
        return { baseId: "dementia_bpsd", category: "정신간호학", part: "치매 행동심리증상(BPSD)", emoji: "👴", title: "치매 환자 초조 행동",
            desc: `요양병원 치매 환자 야간 \"집에 가겠다\" 라며 배회·고함. 우선 중재는?`,
            choices: shuffle([
                { text: "유발 요인 평가(통증·요의·환경 자극) + 비약물 (안심·환경 조정·익숙한 물품) + 약물은 마지막", correct: true, effect: { hp: -2, rep: 25 }, log: "정답. BPSD 1차는 비약물 (CMS/대한치매학회)." },
                { text: "즉시 haloperidol IM 주사", effect: { hp: -28, rep: -22 }, log: "노인에 항정신병약 1차는 부적절 (Beers Criteria)." },
                { text: "신체보호대 강제 적용", effect: { hp: -25, rep: -20 }, log: "마지막 수단 + 윤리적 절차." },
                { text: "환자 무시하고 다른 환자만 케어", effect: { hp: -28, rep: -22 }, log: "낙상·실종 위험." }
            ]) };
    }

    // 지역사회간호학 +3
    function generateCovidIsolationQuestion() {
        return { baseId: "covid_isolation", category: "지역사회간호학", part: "신종감염병", emoji: "🦠", title: "신종감염병 자가격리 교육",
            desc: `코로나19 확진 환자 가정 자가격리 교육 시 가장 강조해야 할 내용은?`,
            choices: shuffle([
                { text: "독립된 공간·전용 화장실 + 마스크 착용 + 환기 + 손위생 + 동거인 감염 모니터 + 응급 증상 시 1339/119", correct: true, effect: { hp: -2, rep: 22 }, log: "정답. KDCA 자가격리 교육 표준." },
                { text: "외출 가능하되 마스크만 잘 착용", effect: { hp: -28, rep: -22 }, log: "격리 위반." },
                { text: "동거인과 동선 분리는 불필요", effect: { hp: -25, rep: -20 }, log: "가정 내 전파 위험." },
                { text: "본인 감각으로 격리 종료 결정", effect: { hp: -22, rep: -18 }, log: "공식 격리 기간 + 검사 기준." }
            ]) };
    }

    function generateOlderAdultScreeningQuestion() {
        return { baseId: "older_screen", category: "지역사회간호학", part: "노인 건강검진", emoji: "👵", title: "노인 통합 건강 사정",
            desc: `보건소 노인 통합 건강 사정에서 65세 이상에게 시행하는 표준 평가는?`,
            choices: shuffle([
                { text: "노쇠 (Frailty) + 낙상 위험 + 인지 (MMSE) + 우울 (GDS) + 일상생활 활동 (ADL/IADL) + 약물 평가", correct: true, effect: { hp: -2, rep: 22 }, log: "정답. CGA (Comprehensive Geriatric Assessment) 표준." },
                { text: "키·몸무게·BP 만 측정", effect: { hp: -22, rep: -16 }, log: "노인 평가의 핵심 누락." },
                { text: "외과적 질환만 평가", effect: { hp: -25, rep: -20 }, log: "통합 평가가 노인 핵심." },
                { text: "본인 호소 증상만 평가", effect: { hp: -22, rep: -16 }, log: "노인은 비특이적 호소가 흔함." }
            ]) };
    }

    function generateMaternalHealthCenterQuestion() {
        return { baseId: "mch_center", category: "지역사회간호학", part: "모자보건사업", emoji: "🤱", title: "산후도우미 + 영아 건강검진",
            desc: `보건소 영유아 정기 건강검진 시기로 옳은 것은? (영유아 건강검진 표준일정)`,
            choices: shuffle([
                { text: "생후 14~35일 + 4·9·18·30·42·54·66개월 — 총 8회 (구강검진 별도)", correct: true, effect: { hp: -2, rep: 22 }, log: "정답. 영유아건강검진사업 (2021 개정 — 14~35일 추가, 총 8회)." },
                { text: "출생 후 1회만", effect: { hp: -22, rep: -16 }, log: "정기 검진은 영유아기 총 8회입니다." },
                { text: "필요시에만 시행", effect: { hp: -25, rep: -20 }, log: "정기 검진은 무료 사업." },
                { text: "어린이집에서 모두 처리", effect: { hp: -22, rep: -16 }, log: "보건소 사업이 표준." }
            ]) };
    }

    // 간호관리학 +3
    function generateTimemanagementQuestion() {
        return { baseId: "time_mgmt", category: "간호관리학", part: "업무 우선순위", emoji: "⏱️", title: "다중 업무 우선순위",
            desc: `오전 라운드 시작 — 동시 업무: A) PCA 환자 통증 NRS 9, B) 신환 입원 받기, C) 처방 약 30분 지연, D) 보호자 면담 약속. 우선순위는?`,
            choices: shuffle([
                { text: "A(통증 NRS 9 — 즉시) → C(약 시간 — Maslow 생리) → B(신환 — 안정화) → D(면담 — 일정 조정)", correct: true, effect: { hp: -2, rep: 22 }, log: "정답. Maslow + 환자 안전 우선." },
                { text: "선착순으로 처리", effect: { hp: -22, rep: -16 }, log: "우선순위 평가 누락." },
                { text: "보호자 면담부터 끝내고 다른 업무", effect: { hp: -25, rep: -20 }, log: "환자 안전이 우선." },
                { text: "본인이 모든 일을 동시에 시도", effect: { hp: -22, rep: -16 }, log: "안전한 위임 + 우선순위 필요." }
            ]) };
    }

    function generateNurseHandoffQuestion() {
        return { baseId: "nurse_handoff", category: "간호관리학", part: "인계 표준", emoji: "📋", title: "SBAR 인계 표준",
            desc: `SBAR 인계 시 'Recommendation' 에 해당하는 내용은?`,
            choices: shuffle([
                { text: "다음 듀티에 필요한 처치·평가 제안 (예: 통증 PRN 처방 확인 부탁)", correct: true, effect: { hp: -2, rep: 22 }, log: "정답. SBAR 의 R = Recommendation (제안·요청)." },
                { text: "환자 진단명 (Background 에 해당)", effect: { hp: -15, rep: -8 }, log: "Background." },
                { text: "현재 V/S (Assessment 에 해당)", effect: { hp: -15, rep: -8 }, log: "Assessment." },
                { text: "환자 호소 (Situation 에 해당)", effect: { hp: -15, rep: -8 }, log: "Situation." }
            ]) };
    }

    function generateCostEffectivenessQuestion() {
        return { baseId: "cost_effective", category: "간호관리학", part: "자원 관리", emoji: "💰", title: "간호 자원 효율 관리",
            desc: `드레싱 비용 절감 방안 — 가장 적절한 접근은?`,
            choices: shuffle([
                { text: "환자별 상처 사정 + 적절 드레싱 선택 + 교환 빈도 표준화 + 재고 관리", correct: true, effect: { hp: -2, rep: 22 }, log: "정답. 환자 중심 + 표준화 + 자원 최적화." },
                { text: "모든 환자에게 가장 저렴한 드레싱 일괄", effect: { hp: -22, rep: -16 }, log: "환자 결과 악화 + 비용 가속." },
                { text: "드레싱 교환 빈도를 절반으로 강제 감소", effect: { hp: -25, rep: -20 }, log: "환자 안전 위협." },
                { text: "고가 드레싱만 사용", effect: { hp: -18, rep: -10 }, log: "근거 없는 비용 가속." }
            ]) };
    }

    // 보건의약관계법규 +2
    function generateConfidentialityLawQuestion() {
        return { baseId: "confidentiality", category: "보건의약관계법규", part: "환자 비밀유지", emoji: "🔒", title: "환자 비밀유지 의무",
            desc: `환자 가족이 \"우리 엄마가 무슨 병인지 알려주세요\" 라고 묻는다. 의료법상 적절한 대응은?`,
            choices: shuffle([
                { text: "환자 동의 확인 후 알림 (의식 명료 환자) — 동의 없으면 비밀유지 의무", correct: true, effect: { hp: -2, rep: 22 }, log: "정답. 의료법 제19조 비밀유지 의무." },
                { text: "가족이니 당연히 알린다", effect: { hp: -25, rep: -20 }, log: "의료법 위반." },
                { text: "의사에게만 답변 가능하다며 회피", effect: { hp: -18, rep: -10 }, log: "간호사도 비밀유지 의무." },
                { text: "환자에게 묻지 않고 진료 기록만 보여줌", effect: { hp: -28, rep: -22 }, log: "환자 동의 없이 정보 공개." }
            ]) };
    }

    function generateAdvancedDirectiveLawQuestion() {
        return { baseId: "advance_directive", category: "보건의약관계법규", part: "연명의료결정법", emoji: "📜", title: "사전연명의료의향서",
            desc: `19세 이상 성인이 사전연명의료의향서 작성 시 효력은?`,
            choices: shuffle([
                { text: "본인 의사 능력 있을 때 작성 — 임종기·말기 시 적용 + 사전 등록기관 등록 + 본인 의사로 철회 가능", correct: true, effect: { hp: -2, rep: 22 }, log: "정답. 연명의료결정법 표준." },
                { text: "가족 동의 없이는 효력 없음", effect: { hp: -22, rep: -16 }, log: "본인 결정 우선." },
                { text: "한 번 작성하면 철회 불가", effect: { hp: -22, rep: -16 }, log: "본인 의사로 철회 가능." },
                { text: "65세 이상에게만 권장", effect: { hp: -18, rep: -10 }, log: "19세 이상이면 작성 가능." }
            ]) };
    }

    // ── v1.2 평가 도구·임상 표준 라운드 (15 generator) ─────────────────────

    function generateKTASQuestion() {
        const cases = [
            { sit: "흉통 + 식은땀 + V/S 위험", lvl: "KTAS 1 (소생)", wrong: ["KTAS 3 (긴급)", "KTAS 4 (준응급)", "KTAS 5 (비응급)"] },
            { sit: "호흡곤란 SpO2 92% + 의식 명료", lvl: "KTAS 2 (응급)", wrong: ["KTAS 5 (비응급)", "KTAS 4 (준응급)", "KTAS 1 (소생)"] },
            { sit: "복통 NRS 7 + V/S 안정", lvl: "KTAS 3 (긴급)", wrong: ["KTAS 1 (소생)", "KTAS 5 (비응급)", "KTAS 4 (준응급)"] },
            { sit: "감기 기침 + 미열 38.0℃", lvl: "KTAS 4 (준응급)", wrong: ["KTAS 1 (소생)", "KTAS 2 (응급)", "KTAS 3 (긴급)"] },
            { sit: "처방전 재발급 요청", lvl: "KTAS 5 (비응급)", wrong: ["KTAS 1 (소생)", "KTAS 2 (응급)", "KTAS 3 (긴급)"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "ktas", category: "지역사회간호학", part: "응급실 분류", emoji: "🚑", title: "KTAS 응급실 5단계 분류",
            desc: `다음 상황의 KTAS 분류는?\n"${c.sit}"`,
            choices: shuffle([
                { text: c.lvl, correct: true, effect: { hp: -2, rep: 22 }, log: `정답. ${c.lvl} 의 표준 기준입니다.` },
                { text: wrongs[0], effect: { hp: -18, rep: -12 }, log: "KTAS 기준에 맞지 않습니다." },
                { text: wrongs[1], effect: { hp: -18, rep: -12 }, log: "KTAS 기준에 맞지 않습니다." },
                { text: wrongs[2], effect: { hp: -18, rep: -12 }, log: "KTAS 기준에 맞지 않습니다." }
            ]) };
    }

    function generateAldreteScoreQuestion() {
        return { baseId: "aldrete", category: "성인간호학", part: "회복실 (PACU)", emoji: "🛌", title: "Aldrete 점수 — 회복실 퇴실 기준",
            desc: `Aldrete 점수 9점 (활동 2/호흡 2/순환 2/의식 2/색 1) 환자의 적절한 다음 단계는?`,
            choices: shuffle([
                { text: "병동 이송 가능 (Aldrete ≥9 + 안정 활력) — 인계 SBAR + 가족 안내", correct: true, effect: { hp: -2, rep: 22 }, log: "정답. Aldrete 9점은 일반병동 이송 기준." },
                { text: "ICU 즉시 이송 필요", effect: { hp: -22, rep: -16 }, log: "9점은 안정 상태." },
                { text: "회복실에서 6시간 더 관찰", effect: { hp: -18, rep: -10 }, log: "기준 충족 시 이송." },
                { text: "퇴원 가능", effect: { hp: -28, rep: -22 }, log: "병동 이송이 표준." }
            ]) };
    }

    function generateMorseFallScaleQuestion() {
        return { baseId: "morse_fall", category: "간호관리학", part: "낙상 위험 평가", emoji: "🚶", title: "Morse Fall Scale 해석",
            desc: `노인 환자 Morse 점수 65점 (낙상 과거력·다발 진단·IV 보유·정맥주사 카테터·보행 보조기). 적절한 중재는?`,
            choices: shuffle([
                { text: "고위험 (≥45) — 침대 알람 + 낙상 표지 + 1m 이내 동행 + 환경 정리 + 화장실 동행 + 가족 교육", correct: true, effect: { hp: -3, rep: 25 }, log: "정답. Morse ≥45 고위험군 표준 중재." },
                { text: "저위험 — 일반 케어", effect: { hp: -28, rep: -22 }, log: "고위험군 식별 누락." },
                { text: "신체보호대 즉시 적용", effect: { hp: -25, rep: -20 }, log: "마지막 수단 + 윤리 절차." },
                { text: "환자 침대에서 못 나오게 강제", effect: { hp: -22, rep: -18 }, log: "이동권 침해." }
            ]) };
    }

    function generateBradenScaleQuestion() {
        return { baseId: "braden", category: "기본간호학", part: "욕창 위험 평가", emoji: "🛏️", title: "Braden Scale 해석",
            desc: `의식 저하 환자 Braden 12점 (감각·습기·활동·이동·영양·마찰). 우선 중재는?`,
            choices: shuffle([
                { text: "고위험 (≤12) — 2시간마다 체위변경 + 압력 분산 매트리스 + 피부 보호 + 영양 평가 + 매일 평가", correct: true, effect: { hp: -3, rep: 25 }, log: "정답. Braden ≤12 고위험 표준 중재." },
                { text: "저위험 — 일반 케어", effect: { hp: -32, rep: -28 }, log: "고위험군 누락 = 욕창 진행." },
                { text: "체위변경 4시간마다", effect: { hp: -22, rep: -16 }, log: "고위험은 2시간." },
                { text: "환자에게 본인이 움직이라 권유", effect: { hp: -28, rep: -22 }, log: "의식 저하 환자에 부적절." }
            ]) };
    }

    function generateSilvermanScoreQuestion() {
        return { baseId: "silverman", category: "아동간호학", part: "신생아 호흡곤란", emoji: "🍼", title: "Silverman-Anderson 점수",
            desc: `미숙아 Silverman 점수 7점 (상흉부 함몰·하흉부 함몰·검상돌기 함몰·비익호흡·신음). 우선 중재는?`,
            choices: shuffle([
                { text: "중증 호흡곤란 (≥7) — 산소 + 양압환기 (CPAP/PPV) 준비 + NICU 즉시 협진 + 표면활성제 검토", correct: true, effect: { hp: -3, rep: 28 }, log: "정답. Silverman ≥7 은 중증 — 즉시 호흡 보조." },
                { text: "경증으로 보고 관찰", effect: { hp: -38, rep: -32 }, log: "사망 위험 가속." },
                { text: "보온만 강화", effect: { hp: -32, rep: -28 }, log: "원인 평가 + 호흡 보조 필수." },
                { text: "엄마 가슴에 안기게 함", effect: { hp: -28, rep: -22 }, log: "중증 호흡곤란은 NICU." }
            ]) };
    }

    function generateBloodTypeQuestion() {
        const cases = [
            { donor: "O(-) 적혈구", recipient: "AB(+) 환자", compat: "호환 (universal donor)", wrong: ["호환 불가 — 즉시 중단", "조건부 호환 (검사 후)", "B 형 환자만 호환"] },
            { donor: "AB(+) 혈장 (FFP)", recipient: "O(+) 환자", compat: "호환 (혈장 universal donor)", wrong: ["호환 불가", "O 형 환자만 호환", "AB 형 환자만 호환"] },
            { donor: "A(+) 적혈구", recipient: "O(+) 환자", compat: "호환 불가 — 즉시 중단·교차시험 재확인", wrong: ["호환 — 진행", "응급 시 가능", "단순 알레르기 반응 위험만"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "blood_type", category: "성인간호학", part: "수혈 호환성", emoji: "🩸", title: "ABO·Rh 호환성",
            desc: `${c.donor} → ${c.recipient} 의 호환성은?`,
            choices: shuffle([
                { text: c.compat, correct: true, effect: { hp: -3, rep: 25 }, log: `정답. ABO 호환성의 표준 기준입니다.` },
                { text: wrongs[0], effect: { hp: -32, rep: -28 }, log: "호환성 판단 오류." },
                { text: wrongs[1], effect: { hp: -22, rep: -16 }, log: "호환성 판단 오류." },
                { text: wrongs[2], effect: { hp: -22, rep: -16 }, log: "호환성 판단 오류." }
            ]) };
    }

    function generateDrugScheduleQuestion() {
        const cases = [
            { drug: "Morphine (모르핀)", cat: "마약 (마약류관리법)", wrong: ["향정신성의약품", "일반 의약품", "전문 의약품 (마약 제외)"] },
            { drug: "Lorazepam (벤조디아제핀)", cat: "향정신성의약품 4군", wrong: ["마약", "일반 의약품", "한약"] },
            { drug: "Methylphenidate (ADHD 약)", cat: "향정신성의약품 2군", wrong: ["마약", "일반 의약품", "한약"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "drug_schedule", category: "보건의약관계법규", part: "마약류관리법", emoji: "💊", title: "약물 분류",
            desc: `${c.drug} 의 법적 분류는?`,
            choices: shuffle([
                { text: c.cat, correct: true, effect: { hp: -2, rep: 22 }, log: `정답. 마약류관리법 분류.` },
                { text: wrongs[0], effect: { hp: -18, rep: -12 }, log: "분류가 다릅니다." },
                { text: wrongs[1], effect: { hp: -18, rep: -12 }, log: "분류가 다릅니다." },
                { text: wrongs[2], effect: { hp: -18, rep: -12 }, log: "분류가 다릅니다." }
            ]) };
    }

    function generateVentilatorSettingQuestion() {
        return { baseId: "ventilator", category: "성인간호학", part: "기계환기", emoji: "🫁", title: "Ventilator 알람 — high pressure",
            desc: `Ventilator 환자 갑작스러운 high pressure 알람 + SpO2 88%. 우선 평가는?`,
            choices: shuffle([
                { text: "DOPE 평가 — Displacement(튜브)·Obstruction(분비물·꺾임)·Pneumothorax·Equipment 점검 후 의사 콜", correct: true, effect: { hp: -3, rep: 25 }, log: "정답. Ventilator 응급 평가 표준 (DOPE)." },
                { text: "알람 음소거 + 관찰", effect: { hp: -38, rep: -32 }, log: "알람 무시 = 환자 위해." },
                { text: "Ventilator setting 즉시 변경", effect: { hp: -28, rep: -22 }, log: "원인 평가 후 setting 조정." },
                { text: "흡인 강하게 반복", effect: { hp: -22, rep: -16 }, log: "원인 평가 후 단계적 조치." }
            ]) };
    }

    function generateNeonatalVitalsQuestion() {
        return { baseId: "neonatal_vitals", category: "아동간호학", part: "신생아 활력징후", emoji: "👶", title: "신생아 정상 활력징후",
            desc: `생후 1일 신생아의 정상 활력징후 범위는?`,
            choices: shuffle([
                { text: "HR 110~160 / RR 30~60 / BP 70/40 / 체온 36.5~37.5℃", correct: true, effect: { hp: -2, rep: 22 }, log: "정답. 신생아 정상 활력 표준." },
                { text: "HR 60~100 / RR 12~20 / BP 120/80 (성인 기준)", effect: { hp: -22, rep: -16 }, log: "성인 기준." },
                { text: "HR 200~250 / RR 80~100 / BP 50/30", effect: { hp: -22, rep: -16 }, log: "비정상 범위." },
                { text: "HR 80~120 / RR 20~30 (학령기 기준)", effect: { hp: -18, rep: -12 }, log: "학령기 기준." }
            ]) };
    }

    function generateIVExtravasationQuestion() {
        return { baseId: "iv_extra", category: "기본간호학", part: "정맥주사", emoji: "💉", title: "정맥주사 외삼출 (비-발포제)",
            desc: `일반 항생제 IV 도중 환자가 \"주사 부위 부어요\" 호소. 부위 부종 + 발적. 우선 조치는?`,
            choices: shuffle([
                { text: "즉시 주입 중단 + 카테터 제거 + 거상 + 차가운 찜질 + 의사 보고 + 사정·기록", correct: true, effect: { hp: -2, rep: 22 }, log: "정답. 비-발포제 외삼출 표준 (발포제는 다름)." },
                { text: "주입 그대로 계속", effect: { hp: -32, rep: -28 }, log: "조직 손상 가속." },
                { text: "마사지로 분산 시도", effect: { hp: -28, rep: -22 }, log: "조직 손상 가속." },
                { text: "따뜻한 찜질 적용", effect: { hp: -22, rep: -16 }, log: "비-발포제는 차가운 찜질." }
            ]) };
    }

    function generateGastricLavageQuestion() {
        return { baseId: "gastric_lavage", category: "성인간호학", part: "중독 응급", emoji: "🚰", title: "위세척 vs 활성탄 적응증",
            desc: `Acetaminophen 50정 복용 후 1시간 도착 환자 (의식 명료). 우선 처치는?`,
            choices: shuffle([
                { text: "활성탄 1g/kg 경구 (복용 후 1시간 이내) + NAC 준비 + 정신과 협진", correct: true, effect: { hp: -3, rep: 25 }, log: "정답. 활성탄은 1시간 이내 효과적. 위세척은 제한적 적응증." },
                { text: "위세척 즉시 시행", effect: { hp: -25, rep: -20 }, log: "위세척은 합병증 위험. 활성탄이 1차." },
                { text: "구토 유발 (ipecac)", effect: { hp: -32, rep: -28 }, log: "Ipecac 은 더 이상 권장되지 않음." },
                { text: "관찰만 진행", effect: { hp: -38, rep: -32 }, log: "치료 지연 = 간독성." }
            ]) };
    }

    function generateVTEPreventionQuestion() {
        return { baseId: "vte_prevention", category: "성인간호학", part: "VTE 예방", emoji: "🦵", title: "수술 후 VTE 예방",
            desc: `고관절 치환술 후 환자의 VTE 예방으로 가장 적절한 것은?`,
            choices: shuffle([
                { text: "조기 보행 + TED 스타킹/공기 압박 (IPC) + 저분자량 헤파린 (LMWH) 피하 주사 + 수액 관리", correct: true, effect: { hp: -2, rep: 25 }, log: "정답. ACCP CHEST 가이드 VTE 예방 표준." },
                { text: "절대 침상 안정", effect: { hp: -32, rep: -28 }, log: "VTE 위험 가속." },
                { text: "Aspirin 만 단독", effect: { hp: -22, rep: -16 }, log: "고위험 수술은 LMWH 권장." },
                { text: "수술 후 VTE 예방 불필요", effect: { hp: -38, rep: -32 }, log: "고관절은 VTE 고위험군." }
            ]) };
    }

    function generateSterileGownQuestion() {
        return { baseId: "sterile_gown", category: "기본간호학", part: "무균술", emoji: "🥼", title: "무균 가운 착용 순서",
            desc: `수술실 무균 가운 착용 시 올바른 순서는?`,
            choices: shuffle([
                { text: "외과적 손씻기 → 가운 착용 (안쪽만 만짐) → 손 가운 소매로 → 장갑 (closed gloving) → 어시스턴트가 뒤 끈 묶음", correct: true, effect: { hp: -2, rep: 25 }, log: "정답. AORN 무균 가운 표준 순서." },
                { text: "장갑 → 가운 → 손씻기", effect: { hp: -32, rep: -28 }, log: "순서 위반 = 무균 파괴." },
                { text: "본인이 모든 끈을 직접 묶음", effect: { hp: -28, rep: -22 }, log: "뒤 끈은 어시스턴트." },
                { text: "가운 바깥쪽을 잡고 입음", effect: { hp: -28, rep: -22 }, log: "바깥쪽은 멸균 영역." }
            ]) };
    }

    function generateNutritionalAssessmentQuestion() {
        return { baseId: "nutrition_assess", category: "기본간호학", part: "영양 평가", emoji: "🍎", title: "영양 위험 사정 (MUST/NRS-2002)",
            desc: `입원 시 환자 BMI 17 + 최근 3개월 체중 12% 감소 + 식사 거의 못 함. 영양 평가 결과는?`,
            choices: shuffle([
                { text: "고영양위험 — 영양 상담 협진 + 영양보충제 + 식이 평가 + 필요시 경관/TPN 검토", correct: true, effect: { hp: -3, rep: 25 }, log: "정답. MUST/NRS-2002 고영양위험 표준 중재." },
                { text: "정상 — 관찰", effect: { hp: -32, rep: -28 }, log: "고위험군 누락." },
                { text: "강제 식이만 권유", effect: { hp: -22, rep: -16 }, log: "원인 평가 + 다학제 필요." },
                { text: "TPN 즉시 시작", effect: { hp: -25, rep: -20 }, log: "경구/경관 우선." }
            ]) };
    }

    function generateMoCAQuestion() {
        return { baseId: "moca", category: "정신간호학", part: "인지 평가", emoji: "🧠", title: "MoCA 점수 해석",
            desc: `노인 환자 MoCA 22점 (정상 ≥26). 적절한 다음 단계는?`,
            choices: shuffle([
                { text: "경도 인지 장애 의심 — 신경과/정신과 협진 + 가역적 원인 평가 (약물·우울·갑상선) + 후속 추적", correct: true, effect: { hp: -3, rep: 25 }, log: "정답. MoCA <26 은 MCI/치매 의심. 가역적 원인 평가 우선." },
                { text: "정상 — 추가 평가 불필요", effect: { hp: -25, rep: -20 }, log: "기준 미만." },
                { text: "치매 확진 + 가족 통보", effect: { hp: -28, rep: -22 }, log: "MoCA 단독으로 진단 불가." },
                { text: "약물 즉시 시작", effect: { hp: -25, rep: -20 }, log: "전문가 평가 + 진단 후 약물." }
            ]) };
    }

    // ── v1.2 특수 영역 라운드 (12 — 종양·면역·약물·기기·법규) ──────────────

    function generateTLSQuestion() {
        return { baseId: "tls", category: "성인간호학", part: "종양 응급", emoji: "🧪", title: "종양 용해 증후군(TLS)",
            desc: `급성 백혈병 환자 항암 후 24시간 — K+ 6.8 / 인산 8 / Ca 7.0 / 요산 12 / Cr 2.5. 우선 중재는?`,
            choices: shuffle([
                { text: "TLS 진단 — IV 수액 (3L/d) + Rasburicase/Allopurinol + 전해질 교정 + 신장내과·종양내과 협진", correct: true, effect: { hp: -3, rep: 28 }, log: "정답. TLS 표준 (Cairo-Bishop 기준)." },
                { text: "단순 신부전으로 보고 수액 제한", effect: { hp: -32, rep: -28 }, log: "수액 부하가 표준." },
                { text: "K+ 만 즉시 calcium gluconate", effect: { hp: -22, rep: -16 }, log: "통합 대사 위기 관리." },
                { text: "관찰 + 다음 검사", effect: { hp: -38, rep: -32 }, log: "TLS 는 응급 — 사망률 높음." }
            ]) };
    }

    function generateSJSQuestion() {
        return { baseId: "sjs", category: "성인간호학", part: "약물 알레르기", emoji: "🚨", title: "스티븐스-존슨 증후군(SJS)",
            desc: `Lamotrigine 시작 2주 후 환자 — 입술 점막 궤양 + 광범위 발진 + 결막 충혈 + 발열. 의심 진단·우선 처치는?`,
            choices: shuffle([
                { text: "SJS 의심 — 즉시 원인 약물 중단 + 화상 병동 수준 케어 + 안과·피부과 협진 + 수액·통증·감염 관리", correct: true, effect: { hp: -5, rep: 30 }, log: "정답. SJS 는 사망률 5~15% — 즉시 약물 중단 + 다학제." },
                { text: "단순 약물 발진으로 보고 항히스타민만", effect: { hp: -38, rep: -32 }, log: "SJS 진단 누락 = 사망." },
                { text: "약물 그대로 + 발진 관찰", effect: { hp: -45, rep: -42 }, log: "범위 확장 = TEN(독성표피괴사) 진행." },
                { text: "스테로이드 IV 만 단독", effect: { hp: -28, rep: -22 }, log: "다학제 화상 수준 케어가 표준." }
            ]) };
    }

    function generateUTIElderlyQuestion() {
        return { baseId: "uti_elderly", category: "성인간호학", part: "비뇨기", emoji: "🚽", title: "노인 요로감염 — 비특이적 증상",
            desc: `82세 여성 갑작스러운 의식 혼란 + 발열 없음 + 식욕 감소. 가족 \"갑자기 이상해요\". 의심 진단은?`,
            choices: shuffle([
                { text: "노인 UTI 의심 — 소변 검사 + 배양 + 항생제 처방 검토 + 수액 + 가역적 섬망 원인 평가", correct: true, effect: { hp: -3, rep: 25 }, log: "정답. 노인은 발열 없이 의식 변화로 UTI 발현 흔함." },
                { text: "치매 진행으로 단정", effect: { hp: -32, rep: -28 }, log: "가역적 원인 평가 누락." },
                { text: "수면제 처방으로 진정", effect: { hp: -28, rep: -22 }, log: "원인 평가 + 약물 부작용 위험." },
                { text: "단순 노화로 무시", effect: { hp: -25, rep: -20 }, log: "비특이적 증상 = 평가 필수." }
            ]) };
    }

    function generateLupusFlareQuestion() {
        return { baseId: "sle_flare", category: "성인간호학", part: "자가면역", emoji: "🦋", title: "전신홍반루푸스(SLE) 악화",
            desc: `SLE 환자 — 발열·관절통·뺨 발진·단백뇨 3+ + Cr 1.8 (이전 0.9). 의심·우선 중재는?`,
            choices: shuffle([
                { text: "SLE 신장 침범(lupus nephritis) 의심 — 류마티스·신장 협진 + 고용량 스테로이드 + 면역억제 검토", correct: true, effect: { hp: -3, rep: 28 }, log: "정답. SLE 신염은 응급 — 신부전 진행 예방." },
                { text: "단순 감기로 해열제만", effect: { hp: -32, rep: -28 }, log: "악화 신호 무시." },
                { text: "관찰 + 다음 외래", effect: { hp: -28, rep: -22 }, log: "신장 침범 = 응급." },
                { text: "NSAIDs 처방 추가", effect: { hp: -25, rep: -20 }, log: "신장 부담 가속." }
            ]) };
    }

    function generateNeonatalHypoglycemiaQuestion() {
        return { baseId: "neonatal_hypo", category: "모성간호학", part: "신생아", emoji: "🍼", title: "신생아 저혈당 응급",
            desc: `GDM 산모 신생아 출생 1시간 — 떨림 + 처짐 + 혈당 30 mg/dL. 우선 중재는?`,
            choices: shuffle([
                { text: "조기 모유수유/분유 + 재측정 + 혈당 <40 지속 시 D10W IV bolus + NICU 협진", correct: true, effect: { hp: -3, rep: 25 }, log: "정답. 신생아 저혈당 단계적 알고리듬." },
                { text: "정상 신생아 변동으로 관찰", effect: { hp: -38, rep: -32 }, log: "신경 손상 위험." },
                { text: "포도당 사탕을 입에 넣기", effect: { hp: -32, rep: -28 }, log: "흡인 + 절대 금기." },
                { text: "체온 보온만 강화", effect: { hp: -28, rep: -22 }, log: "체온은 동반 평가 — 혈당이 우선." }
            ]) };
    }

    function generateBreastfeedingDrugQuestion() {
        const cases = [
            { drug: "Acetaminophen", compat: "수유 호환 (안전)", wrong: ["수유 절대 금기", "수유 24시간 중단 후 가능", "용량 절반만 사용"] },
            { drug: "Warfarin", compat: "수유 호환 (분비 극소량)", wrong: ["수유 절대 금기", "수유 1주 중단 후 가능", "신생아 출혈 위험으로 절대 금기"] },
            { drug: "Lithium", compat: "주의 — 신생아 추적 + 의사 상담 후 결정", wrong: ["수유 완전 호환", "단순 부작용 없음", "수유 전 약 끊기만"] },
            { drug: "Codeine", compat: "회피 (CYP2D6 빠른 대사자 시 신생아 호흡억제)", wrong: ["수유 완전 호환", "산모 표준 용량 안전", "신생아 진통 효과 있어 권장"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "bf_drug", category: "모성간호학", part: "모유수유 약물", emoji: "💊", title: "모유수유 중 약물 안전성",
            desc: `${c.drug} 의 모유수유 호환성은?`,
            choices: shuffle([
                { text: c.compat, correct: true, effect: { hp: -2, rep: 22 }, log: `정답. LactMed/AAP 기준.` },
                { text: wrongs[0], effect: { hp: -22, rep: -16 }, log: "약물 호환성 판단 오류." },
                { text: wrongs[1], effect: { hp: -22, rep: -16 }, log: "약물 호환성 판단 오류." },
                { text: wrongs[2], effect: { hp: -22, rep: -16 }, log: "약물 호환성 판단 오류." }
            ]) };
    }

    function generateADHDQuestion() {
        return { baseId: "adhd", category: "아동간호학", part: "정신·행동", emoji: "🧒", title: "ADHD 아동 학교생활 적응",
            desc: `초등 3년 ADHD 진단 아동 — 학교 집중 어려움 + 친구 갈등. 부모 \"약 안 먹이면 안 될까요?\" 호소.`,
            choices: shuffle([
                { text: "약물 + 행동 치료 + 학교 협력 (교실 조정·또래 멘토) + 가족 교육 통합 — 다층 접근", correct: true, effect: { hp: -2, rep: 25 }, log: "정답. ADHD 는 약물 단독보다 다층 접근이 효과적." },
                { text: "약물 무조건 강력 권유", effect: { hp: -22, rep: -16 }, log: "환자/가족 자율성 침해." },
                { text: "약물 없이 자연 회복 권유", effect: { hp: -25, rep: -20 }, log: "중증도에 따른 결정." },
                { text: "강제 학교 변경 요구", effect: { hp: -22, rep: -16 }, log: "환경 + 치료 통합 우선." }
            ]) };
    }

    function generatePedsLeukemiaQuestion() {
        return { baseId: "peds_leukemia", category: "아동간호학", part: "혈액종양", emoji: "🩸", title: "소아 백혈병 항암 — 감염 예방",
            desc: `ALL 항암 중 5세 아동 ANC 200 (중증 호중구 감소). 가족 \"외출 가능해요?\" 라며 질문.`,
            choices: shuffle([
                { text: "엄격한 감염 예방 — 외출 자제 + 마스크 + 손위생 + 발열 즉시 응급실 + 무균 식이 + 가족 교육", correct: true, effect: { hp: -3, rep: 25 }, log: "정답. 소아 항암 중 ANC <500 은 중증 호중구 감소." },
                { text: "일반 외출 가능 안내", effect: { hp: -35, rep: -30 }, log: "감염 = 사망 위험." },
                { text: "약물만 강조하고 환경은 무관", effect: { hp: -22, rep: -16 }, log: "환경 + 약물 통합." },
                { text: "예방접종 즉시 시행", effect: { hp: -25, rep: -20 }, log: "호중구 감소 시 생백신 금기." }
            ]) };
    }

    function generateOCDQuestion() {
        return { baseId: "ocd", category: "정신간호학", part: "강박장애", emoji: "🔁", title: "강박장애(OCD) 환자 케어",
            desc: `OCD 환자 손씻기 강박 (1시간 손씻기) 입원. \"안 씻으면 더러워서 죽을 거 같아요\" 호소.`,
            choices: shuffle([
                { text: "비판단 + 정서 지지 + 노출·반응 방지(ERP) 치료 + SSRI + 인지행동치료(CBT) 다학제", correct: true, effect: { hp: -2, rep: 28 }, log: "정답. OCD 는 ERP + CBT + 약물 표준 (APA)." },
                { text: "손씻기 강제 금지 + 격리", effect: { hp: -32, rep: -28 }, log: "강제는 불안 + 신뢰 손상." },
                { text: "환자 요구대로 손씻기 무제한 허용", effect: { hp: -22, rep: -16 }, log: "강박 행동 강화." },
                { text: "단순 잠시 휴식 권유", effect: { hp: -22, rep: -16 }, log: "전문 치료 필요." }
            ]) };
    }

    function generateForeignerCareQuestion() {
        return { baseId: "foreigner_care", category: "지역사회간호학", part: "외국인 의료", emoji: "🌐", title: "외국인 환자 의료 접근성",
            desc: `미등록 외국인 노동자 응급실 도착 — 충수염 의심. \"비용이 무서워서 가지 않으려 했어요\" 호소.`,
            choices: shuffle([
                { text: "의료 처치 우선 + 사회복지·외국인노동자센터·소외계층 의료 지원 자원 연계 + 통역 + 환자 안심", correct: true, effect: { hp: -3, rep: 28 }, log: "정답. 응급의료법 + 외국인 권리 보장." },
                { text: "비용 동의 없으면 진료 거부", effect: { hp: -42, rep: -38 }, log: "응급의료법 위반." },
                { text: "출입국 신고 후 진료", effect: { hp: -38, rep: -32 }, log: "의료-법 분리. 의료 우선." },
                { text: "환자 자율 결정에 맡김", effect: { hp: -32, rep: -28 }, log: "응급 상황 + 정보 제공 의무." }
            ]) };
    }

    function generateMedicalDeviceQuestion() {
        return { baseId: "medical_device", category: "간호관리학", part: "의료기기 관리", emoji: "🔧", title: "의료기기 안전 사고 대응",
            desc: `Infusion pump 알람 후 환자 부작용 의심. 기기 오류 가능. 우선 조치는?`,
            choices: shuffle([
                { text: "기기 즉시 분리 + 환자 안전 평가 + 기기 보존 (조사용) + 의사 보고 + 의료기기 사고 보고", correct: true, effect: { hp: -3, rep: 25 }, log: "정답. 의료기기 사고 대응 표준 — 식약처 보고 의무." },
                { text: "단순 알람으로 무시", effect: { hp: -32, rep: -28 }, log: "환자 안전 위협." },
                { text: "기기 분리 후 폐기", effect: { hp: -28, rep: -22 }, log: "보존 + 조사 필요." },
                { text: "환자에게 책임 운운", effect: { hp: -32, rep: -28 }, log: "이차 피해." }
            ]) };
    }

    function generateHospiceLawQuestion() {
        return { baseId: "hospice_law", category: "보건의약관계법규", part: "호스피스법", emoji: "🕊️", title: "호스피스·완화의료법 적용",
            desc: `호스피스·완화의료에 관한 법률상 대상자 범위는?`,
            choices: shuffle([
                { text: "말기 + 임종기 환자 (암·AIDS·만성폐쇄성폐질환·만성간경화 등) + 환자/대리인 동의", correct: true, effect: { hp: -2, rep: 22 }, log: "정답. 호스피스법 적용 범위." },
                { text: "암 환자만 가능", effect: { hp: -22, rep: -16 }, log: "대상 질환 확장됨." },
                { text: "환자 동의 없이 가족 결정", effect: { hp: -28, rep: -22 }, log: "본인 의사 우선." },
                { text: "65세 이상에게만 적용", effect: { hp: -22, rep: -16 }, log: "연령 제한 없음." }
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
        // v1.1 (기본+모성+아동+정신+지역+관리+법규+성인)
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
        // 비율 보정
        generateConflictMgmtQuestion, generateNursingRecordQuestion, generateStaffingMixQuestion,
        generateCBTechniqueQuestion, generateAddictionQuestion,
        generateSchoolHealthQuestion, generateHomeCareQuestion,
        generateFHRDecelQuestion, generatePedsRespQuestion,
        // v1.2 이미지 기반
        generateECGStripQuestion, generatePupilAssessQuestion,
        generateGCSAssessQuestion, generateAEDPadQuestion, generateFundalHeightQuestion,
        generateApgarVisualQuestion, generateAuscultationQuestion, generateKramerJaundiceQuestion,
        // v1.2 다양성 라운드 (응급/노인/약물/검사/윤리/다문화 12종)
        generateHospicePainQuestion, generateDNRQuestion, generateBeersCriteriaQuestion,
        generateHypothermiaQuestion, generateHeatStrokeQuestion, generateAnaphylaxisDrugQuestion,
        generateNaloxoneQuestion, generateChemoExtravasationQuestion, generateCBCInterpretationQuestion,
        generateDiabetesEducationQuestion, generateStomaCareQuestion,
        generateInformedConsentQuestion, generateMultiCulturalQuestion,
        // v1.2 균형 보정 라운드 (모성+4 / 아동+4 / 정신+4 / 지역+3 / 관리+3 / 법규+2)
        generateGestationalDMQuestion, generatePostpartumDepressionQuestion,
        generateRhIncompatibilityQuestion, generateNeonatalResuscitationQuestion,
        generateKawasakiQuestion, generateChildAsthmaQuestion,
        generateChildAbuseQuestion, generateChildDevelopmentQuestion,
        generateAnxietyDisorderQuestion, generatePTSDQuestion,
        generateEatingDisorderQuestion, generateDementiaBehaviorQuestion,
        generateCovidIsolationQuestion, generateOlderAdultScreeningQuestion,
        generateMaternalHealthCenterQuestion,
        generateTimemanagementQuestion, generateNurseHandoffQuestion,
        generateCostEffectivenessQuestion,
        generateConfidentialityLawQuestion, generateAdvancedDirectiveLawQuestion,
        // v1.2 평가 도구·임상 표준 라운드 (15)
        generateKTASQuestion, generateAldreteScoreQuestion, generateMorseFallScaleQuestion,
        generateBradenScaleQuestion, generateSilvermanScoreQuestion, generateBloodTypeQuestion,
        generateDrugScheduleQuestion, generateVentilatorSettingQuestion, generateNeonatalVitalsQuestion,
        generateIVExtravasationQuestion, generateGastricLavageQuestion, generateVTEPreventionQuestion,
        generateSterileGownQuestion, generateNutritionalAssessmentQuestion, generateMoCAQuestion,
        // v1.2 특수 영역 (12)
        generateTLSQuestion, generateSJSQuestion, generateUTIElderlyQuestion, generateLupusFlareQuestion,
        generateNeonatalHypoglycemiaQuestion, generateBreastfeedingDrugQuestion,
        generateADHDQuestion, generatePedsLeukemiaQuestion,
        generateOCDQuestion, generateForeignerCareQuestion,
        generateMedicalDeviceQuestion, generateHospiceLawQuestion,
    ];

    function generateECGStripQuestion() {
        const rhythms = [
            { key: "normal", name: "정상 동성리듬 (NSR)", wrongs: ["심방세동", "심실세동", "심실빈맥"] },
            { key: "vfib", name: "심실세동 (VFib)", wrongs: ["정상 동성리듬", "심방세동", "1차 방실차단"] },
            { key: "vtach", name: "심실빈맥 (VTach)", wrongs: ["심방세동", "정상 동성리듬", "무수축"] },
            { key: "afib", name: "심방세동 (AFib)", wrongs: ["정상 동성리듬", "심실세동", "심실빈맥"] },
            { key: "asystole", name: "무수축 (Asystole)", wrongs: ["심실세동", "정상 동성리듬", "심방세동"] },
            { key: "stemi", name: "ST 분절 상승 (STEMI)", wrongs: ["정상 동성리듬", "심실세동", "심방세동"] },
        ];
        const r = pick(rhythms);
        const wrongs = shuffle(r.wrongs);
        return { baseId: "ecg_id", category: "성인간호학", part: "심전도 판독", emoji: "💗", title: "ECG strip 식별",
            image: `ecg:${r.key}`,
            desc: `위 심전도 strip 의 리듬은?`,
            choices: shuffle([
                { text: r.name, correct: true, effect: { hp: -2, rep: 22 }, log: `정답. ${r.name} 의 특징적 strip 입니다.` },
                { text: wrongs[0], effect: { hp: -22, rep: -16 }, log: "리듬 식별 오류입니다." },
                { text: wrongs[1], effect: { hp: -22, rep: -16 }, log: "리듬 식별 오류입니다." },
                { text: wrongs[2], effect: { hp: -22, rep: -16 }, log: "리듬 식별 오류입니다." }
            ]) };
    }

    function generatePupilAssessQuestion() {
        const cases = [
            { L: 3, R: 3, finding: "정상 동공 (양측 3mm, 등크기)", action: "정상 — 추가 평가 불필요", wrong: ["즉시 신경외과 호출", "Mannitol IV bolus", "Atropine 점안"] },
            { L: 5, R: 3, finding: "동공 부등 — 좌 5mm, 우 3mm", action: "두개내 출혈/탈출 의심 — 즉시 신경외과 호출 + CT", wrong: ["정상 변이 — 관찰", "안약 점안", "수면제 투여"] },
            { L: 7, R: 7, finding: "양측 산대 고정 (각 7mm)", action: "심한 뇌손상 또는 사망 임박 — ACLS + 응급 의사 호출", wrong: ["관찰만 진행", "수액 부하만 시행", "정상 변이로 판단"] },
            { L: 1, R: 1, finding: "양측 축동 (각 1mm)", action: "마약성 진통제 과량 또는 뇌교 손상 — naloxone 고려 + 의사 보고", wrong: ["밝은 조명 노출", "epinephrine 점안", "단순 수면 상태로 관찰"] },
        ];
        const c = pick(cases);
        const wrongs = shuffle(c.wrong);
        return { baseId: "pupil", category: "성인간호학", part: "신경학적 사정", emoji: "👁️", title: "동공 사정 결과 해석",
            image: `pupil:${c.L},${c.R}`,
            desc: `${c.finding} 의 환자에 대한 우선 중재는?`,
            choices: shuffle([
                { text: c.action, correct: true, effect: { hp: -3, rep: 22 }, log: `정답. ${c.finding} 에 대한 표준 중재입니다.` },
                { text: wrongs[0], effect: { hp: -25, rep: -18 }, log: "동공 사정 해석 오류입니다." },
                { text: wrongs[1], effect: { hp: -25, rep: -18 }, log: "동공 사정 해석 오류입니다." },
                { text: wrongs[2], effect: { hp: -25, rep: -18 }, log: "동공 사정 해석 오류입니다." }
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
        generateECGStripQuestion, generatePupilAssessQuestion,
        generateGCSAssessQuestion, generateAEDPadQuestion, generateFundalHeightQuestion,
        generateApgarVisualQuestion, generateAuscultationQuestion, generateKramerJaundiceQuestion,
        generateHospicePainQuestion, generateDNRQuestion, generateBeersCriteriaQuestion,
        generateHypothermiaQuestion, generateHeatStrokeQuestion, generateAnaphylaxisDrugQuestion,
        generateNaloxoneQuestion, generateChemoExtravasationQuestion, generateCBCInterpretationQuestion,
        generateDiabetesEducationQuestion, generateStomaCareQuestion,
        generateInformedConsentQuestion, generateMultiCulturalQuestion,
        // v1.2 균형 보정 (모성+4 / 아동+4 / 정신+4 / 지역+3 / 관리+3 / 법규+2)
        generateGestationalDMQuestion, generatePostpartumDepressionQuestion,
        generateRhIncompatibilityQuestion, generateNeonatalResuscitationQuestion,
        generateKawasakiQuestion, generateChildAsthmaQuestion,
        generateChildAbuseQuestion, generateChildDevelopmentQuestion,
        generateAnxietyDisorderQuestion, generatePTSDQuestion,
        generateEatingDisorderQuestion, generateDementiaBehaviorQuestion,
        generateCovidIsolationQuestion, generateOlderAdultScreeningQuestion,
        generateMaternalHealthCenterQuestion,
        generateTimemanagementQuestion, generateNurseHandoffQuestion,
        generateCostEffectivenessQuestion,
        generateConfidentialityLawQuestion, generateAdvancedDirectiveLawQuestion,
        generateKTASQuestion, generateAldreteScoreQuestion, generateMorseFallScaleQuestion,
        generateBradenScaleQuestion, generateSilvermanScoreQuestion, generateBloodTypeQuestion,
        generateDrugScheduleQuestion, generateVentilatorSettingQuestion, generateNeonatalVitalsQuestion,
        generateIVExtravasationQuestion, generateGastricLavageQuestion, generateVTEPreventionQuestion,
        generateSterileGownQuestion, generateNutritionalAssessmentQuestion, generateMoCAQuestion,
        generateTLSQuestion, generateSJSQuestion, generateUTIElderlyQuestion, generateLupusFlareQuestion,
        generateNeonatalHypoglycemiaQuestion, generateBreastfeedingDrugQuestion,
        generateADHDQuestion, generatePedsLeukemiaQuestion,
        generateOCDQuestion, generateForeignerCareQuestion,
        generateMedicalDeviceQuestion, generateHospiceLawQuestion,
    };
});
