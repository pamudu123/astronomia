import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3100);

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
    { name: "desktop", use: { ...devices["Desktop Chrome"], ...browser } },
    { name: "phone", use: { ...devices["Pixel 7"], ...browser } },
  ],
  webServer: {
    command: `npm run start -- --port ${port}`,
    url: `http://localhost:${port}/en`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
