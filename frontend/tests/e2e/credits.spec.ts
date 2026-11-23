import { expect, test } from "@playwright/test";

test("the footer links to the credits page, which names every source", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("contentinfo").getByRole("link", { name: "Credits" }).click();
  await expect(page).toHaveURL(/\/en\/credits$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Credits");
  for (const name of ["Places", "Fonts", "Baby names", "Avurudu times", "Planet positions"]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "GeoNames" })).toHaveAttribute("href", "https://www.geonames.org");
  await expect(page.getByRole("link", { name: "CC BY 4.0" })).toBeVisible();
  await expect(page.getByRole("link", { name: "JetBrains Mono" })).toBeVisible();
  await expect(page.getByRole("link", { name: "CC BY-SA 4.0" })).toBeVisible();
  await expect(page.locator("[data-year='2027']")).toContainText("Department of Cultural Affairs");
  await expect(page.getByText("Planet positions: Swiss Ephemeris.")).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText(/astrodienst/i);
});

test("the credits page in Sinhala", async ({ page }) => {
  await page.goto("/si");
  await page.getByRole("contentinfo").getByRole("link", { name: "මූලාශ්‍ර" }).click();
  await expect(page).toHaveURL(/\/si\/credits$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("මූලාශ්‍ර සහ ස්තුතිය");
  await expect(page.getByRole("heading", { level: 2, name: "බිළිඳු නම්" })).toBeVisible();
  await expect(page.locator("[data-year='2024']")).toContainText("රජයේ ජ්‍යෝතිෂ කමිටුව");
  await expect(page.getByRole("link", { name: "බිළිඳු නම් අකුරු" })).toHaveAttribute("href", "/si/baby-names");
});
