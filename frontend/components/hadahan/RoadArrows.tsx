import styles from "./LifeRoad.module.css";

type Props = {
  later: string;
  earlier: string;
  /** How far one press goes, shown beside the buttons. */
  step: string;
  /** Moves the road by this many years: 1 for later, -1 for earlier. */
  onMove: (years: number) => void;
};

/** Up and down buttons that move a road a year at a time. Shared by the life road and the couple road. */
export function RoadArrows({ later, earlier, step, onMove }: Props) {
  return (
    <div className={styles.arrows}>
      <span className={styles.step} aria-hidden="true">
        {step}
      </span>
      <button type="button" className={styles.arrow} aria-label={later} title={later} onClick={() => onMove(1)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button type="button" className={styles.arrow} aria-label={earlier} title={earlier} onClick={() => onMove(-1)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M19 12l-7 7-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
