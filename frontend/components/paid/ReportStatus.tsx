"use client";

import { useContext } from "react";

import { Check } from "@/components/porondam/Check";
import type { Locale } from "@/lib/i18n";
import type { AccessState } from "@/lib/entitlements";

import { BuyButton } from "./BuyInvite";
import styles from "./ReportStatus.module.css";
import { CheckFailed, PaidText, useReportAccess } from "./ReportAccess";

/**
 * Which version of the report the page shows: "full" once it is paid for, "off" where nothing
 * is sold (no report on the page, or paid reports switched off on the server), and "free"
 * otherwise. The free version shows first, while the paid check is still on its way and when
 * it had no answer.
 */
export function reportVersion(access: AccessState, hasReport: boolean): "free" | "full" | "off" {
  if (!hasReport || access.state === "none") return "off";
  if (access.state !== "ready") return "free";
  if (access.access.paid) return "full";
  return access.access.paid_reports ? "free" : "off";
}

export function useReportVersion(): "free" | "full" | "off" {
  const { access, report } = useReportAccess();
  return reportVersion(access, Boolean(report));
}

/** "Free version" or "Full report", by the title of a hadahan or porondam result. */
export function VersionBadge() {
  const t = useContext(PaidText);
  const version = useReportVersion();
  if (!t || version === "off") return null;
  return version === "full" ? (
    <span className={`${styles.badge} ${styles.full}`} data-version="full">
      <Check ok /> {t.paidBadge}
    </span>
  ) : (
    <span className={styles.badge} data-version="free">
      {t.freeBadge}
    </span>
  );
}

/** "Get the full report", with the result's other actions at the top, while it is the free version. */
export function GetFullReport({ lang }: { lang: Locale }) {
  const t = useContext(PaidText);
  if (useReportVersion() !== "free" || !t) return null;
  return <BuyButton lang={lang} label={t.getFull} className="btn btn-primary lift" />;
}

/**
 * At the top of a result, when the paid check had no answer: says the free version is shown, and
 * asks again. "Free version" and "Get the full report" are right above it, so it does not repeat them.
 */
export function FreeNote() {
  const { access, report } = useReportAccess();
  if (!report || access.state !== "failed") return null;
  return <CheckFailed buy={false} badge={false} />;
}
