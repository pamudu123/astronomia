import type { Dictionary } from "@/app/[lang]/dictionaries";

import styles from "./SiteFooter.module.css";

export function SiteFooter({ dict }: { dict: Dictionary }) {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <span className={styles.brand}>Astronomia</span>
        <p className={styles.disclaimer}>{dict.footer.disclaimer}</p>
      </div>
    </footer>
  );
}
