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

test("a save past the 20 free reports says what to do", async ({ page }) => {
  await mockTools(page);
  await standInSupabase(page);
  await page.route("**/api/v1/saved", (route) => route.fulfill(reply(409, { detail: "free_limit" })));
  await showHadahan(page);
  const save = page.locator("[data-save]");
  await save.getByRole("button", { name: "Save" }).click();
  await expect(save.getByRole("alert")).toHaveText(
    "My reports already holds the most free reports you can keep at one time. Delete one there to save this one. Each free report is deleted 7 days after saving.",
  );
});

test("My reports labels free and paid reports, and asks to keep one about to go", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-20T20:00:00Z")); // 5 days after SAVED_AT
  await page.route("**/api/v1/labels/*", (route) => route.fulfill(json("labels-en.json")));
  const paidMatch = { ...matchItem, paid: true, expires_at: null };
  const soon = { ...hadahanItem, paid: false, expires_at: "2026-11-22T08:00:00Z" }; // 1.5 days left
  const later = {
    ...hadahanItem,
    id: "5b7e9c10-2a4f-4e6d-8b1c-9d0e1f2a3b4c",
    created_at: "2026-11-19T08:00:00Z",
    paid: false,
    expires_at: "2026-11-26T08:00:00Z", // 5.5 days left
    hadahan: { ...hadahanItem.hadahan, name: "Kasun" },
  };
  await page.route("**/api/v1/saved", (route) =>
    route.fulfill(reply(200, { reports: [later, paidMatch, soon], free_limit: 20, paid_reports: true })),
  );
  await page.goto("/en/my");

  const match = page.locator('[data-saved-report="porondam"]');
  await expect(match.locator("[data-keep]")).toHaveText("Paid");
  await expect(match.locator("[data-keep-reminder]")).toHaveCount(0);

  const kasun = page.locator('[data-saved-report="hadahan"]', { hasText: "Kasun" });
  await expect(kasun.locator("[data-keep]")).toHaveText("Free · deleted in 6 days");
  await expect(kasun.locator("[data-keep-reminder]")).toHaveCount(0);

  const nimali = page.locator('[data-saved-report="hadahan"]', { hasText: "Nimali" });
  await expect(nimali.locator("[data-keep]")).toHaveText("Free · deleted in 2 days");
  const reminder = nimali.locator("[data-keep-reminder]");
  await expect(reminder).toContainText("Deleted in 2 days. Get the full report to keep it.");
  await expect(reminder.getByRole("link", { name: "Get the full report" })).toHaveAttribute(
    "href",
    `/en/my/${ID}#full-report`,
  );

  await expect(page.getByText("2 of 20 free reports kept.")).toBeVisible();
  await expect(page.locator("[data-keep-note]")).toHaveText(
    "Free reports are kept for 7 days. Paid reports are kept for as long as you have your account, on any device. Comparing paid reports with each other is coming soon.",
  );
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

/** A road a hundred years long with one period, as the engine sends it. */
function road(birth: string, now: string) {
  const year = Number(birth.slice(0, 4));
  const period = {
    lord: "venus",
    start: birth,
    end: `${year + 101}-01-01T00:00:00Z`,
    house: 4,
    theme: "home",
    tone: "good",
  };
  return {
    rule_set: "journey_v1",
    provisional: true,
    birth,
    end: `${year + 100}-01-01T00:00:00Z`,
    now,
    periods: [{ ...period, sub: [period] }],
    erashtaka: [],
    erashtaka_lagna: [],
    guru_returns: [],
    stops: [
      { kind: "birth", at: birth, tone: "good", lord: "venus", title: "The road begins", text: "Here." },
      { kind: "onward", at: `${year + 96}-01-01T00:00:00Z`, tone: "good", title: "The road goes on", text: "On." },
    ],
    quality: { step_days: 365.25, values: Array.from({ length: 101 }, () => 0.5) },
  };
}

const NOW = "2027-06-01T00:00:00Z";
const BORN = "1995-04-19T09:05:00Z";
const BIRTH = { date: "1995-04-19", time: "14:35", place_id: 1241622, latitude: null, lang: "en" };

async function openSavedHadahan(page: Page, lang: "en" | "si", journey: ReturnType<typeof road> | null) {
  // Opened months after it was saved on 15 November 2026.
  await page.clock.setFixedTime(new Date(NOW));
  const shared = JSON.parse(fixture(`share-hadahan-${lang}.json`));
  await page.route("**/api/v1/labels/*", (route) => route.fulfill(json(`labels-${lang}.json`)));
  await page.route("**/api/v1/forecast", (route) => route.fulfill({ status: 503, body: "" }));
  await page.route("**/api/v1/changes/personal", (route) => route.fulfill(json(`changes-personal-${lang}.json`)));
  await page.route("**/api/v1/journey", (route) =>
    journey ? route.fulfill(reply(200, { status: "ok", time: null, journey })) : route.fulfill({ status: 503, body: "" }),
  );
  await page.route(`**/api/v1/saved/${ID}?lang=${lang}`, (route) =>
    route.fulfill(
      reply(200, {
        ...hadahanItem,
        request: { kind: "hadahan", name: "Nimali", birth: { ...BIRTH, lang } },
        hadahan_result: shared.hadahan,
        porondam_result: null,
      }),
    ),
  );
  await page.goto(`/${lang}/my/${ID}`);
  await expect(page.locator('[data-card="lagna"]')).toBeVisible();
}

for (const [lang, saved, today] of [
  ["en", "15 November 2026", "1 June 2027"],
  ["si", "2026 නොවැම්බර් 15", "2027 ජූනි 1"],
] as const) {
  test(`a saved hadahan says what was kept and what is worked out today, in ${lang} (A-08)`, async ({ page }) => {
    await openSavedHadahan(page, lang, road(BORN, NOW));
    await expect(page.locator("[data-saved-note]")).toContainText("PDF");
    const frozen = page.locator('#periods [data-saved-time="frozen"]');
    await expect(frozen).toHaveCount(1);
    await expect(frozen).toContainText(saved);
    await expect(page.locator('[data-card="road"] [data-saved-time="live"]')).toContainText(today);
    await expect(page.locator('#coming > [data-saved-time="live"]')).toContainText(today);
  });
}

test("a saved hadahan's label goes when its live parts cannot be loaded", async ({ page }) => {
  await openSavedHadahan(page, "en", null);
  await page.unroute("**/api/v1/changes/personal");
  await page.route("**/api/v1/changes/personal", (route) => route.fulfill({ status: 503, body: "" }));
  await page.reload();
  await expect(page.locator('#periods [data-saved-time="frozen"]')).toBeVisible();
  // Each part says it could not load and can be tried again, but nothing claims to be worked out.
  await expect(page.locator("#coming").getByRole("button", { name: /^Try again/ })).toHaveCount(2);
  await expect(page.locator('[data-saved-time="live"]:visible')).toHaveCount(0);
});

test("a birth still to come has no Today on its road (A-06)", async ({ page }) => {
  await openSavedHadahan(page, "en", road("2030-01-01T00:00:00Z", NOW));
  const panel = page.locator('[data-card="road"]');
  await expect(panel.locator('[data-card="stop"]')).toContainText("The road begins");
  await expect(panel.getByRole("button", { name: "Today", exact: true })).toHaveCount(0);
  await expect(panel.getByText("You are here")).toHaveCount(0);
  // The road can still be travelled, and the birth reached again, from the keyboard.
  const map = panel.getByRole("slider");
  await map.focus();
  await page.keyboard.press("End");
  await expect(panel.locator('[data-card="stop"]')).toContainText("The road goes on");
  await page.keyboard.press("Home");
  await expect(panel.locator('[data-card="stop"]')).toContainText("The road begins");
});

test("a birth in the past still has its Today", async ({ page }) => {
  await openSavedHadahan(page, "en", road(BORN, NOW));
  await expect(page.locator('[data-card="road"]').getByRole("button", { name: "Today", exact: true })).toBeVisible();
});

test("a saved match says what was kept and what is worked out today (A-08)", async ({ page }) => {
  await page.clock.setFixedTime(new Date(NOW));
  const shared = JSON.parse(fixture("share-porondam-en.json"));
  await page.route("**/api/v1/labels/*", (route) => route.fulfill(json("labels-en.json")));
  await page.route("**/api/v1/porondam/timeline", (route) => route.fulfill(json("timeline-full-en.json")));
  await page.route("**/api/v1/journey/couple", (route) =>
    route.fulfill(
      reply(200, {
        status: "ok",
        waiting_for: null,
        time: null,
        bride: road(BORN, NOW),
        groom: road("1992-08-03T04:30:00Z", NOW),
      }),
    ),
  );
  await page.route(`**/api/v1/saved/${MATCH_ID}?lang=en`, (route) =>
    route.fulfill(
      reply(200, {
        ...matchItem,
        request: { kind: "porondam", match: { bride: { ...BIRTH, name: "Nimali" }, groom: { ...BIRTH, date: "1992-08-03", name: "Kasun" } } },
        hadahan_result: null,
        porondam_result: shared.porondam,
      }),
    ),
  );
  await page.goto(`/en/my/${MATCH_ID}`);
  await expect(page.locator("[data-saved-note]")).toContainText("kept as they were that day");
  await expect(page.locator('[data-card="timeline"] [data-saved-time="live"]')).toContainText("1 June 2027");
  await expect(page.locator('[data-card="couple-road"] [data-saved-time="live"]')).toContainText("1 June 2027");
});

test("a report from another browser is not there", async ({ page }) => {
  await page.route(`**/api/v1/saved/${ID}?lang=en`, (route) =>
    route.fulfill(reply(404, { detail: "no such saved report" })),
  );
  await page.route("**/api/v1/labels/*", (route) => route.fulfill(json("labels-en.json")));
  await page.goto(`/en/my/${ID}`);
  await expect(page.locator("[data-saved-gone]")).toContainText("This report is not here");
});

test("a Google account with no reports can delete itself", async ({ page }) => {
  await standInSupabase(page, { google: "return" });
  await page.route("**/api/v1/labels/*", (route) => route.fulfill(json("labels-en.json")));
  await page.route("**/api/v1/saved", (route) => route.fulfill(reply(200, { reports: [] })));
  const deleted: (string | null)[] = [];
  await page.route("**/api/v1/me", async (route) => {
    deleted.push(await route.request().headerValue("x-sidera-token"));
    return route.fulfill({ status: 204, body: "" });
  });
  await page.goto("/en/my");
  await expect(page.locator("[data-saved-empty]")).toContainText("Nothing saved yet");
  // Nobody is signed in yet: there is no account to delete.
  await expect(page.getByRole("button", { name: "Delete my account" })).toHaveCount(0);
  await page.locator("#sign-in").getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.locator("#sign-in")).toContainText(`Signed in with Google as ${GOOGLE_EMAIL}.`);

  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.getByRole("button", { name: "Yes, delete my account" }).click();
  await expect(page.getByText("Everything is deleted. Nothing from it is kept.")).toBeVisible();
  expect(deleted).toHaveLength(1);
  expect(deleted[0]).toBeTruthy();
  await expect(page.getByRole("button", { name: "Delete my account" })).toHaveCount(0);
});

