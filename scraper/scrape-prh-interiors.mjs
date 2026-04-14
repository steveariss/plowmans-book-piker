import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { generateBooksJsonTo } from './lib/download-images-to.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data');
const IMAGES_DIR = join(DATA_DIR, 'images-invoice');
const OUTPUT_FILE = join(DATA_DIR, 'books-invoice.json');
const STATE_FILE = join(__dirname, 'state', 'invoice-scraper-state.json');

const PRH_IMPRINTS = [
  'Penguin Young Readers Group',
  'Random House Children\'s Books',
  'Random House Worlds',
  'Tundra',
  'Tundra Books',
  'Penguin',
  'Random House',
];

const MAX_PAGES = 40;
const DELAY_MS = 150;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isPrh(publisher) {
  if (!publisher) return false;
  return PRH_IMPRINTS.some((p) => publisher.includes(p));
}

function convertToWebp(jpgPath, webpPath) {
  execFileSync('cwebp', ['-q', '65', jpgPath, '-o', webpPath], { stdio: 'ignore' });
  unlinkSync(jpgPath);
}

async function fetchPage(isbn, pageId) {
  const url = `https://insight.randomhouse.com/fullpage.do?pContentType=JPG&pName=fullpage&pISBN=${isbn}&pPageID=${pageId}`;
  const res = await fetch(url);
  if (res.status !== 200) return null;
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('image')) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 500) return null; // sanity floor
  return buf;
}

async function scrapeBookInteriors(book) {
  const bookDir = join(IMAGES_DIR, book.id);
  mkdirSync(bookDir, { recursive: true });

  const pages = [];
  for (let pageId = 1; pageId <= MAX_PAGES; pageId++) {
    const buf = await fetchPage(book.isbn, pageId);
    if (!buf) break;
    const tmpPath = join(bookDir, `page-${pages.length + 1}.jpg`);
    const webpPath = join(bookDir, `page-${pages.length + 1}.webp`);
    writeFileSync(tmpPath, buf);
    convertToWebp(tmpPath, webpPath);
    pages.push({ key: `page-${pages.length + 1}` });
    await sleep(DELAY_MS);
  }
  return pages;
}

async function main() {
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
  state.detailsFetched = new Set(state.detailsFetched || []);
  state.imagesDownloaded = new Set(state.imagesDownloaded || []);

  const needsInteriors = state.bookList.filter((b) => (b.interiorImages || []).length === 0);
  const prh = needsInteriors.filter((b) => isPrh(b.publisher));
  const other = needsInteriors.filter((b) => !isPrh(b.publisher));

  console.log(`Books missing interiors: ${needsInteriors.length}`);
  console.log(`  PRH imprints: ${prh.length}`);
  console.log(`  Other:        ${other.length}\n`);

  let recovered = 0;
  for (let i = 0; i < prh.length; i++) {
    const book = prh[i];
    process.stdout.write(`[${i + 1}/${prh.length}] ${book.title} (${book.publisher})... `);
    try {
      const pages = await scrapeBookInteriors(book);
      if (pages.length > 0) {
        book.interiorImages = pages;
        recovered++;
        console.log(`${pages.length} pages`);
      } else {
        console.log('no pages');
      }
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
    }
  }

  // Persist updated state (Sets → arrays for JSON)
  const serializable = {
    ...state,
    detailsFetched: [...state.detailsFetched],
    imagesDownloaded: [...state.imagesDownloaded],
  };
  writeFileSync(STATE_FILE, JSON.stringify(serializable, null, 2));

  // Regenerate books-invoice.json with updated interiorImages
  generateBooksJsonTo(state, {
    imagesDir: IMAGES_DIR,
    outputFile: OUTPUT_FILE,
    imagePathPrefix: 'images-invoice',
  });

  console.log(`\nRecovered interiors for ${recovered} of ${prh.length} PRH books.`);
  console.log('\n=== Remaining books with no interior preview ===');
  const stillMissing = state.bookList.filter((b) => (b.interiorImages || []).length === 0);
  stillMissing.forEach((b) => {
    console.log(`  ${b.title}  —  ${b.publisher || '(unknown)'}`);
  });
  console.log(`\nTotal still missing: ${stillMissing.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
