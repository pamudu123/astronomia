/** A small picture of each slow planet, so the cards can be told apart at a glance. */
export function PlanetIcon({ body, size = 36 }: { body: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 36 36", "aria-hidden": true, fill: "none" } as const;
  if (body === "saturn") {
    return (
      <svg {...common}>
        <circle cx="18" cy="18" r="8" fill="var(--gold)" opacity="0.9" />
        <ellipse cx="18" cy="18" rx="16" ry="5" stroke="var(--gold-hover)" strokeWidth="1.6" transform="rotate(-18 18 18)" />
      </svg>
    );
  }
  if (body === "jupiter") {
    return (
      <svg {...common}>
        <circle cx="18" cy="18" r="13" fill="var(--coral)" opacity="0.85" />
        <path d="M6.500 13h23M5.500 19h25M8 25h20" stroke="var(--night)" strokeWidth="1.6" opacity="0.45" />
      </svg>
    );
  }
  // Rahu and Ketu are the Moon's two nodes: the same mark, one the other way up.
  return (
    <svg {...common} transform={body === "ketu" ? "rotate(180)" : undefined}>
      <path d="M11 27v-9a7 7 0 0 1 14 0v9" stroke="var(--teal)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="11" cy="28" r="3.200" fill="var(--teal)" />
      <circle cx="25" cy="28" r="3.200" fill="var(--teal)" />
    </svg>
  );
}
