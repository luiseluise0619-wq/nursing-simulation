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
        },
    };

    // 현재 언어 — Storage settings.lang 또는 NCLEX 모드 시 자동 en
    let _lang = "ko";

    function detectLang() {
        try {
            if (typeof window !== "undefined" && window.localStorage) {
                const raw = window.localStorage.getItem("nurseSim:v1");
                if (raw) {
                    const data = JSON.parse(raw);
                    if (data && data.settings && data.settings.lang === "en") return "en";
                    // 자동: NCLEX 모드면 영어 UI 옵션
                    // (사용자가 명시 설정 안 했어도 NCLEX 진입 시 자동 영어로 안내 가능)
                }
            }
            // 브라우저 기본 언어
            const nav = (typeof navigator !== "undefined" && navigator.language) || "ko";
            return nav.startsWith("en") ? "en" : "ko";
        } catch { return "ko"; }
    }

    function setLang(lang) {
        if (lang === "ko" || lang === "en") _lang = lang;
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
