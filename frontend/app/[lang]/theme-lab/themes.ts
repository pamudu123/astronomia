/** Colour themes being tested. Throwaway: lives only in the theme-lab folder. */
export const THEMES = [
  {
    id: "green",
    letter: "A",
    name: "Ink Green and Brass",
    colors: [
      { name: "Ink Green", hex: "#0F2A24" },
      { name: "Ivory", hex: "#F3EBDD" },
      { name: "Antique Brass", hex: "#B8924A" },
    ],
    mood: "A leather-bound book. Dark and calm, so your gold artwork matches the accent.",
  },
  {
    id: "parchment",
    letter: "B",
    name: "Parchment and Vermilion",
    colors: [
      { name: "Parchment", hex: "#F2E9D8" },
      { name: "Ink Brown", hex: "#1F1A16" },
      { name: "Vermilion", hex: "#B5472F" },
    ],
    mood: "A printed almanac or palm-leaf manuscript. A light site, the boldest change.",
  },
  {
    id: "cinnamon",
    letter: "C",
    name: "Cinnamon and Saffron",
    colors: [
      { name: "Cinnamon", hex: "#241512" },
      { name: "Warm Cream", hex: "#EFE4CF" },
      { name: "Saffron", hex: "#D9A441" },
    ],
    mood: "Lamp-lit and temple-warm. Matches the candle photos, the most cultural.",
  },
] as const;

export type Theme = (typeof THEMES)[number];

export function findTheme(id: string): Theme | undefined {
  return THEMES.find((theme) => theme.id === id);
}
