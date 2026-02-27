import { Routes, Route } from 'react-router-dom';

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
      <Route path="/" element={<Placeholder name="Teacher Setup" />} />
      <Route path="/browse" element={<Placeholder name="Book Browsing" />} />
      <Route path="/thanks" element={<Placeholder name="Thank You" />} />
      <Route path="/admin/books" element={<Placeholder name="Manage Books" />} />
      <Route path="/admin/report" element={<Placeholder name="Report" />} />
    </Routes>
  );
}
