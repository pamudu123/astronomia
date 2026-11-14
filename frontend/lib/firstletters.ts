/**
 * First letters ceremony (akuru kiyaweema) finder. Free for now (docs/07, section 4.8).
 * Everything for it lives in this file, components/firstletters and app/[lang]/first-letters,
 * so a paid lock can go in one place: components/firstletters/FirstLettersGate.tsx
 * (and first_letters_access() in the backend).
 */
import type { components } from "./api-types";
import type { BirthRequest } from "./hadahan";
import type { Locale } from "./i18n";
import { SEARCH_TIMEOUT_MS, ensureOk } from "./request";

export type FirstLetters = components["schemas"]["FirstLettersResponse"];
export type FirstLettersSuggestion = FirstLetters["suggestions"][number];
export type Months = 1 | 3 | 6;

/** Must match search_months in backend/app/data/rules/first_letters_si_v1.yaml. */
export const MONTHS: Months[] = [1, 3, 6];

/** The child: full birth details, or a birth star and pada (with the birth date if known). */
export type Child =
  | { mode: "full"; request: BirthRequest }
  | { mode: "star"; nakshatra: string; pada: number; birthDate?: string };

export type FirstLettersOptions = { months: Months; placeId?: number };

/** The child's birth details go in the body of a POST, never in the URL. */
export async function fetchFirstLetters(child: Child, options: FirstLettersOptions, lang: Locale): Promise<FirstLetters> {
  const body =
    child.mode === "full"
      ? { child: child.request }
      : {
          child: { nakshatra: child.nakshatra, pada: child.pada },
          ...(child.birthDate ? { birth_date: child.birthDate } : {}),
        };
  const response = await fetch("/api/v1/first-letters", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...body,
      months: options.months,
      ...(options.placeId ? { place_id: options.placeId } : {}),
      lang,
    }),
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });
  await ensureOk(response);
  return (await response.json()) as FirstLetters;
}
