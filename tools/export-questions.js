// 의료 검수용 CSV 내보내기 스크립트
// 사용법: node tools/export-questions.js > questions-for-review.csv

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

// 최소 mock으로 generator만 실행
const fakeDoc = {
    getElementById: () => ({ classList: { add(){}, remove(){}, toggle(){}, contains:()=>false }, appendChild(){}, prepend(){}, remove(){},
        set textContent(v){}, set innerHTML(v){}, set innerText(v){}, set className(v){}, addEventListener(){},
        querySelectorAll(){return[]}, querySelector(){return null}, dataset:{}, setAttribute(){}, getAttribute(){return null}, style:{}, set onclick(v){} }),
    documentElement: { lang: 'ko' }, createElement: () => ({ classList:{add(){},remove(){}}, appendChild(){}, remove(){}, set textContent(v){}, set className(v){}, set innerHTML(v){}, addEventListener(){}, setAttribute(){}, dataset:{} }),
    body: { appendChild(){} }, addEventListener(){}, title: ''
};
const fakeStorage = { _: {}, getItem(k){return this._[k]||null}, setItem(k,v){this._[k]=v} };
const wrapped = "const document = arguments[0];\nconst window = { addEventListener(){} };\nconst localStorage = arguments[1];\nconst location = { protocol: 'http:' };\nconst navigator = { serviceWorker: { register: () => Promise.resolve() } };\nconst requestAnimationFrame = fn => fn();\nconst setTimeout = (fn,t) => fn();\nconst alert = () => {};\nconst confirm = () => true;\nconst clearInterval = () => {};\nconst setInterval = () => null;\n" + src + "\nreturn { setLang, clinicalGenerators, normalizeEvent };";
const exp = new Function(wrapped)(fakeDoc, fakeStorage);

function csvEsc(s) {
    if (s == null) return '';
    s = String(s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
}

const headers = [
    'baseId', 'category', 'part', 'lang',
    'title', 'desc',
    'choice1_text', 'choice1_correct', 'choice1_log',
    'choice2_text', 'choice2_correct', 'choice2_log',
    'choice3_text', 'choice3_correct', 'choice3_log',
    'choice4_text', 'choice4_correct', 'choice4_log',
    'has_image', 'review_status', 'reviewer_notes'
];
console.log(headers.join(','));

for (const lang of ['ko', 'en']) {
    exp.setLang(lang);
    for (const gen of exp.clinicalGenerators) {
        const ev = exp.normalizeEvent(gen());
        const cols = [csvEsc(ev.baseId), csvEsc(ev.category), csvEsc(ev.part), lang, csvEsc(ev.title), csvEsc(ev.desc)];
        for (let i = 0; i < 4; i++) {
            const c = ev.choices[i];
            cols.push(csvEsc(c?.text), c && (c.effect?.rep || 0) > 0 ? 'YES' : 'no', csvEsc(c?.log));
        }
        cols.push(ev.image ? 'YES' : 'no', '', '');
        console.log(cols.join(','));
    }
}
