import { memo } from 'react';
import styles from './HangingSign.module.css';

function HangingSign({ bookId, title, picked, shake, onPick }) {
  const containerClass = [
    styles.signContainer,
    picked ? styles.picked : '',
    shake ? styles.shake : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClass}>
      <div className={styles.chains}>
        <div className={styles.chain} />
        <div className={styles.chain} />
      </div>
      <div className={styles.sign}>
        <button
          className={styles.signInner}
          onClick={() => onPick(bookId)}
          aria-pressed={picked}
          aria-label={picked ? `Remove ${title} from picks` : `Pick ${title}`}
          type="button"
        >
          <span className={styles.signFront} aria-hidden="true">
            {'\u2B50'}
          </span>
          <span className={styles.signBack} aria-hidden="true">
            {'\u2714'}
          </span>
        </button>
      </div>
    </div>
  );
}

export default memo(HangingSign);
