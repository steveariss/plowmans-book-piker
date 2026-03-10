import { memo } from 'react';
import ShelfBook from './ShelfBook.jsx';
import HangingSign from './HangingSign.jsx';
import styles from './ShelfRow.module.css';

function ShelfRow({ books, selectedIds, shakeId, onPick, onPreview, booksPerRow }) {
  const gridStyle = { gridTemplateColumns: `repeat(${booksPerRow}, 1fr)` };

  return (
    <div className={styles.row}>
      <div className={styles.booksZone} style={gridStyle}>
        {books.map((book) => (
          <ShelfBook key={book.id} book={book} onPreview={onPreview} />
        ))}
      </div>
      <div className={styles.shelf} />
      <div className={styles.signsZone} style={gridStyle}>
        {books.map((book) => (
          <HangingSign
            key={book.id}
            bookId={book.id}
            title={book.title}
            picked={selectedIds.has(book.id)}
            shake={shakeId === book.id}
            onPick={onPick}
          />
        ))}
      </div>
      <div className={styles.rowBottom} />
    </div>
  );
}

function areEqual(prev, next) {
  if (prev.books !== next.books) return false;
  if (prev.booksPerRow !== next.booksPerRow) return false;
  if (prev.onPick !== next.onPick) return false;
  if (prev.onPreview !== next.onPreview) return false;

  // Check if any book in this row is affected by selectedIds or shakeId changes
  for (const book of prev.books) {
    if (prev.selectedIds.has(book.id) !== next.selectedIds.has(book.id)) return false;
    if (
      (prev.shakeId === book.id) !== (next.shakeId === book.id)
    ) return false;
  }
  return true;
}

export default memo(ShelfRow, areEqual);
