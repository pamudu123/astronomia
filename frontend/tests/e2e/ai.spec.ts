import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type Page, expect, test } from "@playwright/test";

/**
 * The AI explanations (docs/17) with the AI switched on: this file runs against its own build
 * (scripts/e2e-ai-server.mjs). The backend and the agent are not running: the backend's answers
 * are saved real responses, and the tests write each chapter themselves.
 */
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf-8");

/** A chapter's text the way the agent streams it: an answer, a bold lead, a short part. */
const chapter = (id: string) => `Text of ${id}.\n\n**A bold lead**\nA short part of ${id}.`;

type Calls = string[];

/** The reviewed AI notice (docs/policies/refunds.md), shown before anything goes to the AI. */
const NOTICE =
  "This is an AI helper. Your message and selected chart facts go to OpenAI. Please leave out names, " +
  "children's details, and health or other sensitive information. AI can make mistakes.";

/** Marks the AI notice as acknowledged in this browser, as after an earlier visit. */
async function acknowledgeNotice(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem("sidera.ai-notice", "2026-11-20"));
}

const PRICE = { amount: 80_000, currency: "LKR" };
/** What the backend says about the report (docs/18): paid reports switched off, as today. */
const OPEN = {
  paid: false,
  features: ["ai_reading", "ai_explain", "full_detail", "full_pdf"],
  paid_reports: false,
  account: null,
  price: PRICE,
};

async function mockAll(
  page: Page,
  fail: Set<string> = new Set(),
  access: object = OPEN,
  { notice = "acknowledged" }: { notice?: "acknowledged" | "new" } = {},
): Promise<Calls> {
  if (notice === "acknowledged") await acknowledgeNotice(page);
  await page.route("**/api/v1/reports/access", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(access) }),
  );
  await page.route("**/api/v1/labels/*", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture("labels-en.json") }),
  );
  await page.route("**/api/v1/porondam", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture("porondam-quick-en.json") }),
  );
  await page.route("**/api/v1/porondam/timeline", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture("timeline-quick-en.json") }),
  );
  // The chat panel talks to its own route; nothing to answer in these tests.
  await page.route("**/api/copilotkit**", (route) => route.fulfill({ status: 404, body: "" }));
  const calls: Calls = [];
  await page.route("**/api/explain", (route) => {
    const { id } = JSON.parse(route.request().postData() ?? "{}") as { id: string };
    calls.push(id);
    if (fail.has(id)) {
      fail.delete(id); // fails once, then works
      return route.fulfill({ status: 502, body: "down" });
    }
    return route.fulfill({ contentType: "text/plain; charset=utf-8", body: chapter(id) });
  });
  return calls;
}

async function quickMatch(page: Page) {
  await page.goto("/en/porondam");
  await page.getByRole("button", { name: "Birth stars only" }).click();
  const bride = page.getByRole("group", { name: "Bride" });
  await bride.getByLabel("Birth star (nakath)").selectOption("anuradha");
  await bride.getByLabel("Pada").selectOption("2");
  await page.getByRole("group", { name: "Groom" }).getByLabel("Birth star (nakath)").selectOption("rohini");
  await page.getByRole("button", { name: "Match the charts" }).click();
}

test("the full match reading writes its first chapters and opens the rest one by one", async ({ page }) => {
  const calls = await mockAll(page);
  await quickMatch(page);

  const card = page.locator('[data-card="full-reading"]');
  await expect(card.getByRole("heading", { name: "Full match reading" })).toBeVisible();
  await card.getByRole("button", { name: "Get the full reading" }).click();

  // The first two chapters open and are written straight away.
  await expect(card.locator('[data-chapter="match.people"]')).toContainText("Text of match.people.");
  await expect(card.locator('[data-chapter="match.factors"]')).toContainText("A bold lead");
  expect(calls.sort()).toEqual(["match.factors", "match.people"]);
  await expect(card).toContainText("AI reading · for guidance only");

  // Another chapter is written when it is opened.
  await card.getByRole("heading", { name: "Summing up" }).getByRole("button").click();
  await expect(card.locator('[data-chapter="match.summary"]')).toContainText("Text of match.summary.");
  expect(calls).toHaveLength(3);
});

