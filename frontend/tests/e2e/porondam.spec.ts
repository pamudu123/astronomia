import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type Locator, type Page, expect, test } from "@playwright/test";

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

async function quickForm(page: Page, brideStar = "anuradha") {
  await page.getByRole("button", { name: "Birth stars only" }).click();
  const bride = page.getByRole("group", { name: "Bride" });
  await bride.getByLabel(/Name/).fill("Nimali");
  await bride.getByLabel("Birth star (nakath)").selectOption(brideStar);
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
  await expect(page.locator('[data-panel="factors"]')).toContainText("11 of 16 agree");
  await expect(page.locator('[data-check="rajju"]')).toContainText("Pass");
  await expect(page.locator('[data-check="vedha"]')).toContainText("Pass");
  // 16 counted factors, and Dina and Graha shown as not counted (they need the birth details).
  await expect(page.locator("[data-factor]")).toHaveCount(18);
  await expect(page.locator('[data-factor="graha"]')).toHaveAttribute("data-counted", "false");
  await expect(page.locator('[data-factor="weekday"]')).toHaveAttribute("data-counted", "false");
  await expect(page.locator('[data-factor="weekday"]')).toContainText("Not counted");
  await expect(page.getByText("Kuja dosha needs the full birth details of both people.")).toBeVisible();
  // With the AI off (no AGENT_URL), no AI reading or explain buttons (tests/e2e/ai.spec.ts has them on).
  await expect(page.locator('[data-card="full-reading"]')).toHaveCount(0);
  await expect(page.locator("[data-explain]")).toHaveCount(0);

  expect(JSON.parse(requests[0])).toMatchObject({
    bride: { nakshatra: "anuradha", pada: 2 },
    groom: { nakshatra: "rohini", pada: 1 },
    lang: "en",
  });
});

test("a result without checked counts every factor, and names stay in their cells (QA UI-01, UI-02)", async ({ page }) => {
  // A result from before `checked` existed: an older backend, a saved match or an old share link.
  const quick = JSON.parse(fixture("porondam-quick-en.json"));
  for (const factor of quick.match.factors) delete factor.checked;
  quick.match.score.total = quick.match.factors.filter((f: { hard: boolean }) => !f.hard).length;
  quick.match.score.passed = quick.match.factors.filter((f: { hard: boolean; passed: boolean }) => !f.hard && f.passed).length;
  await mockBackend(page, "en", "porondam-quick-en.json");
  await page.route("**/api/v1/porondam", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(quick) }),
  );
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/en/porondam");
  await quickForm(page);
  await page.getByRole("button", { name: "Match the charts" }).click();

  const factors = page.locator('[data-panel="factors"]');
  await expect(factors).toContainText(`${quick.match.score.passed} of ${quick.match.score.total} agree`);
  await expect(factors.locator('[data-marker="off"]')).toHaveCount(0);
  await expect(factors).not.toContainText("not counted here");
  await expect(factors.getByRole("link", { name: /: Not counted$/ })).toHaveCount(0);

  // No marker's name runs past its own cell.
  const overflowing = await factors.locator("[data-marker]").evaluateAll((items) =>
    items.filter((item) => item.querySelector("a")!.scrollWidth > item.clientWidth + 1).map((item) => item.textContent),
  );
  expect(overflowing).toEqual([]);
});

