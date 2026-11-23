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

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nimali's birth chart");
  await expect(page.locator('[data-card="lagna"]')).toContainText("Simha");
  await expect(page.locator('[data-card="nakath"]')).toContainText("Jyeshtha");
  await expect(page.getByRole("img", { name: /Rashi chart/ })).toBeVisible();
  await expect(page.getByRole("table")).toContainText("Mars");
  await expect(page.getByRole("heading", { name: "Dasha timeline" })).toBeVisible();
  await expect(page.locator('[data-card="kuja"]')).toContainText("Present, but weaker");

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
  await page.getByLabel("උපන් වේලාව", { exact: true }).fill("14:35");
  await page.getByRole("combobox").fill("kandy");
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "මගේ හඳහන පෙන්වන්න" }).click();
  await expect(page.locator('[data-card="lagna"]')).toContainText("සිංහ");
  await expect(page.getByText("1995 අප්‍රේල් 19").first()).toBeVisible();
});

test("the form waits for the page to be ready, so nothing typed is lost", async ({ page }) => {
  await mockBackend(page, "en");
  // Hold the page scripts back, as on a slow phone. Only the scripts: holding the stylesheets too
  // would also hold the theme script in <head>, which a browser runs only once the CSS before it is in.
  let release = () => {};
  const scripts = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/_next/static/chunks/**/*.js", async (route) => {
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
  const alert = page.locator("form").getByRole("alert");
  const submit = page.getByRole("button", { name: "Show my hadahan" });
  await submit.click();
  await expect(alert).toHaveText("Still needed: Date of birth, Time of birth, Place of birth.");
  await expect(page.getByLabel("Date of birth")).toBeFocused();
  await expect(page.getByLabel("Date of birth")).toHaveAttribute("aria-invalid", "true");

  // Each one goes as it is filled in (QA-05).
  await page.getByRole("combobox").fill("kandy");
  await page.getByRole("option").first().click();
  await expect(alert).toHaveText("Still needed: Date of birth, Time of birth.");
  const hint = page.locator("[data-place-hint]");
  await expect(hint).toContainText("Chosen: Kandy");
  await expect(hint).toContainText("Asia/Colombo");
  await expect(page.getByRole("combobox")).not.toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Date of birth").fill("1995-04-19");
  await expect(alert).toHaveText("Still needed: Time of birth.");
  await submit.click();
  await expect(page.getByLabel("Time of birth")).toBeFocused();
  await page.getByLabel("Time of birth").fill("14:35");
  await expect(alert).toHaveCount(0);

  // Changing the place again needs it again, and the hint says how.
  await page.getByRole("combobox").fill("k");
  await expect(alert).toHaveText("Still needed: Place of birth.");
  await expect(hint).toHaveText("Type at least two letters of a town or village");
  await page.getByRole("button", { name: /coordinates/i }).click();
  await expect(alert).toHaveText("Still needed: Latitude, Longitude, Time zone.");
});

test("missing details are named in Sinhala too", async ({ page }) => {
  await mockBackend(page, "si");
  await page.goto("/si/hadahan");
  await page.locator('form button[type="submit"]').click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "තව ඇතුළත් කළ යුතු තොරතුරු: උපන් දිනය, උපන් වේලාව, උපන් ස්ථානය.",
  );
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
  expect((await download).suggestedFilename()).toBe("sidera-hadahan.pdf");

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
  await page.getByLabel("උපන් වේලාව", { exact: true }).fill("14:35");
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
  await expect(page.getByRole("heading", { name: "Coming up" })).toBeVisible();
  await expect(section.getByRole("heading", { name: "This month" })).toBeVisible();
  await expect(section).toContainText("December 2026");
  await expect(section.locator("[data-planet]")).toHaveCount(4);
  await expect(section.locator('[data-planet="saturn"]')).toContainText("8th house");
  const rahu = section.locator('[data-planet="rahu"]');
  await expect(rahu).toContainText("Changes sign");
  await expect(rahu).toContainText("On 5 December 2026 it moves into Makara, your 6th house.");
  // The general guidance note is said once, for the whole page.
  await expect(page.locator('[data-card="note"]')).toContainText("It does not predict events, health or how long a life is.");
});

test("the forecast is in Sinhala on the Sinhala page", async ({ page }) => {
  await mockBackend(page, "si");
  await page.goto("/si/hadahan");
  await page.getByLabel("උපන් දිනය").fill("1995-04-19");
  await page.getByLabel("උපන් වේලාව", { exact: true }).fill("14:35");
  await page.getByRole("combobox").fill("kandy");
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "මගේ හඳහන පෙන්වන්න" }).click();
  const section = page.locator('[data-card="forecast"]');
  await expect(section.getByRole("heading", { name: "මේ මාසය" })).toBeVisible();
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

  // It says so in one line, and trying again brings it.
  const section = page.locator('[data-section="forecast"]');
  await expect(section).toContainText("We could not load this section.");
  await page.unroute("**/api/v1/forecast");
  await page.route("**/api/v1/forecast", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture("forecast-en.json") }),
  );
  await section.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator('[data-card="forecast"]')).toBeVisible();
});

