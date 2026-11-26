import type { Dictionary } from "@/app/[lang]/dictionaries";
import { moonOf } from "@/lib/dayAdvice";
import { fill } from "@/lib/hadahan";
import type { Panchanga } from "@/lib/nakath";

import styles from "./Day.module.css";

/** The lit part of the Moon for an age of 0 (new) through 15 (full) to 30 (new). */
function litPath(age: number): string {
  const across = Math.cos((age / 30) * 2 * Math.PI);
  const growing = age <= 15;
  // The bright edge is half a circle. The other edge is half an ellipse: past the half moon
  // it bulges away from the bright edge, before it towards it.
  const outer = growing ? 1 : 0;
  const inner = across < 0 === growing ? 1 : 0;
  return `M24 4A20 20 0 0 ${outer} 24 44A${(Math.abs(across) * 20).toFixed(2)} 20 0 0 ${inner} 24 4Z`;
}

/** The Moon in plain words, with a small picture of it. */
export function DayMoon({ t, shown }: { t: Dictionary["nakath"]; shown: Panchanga }) {
  const moon = moonOf(shown);
  if (!moon) return null;
  const counted = moon.phase === "growing" || moon.phase === "shrinking";
  return (
    <section className={styles.moon} data-card="moon" data-phase={moon.phase}>
      <svg width="52" height="52" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <circle cx="24" cy="24" r="20" className={styles.moonDark} />
        {moon.phase !== "new" && <path d={litPath(moon.age)} className={styles.moonLit} />}
      </svg>
      <div>
        <h2 className={styles.moonTitle}>{t.day.moon[moon.phase]}</h2>
        {counted && <p className={styles.small}>{fill(t.day.moon.day, { day: moon.day })}</p>}
      </div>
    </section>
  );
}
