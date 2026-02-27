import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { getAllBooks, deleteBooks, restoreBooks } from '../api/client.mjs';
import SearchBar from '../components/SearchBar.jsx';
import AdminBookCard from '../components/AdminBookCard.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import styles from './ManageBooks.module.css';

export default function ManageBooks() {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [stats, setStats] = useState({ totalActive: 0, totalDeleted: 0, totalHidden: 0, totalAll: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [showDeleted, setShowDeleted] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const parentRef = useRef(null);

  const fetchBooks = useCallback(async () => {
    setIsLoading(true);
    const data = await getAllBooks();
    setBooks(data.books);
    setStats({
      totalActive: data.totalActive,
      totalDeleted: data.totalDeleted,
      totalHidden: data.totalHidden,
      totalAll: data.totalAll,
    });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const filteredBooks = useMemo(() => {
    const q = search.toLowerCase();
    return books
      .filter((b) => {
        if (showDeleted) return b.deleted;
        if (showHidden) return b.hidden && !b.deleted;
        return !b.deleted;
      })
      .filter((b) => !q || b.title.toLowerCase().includes(q));
  }, [books, search, showDeleted, showHidden]);

  const virtualizer = useVirtualizer({
    count: filteredBooks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    overscan: 10,
  });

  function toggleCheck(id) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectAll() {
    const visibleIds = filteredBooks.map((b) => b.id);
    const allChecked = visibleIds.every((id) => checkedIds.has(id));
    if (allChecked) {
      setCheckedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setCheckedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  async function handleDelete() {
    const ids = [...checkedIds];
    await deleteBooks(ids);
    setCheckedIds(new Set());
    setConfirmAction(null);
    await fetchBooks();
  }

  async function handleRestore() {
    const ids = [...checkedIds];
    await restoreBooks(ids);
    setCheckedIds(new Set());
    setConfirmAction(null);
    await fetchBooks();
  }

  const checkedCount = checkedIds.size;
  const allVisibleChecked =
    filteredBooks.length > 0 && filteredBooks.every((b) => checkedIds.has(b.id));

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <p>Loading books...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate('/')} type="button">
          {'\u2190'} Back
        </button>
        <h1 className={styles.title}>Manage Books</h1>
      </div>

      <div className={styles.toolbar}>
        <SearchBar value={search} onChange={setSearch} />

        <div className={styles.controls}>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => {
                setShowDeleted(e.target.checked);
                if (e.target.checked) setShowHidden(false);
                setCheckedIds(new Set());
              }}
            />
            <span>Show Deleted</span>
          </label>

          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => {
                setShowHidden(e.target.checked);
                if (e.target.checked) setShowDeleted(false);
                setCheckedIds(new Set());
              }}
            />
            <span>Only Hidden</span>
          </label>

          <button className={styles.selectAllButton} onClick={handleSelectAll} type="button">
            {allVisibleChecked ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      </div>

      <div className={styles.statusBar}>
        <span>{checkedCount} selected</span>
        <span>{'\u00B7'}</span>
        <span>{stats.totalActive} active of {stats.totalAll} total ({stats.totalHidden} hidden)</span>
        <span>{'\u00B7'}</span>
        <span>Showing {filteredBooks.length}</span>
      </div>

      {!showHidden && (
        <div className={styles.actions}>
          {!showDeleted && (
            <button
              className={styles.deleteButton}
              disabled={checkedCount === 0}
              onClick={() => setConfirmAction('delete')}
              type="button"
            >
              Delete Selected ({checkedCount})
            </button>
          )}
          {showDeleted && (
            <button
              className={styles.restoreButton}
              disabled={checkedCount === 0}
              onClick={() => setConfirmAction('restore')}
              type="button"
            >
              Restore Selected ({checkedCount})
            </button>
          )}
        </div>
      )}

      <div ref={parentRef} className={styles.listContainer}>
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const book = filteredBooks[virtualItem.index];
            return (
              <div
                key={book.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <AdminBookCard
                  book={book}
                  checked={checkedIds.has(book.id)}
                  onToggle={toggleCheck}
                />
              </div>
            );
          })}
        </div>
      </div>

      {confirmAction === 'delete' && (
        <ConfirmDialog
          message={`Remove ${checkedCount} book${checkedCount !== 1 ? 's' : ''} from the student list? This can be undone from this screen.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction === 'restore' && (
        <ConfirmDialog
          message={`Restore ${checkedCount} book${checkedCount !== 1 ? 's' : ''} to the student list?`}
          confirmLabel="Restore"
          onConfirm={handleRestore}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
