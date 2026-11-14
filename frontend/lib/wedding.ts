/**
 * Wedding nakath finder. A paid feature, open to everyone for now (docs/07). Everything for it
 * lives in this file and components/wedding, so the lock goes in one place:
 * components/wedding/WeddingGate.tsx (and wedding_access() in the backend).
 */
import type { components } from "./api-types";
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

export type WeddingOptions = { months: Months; ceremonies: Ceremony[]; placeId?: number };

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
      lang,
    }),
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });
  await ensureOk(response);
  return (await response.json()) as Wedding;
}
