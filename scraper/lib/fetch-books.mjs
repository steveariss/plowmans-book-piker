import { getSession, fetchBrowsePage } from './api.mjs';
import { logProgress, saveState } from './progress.mjs';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchBookList(state) {
  if (state.bookListComplete && state.bookList.length > 0) {
    logProgress(2, `Book list already complete (${state.bookList.length} books), skipping.`);
    return state.bookList;
  }

  // Get a fresh session if needed
  if (!state.sessionId) {
    logProgress(2, 'Getting API session...');
    state.sessionId = await getSession();
  }

  const books = state.bookList.length > 0 ? [...state.bookList] : [];
  const startOffset = books.length;
  const LIMIT = 100;

  logProgress(2, `Fetching book list from offset ${startOffset}...`);

  // First request to get total count
  if (startOffset === 0) {
    const first = await fetchBrowsePage(state.sessionId, 0, LIMIT);
    const maxOffset = first.max_offset || 5200;
    state.maxOffset = maxOffset;

    for (const row of first.rows || []) {
      books.push(parseBook(row));
    }
    logProgress(2, `Page 1: got ${first.rows?.length || 0} books (${books.length} total, ~${maxOffset} expected)`);
    state.bookList = books;
    saveState(state);
  }

  const maxOffset = state.maxOffset || 5200;
  let offset = books.length;

  while (offset <= maxOffset) {
    await sleep(1500);

    try {
      const data = await fetchBrowsePage(state.sessionId, offset, LIMIT);

      if (!data.rows || data.rows.length === 0) {
        logProgress(2, `No more books at offset ${offset}. Done.`);
        break;
      }

      for (const row of data.rows) {
        books.push(parseBook(row));
      }

      const page = Math.floor(offset / LIMIT) + 1;
      const totalPages = Math.ceil(maxOffset / LIMIT);
      logProgress(2, `Page ${page}/${totalPages}: ${books.length} / ~${maxOffset} books (${(books.length / maxOffset * 100).toFixed(1)}%)`);

      // Save progress every 5 pages
      if (page % 5 === 0) {
        state.bookList = books;
        saveState(state);
      }

      offset += LIMIT;
    } catch (err) {
      logProgress(2, `Error at offset ${offset}: ${err.message}. Saving progress.`);
      // Try refreshing session on auth errors
      if (err.message.includes('401') || err.message.includes('403')) {
        logProgress(2, 'Session may have expired, refreshing...');
        state.sessionId = await getSession();
        continue;
      }
      state.bookList = books;
      saveState(state);
      throw err;
    }
  }

  logProgress(2, `Book list complete: ${books.length} books`);
  state.bookList = books;
  state.bookListComplete = true;
  saveState(state);

  return books;
}

function parseBook(row) {
  return {
    id: row.eisbn,
    isbn: row.isbn,
    title: row.title,
    subtitle: row.subtitle || '',
    authors: (row.authors || []).map((a) => a.name).join(', '),
    coverImageCache: row.cover_image_cache,
    hasInteriors: row.has_interiors || false,
    binding: row.binding || '',
    publisher: row.publisher || '',
    audience: row.audience || '',
    price: row.price || '',
    releaseDate: row.release_date,
  };
}
