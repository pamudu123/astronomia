"use client";

import { useEffect, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { fill } from "@/lib/hadahan";

import styles from "./FirstLetters.module.css";

type Props = {
  t: Dictionary["firstLetters"]["progress"];
  /** "3 months" */
  range: string;
};

/** A new line every few seconds: long enough to read on a phone. */
const LINE_SECONDS = 3;
/** After this many seconds, the service is likely to be waking up. */
const WAKING = 25;

/**
 * While the search runs: one line at a time about what it is checking, so a wait of several
 * seconds has something to read. The lines follow rules/first_letters_si_v1.yaml; change both
 * together. Only the stage sentence is announced: the lines change too often for a screen reader.
 */
export function SearchLines({ t, range }: Props) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  const index = Math.floor(seconds / LINE_SECONDS) % t.lines.length;
  return (
    <div className={styles.progress} data-progress>
      <p role="status">{seconds >= WAKING ? t.waking : fill(t.start, { range })}</p>
      {/* The key starts the fade again for each new line. */}
      <p key={index} className={styles.progressLine} aria-hidden="true" data-progress-line>
        <span className={styles.progressSpark}>✦</span> {t.lines[index]}
      </p>
      <p className={styles.small} aria-hidden="true">
        {fill(t.seconds, { seconds })}
      </p>
    </div>
  );
}
