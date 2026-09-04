// Vercel Serverless Function — 고품질 한국어 Neural TTS (Microsoft Edge TTS)
// GET /api/tts?text=<본문>&voice=ko-KR-SunHiNeural  →  audio/mpeg 스트림
//
// 무료(Edge 읽어주기 엔진 · Azure Neural 음성). 앱은 실패 시 기기 Web Speech 로 폴백하므로
// 이 함수가 없거나 오류여도 음성 재생 자체는 항상 동작한다.
//
// 의존성: msedge-tts (Vercel 빌드 시 자동 설치 — package.json 에 선언).
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");

// 허용 음성 화이트리스트 (한국어 Neural) — 임의 입력 차단
const ALLOWED_VOICES = new Set([
    "ko-KR-SunHiNeural",   // 여성, 밝고 자연스러움 (기본)
    "ko-KR-InJoonNeural",  // 남성, 차분함
    "ko-KR-HyunsuNeural",  // 남성, 젊은 톤
]);


// --- 남용 방지 (의존성 없음) -------------------------------------------
// 이 함수는 인증이 없다. 클라이언트의 하루 5회 제한은 localStorage 기반이라
// 지우거나 직접 호출하면 그만이므로, 서버에서도 최소한의 방어선을 둔다.
//   1) 교차 사이트 호출 차단 — 다른 웹사이트가 이 엔드포인트를 자기 기능처럼
//      쓰면서 소유자의 API 쿼터를 태우는 것을 막는다.
//   2) IP 기준 슬라이딩 윈도우 — 웜 인스턴스 안에서만 유효한 best-effort.
//      완전한 차단이 아니라 무료 티어를 즉시 소진시키는 반복 호출을 늦춘다.
const RATE = new Map();
function rateLimited(req, limit, windowMs) {
    const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()
        || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    const hits = (RATE.get(ip) || []).filter(t => now - t < windowMs);
    hits.push(now);
    RATE.set(ip, hits);
    if (RATE.size > 5000) { for (const [k, v] of RATE) { if (!v.some(t => now - t < windowMs)) RATE.delete(k); } }
    return hits.length > limit;
}
function crossSite(req) {
    const origin = req.headers.origin;
    if (!origin) return false;              // 브라우저 외 호출은 여기서 거르지 않는다
    const host = req.headers["x-forwarded-host"] || req.headers.host || "";
    try { return new URL(origin).host !== host; } catch { return true; }
}

module.exports = async (req, res) => {
    try {
        if (req.method && req.method !== "GET") { res.status(405).json({ error: "GET only" }); return; }
        if (crossSite(req)) { res.status(403).json({ error: "forbidden" }); return; }
        if (rateLimited(req, 120, 60 * 60 * 1000)) { res.status(429).json({ error: "rate_limited" }); return; }
        const q = req.query || {};
        const text = String(q.text || "").slice(0, 1200).trim();
        const voice = ALLOWED_VOICES.has(q.voice) ? q.voice : "ko-KR-SunHiNeural";
        if (!text) { res.status(400).json({ error: "text required" }); return; }

        const tts = new MsEdgeTTS();
        await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        const { audioStream } = tts.toStream(text);

        res.setHeader("Content-Type", "audio/mpeg");
        // 같은 인계 문장 반복 재생 → CDN/브라우저 캐시로 재생성 방지 (1일)
        res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");

        audioStream.on("data", (chunk) => res.write(chunk));
        audioStream.on("end", () => res.end());
        audioStream.on("error", () => { try { res.status(500).end(); } catch {} });
    } catch (e) {
        // 앱이 기기 TTS 로 폴백하므로 500 이어도 사용자 경험은 유지됨
        try { res.status(500).json({ error: "tts failed" }); } catch {}
    }
};
