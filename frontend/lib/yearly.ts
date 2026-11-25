/**
 * The yearly forecast. A paid feature, open to everyone for now (docs/07). Everything for it
 * lives in this file, components/yearly and app/[lang]/forecast, so the lock is added in
 * one place: components/yearly/YearlyGate.tsx (and yearly_access() in the backend).
 */
import type { components } from "./api-types";
import type { BirthRequest } from "./hadahan";
import type { Locale } from "./i18n";
import type { SpotName } from "./spots";

export type Year = components["schemas"]["YearOut"];
export type PersonalYear = components["schemas"]["PersonalYearResponse"];

/** The years with a forecast. Must match YEARS in backend/app/engine/yearly.py. */
export const YEARS = [2027];

export const hasYear = (value: string) => YEARS.includes(Number(value)) && /^\d{4}$/.test(value);

export function yearlyPath(year: number, lagna: string, lang: Locale): string {
  return `/v1/yearly/${year}/${encodeURIComponent(lagna)}?lang=${lang}`;
}

export async function fetchYear(year: number, lagna: string, lang: Locale): Promise<Year> {
  const response = await fetch(`/api${yearlyPath(year, lagna, lang)}`);
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return (await response.json()) as Year;
}

/** Birth details go in the body of a POST, never in the URL. */
export async function fetchPersonalYear(year: number, request: BirthRequest, lang: Locale): Promise<PersonalYear> {
  const response = await fetch(`/api/v1/yearly/${year}/personal`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...request, lang }),
  });
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return (await response.json()) as PersonalYear;
}

/** Day of the year (0 based) for a date inside it. */
export function dayOfYear(date: string, year: number): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.UTC(year, 0, 1)) / 86_400_000);
}

export const daysInYear = (year: number) => (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000;

type Stay = Year["planets"][number]["stays"][number];

export type Area = { house: number; visits: { body: string; stay: Stay }[]; days: number; isNew: boolean };

const stayDays = (stay: Stay, year: number) => dayOfYear(stay.end, year) + 1 - dayOfYear(stay.start, year);

/**
 * The year by part of life instead of by planet: each house the slow planets visit, the one
 * they spend the most time in first. `isNew`: none of them was there when the year began.
 */
export function areasOf(year: Year): Area[] {
  const areas = new Map<number, Area>();
  for (const { body, stays } of year.planets) {
    for (const stay of stays) {
      const area = areas.get(stay.house) ?? { house: stay.house, visits: [], days: 0, isNew: true };
      area.visits.push({ body, stay });
      area.days += stayDays(stay, year.year);
      area.isNew &&= !stay.from_before;
      areas.set(stay.house, area);
    }
  }
  return [...areas.values()].sort((a, b) => b.days - a.days || a.house - b.house);
}

/** The picture for each house, 1 to 12 (lib/spots.ts). */
export const AREA_SPOTS: SpotName[] = [
  "sunrise", "family", "road", "lamp", "book", "checklist", "couple", "change", "lotus", "work", "pot", "travel",
];
