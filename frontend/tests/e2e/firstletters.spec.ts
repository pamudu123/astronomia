import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type Page, expect, test } from "@playwright/test";

/** The backend is not running in these tests: its answers are saved real responses. */
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf-8");

async function mockBackend(page: Page, answer: string) {
  const posted: string[] = [];
  await page.route("**/api/v1/first-letters", (route) => {
    posted.push(route.request().postData() ?? "");
    return route.fulfill({ contentType: "application/json", body: fixture(answer) });
  });
  await page.route("**/api/v1/places?*", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture("places-kandy.json") }),
  );
  await page.route("**/api/v1/time/resolve", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture("time-kandy.json") }),
  );
  return posted;
}

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

const consentBox = (page: Page) =>
  page.getByRole("checkbox", { name: /(parent or legal guardian|නීත්‍යානුකූල භාරකරු)/ });

test("dates for a child from birth details, sent in a POST", async ({ page }) => {
  const posted = await mockBackend(page, "first-letters-full-en.json");
  await page.goto("/en/first-letters");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("First letters ceremony nakath");
  await noSidewaysScroll(page);

  const child = page.locator('[data-card="first-letters-child"]');
  await consentBox(page).check();
  await child.getByRole("textbox", { name: "Date of birth" }).fill("2023-05-10");
  await child.getByRole("textbox", { name: "Time of birth" }).fill("08:15");
  await child.getByRole("combobox").fill("kandy");
  await page.getByRole("option").first().click();
  await child.getByRole("button", { name: "Use these details" }).click();
  await expect(child.locator('[data-child="full"]')).toContainText("Born 2023-05-10 at 08:15");

  const search = page.locator('[data-card="first-letters"]');
  await search.getByRole("button", { name: "6 months" }).click();
  await search.getByRole("button", { name: "Find dates", exact: true }).click();
  const result = search.locator('[data-card="first-letters-result"]');
  await expect(result).toContainText("For a child born in Purva Ashadha.");
  await expect(result).toContainText("Times are in Colombo (UTC+05:30).");
  await expect(result.locator("[data-date]")).toHaveCount(4);
  const first = result.locator('[data-date="2027-01-15"]');
  await expect(first).toContainText("10:13 to");
  await expect(first).toContainText("The child will be 3 years and 8 months old.");
  await first.getByText("Why this time").click();
  await expect(first).toContainText("is one of the nakathas for first letters.");
  await expect(first).toContainText("a good tara.");

  const body = JSON.parse(posted[0]);
  expect(body).toMatchObject({ child: { date: "2023-05-10", time: "08:15" }, guardian_consent: true, months: 6, lang: "en" });
  expect(page.url()).not.toContain("2023");
  await noSidewaysScroll(page);
});

test("dates from a birth star only, in Sinhala", async ({ page }) => {
  const posted = await mockBackend(page, "first-letters-star-si.json");
  await page.goto("/si/first-letters");
  const child = page.locator('[data-card="first-letters-child"]');
  await child.getByRole("button", { name: "උපන් නැකත පමණි" }).click();
  await child.getByLabel("උපන් නැකත").selectOption("ashwini");
  await child.getByLabel(/උපන් දිනය/).fill("2023-05-10");
  const search = page.locator('[data-card="first-letters"]');
  // A birth date is a birth detail, so it needs consent too.
  await search.getByRole("button", { name: "දින සොයන්න", exact: true }).click();
  await expect(consentBox(page)).toBeFocused();
  expect(posted).toHaveLength(0);
  await consentBox(page).check();
  await search.getByRole("button", { name: "දින සොයන්න", exact: true }).click();
  const result = search.locator('[data-card="first-letters-result"]');
  await expect(result).toContainText("අස්විද නැකතින් උපන් දරුවෙකු සඳහා.");
  await expect(result.locator("[data-date]")).toHaveCount(8);
  await expect(result.locator('[data-date="2026-12-04"]')).toContainText("07:06");
  expect(JSON.parse(posted[0])).toMatchObject({
    child: { nakshatra: "ashwini", pada: 1 },
    birth_date: "2023-05-10",
    guardian_consent: true,
    months: 3,
    lang: "si",
  });
  await noSidewaysScroll(page);
});

