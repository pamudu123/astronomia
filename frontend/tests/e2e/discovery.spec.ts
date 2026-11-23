import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type Page, expect, test } from "@playwright/test";

/** The backend is not running in these tests: its answers are saved real responses. */
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf-8");

async function mockHadahan(page: Page) {
  const json = (name: string) => (route: { fulfill: (r: object) => Promise<void> }) =>
    route.fulfill({ contentType: "application/json", body: fixture(name) });
  await page.route("**/api/v1/labels/*", json("labels-en.json"));
  await page.route("**/api/v1/places?*", json("places-kandy.json"));
  await page.route("**/api/v1/time/resolve", json("time-kandy.json"));
  await page.route("**/api/v1/forecast", json("forecast-en.json"));
  await page.route("**/api/v1/changes/personal", json("changes-personal-en.json"));
  await page.route("**/api/v1/hadahan", json("hadahan-en.json"));
}

async function makeHadahan(page: Page) {
  await mockHadahan(page);
  await page.goto("/en/hadahan");
  await page.getByLabel(/Name/).fill("Nimali");
  await page.getByLabel("Date of birth").fill("1995-04-19");
  await page.getByLabel("Time of birth").fill("14:35");
  await page.getByRole("combobox").fill("kandy");
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Show my hadahan" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nimali's birth chart");
}

test("All tools lists every tool by occasion, with what each needs", async ({ page }) => {
  await page.goto("/en/tools");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("All tools");
  for (const name of ["Your chart", "Marriage", "New baby", "Every day", "New year", "Old records"]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
  await expect(page.locator("[data-tool]")).toHaveCount(13);
  await expect(page.locator('[data-tool="porondam"]')).toContainText("Two people's birth details");
  await page.getByRole("navigation", { name: "What are you planning?" }).getByRole("link", { name: "New baby" }).click();
  await expect(page).toHaveURL(/\/en\/tools#baby$/);
  await page.locator('[data-tool="litha"]').click();
  await expect(page).toHaveURL(/\/en\/litha$/);
});

test("the header and footer lead to All tools and the litha", async ({ page }) => {
  await page.goto("/en");
  // The header link is hidden on phones, where the More tab leads to the same page.
  await expect(page.locator('header a[href="/en/tools"]').first()).toBeAttached();
  await expect(page.locator("footer").getByRole("link", { name: "Litha calendar" })).toHaveAttribute("href", "/en/litha");
  await page.locator("footer").getByRole("link", { name: "All tools" }).click();
  await expect(page).toHaveURL(/\/en\/tools$/);
});

for (const [lang, name] of [
  ["en", "Why Sidera"],
  ["si", "Sidera තෝරාගන්නේ ඇයි?"],
] as const) {
  test(`Why Sidera can be reached without the header, from All tools and the footer, in ${lang} (NAV-1)`, async ({ page }) => {
    await page.goto(`/${lang}/tools`);
    await page.locator('[data-about="why-sidera"]').click();
    await expect(page).toHaveURL(new RegExp(`/${lang}/why-sidera$`));
    await page.goto(`/${lang}`);
    await expect(page.locator("footer").getByRole("link", { name })).toHaveAttribute("href", `/${lang}/why-sidera`);
  });
}

test("on a phone, More leads to Why Sidera and is lit on it (NAV-1)", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the tab bar is for phones");
  await page.goto("/en");
  const more = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "More", exact: true });
  await more.click();
  await page.locator('[data-about="why-sidera"]').click();
  await expect(page).toHaveURL(/\/en\/why-sidera$/);
  await expect(more).toHaveAttribute("aria-current", "page");
});

/** The December 2026 litha's days, as another month. */
function lithaAs(year: number, month: number) {
  const data = JSON.parse(fixture("litha-2026-12-colombo-en.json"));
  const days = data.days.map((day: { date: string }) => ({
    ...day,
    date: `${year}-${String(month).padStart(2, "0")}-${day.date.slice(8)}`,
  }));
  return { ...data, year, month, days };
}

/** Answers for this month, whatever it is when the test runs, and for December 2090. */
async function mockLitha(page: Page) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(new Date());
  await page.route("**/api/v1/panchanga/month?*", (route) => {
    const asked = new URL(route.request().url()).searchParams;
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(lithaAs(Number(asked.get("year")), Number(asked.get("month")))),
    });
  });
  return today;
}

