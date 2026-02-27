import { Router } from 'express';
import { getDatabase } from '../db/init.mjs';

export function createSelectionsRouter() {
  const router = Router();

  // POST /api/selections — save student picks
  router.post('/', (req, res) => {
    const { studentName, books } = req.body;

    if (!studentName || typeof studentName !== 'string' || !studentName.trim()) {
      return res.status(400).json({ error: 'studentName is required' });
    }
    if (!Array.isArray(books) || books.length !== 2) {
      return res.status(400).json({ error: 'Exactly 2 books are required' });
    }
    if (!books[0].id || !books[0].title || !books[1].id || !books[1].title) {
      return res.status(400).json({ error: 'Each book must have an id and title' });
    }

    const db = getDatabase();
    const stmt = db.prepare(
      `INSERT INTO selections (student_name, book1_id, book1_title, book2_id, book2_title)
       VALUES (?, ?, ?, ?, ?)`,
    );
    const result = stmt.run(
      studentName.trim(),
      books[0].id,
      books[0].title,
      books[1].id,
      books[1].title,
    );

    res.status(201).json({ id: Number(result.lastInsertRowid) });
  });

  // GET /api/selections — all selections for report
  router.get('/', (req, res) => {
    const db = getDatabase();
    const rows = db
      .prepare('SELECT * FROM selections ORDER BY created_at DESC')
      .all();

    const selections = rows.map((r) => ({
      id: r.id,
      studentName: r.student_name,
      book1Title: r.book1_title,
      book2Title: r.book2_title,
      createdAt: r.created_at,
    }));

    res.json({ selections });
  });

  // GET /api/selections/csv — download as CSV
  router.get('/csv', (req, res) => {
    const db = getDatabase();
    const rows = db
      .prepare('SELECT * FROM selections ORDER BY created_at DESC')
      .all();

    const header = 'Student Name,Book 1,Book 2,Date';
    const lines = rows.map((r) => {
      const escape = (s) => `"${String(s).replace(/"/g, '""')}"`;
      return [
        escape(r.student_name),
        escape(r.book1_title),
        escape(r.book2_title),
        escape(r.created_at),
      ].join(',');
    });
    const csv = [header, ...lines].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="book-selections.csv"');
    res.send(csv);
  });

  // DELETE /api/selections — clear all selections
  router.delete('/', (req, res) => {
    const db = getDatabase();
    db.prepare('DELETE FROM selections').run();
    res.json({ cleared: true });
  });

  return router;
}
