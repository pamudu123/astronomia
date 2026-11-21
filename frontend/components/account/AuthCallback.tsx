"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { mergeGuest } from "@/lib/account";
import type { Locale } from "@/lib/i18n";
import {
  ALREADY_LINKED,
  callbackParams,
  finishSignIn,
  safeNext,
  signInKeepingGuest,
  takeGuestToken,
} from "@/lib/supabase";

import styles from "./MyReports.module.css";

type Props = { lang: Locale; t: Dictionary["saved"] };

type Step = "working" | "moving" | "failed" | "mergeFailed";

/**
 * Back from Google, through Supabase.
 *
 * - A guest who linked Google is now the same account with Google added.
 * - Someone signing in on another device is now signed in.
 * - A guest whose Google account already had its own Sidera account could not link it: this
 *   signs in with that account, keeping the guest's sign in aside, and on the way back asks the
 *   backend to move the guest's reports into it.
 *
 * Then on to where they came from.
 */
export function AuthCallback({ lang, t }: Props) {
  const [step, setStep] = useState<Step>("working");

  useEffect(() => {
    const { code, error, next } = callbackParams(window.location.href);
    const goOn = () => window.location.replace(safeNext(next, lang));

    async function run(): Promise<void> {
      if (error === ALREADY_LINKED) {
        await signInKeepingGuest(lang, safeNext(next, lang));
        setStep("moving"); // the browser is on its way to Google
        return;
      }
      if (error || !code) throw new Error(error ?? "no code");
      await finishSignIn(code);
      const guest = takeGuestToken();
      if (guest) {
        setStep("moving");
        try {
          await mergeGuest(guest);
        } catch {
          setStep("mergeFailed");
          return;
        }
      }
      goOn();
    }

    run().catch(() => setStep("failed"));
  }, [lang]);

  const problem = step === "failed" ? t.callbackFailed : step === "mergeFailed" ? t.mergeFailed : null;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <header className={`rise ${styles.head}`}>
        <h1 className={`display ${styles.title}`}>{t.callbackTitle}</h1>
      </header>
      {problem ? (
        <div className={styles.empty}>
          <p role="alert">{problem}</p>
          <Link href={`/${lang}/my`} className="btn btn-outline lift">
            {t.back}
          </Link>
        </div>
      ) : (
        <p role="status" className="soft">
          {step === "moving" ? t.mergeWorking : t.callbackWorking}
        </p>
      )}
    </main>
  );
}