test("the search asks for the child first", async ({ page }) => {
  await mockBackend(page, "first-letters-full-en.json");
  await page.goto("/en/first-letters");
  const search = page.locator('[data-card="first-letters"]');
  await consentBox(page).check();
  await search.getByRole("button", { name: "Find dates", exact: true }).click();
  await expect(search.getByRole("alert")).toHaveText("Enter the child's birth details, or choose a birth star.");
});

test("the page carries a title and description as served", async ({ request }) => {
  const html = await (await request.get("/si/first-letters")).text();
  expect(html).toContain("<title>අකුරු කියවීමේ නැකත් · Sidera</title>");
  expect(html).toContain('<link rel="canonical" href="http://localhost:3000/si/first-letters"/>');
});

test("the two ways to give the child wait for the page, so a press is never lost (NAV-5)", async ({ page }) => {
  await mockBackend(page, "first-letters-full-en.json");
  let release = () => {};
  const scripts = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/_next/static/chunks/**/*.js", async (route) => {
    await scripts;
    await route.continue();
  });
  await page.goto("/en/first-letters", { waitUntil: "commit" });
  const star = page.getByRole("button", { name: "Birth star only" });
  await expect(star).toBeDisabled();
  release();
  // The press waits until the button is ready, and then works the first time.
  await star.click();
  await expect(star).toHaveAttribute("aria-pressed", "true");
});

for (const lang of ["en", "si"] as const) {
  test(`no birth details leave the page without a guardian's consent (${lang})`, async ({ page }) => {
    const posted = await mockBackend(page, "first-letters-full-en.json");
    const sent: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") sent.push(`${request.url()} ${request.postData() ?? ""}`);
    });
    const words = {
      en: { use: "Use these details", find: "Find dates", change: "Change", error: /Tick this box to continue/ },
      si: { use: "මෙම විස්තර භාවිත කරන්න", find: "දින සොයන්න", change: "වෙනස් කරන්න", error: /මෙම කොටුව ලකුණු කරන්න/ },
    }[lang];
    await page.goto(`/${lang}/first-letters`);
    const box = consentBox(page);
    const child = page.locator('[data-card="first-letters-child"]');
    const search = page.locator('[data-card="first-letters"]');
    await expect(box).not.toBeChecked();
    await expect(child.locator('input[type="text"][maxlength="60"]')).toHaveCount(0);

    await child.locator('input[type="date"]').fill("2023-05-10");
    await child.locator('input[type="time"]').fill("08:15");
    await child.getByRole("combobox").fill("kandy");
    await page.getByRole("option").first().click();
    await child.getByRole("button", { name: words.use }).click();
    await expect(box).toBeFocused();
    await expect(box).toHaveAccessibleDescription(words.error);
    expect(sent.filter((line) => line.includes("2023-05-10"))).toEqual([]);

    await box.check();
    await child.getByRole("button", { name: words.use }).click();
    await expect(child.locator('[data-child="full"]')).toBeVisible();
    // Withdrawn before the search: nothing is sent.
    await box.uncheck();
    await search.getByRole("button", { name: words.find, exact: true }).click();
    await expect(box).toBeFocused();
    expect(posted).toHaveLength(0);

    await box.check();
    await search.getByRole("button", { name: words.find, exact: true }).click();
    const result = search.locator('[data-card="first-letters-result"]');
    await expect(result).toBeVisible();
    expect(posted).toHaveLength(1);
    // No AI, share or save on a child's result.
    await expect(result.getByRole("button")).toHaveCount(0);
    // Another child needs consent again.
    await child.getByRole("button", { name: words.change }).click();
    await expect(box).not.toBeChecked();
  });
}

test("a birth star alone needs no consent", async ({ page }) => {
  const posted = await mockBackend(page, "first-letters-star-si.json");
  await page.goto("/en/first-letters");
  await page.getByRole("button", { name: "Birth star only" }).click();
  await expect(consentBox(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Find dates", exact: true }).click();
  await expect(page.locator('[data-card="first-letters-result"]')).toBeVisible();
  expect(JSON.parse(posted[0])).not.toHaveProperty("guardian_consent");
});
