"use client";

import Link from "next/link";
import { useContext } from "react";

import { Lock } from "@/components/Icons";
import { buyPath, keepBasket } from "@/lib/buy";
import type { Locale } from "@/lib/i18n";
import { formatPrice } from "@/lib/paid";

import styles from "./BuyInvite.module.css";
import { CheckFailed, PaidText, useReportAccess } from "./ReportAccess";

/** To the buying page, with the report on this page. */
export function BuyButton({ lang, className = "btn btn-primary lift" }: { lang: Locale; className?: string }) {
  const t = useContext(PaidText);
  const { report, kuja } = useReportAccess();
  if (!t || !report) return null;
  return (
    <Link
      href={buyPath(lang)}
      className={className}
      data-buy
      onClick={() => keepBasket({ report, kuja, back: window.location.pathname + window.location.search })}
    >
      {t.buy}
    </Link>
  );
}

/**
 * In place of something only the full report has: what it is, its price and the way to buy it.
 * `detail` is for a place of its own, such as the Kuja dosha rules. `compact` leaves out the line
 * on what is in it, where the page says so already.
 */
export function BuyInvite({ lang, detail, compact = false }: { lang: Locale; detail?: string; compact?: boolean }) {
  const t = useContext(PaidText);
  const { access, report, kind } = useReportAccess();
  if (!t) return null;
  if (access.state === "loading") {
    return (
      <p className={styles.line} role="status">
        {t.checking}
      </p>
    );
  }
  if (access.state === "failed") return <CheckFailed />;
  if (access.state !== "ready") return null;

  // A shared result: its full report belongs to whoever shared it.
  if (!report) {
    return (
      <div className={styles.invite} data-buy-invite="shared">
        <p className={styles.line}>{t.inviteShared}</p>
        <Link href={`/${lang}/${kind ?? "hadahan"}`} className={styles.link}>
          {kind === "porondam" ? t.makePorondam : t.makeHadahan}
        </Link>
      </div>
    );
  }

  const { price } = access.access;
  return (
    <div className={`${styles.invite} ${compact ? styles.compact : ""}`} data-buy-invite={compact ? "compact" : "full"}>
      {!compact && (
        <div className={styles.words}>
          <p className={styles.title}>
            <Lock size={16} /> {t.inviteTitle}
          </p>
          <p className={styles.line}>
            {detail ?? (report.kind === "hadahan" ? t.inviteHadahan : t.invitePorondam)}
          </p>
        </div>
      )}
      <div className={styles.action}>
        <span className={styles.price} data-price>
          {formatPrice(price, lang)} <span className={styles.per}>{t.perReport}</span>
        </span>
        <BuyButton lang={lang} className={`btn btn-primary lift ${styles.button}`} />
      </div>
    </div>
  );
}
