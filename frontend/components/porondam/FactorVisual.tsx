import Image from "next/image";

import type { Labels } from "@/lib/hadahan";
import type { Factor } from "@/lib/porondam";
import { RASHI } from "@/lib/rashi";

import styles from "./FactorVisual.module.css";

/** Bride is teal and groom is gold in every picture, as in the two name cards. */

/** A ring of stars or signs: the bride's is number 1 at the top, and the groom's is the count. */
function CountDial({ total, count }: { total: number; count: number }) {
  const dots = Array.from({ length: total }, (_, index) => {
    const angle = (-90 + (index * 360) / total) * (Math.PI / 180);
    const number = index + 1;
    const tone =
      number === 1
        ? styles.dotBride
        : number === count
          ? styles.dotGroom
          : number < count
            ? styles.dotPath
            : styles.dot;
    const big = number === 1 || number === count;
    return (
      <circle
        key={number}
        cx={50 + 38 * Math.cos(angle)}
        cy={50 + 38 * Math.sin(angle)}
        r={big ? 6 : total > 12 ? 2.600 : 3.600}
        className={tone}
      />
    );
  });
  return (
    <svg viewBox="0 0 100 100" className={styles.dial}>
      {dots}
      <text x="50" y="50" className={styles.dialCount}>
        {count}
      </text>
    </svg>
  );
}

/** A row of groups, with a mark under the bride's and the groom's. */
function Slots({ names, bride, groom }: { names: Record<string, string>; bride: string; groom: string }) {
  return (
    <ul className={styles.slots}>
      {Object.entries(names).map(([key, name]) => (
        <li key={key} className={key === bride || key === groom ? styles.slotOn : styles.slot}>
          <span>{name}</span>
          <span className={styles.marks}>
            {key === bride && <i className={styles.markBride} />}
            {key === groom && <i className={styles.markGroom} />}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The bride's and the groom's side by side, joined by a tick or a cross. */
function Pair({ bride, groom, ok, images }: { bride: string; groom: string; ok: boolean; images?: [string, string] }) {
  const chip = (text: string, tone: string, image?: string) => (
    <span className={`${styles.chip} ${tone}`}>
      {image && <Image src={image} alt="" width={36} height={36} className={styles.chipImage} />}
      {text}
    </span>
  );
  return (
    <div className={styles.pair}>
      {chip(bride, styles.chipBride, images?.[0])}
      <span className={ok ? styles.joinOk : styles.joinNo}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          {ok ? <path d="M3 8.500l3 3 7-7.500" /> : <path d="M4 4l8 8M12 4l-8 8" />}
        </svg>
      </span>
      {chip(groom, styles.chipGroom, images?.[1])}
    </div>
  );
}

const rashiImage = (key: string) => RASHI.find((r) => r.key === key)?.image;

/** A small picture of the facts behind one porondam factor. The reason text says the same. */
export function FactorVisual({ factor, labels }: { factor: Factor; labels: Labels }) {
  const facts = factor.facts as Record<string, string | number>;
  const text = (key: string) => String(facts[key]);
  let picture: React.ReactNode = null;

  switch (factor.id) {
    case "dina":
    case "mahendra":
    case "stree_deergha":
      picture = <CountDial total={27} count={Number(facts.count)} />;
      break;
    case "rashi":
      picture = <CountDial total={12} count={Number(facts.count)} />;
      break;
    case "gana":
      picture = <Slots names={labels.gana} bride={text("bride_gana")} groom={text("groom_gana")} />;
      break;
    case "nadi":
      picture = <Slots names={labels.nadi} bride={text("bride_nadi")} groom={text("groom_nadi")} />;
      break;
    case "rajju":
      picture = <Slots names={labels.rajju} bride={text("bride_rajju")} groom={text("groom_rajju")} />;
      break;
    case "yoni":
      picture = <Pair bride={labels.yoni[text("bride_yoni")]} groom={labels.yoni[text("groom_yoni")]} ok={factor.passed} />;
      break;
    case "rashyadhipathi":
      picture = (
        <Pair
          bride={labels.planet[text("bride_lord")].name}
          groom={labels.planet[text("groom_lord")].name}
          ok={factor.passed}
        />
      );
      break;
    case "vashya": {
      const [b, g] = [text("bride_sign"), text("groom_sign")];
      const images = [rashiImage(b), rashiImage(g)];
      picture = (
        <Pair
          bride={labels.rashi[b].name}
          groom={labels.rashi[g].name}
          ok={factor.passed}
          images={images[0] && images[1] ? [images[0], images[1]] : undefined}
        />
      );
      break;
    }
    case "vedha":
      picture = (
        <Pair
          bride={labels.nakshatra[text("bride_star")]}
          groom={labels.nakshatra[text("groom_star")]}
          ok={factor.passed}
        />
      );
      break;
  }

  if (!picture) return null;
  return (
    <div className={styles.visual} aria-hidden="true" data-visual={factor.id}>
      {picture}
    </div>
  );
}
