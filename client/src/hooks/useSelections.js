import { useState, useCallback, useMemo } from 'react';

const MAX_PICKS = 2;

export function useSelections(books) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [shakeId, setShakeId] = useState(null);

  const toggleSelection = useCallback(
    (bookId) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(bookId)) {
          next.delete(bookId);
          return next;
        }
        if (next.size >= MAX_PICKS) {
          // Trigger shake animation
          setShakeId(bookId);
          setTimeout(() => setShakeId(null), 400);
          return prev;
        }
        next.add(bookId);
        return next;
      });
    },
    [],
  );

  const isComplete = selectedIds.size === MAX_PICKS;

  const selectedBooks = useMemo(
    () => books.filter((b) => selectedIds.has(b.id)),
    [books, selectedIds],
  );

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  return { selectedIds, toggleSelection, isComplete, selectedBooks, clear, shakeId };
}
