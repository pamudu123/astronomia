import { useCallback, useEffect, useState } from "react";

import type { Locale } from "./i18n";

export type Section<T> =
  | { status: "loading" | "failed"; retry: () => void }
  | { status: "ready"; value: T; retry: () => void };

type Answer<T> = { key: string; attempt: number; result: { value: T } | null };

/**
 * What one section of a result needs from the backend. `load` must be the same function on
 * every render. An answer for another request or language is never shown.
 */
export function useSection<R, T>(
  load: (request: R, lang: Locale) => Promise<T>,
  request: R,
  lang: Locale,
  enabled = true,
): Section<T> {
  const [attempt, setAttempt] = useState(0);
  const [answer, setAnswer] = useState<Answer<T> | null>(null);
  // By content, so a request rebuilt on a render is not asked for again.
  const key = JSON.stringify([request, lang]);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    const [asked, language] = JSON.parse(key) as [R, Locale];
    load(asked, language)
      .then((value) => current && setAnswer({ key, attempt, result: { value } }))
      // The rest of the result stands without this section, which says that it failed.
      .catch(() => current && setAnswer({ key, attempt, result: null }));
    return () => {
      current = false;
    };
  }, [load, key, attempt, enabled]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  if (answer?.key === key && answer.result) return { status: "ready", value: answer.result.value, retry };
  if (answer?.key === key && answer.attempt === attempt) return { status: "failed", retry };
  return { status: "loading", retry };
}
