import styles from "./LifeRoad.module.css";

/** Says the road can be dragged, until the viewer first travels. Drags start through it. */
export function RoadDragHint({ text, moved }: { text: string; moved: boolean }) {
  return (
    <p className={moved ? styles.dragHintGone : styles.dragHint} aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {text}
    </p>
  );
}
