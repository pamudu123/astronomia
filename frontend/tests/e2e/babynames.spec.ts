import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type Page, expect, test } from "@playwright/test";

/** The backend is not running in these tests: its answers are saved real responses. */
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf-8");

async function mockBackend(page: Page, lang: "en" | "si", birth = "baby-birth") {
  await page.route("**/api/v1/baby/letters/*?*", (route) => {
    const star = new URL(route.request().url()).pathname.split("/").at(-1);
    return route.fulfill({ contentType: "application/json", body: fixture(`baby-letters-${star}-${lang}.json`) });
  });
  const posted: string[] = [];
  await page.route("**/api/v1/baby/letters", (route) => {
    posted.push(route.request().postData() ?? "");
    return route.fulfill({ contentType: "application/json", body: fixture(`${birth}-${lang}.json`) });
  });
  await page.route("**/api/v1/places?*", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture("places-kandy.json") }),
  );
  await page.route("**/api/v1/time/resolve", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture("time-kandy.json") }),
  );
  return posted;
}

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function enterBirth(page: Page, date: string, time: string, submit: string) {
  const form = page.locator('[data-card="baby-form"]');
  await form.getByRole("textbox", { name: /^(Date of birth|උපන් දිනය)$/ }).fill(date);
  await form.getByRole("textbox", { name: /^(Time of birth|උපන් වේලාව)$/ }).fill(time);
  await page.getByRole("combobox").fill("kandy");
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: submit }).click();
}

test("the letters for a birth come from a POST, never the page address", async ({ page }) => {
  const posted = await mockBackend(page, "en");
  await page.goto("/en/baby-names");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Baby name letters from the birth star");
  await expect(main.locator("ol li a")).toHaveCount(27);
  await noSidewaysScroll(page);

  await enterBirth(page, "1995-04-19", "14:35", "Find the letters");
  const result = page.locator('[data-card="baby-result"]');
  await expect(result.locator("[data-letter]")).toContainText("යු");
  await expect(result.locator("[data-letter]")).toContainText("Yu");
  await expect(result).toContainText("Jyeshtha");
  await expect(result).toContainText("Vrischika");
  await expect(result).toContainText("Simha");
  await expect(result).toContainText("Birth time in Asia/Colombo (UTC+05:30)");
  await expect(result).toContainText("Born after sunrise, so the day is Wednesday.");
  await expect(result.locator('[data-card="time-check"]')).toContainText("stay the same");
  await expect(result.locator("[data-pada]")).toHaveCount(4);
  await expect(result.locator('[data-pada="4"]')).toContainText("This birth");
  await expect(result).toContainText("Simha lagna");
  expect(JSON.parse(posted[0])).toMatchObject({ date: "1995-04-19", time: "14:35", lang: "en" });
  expect(page.url()).not.toContain("1995");
  await noSidewaysScroll(page);

  await result.getByRole("link", { name: "Jyeshtha: baby name letters" }).click();
  await expect(page).toHaveURL(/\/en\/baby-names\/jyeshtha$/);
  await expect(page.getByRole("main").locator('[data-pada="4"]')).toContainText("යු");
});

test("a birth near a pada change shows the letter next to it", async ({ page }) => {
  await mockBackend(page, "si", "baby-birth-near");
  await page.goto("/si/baby-names");
  await enterBirth(page, "2024-01-18", "15:10", "අකුරු සොයන්න");
  const result = page.locator('[data-card="baby-result"]');
  await expect(result.locator("[data-letter]")).toContainText("චෙ");
  const check = result.locator('[data-card="time-check"]');
  await expect(check).toContainText("මිනිත්තු 3කට පසු සඳු අස්විද නැකතේ 3 වන පාදයට යයි. එයින් ලැබෙන අකුර චො වේ.");
  await expect(check).toContainText("අසල පාදයේ අකුරද බලන්න");
  await noSidewaysScroll(page);
});

test("a star page shows its four padas", async ({ page }) => {
  await mockBackend(page, "en");
  await page.goto("/en/baby-names/ardra");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Ardra: baby name letters");
  const padas = main.locator("[data-pada]");
  await expect(padas).toHaveCount(4);
  await expect(padas.nth(0)).toContainText("කු");
  await expect(padas.nth(0)).toContainText("Mithuna 6°40′ to 10°00′");
  await expect(padas.nth(3)).toContainText("Chha");
  await expect(padas.nth(3)).toContainText("Other sources give: ච ජ");
  await expect(main.getByText(/provisional until a practising astrologer/)).toBeVisible();
  await noSidewaysScroll(page);
});

test("a star across two signs, in Sinhala", async ({ page }) => {
  await mockBackend(page, "si");
  await page.goto("/si/baby-names/krittika");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("කැති: නමේ මුල් අකුරු");
  await expect(main.locator('[data-pada="1"]')).toContainText("මේෂ");
  await expect(main.locator('[data-pada="2"]')).toContainText("වෘෂභ");
  await noSidewaysScroll(page);
});

test("the star pages are rendered on the server for search engines", async ({ request }) => {
  const html = await (await request.get("/si/baby-names/ardra")).text();
  expect(html).toContain("<title>අද නැකතට නමේ අකුරු: කු ඝ ඞ ඡ · Astronomia</title>");
  expect(html).toContain('name="description"');
  expect(html).toContain('<link rel="canonical" href="http://localhost:3000/si/baby-names/ardra"/>');
  const index = await (await request.get("/en/baby-names")).text();
  expect(index).toContain("<title>Baby name letters by birth star (nakatha) · Astronomia</title>");
  expect(index).toContain("චු චෙ චො ල");
});

test("an unknown star is not found", async ({ page }) => {
  await page.goto("/en/baby-names/pluto");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});
