# Teacher Preview Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a second, public build of Book Picker that lets teachers browse the ~76 books arriving from the latest invoice, with all selection and admin UI removed, backed by a separate scraped dataset.

**Architecture:** A single codebase with a Vite build-mode flag (`VITE_APP_MODE=preview`). Preview builds produce `client/dist-preview/` and are served by a second Express process pointed at `data/books-invoice.json` via a `BOOKS_FILE` env var. Data is sourced by a new scraper entry point that calls the existing `fetchBookDetail` API by ISBN (bypassing the browse endpoint entirely) and writes images to `data/images-invoice/`.

**Tech Stack:** React 19 + Vite (build-mode switch), Express (env-driven data path), Node scraper reusing `scraper/lib/api.mjs` + `fetch-detail.mjs` + a parameterized copy of `download-images.mjs`, nginx (separate server block).

**Note on testing:** This project has no test framework or existing test suite. Tasks use **manual verification** (run build, curl endpoints, visual browser checks) instead of automated tests. Every verification step specifies what to look for.

---

## File Structure

### Created

- `scraper/invoice-isbns.json` — source list: `isbns[]` from invoice + `skip[]` for CSV titles
- `scraper/scrape-invoice.mjs` — new entry point (parallel to `scrape.mjs`)
- `scraper/lib/fetch-invoice-details.mjs` — ISBN-input version of `fetch-detail.mjs` that builds `bookList` from ISBNs instead of reading it from a browse phase
- `scraper/lib/download-images-to.mjs` — parameterized version of `download-images.mjs` that takes `imagesDir` + `outputFile` + `imagePathPrefix` arguments
- `client/.env` — sets `VITE_APP_MODE=default`
- `client/.env.preview` — sets `VITE_APP_MODE=preview`
- `client/src/config.js` — exports `APP_MODE`, `IS_PREVIEW`
- `client/src/AppDefault.jsx` — existing route set (moved from `App.jsx`)
- `client/src/AppPreview.jsx` — preview route set
- `docs/deploy-preview-digitalocean.md` — new deployment doc

### Modified

- `client/src/App.jsx` — picks `AppDefault` vs `AppPreview` based on `IS_PREVIEW`
- `client/src/screens/BookBrowsing.jsx` — conditional selection/counter/done/preview-pick wiring
- `client/src/components/shelf/HangingSign.jsx` — hides the star "pick" sign in preview
- `client/src/components/book3d/Book3DPreview.jsx` — hides `PickButton` in preview
- `client/package.json` — adds `build:preview`, `dev:preview` scripts
- `client/vite.config.js` — adds `preview` mode `outDir: 'dist-preview'`
- `server/index.mjs` — reads `BOOKS_FILE` env var; serves `data/images-invoice/` as static alongside `data/images/`
- `package.json` (root) — adds `scrape:invoice` and `build:preview` scripts

### Untouched

- `data/books.json`, `data/images/` — student-facing app dataset
- All admin routes, selections routes, DB schema
- Existing scraper (`scrape.mjs`, `fetch-books.mjs`, `fetch-detail.mjs`, `download-images.mjs`)
- Existing nginx config and `docs/deploy-digitalocean.md`

---

## Task 1: Create the branch and workspace

**Files:** none (git only)

- [ ] **Step 1: Create branch off main**

```bash
git checkout main
git pull
git checkout -b teacher-preview
```

- [ ] **Step 2: Verify clean state**

