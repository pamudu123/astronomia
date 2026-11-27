"use client";

import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { type Access, type AccessState, NO_REPORT, type Feature, canUse } from "@/lib/entitlements";
import { onSavedChange } from "@/lib/account";
import { fetchAccess, fetchPaidReportsOn } from "@/lib/paid";
import type { ReportRequest } from "@/lib/report";

import { BuyButton } from "./BuyInvite";
import styles from "./FullReport.module.css";

type Value = {
  access: AccessState;
  /** The report on the page, for the AI route's paid check. Null where there is none. */
  report: ReportRequest | null;
  /** Which kind of report the page shows, also where it is shared. */
  kind: ReportRequest["kind"] | null;
  /** The chart on the page has Kuja dosha, whose rules the full report opens. */
  kuja: boolean;
  /** Takes the answer from an unlock, so the page opens up at once. */
  set: (access: Access) => void;
  /** Asks the backend again, after a check that failed. */
  retry: () => void;
  /** True while that is on its way. */
  retrying: boolean;
};

const NOTHING = { set: () => {}, retry: () => {}, retrying: false };
const ReportAccessContext = createContext<Value>({
  ...NOTHING,
  access: NO_REPORT,
  report: null,
  kind: null,
  kuja: false,
});

/** The words of "Get the full report", given once by the layout for every page. */
export const PaidText = createContext<Dictionary["paid"] | null>(null);

export function PaidTextProvider({ value, children }: { value: Dictionary["paid"]; children: ReactNode }) {
  return <PaidText value={value}>{children}</PaidText>;
}

/**
 * Asks the backend what this account may use on the report on the page (docs/18, section 6),
 * once per report. Everything inside reads the answer with useReportAccess or useCanUse.
 */
export function ReportAccessProvider({
  report,
  kuja = false,
  children,
}: {
  report: ReportRequest;
  kuja?: boolean;
  children: ReactNode;
}) {
  const key = JSON.stringify(report);
  const [found, setFound] = useState<{ key: string; access: Access } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // Asked again when the sign in changes (back from Google, signed out), which lib/account.ts
  // announces, and when the tab comes back into view.
  const [asked, setAsked] = useState(0);
  useEffect(() => onSavedChange(() => setAsked((count) => count + 1)), []);
  const [retrying, setRetrying] = useState(false);
  const retry = useCallback(() => {
    setRetrying(true);
    setAsked((count) => count + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchAccess(JSON.parse(key) as ReportRequest, { signal: controller.signal })
      .then((access) => setFound({ key, access }))
      .catch(() => {
        if (!controller.signal.aborted) setFailed(key);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRetrying(false);
      });
    return () => controller.abort();
  }, [key, asked]);

  const set = useCallback((access: Access) => setFound({ key, access }), [key]);
  const value = useMemo<Value>(() => {
    const parsed = JSON.parse(key) as ReportRequest;
    const rest = { report: parsed, kind: parsed.kind, kuja, set, retry, retrying };
    if (found?.key === key) return { ...rest, access: { state: "ready", access: found.access } };
    // No answer from the backend: the free result shows, with a way to ask again (FullReport).
    // The server would refuse anything paid until it can check.
    if (failed === key) return { ...rest, access: { state: "failed" } };
    return { ...rest, access: { state: "loading" } };
  }, [found, failed, key, kuja, set, retry, retrying]);

  return <ReportAccessContext value={value}>{children}</ReportAccessContext>;
}

const FREE: Access = {
  paid: false,
  features: [],
  paid_reports: false,
  account: null,
  price: { amount: 0, currency: "LKR" },
  checkout: null,
};

/**
 * A hadahan or porondam result. With its request, the backend says what this account may use
 * on it. A shared result has no request (its viewer cannot unlock it here): it shows every
 * feature while paid reports are switched off on the server, and the free result once they
 * are on, or while the server cannot say.
 */
export function ReportScope({
  report,
  kind,
  kuja = false,
  children,
}: {
  report: ReportRequest | null;
  kind: ReportRequest["kind"];
  /** The chart has Kuja dosha, whose rules the full report opens. */
  kuja?: boolean;
  children: ReactNode;
}) {
  if (report) {
    return (
      <ReportAccessProvider report={report} kuja={kuja}>
        {children}
      </ReportAccessProvider>
    );
  }
  return <SharedAccess kind={kind}>{children}</SharedAccess>;
}

function SharedAccess({ kind, children }: { kind: ReportRequest["kind"]; children: ReactNode }) {
  const [on, setOn] = useState<boolean | "failed" | null>(null);
  const [asked, setAsked] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const retry = useCallback(() => {
    setRetrying(true);
    setAsked((count) => count + 1);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetchPaidReportsOn(kind, { signal: controller.signal })
      .then(setOn)
      .catch(() => {
        if (!controller.signal.aborted) setOn("failed"); // as above: the free result
      })
      .finally(() => {
        if (!controller.signal.aborted) setRetrying(false);
      });
    return () => controller.abort();
  }, [kind, asked]);
  const value = useMemo<Value>(() => {
    const rest = { ...NOTHING, report: null, kind, kuja: false, retry, retrying };
    if (on === null) return { ...rest, access: { state: "loading" } };
    if (on === "failed") return { ...rest, access: { state: "failed" } };
    if (!on) return { ...rest, access: NO_REPORT };
    return { ...rest, access: { state: "ready", access: FREE } };
  }, [on, kind, retry, retrying]);
  return (
    <ReportAccessContext value={value}>
      {children}
      {/* A shared page has no "Get the full report" card to offer it in. */}
      {on === "failed" && (
        <div className="container">
          <CheckFailed />
        </div>
      )}
    </ReportAccessContext>
  );
}

/**
 * In place of the paid check's answer when there was none. The page is then the free version,
 * so this says so, offers the full analysis, and can ask the backend again.
 */
export function CheckFailed({
  text,
  buy = true,
  badge = true,
}: {
  text?: string;
  /** False where a buy button is beside it already. */
  buy?: boolean;
  /** False where the page says "Free version" beside it already. */
  badge?: boolean;
}) {
  const t = useContext(PaidText);
  const { retry, retrying, report } = useReportAccess();
  if (!t) return null;
  return (
    <div className={styles.checkFailed} data-check-failed>
      <div className={styles.checkWords}>
        {badge && <span className={styles.freeBadge}>{t.freeBadge}</span>}
        <p role="status">{text ?? t.checkFailed}</p>
      </div>
      <div className={styles.checkActions}>
        {buy && report && <BuyButton label={t.getFullAnalysis} className="btn btn-primary lift" />}
        {/* Kept enabled while asking, so the keyboard does not lose its place. */}
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => !retrying && retry()}
          aria-busy={retrying}
        >
          {retrying ? t.checking : t.checkAgain}
        </button>
      </div>
    </div>
  );
}

export const useReportAccess = () => useContext(ReportAccessContext);

export function useCanUse(feature: Feature): boolean {
  return canUse(feature, useReportAccess().access);
}

/** Shows its children where the report has `feature`, and `locked` (if any) elsewhere. */
export function PaidOnly({
  feature,
  locked = null,
  children,
}: {
  feature: Feature;
  locked?: ReactNode;
  children: ReactNode;
}) {
  return useCanUse(feature) ? children : locked;
}