test("an explain button reuses the reading's chapters and hides without losing them", async ({ page }) => {
  const calls = await mockAll(page);
  await quickMatch(page);

  const checks = page.locator('[data-explain="match.checks match.mars"]');
  await checks.getByRole("button", { name: "Explain this" }).click();
  await expect(checks.locator('[data-chapter="match.checks"]')).toContainText("Text of match.checks.");
  await expect(checks.locator('[data-chapter="match.mars"]')).toContainText("Text of match.mars.");
  expect(calls.sort()).toEqual(["match.checks", "match.mars"]);

  // Hide and open again: the same text, no new request.
  await checks.getByRole("button", { name: "Hide" }).click();
  await expect(checks.locator("[data-chapter]")).toHaveCount(0);
  await checks.getByRole("button", { name: "Explain this" }).click();
  await expect(checks.locator('[data-chapter="match.checks"]')).toContainText("Text of match.checks.");
  expect(calls).toHaveLength(2);

  // The full reading shows the same chapter without asking again.
  const card = page.locator('[data-card="full-reading"]');
  await card.getByRole("button", { name: "Get the full reading" }).click();
  // The chapter row's own button; "Next: The serious checks" under the open chapter before it matches too.
  await card.getByRole("heading", { name: "The serious checks" }).getByRole("button").click();
  await expect(card.locator('[data-chapter="match.checks"]')).toContainText("Text of match.checks.");
  expect(calls.filter((id) => id === "match.checks")).toHaveLength(1);
});

test("a chapter that can't be written offers to try again", async ({ page }) => {
  await mockAll(page, new Set(["match.summary"]));
  await quickMatch(page);

  const result = page.locator('[data-explain="match.summary"]');
  await result.getByRole("button", { name: "Explain this" }).click();
  await expect(result).toContainText("This couldn't be written just now.");
  await result.getByRole("button", { name: "Try again" }).click();
  await expect(result.locator('[data-chapter="match.summary"]')).toContainText("Text of match.summary.");
});

test("with paid reports on, a free match shows the full report form in place of the AI", async ({ page }) => {
  const calls = await mockAll(page, new Set(), { ...OPEN, features: [], paid_reports: true });
  await quickMatch(page);

  const result = page.locator('[data-explain="match.summary"]');
  await result.getByRole("button", { name: "Explain this" }).click();
  await expect(result).toContainText("Part of the full report");
  await expect(page.locator('[data-card="full-reading"]')).toContainText("Part of the full report");

  const form = page.locator('[data-card="full-report"]');
  await expect(form.getByRole("heading", { name: "Get the full report" })).toBeVisible();
  await expect(form.locator("[data-price]")).toContainText("LKR 800");
  // Not signed in: the way in is Google, not a coupon box.
  await expect(form.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(form.getByRole("button", { name: "Have a coupon?" })).toHaveCount(0);
  expect(calls).toHaveLength(0);
});

test("a signed in visitor unlocks the match with a free coupon", async ({ page }) => {
  const locked = { ...OPEN, features: [], paid_reports: true, account: "google" };
  const unlocked = { ...OPEN, paid: true, paid_reports: true, account: "google" };
  await mockAll(page, new Set(), locked);
  // The backend's answer once the report is paid for; the page asks again after unlocking.
  let paid = false;
  await page.route("**/api/v1/reports/access", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(paid ? unlocked : locked) }),
  );
  await page.route("**/api/v1/coupons/apply", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ result: "free", percent_off: 100, price: PRICE, new_price: { ...PRICE, amount: 0 } }),
    }),
  );
  await page.route("**/api/v1/reports/unlock", (route) => {
    paid = true;
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        order: { id: "o1", kind: "porondam", price: PRICE, percent_off: 100, amount_paid: { ...PRICE, amount: 0 }, method: "coupon" },
        saved: null,
        access: unlocked,
      }),
    });
  });
  await quickMatch(page);

  const form = page.locator('[data-card="full-report"]');
  await form.getByRole("button", { name: "Have a coupon?" }).click();
  await form.getByLabel("Coupon code").fill("pamudu");
  await form.getByRole("button", { name: "Apply" }).click();
  await expect(form).toContainText("This code makes the report free.");
  await expect(form.locator("[data-price]")).toContainText("LKR 0");
  await form.getByRole("button", { name: "Unlock free" }).click();

  await expect(form.getByRole("heading", { name: "This is your full report" })).toBeVisible();
  const card = page.locator('[data-card="full-reading"]');
  await card.getByRole("button", { name: "Get the full reading" }).click();
  await expect(card.locator('[data-chapter="match.people"]')).toContainText("Text of match.people.");
});

