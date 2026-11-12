import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type Page, expect, test } from "@playwright/test";

/** The backend is not running in these tests: its answers are saved real responses. */
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf-8");

async function mockBackend(page: Page, lang: "en" | "si", porondam: string) {
  await page.route("**/api/v1/labels/*", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture(`labels-${lang}.json`) }),
  );
  await page.route("**/api/v1/places?*", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture("places-kandy.json") }),
  );
  const requests: string[] = [];
  await page.route("**/api/v1/porondam", (route) => {
    requests.push(route.request().postData() ?? "");
    return route.fulfill({ contentType: "application/json", body: fixture(porondam) });
  });
  return requests;
}

async function quickForm(page: Page) {
  await page.getByRole("button", { name: "Birth stars only" }).click();
  const bride = page.getByRole("group", { name: "Bride" });
  await bride.getByLabel(/Name/).fill("Nimali");
  await bride.getByLabel("Birth star (nakath)").selectOption("anuradha");
  await bride.getByLabel("Pada").selectOption("2");
  const groom = page.getByRole("group", { name: "Groom" });
  await groom.getByLabel(/Name/).fill("Kasun");
  await groom.getByLabel("Birth star (nakath)").selectOption("rohini");
}

test("a quick match by birth stars", async ({ page }) => {
  const requests = await mockBackend(page, "en", "porondam-quick-en.json");
  await page.goto("/en/porondam");
  await quickForm(page);
  await page.getByRole("button", { name: "Match the charts" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nimali and Kasun");
  await expect(page.getByRole("img", { name: "7 of 9 factors agree" })).toBeVisible();
  await expect(page.locator('[data-check="rajju"]')).toContainText("Pass");
  await expect(page.locator('[data-check="vedha"]')).toContainText("Pass");
  await expect(page.locator("[data-factor]")).toHaveCount(9);
  await expect(page.getByText("Kuja dosha needs the full birth details of both people.")).toBeVisible();

  expect(JSON.parse(requests[0])).toMatchObject({
    bride: { nakshatra: "anuradha", pada: 2 },
    groom: { nakshatra: "rohini", pada: 1 },
    lang: "en",
  });
});

test("the factor filter", async ({ page }) => {
  await mockBackend(page, "en", "porondam-quick-en.json");
  await page.goto("/en/porondam");
  await quickForm(page);
  await page.getByRole("button", { name: "Match the charts" }).click();
  await page.getByRole("button", { name: "Do not agree" }).click();
  await expect(page.locator("[data-factor]")).toHaveCount(2);
  await page.getByRole("button", { name: "Agree", exact: true }).click();
  await expect(page.locator("[data-factor]")).toHaveCount(7);
});

test("a full match shows Kuja dosha for both", async ({ page }) => {
  await mockBackend(page, "en", "porondam-full-en.json");
  await page.goto("/en/porondam");
  for (const role of ["Bride", "Groom"]) {
    const card = page.getByRole("group", { name: role });
    await card.getByLabel("Date of birth").fill(role === "Bride" ? "1995-04-19" : "1992-08-03");
    await card.getByLabel("Time of birth").fill("10:00");
    await card.getByRole("combobox").fill("kandy");
    await card.getByRole("option").first().click();
  }
  await page.getByRole("button", { name: "Match the charts" }).click();
  await expect(page.getByRole("img", { name: "3 of 9 factors agree" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kuja dosha" })).toBeVisible();
  await expect(page.getByText("The bride's chart shows Kuja dosha and the groom's does not.", { exact: false })).toBeVisible();
});

test("the Sinhala result uses Sinhala names", async ({ page }) => {
  await mockBackend(page, "si", "porondam-full-si.json");
  await page.goto("/si/porondam");
  for (const role of ["මනාලිය", "මනාලයා"]) {
    const card = page.getByRole("group", { name: role });
    await card.getByLabel("උපන් දිනය").fill("1995-04-19");
    await card.getByLabel("උපන් වේලාව").fill("10:00");
    await card.getByRole("combobox").fill("kandy");
    await card.getByRole("option").first().click();
  }
  await page.getByRole("button", { name: "කේන්දර ගළපන්න" }).click();
  await expect(page.locator('[data-factor="dina"]')).toContainText("දින");
  await expect(page.locator('[data-check="rajju"]')).toContainText("රජ්ජු");
});

test("missing details are reported", async ({ page }) => {
  await mockBackend(page, "en", "porondam-quick-en.json");
  await page.goto("/en/porondam");
  await page.getByRole("button", { name: "Match the charts" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Please fill in the details for both people." }),
  ).toBeVisible();
});

test("a match downloads as a PDF report", async ({ page }) => {
  await mockBackend(page, "en", "porondam-quick-en.json");
  const reports: string[] = [];
  await page.route("**/api/v1/reports/pdf", (route) => {
    reports.push(route.request().postData() ?? "");
    return route.fulfill({ contentType: "application/pdf", body: "%PDF-1.7\n%test\n" });
  });
  await page.goto("/en/porondam");
  await quickForm(page);
  await page.getByRole("button", { name: "Match the charts" }).click();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  expect((await download).suggestedFilename()).toBe("astronomia-porondam.pdf");
  expect(JSON.parse(reports[0])).toMatchObject({
    kind: "porondam",
    match: {
      bride: { name: "Nimali", nakshatra: "anuradha", pada: 2 },
      groom: { name: "Kasun", nakshatra: "rohini", pada: 1 },
      lang: "en",
    },
  });
});
