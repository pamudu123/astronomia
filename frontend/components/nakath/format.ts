import type { Dictionary } from "@/app/[lang]/dictionaries";
import { fill, formatDate } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import type { LocalTime, PanchangaPart } from "@/lib/nakath";

/** "14 April 2027" for the local date of a time. */
export const localDate = (time: LocalTime, lang: Locale) => formatDate(`${time.date}T00:00:00Z`, lang);

/** "14 April 2027" for a YYYY-MM-DD date. */
export const dayText = (day: string, lang: Locale) => formatDate(`${day}T00:00:00Z`, lang);

/** "until 15:25" for the day's first part, "from 15:25" for later ones, with the date when it is another day. */
export function partTime(part: PanchangaPart, index: number, day: string, t: Dictionary["nakath"], lang: Locale): string {
  const [time, one, other] = index === 0 ? [part.end, t.until, t.untilDay] : [part.start, t.from, t.fromDay];
  return time.date === day ? fill(one, { time: time.clock }) : fill(other, { time: time.clock, date: localDate(time, lang) });
}
