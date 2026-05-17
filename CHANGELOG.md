# 변경 이력

본 프로젝트는 [Keep a Changelog](https://keepachangelog.com/) 형식을 따르며, [Semantic Versioning](https://semver.org/) 을 사용합니다.

## [Unreleased]

### Added
- PNG 아이콘 자동 생성 스크립트 (`npm run icons`, `scripts/generate-icons.js` + `sharp`)
- `build/` 디렉토리에 11개 사이즈 PNG (16~1024) + electron-builder 기본 입력 `icon.png`
- PWA `manifest.json` icons 에 다중 PNG 사이즈 등록
- ESLint v8 + `.eslintrc.json` + `npm run lint`
- `SECURITY.md` — 취약점 보고 절차
- `CONTRIBUTING.md` — PR 체크리스트, 컨텐츠 가이드, 코드 스타일
- `CHANGELOG.md` — 이 문서
- GitHub Issue / PR 템플릿

### Fixed
- 5건 lint warning 정리 (`let` → `const`, 미사용 변수 `_` 접두)

## [1.1.0] — 2026-05-17

### Added
- 의료 컨텐츠 인터넷 검증 24건 (`CONTENT_VERIFICATION.md`)
- 메인 메뉴 SVG 아이콘 9개 + 커스텀 PWA 로고 (`icon.svg`)
- 온보딩 5장 SVG 일러스트
- top-bar 좌측 뒤로가기 버튼
- 트리아지 5개·시나리오 3개 추가 (7개·6개 총합)
- 인계 환자 100명 + 세션당 셔플 10명 + handoffSeen 추적
- 듀티(생존모드) 스토리 비트 6개 (이벤트 3/6/10/13/16/18)
- 모바일 우선 디자인 + viewport-fit + safe-area
- PWA manifest + cache-first 서비스 워커
- 약관 동의 게이트 + 5장 온보딩
- LICENSE (MIT) + 한·영 의료 면책 고지
- README + electron-builder 설정 (mac/win/linux)
- 모의고사·일일 챌린지·인계·트리아지·시나리오·오답노트·대시보드 6개 신규 모드
- WebAudio 사운드 + 다크 모드 + 키보드 단축키 + 콤보 시스템
- 5개 신규 generator (ECG·검사해석·CPR·인슐린·통증사정 → 총 29개)
- 708개 자동 테스트 (단위 + jsdom 통합)
- GitHub Actions CI
- ARIA 접근성 + IME 가드 + CSP `script-src 'self'`

### Changed
- 정답 판정 로직: `effect.rep > 0` → 명시적 `correct: true` 플래그
- handoff h097: tPA window `3시간` → `4.5시간` (현 AHA/ASA 가이드라인 반영)
- 트리아지 t1 우선순위: 영아 청색증 3→2, 아나필락시스 4→3 (ABC 일관성)
- 디자인: AI 템플릿 무지개 그라디언트 → 브랜드 1색 + 중성톤
- 21개 이모지 → 9개 SVG 라인 아이콘

### Fixed
- 오답 큐 baseId+title 중복 매칭 → 고유 ID 기반
- 모의고사 timeout/complete race → 멱등성 가드
- 한국어 IME 조합 중 단축키 오발동 → `isComposing` / keyCode 229 가드
- 시나리오 모드에 시프트 난이도가 잘못 적용 → 모드별 분기
- Storage 손상 시 무한루프/렌더 오류 → `validate()` 스키마 검증
- ECG 정답 표현 통일 (defib 변형 → 단일 표현)
- 일일 챌린지 부분 진행 손실 → returnToMenu에서 partial 저장
- PCI 시술 거부 시나리오 강압적 대응 → 윤리적 가이드 추가
- print-only DOM 누적 → afterprint cleanup
- showGameOver innerHTML XSS 표면 → textContent + DOM 구성

## [1.0.0] — 2026-05-16

### Added
- Electron 기본 앱 (실전 듀티 + 트레이닝 모드)
- 24개 generator (8과목)
- 동적 파라미터 generator (Naegele, Apgar, Burn, Dopamine, ABGA)
- 시프트 난이도 (Day/Evening/Night)
- 승급 심사 모달
- `APP_EVALUATION.md` 초기 평가
