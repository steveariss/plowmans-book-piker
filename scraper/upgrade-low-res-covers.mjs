import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data');
const IMAGES_DIR = join(DATA_DIR, 'images-invoice');
const BOOKS_FILE = join(DATA_DIR, 'books-invoice.json');

const MIN_GOOD_WIDTH = 300;

function readJpegDimensions(buf) {
  const u = new Uint8Array(buf);
  for (let i = 0; i < u.length - 8; i++) {
    if (u[i] === 0xff && (u[i + 1] === 0xc0 || u[i + 1] === 0xc2)) {
      const h = (u[i + 5] << 8) | u[i + 6];
      const w = (u[i + 7] << 8) | u[i + 8];
      return { width: w, height: h };
    }
  }
  return null;
}

function readWebpDimensions(buf) {
  const vp8 = buf.indexOf('VP8 ');
  if (vp8 >= 0) {
    return {
      width: buf.readUInt16LE(vp8 + 14) & 0x3fff,
      height: buf.readUInt16LE(vp8 + 16) & 0x3fff,
    };
  }
  const vp8l = buf.indexOf('VP8L');
  if (vp8l >= 0) {
    const sig = buf.readUInt32LE(vp8l + 9);
    return { width: (sig & 0x3fff) + 1, height: ((sig >> 14) & 0x3fff) + 1 };
  }
  return null;
}

async function tryOpenLibrary(isbn) {
  const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
  const r = await fetch(url);
  if (r.status !== 200) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 2000) return null;
  const dims = readJpegDimensions(buf);
  if (!dims || dims.width < MIN_GOOD_WIDTH) return null;
  return { buf, source: 'open-library', dims };
}

async function tryGoogleBooks(isbn) {
  const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
  const j = await r.json();
  const item = j.items?.[0];
  if (!item) return null;
  const thumb = item.volumeInfo?.imageLinks?.thumbnail;
  if (!thumb) return null;
  // zoom=3 gives the largest reliable size; remove edge=curl artifact
  const url = thumb
    .replace(/zoom=\d+/, 'zoom=3')
    .replace(/&edge=curl/, '')
    .replace(/^http:/, 'https:');
  const imgR = await fetch(url);
  if (imgR.status !== 200) return null;
  const buf = Buffer.from(await imgR.arrayBuffer());
  if (buf.length < 2000) return null;
  const dims = readJpegDimensions(buf);
  if (!dims || dims.width < MIN_GOOD_WIDTH) return null;
  return { buf, source: 'google-books', dims };
}

function convertToWebp(jpgPath, webpPath) {
  execFileSync('cwebp', ['-q', '78', jpgPath, '-o', webpPath], { stdio: 'ignore' });
}

async function upgradeBook(book) {
  const tryOrder = [tryOpenLibrary, tryGoogleBooks];
  for (const fn of tryOrder) {
    try {
      const result = await fn(book.isbn);
      if (result) return result;
    } catch (err) {
      console.log(`  [${fn.name}] threw: ${err.message}`);
    }
  }
  return null;
}

async function main() {
  const books = JSON.parse(readFileSync(BOOKS_FILE, 'utf-8'));

  const lowRes = books.filter((b) => (b.coverWidth || 0) < MIN_GOOD_WIDTH);
  console.log(`Books with cover width < ${MIN_GOOD_WIDTH}px: ${lowRes.length}\n`);

  let upgraded = 0;
  for (let i = 0; i < lowRes.length; i++) {
    const book = lowRes[i];
    process.stdout.write(`[${i + 1}/${lowRes.length}] ${book.title} (${book.coverWidth}x${book.coverHeight})... `);

    // Pull ISBN from the source-of-truth: state file (since books.json doesn't include it)
    const state = JSON.parse(
      readFileSync(join(__dirname, 'state', 'invoice-scraper-state.json'), 'utf-8'),
    );
    const stateBook = state.bookList.find((b) => b.id === book.id);
    if (!stateBook?.isbn) {
      console.log('NO ISBN in state');
      continue;
    }
    const isbn = stateBook.isbn;

    const result = await upgradeBook({ isbn });
    if (!result) {
      console.log('no source');
      continue;
    }

    const bookDir = join(IMAGES_DIR, book.id);
    const tmpJpg = join(bookDir, '_upgraded.jpg');
    const finalWebp = join(bookDir, 'cover.webp');
    writeFileSync(tmpJpg, result.buf);
    convertToWebp(tmpJpg, finalWebp);
    unlinkSync(tmpJpg);

    // Re-read final webp dims (cwebp may resize)
    const finalBuf = readFileSync(finalWebp);
    const finalDims = readWebpDimensions(finalBuf) || result.dims;
    book.coverWidth = finalDims.width;
    book.coverHeight = finalDims.height;

    console.log(`-> ${result.source} ${result.dims.width}x${result.dims.height}`);
    upgraded++;
  }

  writeFileSync(BOOKS_FILE, JSON.stringify(books, null, 2));
  console.log(`\nUpgraded ${upgraded} of ${lowRes.length} covers.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
