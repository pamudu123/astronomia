import type { Dictionary } from "@/app/[lang]/dictionaries";
import { fill, formatDate } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import type { ChangeMove, PlanetChange } from "@/lib/changes";
import { RASHI } from "@/lib/rashi";

export type ChangesText = Dictionary["changes"];

const signName = (key: string, lang: Locale) => RASHI.find((rashi) => rashi.key === key)?.[lang] ?? key;

/** "5 December 2026" from a Sri Lanka date. */
export const localDate = (change: PlanetChange, lang: Locale) => formatDate(`${change.local.slice(0, 10)}T00:00:00Z`, lang);

/** "5 December 2026, 22:32 Sri Lanka time" */
export function whenText(t: ChangesText, change: PlanetChange, lang: Locale): string {
  return fill(t.when, { date: localDate(change, lang), time: change.local.slice(11, 16) });
}

export function moveText(t: ChangesText, move: ChangeMove, lang: Locale): string {
  return fill(move.retrograde ? t.moveBack : t.move, {
    planet: t.planet[move.body].name,
    from: signName(move.from, lang),
    to: signName(move.to, lang),
  });
}

/** How long it stays. A backward step is a short stay, and says when it returns. */
export function untilText(t: ChangesText, move: ChangeMove, lang: Locale): string {
  const values = {
    planet: t.planet[move.body].name,
    date: formatDate(`${move.until}T00:00:00Z`, lang),
    next: signName(move.next, lang),
    to: signName(move.to, lang),
  };
  const until = fill(t.until, values);
  if (move.retrograde) return fill(t.backNote, values);
  if (move.returning) return `${fill(t.returnNote, values)} ${until}`;
  return until;
}

/**
 * "Rahu and Ketu change 2026", or "Jupiter change 2027 into Kataka" for one planet, which
 * can change sign more than once in a year. In the word order of each language.
 */
export function changeTitle(t: ChangesText, change: PlanetChange, lang: Locale): string {
  const values = { change: t.kind[change.kind], year: change.local.slice(0, 4) };
  if (change.moves.length > 1) return fill(t.hubTitle, values);
  const [move] = change.moves;
  return fill(move.returning || move.retrograde ? t.nameBack : t.nameInto, {
    ...values,
    to: signName(move.to, lang),
  });
}

export function lagnaName(key: string, lang: Locale): string {
  return signName(key, lang);
}