```bash
git status
```
Expected: `On branch teacher-preview` and working tree clean (the untracked `data/book-invoice.pdf`, `data/match-results.json`, and `data/student-book-selections.csv` from earlier exploration are fine — they're gitignored under `data/`).

---

## Task 2: Transcribe invoice ISBNs

**Files:**
- Create: `scraper/invoice-isbns.json`

This task is **manual data entry**. The ISBNs must be correct or the scraper will fail on every request. Open the PDF and type them in by hand, one per line, cross-checking with the title next to each so you catch accidental digit drops.

- [ ] **Step 1: Open the invoice PDF**

Open `data/book-invoice.pdf` in a PDF viewer. There are 3 pages. Each line has an ISBN in the first column (13 digits, always starts with `978` or `979`), followed by quantity, title, price. The bottom of page 3 has a "You have the following items on backorder" section — **include** those ISBNs (they're still coming).

- [ ] **Step 2: Transcribe every ISBN into the file**

Create `scraper/invoice-isbns.json` with this structure. Type each ISBN from the PDF into `isbns`. The `skip` array contains ISBNs corresponding to titles already in `data/student-book-selections.csv` — you'll fill that in the next step. For now leave `skip` as `[]`.

```json
{
  "isbns": [
    "9781419768552",
    "9781615834427"
  ],
  "skip": [],
  "notes": "ISBNs hand-transcribed from data/book-invoice.pdf. 'skip' lists ISBNs of titles in data/student-book-selections.csv that must be excluded from the preview build."
}
```

- [ ] **Step 3: Verify count = 95**

```bash
node -e "const d = JSON.parse(require('fs').readFileSync('scraper/invoice-isbns.json')); console.log('count:', d.isbns.length); const bad = d.isbns.filter(x => !/^97[89]\d{10}$/.test(x)); console.log('invalid:', bad);"
```
Expected: `count: 95` and `invalid: []`. The invoice has 93 in-stock line items plus 2 backorder items (Kamal's Kes, Unicornia). If the count is wrong, go back to the PDF — don't guess.

- [ ] **Step 4: Build the skip list**

`data/student-book-selections.csv` has 20 lines (1 header "Book 1" + 19 titles). For each of the 19 titles, find the matching line in `data/book-invoice.pdf` and write the ISBN into the `skip` array. This is also manual — the PDF titles are truncated so you need visual judgment.

CSV titles to map:
```
Broken
Don't Eat Eustace
Forests
I Am Not Happy!
I'm Longer than You!
Lifesize Dinosaurs
Nat the Cat Finds a Map
One Cosmic Rock
Pizza and Taco
The Cool Bean Makes a Splash
The Day the Crayons Made Friends
The Great Dinosaur Sleepover
The Humble Pie
This Book Is Dangerous! (A Narwhal and Jelly Picture Book #1)
Together
Unicornia
Upside-Down Iftar
Welcome to Whalebone Mansion
When You Go to Dragon School
```

- [ ] **Step 5: Verify skip list**

```bash
node -e "
const d = JSON.parse(require('fs').readFileSync('scraper/invoice-isbns.json'));
console.log('skip count:', d.skip.length);
console.log('remaining:', d.isbns.filter(i => !d.skip.includes(i)).length);
const missing = d.skip.filter(s => !d.isbns.includes(s));
console.log('skip not in isbns (should be empty):', missing);
"
```
Expected: `skip count: 19`, `remaining: 76`, `skip not in isbns: []`.

- [ ] **Step 6: Commit**

```bash
git add scraper/invoice-isbns.json
git commit -m "Add invoice ISBN list with student-picked titles marked as skipped"
```

---

## Task 3: Parameterized image downloader

**Files:**
- Create: `scraper/lib/download-images-to.mjs`

The existing `scraper/lib/download-images.mjs` hardcodes `IMAGES_DIR = data/images` and writes to `data/books.json`. We need a version that accepts these as arguments so the invoice scraper can write to `data/images-invoice/` and `data/books-invoice.json` without touching the existing scraper at all. **Copy the file and parameterize** — do not edit the original.

- [ ] **Step 1: Copy the existing file**

```bash
cp scraper/lib/download-images.mjs scraper/lib/download-images-to.mjs
```

- [ ] **Step 2: Replace contents**

Open `scraper/lib/download-images-to.mjs` and replace it with:

```js
import { writeFileSync, mkdirSync, existsSync, unlinkSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { coverUrl, interiorUrl } from './api.mjs';
import { logProgress, saveState } from './progress.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = join(__dirname, '..', '..', 'data');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadImage(url, destPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, buffer);
}

function convertToWebp(jpgPath, webpPath) {
  execFileSync('cwebp', ['-q', '65', jpgPath, '-o', webpPath], {
    stdio: 'ignore',
  });
  unlinkSync(jpgPath);
}

/**
 * Download cover + interior images for every book in state.bookList into `imagesDir`.
 * Paths inside the generated JSON use `imagePathPrefix` (e.g. "images-invoice").
 */
export async function downloadAllImagesTo(state, { imagesDir }) {
  const books = state.bookList;
  const needsDownload = books.filter((b) => !state.imagesDownloaded.has(b.id));

  if (needsDownload.length === 0) {
    logProgress(4, 'All images already downloaded, skipping.');
    return;
  }

  logProgress(4, `Downloading images for ${needsDownload.length} books into ${imagesDir}...`);
  let downloadedCount = 0;

  for (let i = 0; i < needsDownload.length; i++) {
    const book = needsDownload[i];
    const bookDir = join(imagesDir, book.id);
    mkdirSync(bookDir, { recursive: true });

    try {
      const coverPath = join(bookDir, 'cover.webp');
      if (!existsSync(coverPath)) {
        const tmpPath = join(bookDir, 'cover.jpg');
        const url = coverUrl(book.id, book.coverImageCache);
        await downloadImage(url, tmpPath);
        convertToWebp(tmpPath, coverPath);
        downloadedCount++;
        await sleep(100);
      }

      const interiors = book.interiorImages || [];
      for (let p = 0; p < interiors.length; p++) {
        const pagePath = join(bookDir, `page-${p + 1}.webp`);
        if (!existsSync(pagePath)) {
          const tmpPath = join(bookDir, `page-${p + 1}.jpg`);
          const img = interiors[p];
          const url = interiorUrl(book.id, img.key, img.cb, img.b2b);
          await downloadImage(url, tmpPath);
          convertToWebp(tmpPath, pagePath);
          downloadedCount++;
          await sleep(100);
        }
      }

      state.imagesDownloaded.add(book.id);

      if ((i + 1) % 10 === 0 || i === needsDownload.length - 1) {
        logProgress(4, `Images: ${i + 1} / ${needsDownload.length} books (${downloadedCount} files downloaded)`);
        saveState(state);
      }
    } catch (err) {
      logProgress(4, `Error downloading images for ${book.id}: ${err.message}`);
    }
  }

  saveState(state);
  logProgress(4, `Image download complete: ${downloadedCount} files downloaded.`);
}

/**
 * Generate a books.json-compatible JSON file at `outputFile`.
 * `imagePathPrefix` is used for image paths inside the JSON (e.g. "images-invoice").
 */
export function generateBooksJsonTo(state, { imagesDir, outputFile, imagePathPrefix }) {
  const seen = new Set();
  const books = state.bookList.filter((b) => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });

  const output = books.map((book) => {
    const interiorImages = [];
    const interiors = book.interiorImages || [];
    for (let i = 0; i < interiors.length; i++) {
      const pagePath = join(imagesDir, book.id, `page-${i + 1}.webp`);
      if (existsSync(pagePath)) {
        interiorImages.push(`${imagePathPrefix}/${book.id}/page-${i + 1}.webp`);
      }
    }

    const entry = {
      id: book.id,
      title: book.title,
      authors: book.authors || '',
      audience: book.audience || '',
      subjects: book.subjects || [],
      coverImage: `${imagePathPrefix}/${book.id}/cover.webp`,
      interiorImages,
    };

    const coverPath = join(imagesDir, book.id, 'cover.webp');
    if (existsSync(coverPath)) {
      const buf = readFileSync(coverPath);
      const vp8Start = buf.indexOf('VP8 ');
      if (vp8Start >= 0) {
        entry.coverWidth = buf.readUInt16LE(vp8Start + 14) & 0x3fff;
        entry.coverHeight = buf.readUInt16LE(vp8Start + 16) & 0x3fff;
      } else {
        const vp8lStart = buf.indexOf('VP8L');
        if (vp8lStart >= 0) {
          const sig = buf.readUInt32LE(vp8lStart + 9);
          entry.coverWidth = (sig & 0x3fff) + 1;
          entry.coverHeight = ((sig >> 14) & 0x3fff) + 1;
        }
      }
    }

    if (interiorImages.length === 0) {
      entry.hidden = true;
    }

    return entry;
  });

  writeFileSync(outputFile, JSON.stringify(output, null, 2));
  logProgress(4, `Generated ${outputFile} with ${output.length} books`);
}

export { DEFAULT_DATA_DIR };
```

- [ ] **Step 3: Verify the file parses**

```bash
node --check scraper/lib/download-images-to.mjs && echo OK
```
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add scraper/lib/download-images-to.mjs
git commit -m "Add parameterized image downloader for alternate datasets"
```

---

## Task 4: Invoice detail fetcher

**Files:**
- Create: `scraper/lib/fetch-invoice-details.mjs`

The existing `fetch-detail.mjs` loops over `state.bookList` (populated by `fetch-books.mjs` from the browse endpoint). For the invoice flow we start from a list of ISBNs and need to populate `bookList` directly from the detail API response — the detail call returns the title, authors, cover cache, interior image metadata, etc.

- [ ] **Step 1: Create the file**

Write `scraper/lib/fetch-invoice-details.mjs`:

```js
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

      // Build a book record shaped like fetch-books.mjs + fetch-detail.mjs output
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
        // Replace in place
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
        i--; // retry
        continue;
      }
      // Skip broken ISBNs but keep going
    }

    await sleep(1500);
  }

  saveState(state);
  logProgress(3, `Invoice details complete: ${state.detailsFetched.size} books.`);
  return state.bookList;
}
```

- [ ] **Step 2: Verify it parses**

```bash
node --check scraper/lib/fetch-invoice-details.mjs && echo OK
```
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add scraper/lib/fetch-invoice-details.mjs
git commit -m "Add ISBN-driven detail fetcher for invoice scraping"
```

