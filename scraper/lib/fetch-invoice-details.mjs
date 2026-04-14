import { getSession, searchByIsbn, fetchBookDetail } from './api.mjs';
import { logProgress, saveState } from './progress.mjs';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * For each ISBN, (1) resolve to the 22-char eisbn token via browse search,
 * (2) call fetchBookDetail to pull interior images + full subjects,
 * (3) append to state.bookList keyed by eisbn (matching books.json schema).
 */
export async function fetchInvoiceDetails(state, isbns) {
  const existingIds = new Set(state.bookList.map((b) => b.id));
  const needed = isbns.filter((i) => !state.detailsFetched.has(i));

  if (needed.length === 0) {
    logProgress(3, 'All invoice details already fetched, skipping.');
    return state.bookList;
  }

  if (!state.sessionId) {
    logProgress(3, 'Getting API session...');
    state.sessionId = await getSession();
  }

  logProgress(3, `Resolving + fetching details for ${needed.length} invoice ISBNs...`);

  for (let i = 0; i < needed.length; i++) {
    const isbn = needed[i];

    try {
      const row = await searchByIsbn(state.sessionId, isbn);
      if (!row) {
        logProgress(3, `No browse result for ISBN ${isbn}`);
        state.detailsFetched.add(isbn);
        continue;
      }
      if (row.isbn !== isbn) {
        logProgress(3, `WARN: search for ${isbn} returned closest match ${row.isbn} (${row.title}) — using it`);
      }

      const eisbn = row.eisbn;
      await sleep(500);

      const detail = await fetchBookDetail(state.sessionId, eisbn);

      const authors = Array.isArray(row.authors)
        ? row.authors.map((a) => a.name || a).filter(Boolean).join(', ')
        : (row.authors || '');

      const rawSubjects = (detail && detail.subjects) || [];
      const subjects = rawSubjects.flatMap((group) => {
        const labels = [group.subject];
        for (const sub of group.sub_labels || []) {
          if (sub.label) labels.push(sub.label);
        }
        return labels;
      }).filter(Boolean);

      const interiorObjects = (detail && detail.interior_objects) || [];
      const interiorImages = interiorObjects.map((obj) => ({
        key: obj.key || obj.imgp,
        cb: obj.cb || obj.cache || row.cover_image_cache || '',
        b2b: obj.b2b || '',
      }));

      const book = {
        id: eisbn,
        isbn,
        title: row.title || '',
        subtitle: row.subtitle || '',
        authors,
        coverImageCache: row.cover_image_cache || '',
        audience: row.audience || '',
        publisher: row.publisher || '',
        binding: row.binding || '',
        price: row.price || '',
        subjects,
        interiorImages,
      };

      if (!existingIds.has(eisbn)) {
        state.bookList.push(book);
        existingIds.add(eisbn);
      } else {
        const idx = state.bookList.findIndex((b) => b.id === eisbn);
        state.bookList[idx] = book;
      }

      state.detailsFetched.add(isbn);

      if ((i + 1) % 5 === 0 || i === needed.length - 1) {
        logProgress(3, `Details: ${i + 1} / ${needed.length} (${book.title})`);
        saveState(state);
      }
    } catch (err) {
      logProgress(3, `Error resolving ${isbn}: ${err.message}`);
      if (err.message.includes('401') || err.message.includes('403')) {
        logProgress(3, 'Session may have expired, refreshing...');
        state.sessionId = await getSession();
        i--;
        continue;
      }
    }

    await sleep(1500);
  }

  saveState(state);
  logProgress(3, `Invoice details complete: ${state.detailsFetched.size} books.`);
  return state.bookList;
}