const PAID_ACCESS = {
  paid: true,
  features: ["ai_reading", "ai_explain", "full_detail", "full_pdf"],
  paid_reports: true,
  account: "google",
  price: { amount: 80_000, currency: "LKR" },
};

test("a failed paid check shows the free report, and asks again when told to", async ({ page }) => {
  let down = true;
  await page.route("**/api/v1/reports/access", (route) =>
    down ? route.fulfill({ status: 503, body: "" }) : route.fulfill(reply(200, PAID_ACCESS)),
  );
  await openSavedHadahan(page, "en", null);
  const kuja = page.locator('[data-card="kuja"]');
  await kuja.locator("summary").click();
  await expect(kuja.locator('[data-locked="full_detail"]')).toBeVisible();
  const card = page.locator('[data-card="full-report"]');
  await expect(card).toContainText("We could not check whether this is a full report");
  // Asking again while the backend is still away changes nothing.
  const again = card.getByRole("button", { name: "Check again" });
  await again.click();
  await expect(again).toBeVisible();

  down = false;
  await again.click();
  await expect(card.getByRole("heading", { name: "This is your full report" })).toBeVisible();
  await expect(kuja.locator('[data-locked="full_detail"]')).toHaveCount(0);
  await expect(page.locator("[data-check-failed]")).toHaveCount(0);
});

