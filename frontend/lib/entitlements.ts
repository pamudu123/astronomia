/**
 * What a visitor may use. The one website place for that check (docs/18, section 6).
 *
 * Only single reports are sold, so what is paid is always one report. On a hadahan or porondam
 * result the page asks the backend which features this account has on that report
 * (POST /v1/reports/access, backend/app/tiers). The AI route (app/api/explain) asks the same
 * thing before it writes a chapter, so nothing paid can be reached by calling it directly.
 *
 * While the server's paid reports switch is off, the backend gives every feature to everyone.
 */
import type { components } from "./api-types";

export type Feature = components["schemas"]["AccessOut"]["features"][number];
export type Access = components["schemas"]["AccessOut"];

/**
 * What the page knows about the report on it:
 * - none: the page shows no report (nakath, baby names and the other tools). Their explain
 *   buttons are not part of a paid report, so they stay free.
 * - loading: still asking the backend
 * - ready: the backend's answer
 */
export type AccessState = { state: "none" } | { state: "loading" } | { state: "ready"; access: Access };

export const NO_REPORT: AccessState = { state: "none" };

export function canUse(feature: Feature, access: AccessState = NO_REPORT): boolean {
  if (access.state === "none") return true;
  if (access.state === "loading") return false;
  return access.access.features.includes(feature);
}

/** AI chapters that belong to a paid report: the chart and match readings and their buttons. */
export function isReportChapter(id: string): boolean {
  return id.startsWith("chart.") || id.startsWith("match.");
}
