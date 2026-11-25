import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type Page, expect, test } from "@playwright/test";

import { standInSupabase } from "./supabase";

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

test("with paid reports on, a free match invites to buy the report in place of the AI", async ({ page }) => {
  const calls = await mockAll(page, new Set(), { ...OPEN, features: [], paid_reports: true });
  await quickMatch(page);

  const result = page.locator('[data-explain="match.summary"]');
  await result.getByRole("button", { name: "Explain this" }).click();
  await expect(result).toContainText("This is in the full report");
  await expect(result).toContainText("the AI reading of this match");
  await expect(result.locator("[data-price]")).toContainText("LKR 800");
  await expect(result.getByRole("link", { name: "Buy this report" })).toBeVisible();
  const reading = page.locator('[data-card="full-reading"]');
  await expect(reading.getByRole("link", { name: "Buy this report" })).toBeVisible();

  const form = page.locator('[data-card="full-report"]');
  await expect(form.getByRole("heading", { name: "Get the full report" })).toBeVisible();
  await expect(form.locator("[data-price]")).toContainText("LKR 800");
  // Buying needs no sign in.
  await expect(form.getByRole("button", { name: /Google/ })).toHaveCount(0);
  expect(calls).toHaveLength(0);

  await result.getByRole("link", { name: "Buy this report" }).click();
  await expect(page).toHaveURL(/\/en\/buy$/); // nothing about the match in the address
  await expect(page.locator("[data-buy-report]")).toContainText("Full porondam report");
});

test("a match unlocked on the buying page opens its AI reading", async ({ page }) => {
  const locked = { ...OPEN, features: [], paid_reports: true, account: "google" };
  const unlocked = { ...OPEN, paid: true, paid_reports: true, account: "google" };
  await mockAll(page, new Set(), locked);
  await standInSupabase(page);
  // The backend's answer once the report is paid for; the page asks again after unlocking.
  let paid = false;
  await page.route("**/api/v1/reports/access", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(paid ? unlocked : locked) }),
  );
  await page.route("**/api/v1/coupons/apply", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        result: "free",
        percent_off: 100,
        price: PRICE,
        discount: PRICE,
        new_price: { ...PRICE, amount: 0 },
      }),
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

  await page.locator('[data-card="full-report"]').getByRole("link", { name: "Buy this report" }).click();
  const order = page.locator("[data-buy-order]");
  await order.getByLabel("Coupon or discount code").fill("freecode");
  await order.getByRole("button", { name: "Apply" }).click();
  await order.getByRole("button", { name: "Unlock the report" }).click();
  await page.getByRole("link", { name: "Open the report" }).click();

  const form = page.locator('[data-card="full-report"]:visible');
  await expect(form.getByRole("heading", { name: "This is your full report" })).toBeVisible();
  const card = page.locator('[data-card="full-reading"]:visible');
  await card.getByRole("button", { name: "Get the full reading" }).click();
  await expect(card.locator('[data-chapter="match.people"]')).toContainText("Text of match.people.");
});

test("the chat button leaves the end of the page free, and shrinks once the page is scrolled (NAV-4)", async ({ page }) => {
  for (const size of [
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(size);
    for (const path of ["/en/litha/2026-11", "/en/porondam", "/si/tools"]) {
      await mockAll(page);
      await page.goto(path);
      const button = page.locator(".sidera-launcher");
      await expect(button).toBeVisible();
      const whole = (await button.boundingBox())!;
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      if (size.width < 860) {
        await expect(button).toHaveClass(/sidera-launcher-small/);
        expect((await button.boundingBox())!.width).toBeLessThan(whole.width / 2);
      }
      await expect(button).toHaveAccessibleName(path.startsWith("/si") ? /.+/ : "Ask Astro");
      const covered = await page.evaluate(() => {
        const box = document.querySelector(".sidera-launcher")!.getBoundingClientRect();
        return [...document.querySelectorAll("footer a, footer p")].filter((item) => {
          const at = item.getBoundingClientRect();
          return at.bottom > box.top && at.top < box.bottom && at.right > box.left && at.left < box.right;
        }).length;
      });
      expect(covered, `${path} at ${size.width}px`).toBe(0);
    }
  }
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

/** What the backend says about a report this account paid for, and one it did not. */
const PAID_REPORT = { ...OPEN, paid: true, paid_reports: true, account: "google" };
const NOT_PAID = { ...OPEN, features: [], paid_reports: true };

type Pdf = { reading?: { id: string; title: string; text: string }[] };

/** Answers the PDF request, and gives every request that was made. */
async function mockPdf(page: Page): Promise<Pdf[]> {
  const made: Pdf[] = [];
  await page.route("**/api/v1/reports/pdf", (route) => {
    made.push(JSON.parse(route.request().postData() ?? "{}") as Pdf);
    return route.fulfill({ contentType: "application/pdf", body: "%PDF-1.7" });
  });
  return made;
}

async function mockKept(page: Page, chapters: Record<string, string> = {}) {
  await page.route("**/api/v1/reports/chapters", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ chapters }) }),
  );
}

