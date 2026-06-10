// 아이콘 자동 생성 — icon.svg → 여러 사이즈 PNG (Electron Builder + PWA + iOS + Android)
// 사용: node scripts/generate-icons.js
// 의존: sharp (devDependency)
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "icon.svg");
const OUT = path.join(ROOT, "build");

// 출력 사이즈 — Electron Builder, iOS, Android, PWA 모두 커버
const SIZES = [
    { size: 1024, name: "icon-1024.png" }, // macOS .icns 입력용·App Store
    { size: 512,  name: "icon-512.png" },  // Google Play
    { size: 256,  name: "icon-256.png" },  // Windows .ico 입력용
    { size: 192,  name: "icon-192.png" },  // PWA standard
    { size: 180,  name: "icon-180.png" },  // iOS apple-touch-icon
    { size: 152,  name: "icon-152.png" },  // iPad
    { size: 128,  name: "icon-128.png" },  // 일반 데스크톱
    { size: 64,   name: "icon-64.png" },
    { size: 48,   name: "icon-48.png" },
    { size: 32,   name: "icon-32.png" },   // favicon
    { size: 16,   name: "icon-16.png" },
];

async function main() {
    if (!fs.existsSync(SRC)) {
        console.error("✗ icon.svg 파일을 찾을 수 없습니다:", SRC);
        process.exit(1);
    }
    if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

    const svgBuffer = fs.readFileSync(SRC);
    console.log(`✓ icon.svg 로드 (${svgBuffer.length} bytes)`);

    for (const { size, name } of SIZES) {
        const out = path.join(OUT, name);
        await sharp(svgBuffer, { density: 384 })
            .resize(size, size)
            .png({ compressionLevel: 9 })
            .toFile(out);
        const stats = fs.statSync(out);
        console.log(`✓ ${name.padEnd(20)} ${size}x${size}  ${(stats.size / 1024).toFixed(1)}KB`);
    }

    // electron-builder 기본 입력: build/icon.png (1024)
    fs.copyFileSync(path.join(OUT, "icon-1024.png"), path.join(OUT, "icon.png"));
    console.log("✓ icon.png (1024) — electron-builder 기본 입력으로 복사 완료");
    console.log("");
    console.log("다음 단계:");
    console.log("  • macOS .icns:  iconutil -c icns build/icon.iconset  (또는 electron-builder 가 자동 변환)");
    console.log("  • Windows .ico: ImageMagick 'convert build/icon-256.png build/icon.ico'");
    console.log("  • PWA: manifest.json 의 icons[] 에 PNG 사이즈 등록 (또는 SVG 그대로 사용)");
}

main().catch(err => { console.error("✗", err); process.exit(1); });
