import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type Page, expect, test } from "@playwright/test";

/** The backend is not running in these tests: its answers are saved real responses. */
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf-8");

async function mockBackend(page: Page, lang: "en" | "si") {
  await page.route("**/api/v1/yearly/2027/makara?*", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture(`yearly-2027-makara-${lang}.json`) }),
  );
  const personal: string[] = [];
  await page.route("**/api/v1/yearly/2027/personal", (route) => {
    personal.push(route.request().postData() ?? "");
    return route.fulfill({ contentType: "application/json", body: fixture(`yearly-2027-personal-${lang}.json`) });
  });
  await page.route("**/api/v1/places?*", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture("places-kandy.json") }),
  );
  await page.route("**/api/v1/time/resolve", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture("time-kandy.json") }),
  );
  return personal;
}

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("the year list leads to one lagna's year", async ({ page }) => {
  await mockBackend(page, "en");
  await page.goto("/en/forecast/2027");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("2027 forecast by lagna");
  await expect(page.locator("[data-lagna]")).toHaveCount(12);
  await noSidewaysScroll(page);

  await page.locator('[data-lagna="makara"]').click();
  await expect(page).toHaveURL(/\/en\/forecast\/2027\/makara$/);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("2027 forecast for Makara lagna");
  const saturn = main.locator('[data-year="lagna"] [data-planet="saturn"]');
  await expect(saturn).toContainText("Saturn is in Mesha, your 4th house, from 3 June 2027 to 20 October 2027.");
  await expect(main.locator('[data-year="lagna"] [data-planet="rahu"]')).toContainText(
    "Rahu is in Makara, your 1st house, all year.",
  );
  await expect(main.getByRole("table")).toContainText("June");
  await expect(main.locator('[data-year="lagna"] [data-change]')).toHaveCount(5);
  await expect(main.getByText(/provisional until a practising astrologer/)).toBeVisible();
  await noSidewaysScroll(page);

  await main
    .locator('[data-change="saturn-2027-06"]')
    .getByRole("link", { name: "Read about this change" })
    .click();
  await expect(page).toHaveURL(/\/en\/changes\/saturn-2027-06\/makara$/);
});

test("the year pages are rendered on the server for search engines", async ({ request }) => {
  const html = await (await request.get("/si/forecast/2027/makara")).text();
  expect(html).toContain("<title>මකර ලග්නයට 2027 පලාපල · Astronomia</title>");
  expect(html).toContain('name="description"');
  expect(html).toContain('<link rel="canonical" href="http://localhost:3000/si/forecast/2027/makara"/>');
});

test("a year page in Sinhala", async ({ page }) => {
  await mockBackend(page, "si");
  await page.goto("/si/forecast/2027/makara");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("මකර ලග්නයට 2027 පලාපල");
  await expect(page.locator('[data-year="lagna"] [data-planet="rahu"]')).toContainText(
    "රාහු වසර පුරා මකර රාශියේ, ඔබේ 1 වැනි භාවයේ සිටී.",
  );
  await noSidewaysScroll(page);
});

test("your own year comes from a POST, never the page address", async ({ page }) => {
  const personal = await mockBackend(page, "en");
  await page.goto("/en/forecast/2027/makara");
  const panel = page.locator('[data-card="personal-year"]');
  await panel.getByRole("button", { name: "Enter birth details" }).click();
  await page.getByLabel("Date of birth").fill("1995-04-19");
  await page.getByLabel("Time of birth").fill("14:35");
  await page.getByRole("combobox").fill("kandy");
  await page.getByRole("option").first().click();
  await panel.getByRole("button", { name: "Show my year" }).click();

  await expect(panel).toContainText("Your lagna: Simha");
  await expect(panel).toContainText("Your Moon sign: Vrischika");
  await expect(panel.locator('[data-year="personal-lagna"] [data-planet="rahu"]')).toContainText("your 6th house");
  await expect(panel.locator('[data-year="personal-moon"] [data-planet="rahu"]')).toContainText("your 3rd house");
  expect(JSON.parse(personal[0])).toMatchObject({ date: "1995-04-19", time: "14:35", lang: "en" });
  expect(page.url()).not.toContain("1995");
  await noSidewaysScroll(page);
});

test("an unknown year or lagna is not found", async ({ page }) => {
  await page.goto("/en/forecast/2026");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await page.goto("/en/forecast/2027/leo");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});
