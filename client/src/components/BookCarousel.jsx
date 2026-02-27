import { useCallback, useEffect, useRef } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import PickButton from './PickButton.jsx';
import styles from './BookCarousel.module.css';

export default function BookCarousel({ book, picked, onPick, onClose, shake }) {
  const dialogRef = useRef(null);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });

  const allImages = [book.coverImage, ...(book.interiorImages || [])];

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

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

  function handleBackdropClick(e) {
    if (e.target === dialogRef.current) {
      onClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClick={handleBackdropClick}
      aria-label={`Preview of ${book.title}`}
    >
      <div className={styles.content}>
        <button
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close preview"
          type="button"
        >
          {'\u2715'}
        </button>

        <h2 className={styles.title}>{book.title}</h2>

        <div className={styles.carouselWrapper}>
          <button
            className={`${styles.arrow} ${styles.arrowLeft}`}
            onClick={scrollPrev}
            aria-label="Previous image"
            type="button"
          >
            {'\u2039'}
          </button>

          <div className={styles.viewport} ref={emblaRef}>
            <div className={styles.container}>
              {allImages.map((src, i) => (
                <div className={styles.slide} key={i}>
                  <img
                    className={styles.image}
                    src={`/${src}`}
                    alt={i === 0 ? `${book.title} cover` : `${book.title} page ${i}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            className={`${styles.arrow} ${styles.arrowRight}`}
            onClick={scrollNext}
            aria-label="Next image"
            type="button"
          >
            {'\u203A'}
          </button>
        </div>

        <div className={styles.pickWrapper}>
          <PickButton
            picked={picked}
            shake={shake}
            onClick={() => onPick(book.id)}
          />
        </div>
      </div>
    </dialog>
  );
}
