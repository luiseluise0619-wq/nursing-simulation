# 🎓 코드 학습 가이드 — Nurse Simulator

> 처음 코드를 배우는 분에게, 이 앱이 어떻게 만들어졌는지 처음부터 끝까지 설명합니다.

---

## 📚 목차

1. [큰 그림 — 이 앱은 무엇인가](#1-큰-그림--이-앱은-무엇인가)
2. [파일 구조 — 어떤 파일이 무엇을 하는가](#2-파일-구조--어떤-파일이-무엇을-하는가)
3. [브라우저가 앱을 여는 순서 (앱이 켜질 때 일어나는 일)](#3-브라우저가-앱을-여는-순서)
4. [HTML / CSS / JavaScript 입문](#4-html--css--javascript-입문)
5. [`index.html` 자세히 보기](#5-indexhtml-자세히-보기)
6. [`script.js` 자세히 보기 — 게임의 두뇌](#6-scriptjs-자세히-보기--게임의-두뇌)
7. [`service-worker.js` — 오프라인 작동의 비밀](#7-service-workerjs--오프라인-작동의-비밀)
8. [`manifest.json` — "앱처럼" 보이게 만드는 파일](#8-manifestjson--앱처럼-보이게-만드는-파일)
9. [PWA란 무엇인가](#9-pwa란-무엇인가)
10. [코드를 더 배우려면](#10-코드를-더-배우려면)

---

## 1. 큰 그림 — 이 앱은 무엇인가

이 앱은 **간호사 국가고시 학습 PWA(Progressive Web App)**입니다. 웹사이트지만 휴대폰에 설치하면 일반 앱처럼 작동합니다.

### 무엇을 할 수 있나
- **964개 임상 문제** 풀이 (그중 164개는 SVG 그림 문제)
- **8개 카테고리** (성인·기본·소아·모성·정신·지역사회·법규·관리)
- **서바이벌 모드**: 실제 듀티처럼 환자를 처리하며 평판·체력 관리
- **44개 일상 상황 이벤트** (실종, 청혼, 코드 블루 등)
- **한국어/영어** 즉시 전환
- **오프라인** 작동 (한 번 열면 인터넷 없이도 사용 가능)

### 기술 요약
- 백엔드 **없음** (서버 없이 브라우저 안에서만 작동)
- 빌드 도구 **없음** (그냥 파일을 열면 끝)
- 모든 데이터는 **`localStorage`** (브라우저에 저장)에 보관

---

## 2. 파일 구조 — 어떤 파일이 무엇을 하는가

```
nursing-simulation/
├── index.html          ← 앱의 외관 (UI 골격) + 모든 CSS 디자인
├── script.js           ← 모든 두뇌 (게임 로직, 964 문제, 모드 처리) — 10,484줄
├── service-worker.js   ← 오프라인 캐싱 담당
├── manifest.json       ← "이 웹사이트는 앱이다"라고 휴대폰에 알리는 파일
├── icons/              ← 앱 아이콘 (홈 화면용 6종 이미지)
├── tools/
│   └── export-questions.js   ← 의사·간호사 검수용 CSV 생성 도구
├── capacitor.config.json     ← 네이티브 앱(.ipa/.apk) 빌드용 설정
├── package.json              ← 프로젝트 정보 (이름·버전·개발 명령어)
├── README.md                 ← 프로젝트 소개 문서
└── CODE_GUIDE.md             ← (지금 읽는 이 파일)
```

### 파일 크기
| 파일 | 줄 수 | 역할 |
|---|---|---|
| `script.js` | 10,484 | 가장 큰 파일. 모든 로직과 데이터가 들어있음 |
| `index.html` | 837 | UI 구조 + CSS 디자인 |
| `README.md` | 183 | 프로젝트 설명 |
| `service-worker.js` | 54 | 오프라인 작동 |
| `capacitor.config.json` | 30 | 네이티브 앱 설정 |
| `manifest.json` | 22 | PWA 메타데이터 |
| `package.json` | 11 | 프로젝트 메타데이터 |

---

## 3. 브라우저가 앱을 여는 순서

사용자가 앱을 열면 정확히 이 순서로 일어납니다:

```
1. 사용자가 URL 입력 또는 홈 화면 아이콘 클릭
   ↓
2. 브라우저가 index.html 다운로드
   ↓
3. index.html의 <head> 안 <link>, <meta> 태그 처리
   ├── manifest.json 읽기 (앱 이름·아이콘·테마색)
   ├── 폰트 다운로드 (Pretendard)
   └── service-worker.js 등록 (오프라인 캐싱 시작)
   ↓
4. <style> 안 CSS 파싱 → 화면 색·레이아웃 결정
   ↓
5. <script src="script.js"> 다운로드 → JavaScript 실행
   ├── 변수·함수 정의
   ├── localStorage에서 저장된 설정 불러오기 (loadSettings)
   └── DOMContentLoaded 이벤트 → renderMainMenu() 호출
   ↓
6. 메인 메뉴가 화면에 표시됨 (사용자가 보는 첫 화면)
```

---

## 4. HTML / CSS / JavaScript 입문

### HTML — 골격
HTML은 **구조**입니다. 사람의 뼈와 같은 역할.
```html
<button>버튼</button>
<div>네모 박스</div>
<h2>제목</h2>
```
이 태그들이 화면에 그려질 요소를 정의합니다.

### CSS — 외모
CSS는 **디자인**입니다. 옷·화장과 같은 역할.
```css
button {
  background: green;     /* 버튼 배경색 */
  border-radius: 16px;   /* 모서리 둥글게 */
  padding: 16px;         /* 내부 여백 */
}
```
`<style>` 태그 안에 작성하면 그 페이지의 모든 `<button>`이 위 스타일을 따릅니다.

### JavaScript — 행동
JavaScript는 **두뇌**입니다. 클릭·계산·저장 등 동작 담당.
```js
// 변수 (값을 담는 그릇)
let count = 0;

// 함수 (재사용 가능한 동작 묶음)
function 안녕(이름) {
  return "안녕, " + 이름 + "!";
}

// 호출
console.log(안녕("학생"));   // → "안녕, 학생!"
```

### 세 언어가 함께 일하는 법
```html
<button id="my-btn">눌러봐</button>     <!-- HTML: 버튼 만들기 -->
<style>
  #my-btn { background: blue; }      /* CSS: 파란색으로 */
</style>
<script>
  document.getElementById("my-btn")    // JS: 그 버튼 찾기
    .onclick = () => alert("안녕!");   //     클릭 시 알림 띄우기
</script>
```

---

## 5. `index.html` 자세히 보기

### 5.1 문서 선언과 head

```html
<!DOCTYPE html>                          ← "이 문서는 HTML5"라고 선언
<html lang="ko">                         ← 기본 언어는 한국어
<head>
    <meta charset="UTF-8">               ← 한글이 깨지지 않게 UTF-8 인코딩
    <meta name="viewport" content="width=device-width, initial-scale=1.0, ...">
    <!-- viewport: 모바일에서 화면 크기에 맞게 보이게 함 -->

    <title>Nurse Simulator · 간호사 시뮬레이터</title>
    <!-- 브라우저 탭에 보이는 이름 -->

    <meta name="description" content="500+ NCLEX·Korean Boards-style ...">
    <!-- 검색엔진·SNS 미리보기에 사용 -->

    <meta name="theme-color" content="#7fa881">
    <!-- 모바일 브라우저 상단 바 색 (세이지 그린) -->

    <link rel="manifest" href="./manifest.json">
    <!-- "이 사이트는 PWA"라고 알림 -->

    <link rel="icon" ...>                <!-- 탭 아이콘 (favicon) -->
    <link rel="apple-touch-icon" ...>    <!-- iOS 홈 화면 아이콘 -->
</head>
```

> **`<meta>` 태그**: 페이지에 대한 정보를 담는 태그. 화면에는 안 보이지만 브라우저·검색엔진·SNS가 읽음.

### 5.2 `<style>` 안의 CSS — 디자인 시스템

```css
:root {                          /* :root = HTML 전체에 적용되는 변수 정의 */
    --sage: #7fa881;             /* CSS 변수 (재사용 색상). var(--sage)로 사용 */
    --sage-dark: #5e8961;
    --bg: #eef2f5;               /* 배경색 (따뜻한 회색) */
    --text: #1e293b;             /* 글자색 (어두운 슬레이트) */
    --radius: 22px;              /* 카드 모서리 둥글기 */

    /* 뉴모피즘(neumorphism)의 핵심: 두 개의 그림자로 입체감 */
    --neu-out: 8px 8px 20px var(--shadow-dark),
               -8px -8px 20px var(--shadow-light);
}
```

> **CSS 변수의 장점**: 색을 한 곳에서 바꾸면 전체 앱이 동시에 바뀜. 디자인 일관성 유지.

```css
body {
    font-family: 'Pretendard', ...;     /* 한글 글꼴 */
    margin: 0;                           /* 기본 여백 제거 */
    background: var(--bg);               /* 위에서 정의한 변수 사용 */
    -webkit-tap-highlight-color: transparent;
    /* ↑ 모바일에서 버튼 클릭 시 회색 깜빡임 제거 */
}

.card {
    background: var(--card);             /* 흰색 */
    padding: 26px 24px;                  /* 내부 여백 (위아래 26, 좌우 24) */
    border-radius: var(--radius);        /* 22px 둥글게 */
    box-shadow: var(--neu-out);          /* 뉴모피즘 그림자 */
}
```

### 5.3 `<body>` — 화면에 보이는 골격

```html
<body>
    <!-- 언어 토글 버튼 (항상 우측 상단에 떠있음) -->
    <div id="lang-toggle">
        <button onclick="setLang('ko')">한국어</button>
        <button onclick="setLang('en')">English</button>
    </div>

    <!-- 상단 바: 듀티 정보, 체력, 평판 (게임 중에만 표시) -->
    <div id="top-bar" class="hidden">
        <div id="hp">HP: 100</div>
        <div id="rep">평판: 0</div>
    </div>

    <!-- 진행도 바 -->
    <div id="progress-wrap" class="hidden">
        <div id="progress-fill"></div>
    </div>

    <!-- 게임 영역: script.js가 여기에 카드를 그림 -->
    <div id="game-area"></div>

    <!-- 하단 로그 바: 행동 결과 메시지가 쌓임 -->
    <div id="log-bar"></div>

    <!-- 면책 모달 (첫 실행 시) -->
    <div id="disclaimer-overlay">...</div>

    <!-- script.js 로드 (모든 HTML 다음에 마지막에 -->
    <script src="./script.js"></script>
</body>
```

> **`id` vs `class`**:
> - `id="hp"`: 한 페이지에 **하나만** (고유 식별자)
> - `class="card"`: **여러 개** 가능 (같은 스타일 공유)

> **`hidden` 클래스**: CSS에 `.hidden { display: none !important; }`로 정의되어 있어, 이 클래스를 붙이면 화면에서 사라짐. JavaScript가 동적으로 붙였다 떼면서 화면을 바꿈.

---

## 6. `script.js` 자세히 보기 — 게임의 두뇌

`script.js`는 10,484줄짜리 큰 파일이지만 **5개 부분**으로 나뉩니다:

```
줄 1-67       ← 설정 (변수 정의)
줄 68-292     ← 다국어 사전 (한국어/영어 텍스트)
줄 293-650    ← UI 헬퍼 함수, 메뉴 렌더링
줄 651-9388   ← 964개 문제 정의 + 등록
줄 9389-10484 ← 게임 모드 로직 (학습·서바이벌·SRS·모의시험)
```

### 6.1 게임 상태 (gameState) — 중심 데이터

`script.js` 초반에 **이 게임의 모든 정보**를 담는 큰 객체가 있습니다:

```js
let gameState = {
    lang: "ko",                    // 현재 언어
    mode: "menu",                   // 현재 모드 (menu/quiz/survival/srs)
    hp: 100,                        // 체력
    rep: 0,                         // 평판
    eventCount: 0,                  // 푼 이벤트 수
    currentShift: "Day",            // 듀티 시간대
    items: [],                      // 보유 아이템
    recentIds: [],                  // 최근 출제된 문제 ID (중복 방지)
    correctCount: 0,
    wrongCount: 0,

    studyTools: {                   // 학습 도구
        wrongIds: [],               // 오답노트
        bookmarkIds: []             // 즐겨찾기
    },

    srs: {                          // 간격 반복 학습
        cards: {}                   // { baseId: { box: 1, dueDate: ... } }
    },

    lifetime: {                     // 평생 누적 통계
        totalQuizSolved: 0,
        bestStreak: 0
    }
};
```

> **객체(object)**: 키-값 쌍으로 묶인 자료구조. `gameState.hp`는 100을 가리킴.
> `gameState.studyTools.wrongIds`는 오답노트 배열.

### 6.2 핵심 헬퍼 함수들

#### `loc(ko, en)` — 다국어 헬퍼 (가장 많이 쓰임)
```js
function loc(ko, en) {
    return gameState.lang === "en" ? en : ko;
}
```
**의미**: "현재 언어가 영어면 두 번째 인자, 아니면 첫 번째 인자를 돌려줘".

**사용 예**:
```js
const message = loc("정답입니다", "Correct");
// 한국어 모드 → "정답입니다"
// 영어 모드 → "Correct"
```
이 한 함수로 앱 전체가 두 언어를 즉시 전환합니다.

#### `pick(arr)` — 무작위 선택
```js
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
```
**의미**: 배열에서 무작위 한 요소 반환.
- `Math.random()`: 0~1 사이 무작위 숫자
- `* arr.length`: 0~배열길이 사이로 확장
- `Math.floor()`: 정수로 내림 (인덱스로 사용)

**사용 예**: `pick([1, 2, 3])` → 1 또는 2 또는 3

#### `shuffle(arr)` — 배열 섞기 (Fisher-Yates 알고리즘)
```js
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];   // 두 요소 위치 바꾸기
    }
    return arr;
}
```
**왜 필요한가**: 정답이 항상 첫 번째에 나오면 안 되므로, 4개 선택지를 매번 섞어 출제합니다.

#### `clamp(num, min, max)` — 범위 안에 가두기
```js
function clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
}
```
**의미**: 숫자가 min보다 작으면 min, max보다 크면 max로 자름.

**사용 예**:
```js
gameState.hp = clamp(gameState.hp + 10, 0, 100);
// HP는 항상 0~100 사이 유지
```

### 6.3 문제 생성기 (Generator) 패턴 — 핵심 디자인

964개 문제는 모두 **함수**입니다. 각 함수가 호출되면 문제 객체를 반환합니다:

```js
function generateMIQuestion() {
    return {
        baseId: "mi",                    // 고유 ID (중복 출제 방지용)
        categoryKey: "adult",            // 어느 카테고리인지
        part: loc("심혈관계", "CV"),    // 세부 주제
        emoji: "❤️",                     // 카드에 표시할 이모지
        title: loc("급성 MI", "Acute MI"),
        desc: loc("환자가 가슴 통증...", "Patient with chest pain..."),
        choices: shuffle([               // 선택지를 섞음
            { text: loc("산소 + 아스피린", "O2 + ASA"),
              effect: { hp: -2, rep: 22 },          // 정답: 평판 +22
              log: loc("정답.", "Correct.") },
            { text: loc("관찰만", "Observe"),
              effect: { hp: -32, rep: -22 },        // 오답: 평판 -22
              log: loc("위험.", "Dangerous.") },
            // ... 4개 선택지
        ])
    };
}
```

**구조 분석**:
1. **`baseId`**: 같은 문제가 짧은 시간 안에 다시 나오는 것을 막기 위한 식별자
2. **`categoryKey`**: 8개 중 하나
3. **`choices`**: 정확히 4개. **정답은 `rep > 0`** 인 선택지 1개

### 6.4 문제 등록 — `clinicalGenerators` 배열

```js
const clinicalGenerators = [
    generateMIQuestion,
    generateCPRQuestion,
    generateInsulinQuestion,
    // ... 964개
];
```

함수 자체를 배열에 담습니다 (호출 결과가 아님).
나중에 무작위로 하나 골라 `gen()`을 호출해서 새 문제를 만듭니다.

### 6.5 문제 무작위 출제 — `generateClinicalEventByCategory`

```js
function generateClinicalEventByCategory(categoryKey, baseIdFilter, partFilter) {
    let pool = [];

    // 1단계: 모든 generator 돌면서 조건 맞고 최근 안 본 것만 모음
    for (let generator of clinicalGenerators) {
        const ev = generator();              // 함수 호출해 문제 생성
        normalizeEvent(ev);
        const catOk = !categoryKey || ev.categoryKey === categoryKey;
        const idOk = !baseIdFilter || baseIdFilter.includes(ev.baseId);
        const partOk = !partFilter || ev.part === partFilter;
        if (catOk && idOk && partOk && !recentlyUsed(ev.baseId)) {
            pool.push(ev);
        }
    }

    // 2단계: pool이 비었으면 recentIds 비우고 다시
    if (pool.length === 0) {
        gameState.recentIds = [];
        // (위와 같은 로직 반복, 단 recentlyUsed 검사 없음)
    }

    if (pool.length === 0) return null;     // 정말 없음

    const selected = pick(pool);             // 무작위 선택
    rememberQuestion(selected.baseId);       // 최근 본 목록에 추가
    return selected;
}
```

### 6.6 화면 그리기 — `renderSceneCard`

```js
function renderSceneCard(ev, options = {}) {
    const { mode = "survival", questionIndex = null, meta = [] } = options;

    // 카드 HTML을 문자열로 만들어 game-area에 넣음
    UI.gameArea.innerHTML = `
      <div class="scene-card card">
        <div class="category-tag">${ev.category} · ${ev.part}</div>
        <span class="scene-emoji">${ev.emoji}</span>
        <h2 class="scene-title">[Q${questionIndex}] ${ev.title}</h2>
        ${ev.image ? `<div class="scene-image">${ev.image}</div>` : ""}
        <p class="scene-desc">${ev.desc}</p>
        <div class="choice-list" id="choice-list"></div>
      </div>
    `;

    // 각 선택지 버튼 만들고 클릭 핸들러 연결
    const listEl = document.getElementById("choice-list");
    ev.choices.forEach((choice, idx) => {
        const btn = document.createElement("button");
        btn.className = "choice-btn";
        btn.innerHTML = choice.text;
        btn.onclick = () => {                    // 사용자가 클릭하면
            if (mode === "survival") handleSurvivalChoice(choice, ev);
            else handleQuizChoice(choice, ev, idx);
        };
        listEl.appendChild(btn);                 // 화면에 추가
    });
}
```

> **템플릿 리터럴(`` `...` ``)**: 백틱으로 감싸면 `${변수}`로 값을 끼워넣을 수 있는 문자열. HTML 만들기 편함.

> **이벤트 핸들러 연결**: `btn.onclick = () => {...}` — 버튼이 클릭되면 화살표 함수 안 코드 실행.

### 6.7 정답 처리 — `handleQuizChoice`

```js
function handleQuizChoice(choice, ev) {
    // 1. 모든 버튼 비활성화 (중복 클릭 방지)
    document.querySelectorAll("#choice-list .choice-btn").forEach(b => b.disabled = true);

    // 2. 정답 여부 판정 (rep > 0 이 정답)
    const isCorrect = (choice.effect?.rep || 0) > 0;

    // 3. 정답 선택지 찾기 (피드백용)
    const correctChoice = ev.choices.find(c => (c.effect?.rep || 0) > 0);

    // 4. 시각적 표시: 정답=녹색, 사용자 오답=빨강
    const buttons = document.querySelectorAll("#choice-list .choice-btn");
    ev.choices.forEach((c, i) => {
        if (c === correctChoice) buttons[i].classList.add("answer-correct");
        if (c === choice && !isCorrect) buttons[i].classList.add("answer-wrong");
    });

    // 5. 카운트 증가
    if (isCorrect) {
        gameState.correctCount += 1;
        gameState.lifetime.totalQuizSolved += 1;
    } else {
        gameState.wrongCount += 1;
        addWrongId(ev.baseId);              // 오답노트에 추가
    }

    // 6. SRS Leitner 박스 갱신 (간격 반복 학습)
    srsAnswered(ev.baseId, isCorrect);

    // 7. 피드백 메시지 표시
    const feedbackHtml = `
        <div class="feedback-box ${isCorrect ? "correct" : "wrong"}">
            ${isCorrect ? "✅ 정답!" : "❌ 오답"}
            <p>${choice.log}</p>
        </div>
        <button id="next-btn" class="choice-btn primary">다음 →</button>
    `;
    document.getElementById("feedback-zone").innerHTML = feedbackHtml;
    document.getElementById("next-btn").onclick = goNextQuiz;

    // 8. 저장
    saveSettings();
}
```

### 6.8 SRS Leitner 박스 (간격 반복) — 효율적 암기

```js
const SRS_INTERVALS_DAYS = [0, 0, 1, 3, 7, 14];
//                          ↑ box 0~5의 다음 출제 간격

function srsAnswered(baseId, isCorrect) {
    if (!gameState.srs.cards[baseId]) {
        gameState.srs.cards[baseId] = { box: 1 };
    }
    const card = gameState.srs.cards[baseId];

    if (isCorrect) {
        card.box = Math.min(card.box + 1, 5);   // 정답 → 박스 +1 (최대 5)
    } else {
        card.box = 1;                            // 오답 → 박스 1로
    }

    // 다음 출제 시점 계산
    const days = SRS_INTERVALS_DAYS[card.box];
    card.dueDate = Date.now() + days * 24 * 60 * 60 * 1000;
}
```

**원리**:
- 자주 틀리는 문제 → 박스 1 (매일 출제)
- 잘 아는 문제 → 박스 5 (14일에 한 번만)
- 이 방식으로 시간 대비 학습 효과 극대화

### 6.9 모드 전환 시스템

`gameState.mode`에 따라 `renderRoot()`가 다른 화면을 그립니다:

```js
function renderRoot() {
    if (gameState.mode === "menu") return renderMainMenu();
    if (gameState.mode === "quiz_menu") return renderQuizMenu();
    if (gameState.mode === "quiz") return renderNextQuizQuestion();
    if (gameState.mode === "survival") return renderSurvivalEvent("random_hub");
    if (gameState.mode === "settings") return renderSettings();
    // ...
}
```

### 6.10 데이터 저장 — `localStorage`

```js
function saveSettings() {
    const data = {
        lang: gameState.lang,
        studyTools: gameState.studyTools,
        srs: gameState.srs,
        lifetime: gameState.lifetime,
        // ...
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadSettings() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
        const data = JSON.parse(raw);
        Object.assign(gameState, data);     // gameState에 병합
    } catch (e) { /* 손상된 데이터 무시 */ }
}
```

> **`localStorage`**: 브라우저에 영구 저장하는 작은 저장소 (5-10MB). 앱을 닫아도 데이터가 남음.
> **JSON.stringify / JSON.parse**: 객체를 텍스트로 / 텍스트를 객체로 변환.

### 6.11 서바이벌 모드 — 보스·콤보·엔딩

```js
function renderSurvivalEvent(eventId) {
    const upcomingCount = gameState.eventCount + 1;
    const boss = bossEventForCount(upcomingCount);

    if (boss) {
        ev = boss;                          // 5/10/18 이벤트는 보스
    } else {
        const r = Math.random();
        if (r < 0.7) {
            ev = generateClinicalEventByCategory(null);   // 70% 임상 문제
        } else if (r < 0.93) {
            ev = pick(flavorEvents)();      // 23% 일상 이벤트
        } else {
            ev = restEvent();               // 7% 휴식 이벤트
        }
    }
    gameState.eventCount += 1;
    renderSceneCard(ev, { mode: "survival" });
}
```

**보스 이벤트** (`eventCount === 5, 10, 18`):
- 코드 블루 (심정지)
- VIP 환자 (이사장 모친)
- 대량 외상 환자

**콤보 시스템**: 연속 정답 3/5/7/10 회 시 보너스 평판·HP.

**엔딩 결정** (`decideEnding()`): 정답률·HP·평판·이야기 플래그(예: `helpedNewbie`, `codeBlueFailed`) 조합으로 13가지 엔딩 중 결정.

---

## 7. `service-worker.js` — 오프라인 작동의 비밀

서비스 워커는 **백그라운드에서 작동하는 작은 프로그램**입니다. 사용자가 인터넷이 끊겨도 앱이 작동하게 만듭니다.

```js
const CACHE_NAME = 'nurse-sim-v4.6.0';
const ASSETS = [
    './',
    './index.html',
    './script.js',
    './manifest.json',
    './icons/icon-192.png',
    // ...
];

// 1. 설치 단계: 처음 만났을 때 모든 자산 다운로드
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) =>
            Promise.all(ASSETS.map((url) => cache.add(url).catch(() => {})))
        )
    );
});

// 2. 활성화 단계: 이전 버전 캐시 삭제
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
});

// 3. 요청 가로채기: 매번 fetch 시 캐시 먼저 확인
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;          // 캐시에 있으면 그것
            return fetch(event.request);        // 없으면 네트워크
        })
    );
});
```

### 작동 흐름
```
사용자가 앱을 처음 열음
  ↓
브라우저: index.html, script.js 등 다운로드
  ↓
service-worker.js: 모든 파일을 캐시(저장)
  ↓
[다음에 접속 시]
  ↓
브라우저가 파일 요청
  ↓
service-worker가 가로채서 캐시에서 반환
  ↓
인터넷 없어도 즉시 작동!
```

> **버전 관리**: `CACHE_NAME` 끝의 `v4.6.0`을 바꾸면, 사용자가 다음 접속 시 새 버전을 받습니다 (`activate` 단계에서 옛 캐시 삭제).

---

## 8. `manifest.json` — "앱처럼" 보이게 만드는 파일

```json
{
  "name": "Nurse Simulator",                  ← 풀네임
  "short_name": "NurseSim",                   ← 홈 화면 짧은 이름
  "description": "...",
  "start_url": "./index.html",                ← 아이콘 누르면 이 URL 열림
  "display": "standalone",                    ← 브라우저 UI 숨기고 앱처럼
  "orientation": "portrait",                  ← 세로 모드 고정
  "background_color": "#eef2f5",
  "theme_color": "#7fa881",
  "icons": [
    { "src": "./icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "./icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "./icons/icon-512-maskable.png", "purpose": "maskable" }
  ]
}
```

**`display: "standalone"`이 핵심**: 사용자가 "홈 화면에 추가"하면 브라우저 주소창 없이 앱처럼 풀스크린으로 열림.

**`maskable` 아이콘**: Android 시스템이 동그라미·네모 등 다양한 모양으로 자를 수 있게 안전 여백을 둔 아이콘.

---

## 9. PWA란 무엇인가

**PWA (Progressive Web App)** = 웹사이트 + 앱의 장점.

| 기능 | 일반 웹사이트 | PWA | 네이티브 앱 |
|---|---|---|---|
| URL로 접근 | ✅ | ✅ | ❌ |
| 홈 화면 설치 | ❌ | ✅ | ✅ |
| 오프라인 작동 | ❌ | ✅ | ✅ |
| 풀스크린 | ❌ | ✅ | ✅ |
| 앱스토어 심사 | ❌ | ❌ | ✅ |
| 자동 업데이트 | ✅ | ✅ | (수동) |
| 개발 비용 | 낮음 | 낮음 | 높음 |

**PWA 3대 요소**:
1. **HTTPS** (보안 연결, 또는 localhost)
2. **manifest.json** (앱 메타데이터)
3. **service-worker.js** (오프라인)

이 세 가지가 갖춰지면 브라우저가 자동으로 "이 사이트를 설치하시겠습니까?"를 띄웁니다.

---

## 10. 코드를 더 배우려면

### 추천 학습 순서

#### 1단계: 기본 (1-2주)
- **HTML**: [MDN HTML 입문](https://developer.mozilla.org/ko/docs/Learn/HTML)
- **CSS**: [CSS 핵심 개념](https://developer.mozilla.org/ko/docs/Learn/CSS)
- 직접 만들기: 이력서 페이지

#### 2단계: JavaScript 기초 (2-4주)
- 변수 (`let`, `const`)
- 함수
- 배열·객체
- 조건문·반복문
- DOM 조작 (`getElementById`, `addEventListener`)

#### 3단계: 이 코드 읽기 도전
1. `script.js` 첫 200줄 (헬퍼 함수들)
2. `gameState` 객체 구조 이해
3. 한 generator 함수 골라서 분석 (예: `generateMIQuestion`)
4. `renderSceneCard`가 화면을 어떻게 그리는지 추적

#### 4단계: 직접 수정해보기
- 새 문제 1개 추가 (`generateMyQuestion()` + `clinicalGenerators` 배열에 등록)
- 색깔 바꾸기 (`:root`의 `--sage` 변경)
- 새 일상 이벤트 추가 (`flavorEvents` 배열에 추가)

### 무료 학습 사이트
- **MDN Web Docs**: 웹 표준 공식 문서 (한국어)
- **freeCodeCamp**: 무료 인터랙티브 강의
- **JavaScript.info**: 깊이 있는 JS 학습

### 이 프로젝트로 배울 수 있는 개념들
- ✅ HTML/CSS/JS의 협력
- ✅ 이벤트 기반 프로그래밍 (`onclick`)
- ✅ 객체 지향 데이터 모델링 (`gameState`)
- ✅ 함수형 패턴 (배열에 함수 담기)
- ✅ 비동기 프로그래밍 (`fetch`, `Promise`)
- ✅ 로컬 저장소 (`localStorage`)
- ✅ PWA 기술 (Service Worker, Manifest)
- ✅ 다국어 처리 (i18n)
- ✅ 상태 관리 패턴
- ✅ 반응형 디자인 (모바일 최적화)

---

## 부록: 자주 쓰는 JavaScript 문법 정리

```js
// 1. 변수
const PI = 3.14;        // 변하지 않는 값
let count = 0;          // 변하는 값
count = count + 1;

// 2. 함수
function 더하기(a, b) {
    return a + b;
}

const 빼기 = (a, b) => a - b;   // 화살표 함수 (위와 동일)

// 3. 객체
const 사람 = {
    이름: "민지",
    나이: 24,
    인사: function() { return "안녕!" }
};
console.log(사람.이름);          // "민지"
console.log(사람.인사());        // "안녕!"

// 4. 배열
const 과일 = ["사과", "바나나", "포도"];
console.log(과일[0]);            // "사과"
과일.push("키위");                // 끝에 추가
과일.length                       // 4 (길이)

// 5. 조건문
if (점수 >= 90) {
    grade = "A";
} else if (점수 >= 80) {
    grade = "B";
} else {
    grade = "C";
}

// 6. 반복문
for (let i = 0; i < 5; i++) {
    console.log(i);              // 0, 1, 2, 3, 4
}

과일.forEach(f => console.log(f));   // 각 요소 처리

// 7. 화살표 함수 + 배열 메서드 (모던 패턴)
const 짝수 = [1,2,3,4,5,6].filter(n => n % 2 === 0);   // [2, 4, 6]
const 두배 = [1,2,3].map(n => n * 2);                  // [2, 4, 6]
const 합 = [1,2,3].reduce((sum, n) => sum + n, 0);    // 6

// 8. 템플릿 리터럴
const 이름 = "민지";
const 메시지 = `안녕, ${이름}님!`;     // "안녕, 민지님!"

// 9. 옵셔널 체이닝 (?.)
const 효과 = choice?.effect?.rep || 0;
// choice가 없거나 effect가 없으면 0, 아니면 rep 값

// 10. 구조 분해 할당
const { 이름, 나이 } = 사람;          // 객체에서 꺼내기
const [first, second] = 과일;        // 배열에서 꺼내기
```

---

## 11. 자동 업데이트 시스템 — 사용자에게 새 버전 자동 배포

### 작동 원리

PWA의 강력한 점: 코드를 수정하고 push하면 사용자에게 **자동 배포**됩니다.

```
[개발자]                              [사용자]
1. 문제 추가/코드 수정                 (앱 사용 중)
2. npm run release  ◄─ 이 한 줄!         │
3. git push                              │
   ↓                                     ↓
GitHub Pages (서버)         앱 백그라운드에서 새 버전 감지
                                         ↓
                              service-worker가 조용히 다운로드
                                         ↓
                            다음 앱 실행 시 → 새 버전 자동 적용
```

### 핵심: `service-worker.js`의 `CACHE_NAME`

```js
const CACHE_NAME = 'nurse-sim-20260510-14b52082';
//                  ↑날짜    ↑script.js 해시 8자리
```

브라우저는 이 이름이 바뀌면:
1. "새 버전 감지!" 인식
2. 옛 캐시 삭제
3. 새 파일 다운로드
4. 사용자가 모르는 사이 업데이트

### 이름이 안 바뀌면? → 사용자는 옛 버전 영원히

이게 PWA의 가장 큰 함정입니다. 그래서 자동화가 필수.

### 자동화 — `scripts/bump-version.js`

```js
const crypto = require('crypto');
const fs = require('fs');

// script.js의 SHA256 해시 (8자리)
const hash = crypto.createHash('sha256')
                   .update(scriptContent + htmlContent)
                   .digest('hex')
                   .slice(0, 8);

// 날짜와 결합
const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const newCacheName = `nurse-sim-${date}-${hash}`;

// service-worker.js 자동 갱신
fs.writeFileSync('service-worker.js', sw.replace(/CACHE_NAME = '[^']+'/, `CACHE_NAME = '${newCacheName}'`));
```

### 사용 방법

```bash
# 문제 추가 등 코드 수정 후
npm run release            # → 버전 자동 갱신
git add -A
git commit -m "+50 questions"
git push                   # → GitHub Pages 배포 → 자동 사용자 업뎃!
```

### 함수별 분석

#### `crypto.createHash('sha256')` — 내용 지문
```js
const hash = crypto.createHash('sha256')
                   .update(scriptContent)
                   .digest('hex')
                   .slice(0, 8);
```

**무엇이 일어나는가**:
- `createHash('sha256')`: 해시 계산기 생성 (SHA256 알고리즘)
- `.update(scriptContent)`: script.js 전체 내용을 입력
- `.digest('hex')`: 64자리 16진수 해시 결과
- `.slice(0, 8)`: 앞 8자리만 사용 (예: `14b52082`)

**왜 해시?**: 같은 내용 → 같은 해시. 1바이트라도 바뀌면 → 완전히 다른 해시.
즉, 코드가 바뀌면 자동으로 새 버전 이름이 생성됩니다.

---

## 12. 폰 출시 — PWA로 즉시 배포

### Path A: GitHub Pages (가장 쉬움, 무료)

#### 단계 1: GitHub에 코드 올리기
이미 push 한 상태라면 건너뜀.

#### 단계 2: Pages 활성화
1. GitHub 저장소 → **Settings** 탭
2. 좌측 메뉴 → **Pages**
3. **Source**: `Deploy from a branch` 선택
4. **Branch**: `main` (또는 현재 브랜치) → `/ (root)` → Save
5. 1-2분 후 위에 URL 표시:
   `https://<username>.github.io/nursing-simulation/`

#### 단계 3: 휴대폰에서 설치
**iPhone (Safari)**:
1. 위 URL 접속
2. 하단 공유 아이콘 (네모+화살표)
3. **"홈 화면에 추가"**
4. 홈 화면에 앱 아이콘 생성됨

**Android (Chrome)**:
1. 위 URL 접속
2. 우측 상단 ⋮ 메뉴
3. **"앱 설치"** 또는 **"홈 화면에 추가"**

#### 결과
- 풀스크린 앱처럼 작동
- 오프라인에서도 작동
- 자동 업데이트 (개발자가 코드 push할 때마다)
- 무료

### Path B: 네이티브 앱 (App Store / Play Store)

```bash
# Capacitor로 감싸기 (Mac/Windows 모두)
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap add ios
npx cap add android
npx cap sync

# iOS 빌드 (Mac만)
npx cap open ios          # Xcode 열림 → Run 버튼

# Android 빌드 (Mac/Windows)
npx cap open android      # Android Studio 열림 → Run 버튼
```

**필요 사항**:
- iOS: Mac + Xcode + Apple Developer ($99/년) + App Store 심사 (1-2주)
- Android: Android Studio + Google Play Console ($25 1회) + 심사 (수일)

### 권장: PWA 먼저, 네이티브 나중

| 상황 | 추천 |
|---|---|
| 친구·가족·소규모 사용자 | **PWA만** (당장 배포) |
| 1,000명+ 사용자 목표 | PWA → 네이티브 |
| 광고 수익화 | 네이티브 (PWA 광고는 제한적) |
| 푸시 알림 | 네이티브 (iOS PWA는 16.4+만) |

---

## 13. 깊이 있는 함수 분석 — 더 자세히 알고 싶다면

### 13.1 `normalizeEvent(ev)` — 데이터 정규화

```js
function normalizeEvent(ev) {
    if (!ev) return null;
    if (!ev.category) ev.category = catName(ev.categoryKey);
    if (!ev.choices) ev.choices = [];
    if (typeof ev.title === "object") ev.title = L(ev.title);
    if (typeof ev.desc === "object") ev.desc = L(ev.desc);
    return ev;
}
```

**역할**: 문제 객체에 빠진 필드를 채우고, 다국어 객체를 현재 언어 문자열로 변환.

**왜 필요한가**:
- Generator마다 약간씩 다른 형식으로 객체를 반환할 수 있음
- 화면에 그릴 때는 일관된 형태가 필요
- "방어적 프로그래밍": 잘못된 입력에도 화면이 깨지지 않게

**한 줄씩 분석**:
- `if (!ev) return null;`: ev가 없으면 즉시 종료 (방어막)
- `if (!ev.category) ev.category = catName(ev.categoryKey);`:
  category가 비었으면 categoryKey로 카테고리 이름 조회 후 채움
- `if (typeof ev.title === "object") ev.title = L(ev.title);`:
  title이 `{ko: "...", en: "..."}` 객체면 현재 언어로 변환

### 13.2 `recentlyUsed(baseId)` — 중복 출제 방지

```js
function rememberQuestion(baseId) {
    if (!gameState.recentIds) gameState.recentIds = [];
    if (gameState.recentIds.length >= 80) {
        gameState.recentIds.shift();   // 가장 오래된 것 제거
    }
    gameState.recentIds.push(baseId);   // 끝에 추가
}

function recentlyUsed(baseId) {
    return gameState.recentIds.includes(baseId);
}
```

**알고리즘**: FIFO 큐(First-In-First-Out)로 80개 유지.

**왜 80?**: 200개 연속 추출 테스트에서 80이 적절한 균형점이었음.
- 너무 작으면 → 같은 문제 자주 반복
- 너무 크면 → pool이 좁아져 다양성 ↓

**`shift()` vs `unshift()`**:
- `shift()`: 배열 **앞**에서 제거 → 오래된 것
- `push()`: 배열 **뒤**에 추가 → 최신
- 합치면 큐(queue)

### 13.3 `decideEnding()` — 13가지 엔딩 결정

```js
function decideEnding() {
    const acc = gameState.correctCount /
                Math.max(1, gameState.correctCount + gameState.wrongCount);
    const flags = gameState.narrative;

    // 우선순위: 특수 이스터에그 → 일반 엔딩
    if (flags.codeBlueFailed && flags.ethicsViolation) {
        return "tragedy";    // 비극 엔딩
    }
    if (flags.helpedNewbie && flags.sharedMeal && acc >= 0.85) {
        return "newBond";    // 새로운 인연 엔딩
    }
    if (flags.threeBosses && acc >= 0.9) {
        return "veteran";    // 베테랑 엔딩
    }
    // ... 13개 엔딩

    // 기본 (점수 기반)
    if (acc >= 0.7 && gameState.hp >= 50) return "safe";
    if (acc < 0.5) return "needsStudy";
    return "ordinary";
}
```

**디자인 패턴**: 우선순위가 높은 특수 조건부터 검사. 매칭 안 되면 일반 점수.

**`gameState.narrative` 플래그들**:
- `codeBlueFailed`: 보스 #1 실패
- `helpedNewbie`: 신규 간호사 도와줌
- `sharedMeal`: 동료와 야식 같이 먹음
- `ethicsViolation`: 윤리 위반 선택지 골랐음

**플래그 설정** (`captureNarrative()`):
```js
function captureNarrative(ev, choice) {
    if (ev.baseId === "newbie" && choice.text.includes("함께")) {
        gameState.narrative.helpedNewbie = true;
    }
    // ...
}
```

### 13.4 `setLang(lang)` — 다국어 즉시 전환

```js
function setLang(lang) {
    if (lang !== "ko" && lang !== "en") return;   // 검증
    gameState.lang = lang;
    document.documentElement.lang = lang;          // <html lang> 갱신
    document.title = lang === "en"
        ? "Nurse Simulator"
        : "간호사 시뮬레이터";
    saveSettings();                                // localStorage 저장
    syncLangButtons();                             // 토글 버튼 시각 갱신
    renderRoot();                                  // 현재 화면 다시 그리기
}
```

**핵심 인사이트**: 모든 텍스트가 `loc(ko, en)`을 통해 출력되므로,
`gameState.lang`만 바꾸고 화면을 다시 그리면 → 즉시 전환.

별도 번역 라이브러리(i18next 등) 없이 단순한 함수 하나로 해결.

### 13.5 비동기 처리 — `setTimeout`과 애니메이션

```js
function showToast(text, kind = "primary") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${kind}`;
    toast.textContent = text;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("show"));
    // ↑ 다음 프레임에 'show' 클래스 추가 → CSS transition 작동

    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 400);
    }, 2000);
}
```

**`requestAnimationFrame` 트릭**: 요소를 추가한 직후 바로 클래스를 더하면 transition이 작동 안 함. 다음 프레임에 추가해야 부드럽게 나타남.

**중첩 `setTimeout`**:
- 0ms: 토스트 등장
- 2000ms: 'show' 제거 (페이드 아웃 시작)
- 2400ms: DOM에서 완전 제거

### 13.6 이미지 SVG 생성 — 그림 문제

```js
function generateBabinskiImgQuestion() {
    const svg = `<svg viewBox="0 0 600 220" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="220" fill="#f0f9ff"/>
        <g transform="translate(40,40)">
            <path d="M 20 80 L 200 80 ..." fill="#fed7aa" stroke="#9a3412"/>
            <text x="130" y="135" font-size="13">Babinski 반사</text>
        </g>
    </svg>`;
    return {
        baseId: "babinskiImg",
        // ...
        image: svg,    // ← 문자열로 SVG를 저장
        choices: [...]
    };
}
```

**왜 SVG?**:
- 텍스트 기반 (PNG/JPG처럼 별도 파일 불필요)
- 무한 확대해도 깨지지 않음
- 인라인으로 삽입 → 오프라인 작동
- 한국어/영어 텍스트 동적 삽입 가능

`renderSceneCard`가 이걸 그릴 때:
```js
const imageBlock = ev.image
    ? `<div class="scene-image">${ev.image}</div>`
    : "";
```
`innerHTML`로 직접 삽입되어 화면에 SVG가 그려짐.

### 13.7 SVG 안에서 다국어 처리

```js
const svg = `<svg ...>
    <text>${loc("정답", "Answer")}</text>
</svg>`;
```

generator가 호출될 때 `loc()`이 실행되면서 현재 언어의 텍스트가 SVG 문자열에 삽입됩니다. 즉, **언어 토글 시 다음 문제부터 이미지 안의 글자도 자동으로 바뀝니다**.

### 13.8 에러 복구 — `showErrorRecovery`

```js
window.addEventListener("error", (e) => {
    showErrorRecovery(e.error || e.message);
});

function showErrorRecovery(err) {
    try {
        const safeMsg = String(err?.message || err).replace(/[<>&]/g, "");
        UI.gameArea.innerHTML = `
            <div class="card">
                <h2>⚠️ 일시적인 문제</h2>
                <details><summary>기술 정보</summary><pre>${safeMsg}</pre></details>
                <button onclick="location.reload()">앱 다시 시작</button>
                <button onclick="goHome()">메인 메뉴</button>
            </div>
        `;
    } catch (_e) { /* 에러 표시 자체가 실패하면 무시 */ }
}
```

**왜 중요한가**: 한 번의 버그로 앱이 완전히 멈추지 않게 합니다.

**`window.addEventListener("error", ...)`**: JavaScript 어디서든 잡지 못한 에러를 가로챔.

**`replace(/[<>&]/g, "")`**: 에러 메시지에 `<script>` 같은 위험한 문자열이 들어와도 HTML 인젝션 방지.

---

## 14. 직접 수정해보기 — 미니 튜토리얼

### 미션 1: 새 문제 추가

**1. `script.js`에서 generator 작성**

`clinicalGenerators` 배열 위에 함수 추가:

```js
function generateMyQuestion() {
    return {
        baseId: "myFirstQuestion",
        categoryKey: "fundamentals",
        part: loc("기본간호", "Fundamentals"),
        emoji: "📚",
        title: loc("내 첫 문제", "My First Question"),
        desc: loc("환자가 통증을 호소합니다. 어떻게 하나요?",
                  "Patient reports pain. What do you do?"),
        choices: shuffle([
            { text: loc("통증 평가 후 처방대로 진통제", "Assess and give ordered analgesic"),
              effect: { hp: -2, rep: 22 },
              log: loc("정답.", "Correct.") },
            { text: loc("관찰만", "Just observe"),
              effect: { hp: -20, rep: -15 },
              log: loc("부족.", "Insufficient.") },
            { text: loc("환자에게 \"참으세요\"", "Tell patient to bear it"),
              effect: { hp: -30, rep: -25 },
              log: loc("부적절.", "Inappropriate.") },
            { text: loc("진통제 양 임의로 ↑", "Increase dose without order"),
              effect: { hp: -40, rep: -35 },
              log: loc("부적절.", "Inappropriate.") }
        ])
    };
}
```

**2. `clinicalGenerators` 배열에 등록**

```js
const clinicalGenerators = [
    // ... 기존 함수들
    generateMyQuestion,    // ← 끝에 추가
];
```

**3. 검증**

```bash
npm test               # JS 문법 검증
npm start              # http://localhost:8000 에서 확인
```

**4. 배포**

```bash
npm run release        # 버전 자동 갱신
git add -A && git commit -m "+1 my question"
git push               # 사용자 자동 업뎃
```

### 미션 2: 색깔 바꾸기

`index.html`의 `:root` 안:

```css
:root {
    --sage: #7fa881;       ← 이걸 #ff6b6b 등으로 바꾸면
    --sage-dark: #5e8961;  ← 전체 앱 색이 즉시 바뀜
}
```

### 미션 3: 새 일상 이벤트 추가

`script.js`의 `flavorEvents` 배열 끝에:

```js
() => ({
    baseId: "myFlavorEvent",
    categoryKey: "flavor",
    part: loc("재밌는 상황", "Funny Moment"),
    emoji: "😄",
    title: loc("내 이벤트", "My Event"),
    desc: loc("...", "..."),
    choices: shuffle([
        // 4개 선택지 (정답은 rep > 0)
    ])
}),
```



이 앱은 **"백엔드 없는, 빌드 없는, 의존성 없는"** 단순함을 추구합니다. HTML 1개 + JS 1개 + CSS는 HTML 안에 — 그게 전부입니다. 이런 단순함은 코드를 처음 배우는 사람에게 좋은 교재가 됩니다. **"구현 디테일에 휘둘리지 않고 문제 해결에 집중"**하는 방법을 보여주는 좋은 예시이기 때문입니다.

행운을 빕니다. 💚

— 코드는 결국 글입니다. 매일 한 줄씩 읽다 보면 어느새 직접 쓰고 있습니다.
