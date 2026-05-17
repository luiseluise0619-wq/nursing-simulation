// 간호사 시뮬레이터 서비스 워커 — 오프라인 우선 (cache-first)
// Electron 환경(file://)에서는 등록되지 않으며, PWA 호스팅 시에만 동작.
const CACHE = "nurse-sim-v1";
const ASSETS = [
    "./",
    "./index.html",
    "./styles.css",
    "./script.js",
    "./questions.js",
    "./content.js",
    "./manifest.json",
];

self.addEventListener("install", (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});
self.addEventListener("fetch", (e) => {
    if (e.request.method !== "GET") return;
    e.respondWith(
        caches.match(e.request).then((hit) => hit || fetch(e.request).then((resp) => {
            if (!resp || resp.status !== 200 || resp.type !== "basic") return resp;
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
            return resp;
        }).catch(() => caches.match("./index.html")))
    );
});
