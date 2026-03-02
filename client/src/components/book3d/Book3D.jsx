import { useEffect, useMemo, useState } from 'react';
import Book3DPage from './Book3DPage.jsx';
import { createPageGeometry } from './pageGeometry.js';

const PAGE_HEIGHT = 1.71;
const DEFAULT_PAGE_WIDTH = 1.28;

function buildPages(book) {
  const pages = [];
  const spreads = book.interiorImages || [];

  if (spreads.length === 0) {
    // Single page: cover on front, plain back
    pages.push({
      front: `/${book.coverImage}`,
      frontHalf: 'full',
      back: null,
      backHalf: null,
    });
    return pages;
  }

  // Cover page: cover on front, first spread left half on back
  pages.push({
    front: `/${book.coverImage}`,
    frontHalf: 'full',
    back: `/${spreads[0]}`,
    backHalf: 'left',
  });

  // Interior pages
  for (let i = 0; i < spreads.length; i++) {
    const front = `/${spreads[i]}`;
    const frontHalf = 'right';
    const back = i + 1 < spreads.length ? `/${spreads[i + 1]}` : null;
    const backHalf = i + 1 < spreads.length ? 'left' : null;

    pages.push({ front, frontHalf, back, backHalf });
  }

  return pages;
}

export default function Book3D({ book, currentPage, onTurn, ...props }) {
  const pages = useMemo(() => buildPages(book), [book]);

  const pageWidth =
    book.coverWidth && book.coverHeight
      ? PAGE_HEIGHT * (book.coverWidth / book.coverHeight)
      : DEFAULT_PAGE_WIDTH;

  const geometry = useMemo(
    () => createPageGeometry(pageWidth, PAGE_HEIGHT),
    [pageWidth]
  );

  // Sequential page turning with delays
  const [delayedPage, setDelayedPage] = useState(currentPage);

  useEffect(() => {
    let timeout;
    const goToPage = () => {
      setDelayedPage((prev) => {
        if (currentPage === prev) return prev;
        timeout = setTimeout(
          goToPage,
          Math.abs(currentPage - prev) > 2 ? 50 : 150
        );
        return currentPage > prev ? prev + 1 : prev - 1;
      });
    };
    goToPage();
    return () => clearTimeout(timeout);
  }, [currentPage]);

  return (
    <group {...props} rotation-y={-Math.PI / 2}>
      {pages.map((pageData, index) => (
        <Book3DPage
          key={index}
          number={index}
          page={delayedPage}
          opened={delayedPage > index}
          bookClosed={delayedPage === 0 || delayedPage === pages.length}
          totalPages={pages.length}
          geometry={geometry}
          pageWidth={pageWidth}
          onTurn={onTurn}
          {...pageData}
        />
      ))}
    </group>
  );
}
