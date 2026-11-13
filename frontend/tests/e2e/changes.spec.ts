import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type Page, expect, test } from "@playwright/test";

/** The backend is not running in these tests: its answers are saved real responses. */
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf-8");

const CHANGE = "rahu-ketu-2026-12";

async function mockBackend(page: Page, lang: "en" | "si") {
  // Only Makara is saved. The other lagnas are covered by the backend tests.
  await page.route(`**/api/v1/changes/${CHANGE}/makara?*`, (route) =>
    route.fulfill({ contentType: "application/json", body: fixture(`changes-${CHANGE}-makara-${lang}.json`) }),
  );
  const personal: string[] = [];
  await page.route(`**/api/v1/changes/${CHANGE}/personal`, (route) => {
    personal.push(route.request().postData() ?? "");
    return route.fulfill({ contentType: "application/json", body: fixture(`changes-${CHANGE}-personal-${lang}.json`) });
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

test("the list leads to the change and then to one lagna", async ({ page }) => {
  await mockBackend(page, "en");
  await page.goto("/en/changes");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Planet changes");
  await expect(page.locator("[data-change]")).toHaveCount(6);
  await expect(page.locator('[data-change="saturn-2027-06"]')).toContainText("Page coming soon");
  await noSidewaysScroll(page);

  await page.getByRole("link", { name: "Rahu and Ketu change 2026" }).click();
  await expect(page).toHaveTitle("Rahu and Ketu change 2026: what it means for each lagna · Astronomia");
  // Scoped to the summary: the list page may stay in the document, hidden, after navigating.
  const summary = page.getByRole("region", { name: "5 December 2026, 22:32 Sri Lanka time" });
  await expect(summary).toBeVisible();
  await expect(summary).toContainText("Rahu moves from Kumbha into Makara.");
  await expect(page.locator("[data-lagna]")).toHaveCount(12);
  await expect(page.locator('[data-lagna="simha"]')).toContainText("Rahu: 7th house to 6th house");
  await noSidewaysScroll(page);

  await page.locator('[data-lagna="makara"]').click();
  await expect(page).toHaveURL(/\/en\/changes\/rahu-ketu-2026-12\/makara$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Rahu and Ketu change 2026 for Makara lagna");
  await expect(page).toHaveTitle("Rahu and Ketu change 2026 for Makara lagna · Astronomia");
  const rahu = page.locator('[data-counted="lagna"] [data-planet="rahu"]');
  await expect(rahu).toContainText("2nd house to 1st house");
  await expect(rahu).toContainText("The 1st house is about yourself and how you begin things.");
  await expect(page.locator('[data-counted="lagna"]')).toContainText("Saturn stays in Meena, your 3rd house.");
  // Earlier pages may stay in the document, hidden; the main landmark is the visible one.
  const main = page.getByRole("main");
  await expect(main.getByText(/provisional until a practising astrologer/)).toBeVisible();
  await expect(main.locator('[data-lagna="makara"]')).toHaveAttribute("aria-current", "page");
  await noSidewaysScroll(page);
});

test("the general pages are rendered on the server for search engines", async ({ request }) => {
  const hub = await (await request.get(`/si/changes/${CHANGE}`)).text();
  expect(hub).toContain("<title>2026 රාහු කේතු මාරුව: එක් එක් ලග්නයට පලාපල · Astronomia</title>");
  expect(hub).toContain('name="description"');
  expect(hub).toContain("කුම්භ රාශියේ සිට මකර රාශියට මාරු වේ");
  expect(hub).toContain('hrefLang="en"');

  const lagna = await (await request.get(`/en/changes/${CHANGE}/makara`)).text();
  expect(lagna).toContain("<title>Rahu and Ketu change 2026 for Makara lagna · Astronomia</title>");
  expect(lagna).toContain(
    '<meta name="description" content="5 December 2026: Rahu moves from Kumbha into Makara. Ketu moves from Simha into Kataka. What it means for Makara lagna, house by house."/>',
  );
  expect(lagna).toContain(`<link rel="canonical" href="http://localhost:3000/en/changes/${CHANGE}/makara"/>`);
});

test("a lagna page in Sinhala", async ({ page }) => {
  await mockBackend(page, "si");
  await page.goto(`/si/changes/${CHANGE}/makara`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("මකර ලග්නයට 2026 රාහු කේතු මාරුව");
  await expect(page.getByRole("region", { name: "2026 දෙසැම්බර් 5, ශ්‍රී ලංකා වේලාවෙන් 22:32" })).toBeVisible();
  await expect(page.locator('[data-counted="lagna"] [data-planet="rahu"]')).toContainText(
    "2 වැනි භාවයේ සිට 1 වැනි භාවයට",
  );
  await noSidewaysScroll(page);
});

test("your own version comes from a POST, never the page address", async ({ page }) => {
  const personal = await mockBackend(page, "en");
  await page.goto(`/en/changes/${CHANGE}/makara`);
  const panel = page.locator('[data-card="personal"]');
  await panel.getByRole("button", { name: "Enter birth details" }).click();
  await page.getByLabel("Date of birth").fill("1995-04-19");
  await page.getByLabel("Time of birth").fill("14:35");
  await page.getByRole("combobox").fill("kandy");
  await page.getByRole("option").first().click();
  await panel.getByRole("button", { name: "Show my version" }).click();

  await expect(panel).toContainText("Your lagna: Simha");
  await expect(panel).toContainText("Your Moon sign: Vrischika");
  await expect(panel.locator('[data-counted="personal-lagna"] [data-planet="rahu"]')).toContainText(
    "7th house to 6th house",
  );
  await expect(panel.locator('[data-counted="personal-moon"] [data-planet="rahu"]')).toContainText(
    "4th house to 3rd house",
  );
  await expect(panel.getByRole("link", { name: "Open the Simha lagna page" })).toBeVisible();
  expect(JSON.parse(personal[0])).toMatchObject({ date: "1995-04-19", time: "14:35", lang: "en" });
  expect(page.url()).not.toContain("1995");
  await noSidewaysScroll(page);
});

test("the houses still load when the server could not fetch them", async ({ page }) => {
  // The backend is away during the server render here, so the browser asks for them.
  await mockBackend(page, "en");
  await page.goto(`/en/changes/${CHANGE}/makara`);
  await expect(page.locator('[data-counted="lagna"]')).toBeVisible();
});

test("an unknown change or lagna is not found", async ({ page }) => {
  await page.goto("/en/changes/saturn-2027-06");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await page.goto(`/en/changes/${CHANGE}/leo`);
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});

test("the home page points to the Rahu and Ketu change", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("link", { name: /Rahu and Ketu change on 5 December 2026/ }).click();
  await expect(page).toHaveURL(/\/en\/changes\/rahu-ketu-2026-12$/);
});
