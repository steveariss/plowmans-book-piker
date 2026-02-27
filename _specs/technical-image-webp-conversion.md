---
type: technical
status: draft
created: 2026-02-27
depends-on: feature-image-webp-conversion
---

# Image WebP Conversion — Technical Spec

## 1. Overview

This spec provides the implementation details for the WebP conversion feature described in `feature-image-webp-conversion.md`. The work has two parts: (1) a batch shell script that converts all existing JPEG images to WebP and updates `books.json`, and (2) changes to the scraper so future downloads produce WebP files directly.

---

## 2. The Problem

The `data/images/` directory contains ~23,741 JPEG files across ~5,196 book directories, totaling ~2.8 GB. This is excessive for a web app serving images to Chromebooks on a school network. WebP at quality 65 will reduce total storage to roughly 600 MB–1 GB with no perceptible quality loss at the display sizes used in the app.

---

## 3. Goals

- **Convert all existing JPEGs to WebP** using a batch script that can be run once and re-run safely.
- **Update `books.json`** so all image paths reference `.webp` instead of `.jpg`.
- **Update the scraper** so future runs produce `.webp` files directly.
- **No changes to server or client code** — both are already extension-agnostic.

---

## 4. Proposed Solution

### 4.1 Batch Conversion Script

**New file:** `scripts/convert-images-to-webp.sh`

A Bash script that converts every `.jpg` under `data/images/` to `.webp`, deletes the originals, and updates `books.json`.

#### Prerequisites check

```bash
#!/usr/bin/env bash
set -euo pipefail

if ! command -v cwebp &> /dev/null; then
  echo "Error: cwebp is not installed."
  echo "  macOS:  brew install webp"
  echo "  Ubuntu: apt install webp"
  exit 1
fi
```

#### Core conversion loop

```bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
IMAGES_DIR="$PROJECT_ROOT/data/images"
BOOKS_JSON="$PROJECT_ROOT/data/books.json"

# Capture size before conversion
size_before=$(du -sm "$IMAGES_DIR" | cut -f1)

# Build file list
mapfile -t jpg_files < <(find "$IMAGES_DIR" -name "*.jpg" -type f)
total=${#jpg_files[@]}

if [ "$total" -eq 0 ]; then
  echo "No .jpg files found in $IMAGES_DIR. Nothing to convert."
  exit 0
fi

echo "Found $total .jpg files to process."

converted=0
skipped=0
failed=0

for i in "${!jpg_files[@]}"; do
  jpg="${jpg_files[$i]}"
  webp="${jpg%.jpg}.webp"

  # Skip if .webp already exists
  if [ -f "$webp" ]; then
    skipped=$((skipped + 1))
    # Delete leftover .jpg if .webp exists and is non-empty
    if [ -s "$webp" ]; then
      rm -f "$jpg"
    fi
    continue
  fi

  # Convert
  if cwebp -q 65 "$jpg" -o "$webp" -quiet 2>/dev/null; then
    # Verify .webp was created and is non-empty before deleting original
    if [ -s "$webp" ]; then
      rm -f "$jpg"
      converted=$((converted + 1))
    else
      echo "Warning: $webp is empty, keeping original .jpg"
      rm -f "$webp"
      failed=$((failed + 1))
    fi
  else
    echo "Error converting: $jpg"
    failed=$((failed + 1))
  fi

  # Progress every 500 files
  count=$((i + 1))
  if [ $((count % 500)) -eq 0 ] || [ "$count" -eq "$total" ]; then
    echo "Progress: $count / $total (converted: $converted, skipped: $skipped, failed: $failed)"
  fi
done
```

#### Update books.json

After conversion, replace all `.jpg` extensions with `.webp` in `books.json`:

```bash
# Update books.json: replace .jpg with .webp in image paths
if [ -f "$BOOKS_JSON" ]; then
  sed -i '' 's/\.jpg"/.webp"/g' "$BOOKS_JSON"
  echo "Updated $BOOKS_JSON: .jpg → .webp"
else
  echo "Warning: $BOOKS_JSON not found, skipping JSON update."
fi
```

Note: The `sed -i ''` syntax is macOS-specific. Since this project targets macOS development (CLAUDE.md specifies `brew install`), this is appropriate. If Linux support is needed, use `sed -i` without the empty string argument.

#### Summary

```bash
size_after=$(du -sm "$IMAGES_DIR" | cut -f1)

echo ""
echo "=== Conversion Complete ==="
echo "Files converted: $converted"
echo "Files skipped:   $skipped"
echo "Files failed:    $failed"
echo "Size before:     ${size_before} MB"
echo "Size after:      ${size_after} MB"
echo "Space saved:     $((size_before - size_after)) MB"
```

