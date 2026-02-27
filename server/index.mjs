import express from 'express';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDatabase } from './db/init.mjs';
import { createBooksRouter } from './routes/books.mjs';
import { createSelectionsRouter } from './routes/selections.mjs';
import { errorHandler } from './middleware/error-handler.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = process.env.DATA_DIR || join(root, 'data');

// Load book data into memory
function loadBooks() {
  const booksPath = join(dataDir, 'books.json');
  const samplePath = join(dataDir, 'books-sample.json');
  const filePath = existsSync(booksPath) ? booksPath : samplePath;

  if (!existsSync(filePath)) {
    console.warn('No book data found. Place books.json or books-sample.json in data/');
    return [];
  }

  const books = JSON.parse(readFileSync(filePath, 'utf-8'));
  console.log(`Loaded ${books.length} books from ${filePath}`);
  return books;
}

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
getDatabase();

// Load books
const books = loadBooks();

// Middleware
app.use(express.json());

// API routes
app.use('/api/books', createBooksRouter(books));
app.use('/api/selections', createSelectionsRouter());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Static file serving: book images
app.use('/images', express.static(join(dataDir, 'images'), {
  maxAge: '1d',
  immutable: true,
}));

// Static file serving: built React app
const clientDist = join(root, 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));

  // SPA fallback — serve index.html for all non-API, non-static routes
  app.get('*', (req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
}

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