test("the full report of a chart with Kuja dosha promises its rules", async ({ page }) => {
  await page.route("**/api/v1/reports/access", (route) =>
    route.fulfill(reply(200, { ...PAID_ACCESS, paid: false, features: [] })),
  );
  await openSavedHadahan(page, "en", null);
  await expect(page.locator('[data-card="full-report"] li')).toHaveText([
    "The full AI reading, chapter by chapter",
    "Explain buttons on every main place",
    "Every Kuja dosha rule, in full",
    "The full PDF with the AI reading",
    "Kept in your account, on any device",
  ]);
});

test("the full report of a match made from full details promises no Kuja dosha rules", async ({ page }) => {
  const shared = JSON.parse(fixture("share-porondam-en.json"));
  await page.route("**/api/v1/labels/*", (route) => route.fulfill(json("labels-en.json")));
  await page.route("**/api/v1/reports/access", (route) =>
    route.fulfill(reply(200, { ...PAID_ACCESS, paid: false, features: [] })),
  );
  await page.route(`**/api/v1/saved/${MATCH_ID}?lang=en`, (route) =>
    route.fulfill(
      reply(200, {
        ...matchItem,
        request: { kind: "porondam", match: { bride: { ...BIRTH, name: "Nimali" }, groom: { ...BIRTH, name: "Kasun" } } },
        hadahan_result: null,
        porondam_result: shared.porondam,
      }),
    ),
  );
  await page.goto(`/en/my/${MATCH_ID}`);
  await expect(page.locator('[data-card="full-report"] li')).toHaveText([
    "The full AI reading, chapter by chapter",
    "Explain buttons on every main place",
    "The full PDF with the AI reading",
    "Kept in your account, on any device",
  ]);
});
