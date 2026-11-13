import type { components } from "./api-types";
import type { Locale } from "./i18n";

export type StarMatches = components["schemas"]["StarMatchesResponse"];
export type StarMatch = StarMatches["matches"][number];
export type Role = StarMatches["role"];

/** The path and query of the star match endpoint. A star name is not personal data. */
export function starMatchesPath(star: string, pada: number, role: Role, lang: Locale): string {
  return `/v1/porondam/stars/${encodeURIComponent(star)}?pada=${pada}&role=${role}&lang=${lang}`;
}

export async function fetchStarMatches(
  star: string,
  pada: number,
  role: Role,
  lang: Locale,
): Promise<StarMatches> {
  const response = await fetch(`/api${starMatchesPath(star, pada, role, lang)}`);
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return (await response.json()) as StarMatches;
}

/** A link that opens the quick match with both stars filled in. */
export function quickMatchHref(
  lang: Locale,
  own: { star: string; pada: number },
  partner: { star: string; pada: number },
  role: Role,
): string {
  const [bride, groom] = role === "bride" ? [own, partner] : [partner, own];
  return `/${lang}/porondam?bride=${bride.star}.${bride.pada}&groom=${groom.star}.${groom.pada}`;
}

/** Reads "rohini.2" from a quick match link. Null when it is not a star and a pada. */
export function parseStarParam(value: string | null, stars: readonly string[]) {
  if (!value) return null;
  const [star, padaText] = value.split(".");
  const pada = Number(padaText ?? "1");
  if (!stars.includes(star) || !Number.isInteger(pada) || pada < 1 || pada > 4) return null;
  return { nakshatra: star, pada };
}