test("the paid PDF asks for the AI notice, writes every chapter for this report, and reuses them", async ({ page }) => {
  const calls = await mockAll(page, new Set(), PAID_REPORT, { notice: "new" });
  await mockKept(page);
  const made = await mockPdf(page);
  // Every chapter is asked for with the report, which the server's paid check needs.
  const reports: unknown[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/explain")) {
      reports.push((JSON.parse(request.postData() ?? "{}") as { report?: { kind: string } }).report?.kind);
    }
  });
  await quickMatch(page);

  await page.getByRole("button", { name: "Download PDF" }).click();
  const notice = page.locator("[data-ai-notice]").first();
  await expect(notice).toContainText(NOTICE);
  expect(calls).toEqual([]);
  expect(made).toEqual([]);

  await notice.getByRole("button", { name: "I understand" }).click();
  await expect.poll(() => made.length, { timeout: 30_000 }).toBe(1);
  const ids = made[0].reading!.map((c) => c.id);
  expect(ids.length).toBeGreaterThanOrEqual(8);
  expect(ids).toEqual(expect.arrayContaining(["match.people", "match.checks", "match.summary"]));
  expect([...calls].sort()).toEqual([...ids].sort());
  expect(reports.every((kind) => kind === "porondam")).toBe(true);
  expect(made[0].reading![0].text).toContain(`Text of ${ids[0]}.`);

  // The reading opens by itself, and the next PDF asks the AI for nothing.
  await expect(page.locator('[data-card="full-reading"] ol')).toBeVisible();
  const asked = calls.length;
  await page.getByRole("button", { name: "Download PDF" }).click();
  await expect.poll(() => made.length).toBe(2);
  expect(calls.length).toBe(asked);
});

test("a paid report opened on another device has its kept chapters, and the AI is not asked again", async ({ page }) => {
  const calls = await mockAll(page, new Set(), PAID_REPORT);
  await mockKept(page, { "match.people": "Kept words about the two of you.", "match.checks": "Kept checks." });
  await quickMatch(page);

  // The reading is already there, though not all of it is written: nothing to get first.
  const card = page.locator('[data-card="full-reading"]');
  await card.getByRole("heading", { name: "The two of you" }).getByRole("button").click();
  await expect(card.locator('[data-chapter="match.people"]')).toContainText("Kept words about the two of you.");
  await card.getByRole("heading", { name: "The serious checks" }).getByRole("button").click();
  await expect(card.locator('[data-chapter="match.checks"]')).toContainText("Kept checks.");
  expect(calls).toEqual([]);
});

test("the paid PDF has a chapter written again that this device holds but the report does not keep", async ({ page }) => {
  const calls = await mockAll(page, new Set(), PAID_REPORT);
  // Like the server: a chapter is kept when it is written, except the first time for this one.
  let failed = false;
  const kept: Record<string, string> = {};
  page.on("request", (request) => {
    if (!request.url().endsWith("/api/explain")) return;
    const { id } = JSON.parse(request.postData() ?? "{}") as { id: string };
    if (id === "match.people" && !failed) failed = true;
    else kept[id] = chapter(id);
  });
  await page.route("**/api/v1/reports/chapters", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ chapters: kept, keeps: true }) }),
  );
  const made = await mockPdf(page);
  await quickMatch(page);

  await page.getByRole("button", { name: "Download PDF" }).click();
  await expect.poll(() => made.length, { timeout: 30_000 }).toBe(1);
  expect(calls.filter((id) => id === "match.people")).toHaveLength(2);
  expect(new Set(calls).size).toBe(calls.length - 1);
});

