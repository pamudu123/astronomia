/**
 * The sources the credits page names. The frontend is built without the backend folder,
 * so these are copied here; tests/unit/credits.test.ts checks them against the data files
 * (backend/app/data/rules/avurudu_v1.yaml, the font licence files and the site layout).
 */

export const CC_BY_URL = "https://creativecommons.org/licenses/by/4.0/";
export const CC_BY_SA_URL = "https://creativecommons.org/licenses/by-sa/4.0/";
export const OFL_URL = "https://openfontlicense.org/open-font-license-official-text/";

export const GEONAMES_URL = "https://www.geonames.org";
export const WIKIPEDIA_NAMES_URL = "https://en.wikipedia.org/wiki/Category:Sinhalese_given_names";

/** The five font families the site loads (app/[lang]/layout.tsx), with their copyright lines. */
export const FONTS = [
  {
    family: "DM Sans",
    copyright: "Copyright 2014 The DM Sans Project Authors",
    url: "https://github.com/googlefonts/dm-fonts",
  },
  {
    family: "Marcellus",
    copyright:
      'Copyright (c) 2012, Brian J. Bonislawsky DBA Astigmatic (AOETI), with Reserved Font Names "Marcellus"',
    url: "https://fonts.google.com/specimen/Marcellus",
  },
  {
    family: "Noto Sans Sinhala",
    copyright: "Copyright 2022 The Noto Project Authors",
    url: "https://github.com/notofonts/sinhala",
  },
  {
    family: "Noto Serif Sinhala",
    copyright: "Copyright 2022 The Noto Project Authors",
    url: "https://github.com/notofonts/sinhala",
  },
  {
    family: "JetBrains Mono",
    copyright: "Copyright 2020 The JetBrains Mono Project Authors",
    url: "https://github.com/JetBrains/JetBrainsMono",
  },
] as const;

/** Who issued each year's official Avurudu list. The names are in the message files. */
export type AvuruduBody = "culturalAffairs" | "astrologersCommittee" | "ministry";

/** The official Avurudu lists we publish, one per year, from avurudu_v1.yaml. */
export const AVURUDU_SOURCES: { year: number; body: AvuruduBody; url: string }[] = [
  { year: 2022, body: "culturalAffairs", url: "https://www.adaderana.lk/news/81800" },
  { year: 2023, body: "culturalAffairs", url: "https://www.adaderana.lk/news/89753" },
  { year: 2024, body: "astrologersCommittee", url: "https://www.adaderana.lk/news/98609" },
  { year: 2025, body: "culturalAffairs", url: "https://www.adaderana.lk/news/107424" },
  { year: 2026, body: "ministry", url: "https://www.adaderana.lk/news/119855" },
  { year: 2027, body: "culturalAffairs", url: "https://adaderana.lk/news/cmt8cz3ok0004356q09kc6avw" },
];

/** The English name of each body, as the yaml `source` lines write it. */
export const AVURUDU_BODY_EN: Record<AvuruduBody, string> = {
  culturalAffairs: "Department of Cultural Affairs",
  astrologersCommittee: "State Astrologers' Committee",
  ministry: "Ministry of Buddhasasana, Religious and Cultural Affairs",
};
