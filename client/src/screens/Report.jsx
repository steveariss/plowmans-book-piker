import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSelections, clearSelections } from '../api/client.mjs';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import styles from './Report.module.css';

export default function Report() {
  const navigate = useNavigate();
  const [selections, setSelections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);

  const fetchSelections = useCallback(async () => {
    setIsLoading(true);
    const data = await getSelections();
    setSelections(data.selections);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchSelections();
  }, [fetchSelections]);

  function handleDownloadCSV() {
    // Trigger browser download
    const link = document.createElement('a');
    link.href = '/api/selections/csv';
    link.download = 'book-selections.csv';
    link.click();
  }

  async function handleClearAll() {
    await clearSelections();
    setShowConfirm(false);
    setSelections([]);
  }

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <p>Loading report...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate('/')} type="button">
          {'\u2190'} Back
        </button>
        <h1 className={styles.title}>Student Selections</h1>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.csvButton}
          onClick={handleDownloadCSV}
          disabled={selections.length === 0}
          type="button"
        >
          Download CSV
        </button>
        <button
          className={styles.clearButton}
          onClick={() => setShowConfirm(true)}
          disabled={selections.length === 0}
          type="button"
        >
          Clear All Data
        </button>
      </div>

      {selections.length === 0 ? (
        <p className={styles.empty}>No selections yet.</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Book 1</th>
                <th>Book 2</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {selections.map((s) => (
                <tr key={s.id}>
                  <td>{s.studentName}</td>
                  <td>{s.book1Title}</td>
                  <td>{s.book2Title}</td>
                  <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showConfirm && (
        <ConfirmDialog
          message="Clear all student selection data? This cannot be undone."
          confirmLabel="Clear All"
          danger
          onConfirm={handleClearAll}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
