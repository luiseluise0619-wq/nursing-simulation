# 기여 가이드

기여해 주셔서 감사합니다. 본 앱은 한국 간호사 국가고시 학습 보조 도구이며, **의료적 정확성**과 **학습 효과**가 가장 중요합니다.

---

## 시작하기

```bash
git clone <repo>
cd nursing-simulation
npm install
npm test            # 708 테스트 통과 확인
npm start           # Electron 실행
```

---

## PR 체크리스트

PR 제출 전 다음을 모두 통과해야 합니다:

- [ ] `npm test` 모두 통과 (708+)
- [ ] `npm run lint` 0 에러
- [ ] 새 컨텐츠는 출처 명시 (PR 본문에 가이드라인·교과서·국시원 자료 링크)
- [ ] 신규 generator/시나리오는 invariant 테스트 추가
- [ ] CHANGELOG.md 에 변경사항 한 줄 추가 (Unreleased 섹션)

---

## 컨텐츠 추가 가이드

### 4지선다 문제 (`questions.js`)
- `allGenerators` 배열에 추가
- **정답에 `correct: true` 플래그 필수** (테스트 자동 검증)
- 정답은 보기당 1개 이상, 1개 이하
- 동적 파라미터는 `rand()`/`pick()` 사용
- 보기 텍스트 중복 금지

### 인계 환자 (`content.js` HANDOFF_PATIENTS)
- `id` 고유 (`h001`~`h100` 패턴)
- **모든 키워드는 narration 본문에 verbatim 등장** (테스트 자동 검증)
- narration 60~120 어절, TTS 자연스럽게 읽히도록
- hint 는 학습 anchor

### 트리아지 케이스 (`content.js` TRIAGE_CASES)
- 정확히 5명 환자, priority 1~5 각 1번씩
- `why` 필드에 임상 근거
- `rationale` 에 전체 케이스 우선순위 원리

### 시나리오 (`content.js` SCENARIOS)
- 최소 3 step
- 각 step 정확히 1개 정답 (`correct: true`)
- hp 손실은 큐레이팅 (시나리오 모드는 시프트 가중 안 받음)
- 4 choices 권장

### 듀티 스토리 비트 (`content.js` SURVIVAL_STORY_BEATS`)
- `atEvent` 고유 (한 듀티당 1회 발동)
- 3~4 choices, 정답 1개

---

## 의료 컨텐츠 검증

이 저장소는 의료 정확성에 대해 다음 단계를 거칩니다:

1. **인터넷 검증 (자동)**: `CONTENT_VERIFICATION.md` 에 사실 검증 기록. 새 컨텐츠 PR 시 작성자가 1~2개 출처 첨부.
2. **테스트 invariant**: 정답 1개, 키워드 일치, ID 고유성 등 형식 검증
3. **RN/MD 감수 (수동)**: PR 라벨 `needs-clinical-review` 부착 시 메인테이너가 임상 검토

새 컨텐츠는 다음 출처 우선:
- 한국보건의료인국가시험원 공시 자료
- KDCA 가이드라인
- AHA / ACLS / PALS
- 표준 간호학 교과서 (수문사·현문사 등)

---

## 코드 스타일

- 4-space indent (JS/CSS), 2-space for JSON/HTML
- 세미콜론 사용
- `let` 보다 `const` 우선
- 인라인 `onclick` 금지 (CSP `script-src 'self'` 위반) → `data-action` + 위임 핸들러
- DOM 동적 HTML 에 변수 보간 시 `escapeHtml()` 필수

---

## 테스트 작성

### 단위 (Node, jest-environment-node)
- `questions.js` / `content.js` 의 순수 데이터 invariant
- Storage 헬퍼 함수

### 통합 (jsdom)
- 모드 전환 흐름
- DOM 이벤트 위임
- 접근성 속성
- 키보드 단축키
- 약관/온보딩 게이트

테스트 추가 시 `freshDom()` 으로 매번 body 새로 만들기 (stale 리스너 방지).

---

## 커밋 메시지

다음 패턴 권장:

```
<scope>: <한 줄 요약>

<상세 설명 — 왜·무엇이 바뀌었는지>

<관련 이슈/PR 번호>
```

예:
```
content: Add 5 oncology nursing scenarios

Covers chemo-induced neutropenia, tumor lysis syndrome, mucositis,
PICC line care, palliative dyspnea. All sourced from ONS guidelines
and verified against StatPearls.

Closes #42
```

---

## 라이선스

본 저장소는 **MIT** 라이선스이며, 기여 시 동일 라이선스에 동의한 것으로 간주합니다.

의료 컨텐츠 기여 시 추가 면책 동의:
- 기여자가 제출한 임상 정보는 본인이 직접 검증한 것이거나 공개된 가이드라인 기반
- 기여자는 이 정보가 환자에게 직접 적용되지 않도록 책임지지 않음

---

## 행동 강령

- 의료 컨텐츠 관련 토론은 사실과 출처 기반으로
- 한국 임상 표준과 국제 표준이 다를 때는 둘 다 명시
- 환자 익명성·정보 보호 절대 우선
