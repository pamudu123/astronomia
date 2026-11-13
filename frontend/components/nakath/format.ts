import { formatDate } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import type { LocalTime } from "@/lib/nakath";

/** "14 April 2027" for the local date of a time. */
export const localDate = (time: LocalTime, lang: Locale) => formatDate(`${time.date}T00:00:00Z`, lang);

/** "14 April 2027" for a YYYY-MM-DD date. */
export const dayText = (day: string, lang: Locale) => formatDate(`${day}T00:00:00Z`, lang);
