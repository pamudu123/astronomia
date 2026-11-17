/** Colour samples being tested. Throwaway: lives only in the theme-lab folder. */
export const THEMES = [
  {
    id: "dark",
    letter: "D",
    name: "Dark: Black and Bright Gold (chosen)",
    hero: undefined,
    colors: [
      { name: "Black", hex: "#0A0A0A" },
      { name: "Ivory", hex: "#F4F1EA" },
      { name: "Bright Gold", hex: "#E8B84B" },
    ],
    mood: "The chosen dark theme. Shown for comparison with the light options.",
  },
  {
    id: "ivory",
    letter: "1",
    name: "Light 1: Ivory, dark hero band",
    hero: "dark",
    colors: [
      { name: "Ivory", hex: "#F4F1EA" },
      { name: "Near-black", hex: "#0A0A0A" },
      { name: "Bronze (text)", hex: "#8A6212" },
      { name: "Bright Gold (buttons)", hex: "#E8B84B" },
    ],
    mood: "The mirror of the dark theme. Warm ivory page, with the top hero kept as a black band.",
  },
  {
    id: "ivory-light",
    letter: "2",
    name: "Light 2: Ivory, light hero",
    hero: "light",
    colors: [
      { name: "Ivory", hex: "#F4F1EA" },
      { name: "Near-black", hex: "#0A0A0A" },
      { name: "Bronze (text)", hex: "#8A6212" },
      { name: "Bright Gold (buttons)", hex: "#E8B84B" },
    ],
    mood: "The same ivory, but the whole page stays light, with no photo behind the top.",
  },
  {
    id: "white",
    letter: "3",
    name: "Light 3: Crisp White, dark hero band",
    hero: "dark",
    colors: [
      { name: "White", hex: "#FFFFFF" },
      { name: "Near-black", hex: "#0A0A0A" },
      { name: "Bronze (text)", hex: "#8A6212" },
      { name: "Bright Gold (buttons)", hex: "#E8B84B" },
    ],
    mood: "Cleaner and more modern. Pure white page, the least warm of the three.",
  },
  {
    id: "stone",
    letter: "4",
    name: "Light 4: Stone, dark hero band",
    hero: "dark",
    colors: [
      { name: "Stone", hex: "#E8E3D6" },
      { name: "Near-black", hex: "#0A0A0A" },
      { name: "Deep Bronze (text)", hex: "#7A5410" },
      { name: "Bright Gold (buttons)", hex: "#E8B84B" },
    ],
    mood: "Earthy, like paper or sandstone. The most relaxed and least bright.",
  },
] as const;

export type Theme = (typeof THEMES)[number];

export function findTheme(id: string): Theme | undefined {
  return THEMES.find((theme) => theme.id === id);
}
