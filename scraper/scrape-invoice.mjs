import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logProgress } from './lib/progress.mjs';
import { fetchInvoiceDetails } from './lib/fetch-invoice-details.mjs';
import { downloadAllImagesTo, generateBooksJsonTo } from './lib/download-images-to.mjs';
import { upgradeLowResCovers } from './upgrade-low-res-covers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data');
const IMAGES_DIR = join(DATA_DIR, 'images-invoice');
const OUTPUT_FILE = join(DATA_DIR, 'books-invoice.json');
const ISBN_FILE = join(__dirname, 'invoice-isbns.json');
const STATE_DIR = join(__dirname, 'state');
const STATE_FILE = join(STATE_DIR, 'invoice-scraper-state.json');

function loadState() {
  if (!existsSync(STATE_FILE)) {
    return {
      bookList: [],
      detailsFetched: new Set(),
      imagesDownloaded: new Set(),
      sessionId: null,
    };
  }
  const raw = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
  return {
    ...raw,
    detailsFetched: new Set(raw.detailsFetched || []),
    imagesDownloaded: new Set(raw.imagesDownloaded || []),
  };
}

function saveLocalState(state) {
  mkdirSync(STATE_DIR, { recursive: true });
  const serializable = {
    ...state,
    detailsFetched: [...state.detailsFetched],
    imagesDownloaded: [...state.imagesDownloaded],
  };
  writeFileSync(STATE_FILE, JSON.stringify(serializable, null, 2));
}

async function main() {
  console.log('=== Book Picker Invoice Scraper ===\n');

  const { isbns, skip } = JSON.parse(readFileSync(ISBN_FILE, 'utf-8'));
  const toScrape = isbns.filter((i) => !skip.includes(i));
  logProgress(0, `Invoice ISBNs: ${isbns.length}, skip: ${skip.length}, to scrape: ${toScrape.length}`);

  const state = loadState();

  try {
    logProgress(3, '--- Phase: Detail Fetch ---');
    await fetchInvoiceDetails(state, toScrape);
    saveLocalState(state);

    logProgress(4, '--- Phase: Image Download ---');
    mkdirSync(IMAGES_DIR, { recursive: true });
    await downloadAllImagesTo(state, { imagesDir: IMAGES_DIR });
    saveLocalState(state);

    generateBooksJsonTo(state, {
      imagesDir: IMAGES_DIR,
      outputFile: OUTPUT_FILE,
      imagePathPrefix: 'images-invoice',
    });
    saveLocalState(state);

    // Optional post-pass: upgrade any sub-300px BookManager covers from
    // Open Library / Google Books. Wrapped so a third-party API outage
    // can never fail the scrape — covers stay as-is in that case.
    logProgress(5, '--- Phase: Cover Upgrade ---');
    try {
      await upgradeLowResCovers();
    } catch (err) {
      logProgress(5, `Cover upgrade skipped: ${err.message}`);
    }

    console.log('\n=== Invoice scraping complete! ===');
    console.log(`Books in bookList: ${state.bookList.length}`);
    console.log(`Details fetched:   ${state.detailsFetched.size}`);
    console.log(`Images downloaded: ${state.imagesDownloaded.size}`);
    console.log(`Output:            ${OUTPUT_FILE}`);
  } catch (err) {
    console.error('\nScraper error:', err.message);
    console.error('Local state saved at', STATE_FILE, '— re-run to resume.');
    saveLocalState(state);
    process.exit(1);
  }
}

main();
