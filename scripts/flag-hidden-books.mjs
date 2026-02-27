import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const booksPath = join(__dirname, '..', 'data', 'books.json');

const books = JSON.parse(readFileSync(booksPath, 'utf-8'));

let hiddenCount = 0;
const updated = books.map((book) => {
  if (!book.interiorImages || book.interiorImages.length === 0) {
    hiddenCount++;
    return { ...book, hidden: true };
  }
  // Remove hidden property if it exists from a previous run
  const { hidden, ...rest } = book;
  return rest;
});

writeFileSync(booksPath, JSON.stringify(updated, null, 2));
console.log(`Done. ${hiddenCount} of ${books.length} books flagged as hidden.`);