test("a paid PDF with a chapter missing is not handed over, and trying again writes only that one", async ({ page }) => {
  let down = true;
  const calls = await mockAll(page, new Set(), PAID_REPORT);
  await mockKept(page);
  const made = await mockPdf(page);
  await page.route("**/api/explain", (route) => {
    const { id } = JSON.parse(route.request().postData() ?? "{}") as { id: string };
    return id === "match.lords" && down ? route.fulfill({ status: 502, body: "down" }) : route.fallback();
  });
  await quickMatch(page);

  await page.getByRole("button", { name: "Download PDF" }).click();
  await expect(page.getByText("The PDF could not be made. Please try again.")).toBeVisible({ timeout: 30_000 });
  expect(made).toEqual([]);
  down = false;
  const before = calls.length;
  await page.getByRole("button", { name: "Download PDF" }).click();
  await expect.poll(() => made.length, { timeout: 30_000 }).toBe(1);
  expect(calls.slice(before)).toEqual(["match.lords"]);
});

test("the free PDF asks the AI for nothing, even where this browser once held the chapters", async ({ page }) => {
  // First as a paid report, so the chapters are on this device.
  const calls = await mockAll(page, new Set(), PAID_REPORT);
  await mockKept(page);
  const made = await mockPdf(page);
  await quickMatch(page);
  await page.getByRole("button", { name: "Download PDF" }).click();
  await expect.poll(() => made.length, { timeout: 30_000 }).toBe(1);

  // Then signed out: the same report, not paid for by anyone here.
  await page.route("**/api/v1/reports/access", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(NOT_PAID) }),
  );
  await page.reload(); // the result is remembered in this tab
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
  const asked = calls.length;
  await expect(page.locator('[data-card="full-reading"] ol')).toHaveCount(0);
  await page.getByRole("button", { name: "Download PDF" }).click();
  await expect.poll(() => made.length).toBe(2);
  expect(made[1].reading ?? []).toEqual([]);
  expect(calls.length).toBe(asked);
});

/** Lets the chat reach its own route (the agent behind it is away) and keeps what it sends. */
async function watchChat(page: Page): Promise<string[]> {
  await page.unroute("**/api/copilotkit**");
  const runs: string[] = [];
  await page.route("**/api/copilotkit**", (route) => {
    const body = route.request().postData() ?? "";
    if (body.includes('"agent/run"')) runs.push(body);
    return route.continue();
  });
  return runs;
}

/** Types a question in the chat panel and sends it, once the chat knows its agents. */
async function ask(page: Page, question: string) {
  const panel = page.locator(".copilotKitSidebar");
  await panel.locator("textarea").fill(question);
  const send = panel.locator('[data-testid="copilot-send-button"]');
  await expect(send).toBeEnabled();
  await send.click();
}

/** The chat's first call: which agents there are. A question sent before its answer is lost. */
const chatReady = (page: Page) =>
  page.waitForResponse((response) => response.url().includes("/api/copilotkit") && response.ok());

/** The contrast between an element's text and the first background behind it (WCAG). */
const contrast = (page: Page, selector: string) =>
  page.locator(selector).last().evaluate((element) => {
    // Any colour the browser can show, as red, green and blue.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    const rgba = (colour: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = colour;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    let behind: Element | null = element;
    while (behind && rgba(getComputedStyle(behind).backgroundColor)[3] < 255) behind = behind.parentElement;
    const light = (colour: string) => {
      const [r, g, b] = rgba(colour).map((part) => {
        const value = part / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [a, b] = [light(getComputedStyle(element).color), light(getComputedStyle(behind ?? document.body).backgroundColor)];
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });

for (const theme of ["light", "dark"] as const) {
  test(`the person's own chat message is easy to read in the ${theme} theme, on a phone (QA-01)`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: theme });
    await mockAll(page);
    await watchChat(page);
    const ready = chatReady(page);
    await page.goto("/en/porondam");
    await ready;
    await page.getByRole("button", { name: "Ask Astro" }).click();
    await ask(page, "Is this easy to read?");
    const message = ".copilotKitUserMessage .cpk\\:prose";
    await expect(page.locator(message)).toHaveText("Is this easy to read?");
    expect(await contrast(page, message)).toBeGreaterThanOrEqual(4.5);
  });
}

