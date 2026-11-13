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
  await expect(page.getByRole("img", { name: "9 of 12 factors agree" })).toBeVisible();
  await expect(page.locator('[data-check="rajju"]')).toContainText("Pass");
  await expect(page.locator('[data-check="vedha"]')).toContainText("Pass");
  // 12 counted factors, and Dina (the birth weekdays) shown as not counted.
  await expect(page.locator("[data-factor]")).toHaveCount(13);
  await expect(page.locator('[data-factor="weekday"]')).toHaveAttribute("data-counted", "false");
  await expect(page.locator('[data-factor="weekday"]')).toContainText("Not counted");
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
  await expect(page.locator("[data-factor]")).toHaveCount(3);
  await page.getByRole("button", { name: "Agree", exact: true }).click();
  await expect(page.locator("[data-factor]")).toHaveCount(9);
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
  await expect(page.getByRole("img", { name: "5 of 13 factors agree" })).toBeVisible();
  await expect(page.locator('[data-factor="weekday"]')).toHaveAttribute("data-counted", "true");
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
  await expect(page.locator('[data-factor="dina"]')).toContainText("නැකත්");
  await expect(page.locator('[data-factor="weekday"]')).toContainText("දින");
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

const timeline = (page: Page, name: string) =>
  page.route("**/api/v1/porondam/timeline", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture(name) }),
  );

test("years ahead for the couple, by birth stars", async ({ page }) => {
  await mockBackend(page, "en", "porondam-quick-en.json");
  await timeline(page, "timeline-quick-en.json");
  await page.goto("/en/porondam");
  await quickForm(page);
  await page.getByRole("button", { name: "Match the charts" }).click();

  const section = page.locator('[data-card="timeline"]');
  await expect(section.getByRole("heading", { name: "Years ahead for the couple" })).toBeVisible();
  const bride = section.locator('[data-facts="bride"]');
  await expect(bride).toContainText("Nimali");
  await expect(bride).toContainText(
    "Saturn is in the 8th sign from the Moon from 30 May 2032 to 12 July 2034.",
  );
  await expect(bride).toContainText("Dasha periods need the full birth details.");
  await expect(section.locator('[data-facts="both"]')).toContainText(
    "Both are in one of these Saturn periods from 30 May 2032 to 12 July 2034.",
  );
  await expect(section).toContainText("These are dates only.");
});

test("years ahead shows the running dasha for a full match, in Sinhala", async ({ page }) => {
  await mockBackend(page, "si", "porondam-full-si.json");
  await timeline(page, "timeline-full-si.json");
  await page.goto("/si/porondam");
  for (const role of ["මනාලිය", "මනාලයා"]) {
    const card = page.getByRole("group", { name: role });
    await card.locator('input[type="date"]').fill("1995-04-19");
    await card.locator('input[type="time"]').fill("14:35");
    await card.getByRole("combobox").fill("kandy");
    await page.getByRole("option").first().click();
  }
  await page.locator('button[type="submit"]').click();

  const section = page.locator('[data-card="timeline"]');
  await expect(section.getByRole("heading", { name: "යුවළගේ ඉදිරි වසර" })).toBeVisible();
  await expect(section.locator('[data-facts="bride"]')).toContainText("රවි මහ දශාව");
  await expect(section.locator('[data-facts="both"]')).toContainText("එකිනෙක හමු නොවේ");
});

test("the match still shows when the years ahead cannot load", async ({ page }) => {
  await mockBackend(page, "en", "porondam-quick-en.json");
  await page.route("**/api/v1/porondam/timeline", (route) => route.fulfill({ status: 500, body: "" }));
  await page.goto("/en/porondam");
  await quickForm(page);
  await page.getByRole("button", { name: "Match the charts" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nimali and Kasun");
  await expect(page.locator("[data-factor]")).toHaveCount(13);
  await expect(page.locator('[data-card="timeline"]')).toHaveCount(0);
});

test("wedding nakath for the couple, from the match", async ({ page }) => {
  await mockBackend(page, "en", "porondam-quick-en.json");
  await timeline(page, "timeline-quick-en.json");
  const asked: string[] = [];
  await page.route("**/api/v1/wedding-nakath", (route) => {
    asked.push(route.request().postData() ?? "");
    return route.fulfill({ contentType: "application/json", body: fixture("wedding-quick-en.json") });
  });
  await page.goto("/en/porondam");
  await quickForm(page);
  await page.getByRole("button", { name: "Match the charts" }).click();

  const section = page.locator('[data-card="wedding"]');
  await expect(section.getByRole("heading", { name: "Wedding nakath for this couple" })).toBeVisible();
  await section.getByRole("button", { name: "1 year" }).click();
  await section.getByLabel("Homecoming").uncheck();
  await section.getByRole("button", { name: "Find dates" }).click();

  const poruwa = section.locator('[data-ceremony="poruwa"]');
  await expect(poruwa.getByRole("heading", { name: "Poruwa ceremony" })).toBeVisible();
  const first = poruwa.locator("[data-date]").first();
  await expect(first).toContainText("15 January 2027");
  await expect(first).toContainText("12:18 to 13:51");
  await first.getByText("Why this date").click();
  await expect(first).toContainText("one of the nakathas for this ceremony");
  await expect(first).toContainText("Rahu kalaya");
  await expect(section).toContainText("Times are in Colombo (UTC+05:30).");
  await expect(section).toContainText("confirm the date and time with your astrologer");

  // The couple's details went in the body of a POST, with the choices made.
  expect(JSON.parse(asked[0])).toMatchObject({
    bride: { nakshatra: "anuradha", pada: 2 },
    groom: { nakshatra: "rohini", pada: 1 },
    months: 12,
    ceremonies: ["engagement", "poruwa"],
    lang: "en",
  });
  expect(page.url()).not.toContain("anuradha");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the wedding finder asks for at least one ceremony, and survives a failure", async ({ page }) => {
  await mockBackend(page, "en", "porondam-quick-en.json");
  await timeline(page, "timeline-quick-en.json");
  await page.route("**/api/v1/wedding-nakath", (route) => route.fulfill({ status: 500, body: "" }));
  await page.goto("/en/porondam");
  await quickForm(page);
  await page.getByRole("button", { name: "Match the charts" }).click();
  const section = page.locator('[data-card="wedding"]');
  for (const name of ["Engagement", "Poruwa ceremony", "Homecoming"]) await section.getByLabel(name).uncheck();
  await section.getByRole("button", { name: "Find dates" }).click();
  await expect(section.getByRole("alert")).toHaveText("Choose at least one ceremony.");
  await section.getByLabel("Poruwa ceremony").check();
  await section.getByRole("button", { name: "Find dates" }).click();
  await expect(section.getByRole("alert")).toHaveText("We could not search. Please try again.");
  await expect(page.getByRole("img", { name: "9 of 12 factors agree" })).toBeVisible();
});
