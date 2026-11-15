"use client";

import { useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import styles from "@/components/NextSteps.module.css";
import { type SavedResult, forgetChart, isRemembered, rememberChart } from "@/lib/hadahan";
import { useHydrated } from "@/lib/useHydrated";

/**
 * Opt in to keep this chart in this browser (never on the server), so the home page can
 * greet the visitor with their own sky next time. Unticking forgets it.
 */
export function RememberChart({ t, saved }: { t: Dictionary["remember"]; saved: SavedResult }) {
  const hydrated = useHydrated();
  const [choice, setChoice] = useState<boolean | null>(null);
  const on = choice ?? (hydrated && isRemembered(saved.request));

  return (
    <div className={styles.remember} data-card="remember">
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={on}
          onChange={(event) => {
            const keep = event.target.checked;
            if (keep) rememberChart(saved);
            else forgetChart();
            setChoice(keep);
          }}
        />
        {t.label}
      </label>
      <p className={styles.note} role="status">
        {on ? `${t.saved} ` : ""}
        {t.note}
      </p>
    </div>
  );
}
