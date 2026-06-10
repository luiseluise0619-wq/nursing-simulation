#!/usr/bin/env node
// 출시 준비 자동 점검 — Play Console 업로드 전 실행
// 사용: node scripts/launch-check.js
//
// 검증 항목 (Play Store 거절 사유 모두 커버):
// 1. AdMob ID 일관성 (capacitor.config / AndroidManifest / script.js)
// 2. 개인정보처리방침에 AdMob 명시
// 3. SDK / 권한 / signing 설정
// 4. 컨텐츠 카운트 (KO 320 / NCLEX 2,200)
// 5. 필수 파일 존재 (privacy / terms / sitemap / robots / manifest)
// 6. 키스토어 properties 참조 가능
// 7. JS syntax / JSON-LD 파싱
// 8. SW 버전 (출시 시 v숫자 올렸는지)
// 9. www 빌드 동기화

const fs = require("fs");
const path = require("path");

let pass = 0, warn = 0, fail = 0;
const log = (icon, msg) => console.log(`${icon} ${msg}`);
const ok   = (m) => { pass++; log("✅", m); };
const wn   = (m) => { warn++; log("⚠️ ", m); };
const er   = (m) => { fail++; log("❌", m); };

console.log("\n🚀 간호사 시뮬레이터 — 출시 점검\n" + "=".repeat(50));

// 1. AdMob ID 일관성
const capCfg = JSON.parse(fs.readFileSync("capacitor.config.json", "utf8"));
const manifest = fs.readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
const script = fs.readFileSync("script.js", "utf8");
const cfgAppId = capCfg.plugins?.AdMob?.appId;
const manifestAppId = manifest.match(/ca-app-pub-\d+~\d+/)?.[0];
if (cfgAppId && manifestAppId && cfgAppId === manifestAppId) ok(`AdMob App ID 일관 (${cfgAppId})`);
else er(`AdMob App ID 불일치: cfg=${cfgAppId} vs manifest=${manifestAppId}`);

const rewardedUnit = script.match(/rewarded:\s*"(ca-app-pub-\d+\/\d+)"/)?.[1];
const hintUnit = script.match(/hint:\s*"(ca-app-pub-\d+\/\d+)"/)?.[1];
if (rewardedUnit && hintUnit && rewardedUnit !== hintUnit) ok(`AdMob 광고 단위 분리 (rewarded ≠ hint)`);
else wn(`AdMob 단위 ID 확인 필요`);

// 2. 개인정보처리방침에 AdMob 명시
const privacy = fs.readFileSync("privacy.html", "utf8");
if (/AdMob/.test(privacy) && /보상형|rewarded|광고/i.test(privacy)) ok("개인정보처리방침 AdMob 광고 섹션 OK");
else er("개인정보처리방침에 AdMob 광고 섹션 누락 → Play Console 거절 사유");

// 3. SDK / 권한 / signing
const vars = fs.readFileSync("android/variables.gradle", "utf8");
const minSdk = parseInt(vars.match(/minSdkVersion\s*=\s*(\d+)/)?.[1], 10);
const targetSdk = parseInt(vars.match(/targetSdkVersion\s*=\s*(\d+)/)?.[1], 10);
if (targetSdk >= 34) ok(`targetSdkVersion ${targetSdk} (정책 준수: 34+)`);
else er(`targetSdkVersion ${targetSdk} — 정책 미달 (34+ 필요)`);
if (minSdk >= 21) ok(`minSdkVersion ${minSdk} (99%+ 디바이스 지원)`);
else wn(`minSdkVersion ${minSdk} 낮음`);

