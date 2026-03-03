import { memo } from 'react';
import styles from './ShelfBook.module.css';

function ShelfBook({ book, onPreview }) {
  return (
    <div className={styles.bookWrapper}>
      <button
        className={styles.coverButton}
        onClick={() => onPreview(book)}
        aria-label={`Preview ${book.title}`}
        type="button"
      >
        <img
          className={styles.cover}
          src={book.coverUrl}
          alt={book.title}
          loading="lazy"
          decoding="async"
        />
      </button>
    </div>
  );
}

export default memo(ShelfBook);
