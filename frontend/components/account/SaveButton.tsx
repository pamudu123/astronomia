"use client";

import Link from "next/link";
import { useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { saveReport } from "@/lib/account";
import type { Locale } from "@/lib/i18n";
import type { ReportRequest } from "@/lib/report";
import { RequestError } from "@/lib/request";

import styles from "./SaveButton.module.css";

type Props = {
  lang: Locale;
  t: Dictionary["saved"];
  request: ReportRequest;
};

type Step = "idle" | "saving" | "saved" | "already" | "failed" | "full" | "freeFull";

/**
 * Saves the result on the page to My reports. The first save signs this browser in to Supabase
 * as a guest; nobody is asked to sign up. Once payments exist, SaveGate decides who sees it.
 */
export function SaveButton({ lang, t, request }: Props) {
  const [step, setStep] = useState<Step>("idle");
  const done = step === "saved" || step === "already";

  async function save() {
    setStep("saving");
    try {
      const saved = await saveReport(request);
      setStep(saved.created ? "saved" : "already");
    } catch (caught) {
      setStep(fullStep(caught));
    }
  }
  const problem = step === "failed" ? t.failed : step === "full" ? t.limit : step === "freeFull" ? t.limitFree : null;

  return (
    <div className={styles.wrap} data-save>
      <button
        type="button"
        className={`btn btn-outline lift ${styles.button}`}
        onClick={save}
        disabled={step === "saving" || done}
        aria-busy={step === "saving"}
      >
        <Bookmark filled={done} />
        {step === "saving" ? t.saving : done ? t.savedButton : t.save}
      </button>
      <p className={styles.note} role="status">
        {done && (
          <>
            {step === "saved" ? t.savedNote : t.alreadyNote}{" "}
            <Link href={`/${lang}/my`} className={styles.link}>
              {t.open}
            </Link>
          </>
        )}
      </p>
      {problem && (
        <p role="alert" className={styles.error} data-save-problem={step}>
          {problem}
        </p>
      )}
    </div>
  );
}

/** Why a save was refused: the free reports are full (20 at a time), My reports is full, or it failed. */
function fullStep(caught: unknown): Step {
  if (!(caught instanceof RequestError) || caught.status !== 409) return "failed";
  return caught.detail === "free_limit" ? "freeFull" : "full";
}

function Bookmark({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    >
      <path d="M4.5 2.5h9v13L9 12l-4.5 3.5z" />
    </svg>
  );
}