test("Astro is told of a wedding search that is running, and of one that failed (QA-03)", async ({ page }) => {
  await mockAll(page);
  const runs = await watchChat(page);
  let release = () => {};
  await page.route("**/api/v1/wedding-nakath", async (route) => {
    await new Promise<void>((resolve) => (release = resolve));
    await route.fulfill({ status: 500, body: "" });
  });
  const ready = chatReady(page);
  await quickMatch(page);
  await ready;
  const section = page.locator('[data-card="wedding"]');
  await section.getByLabel("Homecoming").uncheck();
  await section.getByRole("button", { name: "Find dates" }).click();
  await expect(section.locator("[data-progress]")).toBeVisible();

  await page.getByRole("button", { name: "Ask Astro" }).click();
  await ask(page, "Is the wedding search still running?");
  await expect.poll(() => runs.length).toBeGreaterThan(0);
  expect(runs.at(-1)).toContain("this search is running now on the page");
  expect(runs.at(-1)).toContain("Poruwa ceremony");
  expect(runs.at(-1)).toContain("Colombo (used when no place is chosen)");

  release();
  await expect(section.getByRole("alert")).toHaveText("We could not search. Please try again.");
  const before = runs.length;
  await ask(page, "And now?");
  await expect.poll(() => runs.length).toBeGreaterThan(before);
  expect(runs.at(-1)).toContain("the last search did not finish");
  expect(runs.at(-1)).not.toContain("this search is running now");
});

/** A chat run as the agent streams it: one show_visual call, then a line of text. */
function shows(body: string, visual: string, run: number): string {
  const id = /\\"visuals\\":\{\\"id\\":\\"([\w-]+)\\"/.exec(body)?.[1];
  const { threadId, runId } = (JSON.parse(body) as { body: { threadId: string; runId: string } }).body;
  const events = [
    { type: "RUN_STARTED", threadId, runId },
    { type: "TOOL_CALL_START", toolCallId: `t${run}`, toolCallName: "show_visual", parentMessageId: `a${run}` },
    { type: "TOOL_CALL_ARGS", toolCallId: `t${run}`, delta: JSON.stringify({ visual }) },
    { type: "TOOL_CALL_END", toolCallId: `t${run}` },
    { type: "TOOL_CALL_RESULT", messageId: `r${run}`, toolCallId: `t${run}`, role: "tool", content: JSON.stringify({ shown: visual, page: id }) },
    { type: "TEXT_MESSAGE_START", messageId: `b${run}`, role: "assistant" },
    { type: "TEXT_MESSAGE_CONTENT", messageId: `b${run}`, delta: `Answer ${run}.` },
    { type: "TEXT_MESSAGE_END", messageId: `b${run}` },
    { type: "RUN_FINISHED", threadId, runId },
  ];
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
}

test("Astro shows a diagram of the match asked about, and keeps it when another match is opened (docs/24)", async ({ page }) => {
  await mockAll(page);
  await page.unroute("**/api/copilotkit**");
  const runs: string[] = [];
  await page.route("**/api/copilotkit**", (route) => {
    const body = route.request().postData() ?? "";
    if (!body.includes('"agent/run"')) return route.continue();
    // The follow-up buttons' own run, which never counts as a question.
    if (body.includes('"agentId":"suggest"')) return route.fulfill({ status: 404, body: "" });
    runs.push(body);
    return route.fulfill({ contentType: "text/event-stream", body: shows(body, "ring", runs.length) });
  });
  const ready = chatReady(page);
  await quickMatch(page);
  await ready;
  await page.getByRole("button", { name: "Ask Astro" }).click();
  await ask(page, "What does our match mean?");

  const panel = page.locator(".copilotKitSidebar");
  const first = panel.locator('[data-chat-visual="ring"]').first();
  await expect(first.getByRole("heading", { name: "Factors that agree" })).toBeVisible();
  const score = await first.locator("svg").getAttribute("aria-label");
  expect(score).toMatch(/^\d+ of \d+ agree$/);
  await expect(panel.getByText("Answer 1.")).toBeVisible();
  // One question is one run: a diagram never costs a second one.
  expect(runs).toHaveLength(1);
  // Only the diagrams' names and an id go out with the question.
  expect(runs[0]).toContain('\\"offers\\":[\\"people\\",\\"ring\\",\\"checks\\"]');

  // Another match on the page: its own answer, and the first answer keeps the diagram it was given.
  await page.route("**/api/v1/porondam", (route) => {
    const other = JSON.parse(fixture("porondam-quick-en.json")) as { match: { score: { passed: number; total: number } } };
    other.match.score = { passed: 3, total: 16 };
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(other) });
  });
  await page.getByRole("button", { name: "Try another match" }).first().click();
  await page.getByRole("button", { name: "Match the charts" }).click(); // the details are still there
  await ask(page, "And this one?");
  await expect(panel.locator('[data-chat-visual="ring"]')).toHaveCount(2);
  await expect(panel.locator('[data-chat-visual="ring"]').last().locator("svg")).toHaveAttribute("aria-label", "3 of 16 agree");
  await expect(first.locator("svg")).toHaveAttribute("aria-label", score!);
  expect(runs).toHaveLength(2);

  // It fits the narrow panel.
  for (const card of await panel.locator("[data-chat-visual]").all()) {
    expect(await card.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0);
  }
});

