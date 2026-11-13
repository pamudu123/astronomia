import type { MetadataRoute } from "next";

import { PUBLISHED } from "@/lib/changes";
import { locales } from "@/lib/i18n";
import { AVURUDU_YEARS, CITIES, FEATURED_YEAR } from "@/lib/nakath";
import { NAKSHATRA } from "@/lib/nakshatra";
import { RASHI } from "@/lib/rashi";
import { YEARS } from "@/lib/yearly";

const SITE = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Every public page in both languages. Shared links are left out, and so is a staging site. */
export default function sitemap(): MetadataRoute.Sitemap {
  if (process.env.STAGING_PASSWORD) return [];
  const paths = [
    "",
    "/hadahan",
    "/porondam",
    "/porondam/stars",
    ...NAKSHATRA.map((star) => `/porondam/stars/${star.key}`),
    "/changes",
    ...PUBLISHED.flatMap((change) => [
      `/changes/${change.id}`,
      ...RASHI.map((rashi) => `/changes/${change.id}/${rashi.key}`),
    ]),
    ...YEARS.flatMap((year) => [`/forecast/${year}`, ...RASHI.map((rashi) => `/forecast/${year}/${rashi.key}`)]),
    "/avurudu",
    ...AVURUDU_YEARS.map((year) => `/avurudu/${year}`),
    ...CITIES.map((city) => `/avurudu/${FEATURED_YEAR}/${city.key}`),
    "/nakath",
    "/kendara",
    "/privacy",
    "/terms",
  ];
  return paths.flatMap((path) =>
    locales.map((lang) => ({
      url: `${SITE}/${lang}${path}`,
      alternates: {
        languages: Object.fromEntries(locales.map((other) => [other, `${SITE}/${other}${path}`])),
      },
    })),
  );
}
