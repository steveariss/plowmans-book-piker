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
const booksFile = process.env.BOOKS_FILE || 'books.json';

function loadBooks() {
  const booksPath = join(dataDir, booksFile);
  const samplePath = join(dataDir, 'books-sample.json');
  const filePath = existsSync(booksPath) ? booksPath : samplePath;

  if (!existsSync(filePath)) {
    console.warn(`No book data found. Place ${booksFile} or books-sample.json in ${dataDir}`);
    return [];
  }

  const books = JSON.parse(readFileSync(filePath, 'utf-8'));
  console.log(`Loaded ${books.length} books from ${filePath}`);
  return books;
}

const app = express();
const PORT = process.env.PORT || 3000;

getDatabase();
const books = loadBooks();

app.use(express.json());

app.use('/api/books', createBooksRouter(books));
app.use('/api/selections', createSelectionsRouter());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', booksFile });
});

// Static file serving: book images (main dataset)
app.use('/images', express.static(join(dataDir, 'images'), {
  maxAge: '1d',
  immutable: true,
}));

// Static file serving: invoice dataset images (used by preview deployment)
app.use('/images-invoice', express.static(join(dataDir, 'images-invoice'), {
  maxAge: '1d',
  immutable: true,
}));

// Static file serving: built React app. Preview deployment points this at
// dist-preview via CLIENT_DIST env var.
const clientDist = process.env.CLIENT_DIST
  ? (process.env.CLIENT_DIST.startsWith('/') ? process.env.CLIENT_DIST : join(root, process.env.CLIENT_DIST))
  : join(root, 'client', 'dist');

if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
}

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (BOOKS_FILE=${booksFile})`);
});
