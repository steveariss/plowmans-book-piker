import { getSession, fetchBookDetail } from './api.mjs';
import { logProgress, saveState } from './progress.mjs';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * For each ISBN in `isbns`, call fetchBookDetail and build a book record,
 * storing it in state.bookList. Skips ISBNs already in state.detailsFetched.
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

  logProgress(3, `Fetching details for ${needed.length} invoice ISBNs...`);

  for (let i = 0; i < needed.length; i++) {
    const isbn = needed[i];

    try {
      const data = await fetchBookDetail(state.sessionId, isbn);

      const authors = Array.isArray(data.authors)
        ? data.authors.map((a) => a.name || a).filter(Boolean).join(', ')
        : (data.authors || '');

      const rawSubjects = data.subjects || [];
      const subjects = rawSubjects.flatMap((group) => {
        const labels = [group.subject];
        for (const sub of group.sub_labels || []) {
          if (sub.label) labels.push(sub.label);
        }
        return labels;
      }).filter(Boolean);

      const interiorObjects = data.interior_objects || [];
      const interiorImages = interiorObjects.map((obj) => ({
        key: obj.key || obj.imgp,
        cb: obj.cb || obj.cache || data.cover_image_cache || '',
        b2b: obj.b2b || '',
      }));

      const book = {
        id: isbn,
        isbn,
        title: data.title || '',
        subtitle: data.subtitle || '',
        authors,
        coverImageCache: data.cover_image_cache || data.cache || '',
        audience: data.audience || '',
        publisher: data.publisher || '',
        binding: data.binding || '',
        price: data.price || '',
        subjects,
        interiorImages,
      };

      if (!existingIds.has(isbn)) {
        state.bookList.push(book);
        existingIds.add(isbn);
      } else {
        const idx = state.bookList.findIndex((b) => b.id === isbn);
        state.bookList[idx] = book;
      }

      state.detailsFetched.add(isbn);

      if ((i + 1) % 10 === 0 || i === needed.length - 1) {
        logProgress(3, `Details: ${i + 1} / ${needed.length} (${book.title})`);
        saveState(state);
      }
    } catch (err) {
      logProgress(3, `Error fetching detail for ${isbn}: ${err.message}`);
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
