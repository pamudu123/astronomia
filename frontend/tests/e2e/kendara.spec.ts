import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type Page, expect, test } from "@playwright/test";

/** The backend is not running in these tests: its answers are saved real responses. */
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf-8");

// Nimali's chart: lagna Simha, and each planet's house counted from it.
const HOUSES: Record<string, number> = { sun: 9, moon: 4, mars: 12, mercury: 9, jupiter: 4, venus: 8, saturn: 7, rahu: 3, ketu: 9 };

// Where to tap inside each corner triangle: its centre, as a share of the corner square.
const AT: Record<number, [number, number]> = {
  2: [0.68, 0.3], 3: [0.3, 0.68], 5: [0.3, 0.32], 6: [0.68, 0.7],
  8: [0.32, 0.7], 9: [0.7, 0.32], 11: [0.7, 0.68], 12: [0.32, 0.3],
};

async function tapHouse(page: Page, drawing: string, house: number) {
  const box = page.locator(`[data-drawing="${drawing}"] [data-house="${house}"]`);
  const size = await box.boundingBox();
  const [fx, fy] = AT[house] ?? [0.5, 0.5];
  await box.click({ position: { x: size!.width * fx, y: size!.height * fy } });
}

async function mockBackend(page: Page, lang: "en" | "si", answer: string) {
  await page.route("**/api/v1/labels/*", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture(`labels-${lang}.json`) }),
  );
  const sent: string[] = [];
  await page.route("**/api/v1/kendara/search", (route) => {
    sent.push(route.request().postData() ?? "");
    return route.fulfill({ contentType: "application/json", body: fixture(answer) });
  });
  return sent;
}

async function drawNimali(page: Page, lang: "en" | "si") {
  await page.goto(`/${lang}/kendara`);
  await expect(page.locator('[data-drawing="rashi"] [data-house="1"]')).toBeVisible();
  await page.locator("#rashi-lagna").selectOption("simha");
  for (const body of Object.keys(HOUSES)) await tapHouse(page, "rashi", HOUSES[body]);
}

test("draw a kendara and see the births that fit it", async ({ page }) => {
  const sent = await mockBackend(page, "en", "kendara-en.json");
  await drawNimali(page, "en");
  await expect(page.getByText("9 of 9 planets placed")).toBeVisible();
  await expect(page.locator('[data-drawing="rashi"] [data-placed="venus"]')).toBeVisible();

  await page.getByLabel("Born from year").fill("1990");
  await page.getByLabel("Birth star, if written").selectOption("jyeshtha");
  await page.getByRole("button", { name: "Find the births" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("3 possible births");
  await expect(page.locator("[data-match]")).toHaveCount(3);
  await expect(page.locator('[data-match="exact"]').last()).toContainText("19 April 1995");
  await expect(page.locator('[data-match="near"]')).toContainText("only fit near the edge");

  // The drawing goes in the body of the request, never in the address.
  const body = JSON.parse(sent[0]);
  expect(body.rashi).toEqual({ lagna: "simha", houses: HOUSES });
  expect(body).toMatchObject({ year_from: 1990, nakshatra: "jyeshtha", lang: "en" });
  expect(page.url()).not.toContain("simha");

  await page.getByRole("button", { name: "Change the drawing" }).click();
  await expect(page.getByText("9 of 9 planets placed")).toBeVisible();
});

test("a planet can be moved, and the navamsha added", async ({ page }) => {
  const sent = await mockBackend(page, "en", "kendara-en.json");
  await drawNimali(page, "en");
  // Venus was put in house 8. Pick it up and put it in house 7, then back in house 8.
  const venus = page.locator('[data-drawing="rashi"]').getByRole("button", { name: /^Venus/ });
  await venus.click();
  await tapHouse(page, "rashi", 7);
  await expect(venus).toHaveAccessibleName(/7/);
  await venus.click();
  await tapHouse(page, "rashi", 8);
  await expect(venus).toHaveAccessibleName(/8/);

  await page.getByRole("button", { name: "Add the navamsha kendara" }).click();
  await page.getByRole("button", { name: "Find the births" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "navamsha lagna" })).toBeVisible();
  await page.locator("#navamsha-lagna").selectOption("mesha");
  await tapHouse(page, "navamsha", 5);
  await page.getByRole("button", { name: "Find the births" }).click();
  await expect(page.locator("[data-match]")).toHaveCount(3);
  const body = JSON.parse(sent[0]);
  expect(body.rashi.houses.venus).toBe(8);
  expect(body.navamsha).toEqual({ lagna: "mesha", houses: { sun: 5 } });
});

test("a drawing the sky cannot show says why", async ({ page }) => {
  await mockBackend(page, "en", "kendara-impossible-en.json");
  await drawNimali(page, "en");
  await page.getByRole("button", { name: "Find the births" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This drawing cannot happen");
  await expect(page.getByRole("alert").filter({ hasText: "Rahu and Ketu" })).toBeVisible();
});

test("the old horoscope search in Sinhala", async ({ page }) => {
  await mockBackend(page, "si", "kendara-si.json");
  await drawNimali(page, "si");
  await page.getByRole("button", { name: "උපන් කාල සොයන්න" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("හැකි උපන් කාල 3 ක්");
  await expect(page.locator('[data-match="exact"]').last()).toContainText("1995 අප්‍රේල් 19");
});

test("the hadahan and porondam forms link to it", async ({ page }) => {
  await page.route("**/api/v1/labels/*", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture("labels-en.json") }),
  );
  await page.goto("/en/porondam");
  await expect(page.getByRole("link", { name: "Find the birth from the kendara" })).toHaveAttribute("href", "/en/kendara");
});
