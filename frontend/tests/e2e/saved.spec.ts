import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type Page, expect, test } from "@playwright/test";

import { GOOGLE_EMAIL, SUPABASE, standInSupabase } from "./supabase";

/** The backend is not running in these tests: its answers are saved real responses. */
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf-8");
const json = (name: string) => ({ contentType: "application/json", body: fixture(name) });
const reply = (status: number, body: unknown, headers: Record<string, string> = {}) => ({
  status,
  contentType: "application/json",
  headers,
  body: JSON.stringify(body),
});

const ID = "3f1c9a52-7d4e-4b0a-9c55-0e6f2b1a8d10";
const MATCH_ID = "8a2d4f6e-1b3c-4d5e-8f70-123456789abc";
const SAVED_AT = "2026-11-15T08:00:00Z";
const HINT = "sidera_saved=1; Path=/; SameSite=Lax";

const hadahanItem = {
  id: ID,
  kind: "hadahan",
  title: "",
  created_at: SAVED_AT,
  hadahan: { name: "Nimali", date: "1995-04-19", lagna: "simha", rashi: "vrischika", nakshatra: "jyeshtha" },
  porondam: null,
};
const matchItem = {
  id: MATCH_ID,
  kind: "porondam",
  title: "",
  created_at: SAVED_AT,
  hadahan: null,
  porondam: { bride: "Nimali", groom: "Kasun", passed: 11, total: 16, mode: "quick" },
};

async function mockTools(page: Page) {
  await page.route("**/api/v1/labels/*", (route) => route.fulfill(json("labels-en.json")));
  await page.route("**/api/v1/places?*", (route) => route.fulfill(json("places-kandy.json")));
  await page.route("**/api/v1/time/resolve", (route) => route.fulfill(json("time-kandy.json")));
  await page.route("**/api/v1/hadahan", (route) => route.fulfill(json("hadahan-en.json")));
  await page.route("**/api/v1/forecast", (route) => route.fulfill(json("forecast-en.json")));
  await page.route("**/api/v1/porondam", (route) => route.fulfill(json("porondam-quick-en.json")));
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

test("a hadahan is saved quietly as a guest, and My reports appears", async ({ page }) => {
  await mockTools(page);
  const supabase = await standInSupabase(page);
  const posted: string[] = [];
  const tokens: (string | null)[] = [];
  let answer = 201;
  await page.route("**/api/v1/saved", async (route) => {
    posted.push(route.request().postData() ?? "");
    tokens.push(await route.request().headerValue("x-sidera-token"));
    const created = answer === 201;
    answer = 200;
    return route.fulfill(reply(created ? 201 : 200, { ...hadahanItem, created }, { "set-cookie": HINT }));
  });
  await showHadahan(page);

  // Nothing about accounts happens before Save: no sign in, no Google.
  await expect(page.locator("[data-my-reports]")).toHaveCount(0);
  await expect(page.locator("[data-google]")).toHaveCount(0);
  expect(posted).toHaveLength(0);
  expect(supabase.calls).toEqual([]);

  const save = page.locator("[data-save]");
  await save.getByRole("button", { name: "Save" }).click();
  await expect(save.getByRole("button", { name: "Saved" })).toBeDisabled();
  await expect(save.getByRole("status")).toContainText("Saved to My reports.");
  expect(JSON.parse(posted[0])).toMatchObject({
    kind: "hadahan",
    name: "Nimali",
    birth: { date: "1995-04-19", time: "14:35", lang: "en" },
  });
  // The first Save signed this browser in as a guest, and the save carried its token.
  expect(supabase.guests()).toBe(1);
  expect(tokens[0]).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);

  // The header now offers My reports, on phones too.
  await expect(page.locator("[data-my-reports]")).toBeVisible();
  await save.getByRole("link", { name: "Open My reports" }).click();
  await expect(page).toHaveURL(/\/en\/my$/);
});

test("two tabs saving at once share one guest", async ({ context }) => {
  const supabase = await standInSupabase(context);
  const tabs = [await context.newPage(), await context.newPage()];
  for (const tab of tabs) {
    await mockTools(tab);
    await showHadahan(tab);
  }
  // The first save is held open; a second save sent meanwhile would sign in a second guest.
  const tokens: (string | null)[] = [];
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await context.route("**/api/v1/saved", async (route) => {
    tokens.push(await route.request().headerValue("x-sidera-token"));
    if (tokens.length === 1) await held;
    return route.fulfill(reply(201, { ...hadahanItem, created: true }));
  });

  for (const tab of tabs) await tab.locator("[data-save]").getByRole("button", { name: "Save" }).click();
  await expect.poll(() => tokens.length).toBe(1);
  await tabs[1].waitForTimeout(300);
  expect(tokens).toHaveLength(1); // the second tab waits for the first answer
  release();
  await expect.poll(() => tokens.length).toBe(2);
  expect(tokens[1]).toBe(tokens[0]);
  expect(supabase.guests()).toBe(1);
  for (const tab of tabs) {
    await expect(tab.locator("[data-save]").getByRole("status")).toContainText("Saved to My reports.");
  }
});

