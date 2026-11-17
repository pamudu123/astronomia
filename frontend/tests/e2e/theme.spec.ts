import { expect, test } from "@playwright/test";

const IVORY = "rgb(244, 241, 234)";
const BLACK = "rgb(10, 10, 10)";

const background = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test("the site follows a light device", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "light" });
  const page = await context.newPage();
  await page.goto("/en");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  expect(await background(page)).toBe(IVORY);
  await context.close();
});

test("the site follows a dark device", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto("/en");
  expect(await background(page)).toBe(BLACK);
  await context.close();
});

test("a chosen theme is applied, kept after a reload and can be undone", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto("/en");

  await page.getByRole("button", { name: "Theme: System" }).click();
  await page.getByRole("menuitemradio", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await background(page)).toBe(IVORY);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("button", { name: "Theme: Light" })).toBeVisible();

  await page.getByRole("button", { name: "Theme: Light" }).click();
  await page.getByRole("menuitemradio", { name: "System" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  expect(await background(page)).toBe(BLACK);
  await context.close();
});

test("the theme menu closes with Escape and gives focus back", async ({ page }) => {
  await page.goto("/en");
  const button = page.getByRole("button", { name: /^Theme:/ });
  await button.click();
  await expect(page.getByRole("menu", { name: "Theme" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(button).toBeFocused();
});
