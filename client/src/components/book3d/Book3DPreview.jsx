import { Suspense, useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import Book3DScene from './Book3DScene.jsx';
import PickButton from '../PickButton.jsx';
import styles from './Book3DPreview.module.css';

export default function Book3DPreview({ book, picked, onPick, onClose, shake }) {
  const [currentPage, setCurrentPage] = useState(0);

  const totalPages = (book.interiorImages?.length || 0) + 1;

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleTurn = useCallback(
    (page) => {
      setCurrentPage(Math.max(0, Math.min(page, totalPages)));
    },
    [totalPages],
  );

  return (
    <div className={styles.overlay} role="dialog" aria-label={`3D preview of ${book.title}`}>
      <div className={styles.canvas}>
        <Suspense fallback={<div className={styles.loading}>Loading book...</div>}>
          <Canvas
            shadows
            camera={{ position: [0, 2, 2], fov: 45 }}
            gl={{ antialias: true, alpha: true }}
            style={{ background: 'transparent' }}
          >
            <Book3DScene book={book} currentPage={currentPage} onTurn={handleTurn} />
          </Canvas>
        </Suspense>
      </div>

      <div className={styles.topBar}>
        <h2 className={styles.title}>{book.title}</h2>
        <button
          className={styles.closeButton}
          onClick={onClose}
          type="button"
          aria-label="Close preview"
        >
          {'\u2715'}
        </button>
      </div>

      <div className={styles.bottomBar}>
        <div className={styles.nav}>
          <button
            className={styles.arrow}
            onClick={() => handleTurn(currentPage - 1)}
            disabled={currentPage === 0}
            type="button"
            aria-label="Previous page"
          >
            {'\u2039'}
          </button>
          <span className={styles.pageIndicator}>
            {currentPage === 0
              ? 'Cover'
              : currentPage >= totalPages
                ? 'Back Cover'
                : `Page ${currentPage} of ${totalPages - 1}`}
          </span>
          <button
            className={styles.arrow}
            onClick={() => handleTurn(currentPage + 1)}
            disabled={currentPage >= totalPages}
            type="button"
            aria-label="Next page"
          >
            {'\u203A'}
          </button>
        </div>

        <div className={styles.pickWrapper}>
          <PickButton picked={picked} shake={shake} onClick={() => onPick(book.id)} />
        </div>
      </div>
    </div>
  );
}
