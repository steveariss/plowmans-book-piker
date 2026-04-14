import { Routes, Route, Navigate } from 'react-router-dom';
import BookBrowsing from './screens/BookBrowsing.jsx';

export default function AppPreview() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/browse" replace />} />
      <Route path="/browse" element={<BookBrowsing />} />
      <Route path="*" element={<Navigate to="/browse" replace />} />
    </Routes>
  );
}
