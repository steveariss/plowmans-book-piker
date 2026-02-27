import styles from './PickButton.module.css';

export default function PickButton({ picked, onClick, shake }) {
  const className = [
    styles.button,
    picked ? styles.picked : '',
    shake ? styles.shake : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={className}
      onClick={onClick}
      aria-pressed={picked}
      type="button"
    >
      <span className={styles.icon}>{picked ? '\u2705' : '\u2B50'}</span>
      <span className={styles.label}>{picked ? 'Picked!' : 'Pick Me!'}</span>
    </button>
  );
}
