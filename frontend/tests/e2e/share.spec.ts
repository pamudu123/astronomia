import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type Page, expect, test } from "@playwright/test";

/** The backend is not running in these tests: its answers are saved real responses. */
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf-8");
const json = (name: string) => ({ contentType: "application/json", body: fixture(name) });

const CODE = "k7Qm2xVd9RtYp3LwZs8aBc";
const TOKEN = "delete-token-for-tests-0123456789";

async function mockBackend(page: Page, lang: "en" | "si") {
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
  await expect(dialog.locator("[data-share-preview]")).toContainText("Nimali's birth chart");
  await expect(dialog).toContainText("Nothing is saved before you press Create link");
  expect(created).toHaveLength(0);

  await dialog.getByRole("button", { name: "Create link" }).click();
  const link = dialog.getByLabel("Link");
  await expect(link).toHaveValue(new RegExp(`/en/s/${CODE}$`));
  expect(JSON.parse(created[0])).toMatchObject({
    kind: "hadahan",
    name: "Nimali",
    hide_names: false,
    birth: { date: "1995-04-19", time: "14:35", lang: "en" },
  });

  const whatsapp = dialog.getByRole("link", { name: "Send on WhatsApp" });
  const href = (await whatsapp.getAttribute("href")) ?? "";
  expect(href).toContain("https://wa.me/?text=");
  expect(decodeURIComponent(href)).toContain(`/en/s/${CODE}`);
  expect(href).not.toContain("1995");
  await expect(dialog).toContainText("Open until 12 December 2026");

  await dialog.getByRole("button", { name: "Copy" }).click();
  await expect(dialog.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(new RegExp(`/en/s/${CODE}$`));
});

test("hidden names leave the names out", async ({ page }) => {
  const { created } = await mockBackend(page, "en");
  await showHadahan(page);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Hide names on the shared page").check();
  await expect(dialog.locator("[data-share-preview]")).toContainText("A hadahan");
  await dialog.getByRole("button", { name: "Create link" }).click();
  await expect(dialog.getByLabel("Link")).toBeVisible();
  expect(JSON.parse(created[0])).toMatchObject({ hide_names: true });
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
  await expect(dialog.locator("[data-share-preview]")).toContainText("Nimali and Kasun");
  await expect(dialog.locator("[data-share-preview]")).toContainText("11 of 16 factors agree");
  await dialog.getByRole("button", { name: "Create link" }).click();
  await expect(dialog.getByLabel("Link")).toHaveValue(new RegExp(`/en/s/${CODE}$`));
  expect(JSON.parse(created[0])).toMatchObject({
    kind: "porondam",
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