test("the summary ring groups the factors by life area, with Rajju and Vedha kept apart", async ({ page }) => {
  await mockBackend(page, "en", "porondam-quick-en.json");
  await page.goto("/en/porondam");
  await quickForm(page);
  await page.getByRole("button", { name: "Match the charts" }).click();

  const factors = page.locator('[data-panel="factors"]');
  // One segment per factor: 16 counted, and Dina and Graha drawn as not counted.
  const ring = factors.locator("[data-ring]");
  await expect(ring).toHaveAttribute("aria-hidden", "true");
  await expect(ring.locator("[data-segment]")).toHaveCount(18);
  await expect(ring.locator('[data-segment="off"]')).toHaveCount(2);
  await expect(ring.locator('[data-segment="pass"]')).toHaveCount(11);
  await expect(ring).toContainText("of 16");

  const themes = factors.locator("[data-theme]");
  await expect(themes).toHaveCount(4);
  await expect(themes.locator("h3")).toHaveText([
    "Long life and health4 of 4 agree",
    "Bond and temperament5 of 8 agree",
    "Family and children1 of 3 agree",
    "Planets and birth days1 of 1 agree",
  ]);
  await expect(factors.locator('[data-theme="planets"] [data-marker="off"]')).toHaveCount(2);
  await expect(factors).toContainText("Grouped by what each factor is traditionally said to relate to.");
  // Rajju and Vedha stay in their own panel, not in the ring or the count.
  await expect(factors.getByRole("link", { name: /^(Rajju|Vedha):/ })).toHaveCount(0);
  await expect(page.locator('[data-panel="checks"] [data-check]')).toHaveCount(2);

  // Pointing at a life area makes the rest of the ring step back.
  await factors.locator('[data-theme="health"]').hover();
  await expect(ring.locator("path[class*=dim]")).toHaveCount(14);
});

test("labels with no life areas still show every factor in the summary", async ({ page }) => {
  await mockBackend(page, "en", "porondam-quick-en.json");
  const labels = JSON.parse(fixture("labels-en.json"));
  delete labels.porondam_theme;
  await page.route("**/api/v1/labels/*", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(labels) }),
  );
  await page.goto("/en/porondam");
  await quickForm(page);
  await page.getByRole("button", { name: "Match the charts" }).click();

  const factors = page.locator('[data-panel="factors"]');
  await expect(factors.locator("[data-ring] [data-segment]")).toHaveCount(18);
  await expect(factors.locator("[data-marker]")).toHaveCount(18);
  await expect(factors.locator("[data-theme] h3")).toHaveCount(0);
  await expect(factors).not.toContainText("Grouped by");
});

test("the summary fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockBackend(page, "en", "porondam-full-en.json");
  await page.goto("/en/porondam");
  for (const role of ["Bride", "Groom"]) {
    const card = page.getByRole("group", { name: role });
    await card.getByLabel("Date of birth").fill(role === "Bride" ? "1995-04-19" : "1992-08-03");
    await card.getByLabel("Time of birth").fill("10:00");
    await card.getByRole("combobox").fill("kandy");
    await card.getByRole("option").first().click();
  }
  await page.locator("#match-consent").check();
  await page.getByRole("button", { name: "Match the charts" }).click();
  const factors = page.locator('[data-panel="factors"]');
  await expect(factors.locator("[data-ring]")).toBeVisible();
  await expect(factors.locator('[data-theme="planets"] h3')).toContainText("1 of 3 agree");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the factor filter", async ({ page }) => {
  await mockBackend(page, "en", "porondam-quick-en.json");
  await page.goto("/en/porondam");
  await quickForm(page);
  await page.getByRole("button", { name: "Match the charts" }).click();
  await page.getByRole("button", { name: "Do not agree" }).click();
  await expect(page.locator("[data-factor]")).toHaveCount(5);
  await page.getByRole("button", { name: "Agree", exact: true }).click();
  await expect(page.locator("[data-factor]")).toHaveCount(11);
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
  await page.locator("#match-consent").check();
  await page.getByRole("button", { name: "Match the charts" }).click();
  await expect(page.locator('[data-panel="factors"]')).toContainText("9 of 18 agree");
  await expect(page.locator('[data-factor="graha"]')).toHaveAttribute("data-counted", "true");
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
  await page.locator("#match-consent").check();
  await page.getByRole("button", { name: "පොරොන්දම් ගළපන්න" }).click();
  await expect(page.locator('[data-factor="dina"]')).toContainText("නැකත්");
  await expect(page.locator('[data-factor="weekday"]')).toContainText("දින");
  await expect(page.locator('[data-check="rajju"]')).toContainText("රජ්ජු");
});

