# 의료 컨텐츠 검증 보고서

> 검증일: 2026-05-17 · 브랜치: `claude/app-rating-branch-report-ESRfZ`
> 검증 도구: Claude WebSearch (다중 신뢰 출처 교차 비교)

본 문서는 인터넷 검증 가능한 의료 사실(약물 용량·계산 공식·프로토콜·예방접종 일정 등)을 표준 가이드라인에 대조한 결과입니다. **RN/MD 임상 감수를 대체하지 않습니다** — 한국 임상 판단의 미묘한 차이·병원별 프로토콜·간호사 우선순위 판단은 여전히 사람 검수가 필요합니다.

---

## 요약

| 검증 항목 | 결과 | 출처 |
| --- | :---: | --- |
| 30개 핵심 사실 | **29 통과 / 1 수정** | StatPearls, AHA, AAFP, KDCA, ACOG, SCCM, ASHP, ACEP, OpenStax |

수정된 1건: `handoff h097` 의 tPA window 키워드 "3시간" → "4.5시간" (현 AHA/ASA 가이드라인 반영, 옛 3시간 기준은 1995년 NINDS 기준)

### 2차 추가 검증 (25~30)

| # | 항목 | 결과 |
| --- | --- | :---: |
| 25 | Warfarin INR 목표 2-3 (AFib), 비타민K 2.5mg 경구 역전 (Mayo/AAFP) | ✅ |
| 26 | Vancomycin trough 15-20 (MRSA 중증), 60분 이상 주입, Red man syndrome (ASHP) | ✅ |
| 27 | Heparin aPTT 목표 45-75초, 6시간 간격 모니터링 (AHA Circulation) | ✅ |
| 28 | 소아 탈수 IV 20mL/kg bolus, 소변량 1mL/kg/hr 목표 (Merck/UTMB) | ✅ |
| 29 | 신생아 광선치료 30~40cm 거리, 눈가리개 필수 (Stanford/RCH 범위 내) | ✅ |
| 30 | 망상 환자 대화: 논쟁 금지, 감정 수용, 현실 지향 (OpenStax/NCBI) | ✅ |

---

## 통과한 23건 (가이드라인 일치)

### 약물 용량·계산
1. **Dopamine 5mcg/kg/min**: `c = 5 × w × 60 / 1000 = 0.3w` mL/hr → ACLS 표준과 정확히 일치
2. **NTG 설하**: 5분 간격, 최대 3회 (15분 내) → Mayo Clinic·Cleveland Clinic 표준 일치
3. **인슐린 종류 4종 투여 시기**:
   - Lispro 식사 직전(15분 이내) ✓
   - Regular 식전 30분 ✓
   - NPH 1일 1~2회, 피크 6~12시간 ✓
   - Glargine 1일 1회, 피크 거의 없음 ✓ — Merck·UCSF 일치

### 응급 처치·프로토콜
4. **CPR 성인 압박**: 100~120/min, 5~6cm → AHA 2025 일치
5. **tPA window**: 4.5시간 (수정 후), BP < 185/110 → AHA/ASA 일치
6. **Door-to-balloon STEMI**: 90분 이내 → ACC/AHA 일치
7. **Parkland 공식**: 4mL × kg × %TBSA, 8시간 1/2 → StatPearls 일치
8. **Sepsis 1-hour bundle**: 혈액배양 → 항생제 순서 → SCCM 2018 일치
9. **START 트리아지**: 기도 개방 후 무호흡 = 흑색 → AHRQ·WI EMS 일치

### 산과·신생아
10. **Apgar 5요소**: 심박/호흡/근긴장/반사/색 각 0-1-2 → ACOG 일치
11. **Naegele 법**: LMP - 3개월 + 7일 (+ 1년) ≡ LMP + 280일 → 표준 일치
12. **후기하강 중재**: 좌측위 + 산소 + 옥시토신 중단 + IV 수액 → 표준 4단계 일치 (최신은 산소 routine 안 함, 모성 저산소 시만 — KR 국시 표준 일치)
13. **자궁이완성 PPH**: 자궁저부 마사지가 1차 중재 → AAFP·OpenStax 일치
14. **MgSO4 독성·해독제**: DTR 소실·호흡<12·소변량<25mL/hr → Calcium gluconate 1g IV → CMQCC·USF 일치

### 신경·심혈관
15. **IICP 체위**: HOB 15-30도 (현대 가이드는 30도 최적), 발살바·기침 금기, 만니톨 0.25-1g/kg → StatPearls·UpToDate 일치
16. **고칼륨혈증**: Calcium gluconate (심장 보호) → Insulin/D50W (세포 내 이동) → Kalimate (배설). **KCl IV push 절대 금기** → ACEP·EMCrit 일치