test("the result shows the planet changes for you", async ({ page }) => {
  await mockBackend(page, "en");
  await page.goto("/en/hadahan");
  await fillForm(page);
  await page.getByRole("button", { name: "Show my hadahan" }).click();

  const section = page.locator('[data-card="changes"]');
  await expect(section.getByRole("heading", { name: "Planet changes" })).toBeVisible();
  const rahu = section.locator('[data-change="rahu-ketu-2026-12"]');
  await expect(rahu).toContainText("5 December 2026, 22:32 Sri Lanka time");
  // Counted from the lagna first; the Moon sign (gochara) is a tap away.
  await expect(rahu).toContainText("Rahu: 7th house to 6th house");
  await expect(rahu).not.toContainText("Rahu: 4th house to 3rd house");
  await section.getByRole("button", { name: "From Moon sign (gochara)" }).click();
  await expect(rahu).toContainText("Rahu: 4th house to 3rd house");
  await section.getByRole("button", { name: "From lagna" }).click();
  // The nearest two first, the rest a tap away.
  await expect(section.locator("[data-change]")).toHaveCount(2);
  await section.getByRole("button", { name: "Show all 5" }).click();
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

test("the result links to the year for this lagna", async ({ page }) => {
  await mockBackend(page, "en");
  await page.goto("/en/hadahan");
  await fillForm(page);
  await page.getByRole("button", { name: "Show my hadahan" }).click();
  const card = page.locator('[data-card="yearly"]');
  await expect(card.getByRole("heading", { name: "Your 2027" })).toBeVisible();
  await expect(card.getByRole("link", { name: "See your 2027" })).toHaveAttribute("href", "/en/forecast/2027/simha");
});

test("the hadahan still shows when the planet changes fail", async ({ page }) => {
  await mockBackend(page, "en");
  await page.route("**/api/v1/changes/personal", (route) => route.fulfill({ status: 500, body: "" }));
  await page.goto("/en/hadahan");
  await fillForm(page);
  await page.getByRole("button", { name: "Show my hadahan" }).click();
  await expect(page.locator('[data-card="forecast"]')).toBeVisible();
  await expect(page.locator('[data-card="changes"]')).toHaveCount(0);

  // It says so in one line, and trying again brings it.
  const section = page.locator('[data-section="changes"]');
  await expect(section).toContainText("We could not load this section.");
  await page.unroute("**/api/v1/changes/personal");
  await page.route("**/api/v1/changes/personal", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture("changes-personal-en.json") }),
  );
  await section.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator('[data-card="changes"]')).toBeVisible();
});