test("New chat clears the panel, and the old conversation is not sent again", async ({ page }) => {
  await mockAll(page);
  await page.unroute("**/api/copilotkit**");
  const runs: string[] = [];
  let release = () => {};
  await page.route("**/api/copilotkit**", async (route) => {
    const body = route.request().postData() ?? "";
    if (!body.includes('"agent/run"')) return route.continue();
    if (body.includes('"agentId":"suggest"')) return route.fulfill({ status: 404, body: "" });
    runs.push(body);
    if (runs.length === 1) await new Promise<void>((resolve) => (release = resolve));
    return route.fulfill({ contentType: "text/event-stream", body: shows(body, "ring", runs.length) });
  });
  const ready = chatReady(page);
  await quickMatch(page);
  await ready;
  await page.getByRole("button", { name: "Ask Astro" }).click();
  const panel = page.locator(".copilotKitSidebar");
  const button = panel.getByRole("button", { name: "New chat" });
  // Nothing to clear yet.
  await expect(button).toHaveCount(0);

  await ask(page, "What does our match mean?");
  await expect(button).toBeDisabled(); // while the answer is being written
  release();
  await expect(panel.getByText("Answer 1.")).toBeVisible();
  await expect(panel.locator('[data-chat-visual="ring"]')).toBeVisible();

  await button.click();
  await expect(panel.getByText("What does our match mean?")).toHaveCount(0);
  await expect(panel.locator("[data-chat-visual]")).toHaveCount(0);
  await expect(panel.getByText("This is a fresh start")).toHaveCount(0); // that is the idle reset's line
  await expect(panel.locator("textarea")).toBeFocused();
  await expect(button).toHaveCount(0);
  expect(runs).toHaveLength(1); // clearing asks nothing

  await ask(page, "And the serious checks?");
  await expect(panel.getByText("Answer 2.")).toBeVisible();
  const [first, second] = runs.map((run) => (JSON.parse(run) as { body: { threadId: string; messages: unknown[] } }).body);
  expect(second.threadId).not.toBe(first.threadId);
  expect(second.messages).toHaveLength(1);
  expect(runs[1]).not.toContain("What does our match mean?");
});

test("a chat left for 30 minutes is cleared, and not sent again", async ({ page }) => {
  await page.clock.install();
  await mockAll(page);
  await page.unroute("**/api/copilotkit**");
  const runs: string[] = [];
  await page.route("**/api/copilotkit**", (route) => {
    const body = route.request().postData() ?? "";
    if (!body.includes('"agent/run"')) return route.continue();
    if (body.includes('"agentId":"suggest"')) return route.fulfill({ status: 404, body: "" });
    runs.push(body);
    return route.fulfill({ contentType: "text/event-stream", body: shows(body, "ring", runs.length) });
  });
  const ready = chatReady(page);
  await quickMatch(page);
  await ready;
  await page.getByRole("button", { name: "Ask Astro" }).click();
  const panel = page.locator(".copilotKitSidebar");
  await ask(page, "What does our match mean?");
  await expect(panel.getByText("Answer 1.")).toBeVisible();

  await page.clock.fastForward("29:00");
  await expect(panel.getByText("Answer 1.")).toBeVisible();
  await page.clock.fastForward("01:30");
  await expect(panel.getByText("Your earlier chat was cleared after 30 minutes without use.")).toBeVisible();
  await expect(panel.getByText("Answer 1.")).toHaveCount(0);

  await ask(page, "And now?");
  await expect(panel.getByText("Answer 2.")).toBeVisible();
  expect(runs[1]).not.toContain("What does our match mean?");
});
