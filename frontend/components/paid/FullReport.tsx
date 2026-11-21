"use client";

import Link from "next/link";
import { type FormEvent, useContext, useId, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { Lock } from "@/components/Icons";
import { fill } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { type CouponQuote, applyCoupon, cleanCode, formatPrice, signInForReport, unlockReport } from "@/lib/paid";
import { RequestError } from "@/lib/request";

import styles from "./FullReport.module.css";
import { PaidText, useReportAccess } from "./ReportAccess";

type Text = Dictionary["paid"];
type Problem = keyof Text["problems"];

/** What a refused unlock or Apply means for the person, from the backend's answer. */
function problemOf(caught: unknown): Problem {
  if (!(caught instanceof RequestError)) return "failed";
  if (caught.status === 401) return "signIn";
  if (caught.status === 402) return "payment_not_available";
  if (caught.status === 429) return "tooMany";
  if (caught.status === 409 && caught.detail && caught.detail in PROBLEMS) return caught.detail as Problem;
  return "failed";
}

const PROBLEMS = {
  unknown: true,
  ended: true,
  wrong_report: true,
  used_up: true,
  account_limit: true,
} as const;

/** In place of detail that only the full report shows. */
export function DetailLocked() {
  const t = useContext(PaidText);
  if (!t) return null;
  return (
    <p className={styles.small} data-locked="full_detail">
      <Lock size={14} /> {t.detailLocked}
    </p>
  );
}

/**
 * "Get the full report" (docs/18, section 4), under a hadahan or porondam result. Shows the
 * price from the server, asks for Google sign in, takes a coupon, and unlocks the report when
 * the coupon makes it free. Nothing shows while paid reports are switched off on the server.
 */
export function FullReport({ lang }: { lang: Locale }) {
  const t = useContext(PaidText);
  const { access, report, set } = useReportAccess();
  const base = useId();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [quote, setQuote] = useState<CouponQuote | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState<"apply" | "unlock" | null>(null);

  if (!t || !report || access.state !== "ready" || !access.access.paid_reports) return null;
  const { paid, account, price } = access.access;

  if (paid) {
    return (
      <section className={`rise ${styles.card} ${styles.paid}`} aria-labelledby={`${base}-title`} data-card="full-report">
        <span className={styles.badge}>{t.paidBadge}</span>
        <h2 id={`${base}-title`} className={`display ${styles.title}`}>
          {t.paidTitle}
        </h2>
        <p className="soft">
          {t.paidText}{" "}
          <Link href={`/${lang}/my`} className={styles.link}>
            {t.openMyReports}
          </Link>
        </p>
      </section>
    );
  }

  async function apply(event: FormEvent) {
    event.preventDefault();
    const typed = cleanCode(code);
    if (!typed || !report) return;
    setBusy("apply");
    setProblem(null);
    setQuote(null);
    try {
      const found = await applyCoupon(report.kind, typed);
      if (found.result === "free" || found.result === "payment_not_available") setQuote(found);
      else setProblem(found.result);
    } catch (caught) {
      setProblem(problemOf(caught));
    } finally {
      setBusy(null);
    }
  }

  async function unlock() {
    if (!report) return;
    setBusy("unlock");
    setProblem(null);
    try {
      const done = await unlockReport(report, cleanCode(code));
      set(done.access);
    } catch (caught) {
      setProblem(problemOf(caught));
      setQuote(null);
    } finally {
      setBusy(null);
    }
  }

  const signedIn = account === "google";
  const free = quote?.result === "free";

  return (
    <section className={`rise ${styles.card}`} aria-labelledby={`${base}-title`} data-card="full-report">
      <div className={styles.head}>
        <div>
          <h2 id={`${base}-title`} className={`display ${styles.title}`}>
            {t.title}
          </h2>
          <p className="soft">{report.kind === "hadahan" ? t.leadHadahan : t.leadPorondam}</p>
        </div>
        <p className={styles.price} data-price>
          {quote?.new_price ? (
            <>
              <s className={styles.was}>{formatPrice(price, lang)}</s> {formatPrice(quote.new_price, lang)}
            </>
          ) : (
            formatPrice(price, lang)
          )}
          <span className={styles.per}>{t.perReport}</span>
        </p>
      </div>

      <ul className={styles.includes}>
        {t.includes.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      {!signedIn ? (
        <div className={styles.signIn}>
          <button type="button" className="btn btn-primary lift" onClick={signInForReport} data-sign-in>
            {t.continueGoogle}
          </button>
          <p className={styles.small}>{t.signInWhy}</p>
        </div>
      ) : (
        <div className={styles.coupon}>
          {!open ? (
            <button type="button" className={styles.linkButton} onClick={() => setOpen(true)} aria-expanded={false}>
              {t.haveCoupon}
            </button>
          ) : (
            <form className={styles.form} onSubmit={apply}>
              <label htmlFor={`${base}-code`} className={styles.label}>
                {t.couponLabel}
              </label>
              <div className={styles.row}>
                <input
                  id={`${base}-code`}
                  className={styles.input}
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    setQuote(null);
                    setProblem(null);
                  }}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={100}
                />
                <button type="submit" className="btn btn-outline lift" disabled={busy !== null || !cleanCode(code)}>
                  {busy === "apply" ? t.applying : t.apply}
                </button>
              </div>
            </form>
          )}

          <div role="status" className={styles.status}>
            {quote && (
              <p>
                {free
                  ? t.freeNote
                  : fill(t.discountNote, { percent: quote.percent_off ?? 0, price: formatPrice(quote.new_price!, lang) })}
              </p>
            )}
          </div>
          {problem && (
            <p role="alert" className={styles.error}>
              {t.problems[problem]}
            </p>
          )}

          {free ? (
            <button
              type="button"
              className="btn btn-primary lift"
              onClick={unlock}
              disabled={busy !== null}
              aria-busy={busy === "unlock"}
              data-unlock
            >
              {busy === "unlock" ? t.unlocking : t.unlockFree}
            </button>
          ) : (
            quote && (
              <p className={styles.small}>
                <Lock size={14} /> {t.paymentLater}
              </p>
            )
          )}
        </div>
      )}
    </section>
  );
}
