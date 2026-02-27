import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './TeacherSetup.module.css';

export default function TeacherSetup() {
  const [studentName, setStudentName] = useState('');
  const navigate = useNavigate();

  function handleStart(e) {
    e.preventDefault();
    if (!studentName.trim()) return;
    navigate('/browse', { state: { studentName: studentName.trim() } });
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Book Picker</h1>
      <p className={styles.subtitle}>Enter the student's name to begin</p>

      <form className={styles.form} onSubmit={handleStart}>
        <input
          className={styles.input}
          type="text"
          placeholder="Student name..."
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          autoFocus
        />
        <button
          className={styles.startButton}
          type="submit"
          disabled={!studentName.trim()}
        >
          Start
        </button>
      </form>

      <div className={styles.adminLinks}>
        <button
          className={styles.adminButton}
          onClick={() => navigate('/admin/books')}
          type="button"
        >
          Manage Books
        </button>
        <button
          className={styles.adminButton}
          onClick={() => navigate('/admin/report')}
          type="button"
        >
          View Report
        </button>
      </div>
    </div>
  );
}
