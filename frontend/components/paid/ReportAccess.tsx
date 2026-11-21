"use client";

import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { type Access, type AccessState, NO_REPORT, type Feature, canUse } from "@/lib/entitlements";
import { fetchAccess, fetchPaidReportsOn } from "@/lib/paid";
import type { ReportRequest } from "@/lib/report";

type Value = {
  access: AccessState;
  /** The report on the page, for the AI route's paid check. Null where there is none. */
  report: ReportRequest | null;
  /** Takes the answer from an unlock, so the page opens up at once. */
  set: (access: Access) => void;
};

const ReportAccessContext = createContext<Value>({ access: NO_REPORT, report: null, set: () => {} });

/** The words of "Get the full report", given once by the layout for every page. */
export const PaidText = createContext<Dictionary["paid"] | null>(null);

export function PaidTextProvider({ value, children }: { value: Dictionary["paid"]; children: ReactNode }) {
  return <PaidText value={value}>{children}</PaidText>;
}

/**
 * Asks the backend what this account may use on the report on the page (docs/18, section 6),
 * once per report. Everything inside reads the answer with useReportAccess or useCanUse.
 */
export function ReportAccessProvider({ report, children }: { report: ReportRequest; children: ReactNode }) {
  const key = JSON.stringify(report);
  const [found, setFound] = useState<{ key: string; access: Access } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchAccess(JSON.parse(key) as ReportRequest, { signal: controller.signal })
      .then((access) => setFound({ key, access }))
      .catch(() => {
        if (!controller.signal.aborted) setFailed(key);
      });
    return () => controller.abort();
  }, [key]);

  const set = useCallback((access: Access) => setFound({ key, access }), [key]);
  const value = useMemo<Value>(() => {
    const parsed = JSON.parse(key) as ReportRequest;
    if (found?.key === key) return { access: { state: "ready", access: found.access }, report: parsed, set };
    // No answer from the backend: the free result, without the form (there is no price to show).
    if (failed === key) return { access: { state: "ready", access: FREE }, report: parsed, set };
    return { access: { state: "loading" }, report: parsed, set };
  }, [found, failed, key, set]);

  return <ReportAccessContext value={value}>{children}</ReportAccessContext>;
}

const FREE: Access = {
  paid: false,
  features: [],
  paid_reports: false,
  account: null,
  price: { amount: 0, currency: "LKR" },
};

/**
 * A hadahan or porondam result. With its request, the backend says what this account may use
 * on it. A shared result has no request (its viewer cannot unlock it here): it shows every
 * feature while paid reports are switched off on the server, and the free result once they
 * are on.
 */
export function ReportScope({
  report,
  kind,
  children,
}: {
  report: ReportRequest | null;
  kind: ReportRequest["kind"];
  children: ReactNode;
}) {
  if (report) return <ReportAccessProvider report={report}>{children}</ReportAccessProvider>;
  return <SharedAccess kind={kind}>{children}</SharedAccess>;
}

function SharedAccess({ kind, children }: { kind: ReportRequest["kind"]; children: ReactNode }) {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetchPaidReportsOn(kind, { signal: controller.signal })
      .then(setOn)
      .catch(() => {
        if (!controller.signal.aborted) setOn(true);
      });
    return () => controller.abort();
  }, [kind]);
  const value = useMemo<Value>(() => {
    if (on === null) return { access: { state: "loading" }, report: null, set: () => {} };
    if (!on) return { access: NO_REPORT, report: null, set: () => {} };
    return { access: { state: "ready", access: FREE }, report: null, set: () => {} };
  }, [on]);
  return <ReportAccessContext value={value}>{children}</ReportAccessContext>;
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
