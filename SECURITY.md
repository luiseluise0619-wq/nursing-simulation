# 보안 정책

## 지원 버전

가장 최신 메이저 버전만 보안 패치를 받습니다.

| 버전 | 지원 |
| --- | --- |
| 1.1.x | ✅ |
| < 1.1 | ❌ |

## 취약점 보고

본 앱은 학습 도구이며 **민감 데이터를 다루지 않습니다**:
- 모든 사용자 데이터는 로컬 `localStorage` 만 사용 (서버 전송 0)
- 외부 API·인증·결제·세션 토큰 없음
- 네트워크 통신 0 (Electron `file://` + PWA cache-first)

다만 다음 영역에서 취약점을 발견하시면 비공개로 보고해 주세요:

### 보고 대상
- **XSS**: `innerHTML` / `template literal` 에서의 escape 누락
- **CSP 우회**: `script-src 'self'` 정책 우회 가능 경로
- **데이터 손상**: `localStorage` 변조로 인한 크래시·무한루프
- **Electron 격리 약화**: `nodeIntegration` / `contextIsolation` 관련
- **PWA Service Worker**: 캐시 변조로 인한 컨텐츠 위조

### 보고 방법
GitHub Security Advisory:
- 저장소 → Security → Advisories → New draft security advisory

또는 비공개 이슈로 만들고 메인테이너를 멘션하세요.

### 보고 외 영역
- **의료 컨텐츠 정확성**: 보안 취약점이 아닌 컨텐츠 오류는 일반 이슈로 제출
- **외부 패키지 취약점**: `npm audit` 결과는 일반 이슈로 제출

## 응답 시간 (모범 사례 기준)
- 24시간 내 수신 확인
- 7일 내 분류 (확정/거부/협의)
- Critical: 14일 내 수정
- High: 30일 내 수정
- Medium/Low: 다음 메이저 릴리즈

## 보안 베스트 프랙티스 (사용자용)
- 항상 최신 버전 사용
- 검증된 빌드(electron-builder 코드 서명 적용된 .dmg/.exe)만 설치
- 알 수 없는 출처의 patch·plugin 설치 금지