test("saving the same result again says it is already there", async ({ page }) => {
  await mockTools(page);
  await standInSupabase(page);
  await page.route("**/api/v1/saved", (route) => route.fulfill(reply(200, { ...hadahanItem, created: false })));
  await showHadahan(page);
  const save = page.locator("[data-save]");
  await save.getByRole("button", { name: "Save" }).click();
  await expect(save.getByRole("status")).toContainText("Already in My reports.");
});

test("a full My reports shows the reason", async ({ page }) => {
  await mockTools(page);
  await standInSupabase(page);
  await page.route("**/api/v1/saved", (route) => route.fulfill(reply(409, { detail: "saved report limit reached" })));
  await showHadahan(page);
  const save = page.locator("[data-save]");
  await save.getByRole("button", { name: "Save" }).click();
  await expect(save.getByRole("alert")).toHaveText("My reports is full. Delete a report there to save this one.");
  await expect(save.getByRole("button", { name: "Save" })).toBeEnabled();
});

test("My reports lists, renames and deletes", async ({ page }) => {
  await page.route("**/api/v1/labels/*", (route) => route.fulfill(json("labels-en.json")));
  const calls: string[] = [];
  await page.route("**/api/v1/saved", (route) => route.fulfill(reply(200, { reports: [matchItem, hadahanItem] })));
  await page.route(`**/api/v1/saved/*`, (route) => {
    const request = route.request();
    calls.push(`${request.method()} ${new URL(request.url()).pathname} ${request.postData() ?? ""}`.trim());
    return route.fulfill({ status: 204, body: "" });
  });
  await page.goto("/en/my");

  await expect(page.getByRole("heading", { name: "My reports", level: 1 })).toBeVisible();
  const match = page.locator('[data-saved-report="porondam"]');
  await expect(match).toContainText("Nimali and Kasun");
  await expect(match).toContainText("11 of 16 factors agree · Quick match by birth star");
  await expect(match).toContainText("Saved 15 November 2026");
  const chart = page.locator('[data-saved-report="hadahan"]');
  await expect(chart).toContainText("Nimali's birth chart");
  await expect(chart).toContainText("Lagna Simha · Rashi Vrischika · Jyeshtha");
  await expect(page.getByText("Your reports are kept on this browser.")).toBeVisible();
  // Deleting a report and deleting its share link are separate, and the page says so.
  await expect(page.locator("[data-shares-separate]")).toContainText(
    "Deleting a report here does not delete a share link made from it",
  );

  await chart.getByRole("button", { name: "Rename" }).click();
  await chart.getByLabel("Name for this report").fill("Amma");
  await chart.getByRole("button", { name: "Save name" }).click();
  await expect(chart.getByRole("link", { name: "Amma" })).toBeVisible();

  await match.getByRole("button", { name: "Delete" }).click();
  await expect(match).toContainText("Delete this report?");
  await match.getByRole("button", { name: "Yes, delete" }).click();
  await expect(page.locator('[data-saved-report="porondam"]')).toHaveCount(0);

  expect(calls).toEqual([`PATCH /api/v1/saved/${ID} {"title":"Amma"}`, `DELETE /api/v1/saved/${MATCH_ID}`]);
});

test("everything can be deleted at once", async ({ page }) => {
  await page.route("**/api/v1/labels/*", (route) => route.fulfill(json("labels-en.json")));
  await page.route("**/api/v1/saved", (route) => route.fulfill(reply(200, { reports: [hadahanItem] })));
  const wiped: string[] = [];
  await page.route("**/api/v1/me", (route) => {
    wiped.push(route.request().method());
    return route.fulfill({ status: 204, body: "" });
  });
  await page.goto("/en/my");
  await page.getByRole("button", { name: "Delete all my saved reports" }).click();
  await page.getByRole("button", { name: "Yes, delete everything" }).click();
  await expect(page.getByText("Everything is deleted. Nothing from it is kept.")).toBeVisible();
  await expect(page.locator("[data-shares-separate]")).toContainText("Share links are separate from saved reports");
  expect(wiped).toEqual(["DELETE"]);
});

