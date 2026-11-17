/** Colour themes being tested. Throwaway: lives only in the theme-lab folder. */
export const THEMES = [
  {
    id: "charcoal",
    name: "Charcoal and Electric Blue",
    short: "Theme 1",
    colors: [
      { name: "Charcoal", hex: "#1E1E1C" },
      { name: "Sand", hex: "#D8CBB3" },
      { name: "Electric Blue", hex: "#2F6BFF" },
    ],
    mood: "Calm, technical, premium. Warm neutrals with one cool spark.",
  },
  {
    id: "navy",
    name: "Navy, Cream and Coral",
    short: "Theme 2",
    colors: [
      { name: "Navy", hex: "#14213D" },
      { name: "Cream", hex: "#F4EDE0" },
      { name: "Coral", hex: "#FF6B5B" },
    ],
    mood: "Warm, friendly, human. Closest to the current night-sky look.",
  },
  {
    id: "lime",
    name: "Midnight Black, White and Lime",
    short: "Theme 3",
    colors: [
      { name: "Midnight Black", hex: "#0B0B0C" },
      { name: "Pure White", hex: "#FFFFFF" },
      { name: "Lime Green", hex: "#C6F432" },
    ],
    mood: "Sharp, modern, high energy. Most startup-like.",
  },
] as const;

export type Theme = (typeof THEMES)[number];
export type ThemeId = Theme["id"];

export const themeIds = THEMES.map((theme) => theme.id);

export function findTheme(id: string): Theme | undefined {
  return THEMES.find((theme) => theme.id === id);
}
