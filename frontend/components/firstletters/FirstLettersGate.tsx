import type { ReactNode } from "react";

/**
 * The one place the first letters finder would be locked if it becomes paid (docs/07).
 * For now it shows its children to everyone.
 */
export function FirstLettersGate({ children }: { children: ReactNode }) {
  return children;
}
