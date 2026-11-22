/**
 * The AI notice (legal review, docs/policies/refunds.md, "AI helper" row): shown before the
 * first chat message and before the first explanation or full reading, and nothing goes to
 * the AI until the person has acknowledged it (components/assistant/AiNotice.tsx).
 *
 * Acknowledged once per browser: remembered in localStorage. Where storage is blocked
 * (some private windows), it is remembered in memory, so the notice shows once per visit.
 */

/** Where the acknowledgement is kept. A new version here shows the notice again to everyone. */
export const NOTICE_KEY = "sidera.ai-notice";
export const NOTICE_VERSION = "2026-11-20";

let acknowledgedThisVisit = false;
const listeners = new Set<() => void>();

function stored(): boolean {
  try {
    return window.localStorage.getItem(NOTICE_KEY) === NOTICE_VERSION;
  } catch {
    return false;
  }
}

/** True once the person has acknowledged the notice in this browser (or this visit). */
export function acknowledged(): boolean {
  if (typeof window === "undefined") return false;
  return acknowledgedThisVisit || stored();
}

/** "I understand": remembered, and every notice on the page gives way to what it guards. */
export function acknowledge(): void {
  acknowledgedThisVisit = true;
  try {
    window.localStorage.setItem(NOTICE_KEY, NOTICE_VERSION);
  } catch {
    // Blocked storage: remembered for this visit only.
  }
  listeners.forEach((listener) => listener());
}

/** For useSyncExternalStore. Another tab acknowledging counts too. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === NOTICE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Tests only: forget this visit's acknowledgement. */
export function resetForTests(): void {
  acknowledgedThisVisit = false;
}
