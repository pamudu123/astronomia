/** Colour samples being tested. Throwaway: lives only in the theme-lab folder. */
export const THEMES = [
  {
    id: "current",
    letter: "0",
    name: "Current (Navy and Brass)",
    colors: [
      { name: "Night Navy", hex: "#0B1026" },
      { name: "Ivory", hex: "#F4F1EA" },
      { name: "Brass", hex: "#C9A45C" },
    ],
    mood: "The site as it is today. Shown for comparison.",
  },
  {
    id: "black",
    letter: "1",
    name: "Black and Brass",
    colors: [
      { name: "Black", hex: "#0A0A0A" },
      { name: "Ivory", hex: "#F4F1EA" },
      { name: "Brass", hex: "#C9A45C" },
    ],
    mood: "The closest swap: blue becomes neutral black, everything else is the same.",
  },
  {
    id: "warm",
    letter: "2",
    name: "Warm Black and Brass",
    colors: [
      { name: "Warm Black", hex: "#0F0D0B" },
      { name: "Soft Ivory", hex: "#F4EFE4" },
      { name: "Brass", hex: "#C9A45C" },
    ],
    mood: "A black with a hint of brown. Softer and less techy than pure black.",
  },
  {
    id: "champagne",
    letter: "3",
    name: "Black and Champagne",
    colors: [
      { name: "Black", hex: "#0B0B0C" },
      { name: "White", hex: "#F6F4EF" },
      { name: "Champagne", hex: "#E2CF9F" },
    ],
    mood: "Black with a pale gold accent. The most luxe and the lightest touch.",
  },
] as const;

export type Theme = (typeof THEMES)[number];

export function findTheme(id: string): Theme | undefined {
  return THEMES.find((theme) => theme.id === id);
}
