---
type: feature
status: implemented
created: 2026-02-27
---

# Image WebP Conversion — Spec

## 1. Overview

The scraper downloads book images as JPEGs. With ~5,000 books and multiple images per book (cover + interior pages), the `data/images/` directory approaches 3 GB. This is excessive for a web app serving images to Chromebooks on a school network.

A conversion script will batch-convert all existing JPEG images to WebP format, dramatically reducing storage and bandwidth. The rest of the app (server, client, scraper output) will then be updated to reference `.webp` files instead of `.jpg`.

---

## 2. Goals

- **Reduce image storage from ~3 GB to under 1 GB** by converting all JPEGs to WebP at quality 65.
- **Process existing images in place** — no need to re-run the scraper.
- **Delete the original JPEGs** after successful conversion to reclaim disk space.
- **Update all references** so the server, client, and scraper use `.webp` going forward.

---

## 3. The Script

### What it does

A standalone shell script (`scripts/convert-images-to-webp.sh`) that:

1. Finds every `.jpg` file under `data/images/`.
2. Converts each to `.webp` at quality 65 using `cwebp` (from the `webp` package).
3. Deletes the original `.jpg` only after confirming the `.webp` was created successfully.
4. Prints a summary at the end: number of files converted, total size before/after.

### Behavior details

- **Skips already-converted files** — if a `.webp` already exists alongside the `.jpg`, skip that file. This makes the script safe to re-run (idempotent).
- **Skips if no source** — if a `.jpg` has already been deleted (only `.webp` remains), skip it.
- **Progress output** — prints progress every 500 files so the user knows it's working (the full run will process thousands of files).
- **Fails gracefully** — if `cwebp` fails on a specific file, log the error and continue with the next file. Do not halt the entire batch.
- **Prerequisite check** — the script checks that `cwebp` is installed and exits with a helpful message if it's missing (e.g., "Install with: brew install webp").

### Location and invocation

```
scripts/convert-images-to-webp.sh
```

Run from the project root:

```bash
npm run convert-images
```

(Add a convenience script to the root `package.json`.)

---

## 4. What Else Changes

After the images are converted, the rest of the codebase needs to reference `.webp` instead of `.jpg`.

### Scraper (`scraper/lib/download-images.mjs`)

- Change downloaded file extensions from `.jpg` to `.webp`.
- After downloading each JPEG from the CDN, convert it to WebP before saving (or save as JPEG then convert — either approach works).
- Update `generateBooksJson()` to output `.webp` paths in `books.json`.

### Data (`data/books.json`)

- All `coverImage` and `interiorImages` paths change from `.jpg` to `.webp`.
- The conversion script should update `books.json` automatically after converting images.

### Server

- No changes needed. The server serves `data/images/` as a static directory — it doesn't care about file extensions.

### Client

- No changes needed. The client reads image paths from the API response (`book.coverImage`, `book.interiorImages`), which come from `books.json`. Once `books.json` has `.webp` paths, the client will request `.webp` files automatically.

### Sample data (`data/books-sample.json`)

- Update mock image paths from `.jpg` to `.webp` if the placeholder images are also converted (or leave as-is if they're only used during early development).

---

## 5. Prerequisites

- **`cwebp`** command-line tool must be installed.
  - macOS: `brew install webp`
  - Ubuntu/Debian: `apt install webp`
- **Node.js** — only needed if the script also updates `books.json` (a small JSON find-and-replace step at the end of the script).

---

## 6. Expected Results

| Metric          | Before            | After (estimated)                                       |
| --------------- | ----------------- | ------------------------------------------------------- |
| Format          | JPEG              | WebP                                                    |
| Quality         | Original (varies) | 65                                                      |
| Total size      | ~3 GB             | ~600 MB - 1 GB                                          |
| File count      | Same              | Same (1:1 replacement)                                  |
| Browser support | Universal         | All modern browsers (Chrome, Firefox, Safari 14+, Edge) |

WebP at quality 65 provides a good balance between file size reduction and visual quality. For book cover thumbnails and interior page previews on a Chromebook screen, the difference from the original JPEGs will be imperceptible.
