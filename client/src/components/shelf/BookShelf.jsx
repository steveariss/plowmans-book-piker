import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useShelfLayout } from '../../hooks/useShelfLayout.js';
import ShelfRow from './ShelfRow.jsx';
import styles from './BookShelf.module.css';

export default function BookShelf({ books, selectedIds, shakeId, onPick, onPreview }) {
  const scrollRef = useRef(null);
  const { rows, booksPerRow, estimatedRowHeight } = useShelfLayout(scrollRef, books);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 3,
  });

  return (
    <div ref={scrollRef} className={styles.scrollContainer} role="list">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.index}
            role="listitem"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <ShelfRow
              books={rows[virtualItem.index]}
              selectedIds={selectedIds}
              shakeId={shakeId}
              onPick={onPick}
              onPreview={onPreview}
              booksPerRow={booksPerRow}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
