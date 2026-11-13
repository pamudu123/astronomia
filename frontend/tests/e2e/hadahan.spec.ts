import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type Page, expect, test } from "@playwright/test";

/** The backend is not running in these tests: its answers are saved real responses. */
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf-8");

async function mockBackend(page: Page, lang: "en" | "si", hadahan = `hadahan-${lang}.json`) {
  await page.route("**/api/v1/labels/*", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture(`labels-${lang}.json`) }),
  );
  await page.route("**/api/v1/places?*", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture("places-kandy.json") }),
  );
  await page.route("**/api/v1/time/resolve", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture("time-kandy.json") }),
  );
  await page.route("**/api/v1/forecast", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture(`forecast-${lang}.json`) }),
  );
  await page.route("**/api/v1/changes/personal", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture(`changes-personal-${lang}.json`) }),
  );
  const requests: string[] = [];
  await page.route("**/api/v1/hadahan", (route) => {
    requests.push(route.request().postData() ?? "");
    return route.fulfill({ contentType: "application/json", body: fixture(hadahan) });
  });
  return requests;
}

async function fillForm(page: Page) {
  await page.getByLabel(/Name/).fill("Nimali");
  await page.getByLabel("Date of birth").fill("1995-04-19");
  await page.getByLabel("Time of birth").fill("14:35");
  await page.getByRole("combobox").fill("kandy");
  await page.getByRole("option").first().click();
}

test("a birth gives the full hadahan", async ({ page }) => {
  const requests = await mockBackend(page, "en");
  await page.goto("/en/hadahan");
  await fillForm(page);
  await expect(page.getByText("Time zone on that date: UTC+05:30")).toBeVisible();
  await page.getByRole("button", { name: "Show my hadahan" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nimali's hadahan");
  await expect(page.locator('[data-card="lagna"]')).toContainText("Simha");
  await expect(page.locator('[data-card="nakath"]')).toContainText("Jyeshtha");
  await expect(page.getByRole("img", { name: /Rashi chart/ })).toBeVisible();
  await expect(page.getByRole("table")).toContainText("Mars");
  await expect(page.getByRole("heading", { name: "Dasha timeline" })).toBeVisible();
  await expect(page.locator('[data-card="kuja"]')).toContainText("Present, reduced");

  // Birth details went in the request body and never into the page address.
  expect(JSON.parse(requests[0])).toMatchObject({ date: "1995-04-19", time: "14:35", lang: "en" });
  expect(page.url()).not.toContain("1995");
});

test("the navamsha chart can be shown", async ({ page }) => {
  await mockBackend(page, "en");
  await page.goto("/en/hadahan");
  await fillForm(page);
  await page.getByRole("button", { name: "Show my hadahan" }).click();
  await page.getByRole("button", { name: "Navamsha" }).click();
  await expect(page.getByRole("img", { name: /Navamsha chart/ })).toBeVisible();
});

test("the Sinhala result uses Sinhala names", async ({ page }) => {
  await mockBackend(page, "si");
  await page.goto("/si/hadahan");
  await page.getByLabel("උපන් දිනය").fill("1995-04-19");
  await page.getByLabel("උපන් වේලාව").fill("14:35");
  await page.getByRole("combobox").fill("kandy");
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "මගේ හඳහන පෙන්වන්න" }).click();
  await expect(page.locator('[data-card="lagna"]')).toContainText("සිංහ");
  await expect(page.getByText("1995 අප්‍රේල් 19").first()).toBeVisible();
});

test("the form waits for the page to be ready, so nothing typed is lost", async ({ page }) => {
  await mockBackend(page, "en");
  // Hold the page scripts back, as on a slow phone.
  let release = () => {};
  const scripts = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/_next/static/chunks/**", async (route) => {
    await scripts;
    await route.continue();
  });
  await page.goto("/en/hadahan", { waitUntil: "commit" });
  await expect(page.getByLabel("Date of birth")).toBeDisabled();
  release();
  await fillForm(page);
  await page.getByRole("button", { name: "Show my hadahan" }).click();
  await expect(page.locator('[data-card="lagna"]')).toContainText("Simha");
});

test("a time that happened twice asks which one", async ({ page }) => {
  await mockBackend(page, "en", "hadahan-ambiguous.json");
  await page.goto("/en/hadahan");
  await fillForm(page);
  await page.getByRole("button", { name: "Show my hadahan" }).click();
  await expect(page.getByRole("heading", { name: "That time happened twice" })).toBeVisible();
  await expect(page.getByRole("button", { name: /UTC\+01:00/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /UTC\+00:00/ })).toBeVisible();
});

test("missing details are reported", async ({ page }) => {
  await mockBackend(page, "en");
  await page.goto("/en/hadahan");
  await page.getByRole("button", { name: "Show my hadahan" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Please fill in the date, time and place." }),
  ).toBeVisible();
});

test("the result downloads as a PDF report", async ({ page }) => {
  await mockBackend(page, "en");
  const reports: string[] = [];
  await page.route("**/api/v1/reports/pdf", (route) => {
    reports.push(route.request().postData() ?? "");
    return route.fulfill({ contentType: "application/pdf", body: "%PDF-1.7\n%test\n" });
  });
  await page.goto("/en/hadahan");
  await fillForm(page);
  await page.getByRole("button", { name: "Show my hadahan" }).click();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  expect((await download).suggestedFilename()).toBe("astronomia-hadahan.pdf");

  // The details go in the request body, and the page address never changes.
  expect(JSON.parse(reports[0])).toMatchObject({
    kind: "hadahan",
    name: "Nimali",
    birth: { date: "1995-04-19", time: "14:35", lang: "en" },
  });
  expect(page.url()).not.toContain("1995");
});

