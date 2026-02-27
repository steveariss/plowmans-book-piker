import { loadState, saveState, resetState, logProgress } from './lib/progress.mjs';
import { discoverApi } from './lib/discover-api.mjs';
import { fetchBookList } from './lib/fetch-books.mjs';
import { fetchBookDetails } from './lib/fetch-detail.mjs';
import { downloadAllImages, generateBooksJson } from './lib/download-images.mjs';

const args = process.argv.slice(2);
const shouldReset = args.includes('--reset');
const phaseOnly = args.includes('--phase') ? parseInt(args[args.indexOf('--phase') + 1]) : null;

async function main() {
  console.log('=== Book Picker Scraper ===\n');

  if (shouldReset) {
    logProgress(0, 'Resetting scraper state...');
    resetState();
  }

  const state = loadState();

  try {
    // Phase 1: API Discovery
    if (!phaseOnly || phaseOnly === 1) {
      logProgress(1, '--- Phase 1: API Discovery ---');
      state.discoveredApi = await discoverApi(state);
      saveState(state);
    }

    // Phase 2: Book List Scraping
    if (!phaseOnly || phaseOnly === 2) {
      logProgress(2, '--- Phase 2: Book List Scraping ---');
      await fetchBookList(state);
    }

    // Phase 3: Detail Page Scraping
    if (!phaseOnly || phaseOnly === 3) {
      logProgress(3, '--- Phase 3: Detail Page Scraping ---');
      await fetchBookDetails(state);
    }

    // Phase 4: Image Download
    if (!phaseOnly || phaseOnly === 4) {
      logProgress(4, '--- Phase 4: Image Download ---');
      await downloadAllImages(state);
      generateBooksJson(state);
    }

    console.log('\n=== Scraping complete! ===');
    console.log(`Total books: ${state.bookList.length}`);
    console.log(`Details fetched: ${state.detailsFetched.size}`);
    console.log(`Images downloaded: ${state.imagesDownloaded.size}`);

  } catch (err) {
    console.error('\nScraper error:', err.message);
    console.error('State has been saved. Re-run to resume from where it stopped.');
    saveState(state);
    process.exit(1);
  }
}

main();
