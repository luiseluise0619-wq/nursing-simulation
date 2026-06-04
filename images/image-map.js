// =========================================================================
// 임상 이미지 매핑 — AI 생성 비트맵 이미지 ↔ image key
// 비트맵 있으면 우선 사용, 없으면 SVG 자동 폴백 (script.js renderClinicalImage)
//
// 새 이미지 추가 방법:
//   1. images/ 폴더에 파일 저장 (WebP 권장, PNG 도 OK)
//   2. 아래 매핑에 한 줄 추가
//   3. 빌드 (build:web, build:preview) — 자동 포함
// =========================================================================
(function() {
    const CLINICAL_IMAGE_MAP = {
        // ===== ECG =====
        // "ecg:nsr":   "images/ecg-nsr.webp",
        // "ecg:stemi": "images/ecg-stemi.webp",
        // "ecg:vtach": "images/ecg-vtach.webp",
        // "ecg:vfib":  "images/ecg-vfib.webp",
        // "ecg:afib":  "images/ecg-afib.webp",
        // "ecg:svt":   "images/ecg-svt.webp",
        // "ecg:asystole": "images/ecg-asystole.webp",

        // ===== 청진 (auscultation) =====
        // "ausc:normal":        "images/ausc-normal.webp",
        // "ausc:crackle-lower": "images/ausc-crackles.webp",
        // "ausc:wheeze-lower":  "images/ausc-wheeze.webp",
        // "ausc:wheeze-diffuse": "images/ausc-wheeze-diffuse.webp",
        // "ausc:stridor-upper": "images/ausc-stridor.webp",

        // ===== 산과 (fundal height, fhr) =====
        // "fhr:late":           "images/fhr-late.webp",
        // "fhr:early":          "images/fhr-early.webp",
        // "fhr:variable":       "images/fhr-variable.webp",
        // "fhr:accelerations":  "images/fhr-accel.webp",
        // "fundal:32":          "images/fundal-32.webp",
        // ... (자궁저 높이는 28-40주)

        // ===== 신경 (pupil, GCS) =====
        // "pupil:fixed-dilated": "images/pupil-fixed-dilated.webp",
        // "pupil:pinpoint":      "images/pupil-pinpoint.webp",
        // "pupil:anisocoria":    "images/pupil-anisocoria.webp",
        // "glasgow:low":         "images/gcs-low.webp",

        // ===== 화상 / 상처 =====
        // "wound:stage2":   "images/wound-stage2.webp",
        // "wound:stage3":   "images/wound-stage3.webp",
        // "wound:stage4":   "images/wound-stage4.webp",
        // "wound:infected": "images/wound-infected.webp",
        // "rule-of-nines":  "images/rule-of-nines.webp",

        // ===== 영상 (CXR, AED) =====
        // "cxr:pneumonia":      "images/cxr-pneumonia.webp",
        // "cxr:pneumothorax":   "images/cxr-pneumothorax.webp",
        // "cxr:pleural-effusion": "images/cxr-effusion.webp",
        // "cxr:cardiomegaly":   "images/cxr-cardiomegaly.webp",
        // "aed:adult":          "images/aed-adult.webp",
        // "aed:child":          "images/aed-child.webp",

        // ===== 피부 / 소변 =====
        // "skin:cyanosis": "images/skin-cyanosis.webp",
        // "skin:pallor":   "images/skin-pallor.webp",
        // "skin:jaundice": "images/skin-jaundice.webp",
        // "skin:mottled":  "images/skin-mottled.webp",
        // "urine:dark":    "images/urine-dark.webp",
        // "urine:foamy":   "images/urine-foamy.webp",
    };

    // alt 텍스트 (접근성 + SEO)
    const CLINICAL_IMAGE_ALT = {
        "ecg:nsr": "정상 동율동 ECG",
        "ecg:stemi": "ST 분절 상승 (STEMI) ECG",
        "ecg:vtach": "심실 빈맥 ECG",
        "ecg:vfib": "심실 세동 ECG",
        "ecg:afib": "심방 세동 ECG",
        "ecg:svt": "상심실성 빈맥 ECG",
        "ecg:asystole": "심정지 ECG",
        "ausc:normal": "정상 흉부 청진음",
        "ausc:crackle-lower": "하부 폐 수포음 (crackles)",
        "ausc:wheeze-lower": "하부 폐 천명음 (wheeze)",
        "ausc:wheeze-diffuse": "전반적 천명음",
        "ausc:stridor-upper": "상기도 협착음 (stridor)",
        "fhr:late": "후기하강 FHR 패턴",
        "fhr:early": "초기하강 FHR 패턴",
        "fhr:variable": "가변하강 FHR 패턴",
        "fhr:accelerations": "FHR 가속",
        "pupil:fixed-dilated": "양측 산동 + 무반응",
        "pupil:pinpoint": "양측 축동 (마약·교감억제)",
        "pupil:anisocoria": "동공 부동 (한쪽만 산동)",
        "glasgow:low": "GCS 낮은 의식 수준",
        "wound:stage2": "Stage 2 압창 (부분 두께 손실)",
        "wound:stage3": "Stage 3 압창 (전층 두께)",
        "wound:stage4": "Stage 4 압창 (근막·뼈 노출)",
        "wound:infected": "감염된 상처",
        "rule-of-nines": "9의 법칙 (체표면적)",
        "cxr:pneumonia": "흉부 X선 — 폐렴",
        "cxr:pneumothorax": "흉부 X선 — 기흉",
        "cxr:pleural-effusion": "흉부 X선 — 흉수",
        "cxr:cardiomegaly": "흉부 X선 — 심비대",
        "aed:adult": "성인 AED 패드 부착 위치",
        "aed:child": "소아 AED 패드 부착 위치",
        "skin:cyanosis": "청색증 피부",
        "skin:pallor": "창백 피부",
        "skin:jaundice": "황달 피부",
        "skin:mottled": "얼룩덜룩한 피부 (저관류)",
        "urine:dark": "어두운 소변 (탈수·간기능)",
        "urine:foamy": "거품뇨 (단백뇨)",
    };

    if (typeof window !== "undefined") {
        window.CLINICAL_IMAGE_MAP = CLINICAL_IMAGE_MAP;
        window.CLINICAL_IMAGE_ALT = CLINICAL_IMAGE_ALT;
    }
    if (typeof module !== "undefined" && module.exports) {
        module.exports = { CLINICAL_IMAGE_MAP, CLINICAL_IMAGE_ALT };
    }
})();