test("the AI notice comes before the first explanation, and nothing is sent until it is acknowledged", async ({
  page,
}) => {
  const calls = await mockAll(page, new Set(), OPEN, { notice: "new" });
  await quickMatch(page);

  const result = page.locator('[data-explain="match.summary"]');
  await result.getByRole("button", { name: "Explain this" }).click();
  const notice = result.getByRole("region", { name: "Before you use the AI helper" });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(NOTICE);
  await expect(notice).toBeFocused();
  await expect(notice.getByRole("link", { name: /How we handle your information/ })).toHaveAttribute(
    "href",
    "/en/privacy",
  );
  // The full reading waits for the same notice.
  const card = page.locator('[data-card="full-reading"]');
  await card.getByRole("button", { name: "Get the full reading" }).click();
  await expect(card.locator("[data-ai-notice]")).toBeVisible();
  await expect(page.locator("[data-chapter]")).toHaveCount(0);
  expect(calls).toHaveLength(0);

  // One "I understand" lets every explanation on the page through.
  await notice.getByRole("button", { name: "I understand" }).click();
  await expect(result.locator('[data-chapter="match.summary"]')).toContainText("Text of match.summary.");
  await expect(card.locator('[data-chapter="match.people"]')).toContainText("Text of match.people.");
  await expect(page.locator("[data-ai-notice]")).toHaveCount(0);

  // Remembered in this browser: a later visit (the page keeps the match) doesn't ask again.
  await page.reload();
  await page.locator('[data-explain="match.checks match.mars"]').getByRole("button", { name: "Explain this" }).click();
  await expect(page.locator('[data-chapter="match.checks"]')).toContainText("Text of match.checks.");
  await expect(page.locator("[data-ai-notice]")).toHaveCount(0);
});

test("the AI notice comes before the first chat message, in place of the input (on a phone)", async ({ page }) => {
  // A phone screen, where the chat covers the page.
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAll(page, new Set(), OPEN, { notice: "new" });
  const runs: string[] = [];
  page.on("request", (request) => {
    if (!request.url().includes("/api/copilotkit")) return;
    const body = request.postData() ?? "";
    // The chat's start-up asks which agents exist; a message would be a run.
    if (/"method":"agent\/(run|connect)"|"messages":\[\{/.test(body)) runs.push(body);
  });
  await page.goto("/en/porondam");
  await page.getByRole("button", { name: "Ask Astro" }).click();

  const panel = page.locator(".copilotKitSidebar");
  const notice = panel.getByRole("region", { name: "Before you use the AI helper" });
  await expect(notice).toContainText(NOTICE);
  await expect(panel.locator("textarea")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Explain my match result" })).toHaveCount(0);

  await expect(notice.getByRole("button", { name: "I understand" })).toBeInViewport();
  await notice.getByRole("button", { name: "I understand" }).click();
  await expect(panel.locator("textarea")).toBeVisible();
  await expect(panel.locator("[data-ai-notice]")).toHaveCount(0);
  expect(runs).toEqual([]);
});
