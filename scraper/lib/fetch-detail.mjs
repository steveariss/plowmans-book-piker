import { getSession, fetchBookDetail } from './api.mjs';
import { logProgress, saveState } from './progress.mjs';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchBookDetails(state) {
  const books = state.bookList;
  const needsDetail = books.filter((b) => !state.detailsFetched.has(b.id));

  if (needsDetail.length === 0) {
    logProgress(3, 'All book details already fetched, skipping.');
    return books;
  }

  if (!state.sessionId) {
    logProgress(3, 'Getting API session...');
    state.sessionId = await getSession();
  }

  logProgress(3, `Fetching details for ${needsDetail.length} of ${books.length} books...`);

  for (let i = 0; i < needsDetail.length; i++) {
    const book = needsDetail[i];

    try {
      const data = await fetchBookDetail(state.sessionId, book.id);

      // Extract interior image objects from the detail response
      const interiorObjects = data.interior_objects || [];
      book.interiorImages = interiorObjects.map((obj) => ({
        key: obj.key || obj.imgp,
        cb: obj.cb || obj.cache || book.coverImageCache,
        b2b: obj.b2b || '',
      }));

      state.detailsFetched.add(book.id);

      if ((i + 1) % 25 === 0 || i === needsDetail.length - 1) {
        const pct = (((i + 1) / needsDetail.length) * 100).toFixed(1);
        logProgress(3, `Details: ${i + 1} / ${needsDetail.length} books (${pct}%)`);
        saveState(state);
      }
    } catch (err) {
      logProgress(3, `Error fetching detail for ${book.id}: ${err.message}`);

      // Refresh session on auth errors
      if (err.message.includes('401') || err.message.includes('403')) {
        logProgress(3, 'Session may have expired, refreshing...');
        state.sessionId = await getSession();
        i--; // Retry this book
        continue;
      }

      book.interiorImages = [];
    }

    await sleep(1500);
  }

  saveState(state);
  logProgress(3, `Details complete for ${state.detailsFetched.size} books.`);
  return books;
}
