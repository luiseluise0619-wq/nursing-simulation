#!/usr/bin/env node
// 단일 HTML 미리보기 빌드 — 모바일 robust 버전
// 사용: node scripts/build-preview.js → preview.html 생성
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf-8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf-8");
const questions = fs.readFileSync(path.join(root, "questions.js"), "utf-8");
const nclex = fs.readFileSync(path.join(root, "nclex-content.js"), "utf-8");
const content = fs.readFileSync(path.join(root, "content.js"), "utf-8");
const i18nPath = path.join(root, "i18n.js");
const i18n = fs.existsSync(i18nPath) ? fs.readFileSync(i18nPath, "utf-8") : "";
const korPath = path.join(root, "kor-content.js");
const kor = fs.existsSync(korPath) ? fs.readFileSync(korPath, "utf-8") : "";
const imageMapPath = path.join(root, "images", "image-map.js");
const imageMap = fs.existsSync(imageMapPath) ? fs.readFileSync(imageMapPath, "utf-8") : "";
const script = fs.readFileSync(path.join(root, "script.js"), "utf-8");

let out = indexHtml;

// 1. 외부 styles.css 링크 → 인라인 <style>
out = out.replace(
    /<link rel="stylesheet" href="styles\.css">/,
    `<style>${styles}</style>`
);

// 2. 외부 script src → 인라인 <script>
out = out.replace(/<script src="i18n\.js"><\/script>/, i18n ? `<script>${i18n}</script>` : "");
out = out.replace(/<script src="questions\.js"><\/script>/, `<script>${questions}</script>`);
out = out.replace(/<script src="nclex-content\.js"><\/script>/, `<script>${nclex}</script>`);
out = out.replace(/<script src="kor-content\.js"><\/script>/, kor ? `<script>${kor}</script>` : "");
out = out.replace(/<script src="content\.js"><\/script>/, `<script>${content}</script>`);
out = out.replace(/<script src="images\/image-map\.js"><\/script>/, imageMap ? `<script>${imageMap}</script>` : "");
out = out.replace(/<script src="script\.js"><\/script>/, `<script>${script}</script>`);

// 3. 외부 리소스 모두 제거 (file:// 호환 + 오프라인 안전):
//    - manifest / favicon / apple-touch-icon
//    - Pretendard CDN (인터넷 없으면 hang) → 시스템 폰트 사용
//    - CSP 메타 (file:// 충돌)
out = out.replace(/<link rel="manifest"[^>]*>\s*/, "");
out = out.replace(/<link rel="icon"[^>]*>\s*/g, "");
out = out.replace(/<link rel="apple-touch-icon"[^>]*>\s*/g, "");
out = out.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\s*/, "");
out = out.replace(/<link[^>]*preconnect[^>]*>\s*/g, "");
out = out.replace(/<link[^>]*pretendard[^>]*>\s*/gi, "");

// 4. PREVIEW 부트스트랩 — 약관/온보딩 자동 스킵 + safety timeout + 에러 표시
const previewBoot = `
<script>
(function() {
    // 안전 시드 — 약관/온보딩 스킵
    try {
        const KEY = "nurseSim:v1";
        let data = {};
        try { data = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch {}
        if (!data.accepted || !data.onboarded) {
            data.accepted = data.accepted || { version: "1.0", at: Date.now() };
            data.onboarded = true;
            data.previewSeeded = true;
            try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
        }
    } catch {}

    // 글로벌 에러 핸들러 — boot 실패 시 로더 자리에 에러 표시
    window.addEventListener("error", function(e) {
        try {
            const loader = document.getElementById("app-loader");
            if (loader && !loader._erred) {
                loader._erred = true;
                loader.innerHTML = '<div style="text-align:center;max-width:280px;padding:20px;font-family:system-ui,sans-serif;color:#1e293b;">' +
                    '<div style="font-size:32px;margin-bottom:12px;">⚠️</div>' +
                    '<div style="font-weight:700;font-size:15px;margin-bottom:6px;">미리보기 로드 실패</div>' +
                    '<div style="font-size:12px;color:#64748b;margin-bottom:14px;">' + (e.message || "알 수 없는 오류").replace(/</g,"&lt;").substring(0, 200) + '</div>' +
                    '<button onclick="location.reload()" style="background:#7fa881;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-weight:600;cursor:pointer;">새로고침</button>' +
                    '</div>';
                loader.style.background = "#eef2f5";
            }
        } catch {}
    });

    // Safety timeout — 5초 후에도 로더가 있으면 강제 제거
    setTimeout(function() {
        const loader = document.getElementById("app-loader");
        if (loader && !loader.classList.contains("fade-out")) {
            console.warn("[preview] safety timeout — forcing loader removal");
            loader.classList.add("fade-out");
            setTimeout(function() { try { loader.remove(); } catch {} }, 400);
        }
    }, 5000);

    // 미리보기 배지
    window.addEventListener("DOMContentLoaded", function() {
        try {
            const badge = document.createElement("div");
            badge.textContent = "PREVIEW";
            badge.style.cssText = "position:fixed;top:8px;right:8px;background:#7fa881;color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:10px;z-index:99998;letter-spacing:0.06em;font-family:system-ui,sans-serif;opacity:0.85;pointer-events:none;";
            document.body.appendChild(badge);
        } catch {}
    });
})();
</script>
`;
out = out.replace("</head>", previewBoot + "</head>");

const outputPath = path.join(root, "preview.html");
fs.writeFileSync(outputPath, out);

const sizeKb = (out.length / 1024).toFixed(1);
console.log(`✓ preview.html 생성 — ${sizeKb}KB`);
console.log(`  ${outputPath}`);
console.log(`  특징: 외부 의존성 0 / safety timeout 5s / 에러 발생 시 화면 표시`);
