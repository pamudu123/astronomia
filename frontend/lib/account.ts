/**
 * My reports (docs/16, docs/19). The first Save signs this browser in to Supabase as a guest
 * (lib/supabase.ts); nobody signs up. Every account call then carries the access token, and the
 * backend finds the account from it. "Continue with Google" keeps the same account on any device.
 */
import type { Dictionary } from "@/app/[lang]/dictionaries";

import type { components } from "./api-types";
import { type BirthRequest, fill } from "./hadahan";
import type { Locale } from "./i18n";
import type { PersonInput, PorondamRequest } from "./porondam";
import type { ReportRequest } from "./report";
import { ensureOk } from "./request";
import { accessToken, signInConfigured, signedInToken, supabase } from "./supabase";

export type SavedItem = components["schemas"]["SavedOut"];
export type SavedCreated = components["schemas"]["SavedCreated"];
export type SavedDetail = components["schemas"]["SavedDetail"];

const API = "/api/v1";
const JSON_HEADERS = { "content-type": "application/json" };
/**
 * The header the access token travels in to the site's /api forward, which hands it on to the
 * backend as `Authorization: Bearer` (proxy.ts). Not Authorization itself: on a private
 * staging site that header carries the staging password.
 */
export const TOKEN_HEADER = "X-Sidera-Token";

type Call = { method?: string; body?: unknown; signIn?: boolean };

/**
 * A call to the account API with this browser's access token. With `signIn`, a browser with no
 * sign in becomes a guest first. A token the backend refuses (a deleted account, a sign in
 * revoked elsewhere) signs this browser out, and a call that may sign in tries once more.
 */
export async function accountCall(path: string, { method = "GET", body, signIn = false }: Call = {}): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const token = signIn ? await signedInToken() : await accessToken();
    const headers: Record<string, string> = body === undefined ? {} : { ...JSON_HEADERS };
    if (token) headers[TOKEN_HEADER] = token;
    const response = await fetch(`${API}${path}`, {
      method,
      headers,
      cache: "no-store",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status !== 401 || !token) return response;
    await signOutHere();
    if (!signIn || attempt > 0) return response;
  }
}

/** Forgets the sign in on this browser only. */
export async function signOutHere(): Promise<void> {
  if (signInConfigured()) await (await supabase()).auth.signOut({ scope: "local" });
  announce();
}

/** "Sign out everywhere": ends the sign in on every device, this one included. */
export async function signOutEverywhere(): Promise<void> {
  if (signInConfigured()) await (await supabase()).auth.signOut({ scope: "global" });
  announce();
}

export type Merged = components["schemas"]["MergeOut"];

/**
 * Moves the reports a guest saved on this browser into the Google account just signed in to
 * (it existed already, so Supabase could not link it). The backend checks both sign ins.
 */
export async function mergeGuest(guestToken: string): Promise<Merged> {
  const response = await ensureOk(await accountCall("/me/merge-guest", { method: "POST", body: { guest_token: guestToken } }));
  announce();
  return (await response.json()) as Merged;
}

/** Saves a result. Saving one already kept answers with that one (`created` is false). */
export function saveReport(body: ReportRequest): Promise<SavedCreated> {
  return oneSaveAtATime(async () => {
    const response = await ensureOk(await accountCall("/saved", { method: "POST", body, signIn: true }));
    announce();
    return (await response.json()) as SavedCreated;
  });
}

export const SAVE_LOCK = "sidera-save";
let saving: Promise<unknown> = Promise.resolve();

/**
 * Saves wait for each other across every tab of this browser. A first save signs the browser
 * in as a guest; a second save sent before that sign in is kept would make a second guest, and
 * the browser keeps only one of the two. Browsers without Web Locks queue saves within the tab.
 */
export function oneSaveAtATime<T>(work: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  if (locks) return locks.request(SAVE_LOCK, () => work()).then((value) => value);
  const next = saving.then(work, work);
  saving = next.catch(() => undefined);
  return next;
}

export type SavedList = components["schemas"]["SavedList"];