---

## Task 5: Invoice scraper entry point

**Files:**
- Create: `scraper/scrape-invoice.mjs`
- Modify: `package.json` (root)

- [ ] **Step 1: Create the entry script**

Write `scraper/scrape-invoice.mjs`:

```js
import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logProgress, saveState } from './lib/progress.mjs';
import { fetchInvoiceDetails } from './lib/fetch-invoice-details.mjs';
import { downloadAllImagesTo, generateBooksJsonTo } from './lib/download-images-to.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data');
const IMAGES_DIR = join(DATA_DIR, 'images-invoice');
const OUTPUT_FILE = join(DATA_DIR, 'books-invoice.json');
const ISBN_FILE = join(__dirname, 'invoice-isbns.json');
const STATE_DIR = join(__dirname, 'state');
const STATE_FILE = join(STATE_DIR, 'invoice-scraper-state.json');

import { readFileSync as rfs, writeFileSync, existsSync } from 'fs';

function loadState() {
  if (!existsSync(STATE_FILE)) {
    return {
      bookList: [],
      detailsFetched: new Set(),
      imagesDownloaded: new Set(),
      sessionId: null,
    };
  }
  const raw = JSON.parse(rfs(STATE_FILE, 'utf-8'));
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

// Monkey-patch saveState from progress.mjs for this run so it writes to the invoice state file.
// We do this by overriding the export — progress.mjs uses a module-level constant, so instead
// we call our local saver at checkpoints. The library functions still call saveState from
// progress.mjs, which writes to scraper/state/scraper-state.json. That's fine — that file is
// independent of the main app state and harmless. We also save locally for our own resume.

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
```

