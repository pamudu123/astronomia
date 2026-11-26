import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type Page, expect, test } from "@playwright/test";

import { openAccess } from "./access";

/** The backend is not running in these tests: its answers are saved real responses. */
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf-8");
const json = (name: string) => ({ contentType: "application/json", body: fixture(name) });

const CODE = "k7Qm2xVd9RtYp3LwZs8aBc";
const TOKEN = "delete-token-for-tests-0123456789";

async function mockBackend(page: Page, lang: "en" | "si") {
  await openAccess(page);
  await page.route("**/api/v1/labels/*", (route) => route.fulfill(json(`labels-${lang}.json`)));
  await page.route("**/api/v1/places?*", (route) => route.fulfill(json("places-kandy.json")));
  await page.route("**/api/v1/time/resolve", (route) => route.fulfill(json("time-kandy.json")));
  await page.route("**/api/v1/hadahan", (route) => route.fulfill(json(`hadahan-${lang}.json`)));
  await page.route("**/api/v1/forecast", (route) => route.fulfill(json(`forecast-${lang}.json`)));
  await page.route("**/api/v1/porondam", (route) => route.fulfill(json("porondam-quick-en.json")));
  const created: string[] = [];
  await page.route("**/api/v1/shares", (route) => {
    created.push(route.request().postData() ?? "");
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ code: CODE, delete_token: TOKEN, expires_at: "2026-12-12T08:00:00Z" }),
    });
  });
  const deleted: (string | null)[] = [];
  await page.route(`**/api/v1/shares/${CODE}*`, (route) => {
    if (route.request().method() === "DELETE") {
      deleted.push(route.request().headers()["x-delete-token"] ?? null);
      return route.fulfill({ status: 204, body: "" });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  return { created, deleted };
}

async function showHadahan(page: Page) {
  await page.goto("/en/hadahan");
  await page.getByLabel(/Name/).fill("Nimali");
  await page.getByLabel("Date of birth").fill("1995-04-19");
  await page.getByLabel("Time of birth").fill("14:35");
  await page.getByRole("combobox").fill("kandy");
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Show my hadahan" }).click();
  await expect(page.locator('[data-card="lagna"]')).toBeVisible();
}

const FIELDS_LEAD =
  "Anyone with the link can see and forward the fields below for up to 30 days. Revoking the link stops future access. It cannot recall copies.";
const SEPARATE =
  "A saved report and its share links are separate. Deleting the report does not delete the link, and deleting the link does not delete the report.";

test("a hadahan is shared only after Create link, and the link holds no birth details", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const { created } = await mockBackend(page, "en");
  await showHadahan(page);

  await page.getByRole("button", { name: "Share", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Share this result" });
  await expect(dialog).toBeVisible();
  // Names and birth details are hidden until the sender turns them on.
  await expect(dialog.locator("[data-share-preview]")).toContainText("A hadahan");
  await expect(dialog.locator("[data-share-preview]")).not.toContainText("Nimali");
  const fields = dialog.locator("[data-share-fields]");
  await expect(fields).toContainText(FIELDS_LEAD);
  await expect(fields.locator('[data-share-field="names"]')).toHaveText("NameHidden");
  await expect(fields.locator('[data-share-field="birth"]')).toHaveText("Birth date, time and placeHidden");
  await expect(fields).toContainText("Life periods (dasha) with their dates");
  await expect(fields).toContainText("The kuja dosha (Mars) check");
  await expect(fields).not.toContainText("Nimali");
  await expect(fields).not.toContainText("1995");
  await expect(dialog.getByLabel("Show names")).not.toBeChecked();
  await expect(dialog.getByLabel("Show birth date, time and place")).not.toBeChecked();
  await expect(dialog).toContainText("Nothing is saved before you press Create link");
  await expect(dialog.locator("[data-share-separate]")).toHaveText(SEPARATE);
  expect(created).toHaveLength(0);

  await dialog.getByRole("button", { name: "Create link" }).click();
  const link = dialog.getByRole("textbox", { name: "Link" });
  await expect(link).toHaveValue(new RegExp(`/en/s/${CODE}$`));
  // The birth details go to the server to work the chart out again; it keeps only what is shown.
  expect(JSON.parse(created[0])).toMatchObject({
    kind: "hadahan",
    show_names: false,
    show_birth: false,
    birth: { date: "1995-04-19", time: "14:35", lang: "en" },
  });

  const whatsapp = dialog.getByRole("link", { name: "Send on WhatsApp" });
  const href = (await whatsapp.getAttribute("href")) ?? "";
  expect(href).toContain("https://wa.me/?text=");
  expect(decodeURIComponent(href)).toContain(`/en/s/${CODE}`);
  expect(href).not.toContain("1995");
  expect(href).not.toContain("Nimali");
  await expect(dialog).toContainText("Open until 12 December 2026");

  await dialog.getByRole("button", { name: "Copy" }).click();
  await expect(dialog.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(new RegExp(`/en/s/${CODE}$`));
});

test("the sender can choose to show names and birth details, and sees them first", async ({ page }) => {
  const { created } = await mockBackend(page, "en");
  await showHadahan(page);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const fields = dialog.locator("[data-share-fields]");

  await dialog.getByLabel("Show names").check();
  await expect(dialog.locator("[data-share-preview]")).toContainText("Nimali's birth chart");
  await expect(fields.locator('[data-share-field="names"]')).toHaveText("NameNimali");
  await expect(fields.locator('[data-share-field="birth"]')).toContainText("Hidden");

  await dialog.getByLabel("Show birth date, time and place").check();
  const birth = fields.locator('[data-share-field="birth"]');
  await expect(birth).toContainText("19 April 1995");
  await expect(birth).toContainText("14:35");
  await expect(birth).toContainText("Kandy");

  await dialog.getByRole("button", { name: "Create link" }).click();
  await expect(dialog.getByRole("textbox", { name: "Link" })).toBeVisible();
  expect(JSON.parse(created[0])).toMatchObject({ show_names: true, show_birth: true });
  // The choices are made: what the link shows stays listed, without the switches.
  await expect(dialog.getByLabel("Show names")).toHaveCount(0);
  await expect(fields.locator('[data-share-field="names"]')).toHaveText("NameNimali");
});

test("a new link can be deleted from the dialog", async ({ page }) => {
  const { deleted } = await mockBackend(page, "en");
  await showHadahan(page);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Create link" }).click();
  await dialog.getByRole("button", { name: "Delete this link" }).click();
  await expect(dialog.getByRole("status")).toHaveText("The link is deleted. Nobody can open it now.");
  expect(deleted).toEqual([TOKEN]);
});

test("a match can be shared", async ({ page }) => {
  const { created } = await mockBackend(page, "en");
  await page.goto("/en/porondam");
  await page.getByRole("button", { name: "Birth stars only" }).click();
  const bride = page.getByRole("group", { name: "Bride" });
  await bride.getByLabel(/Name/).fill("Nimali");
  await bride.getByLabel("Birth star (nakath)").selectOption("anuradha");
  await bride.getByLabel("Pada").selectOption("2");
  const groom = page.getByRole("group", { name: "Groom" });
  await groom.getByLabel(/Name/).fill("Kasun");
  await groom.getByLabel("Birth star (nakath)").selectOption("rohini");
  await page.getByRole("button", { name: "Match the charts" }).click();

  await page.getByRole("button", { name: "Share", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("[data-share-preview]")).toContainText("A porondam match");
  await expect(dialog.locator("[data-share-preview]")).toContainText("13 of 18 factors agree");
  const fields = dialog.locator("[data-share-fields]");
  await expect(fields).toContainText(FIELDS_LEAD);
  await expect(fields.locator('[data-share-field="names"]')).toHaveText("NamesHidden");
  // A match page never shows birth dates, times or places, so there is nothing to turn on.
  await expect(fields.locator('[data-share-field="birth"]')).toHaveText("Birth date, time and placeNot included");
  await expect(dialog.getByLabel("Show birth date, time and place")).toHaveCount(0);
  await dialog.getByLabel("Show names").check();
  await expect(fields.locator('[data-share-field="names"]')).toHaveText("NamesNimali and Kasun");
  await expect(dialog.locator("[data-share-preview]")).toContainText("Nimali and Kasun");
  await dialog.getByRole("button", { name: "Create link" }).click();
  await expect(dialog.getByRole("textbox", { name: "Link" })).toHaveValue(new RegExp(`/en/s/${CODE}$`));
  expect(JSON.parse(created[0])).toMatchObject({
    kind: "porondam",
    show_names: true,
    show_birth: false,
    match: { bride: { nakshatra: "anuradha", pada: 2 }, groom: { nakshatra: "rohini" }, lang: "en" },
  });
});

test("the shared hadahan opens read only", async ({ page }) => {
  await page.route("**/api/v1/labels/*", (route) => route.fulfill(json("labels-en.json")));
  await page.route(`**/api/v1/shares/${CODE}?lang=en`, (route) => route.fulfill(json("share-hadahan-en.json")));
  await page.goto(`/en/s/${CODE}`);

  const banner = page.locator("[data-share-banner]");
  await expect(banner).toContainText("Shared result");
  await expect(banner).toContainText("Open until 12 December 2026");
  await expect(banner.getByRole("link", { name: "Make your own hadahan" })).toBeVisible();
  await expect(banner.getByRole("button", { name: "Delete this link" })).toHaveCount(0);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nimali's birth chart");
  await expect(page.locator('[data-card="lagna"]')).toContainText("Simha");
  await expect(page.locator('[data-card="kuja"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Download PDF" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Share", exact: true })).toHaveCount(0);
  await expect(page.locator('[data-card="forecast"]')).toHaveCount(0);
});

test("a shared hadahan with hidden details shows no name, date, time or place", async ({ page }) => {
  const shared = JSON.parse(fixture("share-hadahan-en.json"));
  shared.names_hidden = true;
  shared.birth_hidden = true;
  Object.assign(shared.hadahan, { name: "", date: null, time: null, place: null });
  shared.hadahan.result.time = null;
  Object.assign(shared.hadahan.result.chart, { utc: null, latitude: null, longitude: null });
  shared.hadahan.result.dasha.balance_years = null;
  await page.route("**/api/v1/labels/*", (route) => route.fulfill(json("labels-en.json")));
  await page.route(`**/api/v1/shares/${CODE}?lang=en`, (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(shared) }),
  );
  await page.goto(`/en/s/${CODE}`);
  await expect(page.locator('[data-card="lagna"]')).toContainText("Simha");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("A hadahan");
  await expect(page.locator('[data-card="details"]')).toHaveCount(0);
  const text = await page.locator("main").innerText();
  for (const hidden of ["Nimali", "1995", "14:35", "Kandy"]) expect(text).not.toContain(hidden);
});

test("share pages are not indexed, not cached and send no referrer", async ({ page }) => {
  await page.route("**/api/v1/labels/*", (route) => route.fulfill(json("labels-en.json")));
  await page.route(`**/api/v1/shares/${CODE}?lang=en`, (route) => route.fulfill(json("share-hadahan-en.json")));
  const response = await page.goto(`/en/s/${CODE}`);
  const headers = response!.headers();
  expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
  expect(headers["cache-control"]).toContain("no-store");
  expect(headers["cache-control"]).toContain("private");
  expect(headers["cache-control"]).not.toContain("public");
  expect(headers["cache-control"]).not.toContain("s-maxage");
  expect(headers["referrer-policy"]).toBe("no-referrer");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
  // The link preview never names anyone, even on a page that shows names.
  await expect(page.locator('meta[property="og:title"]')).not.toHaveAttribute("content", /Nimali/);
});

test("the shared match opens in Sinhala", async ({ page }) => {
  await page.route("**/api/v1/labels/*", (route) => route.fulfill(json("labels-si.json")));
  await page.route(`**/api/v1/shares/${CODE}?lang=si`, (route) => route.fulfill(json("share-porondam-si.json")));
  await page.goto(`/si/s/${CODE}`);
  await expect(page.locator("[data-share-banner]")).toContainText("බෙදාගත් ප්‍රතිඵලය");
  await expect(page.locator('[data-factor="dina"]')).toContainText("නැකත්");
  await expect(page.getByRole("link", { name: "ඔබේම ගැළපීමක් කරන්න" }).first()).toBeVisible();
});

test("the device that shared can delete from the shared page", async ({ page }) => {
  await page.addInitScript(
    ([code, token]) => localStorage.setItem(`astronomia.share.${code}`, token),
    [CODE, TOKEN],
  );
  await page.route("**/api/v1/labels/*", (route) => route.fulfill(json("labels-en.json")));
  const deleted: (string | null)[] = [];
  await page.route(`**/api/v1/shares/${CODE}*`, (route) => {
    if (route.request().method() === "DELETE") {
      deleted.push(route.request().headers()["x-delete-token"] ?? null);
      return route.fulfill({ status: 204, body: "" });
    }
    return route.fulfill(json("share-hadahan-en.json"));
  });
  await page.goto(`/en/s/${CODE}`);
  await page.locator("[data-share-banner]").getByRole("button", { name: "Delete this link" }).click();
  await expect(page.locator("[data-share-gone]")).toContainText("The link is deleted");
  expect(deleted).toEqual([TOKEN]);
  expect(await page.evaluate((code) => localStorage.getItem(`astronomia.share.${code}`), CODE)).toBeNull();
});

test("an expired or deleted link says so", async ({ page }) => {
  await page.route("**/api/v1/labels/*", (route) => route.fulfill(json("labels-en.json")));
  await page.route(`**/api/v1/shares/${CODE}*`, (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: "{}" }),
  );
  await page.goto(`/en/s/${CODE}`);
  const gone = page.locator("[data-share-gone]");
  await expect(gone.getByRole("heading", { name: "This link has expired or was deleted" })).toBeVisible();
  await expect(gone.getByRole("link", { name: "Make a hadahan" })).toBeVisible();
});
