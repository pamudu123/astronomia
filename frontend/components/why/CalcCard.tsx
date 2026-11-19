"use client";

import { useState, type ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/i18n";
import { NAKSHATRA } from "@/lib/nakshatra";
import { RASHI } from "@/lib/rashi";

import styles from "./CalcCard.module.css";

type Copy = Dictionary["whyPage"]["calc"];

const STAR = 40 / 3; // 13°20′
const PADA = 10 / 3; // 3°20′
const AYANAMSA_2000 = 23.853; // Lahiri ayanamsa at 2000, in degrees
const PRECESSION = 50.29 / 3600; // degrees the zodiacs drift apart each year
const DASHA_YEARS = [7, 20, 6, 10, 7, 18, 16, 19, 17]; // Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury
const SPAN = 100; // years drawn on the dasha timeline
const EXAMPLES = ["star", "shift", "dasha"] as const;

type Slider = { label: string; shown: string; min: number; max: number; step: number; value: number; set: (value: number) => void };
type Row = { label: string; equation: string; result: string };
type Example = { name: string; note: string; visual: ReactNode; sliders: [Slider, Slider]; rows: [Row, Row, Row] };

const round = (value: number) => Math.round(value * 100) / 100;
const wrap = (deg: number) => ((deg % 360) + 360) % 360;
/** A number padded with figure spaces, so the monospaced equations keep one width as the value changes. */
const fixed = (value: number, digits = 2, width = 6) => value.toFixed(digits).padStart(width, " ");
/** Fills {name} placeholders in a copy string. */
const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));

/** The ruler runs 0° to 360° across x = 10 to 290. */
const rx = (deg: number) => round(10 + (deg * 280) / 360);
/** The dasha timeline runs 0 to 100 years across the same width. */
const ax = (years: number) => round(10 + (years * 280) / SPAN);

function SignTicks({ y }: { y: number }) {
  return (
    <g stroke="var(--ink-soft)" strokeOpacity=".35">
      {Array.from({ length: 11 }, (_, index) => (
        <line key={index} x1={rx((index + 1) * 30)} y1={y - 4} x2={rx((index + 1) * 30)} y2={y + 4} />
      ))}
    </g>
  );
}

/**
 * The hero's small calculator: three different worked examples behind a pager. Each one has
 * two sliders, a small drawing and three steps, and every part has a fixed height, so the card
 * keeps one size whichever example is shown and wherever the sliders sit.
 */
