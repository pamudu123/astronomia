import { expect, test } from "@playwright/test";

test("the footer links to the privacy page, which is marked as a draft", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("contentinfo").getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/\/en\/privacy$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy");
  await expect(page.getByText("Draft: to be reviewed before the site goes public.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nothing kept by default" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Saved reports and your account" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The AI helper" })).toBeVisible();
  await expect(page.getByText("A contact address will be added here before launch.")).toBeVisible();
});

test("the legal pages never show a placeholder in square brackets", async ({ page }) => {
  for (const path of ["/en/privacy", "/en/terms", "/si/privacy", "/si/terms"]) {
    await page.goto(path);
    await expect(page.getByRole("main")).not.toContainText(/\[[^\]]*\]/);
  }
});

test("the terms page in Sinhala, marked for review", async ({ page }) => {
  await page.goto("/si/terms");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("භාවිත නියම");
  await expect(page.getByRole("heading", { name: "මඟපෙන්වීමක් සඳහා පමණයි" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "සම්පූර්ණ වාර්තා සහ කූපන්" })).toBeVisible();
  await expect(page.getByText(/නීතිඥයකු සහ සිංහල භාෂා සමාලෝචකයකු/)).toBeVisible();
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "පෞද්ගලිකත්වය" })).toBeVisible();
});

test("robots.txt keeps shared links out of search", async ({ request }) => {
  const body = await (await request.get("/robots.txt")).text();
  expect(body).toContain("Disallow: /en/s/");
  expect(body).toContain("Disallow: /si/s/");
});
