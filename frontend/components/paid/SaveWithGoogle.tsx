"use client";

import { type ReactNode, useContext, useId, useState } from "react";

import { GoogleMark } from "@/components/account/GoogleSignIn";
import type { Locale } from "@/lib/i18n";
import { continueWithGoogle, signInConfigured } from "@/lib/supabase";

import styles from "./FullReport.module.css";
import { PaidText } from "./ReportAccess";

/**
 * After a report is unlocked: an offer to keep it in a Google account (docs/23). Optional. The
 * guest who bought it becomes that account, or joins it (lib/supabase.ts), and without it the
 * report stays unlocked on this browser. `children` is the way to go on without it.
 */
export function SaveWithGoogle({ lang, next, children }: { lang: Locale; next: string; children?: ReactNode }) {
  const t = useContext(PaidText);
  const base = useId();
  const [step, setStep] = useState<"idle" | "opening" | "failed">("idle");
  if (!t || !signInConfigured()) return null;

  async function go() {
    setStep("opening");
    try {
      await continueWithGoogle(lang, next);
      // The browser is on its way to Google.
    } catch {
      setStep("failed");
    }
  }

  return (
    <section className={styles.google} aria-labelledby={`${base}-title`} data-save-google>
      <h3 id={`${base}-title`} className={styles.googleTitle}>
        {t.google.title}
      </h3>
      <p className={styles.googleText}>{t.google.text}</p>
      <div className={styles.googleActions}>
        <button
          type="button"
          className={`btn btn-outline lift ${styles.googleButton}`}
          onClick={go}
          disabled={step === "opening"}
          aria-busy={step === "opening"}
        >
          <GoogleMark />
          {step === "opening" ? t.google.opening : t.google.button}
        </button>
        {children}
      </div>
      {step === "failed" && (
        <p role="alert" className={styles.error}>
          {t.google.failed}
        </p>
      )}
    </section>
  );
}
