// Vercel Serverless Function — 학습 튜터 (Gemini 무료 티어 · 그라운딩 RAG)
// POST { question, context, lang }  ->  { answer }
//
// API 키는 서버 환경변수 GEMINI_API_KEY 에서만 읽는다 (클라이언트에 절대 노출 X).
// Vercel 대시보드 → Settings → Environment Variables 에 GEMINI_API_KEY 추가 필요.
//
// 안전장치: 답변은 오직 클라이언트가 넘긴 <context>(앱의 검증된 문항·해설) 안에서만.
// context 밖 용량·수치·가이드라인은 지어내지 않도록 강하게 그라운딩 (의료 오정보 방지).
// 의존성 없음 — Vercel Node 18+ 전역 fetch 사용.
const MODEL = "gemini-2.0-flash";

module.exports = async (req, res) => {
    if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
    const key = process.env.GEMINI_API_KEY;
    if (!key) { res.status(500).json({ error: "GEMINI_API_KEY not configured" }); return; }
    try {
        let body = req.body;
        if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
        body = body || {};
        const question = String(body.question || "").slice(0, 500).trim();
        const context = String(body.context || "").slice(0, 8000);
        const lang = body.lang === "en" ? "en" : "ko";
        if (!question) { res.status(400).json({ error: "question required" }); return; }

        const sys = lang === "en"
            ? "You are a study tutor for a nursing exam app. Answer ONLY using the <context> provided. Never state drug doses, lab values, or guidelines that are not present in <context>; if the info is absent, say it is not in the study material. Cite the question IDs you used, like [source: #id]. Do not diagnose or prescribe — this is for study only. Be concise and answer in English."
            : "너는 간호 시험 학습 튜터다. 오직 <context> 안의 내용만 사용해 답하라. <context>에 없는 약물 용량·검사 수치·가이드라인은 절대 지어내지 말고, 없으면 '제공된 학습 자료엔 해당 정보가 없어요'라고 답하라. 사용한 문항 ID를 [출처: #id] 형식으로 표기하라. 진단·처방을 하지 마라(학습 참고용). 한국어로 간결하게 답하라.";

        const payload = {
            system_instruction: { parts: [{ text: sys }] },
            contents: [{ role: "user", parts: [{ text: `<context>\n${context}\n</context>\n\n질문/Question: ${question}` }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 600 },
        };
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!r.ok) {
            // 429(쿼터 초과) 등 — 앱은 "잠시 후 다시" 안내로 폴백
            res.status(502).json({ error: "llm_error", status: r.status });
            return;
        }
        const data = await r.json();
        const cand = ((data.candidates || [])[0] || {});
        const parts = ((cand.content || {}).parts || []);
        const answer = parts.map(p => p && p.text ? p.text : "").join("").trim();
        if (!answer) { res.status(502).json({ error: "empty" }); return; }
        res.setHeader("Content-Type", "application/json");
        res.status(200).json({ answer });
    } catch (e) {
        res.status(500).json({ error: "tutor failed" });
    }
};
