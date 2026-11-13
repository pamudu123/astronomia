/**
 * The yearly forecast. A paid feature, open to everyone for now (docs/07). Everything for it
 * lives in this file, components/yearly and app/[lang]/forecast, so the lock is added in
 * one place: components/yearly/YearlyGate.tsx (and yearly_access() in the backend).
 */
import type { components } from "./api-types";
import type { BirthRequest } from "./hadahan";
import type { Locale } from "./i18n";

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
