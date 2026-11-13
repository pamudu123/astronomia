import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type Page, expect, test } from "@playwright/test";

/** The backend is not running in these tests: its answers are saved real responses. */
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf-8");

const NAMES = JSON.parse(fixture("baby-names.json")) as Record<string, unknown>;

async function mockBackend(page: Page, lang: "en" | "si", birth = "baby-birth") {
  const nameQueries: string[] = [];
  await page.route("**/api/v1/baby/names?*", (route) => {
    const url = new URL(route.request().url());
    const key = [
      url.searchParams.getAll("letters").join(","),
      url.searchParams.get("gender") ?? "any",
      url.searchParams.get("length") ?? "any",
      url.searchParams.get("lang"),
    ].join("|");
    nameQueries.push(key);
    const body = NAMES[key];
    return body
      ? route.fulfill({ contentType: "application/json", body: JSON.stringify(body) })
      : route.fulfill({ status: 500, body: `no fixture for ${key}` });
  });
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
  return Object.assign(posted, { nameQueries });
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

test("names for a star, filtered by letter, gender and length", async ({ page }) => {
  const asked = await mockBackend(page, "en");
  await page.goto("/en/baby-names/krittika");
  const names = page.locator('[data-card="names"]');
  await expect(names.getByRole("heading", { name: "Names for these letters" })).toBeVisible();
  await expect(names.locator("[data-name]")).toHaveCount(26);
  await expect(names.locator('[data-name="Ajith"]')).toContainText("අජිත්");
  await expect(names.locator('[data-name="Ajith"]')).toContainText("Unconquered");
  await expect(names.locator('[data-name="Ajith"]').getByRole("link")).toHaveAttribute(
    "href",
    "https://en.wikipedia.org/wiki/Ajit_(given_name)",
  );
  await noSidewaysScroll(page);

  await names.getByRole("button", { name: "Girl", exact: true }).click();
  await expect(names.locator("[data-name]")).toHaveCount(7);
  await expect(names).toContainText("7 names");
  await names.getByRole("button", { name: "Boy", exact: true }).click();
  await names.getByRole("button", { name: "Short (1 or 2 syllables)" }).click();
  await expect(names.locator("[data-name]")).toHaveCount(3);
  await names.getByRole("button", { name: "All", exact: true }).click();
  await names.getByRole("button", { name: "Any", exact: true }).click();
  await names.locator('[data-letter-chip="අ"]').click();
  await expect(names.locator('[data-letter-chip="අ"]')).toHaveAttribute("aria-pressed", "false");
  await expect(names.locator("[data-name]")).toHaveCount(8);
  expect(asked.nameQueries).toContain("ඉ,උ,එ|any|any|en");
  await noSidewaysScroll(page);
});

test("the names for a birth start with its letter, and other letters can be added", async ({ page }) => {
  await mockBackend(page, "en");
  await page.goto("/en/baby-names");
  await enterBirth(page, "1995-04-19", "14:35", "Find the letters");
  const names = page.locator('[data-card="names"]');
  await expect(names.locator('[data-letter-chip="යු"]')).toHaveAttribute("aria-pressed", "true");
  await expect(names).toContainText("No names in our list start with these letters yet.");
  await names.locator('[data-letter-chip="ය"]').click();
  await expect(names.locator("[data-name]")).toHaveCount(3);
  await expect(names.locator('[data-name="Yamuna"]')).toContainText("Girl");
  await noSidewaysScroll(page);
});

test("names in Sinhala", async ({ page }) => {
  await mockBackend(page, "si");
  await page.goto("/si/baby-names/ardra");
  const names = page.locator('[data-card="names"]');
  await expect(names.getByRole("heading", { name: "මෙම අකුරුවලින් ඇරඹෙන නම්" })).toBeVisible();
  await expect(names.locator("[data-name]")).toHaveCount(5);
  await expect(names.locator('[data-name="Kusal"]')).toContainText("කුසලය, පින");
  await expect(names.locator('[data-name="Kusal"]')).toContainText("Merit, wholesome deeds");
  await noSidewaysScroll(page);
});
