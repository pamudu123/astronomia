export type Rashi = {
  key: string;
  en: string;
  si: string;
  image: string;
};

/** The twelve rashi in order. Image paths are under public/images (see scripts/copy-assets.mjs). */
export const RASHI: Rashi[] = [
  { key: "mesha", en: "Mesha", si: "මේෂ", image: "/images/rashi-01-mesha.webp" },
  { key: "vrishabha", en: "Vrishabha", si: "වෘෂභ", image: "/images/rashi-02-vrishabha.webp" },
  { key: "mithuna", en: "Mithuna", si: "මිථුන", image: "/images/rashi-03-mithuna.webp" },
  { key: "kataka", en: "Kataka", si: "කටක", image: "/images/rashi-04-kataka.webp" },
  // No Simha artwork yet: the drawn symbol stands in (see design/README.md).
  { key: "simha", en: "Simha", si: "සිංහ", image: "/images/glyphs/rashi-05-simha.svg" },
  { key: "kanya", en: "Kanya", si: "කන්‍යා", image: "/images/rashi-06-kanya.webp" },
  { key: "tula", en: "Tula", si: "තුලා", image: "/images/rashi-07-tula.webp" },
  { key: "vrischika", en: "Vrischika", si: "වෘශ්චික", image: "/images/rashi-08-vrischika.webp" },
  { key: "dhanu", en: "Dhanu", si: "ධනු", image: "/images/rashi-09-dhanu.webp" },
  { key: "makara", en: "Makara", si: "මකර", image: "/images/rashi-10-makara.webp" },
  { key: "kumbha", en: "Kumbha", si: "කුම්භ", image: "/images/rashi-11-kumbha.webp" },
  { key: "meena", en: "Meena", si: "මීන", image: "/images/rashi-12-meena.webp" },
];
