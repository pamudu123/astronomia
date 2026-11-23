/**
 * Wedding nakath finder. A paid feature, open to everyone for now (docs/07). Everything for it
 * lives in this file and components/wedding, so the lock goes in one place:
 * components/wedding/WeddingGate.tsx (and wedding_access() in the backend).
 */
import type { components } from "./api-types";
import { type Place, loadSession, saveSession } from "./hadahan";
import type { Locale } from "./i18n";
import type { PorondamRequest } from "./porondam";
import { SEARCH_TIMEOUT_MS, ensureOk } from "./request";

export type Wedding = components["schemas"]["WeddingResponse"];
export type WeddingCeremony = Wedding["ceremonies"][number];
export type WeddingSuggestion = WeddingCeremony["suggestions"][number];
export type Ceremony = "engagement" | "poruwa" | "homecoming";
export type Months = 3 | 6 | 12 | 24;

export const CEREMONIES: Ceremony[] = ["engagement", "poruwa", "homecoming"];
export const MONTHS: Months[] = [3, 6, 12, 24];

export type WeddingOptions = {
  months: Months;
  ceremonies: Ceremony[];
  placeId?: number;
  /** The first day to search, to find the same dates again. Today when not given. */
  from?: string;
};

/** The couple's birth details go in the body of a POST, never in the URL. */
export async function fetchWedding(request: PorondamRequest, options: WeddingOptions, lang: Locale): Promise<Wedding> {
  const response = await fetch("/api/v1/wedding-nakath", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      bride: request.bride,
      groom: request.groom,
      months: options.months,
      ceremonies: options.ceremonies,
      ...(options.placeId ? { place_id: options.placeId } : {}),
      ...(options.from ? { as_of: options.from } : {}),
      lang,
    }),
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });
  await ensureOk(response);
  return (await response.json()) as Wedding;
}

/** What a search looks for. */
export type WeddingChoice = { months: Months; ceremonies: Ceremony[]; place: Place | null };

/**
 * The search made for a match, kept for this tab only, so changing the language (or a reload)
 * keeps the dates (QA-04). Like the match itself, it is never sent anywhere else.
 */
export type SavedSearch = WeddingChoice & {
  match: string;
  /** The first day searched, once known: the same search in another language starts there too. */
  first: string | null;
  results: Partial<Record<Locale, Wedding>>;
};

const WEDDING_KEY = "astronomia.wedding";

/** Which match a search belongs to. */
export const matchKey = (request: PorondamRequest) => JSON.stringify([request.bride, request.groom]);

export function loadSearch(match: string): SavedSearch | null {
  const saved = loadSession<SavedSearch>(WEDDING_KEY);
  return saved?.match === match ? saved : null;
}

/** A search has started: it takes the place of an earlier one. */
export function startSearch(match: string, choice: WeddingChoice): void {
  saveSession<SavedSearch>(WEDDING_KEY, { ...choice, match, first: null, results: {} });
}

/** Keeps the dates found, unless another match's search has taken its place meanwhile. */
export function keepSearch(match: string, choice: WeddingChoice, lang: Locale, found: Wedding): void {
  const saved = loadSearch(match);
  if (!saved) return;
  const same = JSON.stringify([saved.months, saved.ceremonies, saved.place?.id]) === JSON.stringify([choice.months, choice.ceremonies, choice.place?.id]);
  if (!same) return;
  saveSession<SavedSearch>(WEDDING_KEY, { ...saved, first: found.first ?? null, results: { ...saved.results, [lang]: found } });
}

/** A first search that failed leaves nothing to bring back. One that had dates keeps them. */
export function dropFailedSearch(match: string): void {
  const saved = loadSearch(match);
  if (saved && Object.keys(saved.results).length === 0) saveSession(WEDDING_KEY, null);
}
