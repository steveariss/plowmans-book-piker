import { chromium } from 'playwright';
import { logProgress, saveState } from './progress.mjs';

const BROWSE_URL = 'https://anotherstoryedu.ca/browse/filter/a/a4to6';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchBookList(state) {
  if (state.bookListComplete && state.bookList.length > 0) {
    logProgress(2, `Book list already complete (${state.bookList.length} books), skipping.`);
    return state.bookList;
  }

  logProgress(2, 'Launching browser to fetch book list...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const books = state.bookList.length > 0 ? [...state.bookList] : [];
  const seenIds = new Set(books.map((b) => b.id));

  // Intercept API responses to capture book data
  const capturedResponses = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('bookmanager.com') && response.status() === 200) {
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('json')) {
          const data = await response.json();
          capturedResponses.push({ url, data });
        }
      } catch {
        // Not JSON or network error
      }
    }
  });

  try {
    logProgress(2, 'Navigating to browse page...');
    await page.goto(BROWSE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);

    // Try to extract books from the rendered page
    let pageBooks = await extractBooksFromPage(page);

    if (pageBooks.length > 0) {
      for (const book of pageBooks) {
        if (!seenIds.has(book.id)) {
          books.push(book);
          seenIds.add(book.id);
        }
      }
      logProgress(2, `Found ${pageBooks.length} books on initial page (${books.length} total)`);
    }

    // Check for pagination / infinite scroll / "load more" buttons
    let attempts = 0;
    const maxAttempts = 200; // Safety limit

    while (attempts < maxAttempts) {
      // Try scrolling to trigger lazy loading
      const prevCount = books.length;

      // Scroll to bottom
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(2000);

      // Check for "Load More" or "Next" button
      const loadMoreButton = await page.$('button:has-text("Load More"), button:has-text("Show More"), a:has-text("Next"), button:has-text("next"), .pagination a:last-child');
      if (loadMoreButton) {
        try {
          await loadMoreButton.click();
          await sleep(2000);
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        } catch {
          // Button may have disappeared
        }
      }

      // Extract any new books
      pageBooks = await extractBooksFromPage(page);
      let newCount = 0;
      for (const book of pageBooks) {
        if (!seenIds.has(book.id)) {
          books.push(book);
          seenIds.add(book.id);
          newCount++;
        }
      }

      if (newCount > 0) {
        logProgress(2, `Fetching book list... ${books.length} books found`);
        // Save progress periodically
        if (books.length % 100 < 20) {
          state.bookList = books;
          saveState(state);
        }
      }

      // If no new books found after scroll + attempts, we're done
      if (books.length === prevCount) {
        attempts++;
        if (attempts > 5) {
          // Also try intercepted API data
          for (const resp of capturedResponses) {
            const extracted = extractBooksFromApiResponse(resp.data);
            for (const book of extracted) {
              if (!seenIds.has(book.id)) {
                books.push(book);
                seenIds.add(book.id);
              }
            }
          }
          if (books.length === prevCount) break;
          attempts = 0;
        }
      } else {
        attempts = 0;
      }

      await sleep(1500);
    }

  } finally {
    await browser.close();
  }

  // If we still have no books, try the direct API approach
  if (books.length === 0) {
    logProgress(2, 'No books found via browser. Trying direct API fetch...');
    const apiBooks = await fetchBooksViaApi();
    books.push(...apiBooks);
  }

  logProgress(2, `Book list complete: ${books.length} books`);
  state.bookList = books;
  state.bookListComplete = true;
  saveState(state);

  return books;
}

async function extractBooksFromPage(page) {
  return page.evaluate(() => {
    const books = [];
    // Common selectors for BookManager product cards
    const cards = document.querySelectorAll(
      '[class*="product"], [class*="book"], [class*="item"], [data-isbn], .product-card, .book-card'
    );

    for (const card of cards) {
      // Try to find title
      const titleEl = card.querySelector(
        'h2, h3, h4, [class*="title"], [class*="name"], a[href*="/item/"]'
      );
      const title = titleEl?.textContent?.trim();
      if (!title || title.length < 2) continue;

      // Try to find link to detail page
      const linkEl = card.querySelector('a[href*="/item/"]');
      const href = linkEl?.getAttribute('href');
      const id = href ? href.split('/item/')[1]?.split(/[?#/]/)[0] : null;

      // Try to find cover image
      const imgEl = card.querySelector('img');
      const imgSrc = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src');

      if (id && title) {
        books.push({
          id,
          title,
          coverImageUrl: imgSrc || null,
          detailUrl: href ? new URL(href, window.location.origin).href : null,
        });
      }
    }
    return books;
  });
}

function extractBooksFromApiResponse(data) {
  const books = [];

  // Handle various API response shapes
  const items = data?.products || data?.items || data?.data || (Array.isArray(data) ? data : []);

  for (const item of items) {
    const id = item.id || item.isbn || item.product_id || item.ean;
    const title = item.title || item.name || item.product_name;
    if (!id || !title) continue;

    const coverImageUrl = item.cover || item.image || item.thumbnail || item.cover_image;

    books.push({
      id: String(id),
      title: String(title),
      coverImageUrl: coverImageUrl || null,
      detailUrl: item.url || item.detail_url || null,
    });
  }

  return books;
}

async function fetchBooksViaApi() {
  // Try the known BookManager API pattern
  const shopId = '7603827';
  const books = [];

  try {
    // BookManager uses a specific API format
    const baseUrl = `https://api2.bookmanager.com/tbm/shop/${shopId}`;

    let page = 1;
    const perPage = 100;
    let hasMore = true;

    while (hasMore) {
      const url = `${baseUrl}/products?page=${page}&per_page=${perPage}&category=a4to6`;
      logProgress(2, `Trying API: page ${page}...`);

      const response = await fetch(url);
      if (!response.ok) {
        logProgress(2, `API returned ${response.status}, stopping.`);
        break;
      }

      const data = await response.json();
      const extracted = extractBooksFromApiResponse(data);

      if (extracted.length === 0) {
        hasMore = false;
      } else {
        books.push(...extracted);
        logProgress(2, `API page ${page}: got ${extracted.length} books (${books.length} total)`);
        page++;
        await sleep(1500);
      }
    }
  } catch (err) {
    logProgress(2, `Direct API fetch failed: ${err.message}`);
  }

  return books;
}
