import PickButton from './PickButton.jsx';
import styles from './BookCard.module.css';

export default function BookCard({ book, picked, onPick, onPreview, shake }) {
  return (
    <div className={styles.card}>
      <button
        className={styles.coverButton}
        onClick={() => onPreview(book)}
        type="button"
        aria-label={`Preview ${book.title}`}
      >
        <img
          className={styles.cover}
          src={`/${book.coverImage}`}
          alt={book.title}
          loading="lazy"
        />
      </button>
      <div className={styles.info}>
        <h3 className={styles.title}>{book.title}</h3>
      </div>
      <div className={styles.pickWrapper}>
        <PickButton
          picked={picked}
          shake={shake}
          onClick={() => onPick(book.id)}
        />
      </div>
    </div>
  );
}
