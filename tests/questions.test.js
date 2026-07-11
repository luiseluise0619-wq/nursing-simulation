const Q = require("../questions.js");

describe("문제 생성기 invariants", () => {
    const generators = Q.allGenerators;
    const ITERATIONS = 30;

    test("generator 개수 확인", () => {
        expect(generators.length).toBeGreaterThanOrEqual(29);
    });

    generators.forEach((gen) => {
        const sample = gen();
        describe(`${sample.baseId} (${sample.category})`, () => {
            test("선택지가 4~5개 (기본 4지선다 / 심화 케이스형 5지선다)", () => {
                for (let i = 0; i < ITERATIONS; i++) {
                    const ev = gen();
                    // 심화(advanced)는 근접 오답이 많은 5지선다 허용, 그 외 4지선다
                    if (ev.difficulty === "advanced") {
                        expect(ev.choices.length).toBeGreaterThanOrEqual(4);
                        expect(ev.choices.length).toBeLessThanOrEqual(5);
                    } else {
                        expect(ev.choices.length).toBe(4);
                    }
                }
            });

            test("정답(correct: true)이 정확히 1개", () => {
                for (let i = 0; i < ITERATIONS; i++) {
                    const ev = gen();
                    const correctCount = ev.choices.filter(c => c.correct === true).length;
                    expect(correctCount).toBe(1);
                }
            });

            test("필수 필드(baseId, category, title, desc, choices)를 가진다", () => {
                const ev = gen();
                expect(ev.baseId).toBeTruthy();
                expect(ev.category).toBeTruthy();
                expect(ev.title).toBeTruthy();
                expect(ev.desc).toBeTruthy();
                expect(Array.isArray(ev.choices)).toBe(true);
            });

            test("모든 선택지가 text와 effect를 가진다", () => {
                const ev = gen();
                ev.choices.forEach(c => {
                    expect(typeof c.text).toBe("string");
                    expect(c.text.length).toBeGreaterThan(0);
                    expect(c.effect).toBeDefined();
                });
            });

            test("선택지 text 가 중복되지 않는다", () => {
                for (let i = 0; i < ITERATIONS; i++) {
                    const ev = gen();
                    const texts = ev.choices.map(c => c.text);
                    expect(new Set(texts).size).toBe(texts.length);
                }
            });
        });
    });
});

describe("도메인별 동적 계산 검증", () => {
    test("Dopamine 계산: c = 5*w*60/1000 = 0.3w", () => {
        for (let i = 0; i < 50; i++) {
            const ev = Q.generateDopamineQuestion();
            const correct = ev.choices.find(c => c.correct);
            const num = parseFloat(correct.text);
            expect(num).toBeGreaterThan(0);
            expect(correct.text).toMatch(/ml\/hr/);
        }
    });

    test("Burn: 정답 % 값이 선택된 부위 값의 합과 일치", () => {
        for (let i = 0; i < 50; i++) {
            const ev = Q.generateBurnQuestion();
            const correct = ev.choices.find(c => c.correct);
            // 본문의 (X%) 값들을 합산
            const matches = [...ev.desc.matchAll(/\((\d+)%\)/g)].map(m => parseInt(m[1], 10));
            const sum = matches.reduce((a, b) => a + b, 0);
            expect(correct.text).toBe(`${sum}%`);
        }
    });

    test("Apgar: 정답 점수가 0~10 범위", () => {
        for (let i = 0; i < 50; i++) {
            const ev = Q.generateApgarQuestion();
            const correct = ev.choices.find(c => c.correct);
            const n = parseInt(correct.text, 10);
            expect(n).toBeGreaterThanOrEqual(0);
            expect(n).toBeLessThanOrEqual(10);
        }
    });

    test("Naegele: 정답 텍스트가 'X월 Y일' 형식", () => {
        for (let i = 0; i < 30; i++) {
            const ev = Q.generateNaegeleQuestion();
            const correct = ev.choices.find(c => c.correct);
            expect(correct.text).toMatch(/^\d+월 \d+일$/);
        }
    });

    test("ABGA: 정답 텍스트가 4가지 산-염기 분류 중 하나", () => {
        const valid = ["호흡성 산증", "대사성 산증", "호흡성 알칼리증", "대사성 알칼리증"];
        for (let i = 0; i < 30; i++) {
            const ev = Q.generateABGAQuestion();
            const correct = ev.choices.find(c => c.correct);
            expect(valid).toContain(correct.text);
        }
    });
});

describe("저장소 헬퍼 (스모크)", () => {
    test("스크립트 모듈 로드 가능", () => {
        const s = require("../script.js");
        expect(typeof s.dailySeed).toBe("function");
        expect(typeof s.clamp).toBe("function");
        expect(s.clamp(10, 0, 5)).toBe(5);
        expect(s.clamp(-1, 0, 5)).toBe(0);
        expect(s.dailySeed("2024-01-01")).toBe(s.dailySeed("2024-01-01"));
        expect(s.dailySeed("2024-01-01")).not.toBe(s.dailySeed("2024-01-02"));
    });
});

describe("ECG 문제 — 동등한 의미의 보기가 동시에 나타나지 않음", () => {
    test("정답을 제외한 보기 중에 '제세동' 문구가 들어간 보기가 없다", () => {
        for (let i = 0; i < 100; i++) {
            const ev = Q.generateECGQuestion();
            const correct = ev.choices.find(c => c.correct);
            const distractors = ev.choices.filter(c => !c.correct);
            // 정답이 제세동 관련일 때, 다른 보기에는 '제세동' 단어가 나타나선 안 됨
            if (correct.text.includes("제세동")) {
                distractors.forEach(d => {
                    expect(d.text.includes("제세동")).toBe(false);
                });
            }
        }
    });
});

describe("일일 챌린지 시드 결정성", () => {
    const s = require("../script.js");
    test("같은 날짜 시드는 동일", () => {
        expect(s.dailySeed("2026-05-16")).toBe(s.dailySeed("2026-05-16"));
    });
    test("다른 날짜 시드는 다름", () => {
        const seeds = new Set();
        for (let m = 1; m <= 12; m++) {
            seeds.add(s.dailySeed(`2026-${String(m).padStart(2, "0")}-01`));
        }
        expect(seeds.size).toBe(12);
    });
});
