import { Routes, Route } from 'react-router-dom';
import TeacherSetup from './screens/TeacherSetup.jsx';
import BookBrowsing from './screens/BookBrowsing.jsx';
import ThankYou from './screens/ThankYou.jsx';

function Placeholder({ name }) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>{name}</h1>
      <p>Coming soon...</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<TeacherSetup />} />
      <Route path="/browse" element={<BookBrowsing />} />
      <Route path="/thanks" element={<ThankYou />} />
      <Route path="/admin/books" element={<Placeholder name="Manage Books" />} />
      <Route path="/admin/report" element={<Placeholder name="Report" />} />
    </Routes>
  );
}
