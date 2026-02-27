import styles from './SelectionCounter.module.css';

export default function SelectionCounter({ count, max = 2 }) {
  return (
    <div className={styles.counter}>
      <span className={styles.star}>{'\u2B50'}</span>
      <span className={styles.text}>
        {count} of {max} picked
      </span>
    </div>
  );
}
