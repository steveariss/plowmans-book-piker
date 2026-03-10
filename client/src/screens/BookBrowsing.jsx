import { lazy, Suspense, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBooks } from '../hooks/useBooks.js';
import { useSelections } from '../hooks/useSelections.js';
import { saveSelections } from '../api/client.mjs';
import SelectionCounter from '../components/SelectionCounter.jsx';
import DoneButton from '../components/DoneButton.jsx';
import BookShelf from '../components/shelf/BookShelf.jsx';
import styles from './BookBrowsing.module.css';

const Book3DPreview = lazy(() => import('../components/book3d/Book3DPreview.jsx'));

export default function BookBrowsing() {
  const location = useLocation();
  const navigate = useNavigate();
  const studentName = location.state?.studentName || 'Student';
  const [previewBook, setPreviewBook] = useState(null);

  const { books, isLoading, error } = useBooks();
  const { selectedIds, toggleSelection, isComplete, selectedBooks, shakeId } = useSelections(books);

  async function handleDone() {
    const booksPayload = selectedBooks.map((b) => ({ id: b.id, title: b.title }));
    await saveSelections(studentName, booksPayload);
    navigate('/thanks', { state: { studentName, books: selectedBooks } });
  }

  const handlePreview = useCallback((book) => {
    setPreviewBook(book);
  }, []);

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <p>Loading books...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.loading}>
        <p>Oops! Something went wrong.</p>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.selectionContainer}>
        <SelectionCounter count={selectedIds.size} />
      </div>

      <BookShelf
        books={books}
        selectedIds={selectedIds}
        shakeId={shakeId}
        onPick={toggleSelection}
        onPreview={handlePreview}
      />

      <DoneButton visible={isComplete} onClick={handleDone} />

      {previewBook && (
        <Suspense fallback={null}>
          <Book3DPreview
            book={previewBook}
            picked={selectedIds.has(previewBook.id)}
            shake={shakeId === previewBook.id}
            onPick={toggleSelection}
            onClose={() => setPreviewBook(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