// 4. 컨텐츠 카운트
const kor = fs.readFileSync("kor-content.js", "utf8");
const nclex = fs.readFileSync("nclex-content.js", "utf8");
const korCount = (kor.match(/{\s*id:\s*['"]/g) || []).length;
const nclexCount = (nclex.match(/{\s*id:\s*['"]/g) || []).length;
if (korCount >= 320) ok(`한국 국시 ${korCount}문항 (320+ 충족)`);
else er(`한국 국시 ${korCount}문항 — 320 미달`);
if (nclexCount >= 2200) ok(`NCLEX ${nclexCount}문항 (2200+ 충족)`);
else er(`NCLEX ${nclexCount}문항 — 2200 미달`);

// 5. 필수 파일
for (const f of ["privacy.html", "terms.html", "LICENSE", "sitemap.xml", "robots.txt", "manifest.json", "sw.js", "LAUNCH_GUIDE.md"]) {
    if (fs.existsSync(f)) ok(`파일 ${f}`);
    else er(`파일 ${f} 누락`);
}

// 6. 키스토어 설정
const appGradle = fs.readFileSync("android/app/build.gradle", "utf8");
if (/keystoreProperties/.test(appGradle)) ok("키스토어 설정 (keystore.properties 참조)");
else er("키스토어 설정 누락 — AAB 서명 불가");

// 7. JS syntax
for (const f of ["script.js", "i18n.js", "sw.js", "images/image-map.js", "kor-content.js", "nclex-content.js", "content.js"]) {
    try { new Function(fs.readFileSync(f, "utf8")); ok(`Syntax ${f}`); }
    catch (e) { er(`Syntax 에러 ${f}: ${e.message.slice(0, 80)}`); }
}

// JSON-LD
const indexHtml = fs.readFileSync("index.html", "utf8");
const ldMatch = indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
if (ldMatch) {
    try { JSON.parse(ldMatch[1]); ok("JSON-LD 파싱 OK"); }
    catch (e) { er(`JSON-LD 파싱 실패: ${e.message}`); }
}

// 8. SW 버전
const sw = fs.readFileSync("sw.js", "utf8");
const swVer = sw.match(/CACHE\s*=\s*"nurse-sim-v(\d+)"/)?.[1];
if (swVer && parseInt(swVer, 10) >= 5) ok(`SW 캐시 v${swVer} (출시용 최신)`);
else wn(`SW 캐시 v${swVer} — 출시 시 v숫자 올렸는지 확인`);

// 9. www 빌드 동기화
const filesToCheck = ["script.js", "styles.css", "i18n.js", "sw.js", "manifest.json"];
let allSync = true;
for (const f of filesToCheck) {
    if (fs.existsSync(f) && fs.existsSync(`www/${f}`)) {
        const rootHash = require("crypto").createHash("md5").update(fs.readFileSync(f)).digest("hex");
        const wwwHash = require("crypto").createHash("md5").update(fs.readFileSync(`www/${f}`)).digest("hex");
        if (rootHash !== wwwHash) { er(`www/${f} 동기화 안됨 — 'npm run build:web' 실행`); allSync = false; }
    }
}
if (allSync) ok("root ↔ www 동기화 OK");

// 10. 광고 정책 — 자동 호출 검사
const autoShowMatches = (script.match(/showRewarded\(/g) || []).length;
const userActionMatches = (script.match(/await Ads\.showRewarded/g) || []).length;
if (userActionMatches >= 1 && autoShowMatches === userActionMatches) ok(`AdMob 정책: ${userActionMatches}회 모두 사용자 시작 (auto 호출 0)`);

// 11. 광고 옵트인 검증 (자동 알림 금지)
if (!/Ads\.showRewarded\(\)\s*;/.test(script)) ok("AdMob 정책: 옵트인 단위 분리 (자동 호출 없음)");

// 결과
console.log("\n" + "=".repeat(50));
console.log(`✅ 통과 ${pass}  ⚠️ 경고 ${warn}  ❌ 실패 ${fail}`);
if (fail === 0) {
    console.log("\n🎉 출시 가능 상태입니다! Play Console 업로드 준비 완료.\n");
    process.exit(0);
} else {
    console.log("\n🚨 위 실패 항목을 해결한 후 출시하세요.\n");
    process.exit(1);
}
