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
    id: "crimson",
    letter: "1",
    name: "Black and Crimson",
    colors: [
      { name: "Black", hex: "#0A0A0A" },
      { name: "Bone", hex: "#EDE6D6" },
      { name: "Crimson", hex: "#E5484D" },
    ],
    mood: "The boldest and most dramatic. Ceremony and power.",
  },
  {
    id: "gold",
    letter: "2",
    name: "Black and Bright Gold",
    colors: [
      { name: "Black", hex: "#0A0A0A" },
      { name: "Ivory", hex: "#F4F1EA" },
      { name: "Bright Gold", hex: "#E8B84B" },
    ],
    mood: "Your brass turned up. Punchy and tied to the gold artwork.",
  },
  {
    id: "amber",
    letter: "3",
    name: "Black and Amber",
    colors: [
      { name: "Black", hex: "#0C0B0A" },
      { name: "Warm White", hex: "#F6F1E7" },
      { name: "Amber", hex: "#F2A93B" },
    ],
    mood: "Candle-flame warm. Confident, glowing and high contrast.",
  },
  {
    id: "copper",
    letter: "4",
    name: "Black and Copper",
    colors: [
      { name: "Black", hex: "#0B0A09" },
      { name: "Bone", hex: "#EDE6D6" },
      { name: "Copper", hex: "#D9763A" },
    ],
    mood: "Earthy and metallic. Strong without being loud.",
  },
  {
    id: "bone",
    letter: "5",
    name: "Black and Bone",
    colors: [
      { name: "Black", hex: "#0A0A0A" },
      { name: "White", hex: "#FFFFFF" },
      { name: "Bone", hex: "#EDE6D6" },
    ],
    mood: "No colour at all. The gold artwork is the only colour. Stark and editorial.",
  },
] as const;

export type Theme = (typeof THEMES)[number];

export function findTheme(id: string): Theme | undefined {
  return THEMES.find((theme) => theme.id === id);
}
