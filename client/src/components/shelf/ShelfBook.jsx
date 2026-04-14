import { memo } from 'react';
import { IS_PREVIEW } from '../../config.js';
import styles from './ShelfBook.module.css';

function ShelfBook({ book, onPreview }) {
  const hasInteriors = (book.interiorImages?.length || 0) > 0;
  const showLookInside = IS_PREVIEW && hasInteriors;

  return (
    <div className={styles.bookWrapper}>
      <button
        className={styles.coverButton}
        onClick={() => onPreview(book)}
        aria-label={`Preview ${book.title}`}
        type="button"
      >
        <div className={styles.coverFrame}>
          <img
            className={styles.cover}
            src={`/${book.coverImage}`}
            alt={book.title}
            loading="lazy"
            decoding="async"
          />
          {showLookInside && <span className={styles.lookInsideBadge}>Look Inside!</span>}
        </div>
      </button>
    </div>
  );
}

export default memo(ShelfBook);