- [ ] **Step 2: Add root npm script**

Open `package.json` (root) and add `scrape:invoice` inside `"scripts"` after the existing `scrape` line:

```json
"scrape": "cd scraper && node scrape.mjs",
"scrape:invoice": "cd scraper && node scrape-invoice.mjs",
```

- [ ] **Step 3: Syntax check**

```bash
node --check scraper/scrape-invoice.mjs && echo OK
```
Expected: `OK`.

- [ ] **Step 4: Dry run with a single test ISBN**

Temporarily edit `scraper/invoice-isbns.json` to contain only one ISBN (any one from the real list) and an empty `skip`. Then:

```bash
npm run scrape:invoice
```
Expected: script fetches that one book's details, downloads cover + interior pages into `data/images-invoice/<isbn>/`, writes `data/books-invoice.json` with one entry. If it fails, fix before the full run. Restore the full `invoice-isbns.json` after.

- [ ] **Step 5: Full run**

```bash
npm run scrape:invoice
```
Expected: ~76 books scraped, `data/books-invoice.json` created with ~76 entries, `data/images-invoice/` populated. Resumable — if it fails mid-way, running again picks up where it left off.

- [ ] **Step 6: Sanity-check the output**

```bash
node -e "
const b = JSON.parse(require('fs').readFileSync('data/books-invoice.json'));
console.log('count:', b.length);
console.log('with covers:', b.filter(x => x.coverWidth).length);
console.log('with interiors:', b.filter(x => x.interiorImages.length > 0).length);
console.log('sample:', b[0].title, '-', b[0].authors);
console.log('hidden:', b.filter(x => x.hidden).length);
"
```
Expected: `count: 76` (±2 for backorder quirks), most books with covers and interior pages. If a meaningful number lack covers or titles, stop and investigate.

- [ ] **Step 7: Commit**

```bash
git add scraper/scrape-invoice.mjs package.json
git commit -m "Add invoice scraper entry point with ISBN-driven workflow"
```

Do **not** commit `data/books-invoice.json` or `data/images-invoice/` — they're under `data/` which is gitignored (same as `books.json`).

---

## Task 6: Client config module + env files

**Files:**
- Create: `client/.env`
- Create: `client/.env.preview`
- Create: `client/src/config.js`

- [ ] **Step 1: Create `.env` (default mode)**

Write `client/.env`:

```
VITE_APP_MODE=default
```

- [ ] **Step 2: Create `.env.preview`**

Write `client/.env.preview`:

```
VITE_APP_MODE=preview
```

- [ ] **Step 3: Create the config module**

Write `client/src/config.js`:

```js
export const APP_MODE = import.meta.env.VITE_APP_MODE ?? 'default';
export const IS_PREVIEW = APP_MODE === 'preview';
```

- [ ] **Step 4: Commit**

```bash
git add client/.env client/.env.preview client/src/config.js
git commit -m "Add VITE_APP_MODE build flag and config module"
```

---

## Task 7: Split App.jsx into default/preview variants

**Files:**
- Create: `client/src/AppDefault.jsx`
- Create: `client/src/AppPreview.jsx`
- Modify: `client/src/App.jsx`

The current `App.jsx` hardcodes all 5 routes. We move the existing route set to `AppDefault.jsx` unchanged, create a trimmed `AppPreview.jsx`, and have `App.jsx` pick between them. Because `IS_PREVIEW` is a `import.meta.env` literal, Vite will eliminate the unused branch at build time.

- [ ] **Step 1: Create `AppDefault.jsx`**

Write `client/src/AppDefault.jsx`:

