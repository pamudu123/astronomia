/**
 * Buying a full report (docs/23): which report is being bought, and paying for it.
 *
 * The buying page is told the report through this tab's storage, never the address: birth
 * details stay out of addresses, history and server logs. The prices and the amount to pay come
 * from the backend, and only the backend unlocks anything.
 */
import { accountCall, oneSaveAtATime } from "./account";
import type { components } from "./api-types";
import { loadSession, saveSession } from "./hadahan";
import type { Locale } from "./i18n";
import type { ReportRequest } from "./report";
import { ensureOk } from "./request";
import { safeNext } from "./supabase";

export type Payment = components["schemas"]["PaymentOut"];
export type Outcome = components["schemas"]["MockResult"]["outcome"];

/** The report on its way to being bought. */
export type Basket = {
  report: ReportRequest;
  /** The chart has Kuja dosha, whose rules the full report opens. */
  kuja: boolean;
  /** The page it was on, to go back to. */
  back: string;
};

const KEY = "sidera.buy";

export const buyPath = (lang: Locale) => `/${lang}/buy`;
export const testPaymentPath = (lang: Locale, id: string) => `/${lang}/buy/test-payment?payment=${id}`;
export const donePath = (lang: Locale, id: string) => `/${lang}/buy/done?payment=${id}`;

export function keepBasket(basket: Basket): void {
  saveSession(KEY, basket);
}

/** The report being bought in this tab, or null: opened by its address, or storage is off. */
export function loadBasket(): Basket | null {
  const found = loadSession<Partial<Basket>>(KEY);
  const kind = found?.report?.kind;
  if (!found?.report || (kind !== "hadahan" && kind !== "porondam")) return null;
  return { report: found.report, kuja: found.kuja === true, back: found.back ?? "" };
}

/** Where "Back" goes: the page the report was on, on this site. */
export function backOf(basket: Basket, lang: Locale): string {
  return basket.back ? safeNext(basket.back, lang) : `/${lang}/${basket.report.kind}`;
}

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** The payment named in the page's address, if any. */
export function paymentInAddress(search: string): string | null {
  const id = new URLSearchParams(search).get("payment") ?? "";
  return UUID.test(id) ? id : null;
}

/**
 * Starts paying for the report, as a guest if nobody is signed in here. Unlocks nothing: the
 * backend works out the amount, and waits for the provider to say it was paid.
 */
export function startPayment(report: ReportRequest, code: string | null): Promise<Payment> {
  return oneSaveAtATime(async () => {
    const response = await ensureOk(
      await accountCall("/checkout", { method: "POST", body: { report, code }, signIn: true }),
    );
    return (await response.json()) as Payment;
  });
}

export async function getPayment(id: string): Promise<Payment> {
  const response = await ensureOk(await accountCall(`/payments/${encodeURIComponent(id)}`));
  return (await response.json()) as Payment;
}

/** Ends a test payment, on the stand-in provider's page. No money is taken. */
export async function finishTestPayment(id: string, outcome: Outcome): Promise<Payment> {
  const response = await ensureOk(
    await accountCall(`/payments/${encodeURIComponent(id)}/mock`, { method: "POST", body: { outcome } }),
  );
  return (await response.json()) as Payment;
}