test("missing details are reported", async ({ page }) => {
  await mockBackend(page, "en", "porondam-quick-en.json");
  await page.goto("/en/porondam");
  const alert = page.locator("form").getByRole("alert");
  await page.getByRole("button", { name: "Match the charts" }).click();
  await expect(alert).toContainText("Still needed for the Bride: Date of birth, Time of birth, Place of birth.");
  await expect(alert).toContainText("Still needed for the Groom: Date of birth, Time of birth, Place of birth.");
  const bride = page.getByRole("group", { name: "Bride" });
  await expect(bride.getByLabel("Date of birth")).toBeFocused();
  await bride.getByLabel("Date of birth").fill("1995-04-19");
  await expect(alert).toContainText("Still needed for the Bride: Time of birth, Place of birth.");

  await page.getByRole("button", { name: /Birth stars only/ }).click();
  await expect(alert).toContainText("Still needed for the Bride: Birth star (nakath).");
  await bride.getByLabel("Birth star (nakath)").selectOption("anuradha");
  await expect(alert).not.toContainText("Bride");
  await page.getByRole("group", { name: "Groom" }).getByLabel("Birth star (nakath)").selectOption("rohini");
  await expect(alert).toHaveCount(0);
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
  expect((await download).suggestedFilename()).toBe("sidera-porondam.pdf");
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
  await page.locator("#match-consent").check();
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
  await expect(page.locator("[data-factor]")).toHaveCount(18);
  await expect(page.locator('[data-card="timeline"]')).toHaveCount(0);

  // It says so in one line, and trying again brings it.
  const section = page.locator('[data-section="timeline"]');
  await expect(section).toContainText("We could not load this section.");
  await timeline(page, "timeline-quick-en.json");
  await section.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator('[data-card="timeline"]')).toBeVisible();
  await expect(section).toHaveCount(0);
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

/** The wedding answer in either language: only the ceremony and date texts differ here. */
function weddingIn(lang: string) {
  const found = JSON.parse(fixture("wedding-quick-en.json"));
  if (lang === "en") return found;
  for (const ceremony of found.ceremonies) {
    ceremony.name = `si ${ceremony.key}`;
    for (const item of ceremony.suggestions) item.date_text = `si ${item.date}`;
  }
  return found;
}

/** A match on screen in English, with the Sinhala match ready for a change of language. */
async function openMatch(page: Page) {
  await mockBackend(page, "en", "porondam-quick-en.json");
  await timeline(page, "timeline-quick-en.json");
  await page.route("**/api/v1/labels/si", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture("labels-si.json") }),
  );
  await page.goto("/en/porondam");
  await quickForm(page);
  await page.getByRole("button", { name: "Match the charts" }).click();
  const section = page.locator('[data-card="wedding"]');
  await expect(section).toBeVisible();
  return section;
}

const dates = (section: Locator) =>
  section.locator("[data-date]").evaluateAll((cards) => cards.map((card) => card.getAttribute("data-date")));

const toLanguage = (page: Page, name: string) => page.getByRole("link", { name, exact: true }).first().click();

test("a running wedding search says what it looks for, and how long it has run (QA-02)", async ({ page }) => {
  await page.clock.install();
  let release = () => {};
  const section = await openMatch(page);
  await page.route("**/api/v1/wedding-nakath", async (route) => {
    await new Promise<void>((resolve) => (release = resolve));
    await route.fulfill({ contentType: "application/json", body: fixture("wedding-quick-en.json") });
  });
  await section.getByRole("button", { name: "1 year" }).click();
  await section.getByLabel("Homecoming").uncheck();
  await section.getByRole("button", { name: "Find dates" }).click();

  const progress = section.locator("[data-progress]");
  const status = progress.getByRole("status");
  await expect(status).toHaveText("Searching the next 1 year for: Engagement, Poruwa ceremony.");
  await expect(section.getByRole("button", { name: "Searching…" })).toBeDisabled();
  await expect(section.getByRole("combobox")).toBeDisabled();
  await page.clock.runFor(12_000);
  await expect(status).toContainText("Still searching the next 1 year");
  await expect(progress).toContainText("12 seconds so far");
  await page.clock.runFor(20_000);
  await expect(status).toContainText("waking up can take a minute or more");
  await expect(status).toContainText("after 90 seconds");

  release();
  await expect(section.locator('[data-ceremony="poruwa"]')).toBeVisible();
  await expect(progress).toHaveCount(0);
});

