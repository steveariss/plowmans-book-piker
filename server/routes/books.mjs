import { Router } from 'express';
import { getDatabase } from '../db/init.mjs';

export function createBooksRouter(books) {
  const router = Router();

  // GET /api/books — non-deleted books for student browsing
  router.get('/', (req, res) => {
    const db = getDatabase();
    const deletedRows = db.prepare('SELECT book_id FROM deleted_books').all();
    const deletedIds = new Set(deletedRows.map((r) => r.book_id));

    const activeBooks = books.filter((b) => !deletedIds.has(b.id) && !b.hidden);

    res.json({
      books: activeBooks,
      total: activeBooks.length,
    });
  });

  // GET /api/books/all — all books with deletion status (admin)
  router.get('/all', (req, res) => {
    const db = getDatabase();
    const deletedRows = db.prepare('SELECT book_id FROM deleted_books').all();
    const deletedIds = new Set(deletedRows.map((r) => r.book_id));

    const allBooks = books.map((b) => ({
      id: b.id,
      title: b.title,
      coverImage: b.coverImage,
      deleted: deletedIds.has(b.id),
      hidden: b.hidden || false,
    }));

    const totalDeleted = allBooks.filter((b) => b.deleted).length;
    const totalHidden = allBooks.filter((b) => b.hidden).length;

    res.json({
      books: allBooks,
      totalActive: allBooks.filter((b) => !b.deleted && !b.hidden).length,
      totalDeleted,
      totalHidden,
      totalAll: allBooks.length,
    });
  });

  // POST /api/books/delete — hide books from students
  router.post('/delete', (req, res) => {
    const { bookIds } = req.body;
    if (!Array.isArray(bookIds) || bookIds.length === 0) {
      return res.status(400).json({ error: 'bookIds must be a non-empty array' });
    }

    const db = getDatabase();
    const insert = db.prepare(
      'INSERT OR IGNORE INTO deleted_books (book_id) VALUES (?)',
    );
    const deleteMany = db.transaction((ids) => {
      for (const id of ids) {
        insert.run(id);
      }
    });
    deleteMany(bookIds);

    res.json({ deleted: bookIds.length });
  });

  // POST /api/books/restore — restore previously deleted books
  router.post('/restore', (req, res) => {
    const { bookIds } = req.body;
    if (!Array.isArray(bookIds) || bookIds.length === 0) {
      return res.status(400).json({ error: 'bookIds must be a non-empty array' });
    }

    const db = getDatabase();
    const del = db.prepare('DELETE FROM deleted_books WHERE book_id = ?');
    const restoreMany = db.transaction((ids) => {
      for (const id of ids) {
        del.run(id);
      }
    });
    restoreMany(bookIds);

    res.json({ restored: bookIds.length });
  });

  return router;
}
