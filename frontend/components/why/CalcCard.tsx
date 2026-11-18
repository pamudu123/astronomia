"use client";

import { useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/i18n";
import { NAKSHATRA } from "@/lib/nakshatra";
import { RASHI } from "@/lib/rashi";

import styles from "./CalcCard.module.css";

type Copy = Dictionary["whyPage"]["calc"];

const STAR = 40 / 3; // 13°20′
const PADA = 10 / 3; // 3°20′
const LOCAL_MINUTES = 6 * 60 + 42; // the example birth time, 06:42
const OFFSETS = [330, 0, 660, -240]; // Colombo, London, Melbourne, Toronto, in minutes

const pad = (value: number) => String(value).padStart(2, "0");
const round = (value: number) => Math.round(value * 100) / 100;

/** Minutes since midnight as HH:MM, wrapped into one day. */
function clock(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(wrapped / 60))}:${pad(wrapped % 60)}`;
}

/** The ruler runs 0° to 360° across x = 10 to 290. */
const rx = (deg: number) => round(10 + (deg * 280) / 360);

/**
 * The hero's small calculator. Three inputs (Moon, Sun and birth place) and five worked steps:
 * time to UT, rashi, nakshatra, pada and tithi. Standard arithmetic on example values; all the
 * interaction stays inside this card.
 */
export function CalcCard({ lang, copy }: { lang: Locale; copy: Copy }) {
  const [moon, setMoon] = useState(47.2);
  const [sun, setSun] = useState(335.5);
  const [place, setPlace] = useState(0);

  const offset = OFFSETS[place];
  const ut = LOCAL_MINUTES - offset;
  const day = ut < 0 ? copy.prevDay : ut >= 1440 ? copy.nextDay : "";
  const sign = Math.floor(moon / 30);
  const star = Math.floor(moon / STAR);
  const intoStar = moon - star * STAR;
  const quarter = Math.floor(intoStar / PADA);
  const elongation = (((moon - sun) % 360) + 360) % 360;
  const tithi = Math.floor(elongation / 12);
  const paksha = tithi < 15 ? copy.waxing : copy.waning;
  const m = moon.toFixed(2);

  const rows = [
    {
      label: copy.rows.ut,
      equation: `06:42 ${offset < 0 ? "+" : "−"} ${clock(Math.abs(offset))} =`,
      result: `${clock(ut)} UT${day}`,
    },
    { label: copy.rows.rashi, equation: `⌊${m} ÷ 30⌋ + 1 = ${sign + 1} →`, result: RASHI[sign][lang] },
    { label: copy.rows.nak, equation: `⌊${m} ÷ 13°20′⌋ + 1 = ${star + 1} →`, result: NAKSHATRA[star][lang] },
    { label: copy.rows.pada, equation: `⌊${intoStar.toFixed(2)} ÷ 3°20′⌋ + 1 =`, result: String(quarter + 1) },
    {
      label: copy.rows.tithi,
      equation: `⌊(${moon.toFixed(1)} − ${sun.toFixed(1)}) mod 360 ÷ 12⌋ + 1 = ${tithi + 1} →`,
      result: `${paksha} ${(tithi % 15) + 1}`,
    },
  ];

  return (
    <figure className={styles.card} aria-label={copy.label}>
      <figcaption className={styles.head}>
        <span className={styles.title}>{copy.title}</span>
        <span className={styles.example}>{copy.example}</span>
      </figcaption>

      {/* The zodiac laid out flat: the Moon's sign is outlined, its nakshatra is teal, the Sun is a dot. */}
      <svg className={styles.ruler} viewBox="0 0 300 58" aria-hidden="true">
        <line x1="10" y1="34" x2="290" y2="34" stroke="var(--line)" strokeWidth="6" strokeLinecap="round" />
        <g stroke="var(--ink-soft)" strokeOpacity=".35">
          {Array.from({ length: 11 }, (_, index) => (
            <line key={index} x1={rx((index + 1) * 30)} y1="30" x2={rx((index + 1) * 30)} y2="38" />
          ))}
        </g>
        <rect x={rx(sign * 30)} y="28" width={rx(30) - rx(0)} height="12" rx="3" fill="none" stroke="var(--gold)" strokeOpacity=".7" />
        <rect x={rx(star * STAR)} y="31" width={rx(STAR) - rx(0)} height="6" fill="var(--teal)" fillOpacity=".9" />
        <circle cx={rx(sun)} cy="34" r="4" fill="var(--panel)" stroke="var(--ink-soft)" strokeWidth="1.5" />
        <line x1={rx(moon)} y1="14" x2={rx(moon)} y2="44" stroke="var(--gold)" strokeWidth="1.6" />
        <text x={rx(moon)} y="10" fontFamily="var(--font-mono)" fontSize="10" fill="var(--gold)" textAnchor="middle">
          {moon.toFixed(1)}°
        </text>
        <g fontFamily="var(--font-mono)" fontSize="9" fill="var(--ink-soft)" textAnchor="middle">
          {[0, 90, 180, 270, 360].map((deg) => (
            <text key={deg} x={rx(deg)} y="55">
              {deg}°
            </text>
          ))}
        </g>
      </svg>

      <div className={styles.controls}>
        <label className={styles.control}>
          <span className={styles.controlHead}>
            {copy.moon} <b>{m}°</b>
          </span>
          <input type="range" min="0" max="359.99" step="0.01" value={moon} onChange={(event) => setMoon(Number(event.target.value))} />
        </label>
        <label className={styles.control}>
          <span className={styles.controlHead}>
            {copy.sun} <b>{sun.toFixed(2)}°</b>
          </span>
          <input type="range" min="0" max="359.99" step="0.01" value={sun} onChange={(event) => setSun(Number(event.target.value))} />
        </label>
        <label className={`${styles.control} ${styles.placeControl}`}>
          <span className={styles.controlHead}>{copy.place}</span>
          <select value={place} onChange={(event) => setPlace(Number(event.target.value))}>
            {copy.cities.map((city, index) => (
              <option key={city} value={index}>
                {city} · {OFFSETS[index] < 0 ? "−" : "+"}
                {clock(Math.abs(OFFSETS[index]))}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ol className={styles.steps}>
        {rows.map((row, index) => (
          <li key={row.label} className={`rise ${styles.step}`} style={{ animationDelay: `${0.5 + index * 0.2}s` }}>
            <span className={styles.number} aria-hidden="true">
              {index + 1}
            </span>
            <div>
              <p className={styles.label}>{row.label}</p>
              <p className={styles.equation}>
                {row.equation} <b>{row.result}</b>
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className={styles.note}>{copy.note}</p>
    </figure>
  );
}
