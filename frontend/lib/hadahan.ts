import type { components } from "./api-types";
import type { Locale } from "./i18n";

export type Hadahan = components["schemas"]["HadahanResponse"];
export type Chart = NonNullable<Hadahan["chart"]>;
export type Planet = Chart["planets"][number];
export type Dasha = NonNullable<Hadahan["dasha"]>;
export type Period = Dasha["periods"][number];
export type Kuja = NonNullable<Hadahan["kuja"]>;
export type Place = components["schemas"]["PlaceOut"];
export type TimeResult = components["schemas"]["TimeResolveResponse"];

/** Names served by GET /v1/labels/{lang}. */
export type Labels = {
  rashi: Record<string, { name: string; western: string }>;
  nakshatra: Record<string, string>;
  planet: Record<string, { name: string; short: string }>;
  point: Record<string, string>;
  kuja_rule: Record<string, string>;
  house: string[];
};

export type BirthRequest = {
  date: string;
  time: string;
  place_id?: number;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  fold?: 0 | 1;
};

export type SavedResult = {
  name: string;
  placeLabel: string;
  request: BirthRequest;
  result: Hadahan;
};

const API = "/api";

async function getJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = new Error(`request failed: ${response.status}`) as Error & { status: number };
    error.status = response.status;
    throw error;
  }
  return (await response.json()) as T;
}

export async function fetchLabels(lang: Locale): Promise<Labels> {
  return getJson<Labels>(await fetch(`${API}/v1/labels/${lang}`));
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const url = `${API}/v1/places?${new URLSearchParams({ q: query, limit: "8" })}`;
  const body = await getJson<{ places: Place[] }>(await fetch(url, { signal }));
  return body.places;
}

/** Birth details go in the body of a POST, never in the URL. */
export async function resolveTime(request: BirthRequest, signal?: AbortSignal): Promise<TimeResult> {
  return getJson<TimeResult>(
    await fetch(`${API}/v1/time/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal,
    }),
  );
}

export async function fetchHadahan(request: BirthRequest, lang: Locale): Promise<Hadahan> {
  return getJson<Hadahan>(
    await fetch(`${API}/v1/hadahan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...request, lang }),
    }),
  );
}

/** "{name}'s hadahan" with {name} filled in. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

// Sinhala month names, written out here because not every browser ships Sinhala date data.
const SI_MONTHS = [
  "ජනවාරි",
  "පෙබරවාරි",
  "මාර්තු",
  "අප්‍රේල්",
  "මැයි",
  "ජූනි",
  "ජූලි",
  "අගෝස්තු",
  "සැප්තැම්බර්",
  "ඔක්තෝබර්",
  "නොවැම්බර්",
  "දෙසැම්බර්",
];

function utcParts(value: string | Date): { day: number; month: number; year: number } {
  const date = typeof value === "string" ? new Date(value) : value;
  return { day: date.getUTCDate(), month: date.getUTCMonth(), year: date.getUTCFullYear() };
}

/** "19 April 1995" or "1995 අප්‍රේල් 19" */
export function formatDate(value: string | Date, lang: Locale): string {
  const { day, month, year } = utcParts(value);
  if (lang === "si") return `${year} ${SI_MONTHS[month]} ${day}`;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month, day)));
}

export function formatYear(value: string): string {
  return String(utcParts(value).year);
}

/** "Aug 2026" or "2026 අගෝස්තු" */
export function formatMonthYear(value: string, lang: Locale): string {
  const { month, year } = utcParts(value);
  if (lang === "si") return `${year} ${SI_MONTHS[month]}`;
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month, 1)),
  );
}

/** 21.254 -> "21° 15′" */
export function formatDegree(degree: number): string {
  let whole = Math.floor(degree);
  let minutes = Math.round((degree - whole) * 60);
  if (minutes === 60) {
    whole += 1;
    minutes = 0;
  }
  return `${whole}° ${String(minutes).padStart(2, "0")}′`;
}

const STORAGE_KEY = "astronomia.hadahan";

/** Keeps the last result for this tab only, so a reload does not lose it. Never sent anywhere. */
export function saveResult(saved: SavedResult | null): void {
  try {
    if (saved) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode). The page works without it.
  }
}

export function loadResult(): SavedResult | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedResult) : null;
  } catch {
    return null;
  }
}

export const RASHI_ORDER = [
  "mesha",
  "vrishabha",
  "mithuna",
  "kataka",
  "simha",
  "kanya",
  "tula",
  "vrischika",
  "dhanu",
  "makara",
  "kumbha",
  "meena",
] as const;
