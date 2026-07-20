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

module.exports = async (req, res) => {
    try {
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
