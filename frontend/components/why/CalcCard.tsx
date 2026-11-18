import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/i18n";
import { NAKSHATRA } from "@/lib/nakshatra";
import { RASHI } from "@/lib/rashi";

import styles from "./CalcCard.module.css";

/** The ruler shows 0° to 90°: x = 10 + degrees × 280 / 90. */
const x = (deg: number) => Math.round((10 + (deg * 280) / 90) * 100) / 100;

type Props = { lang: Locale; calc: Dictionary["whyPage"]["calc"] };

/**
 * A small worked example for the hero: from a birth time and the Moon's longitude to its rashi,
 * nakshatra and pada. Standard arithmetic with example values; the steps rise in one by one.
 */
export function CalcCard({ lang, calc }: Props) {
  const results = [
    <>
      06:42 − 05:30 = <b>01:12 UT</b>
    </>,
    <>
      λ = 47°12′08″ = <b>47.2022°</b>
    </>,
    <>
      ⌊47.2022 ÷ 30⌋ + 1 = 2 → <b>{RASHI[1][lang]}</b>
    </>,
    <>
      ⌊47.2022 ÷ 13°20′⌋ + 1 = 4 → <b>{NAKSHATRA[3][lang]}</b>
    </>,
    <>
      ⌊(47.2022 − 40) ÷ 3°20′⌋ + 1 = <b>3</b>
    </>,
  ];

  return (
    <figure className={styles.card} aria-label={calc.label}>
      <figcaption className={styles.head}>
        <span className={styles.title}>{calc.title}</span>
        <span className={styles.example}>{calc.example}</span>
      </figcaption>

      <svg className={styles.ruler} viewBox="0 0 300 56" aria-hidden="true">
        <line x1="10" y1="34" x2="290" y2="34" stroke="var(--line)" strokeWidth="6" strokeLinecap="round" />
        <rect x={x(30)} y="28" width={x(60) - x(30)} height="12" rx="3" fill="none" stroke="var(--gold)" strokeOpacity=".6" />
        <rect x={x(40)} y="31" width={x(160 / 3) - x(40)} height="6" fill="var(--teal)" fillOpacity=".85" />
        <g fontFamily="var(--font-mono)" fontSize="9" fill="var(--ink-soft)" textAnchor="middle">
          {[0, 30, 60, 90].map((deg) => (
            <text key={deg} x={x(deg)} y="53">
              {deg}°
            </text>
          ))}
        </g>
        <line x1={x(47.2)} y1="12" x2={x(47.2)} y2="44" stroke="var(--gold)" strokeWidth="1.5" />
        <text x={x(47.2)} y="9" fontFamily="var(--font-mono)" fontSize="10" fill="var(--gold)" textAnchor="middle">
          47.2°
        </text>
      </svg>

      <ol className={styles.steps}>
        {calc.steps.map((step, index) => (
          <li key={step} className={`rise ${styles.step}`} style={{ animationDelay: `${0.5 + index * 0.35}s` }}>
            <span className={styles.number} aria-hidden="true">
              {index + 1}
            </span>
            <div>
              <p className={styles.label}>{step}</p>
              <p className={styles.equation}>{results[index]}</p>
            </div>
          </li>
        ))}
      </ol>
    </figure>
  );
}
