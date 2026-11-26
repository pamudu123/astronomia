"use client";

import { type ReactNode, useContext } from "react";

import { Lock } from "@/components/Icons";
import { BuyInvite } from "@/components/paid/BuyInvite";
import { PaidText, useCanUse } from "@/components/paid/ReportAccess";
import type { Locale } from "@/lib/i18n";

import styles from "./Wedding.module.css";

/**
 * The one place the wedding nakath finder is locked (docs/07). It is part of the couple's full
 * porondam report: once that is bought it opens, with no payment of its own. Until then it shows
 * its title with a lock and the way to buy the report. The backend checks the same thing
 * (wedding_access in backend/app/api/wedding.py).
 */
export function WeddingGate({
  lang,
  title,
  lead,
  children,
}: {
  lang: Locale;
  title: string;
  lead: string;
  children: ReactNode;
}) {
  const t = useContext(PaidText);
  const open = useCanUse("wedding_dates");
  if (open || !t) return children;
  return (
    <section className={`rise ${styles.panel}`} aria-labelledby="wedding-title" data-card="wedding" data-locked="wedding_dates">
      <h2 id="wedding-title" className={`display ${styles.lockedTitle}`}>
        <Lock size={22} color="var(--gold)" />
        <span>{title}</span>
        <span className="visually-hidden">({t.locked})</span>
      </h2>
      <p className="soft">{lead}</p>
      <p className={styles.lockedText}>{t.weddingLocked}</p>
      <BuyInvite lang={lang} compact />
    </section>
  );
}
