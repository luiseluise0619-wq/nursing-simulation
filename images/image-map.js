// =========================================================================
// 임상 이미지 매핑 — AI 생성 비트맵 이미지 ↔ image key
// 비트맵 있으면 우선 사용, 없으면 SVG 자동 폴백 (script.js renderClinicalImage)
//
// 자산 출처: Claude 디자인 (SVG 50종) + Gemini 임상 사진 (20종)
// 매핑되지 않은 키는 자동으로 SVG 자체 렌더로 폴백 (안전)
// =========================================================================
(function() {
    const CLINICAL_IMAGE_MAP = {
        // ===== ECG (Gemini, WebP) =====
        "ecg:nsr":      "images/ecg-nsr.webp",
        "ecg:stemi":    "images/ecg-stemi.webp",
        "ecg:vfib":     "images/ecg-vfib.webp",
        "ecg:afib":     "images/ecg-afib.webp",
        "ecg:svt":      "images/ecg-svt.webp",
        "ecg:asystole": "images/ecg-asystole.webp",
        // ecg:vtach — SVG 폴백 사용

        // ===== 청진 (Gemini, WebP) =====
        "ausc:normal":         "images/ausc-normal.webp",
        "ausc:crackle-lower":  "images/ausc-crackles-lower.webp",
        "ausc:wheeze-lower":   "images/ausc-wheeze-lower.webp",
        "ausc:wheeze-diffuse": "images/ausc-wheeze-diffuse.webp",
        "ausc:stridor-upper":  "images/ausc-stridor-upper.webp",

        // ===== 산과 FHR (Gemini, WebP) + 자궁저 (Claude SVG) =====
        "fhr:late":          "images/fhr-late.webp",
        "fhr:early":         "images/fhr-early.webp",
        "fhr:variable":      "images/fhr-variable.webp",
        "fhr:accelerations": "images/fhr-accel.webp",
        "fundal:28":         "images/fundal-28.svg",
        "fundal:30":         "images/fundal-30.svg",
        "fundal:32":         "images/fundal-32.svg",
        "fundal:36":         "images/fundal-36.svg",
        "fundal:40":         "images/fundal-40.svg",

        // ===== 신경 (Claude SVG) =====
        "pupil:anisocoria": "images/pupil-anisocoria.svg",
        "glasgow:low":      "images/glasgow-low.svg",

        // ===== 화상 / 상처 (Claude SVG) =====
        "wound:stage2":   "images/wound-stage2.svg",
        "wound:stage3":   "images/wound-stage3.svg",
        "wound:stage4":   "images/wound-stage4.svg",
        "wound:infected": "images/wound-infected.svg",
        "rule-of-nines":  "images/rule-of-nines.svg",

        // ===== 흉부 X선 (Gemini, WebP) =====
        "cxr:pneumonia":    "images/cxr-pneumonia.webp",
        "cxr:pneumothorax": "images/cxr-pneumothorax.webp",
        "cxr:cardiomegaly": "images/cxr-cardiomegaly.webp",

        // ===== AED (Claude SVG) =====
        "aed:adult": "images/aed-adult.svg",
        "aed:child": "images/aed-child.svg",
        "aed:step1": "images/aed-step1.svg",
        "aed:step2": "images/aed-step2.svg",
        "aed:step3": "images/aed-step3.svg",

        // ===== 피부 / 소변 (Claude SVG) =====
        "skin:cyanosis": "images/skin-cyanosis.svg",
        "skin:pallor":   "images/skin-pallor.svg",
        "skin:jaundice": "images/skin-jaundice.svg",
        "skin:mottled":  "images/skin-mottled.svg",
        "urine:dark":    "images/urine-dark.svg",
        "urine:foamy":   "images/urine-foamy.svg",
    };

    // 환자 아바타 (생존 모드, 시나리오) — Claude SVG
    const PATIENT_AVATAR_MAP = {
        "senior-f":  "images/avatar-1-senior-f.svg",
        "young-m":   "images/avatar-2-young-m.svg",
        "bun-f":     "images/avatar-3-bun-f.svg",
        "bald-m":    "images/avatar-4-bald-m.svg",
        "hijab-f":   "images/avatar-5-hijab-f.svg",
        "long-f":    "images/avatar-6-long-f.svg",
        "grey-m":    "images/avatar-7-grey-m.svg",
        "buzz-m":    "images/avatar-8-buzz-m.svg",
    };

    // 온보딩 일러스트 — Claude SVG
    const ONBOARDING_IMAGE_MAP = {
        "welcome":    "images/onboard-1-welcome.svg",
        "simulation": "images/onboard-2-simulation.svg",
        "nclex":      "images/onboard-3-nclex.svg",
        "analytics":  "images/onboard-4-analytics.svg",
        "start":      "images/onboard-5-start.svg",
    };

    // 빈 상태 일러스트 — Claude SVG
    const EMPTY_STATE_IMAGE_MAP = {
        "no-bookmarks": "images/empty-no-bookmarks.svg",
        "no-data":      "images/empty-no-data.svg",
        "no-images":    "images/empty-no-images.svg",
        "no-records":   "images/empty-no-records.svg",
        "no-search":    "images/empty-no-search.svg",
        "no-wrong":     "images/empty-no-wrong.svg",
    };

    // alt 텍스트 (접근성 + SEO)
    const CLINICAL_IMAGE_ALT = {
        "ecg:nsr":              "정상 동율동 ECG",
        "ecg:stemi":            "ST 분절 상승 (STEMI) ECG",
        "ecg:vtach":            "심실 빈맥 ECG",
        "ecg:vfib":             "심실 세동 ECG",
        "ecg:afib":             "심방 세동 ECG",
        "ecg:svt":              "상심실성 빈맥 ECG",
        "ecg:asystole":         "심정지 (Asystole) ECG",
        "ausc:normal":          "정상 흉부 청진음 (모든 폐야 깨끗)",
        "ausc:crackle-lower":   "하부 폐 수포음 (crackles)",
        "ausc:wheeze-lower":    "하부 폐 천명음 (wheeze)",
        "ausc:wheeze-diffuse":  "전반적 천명음 (천식·아나필락시스)",
        "ausc:stridor-upper":   "상기도 협착음 (stridor)",
        "fhr:late":             "후기하강 FHR 패턴 — 자궁태반 부전 시사",
        "fhr:early":            "초기하강 FHR 패턴 — 두부 압박",
        "fhr:variable":         "가변하강 FHR 패턴 — 제대 압박",
        "fhr:accelerations":    "FHR 가속 — 안심 양호 패턴",
        "fundal:28": "자궁저 높이 28주",
        "fundal:30": "자궁저 높이 30주",
        "fundal:32": "자궁저 높이 32주",
        "fundal:36": "자궁저 높이 36주",
        "fundal:40": "자궁저 높이 40주",
        "pupil:anisocoria":     "동공 부동 (한쪽만 산동)",
        "glasgow:low":          "GCS 낮은 의식 수준",
        "wound:stage2":         "Stage 2 압창 (부분 두께 손실)",
        "wound:stage3":         "Stage 3 압창 (전층 피부 손실, 피하지방 노출)",
        "wound:stage4":         "Stage 4 압창 (근막·뼈 노출)",
        "wound:infected":       "감염된 상처",
        "rule-of-nines":        "9의 법칙 — 체표면적 화상 평가",
        "cxr:pneumonia":        "흉부 X선 — 폐렴 소견",
        "cxr:pneumothorax":     "흉부 X선 — 기흉",
        "cxr:cardiomegaly":     "흉부 X선 — 심비대 (CTR >0.5)",
        "aed:adult":            "성인 AED 패드 부착 위치 (우측 쇄골 + 좌측 흉부 측면)",
        "aed:child":            "소아 AED 패드 부착 위치",
        "aed:step1":            "AED 1단계 — 전원 ON",
        "aed:step2":            "AED 2단계 — 패드 부착",
        "aed:step3":            "AED 3단계 — 분석·제세동",
        "skin:cyanosis":        "청색증 피부",
        "skin:pallor":          "창백 피부",
        "skin:jaundice":        "황달 피부",
        "skin:mottled":         "얼룩덜룩한 피부 (저관류)",
        "urine:dark":           "어두운 소변 (탈수·간기능)",
        "urine:foamy":          "거품뇨 (단백뇨)",
    };

    if (typeof window !== "undefined") {
        window.CLINICAL_IMAGE_MAP = CLINICAL_IMAGE_MAP;
        window.CLINICAL_IMAGE_ALT = CLINICAL_IMAGE_ALT;
        window.PATIENT_AVATAR_MAP = PATIENT_AVATAR_MAP;
        window.ONBOARDING_IMAGE_MAP = ONBOARDING_IMAGE_MAP;
        window.EMPTY_STATE_IMAGE_MAP = EMPTY_STATE_IMAGE_MAP;
    }
    if (typeof module !== "undefined" && module.exports) {
        module.exports = {
            CLINICAL_IMAGE_MAP,
            CLINICAL_IMAGE_ALT,
            PATIENT_AVATAR_MAP,
            ONBOARDING_IMAGE_MAP,
            EMPTY_STATE_IMAGE_MAP,
        };
    }
})();
