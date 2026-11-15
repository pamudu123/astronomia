/**
 * My reports (docs/14). The first Save makes a quiet guest account: an HttpOnly cookie the
 * backend sets, tied to this browser. Nobody signs up. Google sign in comes later, at payment.
 */
import type { components } from "./api-types";
import type { BirthRequest } from "./hadahan";
import type { Locale } from "./i18n";
import type { PersonInput, PorondamRequest } from "./porondam";
import type { ReportRequest } from "./report";
import { ensureOk } from "./request";

export type SavedItem = components["schemas"]["SavedOut"];
export type SavedCreated = components["schemas"]["SavedCreated"];
export type SavedDetail = components["schemas"]["SavedDetail"];

const API = "/api/v1";
const JSON_HEADERS = { "content-type": "application/json" };

/** Saves a result. Saving one already kept answers with that one (`created` is false). */
export async function saveReport(body: ReportRequest): Promise<SavedCreated> {
  const response = await ensureOk(
    await fetch(`${API}/saved`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) }),
  );
  announce();
  return (await response.json()) as SavedCreated;
}

export async function listSaved(): Promise<SavedItem[]> {
  const response = await ensureOk(await fetch(`${API}/saved`, { cache: "no-store" }));
  const body = (await response.json()) as { reports: SavedItem[] };
  announce();
  return body.reports;
}

export async function getSaved(id: string, lang: Locale): Promise<SavedDetail> {
  const url = `${API}/saved/${encodeURIComponent(id)}?lang=${lang}`;
  const response = await ensureOk(await fetch(url, { cache: "no-store" }));
  return (await response.json()) as SavedDetail;
}

export async function renameSaved(id: string, title: string): Promise<void> {
  await ensureOk(
    await fetch(`${API}/saved/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ title }),
    }),
  );
}

export async function deleteSaved(id: string): Promise<void> {
  const response = await fetch(`${API}/saved/${encodeURIComponent(id)}`, { method: "DELETE" });
  // Already gone counts as deleted.
  if (response.status !== 404) await ensureOk(response);
  announce();
}

/** Deletes the guest account on this browser and every report in it. */
export async function deleteEverything(): Promise<void> {
  await ensureOk(await fetch(`${API}/me`, { method: "DELETE" }));
  announce();
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