#### Full script behavior summary

| Scenario | Behavior |
|----------|----------|
| `.jpg` exists, no `.webp` | Convert, verify, delete `.jpg` |
| `.jpg` exists, `.webp` already exists | Skip conversion, delete `.jpg` if `.webp` is non-empty |
| Only `.webp` exists (no `.jpg`) | Not found by `find`, no action |
| `cwebp` fails on a file | Log error, increment `failed`, continue |
| `.webp` created but empty (0 bytes) | Delete bad `.webp`, keep `.jpg`, increment `failed` |

---

### 4.2 Scraper Changes

**File:** `scraper/lib/download-images.mjs`

The scraper downloads JPEGs from the BookManager CDN (the CDN only serves JPEGs). After downloading, convert each image to WebP before saving to its final path.

#### 4.2.1 Add `convertToWebp` helper

Add a new helper function at the top of the file (after the existing imports) that shells out to `cwebp`:

```javascript
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { coverUrl, interiorUrl } from './api.mjs';
import { logProgress, saveState } from './progress.mjs';

// ... existing constants ...

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
```

`execFileSync` is used (not `exec`) because:
- It's synchronous, matching the sequential download flow
- It avoids shell injection (no shell is spawned)
- Errors propagate naturally as exceptions

#### 4.2.2 Update `downloadAllImages` — cover download

**Before (lines 43–50):**

```javascript
      // Download cover image
      const coverPath = join(bookDir, 'cover.jpg');
      if (!existsSync(coverPath)) {
        const url = coverUrl(book.id, book.coverImageCache);
        await downloadImage(url, coverPath);
        downloadedCount++;
        await sleep(100);
      }
```

**After:**

```javascript
      // Download cover image
      const coverPath = join(bookDir, 'cover.webp');
      if (!existsSync(coverPath)) {
        const tmpPath = join(bookDir, 'cover.jpg');
        const url = coverUrl(book.id, book.coverImageCache);
        await downloadImage(url, tmpPath);
        convertToWebp(tmpPath, coverPath);
        downloadedCount++;
        await sleep(100);
      }
```

#### 4.2.3 Update `downloadAllImages` — interior pages

**Before (lines 53–62):**

```javascript
      const interiors = book.interiorImages || [];
      for (let p = 0; p < interiors.length; p++) {
        const pagePath = join(bookDir, `page-${p + 1}.jpg`);
        if (!existsSync(pagePath)) {
          const img = interiors[p];
          const url = interiorUrl(book.id, img.key, img.cb, img.b2b);
          await downloadImage(url, pagePath);
          downloadedCount++;
          await sleep(100);
        }
      }
```

**After:**

```javascript
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
```

#### 4.2.4 Update `generateBooksJson` — output paths

**Before (lines 89–105):**

```javascript
  const output = books.map((book) => {
    const interiorImages = [];
    const interiors = book.interiorImages || [];
    for (let i = 0; i < interiors.length; i++) {
      const pagePath = join(IMAGES_DIR, book.id, `page-${i + 1}.jpg`);
      if (existsSync(pagePath)) {
        interiorImages.push(`images/${book.id}/page-${i + 1}.jpg`);
      }
    }

    return {
      id: book.id,
      title: book.title,
      coverImage: `images/${book.id}/cover.jpg`,
      interiorImages,
    };
  });
```

**After:**

```javascript
  const output = books.map((book) => {
    const interiorImages = [];
    const interiors = book.interiorImages || [];
    for (let i = 0; i < interiors.length; i++) {
      const pagePath = join(IMAGES_DIR, book.id, `page-${i + 1}.webp`);
      if (existsSync(pagePath)) {
        interiorImages.push(`images/${book.id}/page-${i + 1}.webp`);
      }
    }

    return {
      id: book.id,
      title: book.title,
      coverImage: `images/${book.id}/cover.webp`,
      interiorImages,
    };
  });
```

---

### 4.3 Package.json

**File:** `package.json` (project root)

Add the `convert-images` script:

**Before:**

```json
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "cd server && node --watch index.mjs",
    "dev:client": "cd client && npx vite --port 5173",
    "build": "cd client && npx vite build",
    "start": "cd server && node index.mjs",
    "scrape": "cd scraper && node scrape.mjs",
    "lint": "eslint . --ext .js,.jsx,.mjs",
    "format": "prettier --write ."
  }
```

**After:**

