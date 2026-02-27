import { chromium } from 'playwright';
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

  logProgress(3, `Fetching details for ${needsDetail.length} of ${books.length} books...`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  try {
    const page = await context.newPage();

    for (let i = 0; i < needsDetail.length; i++) {
      const book = needsDetail[i];
      const detailUrl = book.detailUrl || `https://anotherstoryedu.ca/item/${book.id}`;

      try {
        // Intercept image URLs from API responses
        const imageUrls = [];
        const capturedImages = [];

        page.on('response', async (response) => {
          const url = response.url();
          if (url.includes('cdn1.bookmanager.com') || url.includes('bookmanager.com/image')) {
            capturedImages.push(url);
          }
          if (url.includes('bookmanager.com') && response.status() === 200) {
            try {
              const ct = response.headers()['content-type'] || '';
              if (ct.includes('json')) {
                const data = await response.json();
                // Extract image URLs from detail API responses
                extractImageUrls(data, imageUrls);
              }
            } catch {
              // ignore
            }
          }
        });

        await page.goto(detailUrl, {
          waitUntil: 'networkidle',
          timeout: 30000,
        });

        await page.waitForTimeout(2000);

        // Extract images from the rendered page
        const pageImages = await page.evaluate(() => {
          const images = [];
          // Look for thumbnail carousel / gallery images
          const imgElements = document.querySelectorAll(
            'img[src*="bookmanager"], img[src*="cdn1"], [class*="gallery"] img, [class*="thumbnail"] img, [class*="carousel"] img, [class*="preview"] img'
          );

          for (const img of imgElements) {
            const src = img.getAttribute('src') || img.getAttribute('data-src');
            if (src && (src.includes('bookmanager.com') || src.includes('cdn1'))) {
              images.push(src);
            }
          }

          // Also check for lightbox / full-size links
          const links = document.querySelectorAll('a[href*="bookmanager.com/image"], a[href*="cdn1"]');
          for (const link of links) {
            images.push(link.getAttribute('href'));
          }

          return images;
        });

        // Combine all discovered images
        const allImages = [...new Set([...capturedImages, ...imageUrls, ...pageImages])];

        // Classify images: first is cover, rest are interior
        if (allImages.length > 0) {
          book.coverImageUrl = book.coverImageUrl || allImages[0];
          book.interiorImageUrls = allImages.slice(1);
        } else {
          book.interiorImageUrls = [];
        }

        state.detailsFetched.add(book.id);

        if ((i + 1) % 10 === 0 || i === needsDetail.length - 1) {
          logProgress(3, `Fetching details... ${i + 1} / ${needsDetail.length} books (${((i + 1) / needsDetail.length * 100).toFixed(1)}%)`);
          saveState(state);
        }

        // Remove response listeners to prevent memory leak
        page.removeAllListeners('response');

      } catch (err) {
        logProgress(3, `Error fetching detail for ${book.id}: ${err.message}`);
        book.interiorImageUrls = book.interiorImageUrls || [];
      }

      await sleep(1500);
    }
  } finally {
    await browser.close();
  }

  saveState(state);
  logProgress(3, `Details complete for ${state.detailsFetched.size} books.`);
  return books;
}

function extractImageUrls(data, urls) {
  if (!data || typeof data !== 'object') return;

  if (typeof data === 'string' && (data.includes('cdn1.bookmanager.com') || data.includes('bookmanager.com/image'))) {
    urls.push(data);
    return;
  }

  if (Array.isArray(data)) {
    for (const item of data) extractImageUrls(item, urls);
    return;
  }

  for (const [key, value] of Object.entries(data)) {
    if (key.toLowerCase().includes('image') || key.toLowerCase().includes('photo') || key.toLowerCase().includes('cover') || key.toLowerCase().includes('thumbnail')) {
      if (typeof value === 'string' && value.startsWith('http')) {
        urls.push(value);
      }
    }
    if (typeof value === 'object') {
      extractImageUrls(value, urls);
    }
  }
}
