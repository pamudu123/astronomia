import { expect, test } from "@playwright/test";

test("the footer links to the privacy page, which is marked as a draft", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("contentinfo").getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/\/en\/privacy$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy");
  await expect(page.getByText("Draft: to be reviewed before the site goes public.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nothing kept by default" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What is kept" })).toBeVisible();
});

test("the terms page in Sinhala", async ({ page }) => {
  await page.goto("/si/terms");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("භාවිත නියම");
  await expect(page.getByRole("heading", { name: "මාර්ගෝපදේශය සඳහා පමණි" })).toBeVisible();
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "පෞද්ගලිකත්වය" })).toBeVisible();
});

test("robots.txt keeps shared links out of search", async ({ request }) => {
  const body = await (await request.get("/robots.txt")).text();
  expect(body).toContain("Disallow: /en/s/");
  expect(body).toContain("Disallow: /si/s/");
});
