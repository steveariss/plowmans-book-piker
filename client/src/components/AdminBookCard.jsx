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
      <img className={styles.cover} src={`/${book.coverImage}`} alt={book.title} loading="lazy" />
      <div className={styles.info}>
        <span className={styles.title}>{book.title}</span>
        <div className={styles.bookMeta}>
          <span>{book.authors}</span>
          <span>{book.audience}</span>
        </div>
      </div>
      {book.deleted && <span className={styles.badge}>Deleted</span>}
      {book.hidden && <span className={styles.badgeHidden}>Hidden</span>}
    </label>
  );
}