/** Every report kept, newest first, with how many free ones may be kept at a time. */
export async function listSaved(): Promise<SavedList> {
  const response = await ensureOk(await accountCall("/saved"));
  const body = (await response.json()) as SavedList;
  announce();
  return body;
}

const DAY = 24 * 60 * 60 * 1000;
/** A free report this close to being deleted asks to be kept (docs/18, section 3). */
export const REMIND_DAYS = 2;

export type Keep = { kind: "paid" } | { kind: "free"; days: number; soon: boolean };

/**
 * How long a saved report is kept. A paid one for as long as the account exists; a free one
 * until it is deleted, 7 days after saving. Days are counted up: "1 day" means within a day.
 */
export function keepOf(item: Pick<SavedItem, "paid" | "expires_at">, now: Date = new Date()): Keep {
  if (item.paid || !item.expires_at) return { kind: "paid" };
  const left = new Date(item.expires_at).getTime() - now.getTime();
  const days = Math.max(1, Math.ceil(left / DAY));
  return { kind: "free", days, soon: days <= REMIND_DAYS };
}

type KeepText = Dictionary["saved"];

/** "Paid", or "Free · deleted in N days" (docs/18, section 3). */
export function keepLabel(keep: Keep, t: KeepText): string {
  if (keep.kind === "paid") return t.labelPaid;
  return keep.days === 1 ? t.labelFreeOne : fill(t.labelFree, { days: keep.days });
}

/** The reminder on a free report with 2 days or less left. */
export function keepReminder(keep: Keep, t: KeepText): string | null {
  if (keep.kind !== "free" || !keep.soon) return null;
  return keep.days === 1 ? t.expiringOne : fill(t.expiring, { days: keep.days });
}

export async function getSaved(id: string, lang: Locale): Promise<SavedDetail> {
  const response = await ensureOk(await accountCall(`/saved/${encodeURIComponent(id)}?lang=${lang}`));
  return (await response.json()) as SavedDetail;
}

export async function renameSaved(id: string, title: string): Promise<void> {
  await ensureOk(await accountCall(`/saved/${encodeURIComponent(id)}`, { method: "PATCH", body: { title } }));
}

export async function deleteSaved(id: string): Promise<void> {
  const response = await accountCall(`/saved/${encodeURIComponent(id)}`, { method: "DELETE" });
  // Already gone counts as deleted.
  if (response.status !== 404) await ensureOk(response);
  announce();
}

/** Deletes the signed in account and every report in it, then signs this browser out. */
export async function deleteEverything(): Promise<void> {
  const response = await accountCall("/me", { method: "DELETE" });
  // Nobody signed in here: there is nothing to delete.
  if (response.status !== 401) await ensureOk(response);
  await signOutHere();
}

// The backend also sets a small cookie, "sidera_saved=1", while this browser keeps reports. It
// holds no id, and lets the header show "My reports" without waking the backend on every page.
const HINT = "sidera_saved=1";
const CHANGED = "sidera:saved-changed";

function announce(): void {
  window.dispatchEvent(new Event(CHANGED));
}

export function hasSavedReports(): boolean {
  try {
    return document.cookie.split("; ").includes(HINT);
  } catch {
    return false;
  }
}

export function onSavedChange(callback: () => void): () => void {
  window.addEventListener(CHANGED, callback);
  window.addEventListener("focus", callback);
  return () => {
    window.removeEventListener(CHANGED, callback);
    window.removeEventListener("focus", callback);
  };
}

// A saved request comes back as the API describes it, with nulls where the forms leave a
// field out. These give the forms' own shapes back, for the PDF and Share buttons.

type ApiBirth = components["schemas"]["HadahanRequest"];
type ApiMatch = components["schemas"]["PorondamRequest"];

/** Leaves out empty fields and the language, which the page adds itself. */
function formFields(value: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([key, v]) => key !== "lang" && v !== null && v !== undefined),
  );
}

export function birthOf(birth: ApiBirth): BirthRequest {
  return formFields(birth) as BirthRequest;
}

export function matchOf(match: ApiMatch): PorondamRequest {
  return {
    bride: formFields(match.bride) as PersonInput,
    groom: formFields(match.groom) as PersonInput,
  };
}
