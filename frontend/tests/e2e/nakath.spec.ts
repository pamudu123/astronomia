import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type Page, expect, test } from "@playwright/test";

/** The backend is not running in these tests: its answers are saved real responses. */
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf-8");

const ZONES: Record<string, string> = {
  "Asia/Colombo": "colombo",
  "Australia/Melbourne": "melbourne",
  "Europe/London": "london",
};

async function mockBackend(page: Page, lang: "en" | "si") {
  const asked: string[] = [];
  await page.route("**/api/v1/avurudu/*?*", (route) => {
    const url = new URL(route.request().url());
    asked.push(url.search);
    const year = url.pathname.split("/").at(-1);
    const zone = ZONES[url.searchParams.get("timezone") ?? ""] ?? "colombo";
    return route.fulfill({ contentType: "application/json", body: fixture(`avurudu-${year}-${zone}-${lang}.json`) });
  });
  await page.route("**/api/v1/panchanga?*", (route) => {
    const url = new URL(route.request().url());
    asked.push(url.search);
    const where = url.searchParams.get("place_id") === "2643743" ? "london" : "colombo";
    const name = `panchanga-${url.searchParams.get("date")}-${where}-${lang}.json`;
    return route.fulfill({ contentType: "application/json", body: fixture(name) });
  });
  await page.route("**/api/v1/places?*", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture("places-london.json") }),
  );
  return asked;
}

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("a visitor in Melbourne", () => {
  test.use({ timezoneId: "Australia/Melbourne" });

  test("sees the 2027 official nakath in Sri Lanka time and their own", async ({ page }) => {
    const asked = await mockBackend(page, "en");
    await page.goto("/en/avurudu/2027");
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1 })).toHaveText("Avurudu nakath 2027");
    await expect(main.getByText("Official list", { exact: true })).toBeVisible();
    const dawn = main.locator('[data-item="dawn"]');
    await expect(dawn).toContainText("15:29");
    await expect(dawn).toContainText("19:59");
    await expect(dawn).toContainText("Your time (Australia/Melbourne)");
    await expect(main.locator('[data-item="cooking"]')).toContainText("Dress in green and face north.");
    await expect(main.locator("[data-item]")).toHaveCount(10);
    await expect(main.locator('[data-card="compare"]')).toContainText("Same as the official time");
    await expect(main).toContainText("released by the Department of Government Information on 25 August 2026");
    expect(asked.some((query) => query.includes("timezone=Australia%2FMelbourne"))).toBe(true);
    await noSidewaysScroll(page);
  });
});

test("a city page keeps the city's time", async ({ page }) => {
  await mockBackend(page, "en");
  await page.goto("/en/avurudu/2027/london");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Avurudu nakath 2027 in London time");
  await expect(main.locator('[data-item="dawn"]')).toContainText("10:59");
  await expect(main.locator('[data-item="cooking"]')).toContainText("13:48");
  await noSidewaysScroll(page);
});

test("a year without an official list is marked as calculated", async ({ page }) => {
  await mockBackend(page, "si");
  await page.goto("/si/avurudu/2028");
  const main = page.getByRole("main");
  await expect(main.getByText("ගණනය කළ, නිල නොවේ")).toBeVisible();
  await expect(main.locator("[data-item]")).toHaveCount(0);
  await expect(main.locator('[data-card="compare"]')).toContainText("21:44");
  await expect(main.getByRole("heading", { name: "අපේ ගණනය" })).toBeVisible();
  await noSidewaysScroll(page);
});

test("the Avurudu pages carry a title and description as served", async ({ request }) => {
  const city = await (await request.get("/si/avurudu/2027/london")).text();
  expect(city).toContain("<title>ලන්ඩන් වේලාවෙන් 2027 අවුරුදු නැකත් · Astronomia</title>");
  expect(city).toContain('name="description"');
  const year = await (await request.get("/en/avurudu/2027")).text();
  expect(year).toContain("<title>Avurudu nakath 2027: Sinhala and Tamil New Year times · Astronomia</title>");
  expect(year).toContain('<link rel="canonical" href="http://localhost:3000/en/avurudu/2027"/>');
});

test("the list of years leads to a city", async ({ page }) => {
  await mockBackend(page, "en");
  await page.goto("/en/avurudu");
  await expect(page.locator("[data-city]")).toHaveCount(18);
  await page.locator('[data-city="toronto"]').click();
  await expect(page).toHaveURL(/\/en\/avurudu\/2027\/toronto$/);
});

test("a day's nakath, and another place", async ({ page }) => {
  const asked = await mockBackend(page, "en");
  await page.goto("/en/nakath/2027-04-14");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Nakath for 14 April 2027");
  await expect(main.locator('[data-card="rahu"]')).toContainText("12:07 · 13:38");
  await expect(main.locator('[data-part="Thithi"]')).toContainText("Bright 8 (Ashtami)");
  await expect(main.locator('[data-part="Thithi"]')).toContainText("until 15:25");
  await expect(main.locator('[data-card="where"]')).toContainText("Colombo · Wednesday");
  await noSidewaysScroll(page);

  await main.getByRole("combobox").fill("london");
  await page.getByRole("option").first().click();
  await expect(main.locator('[data-card="where"]')).toContainText("Europe/London (UTC+01:00)");
  expect(asked.at(-1)).toContain("place_id=2643743");

  await main.getByRole("link", { name: "Next day" }).click();
  await expect(page).toHaveURL(/\/en\/nakath\/2027-04-15$/);
});

test("the daily page in Sinhala", async ({ page }) => {
  await mockBackend(page, "si");
  await page.goto("/si/nakath/2027-04-14");
  const main = page.getByRole("main");
  await expect(main.locator('[data-card="rahu"]')).toContainText("රාහු කාලය");
  await expect(main.locator('[data-part="තිථිය"]')).toContainText("පුර අටවක");
  await noSidewaysScroll(page);
});

test("an unknown year, city or date is not found", async ({ page }) => {
  for (const path of ["/en/avurudu/1999", "/en/avurudu/2027/atlantis", "/en/nakath/2027-13-40"]) {
    await page.goto(path);
    await expect(page.getByText("This page could not be found.")).toBeVisible();
  }
});

test("a backend that is down or out of date says so, and retrying works (QA AST-02)", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/v1/panchanga?*", (route) => {
    calls += 1;
    if (calls === 1) return route.fulfill({ status: 404, contentType: "application/json", body: '{"detail":"Not Found"}' });
    return route.fulfill({ contentType: "application/json", body: fixture("panchanga-2027-04-14-colombo-en.json") });
  });
  await page.goto("/en/nakath/2027-04-14");
  await expect(page.getByText("The service is not answering right now")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator('[data-card="rahu"]')).toBeVisible();
});
