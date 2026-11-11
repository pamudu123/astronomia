import { RASHI } from "@/lib/rashi";

import styles from "./ZodiacWheel.module.css";

const CENTER = 240;
const LABEL_RADIUS = 200;

/** Positions of the twelve rashi names, starting at the top and going clockwise. */
const labels = RASHI.map((rashi, index) => {
  const angle = ((15 + index * 30) * Math.PI) / 180;
  return {
    key: rashi.key,
    text: rashi.si,
    x: Math.round((CENTER + LABEL_RADIUS * Math.sin(angle)) * 10) / 10,
    y: Math.round((CENTER - LABEL_RADIUS * Math.cos(angle)) * 10) / 10,
  };
});

export function ZodiacWheel({ label }: { label: string }) {
  return (
    <svg className={styles.wheel} role="img" aria-label={label} viewBox="0 0 480 480">
      <defs>
        <radialGradient id="zw-sun" cx="38%" cy="35%">
          <stop offset="0" stopColor="#FBE7B5" />
          <stop offset="1" stopColor="#D79B3C" />
        </radialGradient>
        <radialGradient id="zw-teal" cx="35%" cy="30%">
          <stop offset="0" stopColor="#C9F3E9" />
          <stop offset="1" stopColor="#3E9C8A" />
        </radialGradient>
        <radialGradient id="zw-coral" cx="35%" cy="30%">
          <stop offset="0" stopColor="#FBC9B1" />
          <stop offset="1" stopColor="#D2603A" />
        </radialGradient>
        <radialGradient id="zw-moon" cx="35%" cy="30%">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#A9AFCF" />
        </radialGradient>
      </defs>
      <circle cx="240" cy="240" r="222" fill="var(--night-raised)" stroke="var(--line)" />
      <circle cx="240" cy="240" r="170" fill="var(--night)" stroke="var(--line)" />
      <circle
        className={styles.ring}
        cx="240"
        cy="240"
        r="228"
        fill="none"
        stroke="var(--gold)"
        strokeOpacity=".55"
        strokeWidth="1.5"
        strokeDasharray="2 12"
      />
      <g stroke="var(--line)">
        {Array.from({ length: 12 }, (_, index) => (
          <line
            key={index}
            x1="240"
            y1="18"
            x2="240"
            y2="70"
            transform={`rotate(${index * 30} 240 240)`}
          />
        ))}
      </g>
      <g
        fill="var(--gold)"
        fontFamily="var(--font-sinhala)"
        fontSize="14"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {labels.map((item) => (
          <text key={item.key} x={item.x} y={item.y}>
            {item.text}
          </text>
        ))}
      </g>
      <circle cx="240" cy="240" r="120" fill="none" stroke="var(--line)" strokeDasharray="3 7" />
      <circle cx="240" cy="240" r="70" fill="none" stroke="var(--line)" strokeDasharray="3 7" />
      <circle className={styles.glow} cx="240" cy="240" r="44" fill="var(--gold)" opacity=".12" />
      <circle cx="240" cy="240" r="26" fill="url(#zw-sun)" />
      <g className={styles.orbitA}>
        <circle cx="240" cy="120" r="10" fill="url(#zw-teal)" />
      </g>
      <g className={styles.orbitB}>
        <circle cx="240" cy="170" r="6.5" fill="url(#zw-coral)" />
      </g>
      <g className={styles.orbitC}>
        <circle cx="360" cy="240" r="5.5" fill="url(#zw-moon)" />
      </g>
    </svg>
  );
}