test("the litha on a wide screen shows the whole month, with no button for today", async ({ page, isMobile }) => {
  test.skip(isMobile, "phones have the list");
  await mockLitha(page);
  await page.goto("/en/litha");
  await expect(page.locator("#today")).toBeVisible();
  await expect(page.locator("[data-to-today]")).toBeHidden();
});

test("the litha on a phone goes straight to today, also from another month (NAV-3)", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the list is for phones");
  const today = await mockLitha(page);
  await page.goto("/en/litha");
  await page.locator("[data-to-today]").click();
  const card = page.locator("#today");
  await expect(card).toBeInViewport();
  await expect(card).toBeFocused();
  await expect(card).toHaveAttribute("data-day", today);

  await page.goto("/en/litha/2090-12");
  await expect(page.locator("[data-day]")).toHaveCount(31);
  await page.locator("[data-to-today]").click();
  await expect(page).toHaveURL(/\/en\/litha#today$/);
  await expect(card).toBeInViewport();
  await expect(card).toBeFocused();
});

test("a litha month has its title, the months either side, and a calendar or a clear message", async ({ page }) => {
  await page.goto("/si/litha/2026-12");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("2026 දෙසැම්බර් ලිත");
  await page.goto("/en/litha/2026-12");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("December 2026 litha calendar");
  await expect(page.getByRole("link", { name: /Previous month/ })).toHaveAttribute("href", "/en/litha/2026-11");
  await expect(page.getByRole("link", { name: /Next month/ })).toHaveAttribute("href", "/en/litha/2027-01");
  // With the backend away the page says so after the browser's own try; with it, there are 31 days.
  const days = page.locator("[data-day]");
  await expect(days.first().or(page.getByText("could not be loaded"))).toBeVisible({ timeout: 30_000 });
  if ((await days.count()) > 0) await expect(days).toHaveCount(31);
  else await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("a litha month the server could not load is fetched by the browser, and Try again recovers in place", async ({
  page,
}) => {
  // QA APP-01: the server gives up after a few seconds, a waking backend takes longer, and
  // "Try again" used to reload into the same short server try.
  let calls = 0;
  await page.route("**/api/v1/panchanga/month?*", (route) => {
    calls += 1;
    if (calls === 1) return route.fulfill({ status: 503, body: "waking up" });
    return route.fulfill({ contentType: "application/json", body: fixture("litha-2026-12-colombo-en.json") });
  });
  await page.goto("/en/litha/2026-12");
  await expect(page.getByRole("status")).toContainText("could not be loaded");
  const url = page.url();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator("[data-day]")).toHaveCount(31);
  await expect(page.locator('[data-day="2026-12-01"]')).toBeVisible();
  // Recovered without a page load.
  expect(page.url()).toBe(url);
  expect(calls).toBe(2);
});

test("a month that does not exist is not found", async ({ page }) => {
  await page.goto("/en/litha/2026-13");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});

test("after a hadahan come next steps, and the chart is remembered only when asked", async ({ page }) => {
  await makeHadahan(page);
  const next = page.locator('[data-card="next"]');
  await expect(next.getByRole("heading", { name: "Next steps" })).toBeVisible();
  await expect(next.locator('[data-step="baby-names"]')).toHaveAttribute("href", "/en/baby-names");

  const key = "astronomia.hadahan.device";
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBeNull();
  await page.getByLabel("Remember my chart on this device").check();
  await expect(page.getByText("Remembered on this device.")).toBeVisible();
  const kept = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), key)) ?? "null");
  expect(kept.name).toBe("Nimali");

  // The home page greets the visitor with their own sky, and can forget it.
  await page.goto("/en");
  const sky = page.locator('[data-card="your-sky"]');
  await expect(sky.getByRole("heading", { name: "Welcome back, Nimali" })).toBeVisible();
  await expect(sky).toContainText("Simha lagna");
  await expect(sky.locator('[data-link="forecast"]')).toHaveAttribute("href", "/en/forecast/2027/simha");
  await sky.getByRole("button", { name: "Forget this chart" }).click();
  await expect(sky).toHaveCount(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBeNull();
});

test("without a remembered chart the home page shows no welcome", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: "Everyday tools" })).toBeVisible();
  await expect(page.locator('[data-card="your-sky"]')).toHaveCount(0);
});
