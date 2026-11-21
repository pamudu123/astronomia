"use client";

import { useEffect, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { onSavedChange, signOutEverywhere, signOutHere } from "@/lib/account";
import { fill } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { type Who, continueWithGoogle, signInConfigured, whoIsSignedIn } from "@/lib/supabase";

import styles from "./MyReports.module.css";

/** Who is signed in on this browser, kept up to date. Undefined until known. */
export function useWho(): Who | undefined {
  const [who, setWho] = useState<Who | undefined>(undefined);
  useEffect(() => {
    let current = true;
    const read = () => {
      whoIsSignedIn()
        .then((next) => current && setWho(next))
        .catch(() => current && setWho(null));
    };
    read();
    const stop = onSavedChange(read);
    return () => {
      current = false;
      stop();
    };
  }, []);
  return who;
}

type Props = {
  lang: Locale;
  t: Dictionary["saved"];
  who: Who | undefined;
  hasReports: boolean;
  onSignedOut?: () => void;
};

/**
 * "Continue with Google" in My reports. A guest links Google and keeps every report; someone
 * who saved on another device signs in to see them here. Once signed in, it says with which
 * account, with "Sign out of this phone" and "Sign out everywhere". The footer's "Already saved?
 * Sign in" link leads here (#sign-in).
 */
export function GoogleSignIn({ lang, t, who, hasReports, onSignedOut }: Props) {
  const [step, setStep] = useState<"idle" | "opening" | "signingOut" | "failed">("idle");
  if (!signInConfigured() || who === undefined) return null;

  async function leave(signOut: () => Promise<void>) {
    setStep("signingOut");
    try {
      await signOut();
      setStep("idle");
      onSignedOut?.();
    } catch {
      setStep("failed");
    }
  }

  if (who?.kind === "google") {
    const busy = step === "signingOut";
    return (
      <section id="sign-in" className={styles.signIn} data-signed-in="google">
        <p>{who.email ? fill(t.signedInAs, { email: who.email }) : t.signedIn}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.textButton} disabled={busy} onClick={() => leave(signOutHere)}>
            {busy ? t.signingOut : t.signOutHere}
          </button>
          <button
            type="button"
            className={styles.textButton}
            disabled={busy}
            onClick={() => leave(signOutEverywhere)}
          >
            {t.signOutEverywhere}
          </button>
        </div>
        <p className="soft">{t.signOutNote}</p>
        {step === "failed" && (
          <p role="alert" className={styles.error}>
            {t.actionFailed}
          </p>
        )}
      </section>
    );
  }

  async function go() {
    setStep("opening");
    try {
      await continueWithGoogle(lang, `/${lang}/my`);
      // The browser is on its way to Google.
    } catch {
      setStep("failed");
    }
  }

  const keep = who?.kind === "guest" && hasReports;
  return (
    <section id="sign-in" className={styles.signIn} data-signed-in={who?.kind ?? "none"}>
      {keep && <h2 className={`display ${styles.signInTitle}`}>{t.googleTitle}</h2>}
      <p className="soft">{keep ? t.googleText : t.googleElsewhere}</p>
      <button
        type="button"
        className={`btn btn-outline lift ${styles.google}`}
        onClick={go}
        disabled={step === "opening"}
        aria-busy={step === "opening"}
        data-google
      >
        <GoogleMark />
        {step === "opening" ? t.googleOpening : t.googleButton}
      </button>
      {step === "failed" && (
        <p role="alert" className={styles.error}>
          {t.googleFailed}
        </p>
      )}
    </section>
  );
}

/** Google's "G", in its colours, as Google's sign in guidance asks. */
function GoogleMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
