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
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ඔබේ හඳහන, පැහැදිලිව.");
});

test("the language switch keeps the same page", async ({ page }) => {
  await page.goto("/en/porondam");
  await page.getByRole("group", { name: "Language" }).getByRole("link", { name: "සිංහල" }).click();
  await expect(page).toHaveURL(/\/si\/porondam$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("කේන්දර දෙකක් ගළපන්න");
});

test("the page does not scroll sideways on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/si");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
