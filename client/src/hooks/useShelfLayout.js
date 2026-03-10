import { useState, useEffect, useMemo } from 'react';

const BREAKPOINTS = [
  { minWidth: 1600, columns: 6 },
  { minWidth: 1200, columns: 5 },
  { minWidth: 800, columns: 4 },
  { minWidth: 500, columns: 3 },
];
const DEFAULT_COLUMNS = 2;

const SHELF_HEIGHT = 20;
const CHAIN_HEIGHT = 8;
const SIGN_HEIGHT = 48;
const ROW_GAP = 16;

function getColumns(width) {
  for (const bp of BREAKPOINTS) {
    if (width >= bp.minWidth) return bp.columns;
  }
  return DEFAULT_COLUMNS;
}

export function useShelfLayout(containerRef, books) {
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let timeoutId;
    let latestWidth = 0;
    const observer = new ResizeObserver((entries) => {
      latestWidth = entries[0]?.contentRect.width ?? 0;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setContainerWidth(latestWidth);
      }, 100);
    });

    observer.observe(el);
    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [containerRef]);

  const booksPerRow = containerWidth > 0 ? getColumns(containerWidth) : 5;

  const rows = useMemo(() => {
    if (!books.length) return [];
    const count = Math.ceil(books.length / booksPerRow);
    return Array.from({ length: count }, (_, i) =>
      books.slice(i * booksPerRow, (i + 1) * booksPerRow)
    );
  }, [books, booksPerRow]);

  const estimatedRowHeight = useMemo(() => {
    if (containerWidth <= 0) return 455;
    const coverHeight = (containerWidth / booksPerRow) * 1.33;
    return coverHeight + SHELF_HEIGHT + CHAIN_HEIGHT + SIGN_HEIGHT + ROW_GAP;
  }, [containerWidth, booksPerRow]);

  return { rows, booksPerRow, estimatedRowHeight };
}
