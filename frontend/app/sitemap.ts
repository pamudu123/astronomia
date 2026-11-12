import type { MetadataRoute } from "next";

import { locales } from "@/lib/i18n";
import { NAKSHATRA } from "@/lib/nakshatra";

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
