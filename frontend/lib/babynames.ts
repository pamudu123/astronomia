/**
 * Starting letters (akuru) for a baby's name, from the birth star and pada. Free.
 * The letter table lives in the backend (rules/name_letters_si_v1.yaml) and is provisional.
 */
import type { components } from "./api-types";
import type { BirthRequest } from "./hadahan";
import type { Locale } from "./i18n";

export type StarLetters = components["schemas"]["StarLettersOut"];
export type StarLettersResponse = components["schemas"]["StarLettersResponse"];
export type AllLetters = components["schemas"]["AllLettersResponse"];
export type BabyLetters = components["schemas"]["BabyLettersResponse"];
export type PadaLetter = components["schemas"]["PadaLetterOut"];

/**
 * The chosen letter for each pada, for page titles and the star list, so they need no
 * backend call. A unit test checks this against backend/app/data/rules/name_letters_si_v1.yaml.
 */
export const STAR_LETTERS: Record<string, [string, string, string, string]> = {
  ashwini: ["චු", "චෙ", "චො", "ල"],
  bharani: ["ලි", "ලු", "ලෙ", "ලො"],
  krittika: ["අ", "ඉ", "උ", "එ"],
  rohini: ["ඔ", "ව", "වි", "වු"],
  mrigashira: ["වෙ", "වො", "ක", "කි"],
  ardra: ["කු", "ඝ", "ඞ", "ඡ"],
  punarvasu: ["කෙ", "කො", "හ", "හි"],
  pushya: ["හු", "හෙ", "හො", "ඩ"],
  ashlesha: ["ඩි", "ඩු", "ඩෙ", "ඩො"],
  magha: ["ම", "මි", "මු", "මෙ"],
  purva_phalguni: ["මො", "ට", "ටි", "ටු"],
  uttara_phalguni: ["ටෙ", "ටො", "ප", "පි"],
  hasta: ["පු", "ෂ", "ණ", "ඨ"],
  chitra: ["පෙ", "පො", "ර", "රි"],
  swati: ["රු", "රෙ", "රො", "ත"],
  vishakha: ["ති", "තු", "තෙ", "තො"],
  anuradha: ["න", "නි", "නු", "නෙ"],
  jyeshtha: ["නො", "ය", "යි", "යු"],
  mula: ["යෙ", "යො", "බ", "බි"],
  purva_ashadha: ["බු", "ධ", "එ", "ඪ"],
  uttara_ashadha: ["බෙ", "බො", "ජ", "ජි"],
  shravana: ["ජු", "ජෙ", "ජො", "ෂ"],
  dhanishta: ["ග", "ගි", "ගු", "ගෙ"],
  shatabhisha: ["ගො", "ස", "සි", "සු"],
  purva_bhadrapada: ["සෙ", "සො", "ද", "දි"],
  uttara_bhadrapada: ["දු", "ථ", "ඣ", "ඤ"],
  revati: ["දෙ", "දො", "ච", "චි"],
};

export const allLettersPath = (lang: Locale) => `/v1/baby/letters?lang=${lang}`;

export const starLettersPath = (star: string, lang: Locale) =>
  `/v1/baby/letters/${encodeURIComponent(star)}?lang=${lang}`;

export async function fetchStarLetters(star: string, lang: Locale): Promise<StarLettersResponse> {
  const response = await fetch(`/api${starLettersPath(star, lang)}`);
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return (await response.json()) as StarLettersResponse;
}

/** Birth details go in the body of a POST, never in the URL. */
export async function fetchBabyLetters(request: BirthRequest, lang: Locale): Promise<BabyLetters> {
  const response = await fetch("/api/v1/baby/letters", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...request, lang }),
  });
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return (await response.json()) as BabyLetters;
}

/** Degrees inside a sign as 3°20′. */
export function degrees(value: number): string {
  const whole = Math.floor(value + 1e-9);
  const minutes = Math.round((value - whole) * 60);
  return minutes === 60 ? `${whole + 1}°00′` : `${whole}°${String(minutes).padStart(2, "0")}′`;
}

export type Names = components["schemas"]["NamesResponse"];
export type NameItem = components["schemas"]["NameOut"];
export type GenderFilter = "any" | "boy" | "girl";
export type LengthFilter = "any" | "short" | "medium" | "long";

/** Letters, gender and length are not birth details, so this is a GET that may be cached. */
export function namesPath(letters: string[], gender: GenderFilter, length: LengthFilter, lang: Locale): string {
  const query = new URLSearchParams();
  for (const letter of letters) query.append("letters", letter);
  if (gender !== "any") query.set("gender", gender);
  if (length !== "any") query.set("length", length);
  query.set("lang", lang);
  return `/v1/baby/names?${query.toString()}`;
}

export async function fetchNames(
  letters: string[],
  gender: GenderFilter,
  length: LengthFilter,
  lang: Locale,
  signal?: AbortSignal,
): Promise<Names> {
  const response = await fetch(`/api${namesPath(letters, gender, length, lang)}`, { signal });
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return (await response.json()) as Names;
}
