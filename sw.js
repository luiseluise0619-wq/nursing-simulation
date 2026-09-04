// 간호사 시뮬레이터 서비스 워커 — 오프라인 우선 (cache-first)
// Electron 환경(file://)에서는 등록되지 않으며, PWA 호스팅 시에만 동작.
// 버전 변경 시 활성화·재캐싱 발생 — 배포 때마다 v숫자 올려야 사용자에게 업데이트 전달됨.
const CACHE = "nurse-sim-v74";
const ASSETS = [
    "./",
    "./index.html",
    "./styles.css",
    "./script.js",
    "./questions.js",
    "./questions-extra.js",
    "./questions-bank.js",
    // nclex-content.js (2MB) — lazy load 시 자동 캐시 (precache 제외하여 초기 로딩 빠르게)
    "./kor-content.js",
    "./content.js",
    "./i18n.js",
    "./images/image-map.js",
    "./manifest.json",
    "./icon.svg",
    "./privacy.html",
    "./terms.html",
    // 임상 SVG 일러스트 (Claude 디자인) — 자주 보는 UI 일러스트만 precache
    "./images/onboard-1-welcome.svg",
    "./images/onboard-2-simulation.svg",
    "./images/onboard-3-nclex.svg",
    "./images/onboard-4-analytics.svg",
    "./images/onboard-5-start.svg",
    "./images/empty-no-bookmarks.svg",
    "./images/empty-no-data.svg",
    "./images/empty-no-records.svg",
    "./images/empty-no-search.svg",
    "./images/empty-no-wrong.svg",
];

self.addEventListener("install", (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            // 이전 버전 캐시를 실제로 지웠을 때만 "업데이트됨"이다.
            // 최초 설치(지울 이전 캐시가 없음)에도 알리면 처음 온 사용자가
            // 첫 화면에서 "새 버전 준비됨 · 새로고침"을 보게 된다.
            const stale = keys.filter((k) => k !== CACHE && k.startsWith("nurse-sim-"));
            return Promise.all(stale.map((k) => caches.delete(k))).then(() => stale.length > 0);
        }).then((upgraded) => self.clients.claim().then(() => upgraded)).then((upgraded) => {
            if (!upgraded) return;
            // 활성 클라이언트에 새 버전 알림 (앱 측에서 토스트 표시)
            return self.clients.matchAll({ type: "window" }).then((clients) => {
                clients.forEach((c) => c.postMessage({ type: "NEW_VERSION", cache: CACHE }));
            });
        })
    );
});
self.addEventListener("fetch", (e) => {
    if (e.request.method !== "GET") return;
    // /api/ (TTS 등 동적 응답) 은 SW 가 가로채지 않고 네트워크 직행 — 캐시·오프라인 폴백 대상 아님
    if (new URL(e.request.url).pathname.startsWith("/api/")) return;
    e.respondWith(
        caches.match(e.request).then((hit) => hit || fetch(e.request).then((resp) => {
            if (!resp || resp.status !== 200 || resp.type !== "basic") return resp;
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
            return resp;
        }).catch(() => caches.match("./index.html")))
    );
});
