// 자동 버전 갱신 도구
// 사용: node scripts/bump-version.js
// 효과: script.js 내용 변화에 따라 service-worker.js의 CACHE_NAME을 갱신
//      → 사용자 브라우저가 새 버전 감지 → 자동 업데이트

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SW_PATH = path.join(ROOT, 'service-worker.js');
const SCRIPT_PATH = path.join(ROOT, 'script.js');
const HTML_PATH = path.join(ROOT, 'index.html');
const PKG_PATH = path.join(ROOT, 'package.json');

// 1. script.js + index.html 내용으로 짧은 해시 생성
const scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf8');
const htmlContent = fs.readFileSync(HTML_PATH, 'utf8');
const hash = crypto
    .createHash('sha256')
    .update(scriptContent + htmlContent)
    .digest('hex')
    .slice(0, 8);

// 2. 날짜와 결합 (사람이 읽을 수 있게)
const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const newCacheName = `nurse-sim-${date}-${hash}`;

// 3. service-worker.js 갱신
let sw = fs.readFileSync(SW_PATH, 'utf8');
const swBefore = sw.match(/CACHE_NAME = '([^']+)'/)?.[1];
sw = sw.replace(
    /const CACHE_NAME = '[^']+';/,
    `const CACHE_NAME = '${newCacheName}';`
);
fs.writeFileSync(SW_PATH, sw);

// 4. package.json 버전도 같이 갱신 (날짜 기반)
const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
const semverMatch = pkg.version.match(/^(\d+)\.(\d+)\.(\d+)$/);
if (semverMatch) {
    const [, maj, min, patch] = semverMatch;
    pkg.version = `${maj}.${min}.${parseInt(patch, 10) + 1}`;
    fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');
}

console.log('✅ 버전 갱신 완료');
console.log('  service-worker:', swBefore, '→', newCacheName);
console.log('  package.json:  ', pkg.version);
console.log('');
console.log('다음 단계:');
console.log('  git add -A && git commit -m "release" && git push');