test("changing the language keeps the wedding dates, then gets them in that language (QA-04)", async ({ page }) => {
  const asked: { lang: string; months: number; ceremonies: string[]; as_of?: string }[] = [];
  let release = () => {};
  let hold = false;
  const section = await openMatch(page);
  await page.route("**/api/v1/wedding-nakath", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    asked.push(body);
    if (hold) await new Promise<void>((resolve) => (release = resolve));
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(weddingIn(body.lang)) });
  });
  await section.getByRole("button", { name: "1 year" }).click();
  await section.getByLabel("Homecoming").uncheck();
  await section.getByRole("button", { name: "Find dates" }).click();
  await expect(section.locator("[data-date]").first()).toBeVisible();
  const found = await dates(section);

  // In Sinhala the dates are there at once, marked as English, while the new words load.
  hold = true;
  await toLanguage(page, "සිංහල");
  await expect(page).toHaveURL(/\/si\/porondam/);
  const visible = page.locator('[data-card="wedding"]:visible');
  await expect(visible.locator("[data-found]")).toHaveAttribute("lang", "en");
  await expect(visible).toContainText("මේ දින සොයා ගත්තේ ඉංග්‍රීසියෙනි");
  expect(await dates(visible)).toEqual(found);
  release();
  await expect(visible.locator('[data-ceremony="poruwa"] h3')).toHaveText("si poruwa");
  expect(await dates(visible)).toEqual(found);
  await expect(visible.getByRole("button", { name: "වසර 1" })).toHaveAttribute("aria-pressed", "true");
  // The same search again, from the same first day.
  const first = JSON.parse(fixture("wedding-quick-en.json")).first;
  expect(asked[1]).toMatchObject({ lang: "si", months: 12, ceremonies: ["engagement", "poruwa"], as_of: first });

  // Back in English, and after a reload, nothing is searched again.
  await toLanguage(page, "English");
  await expect(page).toHaveURL(/\/en\/porondam/);
  await expect(visible.locator('[data-ceremony="poruwa"] h3')).toHaveText("Poruwa ceremony");
  await page.reload();
  await expect(visible.locator('[data-ceremony="poruwa"] h3')).toHaveText("Poruwa ceremony");
  expect(asked).toHaveLength(2);
});

test("a wedding search the language change interrupted is finished in the new language", async ({ page }) => {
  const asked: string[] = [];
  const section = await openMatch(page);
  await page.route("**/api/v1/wedding-nakath", async (route) => {
    const { lang } = JSON.parse(route.request().postData() ?? "{}");
    asked.push(lang);
    if (lang === "en") return; // still running when the person changes language
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(weddingIn(lang)) });
  });
  await section.getByRole("button", { name: "Find dates" }).click();
  await expect(section.locator("[data-progress]")).toBeVisible();
  await toLanguage(page, "සිංහල");
  await expect(page.locator('[data-card="wedding"]:visible [data-ceremony="poruwa"] h3')).toHaveText("si poruwa");
  expect(asked).toEqual(["en", "si"]);
});