export function CalcCard({ lang, copy }: { lang: Locale; copy: Copy }) {
  const [index, setIndex] = useState(0);
  const [moon, setMoon] = useState(189.7);
  const [sun, setSun] = useState(131.47);
  const [tropical, setTropical] = useState(128.4);
  const [year, setYear] = useState(1995);
  const [age, setAge] = useState(30);

  const degrees = (value: number) => `${value.toFixed(2)}°`;
  const moonSlider: Slider = { label: copy.star.moon, shown: degrees(moon), min: 0, max: 359.99, step: 0.01, value: moon, set: setMoon };
  const star = Math.floor(moon / STAR);
  const intoStar = moon - star * STAR;

  function birthStar(): Example {
    const sign = Math.floor(moon / 30);
    const m = fixed(moon);
    return {
      name: copy.star.name,
      note: copy.star.note,
      sliders: [moonSlider, { label: copy.star.sun, shown: degrees(sun), min: 0, max: 359.99, step: 0.01, value: sun, set: setSun }],
      rows: [
        { label: copy.star.rashi, equation: `⌊${m} ÷ 30⌋ + 1 = ${sign + 1}`, result: RASHI[sign][lang] },
        { label: copy.star.nak, equation: `⌊${m} ÷ 13°20′⌋ + 1 = ${star + 1}`, result: NAKSHATRA[star][lang] },
        {
          label: copy.star.pada,
          equation: `⌊${fixed(intoStar, 2, 5)} ÷ 3°20′⌋ + 1`,
          result: fill(copy.star.padaValue, { n: Math.floor(intoStar / PADA) + 1 }),
        },
      ],
      // The zodiac laid out flat: the Moon's sign is outlined, its nakshatra is teal, the Sun is a dot.
      visual: (
        <>
          <line x1="10" y1="42" x2="290" y2="42" stroke="var(--line)" strokeWidth="6" strokeLinecap="round" />
          <SignTicks y={42} />
          <rect x={rx(sign * 30)} y="36" width={rx(30) - rx(0)} height="12" rx="3" fill="none" stroke="var(--gold)" strokeOpacity=".7" />
          <rect x={rx(star * STAR)} y="39" width={rx(STAR) - rx(0)} height="6" fill="var(--teal)" fillOpacity=".9" />
          <circle cx={rx(sun)} cy="42" r="4" fill="var(--panel)" stroke="var(--ink-soft)" strokeWidth="1.5" />
          <line x1={rx(moon)} y1="22" x2={rx(moon)} y2="52" stroke="var(--gold)" strokeWidth="1.6" />
          <text x={Math.min(276, Math.max(24, rx(moon)))} y="16" fontFamily="var(--font-mono)" fontSize="10" fill="var(--gold)" textAnchor="middle">
            {moon.toFixed(1)}°
          </text>
          <g fontFamily="var(--font-mono)" fontSize="9" fill="var(--ink-soft)" textAnchor="middle">
            {[0, 90, 180, 270, 360].map((deg) => (
              <text key={deg} x={rx(deg)} y="68">
                {deg}°
              </text>
            ))}
          </g>
        </>
      ),
    };
  }

  function skyShift(): Example {
    const ayanamsa = AYANAMSA_2000 + (year - 2000) * PRECESSION;
    const sidereal = wrap(tropical - ayanamsa);
    const western = Math.floor(tropical / 30);
    const sign = Math.floor(sidereal / 30);
    const strip = (y: number, label: string, deg: number, colour: string) => (
      <>
        <text x="10" y={y - 9} fontSize="10" fill="var(--ink-soft)">
          {label}
        </text>
        <line x1="10" y1={y} x2="290" y2={y} stroke="var(--line)" strokeWidth="5" strokeLinecap="round" />
        <SignTicks y={y} />
        <circle cx={rx(deg)} cy={y} r="5" fill={colour} />
      </>
    );
    return {
      name: copy.shift.name,
      note: copy.shift.note,
      sliders: [
        { label: copy.shift.sun, shown: degrees(tropical), min: 0, max: 359.99, step: 0.01, value: tropical, set: setTropical },
        { label: copy.shift.year, shown: String(year), min: 1900, max: 2030, step: 1, value: year, set: setYear },
      ],
      rows: [
        { label: copy.shift.ayanamsa, equation: `23.853° + (${year} − 2000) × 50.29″`, result: degrees(ayanamsa) },
        { label: copy.shift.siderealSun, equation: `${fixed(tropical)} − ${ayanamsa.toFixed(2)}`, result: degrees(sidereal) },
        {
          label: copy.shift.sign,
          equation: `⌊${fixed(sidereal)} ÷ 30⌋ + 1 = ${sign + 1}`,
          result:
            western === sign
              ? fill(copy.shift.same, { sign: RASHI[sign][lang] })
              : `${copy.shift.signs[western]} → ${RASHI[sign][lang]}`,
        },
      ],
      // The same Sun on the Western strip and on the sidereal strip, joined by the shift.
      visual: (
        <>
          {strip(26, copy.shift.western, tropical, "var(--ink-soft)")}
          {strip(64, copy.shift.sidereal, sidereal, "var(--gold)")}
          <path d={`M${rx(tropical)} 32 L${rx(sidereal)} 58`} stroke="var(--gold)" strokeDasharray="3 3" fill="none" />
        </>
      ),
    };
  }

  function lifePeriods(): Example {
    const first = star % 9;
    const left = (STAR - intoStar) / STAR;
    const balance = left * DASHA_YEARS[first];
    const segments: { planet: number; start: number; end: number }[] = [];
    for (let start = 0, step = 0; start < SPAN; step += 1) {
      const planet = (first + step) % 9;
      const length = step === 0 ? balance : DASHA_YEARS[planet];
      segments.push({ planet, start, end: start + length });
      start += length;
    }
    const current = segments.find((segment) => age >= segment.start && age < segment.end) ?? segments[segments.length - 1];
    const balanceYears = Math.floor(balance);
    return {
      name: copy.dasha.name,
      note: copy.dasha.note,
      sliders: [
        moonSlider,
        { label: copy.dasha.age, shown: fill(copy.dasha.ageValue, { age }), min: 0, max: SPAN, step: 1, value: age, set: setAge },
      ],
      rows: [
        {
          label: copy.dasha.lord,
          equation: `(${star + 1} − 1) mod 9 + 1 = ${first + 1}`,
          result: fill(copy.dasha.lordValue, { planet: copy.dasha.planets[first], years: DASHA_YEARS[first] }),
        },
        {
          label: copy.dasha.balance,
          equation: `(13°20′ − ${fixed(intoStar, 2, 5)}) ÷ 13°20′ × ${DASHA_YEARS[first]}`,
          result: fill(copy.dasha.balanceValue, { y: balanceYears, m: Math.floor((balance - balanceYears) * 12) }),
        },
        {
          label: fill(copy.dasha.period, { age }),
          equation: `${fixed(current.start, 1, 5)} → ${fixed(current.end, 1, 5)} ${copy.dasha.years}`,
          result: fill(copy.dasha.periodValue, { planet: copy.dasha.planets[current.planet] }),
        },
      ],
      // A life laid out as a bar: each dasha a block, the chosen age a line, its period in teal.
      visual: (
        <>
          {segments.map((segment) => {
            const x1 = ax(segment.start);
            const x2 = ax(Math.min(segment.end, SPAN));
            const on = segment === current;
            return (
              <g key={segment.start}>
                <rect
                  x={x1}
                  y="16"
                  width={Math.max(0, x2 - x1 - 1)}
                  height="22"
                  rx="2"
                  fill={on ? "var(--teal)" : "var(--gold-fill)"}
                  fillOpacity={on ? 0.9 : segment.planet % 2 ? 0.28 : 0.5}
                />
                {x2 - x1 > 18 && (
                  <text x={(x1 + x2) / 2} y="31" fontSize="10" fill="var(--ink)" textAnchor="middle">
                    {copy.dasha.short[segment.planet]}
                  </text>
                )}
              </g>
            );
          })}
          <line x1={ax(age)} y1="10" x2={ax(age)} y2="44" stroke="var(--ink)" strokeWidth="1.5" />
          <g fontFamily="var(--font-mono)" fontSize="9" fill="var(--ink-soft)" textAnchor="middle">
            {[0, 25, 50, 75, 100].map((years) => (
              <text key={years} x={ax(years)} y="60">
                {years}
              </text>
            ))}
          </g>
        </>
      ),
    };
  }

  const key = EXAMPLES[index];
  const example = key === "star" ? birthStar() : key === "shift" ? skyShift() : lifePeriods();
  const go = (step: number) => setIndex((current) => (current + step + EXAMPLES.length) % EXAMPLES.length);

  return (
    <figure className={styles.card} aria-label={copy.label}>
      <figcaption className={styles.head}>
        <span className={styles.title}>{copy.title}</span>
        <span className={styles.pager}>
          <button type="button" className={styles.arrow} onClick={() => go(-1)} aria-label={copy.prev}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10 3.5 5.5 8l4.5 4.5" />
            </svg>
          </button>
          <span className={styles.pagerLabel} aria-live="polite">
            <span className={styles.pagerName}>{example.name}</span>
            <span className={styles.pagerCount}>{fill(copy.count, { n: index + 1, total: EXAMPLES.length })}</span>
          </span>
          <button type="button" className={styles.arrow} onClick={() => go(1)} aria-label={copy.next}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 3.5 10.5 8 6 12.5" />
            </svg>
          </button>
        </span>
      </figcaption>

      <svg className={styles.visual} viewBox="0 0 300 78" aria-hidden="true">
        {example.visual}
      </svg>

      <div className={styles.controls}>
        {example.sliders.map((slider, position) => (
          <label key={position} className={styles.control}>
            <span className={styles.controlHead}>
              <span className={styles.controlName}>{slider.label}</span>
              <b>{slider.shown}</b>
            </span>
            <input
              type="range"
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={slider.value}
              onChange={(event) => slider.set(Number(event.target.value))}
            />
          </label>
        ))}
      </div>

      <ol className={styles.steps}>
        {example.rows.map((row, position) => (
          <li key={position} className={`rise ${styles.step}`} style={{ animationDelay: `${0.5 + position * 0.2}s` }}>
            <span className={styles.number} aria-hidden="true">
              {position + 1}
            </span>
            <div className={styles.stepBody}>
              <p className={styles.stepHead}>
                <span className={styles.label}>{row.label}</span>
                <b className={styles.result} title={row.result}>
                  {row.result}
                </b>
              </p>
              <p className={styles.equation}>{row.equation}</p>
            </div>
          </li>
        ))}
      </ol>

      <span className={styles.dots} aria-hidden="true">
        {EXAMPLES.map((name, position) => (
          <i key={name} className={position === index ? styles.dotOn : undefined} />
        ))}
      </span>
      <p className={styles.note}>{example.note}</p>
    </figure>
  );
}
