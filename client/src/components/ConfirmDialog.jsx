import { useEffect, useRef } from 'react';
import styles from './ConfirmDialog.module.css';

export default function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel = 'Confirm', danger = false }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    function handleCancel(e) {
      e.preventDefault();
      onCancel();
    }

    dialog?.addEventListener('cancel', handleCancel);
    return () => dialog?.removeEventListener('cancel', handleCancel);
  }, [onCancel]);

  function handleBackdropClick(e) {
    if (e.target === dialogRef.current) {
      onCancel();
    }
  }

  return (
    <dialog ref={dialogRef} className={styles.dialog} onClick={handleBackdropClick}>
      <div className={styles.content}>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button className={styles.cancelButton} onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className={`${styles.confirmButton} ${danger ? styles.danger : ''}`}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
