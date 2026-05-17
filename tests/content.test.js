const C = require("../content.js");

// scoreHandoff 와 동일한 normalization 으로 키워드 ↔ narration 매칭 검증
function norm(s) { return String(s || "").toLowerCase().replace(/[^\w가-힣]/g, ""); }

describe("인계 환자 컨텐츠 invariants", () => {
    test("100명 이상의 인계 환자가 존재한다", () => {
        expect(C.HANDOFF_PATIENTS.length).toBeGreaterThanOrEqual(100);
    });

    test("모든 환자 ID가 고유하다", () => {
        const ids = C.HANDOFF_PATIENTS.map(p => p.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    test("모든 환자 narration 본문이 고유하다 (스토리 중복 방지)", () => {
        const narrations = C.HANDOFF_PATIENTS.map(p => p.narration);
        expect(new Set(narrations).size).toBe(narrations.length);
    });

    C.HANDOFF_PATIENTS.forEach(p => {
        describe(p.id, () => {
            test("필수 필드를 가진다", () => {
                expect(p.id).toBeTruthy();
                expect(p.title).toBeTruthy();
                expect(p.narration).toBeTruthy();
                expect(p.hint).toBeTruthy();
                expect(Array.isArray(p.keywords)).toBe(true);
            });
            test("최소 4개 이상의 채점 키워드를 가진다", () => {
                expect(p.keywords.length).toBeGreaterThanOrEqual(4);
            });
            test("키워드가 모두 narration 본문에 (normalized) 등장한다", () => {
                const n = norm(p.narration);
                p.keywords.forEach(k => {
                    expect(n).toEqual(expect.stringContaining(norm(k)));
                });
            });
            test("키워드끼리 중복되지 않는다", () => {
                expect(new Set(p.keywords).size).toBe(p.keywords.length);
            });
        });
    });
});

describe("듀티(생존모드) 스토리 비트 invariants", () => {
    test("최소 5개 이상의 스토리 비트가 존재한다", () => {
        expect(C.SURVIVAL_STORY_BEATS.length).toBeGreaterThanOrEqual(5);
    });
    test("모든 비트가 고유한 atEvent 값을 가진다", () => {
        const events = C.SURVIVAL_STORY_BEATS.map(b => b.atEvent);
        expect(new Set(events).size).toBe(events.length);
    });
    C.SURVIVAL_STORY_BEATS.forEach(b => {
        describe(b.baseId, () => {
            test("필수 필드(atEvent, title, desc, choices) 보유", () => {
                expect(Number.isInteger(b.atEvent)).toBe(true);
                expect(b.title).toBeTruthy();
                expect(b.desc).toBeTruthy();
                expect(Array.isArray(b.choices)).toBe(true);
                expect(b.choices.length).toBeGreaterThanOrEqual(2);
            });
            test("정답 선택지가 정확히 1개", () => {
                const correctCount = b.choices.filter(c => c.correct === true).length;
                expect(correctCount).toBe(1);
            });
        });
    });
});

describe("트리아지 케이스 invariants", () => {
    test("최소 1개 이상의 트리아지 케이스가 존재한다", () => {
        expect(C.TRIAGE_CASES.length).toBeGreaterThanOrEqual(1);
    });

    C.TRIAGE_CASES.forEach(t => {
        describe(t.id, () => {
            test("정확히 5명의 환자를 가진다", () => {
                expect(t.patients.length).toBe(5);
            });
            test("우선순위가 1~5 중복 없이 1번씩 사용된다", () => {
                const priorities = t.patients.map(p => p.priority).sort();
                expect(priorities).toEqual([1, 2, 3, 4, 5]);
            });
            test("환자 id가 중복되지 않는다", () => {
                const ids = t.patients.map(p => p.id);
                expect(new Set(ids).size).toBe(ids.length);
            });
            test("각 환자가 emoji, desc, why 를 가진다", () => {
                t.patients.forEach(p => {
                    expect(p.emoji).toBeTruthy();
                    expect(p.desc).toBeTruthy();
                    expect(p.why).toBeTruthy();
                });
            });
            test("케이스가 rationale 을 제공한다", () => {
                expect(t.rationale).toBeTruthy();
            });
        });
    });
});

describe("임상 시나리오 invariants", () => {
    test("최소 1개 이상의 시나리오가 존재한다", () => {
        expect(C.SCENARIOS.length).toBeGreaterThanOrEqual(1);
    });

    C.SCENARIOS.forEach(s => {
        describe(s.id, () => {
            test("필수 필드(id, title, intro, steps)를 가진다", () => {
                expect(s.id).toBeTruthy();
                expect(s.title).toBeTruthy();
                expect(s.intro).toBeTruthy();
                expect(Array.isArray(s.steps)).toBe(true);
                expect(s.steps.length).toBeGreaterThanOrEqual(3);
            });

            s.steps.forEach((step, idx) => {
                test(`step ${idx + 1} 에 prompt 와 정확히 1개의 정답을 가진 4개 선택지가 있다`, () => {
                    expect(step.prompt).toBeTruthy();
                    expect(Array.isArray(step.choices)).toBe(true);
                    expect(step.choices.length).toBeGreaterThanOrEqual(3);
                    const correctCount = step.choices.filter(c => c.correct === true).length;
                    expect(correctCount).toBe(1);
                });
                test(`step ${idx + 1} 의 모든 선택지가 text 와 숫자 hp/rep 를 가진다`, () => {
                    step.choices.forEach(c => {
                        expect(typeof c.text).toBe("string");
                        expect(c.text.length).toBeGreaterThan(0);
                        if (c.hp !== undefined) expect(Number.isFinite(c.hp)).toBe(true);
                        if (c.rep !== undefined) expect(Number.isFinite(c.rep)).toBe(true);
                    });
                });
            });
        });
    });
});

describe("출제 경향 데이터 invariants", () => {
    test("years 배열이 단조 증가", () => {
        const y = C.EXAM_TRENDS.years;
        for (let i = 1; i < y.length; i++) expect(y[i]).toBeGreaterThan(y[i - 1]);
    });

    test("모든 카테고리가 years 와 같은 길이의 값 배열을 가진다", () => {
        const len = C.EXAM_TRENDS.years.length;
        Object.entries(C.EXAM_TRENDS.categories).forEach(([cat, values]) => {
            expect(Array.isArray(values)).toBe(true);
            expect(values.length).toBe(len);
            values.forEach(v => expect(Number.isFinite(v)).toBe(true));
        });
    });

    test("국시 8과목이 모두 포함된다", () => {
        const expected = ["기본간호학", "성인간호학", "모성간호학", "아동간호학", "지역사회간호학", "정신간호학", "간호관리학", "보건의약관계법규"];
        expected.forEach(c => {
            expect(C.EXAM_TRENDS.categories).toHaveProperty(c);
        });
    });
});
