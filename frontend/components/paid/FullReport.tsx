"use client";

import Link from "next/link";
import { useContext, useId } from "react";

import type { Locale } from "@/lib/i18n";
import { formatPrice, fullReportIncludes } from "@/lib/paid";

import { BuyButton, BuyInvite } from "./BuyInvite";
import styles from "./FullReport.module.css";
import { CheckFailed, PaidText, useReportAccess } from "./ReportAccess";
import { SaveWithGoogle } from "./SaveWithGoogle";

/** The card's id: My reports links a free report's "Get the full report" here, to keep it. */
export const FULL_REPORT = "full-report";

/** The card shows only after the paid check answers, too late for the browser's own jump. */
function scrollIfAsked(node: HTMLElement | null) {
  if (node && window.location.hash === `#${FULL_REPORT}`) node.scrollIntoView({ block: "start" });
}

/** In place of detail that only the full report shows. */
export function DetailLocked({ lang }: { lang: Locale }) {
  const t = useContext(PaidText);
  if (!t) return null;
  return (
    <div data-locked="full_detail">
      <BuyInvite lang={lang} detail={t.detailLocked} />
    </div>
  );
}

/**
 * "Get the full report" (docs/18, section 4; docs/23), under a hadahan or porondam result: what
 * it adds, the price from the server, and the way to the buying page. Once it is unlocked, it
 * says so, and offers a guest to keep it in a Google account. Nothing shows while paid reports
 * are switched off on the server.
 */
export function FullReport({ lang }: { lang: Locale }) {
  const t = useContext(PaidText);
  const { access, report, kuja } = useReportAccess();
  const base = useId();

  if (t && report && access.state === "failed") {
    return (
      <div id={FULL_REPORT} ref={scrollIfAsked} data-card="full-report">
        <CheckFailed />
      </div>
    );
  }
  if (!t || !report || access.state !== "ready" || !access.access.paid_reports) return null;
  const { paid, account, price } = access.access;

  if (paid) {
    return (
      <section
        id={FULL_REPORT}
        className={`rise ${styles.card} ${styles.paid}`}
        aria-labelledby={`${base}-title`}
        data-card="full-report"
      >
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
        {account === "guest" && <SaveWithGoogle lang={lang} next={`/${lang}/my`} />}
      </section>
    );
  }

  return (
    <section
      id={FULL_REPORT}
      ref={scrollIfAsked}
      className={`rise ${styles.card}`}
      aria-labelledby={`${base}-title`}
      data-card="full-report"
    >
      <div className={styles.head}>
        <div>
          <h2 id={`${base}-title`} className={`display ${styles.title}`}>
            {t.title}
          </h2>
          <p className="soft">{report.kind === "hadahan" ? t.leadHadahan : t.leadPorondam}</p>
        </div>
        <p className={styles.price} data-price>
          {formatPrice(price, lang)}
          <span className={styles.per}>{t.perReport}</span>
        </p>
      </div>

      <ul className={styles.includes}>
        {fullReportIncludes(report, kuja).map((line) => (
          <li key={line}>{t.includes[line]}</li>
        ))}
      </ul>

      <div className={styles.buy}>
        <BuyButton lang={lang} />
        <p className={styles.small}>{t.buyNote}</p>
      </div>
    </section>
  );
}
