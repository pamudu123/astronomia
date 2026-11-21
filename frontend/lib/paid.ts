/**
 * Getting the full report (docs/18, section 4): the price, coupons and unlocking one report.
 *
 * Prices come from the backend, never from this code, so a changed page cannot change a price.
 * There is no payment provider yet: only a coupon that takes 100% off can unlock a report.
 */
import type { components } from "./api-types";
import type { Access } from "./entitlements";
import type { Locale } from "./i18n";
import type { ReportRequest } from "./report";
import { ensureOk } from "./request";

export type Price = components["schemas"]["PriceOut"];
export type CouponQuote = components["schemas"]["CouponQuote"];
export type Unlocked = components["schemas"]["Unlocked"];

const API = "/api/v1";
const JSON_HEADERS = { "content-type": "application/json" };

/** Which features this account has on the report, and its price. */
export async function fetchAccess(report: ReportRequest, init: RequestInit = {}): Promise<Access> {
  const response = await ensureOk(
    await fetch(`${API}/reports/access`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(report),
      cache: "no-store",
      ...init,
    }),
  );
  return (await response.json()) as Access;
}

/** Whether paid features are switched on on the server (off: everyone has every feature). */
export async function fetchPaidReportsOn(kind: ReportRequest["kind"], init: RequestInit = {}): Promise<boolean> {
  const response = await ensureOk(await fetch(`${API}/price?kind=${kind}`, { cache: "no-store", ...init }));
  const body = (await response.json()) as components["schemas"]["ReportPrice"];
  return body.paid_reports;
}

/** The price after a coupon, or why it does not work. Uses nothing up. */
export async function applyCoupon(kind: ReportRequest["kind"], code: string): Promise<CouponQuote> {
  const response = await ensureOk(
    await fetch(`${API}/coupons/apply`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ kind, code }),
    }),
  );
  return (await response.json()) as CouponQuote;
}

/** Unlocks the report with a free coupon. It is kept in My reports as paid. */
export async function unlockReport(report: ReportRequest, code: string): Promise<Unlocked> {
  const response = await ensureOk(
    await fetch(`${API}/reports/unlock`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ report, code }),
    }),
  );
  window.dispatchEvent(new Event("sidera:saved-changed"));
  return (await response.json()) as Unlocked;
}

/** "LKR 800" or "USD 2.50": whole rupees, dollars with their cents. */
export function formatPrice(price: Price, lang: Locale): string {
  const major = price.amount / 100;
  const digits = Number.isInteger(major) ? 0 : 2;
  const number = new Intl.NumberFormat(lang === "si" ? "si-LK" : "en-LK", {
    minimumFractionDigits: digits,
    maximumFractionDigits: 2,
  }).format(major);
  return `${price.currency} ${number}`;
}

/** Codes are compared without case or spaces on the server; this only trims what is sent. */
export function cleanCode(text: string): string {
  return text.trim().slice(0, 100);
}

export const SIGN_IN_EVENT = "sidera:sign-in";

/**
 * Asks the visitor to continue with Google, so a report can be unlocked into their account.
 *
 * TODO(supabase sign in, docs/19 steps 2 to 4): the sign in session builds the real Google
 * button and its action in lib/account.ts. Replace this body with a call to that action.
 * Until then it only announces the wish, so a listener can start sign in once it exists.
 */
export function signInForReport(): void {
  window.dispatchEvent(new Event(SIGN_IN_EVENT));
}