```json
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "cd server && node --watch index.mjs",
    "dev:client": "cd client && npx vite --port 5173",
    "build": "cd client && npx vite build",
    "start": "cd server && node index.mjs",
    "scrape": "cd scraper && node scrape.mjs",
    "convert-images": "bash scripts/convert-images-to-webp.sh",
    "lint": "eslint . --ext .js,.jsx,.mjs",
    "format": "prettier --write ."
  }
```

---

## 5. Impact on Existing Code

| File / Area | Current | Change Needed |
|-------------|---------|---------------|
| `scraper/lib/download-images.mjs` | Saves `.jpg`, outputs `.jpg` paths in `books.json` | Save as `.webp` (download JPEG → convert → delete JPEG), output `.webp` paths |
| `data/books.json` | All paths end in `.jpg` | Updated by conversion script (`sed` replaces `.jpg` → `.webp`) |
| `package.json` | No conversion script | Add `convert-images` script entry |
| `server/index.mjs` | `express.static` serves `data/images/` | **No changes** — extension-agnostic |
| `client/src/components/BookCard.jsx` | Renders `src={/${book.coverImage}}` | **No changes** — reads path from API |
| `client/src/components/BookCarousel.jsx` | Renders `src={/${src}}` | **No changes** — reads path from API |
| `data/books-sample.json` | Uses `.png` extensions for mock images | **No changes** — sample data uses PNG placeholders from `scripts/generate-placeholders.mjs`, unrelated to production images |

---

## 6. Out of Scope

- Converting the PNG placeholder images in `data/images/mock-*` (those are dev-only, generated by `scripts/generate-placeholders.mjs`)
- Changing CDN URLs or requesting WebP directly from BookManager CDN (they serve JPEGs only)
- Re-downloading any images — this converts existing files in place
- Adding WebP support detection or `<picture>` fallbacks (all target Chromebooks support WebP natively)
- Changing the `content-type` headers on the server (Express `static` infers MIME type from file extension automatically)

---

## 7. Implementation Order

| Step | Task | Files | Commit Point |
|------|------|-------|--------------|
| 1 | Create the batch conversion shell script | `scripts/convert-images-to-webp.sh` | Yes |
| 2 | Add `convert-images` script to root package.json | `package.json` | Same commit as step 1 |
| 3 | Run `npm run convert-images` to convert all existing images | `data/images/**/*.webp`, `data/books.json` | No (data dir is gitignored) |
| 4 | Update scraper to download-then-convert to WebP | `scraper/lib/download-images.mjs` | Yes |
| 5 | Add technical spec to spec index | `_specs/README.md` | Same commit as step 4 |

---

## 8. Success Criteria

- All `.jpg` files under `data/images/` are replaced with `.webp` files (zero `.jpg` files remain).
- `data/books.json` contains only `.webp` paths — no `.jpg` references.
- `npm run dev` starts successfully and book covers + interior pages display correctly in the browser.
- The conversion script can be re-run safely with no errors and no re-conversion (idempotent).
- Running `npm run scrape` (if new books are added) produces `.webp` files directly.
- Total `data/images/` directory size is under 1 GB (down from ~2.8 GB).

---

## 9. Verification Steps

1. **Install prerequisite:**
   ```bash
   brew install webp
   cwebp -version  # confirm it's available
   ```

2. **Check current state:**
   ```bash
   du -sh data/images/          # note size before (~2.8 GB)
   find data/images -name "*.jpg" | wc -l  # note count (~23,741)
   ```

3. **Run the conversion:**
   ```bash
   npm run convert-images
   ```
   Confirm progress output appears every 500 files and a summary prints at the end.

4. **Verify no JPEGs remain:**
   ```bash
   find data/images -name "*.jpg" | wc -l  # should be 0
   find data/images -name "*.webp" | wc -l # should be ~23,741
   ```

5. **Verify books.json was updated:**
   ```bash
   grep -c '\.jpg"' data/books.json   # should be 0
   grep -c '\.webp"' data/books.json  # should be > 0
   ```

6. **Verify size reduction:**
   ```bash
   du -sh data/images/  # should be under 1 GB
   ```

7. **Test the app:**
   ```bash
   npm run dev
   ```
   - Navigate to `http://localhost:5173/browse` — confirm book covers load
   - Click a book to open the carousel — confirm interior pages load
   - Open browser DevTools Network tab — confirm image requests are `.webp` and return `200`

8. **Test idempotency:**
   ```bash
   npm run convert-images  # re-run
   ```
   Should print "No .jpg files found" and exit immediately.

9. **Test scraper changes** (optional, only if re-scraping):
   - Delete one book's images directory
   - Run `npm run scrape`
   - Verify the re-downloaded images are `.webp` (not `.jpg`)
