import styles from './AdminBookCard.module.css';

export default function AdminBookCard({ book, checked, onToggle }) {
  return (
    <label className={`${styles.card} ${book.deleted ? styles.deleted : ''}`}>
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={checked}
        onChange={() => onToggle(book.id)}
      />
      <img
        className={styles.cover}
        src={`/${book.coverImage}`}
        alt={book.title}
        loading="lazy"
      />
      <span className={styles.title}>{book.title}</span>
      {book.deleted && <span className={styles.badge}>Deleted</span>}
      {book.hidden && <span className={styles.badgeHidden}>Hidden</span>}
    </label>
  );
}