test("Edit details brings back every field, also after a reload (QA AST-01)", async ({ page }) => {
  await mockBackend(page, "en");
  await page.goto("/en/hadahan");
  await fillForm(page);
  await page.getByRole("button", { name: "Show my hadahan" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nimali's birth chart");

  await page.getByRole("button", { name: "Edit details" }).first().click();
  await expect(page.getByLabel(/Name/)).toHaveValue("Nimali");
  await expect(page.getByLabel("Date of birth")).toHaveValue("1995-04-19");
  await expect(page.getByLabel("Time of birth")).toHaveValue("14:35");
  await expect(page.getByRole("combobox")).toHaveValue(/Kandy/);

  await page.reload();
  await expect(page.getByLabel("Date of birth")).toHaveValue("1995-04-19");
  await expect(page.getByRole("combobox")).toHaveValue(/Kandy/);
});

test("a half-filled form survives switching language (QA AST-05)", async ({ page }) => {
  await mockBackend(page, "si");
  await page.goto("/si/hadahan");
  const date = page.locator('input[type="date"]');
  await expect(date).toBeEnabled();
  await page.locator('input[type="text"]').first().fill("QA Draft");
  await date.fill("1990-01-15");
  await page.getByRole("combobox").fill("kandy");
  await page.getByRole("option").first().click();

  await mockBackend(page, "en");
  await page.goto("/en/hadahan");
  await expect(page.getByLabel(/Name/)).toHaveValue("QA Draft");
  await expect(page.getByLabel("Date of birth")).toHaveValue("1990-01-15");
  await expect(page.getByRole("combobox")).toHaveValue(/Kandy/);
});

test("bad coordinates and time zones are named beside the field (QA AST-06)", async ({ page }) => {
  const requests = await mockBackend(page, "en");
  await page.goto("/en/hadahan");
  await page.getByLabel("Date of birth").fill("1990-01-15");
  await page.getByLabel("Time of birth").fill("23:59");
  await page.getByRole("button", { name: "Enter coordinates instead" }).click();
  await page.getByLabel("Latitude").fill("91");
  await page.getByLabel("Longitude").fill("181");
  await page.getByLabel("Time zone").fill("Mars/Olympus");
  await page.getByRole("button", { name: "Show my hadahan" }).click();

  await expect(page.getByLabel("Latitude")).toBeFocused();
  await expect(page.getByLabel("Latitude")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Latitude must be a number from -90 to 90")).toBeVisible();
  await expect(page.getByText("Longitude must be a number from -180 to 180")).toBeVisible();
  await expect(page.getByText("That time zone is not recognised")).toBeVisible();
  expect(requests).toHaveLength(0);

  // Fixing one field keeps the others and clears only its message.
  await page.getByLabel("Latitude").fill("6.9271");
  await expect(page.getByText("Latitude must be a number")).toHaveCount(0);
  await expect(page.getByLabel("Longitude")).toHaveValue("181");
});

test("each field has one label of its own (QA AST-08)", async ({ page }) => {
  await mockBackend(page, "en");
  await page.goto("/en/hadahan");
  await expect(page.getByLabel("Date of birth")).toHaveCount(1);
  const ids = await page.locator("input[id]").evaluateAll((inputs) => inputs.map((input) => input.id));
  expect(new Set(ids).size).toBe(ids.length);
});

test("the result leads with the birth details and three plain answers", async ({ page }) => {
  await mockBackend(page, "en");
  await page.goto("/en/hadahan");
  await fillForm(page);
  await page.getByRole("button", { name: "Show my hadahan" }).click();

  // What the chart was worked out from, with the way to correct it beside it.
  const details = page.locator('[data-card="details"]');
  await expect(details).toContainText("19 April 1995");
  await expect(details.getByRole("definition").nth(1)).toContainText("14:35");
  await expect(details).toContainText("Kandy");
  await expect(details).toContainText("UTC+05:30 on that date");
  await expect(details.getByRole("button", { name: "Edit details" })).toBeVisible();

  // Plain titles first, the traditional term beside them.
  await expect(page.getByRole("heading", { name: "Your chart at a glance" })).toBeVisible();
  const rising = page.locator('[data-card="lagna"]');
  await expect(rising.getByRole("heading", { name: "Rising sign" })).toBeVisible();
  await expect(rising).toContainText("Lagna");
  await expect(rising).toContainText("Sign 5 of 12");
  await expect(page.locator('[data-card="rashi"]')).toContainText("Moon sign");
  await expect(page.locator('[data-card="rashi"]')).toContainText("Sign 8 of 12");
  const star = page.locator('[data-card="nakath"]');
  await expect(star).toContainText("Birth star");
  await expect(star).toContainText("Star 18 of 27");
  await expect(star).toContainText("Quarter 4 of 4 (pada 4)");

  // The cards come before the full chart.
  const order = await page
    .locator('[data-card="nakath"], [role="img"][aria-label*="Rashi chart"]')
    .evaluateAll((items) => items.map((item) => item.getAttribute("data-card") ?? "chart"));
  expect(order).toEqual(["nakath", "chart"]);
});

test("the reading guide walks through the chart", async ({ page }) => {
  await mockBackend(page, "en");
  await page.goto("/en/hadahan");
  await fillForm(page);
  await page.getByRole("button", { name: "Show my hadahan" }).click();

  await page.getByRole("button", { name: "How to read this chart" }).click();
  const guide = page.locator('[data-card="guide"]');
  await expect(guide).toContainText("Step 1 of 4");
  await expect(guide).toContainText("It holds your rising sign, Simha");
  await guide.getByRole("button", { name: "Next" }).click();
  await guide.getByRole("button", { name: "Next" }).click();
  await expect(guide).toContainText("The Moon is in house 4, in Vrischika, so Vrischika is your Moon sign.");
  await guide.getByRole("button", { name: "Back" }).click();
  await expect(guide).toContainText("Step 2 of 4");
  await guide.getByRole("button", { name: "Next" }).click();
  await guide.getByRole("button", { name: "Next" }).click();
  await guide.getByRole("button", { name: "Close" }).click();
  await expect(guide).toHaveCount(0);
  await expect(page.getByRole("button", { name: "How to read this chart" })).toBeVisible();
});

test("an unknown birth time leads to the birth star match", async ({ page }) => {
  await mockBackend(page, "en");
  await page.goto("/en/hadahan");
  await page.getByLabel("I don't know the exact time").check();
  const note = page.locator("[data-unknown-time]");
  await expect(note.getByRole("link", { name: "Find the time from an old horoscope" })).toHaveAttribute("href", "/en/kendara");
  await note.getByRole("link", { name: "Match two birth stars" }).click();
  await expect(page).toHaveURL(/\/en\/porondam\?mode=stars$/);
  await expect(page.locator('[data-mode="quick"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Birth star (nakath)")).toHaveCount(2);
});

test("an unknown birth time has its next step in Sinhala too", async ({ page }) => {
  await mockBackend(page, "si");
  await page.goto("/si/hadahan");
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("link", { name: "උපන් නැකත් දෙකක් ගළපන්න" })).toHaveAttribute("href", "/si/porondam?mode=stars");
});

test("the form recovers when its names cannot be loaded, keeping what was typed", async ({ page }) => {
  await mockBackend(page, "en");
  await page.route("**/api/v1/labels/*", (route) => route.fulfill({ status: 503, body: "" }));
  await page.goto("/en/hadahan");
  const alert = page.locator("form").getByRole("alert");
  await expect(alert).toContainText("What you typed is kept.");
  await fillForm(page);
  await page.route("**/api/v1/labels/*", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture("labels-en.json") }),
  );
  await alert.getByRole("button", { name: "Try again" }).click();
  await expect(alert).toHaveCount(0);
  await expect(page.getByLabel(/Name/)).toHaveValue("Nimali");
  await page.getByRole("button", { name: "Show my hadahan" }).click();
  await expect(page.locator('[data-card="lagna"]')).toContainText("Simha");
});

test("sections hold their place while they load, still when less motion is asked for", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockBackend(page, "en");
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  for (const path of ["journey", "forecast", "changes/personal"]) {
    await page.route(`**/api/v1/${path}`, async (route) => {
      await held;
      await route.fulfill({ status: 503, body: "" });
    });
  }
  await page.goto("/en/hadahan");
  await fillForm(page);
  await page.getByRole("button", { name: "Show my hadahan" }).click();
  for (const [id, height] of [["road", 600], ["forecast", 400], ["changes", 250]] as const) {
    const section = page.locator(`[data-section="${id}"]`);
    await expect(section).toHaveAttribute("aria-busy", "true");
    await expect(section.getByRole("status")).toHaveText("Loading…");
    expect((await section.boundingBox())!.height).toBeGreaterThan(height);
    expect(await section.locator('[aria-hidden="true"]').evaluate((item) => getComputedStyle(item).animationName)).toBe("none");
  }
  release();
  for (const id of ["road", "forecast", "changes"]) {
    await expect(page.locator(`[data-section="${id}"]`)).toContainText("We could not load this section.");
  }
});

test("the place search says when it is searching and when it failed", async ({ page }) => {
  await mockBackend(page, "en");
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  let fail = true;
  await page.route("**/api/v1/places?*", async (route) => {
    await held;
    await route.fulfill(
      fail ? { status: 503, body: "" } : { contentType: "application/json", body: fixture("places-kandy.json") },
    );
  });
  await page.goto("/en/hadahan");
  const box = page.getByRole("combobox");
  const hint = page.locator("[data-place-hint]");
  await box.fill("kandy");
  await expect(hint).toHaveText("Searching for places…");
  await expect(box).toHaveAccessibleDescription("Searching for places…");
  release();
  await expect(hint).toHaveText("Places could not be searched.");
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(box).toBeFocused();
  await page.getByRole("option").first().click();
  await expect(hint).toContainText("Chosen: Kandy");
});

test("the place search fails in Sinhala too", async ({ page }) => {
  await mockBackend(page, "si");
  await page.route("**/api/v1/places?*", (route) => route.fulfill({ status: 503, body: "" }));
  await page.goto("/si/hadahan");
  await page.getByRole("combobox").fill("kandy");
  await expect(page.locator("[data-place-hint]")).toHaveText("ස්ථාන සෙවීමට නොහැකි විය.");
});

test("a birth date still to come is refused", async ({ page }) => {
  const requests = await mockBackend(page, "en");
  await page.goto("/en/hadahan");
  await fillForm(page);
  const date = page.getByLabel("Date of birth");
  await expect(date).toHaveAttribute("max", /^20\d\d-\d\d-\d\d$/);
  await date.fill("2199-01-01");
  await page.getByRole("button", { name: "Show my hadahan" }).click();
  await expect(date).toBeFocused();
  await expect(date).toHaveAccessibleDescription("Date of birth cannot be in the future.");
  expect(requests).toHaveLength(0);
  await date.fill("1995-04-19");
  await expect(page.getByText("cannot be in the future")).toHaveCount(0);
});
