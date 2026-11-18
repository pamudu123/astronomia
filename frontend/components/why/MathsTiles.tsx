"use client";

import { useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { fill } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { NAKSHATRA } from "@/lib/nakshatra";
import { RASHI } from "@/lib/rashi";

import styles from "./MathsTiles.module.css";

type Copy = Dictionary["whyPage"]["try"];
type TileKey = keyof Copy["tiles"];

const STAR = 40 / 3; // 13°20′
const PADA = 10 / 3; // 3°20′
const LOCAL_MINUTES = 6 * 60 + 42; // 06:42
const OFFSETS = [330, 0, 660, -240]; // Colombo, London, Melbourne, Toronto, in minutes

const pad = (value: number, width = 2) => String(value).padStart(width, "0");

/** 47.2022 → 47°12′07″ */
function dms(value: number): string {
  const totalSeconds = Math.floor(value * 3600 + 1e-6);
  const d = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${d}°${pad(m)}′${pad(s)}″`;
}

/** Minutes since midnight as HH:MM, wrapped into one day. */
function clock(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(wrapped / 60))}:${pad(wrapped % 60)}`;
}

type Tile = { key: TileKey; result: string; equation: string; more: string };

/** Every step worked out from the two longitudes and the time-zone offset. */
function work(moon: number, sun: number, offset: number, lang: Locale, copy: Copy): Tile[] {
  const ut = LOCAL_MINUTES - offset;
  const day = ut < 0 ? copy.prevDay : ut >= 1440 ? copy.nextDay : "";
  const sign = Math.floor(moon / 30);
  const star = Math.floor(moon / STAR);
  const intoStar = moon - star * STAR;
  const quarter = Math.floor(intoStar / PADA);
  const navamsa = Math.floor(moon / PADA) % 12;
  const elongation = (((moon - sun) % 360) + 360) % 360;
  const tithi = Math.floor(elongation / 12);
  const paksha = tithi < 15 ? copy.waxing : copy.waning;
  const m = moon.toFixed(2);
  const tiles = copy.tiles;

  return [
    {
      key: "ut",
      result: `${clock(ut)} UT`,
      equation: `06:42 ${offset < 0 ? "+" : "−"} ${clock(Math.abs(offset))}`,
      more: fill(tiles.ut.more, { day }),
    },
    {
      key: "rashi",
      result: RASHI[sign][lang],
      equation: `⌊${m} ÷ 30⌋ + 1 = ${sign + 1}`,
      more: fill(tiles.rashi.more, { into: dms(moon - sign * 30) }),
    },
    {
      key: "nak",
      result: NAKSHATRA[star][lang],
      equation: `⌊${m} ÷ 13°20′⌋ + 1 = ${star + 1}`,
      more: fill(tiles.nak.more, { start: dms(star * STAR) }),
    },
    {
      key: "pada",
      result: String(quarter + 1),
      equation: `⌊${intoStar.toFixed(2)} ÷ 3°20′⌋ + 1 = ${quarter + 1}`,
      more: fill(tiles.pada.more, { into: dms(intoStar), star: NAKSHATRA[star][lang] }),
    },
    {
      key: "nav",
      result: RASHI[navamsa][lang],
      equation: `⌊${m} ÷ 3°20′⌋ mod 12 + 1 = ${navamsa + 1}`,
      more: tiles.nav.more,
    },
    {
      key: "tithi",
      result: `${paksha} ${(tithi % 15) + 1}`,
      equation: `⌊(${moon.toFixed(1)} − ${sun.toFixed(1)}) mod 360 ÷ 12⌋ + 1 = ${tithi + 1}`,
      more: fill(tiles.tithi.more, { elong: `${elongation.toFixed(2)}°`, waxing: copy.waxing, waning: copy.waning }),
    },
  ];
}

/** "Try the maths": two sliders and a place, six tiles that work out each step live. */
export function MathsTiles({ lang, copy }: { lang: Locale; copy: Copy }) {
  const [moon, setMoon] = useState(47.2);
  const [sun, setSun] = useState(335.5);
  const [place, setPlace] = useState(0);
  const [open, setOpen] = useState<TileKey | null>(null);
  const offset = OFFSETS[place];
  const tiles = work(moon, sun, offset, lang, copy);
  const sign = offset < 0 ? "−" : "+";

  return (
    <div className={styles.wrap}>
      <div className={styles.controls}>
        <label className={styles.control}>
          <span className={styles.controlHead}>
            {copy.moon} <b>{moon.toFixed(2)}°</b>
          </span>
          <input type="range" min="0" max="359.99" step="0.01" value={moon} onChange={(event) => setMoon(Number(event.target.value))} />
        </label>
        <label className={styles.control}>
          <span className={styles.controlHead}>
            {copy.sun} <b>{sun.toFixed(2)}°</b>
          </span>
          <input type="range" min="0" max="359.99" step="0.01" value={sun} onChange={(event) => setSun(Number(event.target.value))} />
        </label>
        <label className={styles.control}>
          <span className={styles.controlHead}>
            {copy.place}{" "}
            <b>
              {sign}
              {clock(Math.abs(offset))}
            </b>
          </span>
          <select value={place} onChange={(event) => setPlace(Number(event.target.value))}>
            {copy.cities.map((city, index) => (
              <option key={city} value={index}>
                {city}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ul className={styles.tiles}>
        {tiles.map((tile) => {
          const isOpen = open === tile.key;
          const id = `tile-${tile.key}`;
          return (
            <li key={tile.key}>
              <button
                type="button"
                className={isOpen ? styles.tileOpen : styles.tile}
                aria-expanded={isOpen}
                aria-controls={id}
                onClick={() => setOpen(isOpen ? null : tile.key)}
              >
                <span className={styles.tileHead}>
                  <span>{copy.tiles[tile.key].name}</span>
                  <span className={styles.tag}>{copy.tiles[tile.key].tag}</span>
                </span>
                <span className={styles.result} aria-live="polite">
                  {tile.result}
                </span>
                <span className={styles.equation}>{tile.equation}</span>
                <span id={id} className={styles.more} hidden={!isOpen}>
                  {tile.more}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className={styles.note}>{copy.note}</p>
    </div>
  );
}
