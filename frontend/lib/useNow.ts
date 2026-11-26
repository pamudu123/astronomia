import { useSyncExternalStore } from "react";

const MINUTE = 60_000;

function subscribe(changed: () => void) {
  const timer = setInterval(changed, 15_000);
  return () => clearInterval(timer);
}

/** The time to the minute, kept up to date. Null in the server HTML and until React takes over. */
export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / MINUTE) * MINUTE,
    () => null,
  );
}
