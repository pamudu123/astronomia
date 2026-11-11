export const locales = ["si", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export function hasLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** The same page in another language: swaps the first path segment. */
export function switchLocalePath(pathname: string, to: Locale): string {
  const parts = pathname.split("/");
  if (parts.length > 1 && hasLocale(parts[1])) {
    parts[1] = to;
    return parts.join("/") || `/${to}`;
  }
  const rest = pathname === "/" ? "" : pathname;
  return `/${to}${rest}`;
}

/**
 * Choose a language from the Accept-Language header.
 * Sinhala only when the browser ranks it above English. Everyone else gets English.
 */
export function pickLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return defaultLocale;
  const ranked = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().toLowerCase().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      const weight = q ? Number.parseFloat(q.trim().slice(2)) : 1;
      return { lang: tag.split("-")[0], weight: Number.isNaN(weight) ? 0 : weight, index };
    })
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  const first = ranked.find((entry) => hasLocale(entry.lang));
  return first && hasLocale(first.lang) ? first.lang : defaultLocale;
}
