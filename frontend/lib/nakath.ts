import type { components } from "./api-types";
import type { Locale } from "./i18n";

export type Panchanga = components["schemas"]["PanchangaResponse"];
export type PanchangaPart = components["schemas"]["PanchangaPartOut"];
export type LocalTime = components["schemas"]["LocalTimeOut"];
export type Avurudu = components["schemas"]["AvuruduResponse"];
export type AvuruduItem = components["schemas"]["AvuruduItemOut"];
export type BothTimes = components["schemas"]["BothTimes"];

export const SRI_LANKA = "Asia/Colombo";
export const COLOMBO = 1248991;

/** Years with an Avurudu page. Official lists exist up to 2027; later years are calculated. */
export const AVURUDU_YEARS = [2022, 2023, 2024, 2025, 2026, 2027, 2028];
/** The next new year, which the home page and the city pages point to. */
export const FEATURED_YEAR = 2027;

export const hasAvuruduYear = (value: string) =>
  /^\d{4}$/.test(value) && AVURUDU_YEARS.includes(Number(value));

/** Cities with many Sri Lankans, each with its own page for search. */
export type City = { key: string; timezone: string; en: string; si: string };
export const CITIES: City[] = [
  { key: "london", timezone: "Europe/London", en: "London", si: "ලන්ඩන්" },
  { key: "melbourne", timezone: "Australia/Melbourne", en: "Melbourne", si: "මෙල්බර්න්" },
  { key: "sydney", timezone: "Australia/Sydney", en: "Sydney", si: "සිඩ්නි" },
  { key: "perth", timezone: "Australia/Perth", en: "Perth", si: "පර්ත්" },
  { key: "auckland", timezone: "Pacific/Auckland", en: "Auckland", si: "ඕක්ලන්ඩ්" },
  { key: "toronto", timezone: "America/Toronto", en: "Toronto", si: "ටොරොන්ටෝ" },
  { key: "new-york", timezone: "America/New_York", en: "New York", si: "නිව් යෝර්ක්" },
  { key: "los-angeles", timezone: "America/Los_Angeles", en: "Los Angeles", si: "ලොස් ඇන්ජලීස්" },
  { key: "dubai", timezone: "Asia/Dubai", en: "Dubai", si: "ඩුබායි" },
  { key: "doha", timezone: "Asia/Qatar", en: "Doha", si: "දෝහා" },
  { key: "kuwait", timezone: "Asia/Kuwait", en: "Kuwait", si: "කුවේට්" },
  { key: "riyadh", timezone: "Asia/Riyadh", en: "Riyadh", si: "රියාද්" },
  { key: "tel-aviv", timezone: "Asia/Jerusalem", en: "Tel Aviv", si: "ටෙල් අවිව්" },
  { key: "milan", timezone: "Europe/Rome", en: "Milan", si: "මිලාන්" },
  { key: "paris", timezone: "Europe/Paris", en: "Paris", si: "පැරිස්" },
  { key: "singapore", timezone: "Asia/Singapore", en: "Singapore", si: "සිංගප්පූරුව" },
  { key: "seoul", timezone: "Asia/Seoul", en: "Seoul", si: "සෝල්" },
  { key: "tokyo", timezone: "Asia/Tokyo", en: "Tokyo", si: "ටෝකියෝ" },
];

export const findCity = (key: string) => CITIES.find((city) => city.key === key);

/** A time zone is not personal, so these are GET requests that may be cached. */
export function avuruduPath(year: number, timezone: string, lang: Locale): string {
  return `/v1/avurudu/${year}?${new URLSearchParams({ timezone, lang })}`;
}

export type PlaceChoice = { placeId: number } | { latitude: number; longitude: number; timezone: string };

export function panchangaPath(day: string, place: PlaceChoice, lang: Locale): string {
  const query: Record<string, string> =
    "placeId" in place
      ? { date: day, place_id: String(place.placeId), lang }
      : {
          date: day,
          latitude: String(place.latitude),
          longitude: String(place.longitude),
          timezone: place.timezone,
          lang,
        };
  return `/v1/panchanga?${new URLSearchParams(query)}`;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`/api${path}`);
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return (await response.json()) as T;
}

export const fetchAvurudu = (year: number, timezone: string, lang: Locale) =>
  getJson<Avurudu>(avuruduPath(year, timezone, lang));

export const fetchPanchanga = (day: string, place: PlaceChoice, lang: Locale) =>
  getJson<Panchanga>(panchangaPath(day, place, lang));

/** The browser's own time zone, or null when it cannot tell. */
export function browserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** Today's date in a time zone, as YYYY-MM-DD. */
export function todayIn(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
}

export const isIsoDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
