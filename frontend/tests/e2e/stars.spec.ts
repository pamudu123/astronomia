import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type Page, expect, test } from "@playwright/test";

/** The backend is not running in these tests: its answers are saved real responses. */
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf-8");

async function mockBackend(page: Page) {
  const asked: string[] = [];
  await page.route("**/api/v1/porondam/stars/krittika?*", (route) => {
    const query = new URL(route.request().url()).searchParams;
    asked.push(query.toString());
    const name = `stars-krittika-${query.get("pada")}-${query.get("lang")}.json`;
    return route.fulfill({ contentType: "application/json", body: fixture(name) });
  });
  await page.route("**/api/v1/labels/*", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture("labels-en.json") }),
  );
  return asked;
}

test("the list of stars leads to one star's matches", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/en/porondam/stars");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Which birth stars match yours?");
  await expect(page.getByRole("listitem").filter({ hasText: "Krittika" })).toContainText(
    "Mesha · Vrishabha",
  );
  await page.getByRole("link", { name: /Krittika/ }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Krittika: which birth stars match");
  await expect(page).toHaveTitle("Krittika porondam: matching birth stars · Astronomia");
  await expect(page.locator("[data-star]")).toHaveCount(36);
  const first = page.locator("[data-star]").first();
  await expect(first).toHaveAttribute("data-star", "shatabhisha");
  await expect(first.getByRole("img", { name: "8 of 9 factors agree" })).toBeVisible();
  await expect(first.locator('[data-check="rajju"]')).toContainText("passes");
  await expect(page.getByRole("heading", { name: "An essential check does not pass" })).toBeVisible();
});

test("the Moon sign changes the list, and a row opens the quick match", async ({ page }) => {
  const asked = await mockBackend(page);
  await page.goto("/en/porondam/stars/krittika");
  // Krittika in Mesha: Mula is third. In Vrishabha the sign based factors change the order.
  await expect(page.locator("[data-star]").nth(2)).toHaveAttribute("data-star", "mula");

  await page.getByRole("button", { name: "Vrishabha (pada 2–4)" }).click();
  await expect(page.locator("[data-star]").nth(2)).toHaveAttribute("data-star", "anuradha");
  expect(asked.at(-1)).toBe("pada=2&role=bride&lang=en");

  await page.locator('[data-star="ashlesha"]').getByRole("link", { name: "See the full match" }).click();
  await expect(page).toHaveURL(/\/en\/porondam\?bride=krittika\.2&groom=ashlesha\.1$/);
  await expect(page.getByRole("button", { name: "Birth stars only" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const bride = page.getByRole("group", { name: "Bride" });
  await expect(bride.getByLabel("Birth star (nakath)")).toHaveValue("krittika");
  await expect(bride.getByLabel("Pada")).toHaveValue("2");
  await expect(page.getByRole("group", { name: "Groom" }).getByLabel("Birth star (nakath)")).toHaveValue(
    "ashlesha",
  );
});

test("a star page in Sinhala", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/si/porondam/stars/krittika");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("කැති: ගැළපෙන නැකැත්");
  await expect(page.locator("[data-star]")).toHaveCount(36);
  await expect(page.getByRole("button", { name: "මනාලයාට" })).toBeVisible();
});

test("an unknown star is not found", async ({ page }) => {
  await page.goto("/en/porondam/stars/polaris");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await expect(page.locator("[data-star]")).toHaveCount(0);
});
