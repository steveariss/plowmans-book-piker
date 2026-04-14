import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import Book3DScene from './Book3DScene.jsx';
import PickButton from '../PickButton.jsx';
import { IS_PREVIEW } from '../../config.js';
import styles from './Book3DPreview.module.css';

export default function Book3DPreview({ book, picked, onPick, onClose, shake }) {
  const [currentPage, setCurrentPage] = useState(0);
  const dialogRef = useRef(null);

  const totalPages = (book.interiorImages?.length || 0) + 1;
  const isCoverOnly = !book.interiorImages || book.interiorImages.length === 0;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    function handleCancel(e) {
      e.preventDefault();
      onClose();
    }

    dialog?.addEventListener('cancel', handleCancel);
    return () => dialog?.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  const handleTurn = useCallback(
    (page) => {
      setCurrentPage(Math.max(0, Math.min(page, totalPages)));
    },
    [totalPages],
  );

  function handleBackdropClick(e) {
    if (e.target === dialogRef.current) {
      onClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label={`3D preview of ${book.title}`}
      onClick={handleBackdropClick}
    >
      <div className={styles.canvas}>
        <Suspense fallback={<div className={styles.loading}>Loading book...</div>}>
          <Canvas
            shadows
            camera={{ position: [0, 2, 2], fov: 45 }}
            gl={{ antialias: true, alpha: true }}
            style={{ background: 'transparent' }}
          >
            <Book3DScene book={book} currentPage={currentPage} onTurn={handleTurn} centered={isCoverOnly} />
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
        {!isCoverOnly && (
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
        )}

        <div className={styles.pickWrapper}>
          {!IS_PREVIEW && (
            <PickButton picked={picked} shake={shake} onClick={() => onPick(book.id)} />
          )}
        </div>
      </div>
    </dialog>
  );
}
