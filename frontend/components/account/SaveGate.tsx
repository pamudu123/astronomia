import type { ReactNode } from "react";

/**
 * The one frontend place that decides who may save a result to My reports (docs/14).
 * For now it shows its children to everyone. Once payments exist, only paid reports can be
 * saved: a free result then shows the way to the full report here instead. The backend's
 * `save_access()` makes the same check, so this only decides what is shown.
 */
export function SaveGate({ children }: { children: ReactNode }) {
  return children;
}
