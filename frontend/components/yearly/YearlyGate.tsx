import type { ReactNode } from "react";

/**
 * The one place the yearly forecast will be locked for paid users (docs/07).
 * For now it shows its children to everyone. Every yearly page and section goes through it.
 */
export function YearlyGate({ children }: { children: ReactNode }) {
  return children;
}
