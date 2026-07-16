// 웹 자산을 www/ 로 복사 — Capacitor sync 전 매번 실행
// npm run build:web → npx cap sync android
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const WWW = path.join(ROOT, "www");
const FILES = [
    "index.html", "styles.css", "script.js", "questions.js", "questions-extra.js", "nclex-content.js", "kor-content.js", "content.js", "i18n.js",
    "manifest.json", "sw.js", "icon.svg", "privacy.html", "terms.html",
    "robots.txt", "sitemap.xml",
];
const DIRS = ["build", "images"];

if (!fs.existsSync(WWW)) fs.mkdirSync(WWW, { recursive: true });

function copyDir(src, dst) {
    if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) {
        const s = path.join(src, name);
        const d = path.join(dst, name);
        const stat = fs.statSync(s);
        if (stat.isDirectory()) copyDir(s, d);
        else fs.copyFileSync(s, d);
    }
}

let copied = 0;
for (const f of FILES) {
    const src = path.join(ROOT, f);
    if (!fs.existsSync(src)) { console.warn("skip (missing):", f); continue; }
    fs.copyFileSync(src, path.join(WWW, f));
    copied++;
}
for (const d of DIRS) {
    const src = path.join(ROOT, d);
    if (!fs.existsSync(src)) continue;
    copyDir(src, path.join(WWW, d));
    copied++;
}
console.log(`✓ www/ 동기화 완료 — ${copied} 항목`);
