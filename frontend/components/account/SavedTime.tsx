import styles from "./SavedTime.module.css";

/** On a saved report: what the parts of the page are worked out from. Absent everywhere else. */
export type SavedTimes = {
  /** "As saved on 12 November 2026" */
  frozen: string;
  /** "Worked out today, …" */
  live: string;
};

/** A line over one part of a saved report: kept as it was saved, or worked out again today. */
export function SavedTime({ times, part }: { times?: SavedTimes; part: keyof SavedTimes }) {
  if (!times) return null;
  return (
    <p className={part === "live" ? styles.live : styles.frozen} data-saved-time={part}>
      {times[part]}
    </p>
  );
}
