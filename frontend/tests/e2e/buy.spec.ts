import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type Page, expect, test } from "@playwright/test";

import { SUPABASE, standInSupabase } from "./supabase";

/** Buying a full report (docs/23). The backend's answers are stand-ins. */
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf-8");
const json = (name: string) => ({ contentType: "application/json", body: fixture(name) });
const reply = (status: number, body: unknown) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

const PAYMENT = "3f1c9a52-7d4e-4b0a-9c55-0e6f2b1a8d10";
const SAVED = "8a2d4f6e-1b3c-4d5e-8f70-123456789abc";
const PRICE = { amount: 80_000, currency: "LKR" };
const LOCKED = { paid: false, features: [], paid_reports: true, account: null, price: PRICE, checkout: "mock" };
const FEATURES = ["ai_reading", "ai_explain", "full_detail", "full_pdf"];
const REPORT = {
  kind: "hadahan",
  name: "Nimali",
  birth: { date: "1995-04-19", time: "14:35", place_id: 1241622, lang: "en" },
};
const SAVED_ITEM = { id: SAVED, kind: "hadahan", title: "", created_at: "2026-11-15T08:00:00Z", paid: true };

type Backend = { paid: boolean; status: string; calls: string[]; bodies: Record<string, unknown>[] };

/** A backend that unlocks only when a free code is used or the payment is approved. */
async function standInBackend(page: Page, access: typeof LOCKED | { checkout: null } = LOCKED): Promise<Backend> {
  const state: Backend = { paid: false, status: "pending", calls: [], bodies: [] };
  const locked = { ...LOCKED, ...access };
  const now = () => (state.paid ? { ...locked, paid: true, features: FEATURES, account: "guest" } : locked);
  const payment = () => ({
    id: PAYMENT,
    kind: "hadahan",
    status: state.status,
    price: PRICE,
    percent_off: 20,
    amount: { amount: 64_000, currency: "LKR" },
    provider: "mock",
  });
  await page.route("**/api/v1/**", (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
    state.calls.push(`${request.method()} ${path}`);
    state.bodies.push(body);
    if (path === "/reports/access") return route.fulfill(reply(200, now()));
    if (path === "/coupons/apply") {
      if (body.code === "busy") {
        return route.fulfill(reply(429, { detail: "too many wrong codes: try again in an hour" }));
      }
      const off = { freecode: 100, sidera20: 20 }[String(body.code)];
      if (!off) return route.fulfill(reply(200, { result: "unknown", price: PRICE, new_price: null, discount: null }));
      const left = (PRICE.amount * (100 - off)) / 100;
      return route.fulfill(
        reply(200, {
          result: left ? (locked.checkout ? "discount" : "payment_not_available") : "free",
          percent_off: off,
          price: PRICE,
          discount: { ...PRICE, amount: PRICE.amount - left },
          new_price: { ...PRICE, amount: left },
        }),
      );
    }
    if (path === "/reports/unlock") {
      state.paid = true;
      return route.fulfill(reply(200, { order: {}, saved: SAVED_ITEM, access: now() }));
    }
    if (path === "/checkout") return route.fulfill(reply(201, payment()));
    if (path === `/payments/${PAYMENT}`) return route.fulfill(reply(200, payment()));
    if (path === `/payments/${PAYMENT}/mock`) {
      state.status = String(body.outcome);
      state.paid = state.status === "paid";
      return route.fulfill(reply(200, payment()));
    }
    if (path === "/saved") return route.fulfill(reply(201, { ...SAVED_ITEM, created: true }));
    if (path.startsWith("/labels/")) return route.fulfill(json("labels-en.json"));
    return route.fulfill(reply(404, { detail: "not here" }));
  });
  return state;
}

async function open(page: Page, lang = "en") {
  await page.addInitScript(
    (basket) => sessionStorage.setItem("sidera.buy", basket),
    JSON.stringify({ report: REPORT, kuja: true, back: `/${lang}/hadahan` }),
  );
  await page.goto(`/${lang}/buy`);
}

const order = (page: Page) => page.locator("[data-buy-order]");

async function apply(page: Page, code: string) {
  await order(page).getByLabel("Coupon or discount code").fill(code);
  await order(page).getByRole("button", { name: "Apply" }).click();
}

test("the buying page shows the report, the price and what a code does to it", async ({ page }) => {
  const backend = await standInBackend(page);
  const supabase = await standInSupabase(page);
  await open(page);
  await expect(page.locator("[data-buy-report]")).toContainText("Full hadahan report for Nimali");
  await expect(page.locator("[data-buy-report]")).toContainText("Every Kuja dosha rule, in full");
  await expect(order(page).locator('[data-sum="price"]')).toHaveText("LKR 800");
  await expect(order(page).locator('[data-sum="total"]')).toHaveText("LKR 800");
  await expect(order(page).getByRole("button", { name: "Pay LKR 800" })).toBeVisible();

  await apply(page, "nope");
  await expect(order(page).getByRole("alert")).toHaveText("That code is not right. Check it and try again.");
  await expect(order(page).getByLabel("Coupon or discount code")).toHaveAttribute("aria-invalid", "true");
  await apply(page, "busy");
  await expect(order(page).getByRole("alert")).toContainText("Too many wrong codes");

  await apply(page, "sidera20");
  await expect(order(page).locator("[data-code-applied]")).toContainText("sidera20 applied: 20% off");
  await expect(order(page).locator('[data-sum="discount"]')).toHaveText("− LKR 160");
  await expect(order(page).locator('[data-sum="total"]')).toHaveText("LKR 640");
  await expect(order(page).getByRole("button", { name: "Pay LKR 640" })).toBeVisible();
  await expect(order(page).getByRole("button", { name: "Remove code" })).toBeFocused();

  await order(page).getByRole("button", { name: "Remove code" }).click();
  await expect(order(page).getByLabel("Coupon or discount code")).toBeFocused();
  await expect(order(page).locator('[data-sum="discount"]')).toHaveCount(0);
  await expect(order(page).locator('[data-sum="total"]')).toHaveText("LKR 800");

  // Looking at prices makes no account and buys nothing.
  expect(supabase.calls).toEqual([]);
  expect(backend.calls.filter((call) => /checkout|unlock/.test(call))).toEqual([]);
});