test("My reports offers Google to someone who saved on another device", async ({ page }) => {
  await standInSupabase(page);
  await page.route("**/api/v1/labels/*", (route) => route.fulfill(json("labels-en.json")));
  await page.route("**/api/v1/saved", (route) => route.fulfill(reply(200, { reports: [] })));
  await page.goto("/en");
  await page.locator("[data-footer-sign-in]").click();
  await expect(page).toHaveURL(/\/en\/my#sign-in$/);
  const box = page.locator("#sign-in");
  await expect(box).toContainText("Saved reports on another device?");
  await box.getByRole("button", { name: "Continue with Google" }).click();
  // Nobody is signed in here, so this is a plain Google sign in, coming back to the callback page.
  await expect(page).toHaveURL((url) => url.href.startsWith(`${SUPABASE}/auth/v1/authorize?`));
  const url = new URL(page.url());
  expect(url.searchParams.get("provider")).toBe("google");
  expect(url.searchParams.get("redirect_to")).toContain("/en/auth/callback?next=%2Fen%2Fmy");
});

test("a guest who continues with Google links it to the same account", async ({ page }) => {
  const supabase = await standInSupabase(page);
  await mockTools(page);
  await page.route("**/api/v1/saved", (route) =>
    route.fulfill(route.request().method() === "POST" ? reply(201, { ...hadahanItem, created: true }) : reply(200, { reports: [hadahanItem] })),
  );
  await showHadahan(page);
  await page.locator("[data-save]").getByRole("button", { name: "Save" }).click();
  await expect(page.locator("[data-save]").getByRole("status")).toContainText("Saved to My reports.");

  await page.goto("/en/my");
  const box = page.locator("#sign-in");
  await expect(box.getByRole("heading", { name: "Keep your reports on any device" })).toBeVisible();
  await expect(box).toContainText("Any Google account works");
  await box.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL((url) => url.href.startsWith(`${SUPABASE}/google?`));
  expect(supabase.calls).toContain("GET /auth/v1/user/identities/authorize");
  expect(supabase.guests()).toBe(1);
});

test("a guest whose Google account already exists moves their reports into it", async ({ page }) => {
  const supabase = await standInSupabase(page, { google: "return" });
  await mockTools(page);
  await page.route("**/api/v1/saved", (route) =>
    route.fulfill(route.request().method() === "POST" ? reply(201, { ...hadahanItem, created: true }) : reply(200, { reports: [hadahanItem] })),
  );
  const merges: { token: string | null; body: unknown }[] = [];
  await page.route("**/api/v1/me/merge-guest", async (route) => {
    merges.push({ token: await route.request().headerValue("x-sidera-token"), body: route.request().postDataJSON() });
    return route.fulfill(reply(200, { moved: 1, saved: 3 }));
  });
  await showHadahan(page);
  await page.locator("[data-save]").getByRole("button", { name: "Save" }).click();
  await expect(page.locator("[data-save]").getByRole("status")).toContainText("Saved to My reports.");
  const guestToken = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((name) => name.endsWith("-auth-token"))!;
    return (JSON.parse(localStorage.getItem(key)!) as { access_token: string }).access_token;
  });

  // Supabase sends the guest back from linking: that Google account belongs to another user.
  await page.goto("/en/auth/callback?next=%2Fen%2Fmy&error=server_error&error_code=identity_already_exists");
  // The page signs in with that account instead, Google sends the browser back, and the
  // guest's reports are moved, with both sign ins.
  await expect(page).toHaveURL(/\/en\/my$/);
  expect(merges).toHaveLength(1);
  const google = merges[0].token!;
  expect(JSON.parse(Buffer.from(google.split(".")[1], "base64url").toString()).is_anonymous).toBe(false);
  expect(merges[0].body).toEqual({ guest_token: expect.stringMatching(/^[\w-]+\.[\w-]+\.[\w-]+$/) });
  const sent = (merges[0].body as { guest_token: string }).guest_token;
  expect(JSON.parse(Buffer.from(sent.split(".")[1], "base64url").toString()).sub).toBe(
    JSON.parse(Buffer.from(guestToken.split(".")[1], "base64url").toString()).sub,
  );
  expect(supabase.calls).toContain("POST /auth/v1/token");
  await expect(page.locator("#sign-in")).toContainText(`Signed in with Google as ${GOOGLE_EMAIL}.`);
});

