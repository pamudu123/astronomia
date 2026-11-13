import { PlanetIcon } from "@/components/PlanetIcon";
import { Kendara } from "@/components/hadahan/Kendara";
import type { ChangeOut, Counted } from "@/lib/changes";
import { fill } from "@/lib/hadahan";

import styles from "./Changes.module.css";
import type { ChangesText } from "./text";

type Props = {
  t: ChangesText;
  change: ChangeOut;
  counted: Counted;
  /** Tells the drawings apart when two views share a page. */
  id: string;
  /** "Counted from your lagna (Simha)", when more than one view is shown. */
  heading?: string;
};

/** One change counted from one sign: drawings before and after, then each planet. */
export function CountedView({ t, change, counted, id, heading }: Props) {
  const labels = { planet: t.planet, house: t.house };
  const moving = counted.moves.map((move) => move.body);
  const sky = (when: "before" | "after") => [
    ...counted.moves.map((move) => {
      const house = when === "before" ? move.from_house : move.to_house;
      return { body: move.body, house, navamsha_house: house };
    }),
    ...counted.others.map((other) => ({ body: other.body, house: other.house, navamsha_house: other.house })),
  ];
  const until = Object.fromEntries(
    change.moves.map((move) => [move.body, [move.note, move.until_text].filter(Boolean).join(" ")]),
  );

  return (
    <div className={styles.section} data-counted={id}>
      {heading && <h3 className={styles.sectionTitle}>{heading}</h3>}
      <div className={styles.skies}>
        {(["before", "after"] as const).map((when) => (
          <div key={when} className={styles.sky}>
            <Kendara
              planets={sky(when)}
              labels={labels}
              mode="rashi"
              title={t[when]}
              subtitle={counted.sign_name}
              ariaLabel={`${t[when]}. ${t.skyLabel}`}
              lagnaMark={t.lagnaMark}
              highlight={when === "after" ? moving : undefined}
            />
          </div>
        ))}
      </div>

      <ul className={styles.cards} aria-label={t.moving}>
        {counted.moves.map((move) => (
          <li key={move.body} className={styles.cardMoves} data-planet={move.body}>
            <div className={styles.cardHead}>
              <PlanetIcon body={move.body} />
              <span className={styles.planet}>{t.planet[move.body as keyof ChangesText["planet"]].name}</span>
              <span className={styles.shift}>
                {fill(t.shift, { from: t.house[move.from_house - 1], to: t.house[move.to_house - 1] })}
              </span>
            </div>
            <p>{move.text}</p>
            <p className={styles.small}>{move.from_theme}</p>
            <p>{move.to_theme}</p>
            {until[move.body] && <p className={styles.small}>{until[move.body]}</p>}
          </li>
        ))}
      </ul>

      {counted.notes.length > 0 && (
        <ul className={styles.notes}>
          {counted.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      {counted.others.length > 0 && (
        <ul className={styles.stays} aria-label={t.staying}>
          {counted.others.map((other) => (
            <li key={other.body}>
              <PlanetIcon body={other.body} size={24} />
              {other.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