test("a code that leaves nothing to pay unlocks at once, with Google offered after", async ({ page }) => {
  const backend = await standInBackend(page);
  const supabase = await standInSupabase(page);
  await open(page);
  await apply(page, "freecode");
  await expect(order(page).locator('[data-sum="total"]')).toHaveText("LKR 0");
  await order(page).getByRole("button", { name: "Unlock the report" }).click();

  const done = page.locator("[data-buy-done]");
  await expect(done.getByRole("heading", { name: "Your full report is unlocked" })).toBeVisible();
  expect(supabase.guests()).toBe(1); // a guest, with nothing asked
  expect(backend.calls).not.toContain("POST /checkout");
  // Optional: going on without it opens the report.
  const skip = done.getByRole("link", { name: "Continue without signing in" });
  await expect(done.getByRole("link", { name: "Open the report" })).toHaveAttribute("href", `/en/my/${SAVED}`);
  await expect(skip).toHaveAttribute("href", `/en/my/${SAVED}`);
  await done.getByRole("button", { name: "Sign in with Google" }).click();
  await page.waitForURL(`${SUPABASE}/google*`); // linked to the same guest
  expect(supabase.calls.some((call) => call.includes("identities/authorize"))).toBe(true);
});

test("an amount to pay goes through the payment before anything unlocks", async ({ page }) => {
  const backend = await standInBackend(page);
  await standInSupabase(page);
  await open(page);
  await apply(page, "sidera20");
  await expect(order(page).locator("[data-test-mode]")).toContainText("no money is taken");
  await order(page).getByRole("button", { name: "Pay LKR 640" }).click();

  await expect(page).toHaveURL(new RegExp(`/en/buy/test-payment\\?payment=${PAYMENT}$`));
  const test = page.locator("[data-test-payment]");
  await expect(test).toContainText("no money is taken and no card is asked for");
  await expect(test.locator('[data-sum="total"]')).toHaveText("LKR 640");
  expect(backend.paid).toBe(false);
  expect(backend.bodies[backend.calls.indexOf("POST /checkout")]).toEqual({ report: REPORT, code: "sidera20" });

  await test.getByRole("button", { name: "Approve the test payment" }).click();
  await expect(page.locator("[data-buy-done]")).toContainText("Full hadahan report for Nimali is open");
  expect(backend.calls).toContain("POST /saved");
});

for (const [button, title] of [
  ["Decline it", "The payment did not go through"],
  ["Cancel and go back", "The payment was cancelled"],
]) {
  test(`"${button}" unlocks nothing`, async ({ page }) => {
    const backend = await standInBackend(page);
    await standInSupabase(page);
    await open(page);
    await order(page).getByRole("button", { name: "Pay LKR 800" }).click();
    await page.getByRole("button", { name: button }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.locator("[data-buy-done]")).toHaveCount(0);
    expect(backend.calls).not.toContain("POST /saved");
    await page.getByRole("link", { name: "Back to the order" }).click();
    await expect(order(page).getByRole("button", { name: "Pay LKR 800" })).toBeVisible();
  });
}

test("opening the done page by hand unlocks nothing", async ({ page }) => {
  await standInBackend(page);
  await standInSupabase(page);
  await page.goto("/en/buy/done");
  await expect(page.locator('[data-payment="gone"]')).toBeVisible();
  await expect(page.locator("[data-buy-done]")).toHaveCount(0);
});

test("with no way to pay, the report says it stays locked", async ({ page }) => {
  await standInBackend(page, { checkout: null });
  await open(page);
  await expect(order(page).locator("[data-buy-closed]")).toContainText("stays locked");
  await expect(order(page).locator("[data-buy-now]")).toHaveCount(0);
  await apply(page, "sidera20");
  await expect(order(page).locator('[data-sum="total"]')).toHaveText("LKR 640");
  await expect(order(page).locator("[data-buy-now]")).toHaveCount(0);
  await order(page).getByRole("button", { name: "Remove code" }).click();
  await apply(page, "freecode");
  await expect(order(page).getByRole("button", { name: "Unlock the report" })).toBeVisible();
});

test("without a report, the page says how to choose one", async ({ page }) => {
  await standInBackend(page);
  await page.goto("/en/buy");
  await expect(page.locator("[data-buy-empty]")).toContainText("Choose a report first");
});

test("the buying page fits a phone in both languages and both themes", async ({ page }) => {
  await standInBackend(page);
  await page.setViewportSize({ width: 360, height: 800 });
  for (const lang of ["en", "si"]) {
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await open(page, lang);
      await expect(page.locator("[data-buy-order]")).toBeVisible();
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(wide).toBeLessThanOrEqual(0);
    }
  }
});
