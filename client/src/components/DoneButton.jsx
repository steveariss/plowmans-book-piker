import styles from './DoneButton.module.css';

export default function DoneButton({ visible, onClick }) {
  if (!visible) return null;

  return (
    <div className={styles.wrapper}>
      <button className={styles.button} onClick={onClick} type="button">
        All Done! {'\u2705'}
      </button>
    </div>
  );
}