```jsx
import { Routes, Route } from 'react-router-dom';
import TeacherSetup from './screens/TeacherSetup.jsx';
import BookBrowsing from './screens/BookBrowsing.jsx';
import ThankYou from './screens/ThankYou.jsx';
import ManageBooks from './screens/ManageBooks.jsx';
import Report from './screens/Report.jsx';

export default function AppDefault() {
  return (
    <Routes>
      <Route path="/" element={<TeacherSetup />} />
      <Route path="/browse" element={<BookBrowsing />} />
      <Route path="/thanks" element={<ThankYou />} />
      <Route path="/admin/books" element={<ManageBooks />} />
      <Route path="/admin/report" element={<Report />} />
    </Routes>
  );
}
```

- [ ] **Step 2: Create `AppPreview.jsx`**

Write `client/src/AppPreview.jsx`:

```jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import BookBrowsing from './screens/BookBrowsing.jsx';

export default function AppPreview() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/browse" replace />} />
      <Route path="/browse" element={<BookBrowsing />} />
      <Route path="*" element={<Navigate to="/browse" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 3: Replace `App.jsx`**

Overwrite `client/src/App.jsx` with:

```jsx
import { IS_PREVIEW } from './config.js';
import AppDefault from './AppDefault.jsx';
import AppPreview from './AppPreview.jsx';

export default function App() {
  return IS_PREVIEW ? <AppPreview /> : <AppDefault />;
}
```

- [ ] **Step 4: Verify default build still works**

```bash
cd client && npx vite build && cd ..
```
Expected: clean build into `client/dist/`, no errors. The main student app should still render identically.

- [ ] **Step 5: Commit**

```bash
git add client/src/App.jsx client/src/AppDefault.jsx client/src/AppPreview.jsx
git commit -m "Split App into default and preview variants behind build flag"
```

---

## Task 8: Remove selection UI in preview mode

**Files:**
- Modify: `client/src/screens/BookBrowsing.jsx`
- Modify: `client/src/components/shelf/HangingSign.jsx`
- Modify: `client/src/components/book3d/Book3DPreview.jsx`

- [ ] **Step 1: Gate `BookBrowsing.jsx` behavior on `IS_PREVIEW`**

Open `client/src/screens/BookBrowsing.jsx` and replace its contents with:

```jsx
import { lazy, Suspense, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBooks } from '../hooks/useBooks.js';
import { useSelections } from '../hooks/useSelections.js';
import { saveSelections } from '../api/client.mjs';
import { IS_PREVIEW } from '../config.js';
import SelectionCounter from '../components/SelectionCounter.jsx';
import DoneButton from '../components/DoneButton.jsx';
import BookShelf from '../components/shelf/BookShelf.jsx';
import styles from './BookBrowsing.module.css';

const Book3DPreview = lazy(() => import('../components/book3d/Book3DPreview.jsx'));

