"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/i18n";
import { useHydrated } from "@/lib/useHydrated";

import styles from "./GuardianConsent.module.css";

/**
 * A parent or guardian's consent, asked before a child's birth details leave the browser
 * (docs/09). Kept in memory only and always starts unticked. The backend refuses the
 * calculation without it and logs that it was given (backend/app/api/guardian.py).
 */
export function useGuardianConsent() {
  const [given, setGiven] = useState(false);
  // Counts the blocked tries, so each one moves the focus to the box again.
  const [blocked, setBlocked] = useState(0);
  const set = (value: boolean) => {
    setGiven(value);
    setBlocked(0);
  };
  return {
    given,
    blocked,
    set,
    /** True when consent was given. If not, shows the error and takes the visitor to the box. */
    check: () => {
      if (!given) setBlocked((count) => count + 1);
      return given;
    },
    /** Consent is for one child: another child needs it again. */
    reset: () => set(false),
  };
}

type Props = {
  t: Dictionary["guardian"];
  lang: Locale;
  tool: "babyNames" | "firstLetters";
  consent: ReturnType<typeof useGuardianConsent>;
};

export function GuardianConsent({ t, lang, tool, consent }: Props) {
  const hydrated = useHydrated();
  const uid = useId();
  const box = useRef<HTMLInputElement>(null);
  const { given, blocked, set } = consent;
  useEffect(() => {
    if (blocked > 0) box.current?.focus();
  }, [blocked]);
  const invalid = blocked > 0 && !given;
  return (
    <div className={`${styles.box} ${invalid ? styles.invalid : ""}`} data-guardian-consent>
      <label className={styles.label}>
        <input
          ref={box}
          type="checkbox"
          required
          disabled={!hydrated}
          checked={given}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${uid}-error ${uid}-note` : `${uid}-note`}
          onChange={(event) => set(event.target.checked)}
        />
        <span>{t.consent[tool]}</span>
      </label>
      {invalid && (
        <p id={`${uid}-error`} className={styles.error}>
          {t.error}
        </p>
      )}
      <p id={`${uid}-note`} className={styles.note}>
        {t.note}{" "}
        <a href={`/${lang}/privacy`} target="_blank" rel="noopener">
          {t.privacy}
        </a>
      </p>
    </div>
  );
}