test("a failed PDF says so", async ({ page }) => {
  await mockBackend(page, "si");
  await page.route("**/api/v1/reports/pdf", (route) => route.fulfill({ status: 500, body: "" }));
  await page.goto("/si/hadahan");
  await page.getByLabel("උපන් දිනය").fill("1995-04-19");
  await page.getByLabel("උපන් වේලාව").fill("14:35");
  await page.getByRole("combobox").fill("kandy");
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "මගේ හඳහන පෙන්වන්න" }).click();
  await page.getByRole("button", { name: "PDF ලෙස බාගන්න" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "PDF සෑදීමට නොහැකි විය" })).toBeVisible();
});

test("the result shows this month for you", async ({ page }) => {
  await mockBackend(page, "en");
  await page.goto("/en/hadahan");
  await fillForm(page);
  await page.getByRole("button", { name: "Show my hadahan" }).click();

  const section = page.locator('[data-card="forecast"]');
  await expect(section.getByRole("heading", { name: "This month for you" })).toBeVisible();
  await expect(section).toContainText("December 2026");
  await expect(section.locator("[data-planet]")).toHaveCount(4);
  await expect(section.locator('[data-planet="saturn"]')).toContainText("8th house");
  const rahu = section.locator('[data-planet="rahu"]');
  await expect(rahu).toContainText("Changes sign");
  await expect(rahu).toContainText("On 5 December 2026 it moves into Makara, your 6th house.");
  await expect(section).toContainText("It does not predict events, health or outcomes.");
});

test("the forecast is in Sinhala on the Sinhala page", async ({ page }) => {
  await mockBackend(page, "si");
  await page.goto("/si/hadahan");
  await page.getByLabel("උපන් දිනය").fill("1995-04-19");
  await page.getByLabel("උපන් වේලාව").fill("14:35");
  await page.getByRole("combobox").fill("kandy");
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "මගේ හඳහන පෙන්වන්න" }).click();
  const section = page.locator('[data-card="forecast"]');
  await expect(section.getByRole("heading", { name: "මේ මාසය ඔබට" })).toBeVisible();
  await expect(section).toContainText("2026 දෙසැම්බර්");
  await expect(section.locator("[data-planet]")).toHaveCount(4);
});

test("the hadahan still shows when the forecast fails", async ({ page }) => {
  await mockBackend(page, "en");
  await page.route("**/api/v1/forecast", (route) => route.fulfill({ status: 500, body: "" }));
  await page.goto("/en/hadahan");
  await fillForm(page);
  await page.getByRole("button", { name: "Show my hadahan" }).click();
  await expect(page.locator('[data-card="kuja"]')).toBeVisible();
  await expect(page.locator('[data-card="forecast"]')).toHaveCount(0);
});

test("the result shows the planet changes for you", async ({ page }) => {
  await mockBackend(page, "en");
  await page.goto("/en/hadahan");
  await fillForm(page);
  await page.getByRole("button", { name: "Show my hadahan" }).click();

  const section = page.locator('[data-card="changes"]');
  await expect(section.getByRole("heading", { name: "Planet changes for you" })).toBeVisible();
  const rahu = section.locator('[data-change="rahu-ketu-2026-12"]');
  await expect(rahu).toContainText("5 December 2026, 22:32 Sri Lanka time");
  await expect(rahu).toContainText("Rahu: 7th house to 6th house");
  await expect(rahu).toContainText("Rahu: 4th house to 3rd house");
  await expect(section.locator("[data-change]")).toHaveCount(5);
  await expect(section.getByRole("link", { name: "Read about this change" })).toHaveCount(5);
  const personal: string[] = [];
  await page.route("**/api/v1/changes/rahu-ketu-2026-12/personal", (route) => {
    personal.push(route.request().postData() ?? "");
    return route.fulfill({
      contentType: "application/json",
      body: fixture("changes-rahu-ketu-2026-12-personal-en.json"),
    });
  });
  await rahu.getByRole("link", { name: "Read about this change" }).click();
  await expect(page).toHaveURL(/\/en\/changes\/rahu-ketu-2026-12\/simha$/);

  // The hadahan made in this tab is offered, so nothing is typed again.
  const panel = page.getByRole("main").locator('[data-card="personal"]');
  await panel.getByRole("button", { name: "Use the hadahan for Nimali" }).click();
  await expect(panel).toContainText("Your Moon sign: Vrischika");
  expect(JSON.parse(personal[0])).toMatchObject({ date: "1995-04-19", time: "14:35" });
  expect(page.url()).not.toContain("1995");
});

test("the hadahan still shows when the planet changes fail", async ({ page }) => {
  await mockBackend(page, "en");
  await page.route("**/api/v1/changes/personal", (route) => route.fulfill({ status: 500, body: "" }));
  await page.goto("/en/hadahan");
  await fillForm(page);
  await page.getByRole("button", { name: "Show my hadahan" }).click();
  await expect(page.locator('[data-card="forecast"]')).toBeVisible();
  await expect(page.locator('[data-card="changes"]')).toHaveCount(0);
});
