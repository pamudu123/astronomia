import type { ReactNode } from "react";

/**
 * The one place the wedding nakath finder will be locked for paid users (docs/07).
 * For now it shows its children to everyone. The finder on the porondam result goes through it.
 */
export function WeddingGate({ children }: { children: ReactNode }) {
  return children;
}