test("the dates stay when getting them in the other language fails, and a failed search is not repeated", async ({ page }) => {
  let fail = false;
  let calls = 0;
  const section = await openMatch(page);
  await page.route("**/api/v1/wedding-nakath", (route) => {
    calls += 1;
    return fail
      ? route.fulfill({ status: 500, body: "" })
      : route.fulfill({ contentType: "application/json", body: fixture("wedding-quick-en.json") });
  });
  await section.getByRole("button", { name: "Find dates" }).click();
  await expect(section.locator("[data-date]").first()).toBeVisible();
  const found = await dates(section);
  fail = true;
  await toLanguage(page, "සිංහල");
  const visible = page.locator('[data-card="wedding"]:visible');
  await expect(visible.getByRole("alert")).toHaveText("සෙවීමට නොහැකි විය. නැවත උත්සාහ කරන්න.");
  await expect(visible).toContainText("මේ දින ඉංග්‍රීසියෙන් පෙන්වා ඇත");
  expect(await dates(visible)).toEqual(found);

  // A new search that fails leaves nothing to bring back on the next visit.
  await visible.getByRole("button", { name: "දින සොයන්න" }).click();
  await expect(visible.getByRole("alert")).toBeVisible();
  const before = calls;
  await page.reload();
  await expect(visible.getByRole("button", { name: "දින සොයන්න" })).toBeEnabled();
  expect(calls).toBe(before);
});

test("another match starts with no wedding dates from the last one", async ({ page }) => {
  const section = await openMatch(page);
  await page.route("**/api/v1/wedding-nakath", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture("wedding-quick-en.json") }),
  );
  await section.getByRole("button", { name: "Find dates" }).click();
  await expect(section.locator("[data-date]").first()).toBeVisible();
  await page.getByRole("button", { name: "Try another match" }).first().click();
  await quickForm(page, "ashwini");
  await page.getByRole("button", { name: "Match the charts" }).click();
  await expect(section.getByRole("button", { name: "Find dates" })).toBeEnabled();
  await expect(section.locator("[data-found]")).toHaveCount(0);
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
  await expect(page.locator('[data-panel="factors"]')).toContainText("11 of 16 agree");
});

test("each way of matching says what it compares, before anything is typed", async ({ page }) => {
  await mockBackend(page, "en", "porondam-quick-en.json");
  await page.goto("/en/porondam");
  const full = page.getByRole("button", { name: /Full birth details/ });
  const quick = page.getByRole("button", { name: /Birth stars only/ });
  await expect(full).toContainText("with Kuja dosha. Needs birth times.");
  await expect(quick).toContainText("When you don't know the birth times. Kuja dosha is left out.");
  await expect(full).toHaveAttribute("aria-pressed", "true");
  await quick.click();
  await expect(quick).toHaveAttribute("aria-pressed", "true");
});

test("the result shows the count and the separate checks side by side, with no verdict", async ({ page }) => {
  await mockBackend(page, "en", "porondam-quick-en.json");
  await page.goto("/en/porondam");
  await quickForm(page);
  await page.getByRole("button", { name: "Match the charts" }).click();

  const factors = page.locator('[data-panel="factors"]');
  const checks = page.locator('[data-panel="checks"]');
  await expect(factors).toContainText("Traditional factors");
  await expect(factors).toContainText("11 of 16 agree");
  await expect(factors).toContainText("2 not counted here");
  await expect(factors).toContainText("not a percentage or a forecast");
  await expect(checks).toContainText("Separate traditional checks");
  await expect(checks).toContainText("Rajju and Vedha");
  await expect(checks).toContainText("apart from the count");
  await expect(page.locator("main")).not.toContainText("%");

  // Every factor is named, with its outcome in words as well as colour.
  await expect(factors.locator("[data-marker]")).toHaveCount(18);
  await expect(factors.getByRole("link", { name: "Graha: Not counted" })).toBeVisible();

  // A factor's link opens its explanation, even when the filter would hide it.
  await page.getByRole("button", { name: "Agree", exact: true }).click();
  await factors.getByRole("link", { name: "Graha: Not counted" }).click();
  await expect(page.locator("#factor-graha")).toBeInViewport();

  await expect(page.getByRole("link", { name: "See why" })).toHaveAttribute("href", "#factors-title");
  await page.getByRole("link", { name: "Find ceremony dates" }).click();
  await expect(page.getByRole("heading", { name: "Wedding nakath for this couple" })).toBeInViewport();
});

