import styles from "./Starfield.module.css";

type Star = { x: number; y: number; r: number; gold: boolean; delay: number };

/** A fixed, repeatable scatter of stars (same on server and client, so no layout shift). */
function makeStars(count: number, seed: number): Star[] {
  let state = seed;
  const next = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  return Array.from({ length: count }, () => ({
    x: Math.round(next() * 1440),
    y: Math.round(next() * 760),
    r: Math.round((1 + next() * 0.9) * 10) / 10,
    gold: next() < 0.18,
    delay: Math.round(next() * 6 * 10) / 10,
  }));
}

const STARS = makeStars(28, 7);

export function Starfield() {
  return (
    <svg
      className={styles.field}
      aria-hidden="true"
      viewBox="0 0 1440 760"
      preserveAspectRatio="xMidYMid slice"
    >
      {STARS.map((star, index) => (
        <circle
          key={index}
          className={styles.star}
          cx={star.x}
          cy={star.y}
          r={star.r}
          fill={star.gold ? "var(--gold)" : "var(--ink)"}
          style={{ animationDelay: `${star.delay}s` }}
        />
      ))}
    </svg>
  );
}
