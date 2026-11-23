import { useCallback, useEffect, useState } from "react";

import { type Labels, fetchLabels } from "./hadahan";
import type { Locale } from "./i18n";

/**
 * The names a form and its result need. When they cannot be loaded (a sleeping backend can take
 * a minute to wake), `failed` says so and `retry` asks again without touching the form.
 */
export function useLabels(lang: Locale): { labels: Labels | null; failed: boolean; retry: () => void } {
  const [labels, setLabels] = useState<Labels | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    fetchLabels(lang)
      .then((found) => {
        if (!current) return;
        setLabels(found);
        setFailed(false);
      })
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [lang, attempt]);

  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((count) => count + 1);
  }, []);
  return { labels, failed: failed && !labels, retry };
}
