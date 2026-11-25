import { expect, test } from "@playwright/test";

test("the root sends visitors to the English home page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
});

test("the root sends Sinhala readers to the Sinhala home page", async ({ browser }) => {
  const context = await browser.newContext({ locale: "si-LK" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page).toHaveURL(/\/si$/);
  await context.close();
});

test("English home page shows the headline and both tools", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your birth chart, read with clarity.",
  );
  await expect(page.getByRole("heading", { name: "Hadahan, your birth chart" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Porondam, marriage matching" })).toBeVisible();
  await expect(page.locator("main li img")).toHaveCount(12);
});

test("the home page groups the everyday tools", async ({ page }) => {
  await page.goto("/en");
  const more = page.locator("#more");
  for (const name of ["Good times", "Family", "The year ahead", "Old horoscopes"]) {
    await expect(more.getByRole("heading", { name })).toBeVisible();
  }
  await expect(more.locator('[data-card="today"]')).toHaveAttribute("href", "/en/nakath");
  await more.getByRole("link", { name: /Find the birth from an old horoscope/ }).click();
  await expect(page).toHaveURL(/\/en\/kendara$/);
});

test("the More tab on a phone leads to the tools and is lit on their pages", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/en/nakath");
  const more = page.getByRole("link", { name: "More" });
  await expect(more).toHaveAttribute("aria-current", "page");
  await more.click();
  await expect(page).toHaveURL(/\/en\/tools$/);
});

test("Sinhala home page shows the Sinhala headline", async ({ page }) => {
  await page.goto("/si");
  await expect(page.locator("html")).toHaveAttribute("lang", "si");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ඔබේ හඳහන තේරුම් ගන්න.");
});

test("the language switch keeps the same page", async ({ page }) => {
  await page.goto("/en/porondam");
  await page.getByRole("group", { name: "Language" }).getByRole("link", { name: "සිංහල" }).click();
  await expect(page).toHaveURL(/\/si\/porondam$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("කේන්දර දෙකක් ගළපන්න");
});

test("the language switch keeps the query and hash", async ({ page }) => {
  const language = page.getByRole("group", { name: "Language" });
  const tail = "?bride=anuradha.2&groom=rohini.1";
  await page.goto(`/en/porondam${tail}`);
  await expect(language.getByRole("link", { name: "සිංහල" })).toHaveAttribute("href", `/si/porondam${tail}`);
  await language.getByRole("link", { name: "සිංහල" }).click();
  await expect(page).toHaveURL(`/si/porondam${tail}`);
  await expect(page.locator("html")).toHaveAttribute("lang", "si");
  await page.goto("/en/tools#marriage");
  await language.getByRole("link", { name: "සිංහල" }).click();
  await expect(page).toHaveURL("/si/tools#marriage");
});

test("the language switch sees a query added without a page load", async ({ page }) => {
  const sinhala = page.getByRole("group", { name: "Language" }).getByRole("link", { name: "සිංහල" });
  // The built link has no query: it gets this one only once the page's scripts run. Clicking
  // before that is a plain link, which can't know of a query added later.
  await page.goto("/en/porondam?for=match");
  await expect(sinhala).toHaveAttribute("href", "/si/porondam?for=match");
  await page.evaluate(() => window.history.replaceState(null, "", "?for=wedding"));
  await sinhala.click();
  await expect(page).toHaveURL("/si/porondam?for=wedding");
});

test("the root opens in the language last chosen", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("group", { name: "Language" }).getByRole("link", { name: "සිංහල" }).click();
  await expect(page).toHaveURL(/\/si$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/si$/);
  await page.goto("/porondam?for=wedding");
  await expect(page).toHaveURL(/\/si\/porondam\?for=wedding$/);
  await page.goto("/si");
  await page.getByRole("group", { name: "භාෂාව" }).getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
});

test("the browser icons are there", async ({ page, request }) => {
  const favicon = await request.get("/favicon.ico");
  expect(favicon.status()).toBe(200);
  expect(favicon.headers()["content-type"]).toContain("icon");
  await page.goto("/en");
  const apple = await page.locator('link[rel="apple-touch-icon"]').first().getAttribute("href");
  expect((await request.get(apple ?? "")).status()).toBe(200);
});

test("the page does not scroll sideways on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/si");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