test("the wedding card in All tools leads to the wedding dates, through the match (NAV-2)", async ({ page }) => {
  await mockBackend(page, "en", "porondam-quick-en.json");
  await timeline(page, "timeline-quick-en.json");
  await page.goto("/en/tools");
  const card = page.locator('[data-tool="wedding"]');
  await expect(card).toContainText("Two birth stars");
  await card.click();
  await expect(page).toHaveURL(/\/en\/porondam\?for=wedding$/);
  await expect(page.locator("[data-for-wedding]")).toContainText("Birth stars alone are enough.");

  await quickForm(page);
  await page.getByRole("button", { name: "Match the charts" }).click();
  const title = page.getByRole("heading", { name: "Wedding nakath for this couple" });
  await expect(title).toBeInViewport();
  await expect(title).toBeFocused();

  // With a match already in this tab, the card goes straight to the search.
  await page.goto("/en/tools");
  await page.locator('[data-tool="wedding"]').click();
  await expect(title).toBeInViewport();
  await expect(title).toBeFocused();
  // It stays there while the page settles, and lets go when the visitor scrolls.
  await page.waitForTimeout(700);
  await expect(title).toBeInViewport();
  await page.evaluate(() => {
    window.dispatchEvent(new WheelEvent("wheel"));
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("the match page without the wedding link opens at the top, with no wedding note", async ({ page }) => {
  await mockBackend(page, "en", "porondam-quick-en.json");
  await timeline(page, "timeline-quick-en.json");
  await page.goto("/en/porondam");
  await expect(page.locator("[data-for-wedding]")).toHaveCount(0);
  await quickForm(page);
  await page.getByRole("button", { name: "Match the charts" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
});

test("a star match's full report lists what it gains, and a discount code is valid for later", async ({ page }) => {
  const price = { amount: 80_000, currency: "LKR" };
  const body = (value: object) => ({ contentType: "application/json", body: JSON.stringify(value) });
  await mockBackend(page, "en", "porondam-quick-en.json");
  await page.route("**/api/v1/reports/access", (route) =>
    route.fulfill(body({ paid: false, features: [], paid_reports: true, account: "google", price })),
  );
  await page.route("**/api/v1/coupons/apply", (route) => {
    const { code } = route.request().postDataJSON() as { code: string };
    return route.fulfill(
      body(
        code === "pamudu"
          ? { result: "free", percent_off: 100, price, new_price: { ...price, amount: 0 } }
          : { result: "payment_not_available", percent_off: 20, price, new_price: { ...price, amount: 64_000 } },
      ),
    );
  });
  await page.goto("/en/porondam");
  await quickForm(page);
  await page.getByRole("button", { name: "Match the charts" }).click();

  const form = page.locator('[data-card="full-report"]');
  await expect(form.locator("li")).toHaveText([
    "The full AI reading, from the two birth stars",
    "Explain buttons on every main place",
    "The full PDF with the AI reading",
    "Kept in your account, on any device",
  ]);

  await form.getByRole("button", { name: "Have a coupon?" }).click();
  const code = form.getByLabel("Coupon code");
  await code.fill("SIDERA20");
  await form.getByRole("button", { name: "Apply" }).click();
  await expect(form).toContainText("20% off: LKR 640 for this report.");
  await expect(form).toContainText("This code is valid");
  await expect(form).toContainText("it will work once payment opens");
  await expect(form.locator("[data-unlock]")).toHaveCount(0);

  await form.getByRole("button", { name: "Use another code" }).click();
  await expect(code).toBeFocused();
  await expect(code).toHaveValue("");
  await expect(form.locator("[data-price]")).toContainText("LKR 800");
  await code.fill("pamudu");
  await form.getByRole("button", { name: "Apply" }).click();
  await expect(form.getByRole("button", { name: "Unlock free" })).toBeVisible();
});

async function fullForm(page: Page) {
  for (const [role, date] of [["Bride", "1995-04-19"], ["Groom", "1992-08-03"]]) {
    const card = page.getByRole("group", { name: role });
    await card.getByLabel("Date of birth").fill(date);
    await card.getByLabel("Time of birth").fill("10:00");
    await card.getByRole("combobox").fill("kandy");
    await card.getByRole("option").first().click();
  }
}

const submitMatch = (page: Page) => page.getByRole("button", { name: "Match the charts" }).click();
const person = (page: Page, name: string) => page.getByRole("group", { name });

test("a match from full birth details asks that both adults agreed", async ({ page }) => {
  const requests = await mockBackend(page, "en", "porondam-full-en.json");
  await page.goto("/en/porondam");
  await fullForm(page);
  const consent = page.getByRole("checkbox", { name: /both have agreed/ });
  await expect(consent).not.toHaveAttribute("aria-invalid", "true");
  await submitMatch(page);
  await expect(consent).toBeFocused();
  await expect(consent).toHaveAttribute("aria-invalid", "true");
  await expect(consent).toHaveAccessibleDescription(/Please confirm this before matching/);
  expect(requests).toHaveLength(0);

  // Who cannot confirm is taken to the birth stars, which need no confirmation.
  await page.getByRole("button", { name: "Match birth stars instead" }).click();
  await expect(page.locator('[data-mode="quick"]')).toBeFocused();
  await expect(consent).toHaveCount(0);

  await page.getByRole("button", { name: /Full birth details/ }).click();
  await consent.check();
  await expect(page.getByText("Please confirm this before matching")).toHaveCount(0);
  await submitMatch(page);
  await expect(page.locator('[data-panel="factors"]')).toContainText("9 of 18 agree");
  // Asked again for the next match.
  await page.getByRole("button", { name: "Try another match" }).first().click();
  await expect(consent).not.toBeChecked();
});

test("the confirmation is in Sinhala on the Sinhala page", async ({ page }) => {
  await mockBackend(page, "si", "porondam-full-si.json");
  await page.goto("/si/porondam");
  await expect(page.getByRole("checkbox", { name: /දෙදෙනාම එකඟ වී සිටිති/ })).toBeVisible();
  await page.getByRole("button", { name: "ඒ වෙනුවට උපන් නැකත් ගළපන්න" }).click();
  await expect(page.locator('[data-mode="quick"]')).toHaveAttribute("aria-pressed", "true");
});

test("what was typed for both people survives a change of language and a reload, in both modes", async ({ page }) => {
  await mockBackend(page, "en", "porondam-quick-en.json");
  await page.route("**/api/v1/labels/si", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture("labels-si.json") }),
  );
  await page.goto("/en/porondam");
  await fullForm(page);
  await quickForm(page);

  await toLanguage(page, "සිංහල");
  await expect(page).toHaveURL(/\/si\/porondam/);
  const bride = page.getByRole("group", { name: "මනාලිය" });
  await expect(page.locator('[data-mode="quick"]:visible')).toHaveAttribute("aria-pressed", "true");
  await expect(bride.locator("select").first()).toHaveValue("anuradha");
  await bride.getByRole("textbox").first().fill("Nirmala");
  await page.locator('[data-mode="full"]:visible').click();
  await expect(page.getByRole("group", { name: "මනාලයා" }).locator('input[type="date"]')).toHaveValue("1992-08-03");
  await expect(bride.getByRole("combobox")).toHaveValue(/./);

  // Back in English, the page takes up what was typed in Sinhala, not its own older values.
  await toLanguage(page, "English");
  await expect(page).toHaveURL(/\/en\/porondam/);
  await expect(page.locator('[data-mode="full"]:visible')).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-mode="quick"]:visible').click();
  await expect(person(page, "Bride").getByLabel(/Name/)).toHaveValue("Nirmala");
  await page.reload();
  await expect(person(page, "Bride").getByLabel(/Name/)).toHaveValue("Nirmala");
  await expect(person(page, "Groom").getByLabel("Birth star (nakath)")).toHaveValue("rohini");
});

test("the draft goes when a match is made, and Try another match keeps the details through a reload", async ({ page }) => {
  await mockBackend(page, "en", "porondam-quick-en.json");
  await page.goto("/en/porondam");
  await quickForm(page);
  const draft = () => page.evaluate(() => sessionStorage.getItem("astronomia.porondam.draft"));
  expect(await draft()).toContain("anuradha");
  await submitMatch(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nimali and Kasun");
  expect(await draft()).toBeNull();
  await page.reload();
  await page.getByRole("button", { name: "Try another match" }).first().click();
  await page.reload();
  await expect(person(page, "Bride").getByLabel("Birth star (nakath)")).toHaveValue("anuradha");
  await expect(person(page, "Groom").getByLabel(/Name/)).toHaveValue("Kasun");
});

test("a match made from a star link survives a reload, and a new star link starts a new match", async ({ page }) => {
  await mockBackend(page, "en", "porondam-quick-en.json");
  await page.goto("/en/porondam?bride=anuradha.2&groom=rohini.1");
  await submitMatch(page);
  await expect(page.locator('[data-panel="factors"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-panel="factors"]')).toBeVisible();

  await page.goto("/en/porondam?bride=krittika.2&groom=hasta.1");
  await expect(person(page, "Bride").getByLabel("Birth star (nakath)")).toHaveValue("krittika");
  await expect(page.locator('[data-panel="factors"]')).toHaveCount(0);
});

test("a finished match stays when the backend does not answer after a reload", async ({ page }) => {
  await mockBackend(page, "en", "porondam-quick-en.json");
  await page.goto("/en/porondam");
  await quickForm(page);
  await submitMatch(page);
  await expect(page.locator('[data-panel="factors"]')).toBeVisible();
  await page.route("**/api/v1/porondam", (route) => route.fulfill({ status: 503, body: "" }));
  await page.reload();
  await expect(page.locator('[data-panel="factors"]')).toContainText("11 of 16 agree");
});

test("the match form recovers when its names cannot be loaded, keeping what was typed", async ({ page }) => {
  await mockBackend(page, "en", "porondam-quick-en.json");
  await page.route("**/api/v1/labels/*", (route) => route.fulfill({ status: 503, body: "" }));
  await page.goto("/en/porondam");
  const alert = page.locator("form").getByRole("alert");
  await expect(alert).toContainText("What you typed is kept.");
  await quickForm(page);
  await expect(page.getByRole("button", { name: "Match the charts" })).toBeDisabled();
  await page.route("**/api/v1/labels/*", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture("labels-en.json") }),
  );
  await alert.getByRole("button", { name: "Try again" }).click();
  await expect(alert).toHaveCount(0);
  await expect(person(page, "Bride").getByLabel(/Name/)).toHaveValue("Nimali");
  await submitMatch(page);
  await expect(page.locator('[data-panel="factors"]')).toBeVisible();
});

test("a match refuses a birth date still to come", async ({ page }) => {
  const requests = await mockBackend(page, "en", "porondam-full-en.json");
  await page.goto("/en/porondam");
  await fullForm(page);
  await page.locator("#match-consent").check();
  const date = person(page, "Groom").getByLabel("Date of birth");
  await date.fill("2199-01-01");
  await submitMatch(page);
  await expect(date).toBeFocused();
  await expect(date).toHaveAccessibleDescription("Date of birth cannot be in the future.");
  expect(requests).toHaveLength(0);
});

test("the couple's road holds its place while it loads, and can be tried again", async ({ page }) => {
  await mockBackend(page, "en", "porondam-full-en.json");
  await timeline(page, "timeline-full-en.json");
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  let calls = 0;
  await page.route("**/api/v1/journey/couple", async (route) => {
    calls += 1;
    if (calls === 1) await held;
    await route.fulfill({ status: 503, body: "" });
  });
  await page.goto("/en/porondam");
  await fullForm(page);
  await page.locator("#match-consent").check();
  await submitMatch(page);
  const road = page.locator('[data-section="couple-road"]');
  await expect(road).toHaveAttribute("data-status", "loading");
  expect((await road.boundingBox())!.height).toBeGreaterThan(600);
  release();
  await expect(road).toContainText("We could not load this section.");
  await road.getByRole("button", { name: "Try again" }).click();
  await expect.poll(() => calls).toBe(2);
});
