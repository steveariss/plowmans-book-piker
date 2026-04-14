# Teacher Preview Build — Design

**Status:** Draft
**Date:** 2026-04-14
**Branch:** `teacher-preview` (off `main`)

## Goal

Ship a second public build of Book Picker whose sole purpose is letting teachers browse the set of new books arriving at the library. It reuses the existing book browsing UI but strips out everything related to student identity and book selection, and is backed by a separate dataset scraped from a purchase invoice.

## Scope

In scope:

1. Parsing a book list from `data/book-invoice.pdf` (95 ISBNs) and subtracting the 19 titles already picked in `data/student-book-selections.csv`
2. Scraping book detail + images for the remaining ISBNs into a separate dataset
3. A new "preview" build of the React app that skips teacher setup, admin, and selection
4. Serving the preview build as a separate, public (no auth) nginx site on Digital Ocean
5. Updated deployment documentation for the new site

Out of scope: any changes to the main student-facing app, its data, its deployment, or its nginx configuration.

## Data Pipeline

### Invoice ISBN list

The PDF invoice lists 95 line items, each with an ISBN in the first column. ISBNs will be **hand-transcribed** from the PDF into a source file — no OCR, no title matching, no fuzzy logic. This is the single source of truth for the preview dataset.

File: `scraper/invoice-isbns.json`

```json
{
  "isbns": ["9781419768552", "9781615834427", ...],
  "skip": ["9781778574276", ...],
  "notes": "ISBNs hand-transcribed from data/book-invoice.pdf. 'skip' lists ISBNs of titles present in data/student-book-selections.csv and must be excluded from the preview build."
}
```

The 19 `skip` ISBNs are determined once by matching CSV titles against invoice titles using the PDF (both documents are authoritative). Result: ~76 ISBNs to scrape.

### Scraper entry point

New file: `scraper/scrape-invoice.mjs`

Reuses the existing library code:

- `lib/api.mjs` — `getSession()`, `fetchBookDetail(sessionId, isbn)` (already exists at `scraper/lib/api.mjs:63`)
- `lib/fetch-detail.mjs` — existing detail parser
- `lib/download-images.mjs` — existing image downloader
- `lib/progress.mjs` — existing progress/resume tracker

Flow:

1. Read `scraper/invoice-isbns.json`, compute `isbns - skip`
2. `getSession()`
3. For each ISBN: `fetchBookDetail` → parse → download cover + interior pages
4. Write all records to `data/books-invoice.json` (same schema as `data/books.json`)
5. Save images to `data/images-invoice/{id}/...`
6. Resume support via a new state file `scraper/state/invoice-progress.json`

Rate limiting matches the existing scraper (1–2s between detail calls, 100ms between image downloads).

No changes to the existing `scrape.mjs` or any of the browse/pagination code.

New npm script at the root: `npm run scrape:invoice`.

### Why ISBN-first

The existing `books.json` (973 books) was scraped from the age 4–6 browse filter and does not contain most invoice titles (verified by direct substring search — "Different Pond", "Milo Imagines the World", "Captain Underpants", "Dim Sum Palace", "Persian Passover" and 58 others return zero matches). Title-based matching also struggles with the PDF's truncation. ISBNs are unique, unambiguous, and already a first-class input to `fetchBookDetail`, so we bypass title matching entirely.

## Frontend: Preview Mode

### Build flag

Vite environment variable `VITE_APP_MODE` with values `default` (the existing student app) and `preview` (the teacher preview).

- `.env` (default): `VITE_APP_MODE=default`
- `.env.preview`: `VITE_APP_MODE=preview`
- New script: `npm run build:preview` → `vite build --mode preview --outDir dist-preview`
- Development: `npm run dev:preview` for local testing

A tiny module `client/src/config.js` exports `export const APP_MODE = import.meta.env.VITE_APP_MODE ?? 'default'` and `export const IS_PREVIEW = APP_MODE === 'preview'`. Components read from this module rather than touching `import.meta.env` directly, so the flag can be stubbed in tests and there is one place to change the mechanism later.

### Routing

`App.jsx` returns a different route set based on `IS_PREVIEW`:

- **default** (unchanged): `/` → TeacherSetup, `/browse`, `/thanks`, `/admin/books`, `/admin/report`
- **preview**: `/` → `<Navigate to="/browse" replace />`, `/browse` → BookBrowsing. No other routes registered.

In preview mode, visiting `/admin/*` or `/thanks` falls through to a simple 404/redirect to `/browse`. No admin code is imported in the preview build (tree-shaken by mode-conditional imports or by keeping those imports behind a dynamic gate — see Implementation Notes).

### Selection UI removal

In preview mode, the following components render `null` (or are not rendered by their parents):

- `SelectionCounter` — "0 of 2 picked" badge
- `PickButton` — both the one inside shelf cards and the one inside the book preview dialog
- `DoneButton` — floating submit button
- `Confetti` — tied to submission, not needed

`BookBrowsing.jsx` reads `IS_PREVIEW` and:

- Does not initialize selection state
- Does not render the counter or done button
- Passes `showPickButton={!IS_PREVIEW}` (or equivalent) to shelf cards and the preview dialog
- Does not wire any `POST /api/selections` handler

