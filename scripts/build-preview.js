#!/usr/bin/env node
// 단일 HTML 미리보기 빌드 — 모든 CSS/JS 인라인, file:// 로 열어도 동작
// 사용: node scripts/build-preview.js → preview.html 생성
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf-8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf-8");
const questions = fs.readFileSync(path.join(root, "questions.js"), "utf-8");
const nclex = fs.readFileSync(path.join(root, "nclex-content.js"), "utf-8");
const content = fs.readFileSync(path.join(root, "content.js"), "utf-8");
const script = fs.readFileSync(path.join(root, "script.js"), "utf-8");

let out = indexHtml;

// 1. 외부 styles.css 링크 → 인라인 <style>
out = out.replace(
    /<link rel="stylesheet" href="styles\.css">/,
    `<style>${styles}</style>`
);

// 2. 외부 script src → 인라인 <script>
out = out.replace(/<script src="questions\.js"><\/script>/, `<script>${questions}</script>`);
out = out.replace(/<script src="nclex-content\.js"><\/script>/, `<script>${nclex}</script>`);
out = out.replace(/<script src="content\.js"><\/script>/, `<script>${content}</script>`);
out = out.replace(/<script src="script\.js"><\/script>/, `<script>${script}</script>`);

// 3. file:// 호환성을 위해:
//    - manifest 링크 제거 (file:// 에서 404)
//    - apple-touch-icon, icon 링크 제거 (없으면 깔끔)
//    - CSP 제거 (file:// 에서 inline + 외부 폰트 둘 다 어색)
out = out.replace(/<link rel="manifest"[^>]*>\s*/, "");
out = out.replace(/<link rel="icon"[^>]*>\s*/g, "");
out = out.replace(/<link rel="apple-touch-icon"[^>]*>\s*/g, "");
out = out.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\s*/, "");

// 4. Pretendard CDN 폰트 유지 (대부분 동작) — 인터넷 없으면 시스템 폰트로 fallback
//    이미 styles.css 에 fallback chain 있음

// 5. service worker 등록은 script.js 안에 try/catch 로 wrap 되어 있으므로 그대로

const outputPath = path.join(root, "preview.html");
fs.writeFileSync(outputPath, out);

const sizeKb = (out.length / 1024).toFixed(1);
console.log(`✓ preview.html 생성 — ${sizeKb}KB`);
console.log(`  ${outputPath}`);
console.log(`  브라우저에서 더블클릭하거나 file:// 로 열면 바로 실행됩니다.`);