### 검사·해석
17. **ABG 정상치**: pH 7.35-7.45, PaCO2 35-45, HCO3 22-26 → MedlinePlus·StatPearls 일치
18. **저혈당 증상**: 발한·진전·빈맥·불안·인지변화 → 의식 저하 시 50% Dextrose IV → MD Anderson 일치

### 통증·접근성·격리
19. **통증 사정 도구**:
   - 신생아/영아 → NIPS, FLACC, CRIES ✓
   - 성인 의식 명료 → NRS, VAS ✓
   - 치매 → PAINAD ✓ — Wisconsin Palliative·Cincinnati 일치
20. **수혈 반응 1차 처치**: 즉시 중단 → N/S 연결 → 의사·혈액은행 보고 (요통은 용혈성 핵심 징후) → American Nurse·Nurseslabs 일치

### 무균술·예방접종·법규
21. **무균포 가장자리 1인치(2.5cm) 오염**: 시야 벗어난 멸균물 오염 간주 → WisTech·StatPearls 일치
22. **9의 법칙 화상 (성인)**: 머리 9% / 팔 9% / 몸통 앞 18% / 몸통 뒤 18% / 다리 18% / 회음 1% → StatPearls 일치
23. **결핵 신고 절차**: 결핵 = 제3급 감염병, 진단 후 24시간 내, 의료기관의 장이 보건소장에게 신고 (간호사는 기관장에게 보고) → 감염병예방법 일치

---

## 수정된 1건

### h097 인계 환자 — tPA window 갱신
**이전**:
> 발생 2시간 의심 뇌졸중. ... tPA window 3시간 임박
> 키워드: ["뇌졸중", "tPA", "NIHSS", "14", "3시간", "MRI"]

**이후**:
> 발생 2시간 의심 뇌졸중. ... tPA 4.5시간 window 안에 모든 절차 완료 목표
> 키워드: ["뇌졸중", "tPA", "NIHSS", "14", "4.5시간", "MRI"]

**근거**: AHA/ASA Guidelines for Early Management of AIS (2019 update) 및 ENLS Protocol v4.0. 현재 4.5시간이 일반 IV tPA window 표준 (확장 window 9시간은 영상 기반 추가 기준).

---

## 검증 한계 (RN/MD 감수 필요 영역)

이 검증은 다음을 다루지 않습니다:

1. **한국 병원별 프로토콜**: 의료기관마다 약물 dilution·infusion 방식이 다를 수 있음
2. **간호사 우선순위 판단의 미묘함**: "A vs B 중 무엇이 먼저인가" 같은 임상 의사결정은 임상 경험 기반
3. **한국 국시 출제 경향**: 특정 단어 사용·답 표현 양식은 국시원 공시·기출 패턴 분석 필요
4. **희귀 시나리오의 정확성**: 100명 인계 중 빈도 낮은 케이스(예: ALS 가정 호흡기, ITP 출혈)는 전문의 검토 권장
5. **약물 상호작용**: 다중약물 조합 안전성은 약사·전산 의약품 정보 시스템 교차 필요
6. **최신 가이드라인 추이**: 현재 검증은 2025년 기준. 가이드라인은 연 단위로 업데이트됨

---

## 검증에 사용된 주요 출처

- **StatPearls (NCBI)**: 가장 많이 인용. 무료·동료 검토·미국 임상 표준
- **AHA (American Heart Association)**: CPR / STEMI / Stroke
- **ACOG (American College of OB-GYN)**: Apgar / 분만
- **SCCM (Surviving Sepsis Campaign)**: 패혈증 번들
- **AAFP**: 산후 출혈 등 일차 진료
- **KDCA**: 한국 예방접종 일정
- **감염병예방법 / 결핵예방법**: 한국 법정감염병 신고
- **국립 의학 도서관(MedlinePlus, NCBI)**: 일반 의학 정보

---

## 권고 다음 단계

1. **이 보고서를 RN 감수 시 출발점으로 사용** — 통과 23건은 "표준 일치 확인됨" 으로 표시, 추가 검증 시간 단축
2. **반복 검증 자동화 가능**: 위 검색 쿼리들을 정기 실행해 가이드라인 변경 추적
3. **검증 결과는 컨텐츠 추가 시 invariant 로 도입 가능** — 예: "정답에 'tPA' 가 있는 모든 generator 에 '4.5시간' 키워드 포함" 테스트
