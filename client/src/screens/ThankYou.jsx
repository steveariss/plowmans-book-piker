import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Confetti from '../components/Confetti.jsx';
import styles from './ThankYou.module.css';

export default function ThankYou() {
  const location = useLocation();
  const navigate = useNavigate();
  const { studentName, books } = location.state || {};

  useEffect(() => {
    const timer = setTimeout(() => navigate('/'), 5000);
    return () => clearTimeout(timer);
  }, [navigate]);

  function handleTap() {
    navigate('/');
  }

  if (!books || books.length === 0) {
    navigate('/');
    return null;
  }

  return (
    <div className={styles.container} onClick={handleTap}>
      <Confetti />
      <h1 className={styles.heading}>Great choices!</h1>
      <p className={styles.name}>{studentName}</p>
      <div className={styles.books}>
        {books.map((book) => (
          <div key={book.id} className={styles.bookCard}>
            <img
              className={styles.cover}
              src={`/${book.coverImage}`}
              alt={book.title}
            />
            <p className={styles.title}>{book.title}</p>
          </div>
        ))}
      </div>
      <p className={styles.hint}>Tap anywhere to continue</p>
    </div>
  );
}
