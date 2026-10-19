import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.pw.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  globalTimeout: 300000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "tablet",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: "safari-mobile",
      use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    {
      command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
    },
    ...(process.env.FE_CLOUD_TEST_DIR
      ? [
          {
            command: `node node_modules/vite/bin/vite.js preview --outDir ${process.env.FE_CLOUD_TEST_DIR} --host 127.0.0.1 --port 4175 --strictPort`,
            url: "http://127.0.0.1:4175",
          },
        ]
      : []),
    ...(process.env.FE_BEFORE_DIR
      ? [
          {
            command: `node ${process.cwd()}/node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4174 --strictPort`,
            cwd: process.env.FE_BEFORE_DIR,
            url: "http://127.0.0.1:4174",
          },
        ]
      : []),
  ],
});