export default function BookBrowsing() {
  const location = useLocation();
  const navigate = useNavigate();
  const studentName = location.state?.studentName || 'Student';
  const [previewBook, setPreviewBook] = useState(null);

  const { books, isLoading, error } = useBooks();
  const { selectedIds, toggleSelection, isComplete, selectedBooks, shakeId } = useSelections(books);

  async function handleDone() {
    const booksPayload = selectedBooks.map((b) => ({ id: b.id, title: b.title }));
    await saveSelections(studentName, booksPayload);
    navigate('/thanks', { state: { studentName, books: selectedBooks } });
  }

  const handlePreview = useCallback((book) => {
    setPreviewBook(book);
  }, []);

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <p>Loading books...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.loading}>
        <p>Oops! Something went wrong.</p>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {!IS_PREVIEW && (
        <div className={styles.selectionContainer}>
          <SelectionCounter count={selectedIds.size} />
        </div>
      )}

      <BookShelf
        books={books}
        selectedIds={selectedIds}
        shakeId={shakeId}
        onPick={toggleSelection}
        onPreview={handlePreview}
      />

      {!IS_PREVIEW && <DoneButton visible={isComplete} onClick={handleDone} />}

      {previewBook && (
        <Suspense fallback={null}>
          <Book3DPreview
            book={previewBook}
            picked={selectedIds.has(previewBook.id)}
            shake={shakeId === previewBook.id}
            onPick={toggleSelection}
            onClose={() => setPreviewBook(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
```

Rationale: leaves selection state/plumbing intact (cheap, works with `useBooks`) but hides counter, done button, and — via the next two steps — the pick surfaces themselves. `useSelections` is still called because removing it would branch the hook order; the state just never becomes visible in preview mode.

- [ ] **Step 2: Hide the star sign in `HangingSign.jsx`**

Open `client/src/components/shelf/HangingSign.jsx` and replace with:

```jsx
import { memo } from 'react';
import { IS_PREVIEW } from '../../config.js';
import styles from './HangingSign.module.css';

function HangingSign({ bookId, title, picked, shake, onPick }) {
  if (IS_PREVIEW) return null;

  const containerClass = [
    styles.signContainer,
    picked ? styles.picked : '',
    shake ? styles.shake : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClass}>
      <div className={styles.sign}>
        <button
          className={styles.signInner}
          onClick={() => onPick(bookId)}
          aria-pressed={picked}
          aria-label={picked ? `Remove ${title} from picks` : `Pick ${title}`}
          type="button"
        >
          <span className={styles.signFront} aria-hidden="true">
            {'\u2B50'}
          </span>
          <span className={styles.signBack} aria-hidden="true">
            {'\u2714'}
          </span>
        </button>
      </div>
    </div>
  );
}

export default memo(HangingSign);
```

- [ ] **Step 3: Hide the pick button inside the 3D preview dialog**

Open `client/src/components/book3d/Book3DPreview.jsx` and locate the line near 103 where `<PickButton ... />` is rendered. Wrap that block so it only renders when not in preview:

```jsx
// at the top of the file, add:
import { IS_PREVIEW } from '../../config.js';
```

Then around the existing render of `<PickButton picked={picked} shake={shake} onClick={() => onPick(book.id)} />`, change it to:

```jsx
{!IS_PREVIEW && (
  <PickButton picked={picked} shake={shake} onClick={() => onPick(book.id)} />
)}
```

- [ ] **Step 4: Default build still works**

```bash
cd client && npx vite build && cd ..
```
Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add client/src/screens/BookBrowsing.jsx client/src/components/shelf/HangingSign.jsx client/src/components/book3d/Book3DPreview.jsx
git commit -m "Hide selection UI in preview mode"
```

---

## Task 9: Preview build + dev scripts

**Files:**
- Modify: `client/package.json`
- Modify: `client/vite.config.js`
- Modify: `package.json` (root)

- [ ] **Step 1: Add preview mode to `vite.config.js`**

Open `client/vite.config.js` and replace with:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/images': 'http://localhost:3000',
    },
  },
  build: {
    outDir: mode === 'preview' ? 'dist-preview' : 'dist',
  },
}));
```

- [ ] **Step 2: Add client-side scripts**

Open `client/package.json` and replace `"scripts"` with:

```json
"scripts": {
  "dev": "vite --port 5173",
  "dev:preview": "vite --port 5174 --mode preview",
  "build": "vite build",
  "build:preview": "vite build --mode preview",
  "preview": "vite preview"
},
```

- [ ] **Step 3: Add root script**

Open root `package.json` and add `build:preview` after `build`:

```json
"build": "cd client && npx vite build",
"build:preview": "cd client && npx vite build --mode preview",
```

- [ ] **Step 4: Build both modes**

```bash
npm run build && npm run build:preview
ls client/dist client/dist-preview
```
Expected: both directories exist with `index.html` and an `assets/` folder.

- [ ] **Step 5: Verify preview bundle has no admin/teacher-setup code**

```bash
grep -l "TeacherSetup\|ManageBooks\|Report" client/dist-preview/assets/*.js && echo "FAIL: preview bundle contains admin code" || echo OK
```
Expected: `OK`. If grep finds matches, the tree-shaking didn't work and the code is bundled. Check that `IS_PREVIEW` is a static `import.meta.env` reference and not re-assigned.

- [ ] **Step 6: Commit**

```bash
git add client/package.json client/vite.config.js package.json
git commit -m "Add preview build commands and mode-specific output dir"
```

---

## Task 10: Server reads `BOOKS_FILE` env var + invoice images static mount

**Files:**
- Modify: `server/index.mjs`

- [ ] **Step 1: Update `server/index.mjs`**

Open `server/index.mjs` and replace with:

```js
import express from 'express';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDatabase } from './db/init.mjs';
import { createBooksRouter } from './routes/books.mjs';
import { createSelectionsRouter } from './routes/selections.mjs';
import { errorHandler } from './middleware/error-handler.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = process.env.DATA_DIR || join(root, 'data');
const booksFile = process.env.BOOKS_FILE || 'books.json';

function loadBooks() {
  const booksPath = join(dataDir, booksFile);
  const samplePath = join(dataDir, 'books-sample.json');
  const filePath = existsSync(booksPath) ? booksPath : samplePath;

  if (!existsSync(filePath)) {
    console.warn(`No book data found. Place ${booksFile} or books-sample.json in ${dataDir}`);
    return [];
  }

  const books = JSON.parse(readFileSync(filePath, 'utf-8'));
  console.log(`Loaded ${books.length} books from ${filePath}`);
  return books;
}

const app = express();
const PORT = process.env.PORT || 3000;

getDatabase();
const books = loadBooks();

app.use(express.json());

app.use('/api/books', createBooksRouter(books));
app.use('/api/selections', createSelectionsRouter());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', booksFile });
});

// Static file serving: book images (main dataset)
app.use('/images', express.static(join(dataDir, 'images'), {
  maxAge: '1d',
  immutable: true,
}));

// Static file serving: invoice dataset images (only used by preview deployment)
app.use('/images-invoice', express.static(join(dataDir, 'images-invoice'), {
  maxAge: '1d',
  immutable: true,
}));

// Static file serving: built React app. Preview deployment points this at dist-preview
// via CLIENT_DIST env var.
const clientDist = process.env.CLIENT_DIST
  ? (process.env.CLIENT_DIST.startsWith('/') ? process.env.CLIENT_DIST : join(root, process.env.CLIENT_DIST))
  : join(root, 'client', 'dist');

if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
}

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (BOOKS_FILE=${booksFile})`);
});
```

Changes: (1) `BOOKS_FILE` env var controls which JSON to load, (2) `/images-invoice` static mount added alongside `/images`, (3) `CLIENT_DIST` env var overrides which built client directory to serve.

- [ ] **Step 2: Verify default startup works**

```bash
npm run dev:server
```
Expected log: `Server running on http://localhost:3000 (BOOKS_FILE=books.json)` and `Loaded 973 books from .../data/books.json`. Kill with Ctrl-C.

- [ ] **Step 3: Verify preview mode startup**

```bash
BOOKS_FILE=books-invoice.json CLIENT_DIST=client/dist-preview PORT=3001 node server/index.mjs
```
Expected log: `Server running on http://localhost:3001 (BOOKS_FILE=books-invoice.json)` and `Loaded 76 books from .../data/books-invoice.json`. In another terminal, verify:

```bash
curl -s http://localhost:3001/api/health | grep books-invoice && echo OK
curl -s http://localhost:3001/api/books | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log('books:',JSON.parse(d).books.length))"
curl -s -o /tmp/cover.webp -w "%{http_code}\n" http://localhost:3001/images-invoice/$(node -e "console.log(JSON.parse(require('fs').readFileSync('data/books-invoice.json'))[0].id)")/cover.webp
```
Expected: `OK`, `books: 76`, `200`. Kill the server.

- [ ] **Step 4: Commit**

```bash
git add server/index.mjs
git commit -m "Add BOOKS_FILE, CLIENT_DIST env vars and invoice image mount"
```

---

## Task 11: End-to-end preview mode manual verification

**Files:** none

- [ ] **Step 1: Rebuild both bundles**

```bash
npm run build && npm run build:preview
```

- [ ] **Step 2: Run the preview server**

```bash
BOOKS_FILE=books-invoice.json CLIENT_DIST=client/dist-preview PORT=3001 node server/index.mjs
```

- [ ] **Step 3: Browser walkthrough**

Open `http://localhost:3001/` in a browser. Verify, in order:

1. You land on the browsing grid (not a "What's your name?" screen). URL should be `/browse`.
2. Books shown are the invoice books (~76). Spot-check one or two titles against `data/books-invoice.json`.
3. **No "0 of 2 picked" counter** anywhere on the page.
4. **No star/pick signs** hanging above shelf books.
5. **No floating Done button** at the bottom.
6. Clicking a book cover opens the 3D preview dialog.
7. Inside the dialog, the cover + interior pages flip as before.
8. **No Pick button inside the dialog.** Only close (Escape or backdrop).
9. Navigating to `http://localhost:3001/admin/books` redirects to `/browse`.
10. Navigating to `http://localhost:3001/thanks` redirects to `/browse`.

- [ ] **Step 4: Regression-check the main build**

In another terminal:

```bash
npm run dev:server
```

Open `http://localhost:3000/` and verify the full student flow still works: name entry → browse → pick 2 → done → thanks screen. Also check `/admin/books` and `/admin/report`. If anything regressed, fix it in a new commit.

- [ ] **Step 5: Commit any fixes**

If Step 4 found regressions and you fixed them:

```bash
git add <files>
git commit -m "Fix <description> regression in default build"
```

---

## Task 12: Deployment documentation

**Files:**
- Create: `docs/deploy-preview-digitalocean.md`

- [ ] **Step 1: Write the preview deployment doc**

Write `docs/deploy-preview-digitalocean.md`:

```markdown
# Deploying the Teacher Preview Site (Ubuntu 24 + NGINX + PM2)

This is a sibling deployment to the main Book Picker site documented in
`docs/deploy-digitalocean.md`. It runs a second Express process on a different port,
serves a different client bundle (`client/dist-preview`), and a different dataset
(`data/books-invoice.json` + `data/images-invoice/`). It is **public** — no HTTP
basic auth — so teachers can open the link without credentials.

The main student-facing site is completely unaffected by this deployment.

## Prerequisites

- Existing droplet already running the main Book Picker site per `deploy-digitalocean.md`
- PM2 and NGINX already installed
- A domain or subdomain pointed at the droplet (e.g. `preview-books.example.com`)

## 1. Build both bundles locally

```bash
npm run build            # -> client/dist/
npm run build:preview    # -> client/dist-preview/
```

## 2. Generate the invoice dataset

```bash
npm run scrape:invoice   # -> data/books-invoice.json + data/images-invoice/
```

This can take 10–20 minutes depending on how many ISBNs need scraping. It's
resumable — re-run if interrupted.

## 3. Transfer to the droplet

On the droplet, the main app lives at `/var/www/book-picker` (per the main doc).
The preview deployment **reuses the same checkout** — it just runs a second PM2
process pointed at different env vars, so there's no second git clone.

From your local machine, rsync the preview build and the invoice data:

```bash
rsync -avz client/dist-preview/ user@droplet:/var/www/book-picker/client/dist-preview/
rsync -avz data/books-invoice.json user@droplet:/var/www/book-picker/data/books-invoice.json
rsync -avz data/images-invoice/ user@droplet:/var/www/book-picker/data/images-invoice/
```

If you prefer to isolate deployments completely, clone the repo a second time to
`/var/www/book-picker-preview` and follow the main doc's install steps there.
The instructions below assume the shared-checkout approach.

## 4. Start the preview process with PM2

The preview process needs three env vars:

- `PORT=3001` — different from the main site's 3000
- `BOOKS_FILE=books-invoice.json` — tells the server which JSON to load
- `CLIENT_DIST=client/dist-preview` — tells the server which built client to serve

Start it with PM2:

```bash
cd /var/www/book-picker
PORT=3001 BOOKS_FILE=books-invoice.json CLIENT_DIST=client/dist-preview \
  pm2 start server/index.mjs --name book-picker-preview
pm2 save
```

Verify:

```bash
curl http://localhost:3001/api/health
# {"status":"ok","booksFile":"books-invoice.json"}
```

Note: the preview process writes to the same SQLite file as the main app
(`server/db/app.db` or wherever the schema initializes it). This is harmless —
the preview site never calls any admin or selections endpoint. If you want total
isolation, set `DATA_DIR` to a separate directory and copy the data files there.

## 5. NGINX server block

Create `/etc/nginx/sites-available/book-picker-preview`:

```nginx
server {
    listen 80;
    server_name preview-books.example.com;

    # No auth_basic — this site is intentionally public

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/book-picker-preview /etc/nginx/sites-enabled/
sudo nginx -t && sudo nginx -s reload
```

## 6. HTTPS with Certbot

```bash
sudo certbot --nginx -d preview-books.example.com
```

## 7. Smoke test

From your laptop:

```bash
curl -sI https://preview-books.example.com/ | head -1
# HTTP/2 200
curl -s https://preview-books.example.com/api/books | head -c 200
```

Then open `https://preview-books.example.com/` in a browser and verify:

1. Loads directly on the browsing grid (no teacher setup screen)
2. Shows the invoice books
3. No "picked" counter, no pick buttons, no done button
4. Book preview dialog still opens and flips pages

## Updating the preview site after a new invoice

```bash
# Locally:
# 1. Edit scraper/invoice-isbns.json with the new ISBNs
# 2. Re-scrape
npm run scrape:invoice
# 3. Rebuild only if client code changed
npm run build:preview

# Transfer:
rsync -avz data/books-invoice.json user@droplet:/var/www/book-picker/data/
rsync -avz data/images-invoice/ user@droplet:/var/www/book-picker/data/images-invoice/
rsync -avz client/dist-preview/ user@droplet:/var/www/book-picker/client/dist-preview/  # only if rebuilt

# On the droplet:
pm2 restart book-picker-preview
```

## Useful PM2 commands

```bash
pm2 status
pm2 logs book-picker-preview
pm2 restart book-picker-preview
pm2 stop book-picker-preview
pm2 delete book-picker-preview    # remove entirely
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/deploy-preview-digitalocean.md
git commit -m "Add teacher preview deployment documentation"
```

---

## Task 13: Push the branch

**Files:** none

- [ ] **Step 1: Push to origin**

```bash
git push -u origin teacher-preview
```

- [ ] **Step 2: Confirm**

```bash
git log --oneline main..teacher-preview
```
Expected: a tidy list of ~12 commits matching the tasks above.

---

## Acceptance Recap

Against the spec's acceptance criteria:

1. ✅ `npm run scrape:invoice` produces `data/books-invoice.json` — **Task 5**
2. ✅ `npm run build:preview` produces `client/dist-preview/` with no admin code — **Task 9 step 5**
3. ✅ Preview `/` lands on browse — **Task 7 AppPreview redirect**
4. ✅ No counter / pick buttons / done button — **Task 8**
5. ✅ Book preview carousel still works — **Task 8 leaves it intact**
6. ✅ `/admin/*` redirects to `/browse` — **Task 7 wildcard route**
7. ✅ Main app unchanged — **Task 11 step 4 regression check**
8. ✅ `docs/deploy-preview-digitalocean.md` exists — **Task 12**
