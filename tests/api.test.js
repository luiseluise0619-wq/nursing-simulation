// 서버리스 함수 남용 방지 가드 — 교차 사이트 차단 + IP 슬라이딩 윈도우
// 실제 외부 호출(Gemini/Edge TTS)까지 가기 전에 막히는지만 검증한다.
const path = require("path");

function mockRes() {
    const r = {
        statusCode: null, body: null, headers: {}, ended: false,
        status(c) { r.statusCode = c; return r; },
        json(b) { r.body = b; r.ended = true; return r; },
        setHeader(k, v) { r.headers[k] = v; },
        write() {}, end() { r.ended = true; },
    };
    return r;
}
function mockReq({ method = "POST", origin, host = "app.example", body = {}, query = {}, ip = "1.2.3.4" } = {}) {
    const headers = { host, "x-forwarded-for": ip };
    if (origin !== undefined) headers.origin = origin;
    return { method, headers, body, query, socket: { remoteAddress: ip } };
}
function fresh(mod) {
    const p = path.join(__dirname, "..", "api", mod);
    delete require.cache[require.resolve(p)];
    return require(p);
}

describe("api/tutor 남용 방지", () => {
    test("POST 가 아니면 405", async () => {
        const res = mockRes();
        await fresh("tutor.js")(mockReq({ method: "GET" }), res);
        expect(res.statusCode).toBe(405);
    });

    test("다른 사이트에서 온 호출은 403 — 소유자 API 쿼터 보호", async () => {
        const res = mockRes();
        await fresh("tutor.js")(mockReq({ origin: "https://evil.example", host: "app.example" }), res);
        expect(res.statusCode).toBe(403);
        expect(res.body).toEqual({ error: "forbidden" });
    });

    test("같은 사이트 호출은 origin 검사를 통과한다 (키 미설정이면 500)", async () => {
        const res = mockRes();
        const prev = process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_API_KEY;
        try {
            await fresh("tutor.js")(mockReq({ origin: "https://app.example", host: "app.example" }), res);
            expect(res.statusCode).not.toBe(403);
        } finally { if (prev !== undefined) process.env.GEMINI_API_KEY = prev; }
    });

    test("같은 IP 가 시간당 상한을 넘기면 429", async () => {
        const handler = fresh("tutor.js");
        const prev = process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_API_KEY;   // 외부 호출 전에 종료되도록
        try {
            let limited = 0;
            for (let i = 0; i < 25; i++) {
                const res = mockRes();
                await handler(mockReq({ ip: "9.9.9.9" }), res);
                if (res.statusCode === 429) limited++;
            }
            expect(limited).toBeGreaterThan(0);
        } finally { if (prev !== undefined) process.env.GEMINI_API_KEY = prev; }
    });

    test("다른 IP 는 서로의 상한에 영향을 주지 않는다", async () => {
        const handler = fresh("tutor.js");
        const prev = process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_API_KEY;
        try {
            for (let i = 0; i < 25; i++) await handler(mockReq({ ip: "7.7.7.7" }), mockRes());
            const res = mockRes();
            await handler(mockReq({ ip: "8.8.8.8" }), res);
            expect(res.statusCode).not.toBe(429);
        } finally { if (prev !== undefined) process.env.GEMINI_API_KEY = prev; }
    });

    test("API 키는 응답 어디에도 실려 나가지 않는다", async () => {
        const res = mockRes();
        process.env.GEMINI_API_KEY = "SECRET-TEST-KEY";
        try {
            await fresh("tutor.js")(mockReq({ origin: "https://evil.example" }), res);
            expect(JSON.stringify(res.body || {})).not.toContain("SECRET-TEST-KEY");
        } finally { delete process.env.GEMINI_API_KEY; }
    });
});

describe("api/tts 남용 방지", () => {
    test("다른 사이트에서 온 호출은 403 — 무료 TTS 프록시로 쓰이지 않게", async () => {
        const res = mockRes();
        await fresh("tts.js")(mockReq({ method: "GET", origin: "https://evil.example", host: "app.example", query: { text: "안녕" } }), res);
        expect(res.statusCode).toBe(403);
    });

    test("GET 이 아니면 405", async () => {
        const res = mockRes();
        await fresh("tts.js")(mockReq({ method: "POST", query: { text: "안녕" } }), res);
        expect(res.statusCode).toBe(405);
    });

    test("text 가 없으면 400 (외부 TTS 세션을 열지 않는다)", async () => {
        const res = mockRes();
        await fresh("tts.js")(mockReq({ method: "GET", query: {} }), res);
        expect(res.statusCode).toBe(400);
    });

    test("허용 목록 밖 voice 는 기본 음성으로 대체된다 (임의 입력 차단)", () => {
        const src = require("fs").readFileSync(path.join(__dirname, "..", "api", "tts.js"), "utf8");
        expect(src).toMatch(/ALLOWED_VOICES\.has/);
        expect(src).toMatch(/ko-KR-SunHiNeural/);
    });
});