test("a Google account can sign out of this phone or everywhere, and delete itself", async ({ page }) => {
  const supabase = await standInSupabase(page, { google: "return" });
  await page.route("**/api/v1/labels/*", (route) => route.fulfill(json("labels-en.json")));
  await page.route("**/api/v1/saved", async (route) => {
    const signedIn = Boolean(await route.request().headerValue("x-sidera-token"));
    return route.fulfill(reply(200, { reports: signedIn ? [hadahanItem] : [] }));
  });
  const deleted: (string | null)[] = [];
  await page.route("**/api/v1/me", async (route) => {
    deleted.push(await route.request().headerValue("x-sidera-token"));
    return route.fulfill({ status: 204, body: "" });
  });
  const signIn = async () => {
    await page.goto("/en/my");
    await page.locator("#sign-in").getByRole("button", { name: "Continue with Google" }).click();
    await expect(page.locator("#sign-in")).toContainText(`Signed in with Google as ${GOOGLE_EMAIL}.`);
    await expect(page.locator('[data-saved-report="hadahan"]')).toBeVisible();
  };

  await signIn();
  await expect(page.getByText("Your reports are kept with your Google account.")).toBeVisible();
  await page.getByRole("button", { name: "Sign out of this phone" }).click();
  await expect(page.locator("[data-saved-empty]")).toBeVisible();
  await expect(page.locator("#sign-in")).toContainText("Saved reports on another device?");

  await signIn();
  await page.getByRole("button", { name: "Sign out everywhere" }).click();
  await expect(page.locator("[data-saved-empty]")).toBeVisible();
  const logouts = supabase.calls.filter((call) => call === "POST /auth/v1/logout");
  expect(logouts).toHaveLength(2);

  await signIn();
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByText("Delete your account and every saved report?")).toBeVisible();
  await page.getByRole("button", { name: "Yes, delete my account" }).click();
  await expect(page.getByText("Everything is deleted. Nothing from it is kept.")).toBeVisible();
  expect(deleted).toHaveLength(1);
  expect(deleted[0]).toBeTruthy();
});

test("a sign in that fails on the way back says so", async ({ page }) => {
  await standInSupabase(page);
  await page.goto("/en/auth/callback?error=access_denied&error_description=cancelled");
  const main = page.locator("main");
  await expect(main.getByRole("alert")).toHaveText("Signing in did not finish. Please try again from My reports.");
  await expect(main.getByRole("link", { name: "My reports" })).toHaveAttribute("href", "/en/my");
});

test("an empty My reports points to the tools", async ({ page }) => {
  await page.route("**/api/v1/labels/*", (route) => route.fulfill(json("labels-en.json")));
  await page.route("**/api/v1/saved", (route) => route.fulfill(reply(200, { reports: [] })));
  await page.goto("/en/my");
  await expect(page.locator("[data-saved-empty]")).toContainText("Nothing saved yet");
  await expect(page.getByRole("link", { name: "Make a hadahan" })).toHaveAttribute("href", "/en/hadahan");
});

test("a saved hadahan opens with its PDF and Share buttons", async ({ page }) => {
  const shared = JSON.parse(fixture("share-hadahan-en.json"));
  await page.route("**/api/v1/labels/*", (route) => route.fulfill(json("labels-en.json")));
  await page.route("**/api/v1/forecast", (route) => route.fulfill(json("forecast-en.json")));
  await page.route(`**/api/v1/saved/${ID}?lang=en`, (route) =>
    route.fulfill(
      reply(200, {
        ...hadahanItem,
        title: "Amma",
        request: {
          kind: "hadahan",
          name: "Nimali",
          birth: { date: "1995-04-19", time: "14:35", place_id: 1241622, latitude: null, lang: "en" },
        },
        hadahan_result: shared.hadahan,
        porondam_result: null,
      }),
    ),
  );
  const pdf: string[] = [];
  await page.route("**/api/v1/reports/pdf", (route) => {
    pdf.push(route.request().postData() ?? "");
    return route.fulfill({ status: 200, contentType: "application/pdf", body: "%PDF-1.7" });
  });

  await page.goto(`/en/my/${ID}`);
  const banner = page.locator("[data-saved-banner]");
  await expect(banner).toContainText("Saved report");
  await expect(banner).toContainText("Amma");
  await expect(page.locator('[data-card="lagna"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Share", exact: true })).toBeVisible();
  await expect(page.locator("[data-save]")).toHaveCount(0);

  await page.getByRole("button", { name: "Download PDF" }).click();
  await expect.poll(() => pdf.length).toBe(1);
  expect(JSON.parse(pdf[0])).toEqual({
    kind: "hadahan",
    name: "Nimali",
    birth: { date: "1995-04-19", time: "14:35", place_id: 1241622, lang: "en" },
  });
});

test("a report from another browser is not there", async ({ page }) => {
  await page.route(`**/api/v1/saved/${ID}?lang=en`, (route) =>
    route.fulfill(reply(404, { detail: "no such saved report" })),
  );
  await page.route("**/api/v1/labels/*", (route) => route.fulfill(json("labels-en.json")));
  await page.goto(`/en/my/${ID}`);
  await expect(page.locator("[data-saved-gone]")).toContainText("This report is not here");
});
