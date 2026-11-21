/**
 * Getting the full report (docs/18, section 4): the price, coupons and unlocking one report.
 *
 * Prices come from the backend, never from this code, so a changed page cannot change a price.
 * There is no payment provider yet: only a coupon that takes 100% off can unlock a report.
 */
import { TOKEN_HEADER, saveReport } from "./account";
import type { components } from "./api-types";
import type { Access } from "./entitlements";
import type { Locale } from "./i18n";
import type { ReportRequest } from "./report";
import { ensureOk } from "./request";
import { accessToken, continueWithGoogle, signInConfigured } from "./supabase";

export type Price = components["schemas"]["PriceOut"];
export type CouponQuote = components["schemas"]["CouponQuote"];
export type Unlocked = components["schemas"]["Unlocked"];

const API = "/api/v1";
const JSON_HEADERS = { "content-type": "application/json" };

/** True when Supabase has kept a sign in in this browser, read without loading its script. */
function maybeSignedIn(): boolean {
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i) ?? "";
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) return true;
    }
  } catch {
    // Storage blocked: nobody can be signed in here either.
  }
  return false;
}

/**
 * This browser's Supabase access token, in the header the site's /api forward hands on to the
 * backend (lib/account.ts, proxy.ts). Empty when nobody is signed in: then the Supabase script
 * is not even loaded.
 */
export async function accountHeaders(): Promise<Record<string, string>> {
  if (!signInConfigured() || !maybeSignedIn()) return {};
  try {
    const token = await accessToken();
    return token ? { [TOKEN_HEADER]: token } : {};
  } catch {
    return {};
  }
}

/** Which features this account has on the report, and its price. */
export async function fetchAccess(report: ReportRequest, init: RequestInit = {}): Promise<Access> {
  const response = await ensureOk(
    await fetch(`${API}/reports/access`, {
      method: "POST",
      headers: { ...JSON_HEADERS, ...(await accountHeaders()) },
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
      headers: { ...JSON_HEADERS, ...(await accountHeaders()) },
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
      headers: { ...JSON_HEADERS, ...(await accountHeaders()) },
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

/**
 * "Continue with Google" from a result, so the report can be unlocked into a Google account.
 *
 * A result page lives only in this tab, and Google sends the browser back by address. So the
 * report is saved first (as a guest, if nobody is signed in), and Google brings the visitor back
 * to it in My reports. Linking Google keeps the guest's reports (lib/supabase.ts).
 */
export async function signInForReport(lang: Locale, report: ReportRequest): Promise<void> {
  let back = typeof window === "undefined" ? `/${lang}/my` : window.location.pathname;
  try {
    const saved = await saveReport(report);
    back = `/${lang}/my/${saved.id}`;
  } catch {
    // My reports is full or saving failed: come back to this page instead.
  }
  await continueWithGoogle(lang, back);
}