The book preview dialog (carousel) **stays** — teachers need to flip through covers and interior pages. It just loses the Pick action inside it.

### Styling

No new CSS files. Existing components either stop rendering their pick-related elements or keep their current styles. If removing `DoneButton` leaves awkward bottom padding in `BookBrowsing`, adjust the module CSS with a preview-mode class; otherwise leave the layout alone.

## Backend

Single new server env var: `BOOKS_FILE` (default `books.json`).

In `server/index.mjs` (or wherever the book data is loaded at startup), replace the hardcoded path with `process.env.BOOKS_FILE ?? 'books.json'`, resolved against `data/`. Preview deployment sets `BOOKS_FILE=books-invoice.json`.

Images: the server already serves `data/images/` as static. Add a second static mount for `data/images-invoice/` at the same URL path `/images` **when** `BOOKS_FILE` is the invoice file — or simpler, always mount both and let the JSON's image paths pick. The preview `books-invoice.json` will reference `images-invoice/{id}/cover.webp` paths so there is no collision.

No changes to API endpoints. `/api/books` still returns the in-memory list. The preview deployment will never call `/api/selections`, `/api/books/delete`, or admin endpoints, but leaving those registered is harmless.

**Deleted-books table:** the SQLite `deleted_books` table is keyed by book ID. For the preview deployment, the SQLite DB will be a fresh empty file in its own data directory, so no hidden state from the student app leaks through.

## Deployment

Two independent Digital Ocean deployments sharing the same droplet or on separate droplets (owner's choice — doc covers both). The existing main site (password-protected) is untouched.

### New site: `preview-books.example.com`

- Its own nginx server block, no HTTP basic auth (publicly accessible)
- Its own Node process running `server/index.mjs` on a different port (e.g. 3001) with:
  - `BOOKS_FILE=books-invoice.json`
  - `DB_FILE=data/preview.db` (so selections/deleted-books state is isolated from the main app)
  - `PORT=3001`
- Serves the preview build from `client/dist-preview/`
- Same PM2/systemd pattern as the main deployment, different service name

### New doc: `docs/deploy-preview-digitalocean.md`

A sibling to `docs/deploy-digitalocean.md`. Covers:

1. Building the preview bundle locally (`npm run build:preview`)
2. Running the scraper to generate `data/books-invoice.json` + `data/images-invoice/`
3. Rsync of the preview build and the invoice data to the droplet
4. nginx server block for the new site (no auth, HTTPS via certbot)
5. PM2 (or systemd) entry for the second Node process with `BOOKS_FILE` and `DB_FILE` env vars
6. DNS cutover
7. How to re-deploy after future invoice updates

The existing `docs/deploy-digitalocean.md` stays unchanged.

## Implementation Notes

- **Tree-shaking admin code from the preview bundle:** the cleanest way is to make the admin/TeacherSetup imports conditional at the top of `App.jsx`:

  ```js
  import { IS_PREVIEW } from './config.js';
  // Static imports only for preview-safe screens
  import BookBrowsing from './screens/BookBrowsing.jsx';

  // Default-only imports gated behind the flag
  const TeacherSetup = !IS_PREVIEW ? (await import('./screens/TeacherSetup.jsx')).default : null;
  ```

  Vite will fold `IS_PREVIEW` to a literal at build time via `define`, letting Rollup drop the other branch. If dynamic imports complicate the component tree, a simpler approach is separate top-level `AppDefault.jsx` / `AppPreview.jsx` files picked in `main.jsx` — easier to reason about and still tree-shakes.

- **Environment variable injection:** `vite build --mode preview` reads `.env.preview` automatically. No extra config needed.

- **Image path consistency:** the preview scraper must write image paths relative to the data directory as `images-invoice/{id}/...` (not `images/...`) so the server can serve both datasets from one droplet without collision.

- **Testing the preview build locally:** `npm run dev:preview` (Vite dev with `--mode preview`) plus `BOOKS_FILE=books-invoice.json npm run dev:server` on a different port. The existing Vite proxy rewrite needs a small tweak or a second proxy target.

## Acceptance Criteria

1. `npm run scrape:invoice` produces `data/books-invoice.json` with ~76 entries and matching images under `data/images-invoice/`, resumable on interruption.
2. `npm run build:preview` produces `client/dist-preview/` with no admin/teacher-setup code in the output bundle (verified by grepping the built JS).
3. Loading the preview site at `/` immediately lands on the browsing grid — no teacher name screen.
4. Browsing grid shows the invoice books. No "0 of 2 picked" counter visible anywhere. No "Pick" button on shelf cards or inside the preview dialog. No floating Done button.
5. Book preview dialog still opens, carousel still flips through cover + interior pages.
6. Navigating to `/admin/books` or `/thanks` in the preview build redirects to `/browse`.
7. The main student app (`npm run dev` / existing deployment) is unchanged: teacher setup, selection flow, admin, and report all work as before.
8. `docs/deploy-preview-digitalocean.md` exists and fully describes the new deployment so another person could replicate it without asking questions.

## Open Questions

None blocking. Flagged for later:

- Whether to share the droplet with the main site or provision a second one — decided at deploy time based on resource usage; the doc will cover both.
- Domain name for the preview site — owner will pick at deployment time.
