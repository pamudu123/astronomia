import { RASHI } from "./rashi";

export type Nakshatra = { key: string; en: string; si: string };

/**
 * The 27 birth stars in order. The names match the backend label files
 * (a unit test compares them), so pages can be titled without calling the backend.
 */
export const NAKSHATRA: Nakshatra[] = [
  { key: "ashwini", en: "Ashwini", si: "අස්විද" },
  { key: "bharani", en: "Bharani", si: "බෙරණ" },
  { key: "krittika", en: "Krittika", si: "කැති" },
  { key: "rohini", en: "Rohini", si: "රෙහෙණ" },
  { key: "mrigashira", en: "Mrigashira", si: "මුවසිරස" },
  { key: "ardra", en: "Ardra", si: "අද" },
  { key: "punarvasu", en: "Punarvasu", si: "පුනාවස" },
  { key: "pushya", en: "Pushya", si: "පුෂ" },
  { key: "ashlesha", en: "Ashlesha", si: "අස්ලිය" },
  { key: "magha", en: "Magha", si: "මා" },
  { key: "purva_phalguni", en: "Purva Phalguni", si: "පුවපල්" },
  { key: "uttara_phalguni", en: "Uttara Phalguni", si: "උත්තරපල්" },
  { key: "hasta", en: "Hasta", si: "හත" },
  { key: "chitra", en: "Chitra", si: "සිත" },
  { key: "swati", en: "Swati", si: "සා" },
  { key: "vishakha", en: "Vishakha", si: "විසා" },
  { key: "anuradha", en: "Anuradha", si: "අනුර" },
  { key: "jyeshtha", en: "Jyeshtha", si: "දෙට" },
  { key: "mula", en: "Mula", si: "මුල" },
  { key: "purva_ashadha", en: "Purva Ashadha", si: "පුවසල" },
  { key: "uttara_ashadha", en: "Uttara Ashadha", si: "උත්තරසල" },
  { key: "shravana", en: "Shravana", si: "සුවණ" },
  { key: "dhanishta", en: "Dhanishta", si: "දෙනට" },
  { key: "shatabhisha", en: "Shatabhisha", si: "සියාවස" },
  { key: "purva_bhadrapada", en: "Purva Bhadrapada", si: "පුවපුටුප" },
  { key: "uttara_bhadrapada", en: "Uttara Bhadrapada", si: "උත්තරපුටුප" },
  { key: "revati", en: "Revati", si: "රේවතී" },
];

export function findNakshatra(key: string): Nakshatra | undefined {
  return NAKSHATRA.find((star) => star.key === key);
}

export type StarSign = { rashi: string; padas: number[] };

/**
 * The Moon signs a birth star falls in. Each sign holds nine padas, so most stars sit in
 * one sign and nine of them lie across two.
 */
export function starSigns(key: string): StarSign[] {
  const index = NAKSHATRA.findIndex((star) => star.key === key);
  if (index < 0) return [];
  const signs: StarSign[] = [];
  for (let pada = 1; pada <= 4; pada++) {
    const rashi = RASHI[Math.floor((index * 4 + pada - 1) / 9)].key;
    const last = signs[signs.length - 1];
    if (last?.rashi === rashi) last.padas.push(pada);
    else signs.push({ rashi, padas: [pada] });
  }
  return signs;
}

/** Padas as text: "1" or "2–4". */
export function padaRange(padas: number[]): string {
  return padas.length > 1 ? `${padas[0]}–${padas[padas.length - 1]}` : String(padas[0]);
}
