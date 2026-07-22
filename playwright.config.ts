import { defineConfig, devices } from "@playwright/test";

const frontBaseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.2:4173";
const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL || "http://127.0.0.1:5000";
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER === "1";

export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: false,
    timeout: 240_000,
    expect: {
        timeout: 30_000,
    },
    retries: process.env.CI ? 1 : 0,
    use: {
        baseURL: frontBaseUrl,
        trace: "on-first-retry",
    },
    projects: [
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"],
            },
        },
    ],
    webServer: skipWebServer
        ? undefined
        : {
              command: `VITE_API_BASE_URL=${apiBaseUrl} npm run build && npm run preview -- --host 0.0.0.0 --port 4173 --strictPort`,
              url: frontBaseUrl,
              reuseExistingServer: true,
              timeout: 180_000,
          },
});
