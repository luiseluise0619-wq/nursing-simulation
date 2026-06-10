// 다국어 (i18n) 시스템 — 시장 확장 (Korean + English)
// 사용: t("key") → 현재 언어 문자열 반환. 키 없으면 Korean 폴백.
(function() {
    const STRINGS = {
        ko: {
            // 메뉴 / 탭
            "menu.home": "홈",
            "menu.study": "학습",
            "menu.my": "내 기록",
            // 학습 탭
            "study.practice": "풀이",
            "study.practice.sub": "과목별 · 모의고사 · 일일",
            "study.simulation": "시뮬레이션",
            "study.simulation.sub": "에피소드 · 짧은 시나리오 · 듀티",
            "study.drills": "훈련",
            "study.drills.sub": "이미지 · 약물 · 인계 · 트리아지",
            "study.nclex.sub": "NCLEX · 과목별 · 모의고사",
            // 공통 액션
            "action.back": "메뉴",
            "action.next": "다음 →",
            "action.close": "닫기",
            "action.retry": "다시 시도",
            "action.start": "시작",
            "action.continue": "계속하기",
            // 일반
            "common.loading": "로딩 중...",
            "common.error": "오류가 발생했습니다.",
            "common.correct": "✅ 정답",
            "common.wrong": "❌ 오답",
            // 듀티
            "duty.start": "지금 시작",
            "duty.title": "오늘의 듀티",
            "duty.sub": "환자 관리하며 점수 쌓기",
            // 일일
            "daily.title": "일일 챌린지",
            "daily.done": "완료",
            // 오답
            "wrong.review": "오답 복습",
            "wrong.review.sub": "틀렸던 문제 다시 풀기",
            // NCLEX 콜아웃 (한국 모드)
            "nclex.callout.label": "NCLEX-RN",
            "nclex.callout.questions": "문항",
            "nclex.callout.sub": "100% 무료 · MCQ + SATA + 우선순위",
            // D-day 카운트다운 (참고)
            "countdown.exam": "국시까지",
            "countdown.dday": "D-day",
            "countdown.cheer": "고생했어요!",
            "countdown.afterExam": "결과 발표를 기다려요",
        },
        en: {
            "menu.home": "Home",
            "menu.study": "Study",
            "menu.my": "My Record",
            "study.practice": "Practice",
            "study.practice.sub": "Subject · Mock · Daily",
            "study.simulation": "Simulation",
            "study.simulation.sub": "Episodes · Scenarios · Duty",
            "study.drills": "Drills",
            "study.drills.sub": "Images · Drugs · Handoff · Triage",
            "study.nclex.sub": "NCLEX · Subjects · Mock",
            "action.back": "Menu",
            "action.next": "Next →",
            "action.close": "Close",
            "action.retry": "Retry",
            "action.start": "Start",
            "action.continue": "Continue",
            "common.loading": "Loading...",
            "common.error": "An error occurred.",
            "common.correct": "✅ Correct",
            "common.wrong": "❌ Incorrect",
            "duty.start": "Start now",
            "duty.title": "Today's Duty",
            "duty.sub": "Manage patients, earn points",
            "daily.title": "Daily Challenge",
            "daily.done": "Done",
            "wrong.review": "Review Mistakes",
            "wrong.review.sub": "Re-attempt missed questions",
            // NCLEX marketing — primary user segment for English mode
            "nclex.callout.label": "NCLEX-RN",
            "nclex.callout.questions": "Questions",
            "nclex.callout.sub": "100% Free · MCQ + SATA + Priority",
            "nclex.hero.title": "2,200 NCLEX-RN Questions — Free",
            "nclex.hero.sub": "Study anywhere · No signup · No paywall",
            // Marketing taglines (visible in NCLEX mode)
            "marketing.usp.free": "Completely Free",
            "marketing.usp.noads": "Rewarded ads only (optional)",
            "marketing.usp.offline": "Works offline (PWA)",
            // D-day
            "countdown.exam": "Until Exam",
            "countdown.dday": "Exam day",
            "countdown.cheer": "Great job!",
            "countdown.afterExam": "Waiting for results",
        },
        // Filipino (Tagalog) — NCLEX 큰 시장 (필리핀 간호사 미국 진출 다수)
        fil: {
            "menu.home": "Tahanan",
            "menu.study": "Pag-aaral",
            "menu.my": "Aking Tala",
            "study.practice": "Sanayan",
            "study.practice.sub": "Asignatura · Mock · Araw-araw",
            "study.simulation": "Simulasyon",
            "study.simulation.sub": "Episode · Senaryo · Duty",
            "study.drills": "Drills",
            "study.drills.sub": "Larawan · Gamot · Handoff · Triage",
            "study.nclex.sub": "NCLEX · Asignatura · Mock",
            "action.back": "Menu",
            "action.next": "Susunod →",
            "action.close": "Isara",
            "action.retry": "Subukan muli",
            "action.start": "Simulan",
            "action.continue": "Magpatuloy",
            "common.loading": "Naglo-load...",
            "common.error": "May naganap na error.",
            "common.correct": "✅ Tama",
            "common.wrong": "❌ Mali",
            "duty.start": "Simulan ngayon",
            "duty.title": "Duty Ngayon",
            "duty.sub": "Pangasiwaan ang mga pasyente",
            "daily.title": "Araw-araw na Hamon",
            "daily.done": "Tapos na",
            "wrong.review": "I-review ang Mali",
            "wrong.review.sub": "Subukan muli ang mga nakaligtaan",
            // NCLEX marketing — for Filipino nurses preparing for US migration
            "nclex.callout.label": "NCLEX-RN",
            "nclex.callout.questions": "Tanong",
            "nclex.callout.sub": "100% Libre · MCQ + SATA + Priority",
            "nclex.hero.title": "2,200 NCLEX-RN Tanong — Libre",
            "nclex.hero.sub": "Mag-aral kahit saan · Walang signup",
            "marketing.usp.free": "Ganap na Libre",
            "marketing.usp.noads": "Boluntaryong reklamo lamang",
            "marketing.usp.offline": "Gumagana offline (PWA)",
            "countdown.exam": "Hanggang sa Pagsusulit",
            "countdown.dday": "Araw ng Pagsusulit",
            "countdown.cheer": "Magaling!",
            "countdown.afterExam": "Hinihintay ang resulta",
        },
        // Español — NCLEX hispano + Latin nursing market
        es: {
            "menu.home": "Inicio",
            "menu.study": "Estudio",
            "menu.my": "Mi Registro",
            "study.practice": "Práctica",
            "study.practice.sub": "Materia · Examen · Diario",
            "study.simulation": "Simulación",
            "study.simulation.sub": "Episodios · Escenarios · Turno",
            "study.drills": "Ejercicios",
            "study.drills.sub": "Imágenes · Fármacos · Pase · Triaje",
            "study.nclex.sub": "NCLEX · Materias · Examen",
            "action.back": "Menú",
            "action.next": "Siguiente →",
            "action.close": "Cerrar",
            "action.retry": "Reintentar",
            "action.start": "Empezar",
            "action.continue": "Continuar",
            "common.loading": "Cargando...",
            "common.error": "Ocurrió un error.",
            "common.correct": "✅ Correcto",
            "common.wrong": "❌ Incorrecto",
            "duty.start": "Empezar ahora",
            "duty.title": "Turno de hoy",
            "duty.sub": "Gestiona pacientes, gana puntos",
            "daily.title": "Reto Diario",
            "daily.done": "Hecho",
            "wrong.review": "Revisar Errores",
            "wrong.review.sub": "Volver a intentar las erradas",
            // NCLEX marketing — Hispanic nurses preparing for NCLEX
            "nclex.callout.label": "NCLEX-RN",
            "nclex.callout.questions": "Preguntas",
            "nclex.callout.sub": "100% Gratis · MCQ + SATA + Prioridad",
            "nclex.hero.title": "2,200 Preguntas NCLEX-RN — Gratis",
            "nclex.hero.sub": "Estudia donde sea · Sin registro",
            "marketing.usp.free": "Totalmente Gratis",
            "marketing.usp.noads": "Solo anuncios con recompensa",
            "marketing.usp.offline": "Funciona sin conexión (PWA)",
            "countdown.exam": "Hasta el examen",
            "countdown.dday": "Día del examen",
            "countdown.cheer": "¡Buen trabajo!",
            "countdown.afterExam": "Esperando resultados",
        },
    };

    // 현재 언어 — Storage settings.lang 또는 NCLEX 모드 시 자동 en
    let _lang = "ko";

    const SUPPORTED = ["ko", "en", "fil", "es"];

    function detectLang() {
        try {
            if (typeof window !== "undefined" && window.localStorage) {
                const raw = window.localStorage.getItem("nurseSim:v1");
                if (raw) {
                    const data = JSON.parse(raw);
                    if (data && data.settings && SUPPORTED.includes(data.settings.lang)) {
                        return data.settings.lang;
                    }
                }
            }
            // 브라우저 기본 언어 — 4개 중 매칭
            const nav = ((typeof navigator !== "undefined" && navigator.language) || "ko").toLowerCase();
            if (nav.startsWith("en")) return "en";
            if (nav.startsWith("fil") || nav.startsWith("tl")) return "fil";
            if (nav.startsWith("es")) return "es";
            return "ko";
        } catch { return "ko"; }
    }

    function setLang(lang) {
        if (SUPPORTED.includes(lang)) _lang = lang;
    }

    function t(key, fallback) {
        const dict = STRINGS[_lang] || STRINGS.ko;
        if (key in dict) return dict[key];
        // 폴백: 한국어 → 명시된 폴백 → 키 자체
        if (key in STRINGS.ko) return STRINGS.ko[key];
        return fallback != null ? fallback : key;
    }

    // 초기화 — 브라우저 환경에서 자동 감지
    if (typeof window !== "undefined") {
        _lang = detectLang();
        window.I18N = { t, setLang, detectLang, getLang: () => _lang };
    }
    if (typeof module !== "undefined" && module.exports) {
        module.exports = { t, setLang, detectLang, getLang: () => _lang, STRINGS };
    }
})();
