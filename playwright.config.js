// Playwright 설정 — 실 사용자 경로 자동화 테스트
// 실행: npm run test:e2e
// 환경: 로컬 (python http.server 또는 npx serve 로 실행 가정)
module.exports = {
    testDir: "./tests/e2e",
    timeout: 30 * 1000,
    expect: { timeout: 5 * 1000 },
    use: {
        baseURL: "http://localhost:8000",
        headless: true,
        viewport: { width: 390, height: 844 },  // iPhone 14 기본
        actionTimeout: 5 * 1000,
        navigationTimeout: 10 * 1000,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [
        { name: "mobile-portrait", use: { viewport: { width: 390, height: 844 } } },
        { name: "tablet", use: { viewport: { width: 768, height: 1024 } } },
        { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    ],
    reporter: process.env.CI ? "github" : "list",
    webServer: {
        command: "python3 -m http.server 8000",
        url: "http://localhost:8000",
        timeout: 15 * 1000,
        reuseExistingServer: !process.env.CI,
    },
};
