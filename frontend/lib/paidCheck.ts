import "server-only";

import { type Access, isReportChapter } from "./entitlements";
import { backendHeaders } from "./staging";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";

/**
 * The headers that tell the backend whose account this is. The page sends its Supabase access
 * token in X-Sidera-Token, and the site's /api forward (proxy.ts, lib/forward.ts) has already
 * turned it into `Authorization: Bearer` and dropped any staging password before this route
 * runs. Only a bearer token is passed on.
 */
function accountHeaders(request: Request): Record<string, string> {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? { authorization } : {};
}

export type PaidCheck = "allowed" | "locked" | "unavailable" | "invalid";

/**
 * Whether the AI may write this chapter for this browser (docs/18, section 6). Chart and match
 * chapters belong to a paid report: the backend says whether the account paid for `report`.
 * A shared page has no report to send: its chapters are free only while paid reports are off.
 * The other pages' chapters (nakath, baby names and so on) are free.
 */
export async function paidCheck(
  request: Request,
  id: string,
  report: unknown,
  send: typeof fetch = fetch,
): Promise<PaidCheck> {
  if (!isReportChapter(id)) return "allowed";
  const headers = { ...backendHeaders(), ...accountHeaders(request), "Content-Type": "application/json" };
  try {
    if (report && typeof report === "object") {
      const response = await send(`${BACKEND}/v1/reports/access`, {
        method: "POST",
        headers,
        body: JSON.stringify(report),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (response.status === 422) return "invalid";
      if (!response.ok) return "unavailable";
      const access = (await response.json()) as Access;
      const allowed = access.features.includes("ai_reading") || access.features.includes("ai_explain");
      return allowed ? "allowed" : "locked";
    }
    const kind = id.startsWith("chart.") ? "hadahan" : "porondam";
    const response = await send(`${BACKEND}/v1/price?kind=${kind}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return "unavailable";
    const { paid_reports } = (await response.json()) as { paid_reports: boolean };
    return paid_reports ? "locked" : "allowed";
  } catch {
    return "unavailable";
  }
}
