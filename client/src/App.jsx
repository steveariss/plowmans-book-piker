import { Routes, Route } from 'react-router-dom';
import TeacherSetup from './screens/TeacherSetup.jsx';
import BookBrowsing from './screens/BookBrowsing.jsx';
import ThankYou from './screens/ThankYou.jsx';
import ManageBooks from './screens/ManageBooks.jsx';
import Report from './screens/Report.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<TeacherSetup />} />
      <Route path="/browse" element={<BookBrowsing />} />
      <Route path="/thanks" element={<ThankYou />} />
      <Route path="/admin/books" element={<ManageBooks />} />
      <Route path="/admin/report" element={<Report />} />
    </Routes>
  );
}
