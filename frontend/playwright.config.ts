import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3100);
// The site with the AI switched on, for tests/e2e/ai.spec.ts (scripts/e2e-ai-server.mjs).
const aiPort = port + 1;

// On GitHub's runners, use the Google Chrome that is already installed instead of
// downloading a browser and its system packages (that download can hang).
const browser = process.env.CI ? { channel: "chrome" } : {};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "off",
  },
  projects: [
    { name: "desktop", testIgnore: /ai\.spec\.ts/, use: { ...devices["Desktop Chrome"], ...browser } },
    { name: "phone", testIgnore: /ai\.spec\.ts/, use: { ...devices["Pixel 7"], ...browser } },
    {
      name: "ai",
      testMatch: /ai\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], ...browser, baseURL: `http://localhost:${aiPort}` },
    },
  ],
  webServer: [
    {
      command: `npm run start -- --port ${port}`,
      url: `http://localhost:${port}/en`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      // Builds .next-ai first when it is missing, so the first local run takes a few minutes.
      command: `node scripts/e2e-ai-server.mjs ${aiPort}`,
      url: `http://localhost:${aiPort}/en`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
  ],
});
