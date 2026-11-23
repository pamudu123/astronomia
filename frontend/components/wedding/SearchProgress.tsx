"use client";

import { useEffect, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { fill } from "@/lib/hadahan";
import { SEARCH_TIMEOUT_MS } from "@/lib/request";

import styles from "./Wedding.module.css";

type Props = {
  t: Dictionary["porondam"]["wedding"]["progress"];
  /** "6 months" */
  range: string;
  /** "Engagement, Poruwa ceremony" */
  ceremonies: string;
};

/** After this many seconds, says that a longer range takes longer. */
const LONGER = 10;
/** After this many seconds, the service is likely to be waking up. */
const WAKING = 25;

/**
 * What a running search is looking for and how long it has run (QA-02). The sentence changes
 * only at each stage, so a screen reader hears it then; the seconds are for the eye.
 */
export function SearchProgress({ t, range, ceremonies }: Props) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  const stage = seconds >= WAKING ? t.waking : seconds >= LONGER ? t.longer : t.start;
  return (
    <div className={styles.progress} data-progress>
      <p role="status">{fill(stage, { range, ceremonies, limit: SEARCH_TIMEOUT_MS / 1000 })}</p>
      <p className={styles.small} aria-hidden="true">
        {fill(t.seconds, { seconds })}
      </p>
    </div>
  );
}
