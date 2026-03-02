import { writeFileSync, mkdirSync, existsSync, unlinkSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { coverUrl, interiorUrl } from './api.mjs';
import { logProgress, saveState } from './progress.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data');
const IMAGES_DIR = join(DATA_DIR, 'images');

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

export async function downloadAllImages(state) {
  const books = state.bookList;
  const needsDownload = books.filter((b) => !state.imagesDownloaded.has(b.id));

  if (needsDownload.length === 0) {
    logProgress(4, 'All images already downloaded, skipping.');
    return;
  }

  logProgress(4, `Downloading images for ${needsDownload.length} books...`);
  let downloadedCount = 0;

  for (let i = 0; i < needsDownload.length; i++) {
    const book = needsDownload[i];
    const bookDir = join(IMAGES_DIR, book.id);
    mkdirSync(bookDir, { recursive: true });

    try {
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

      // Download interior images (if detail phase populated them)
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

      if ((i + 1) % 25 === 0 || i === needsDownload.length - 1) {
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

export function generateBooksJson(state) {
  // Deduplicate by ID (API pages may overlap at boundaries)
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
      const pagePath = join(IMAGES_DIR, book.id, `page-${i + 1}.webp`);
      if (existsSync(pagePath)) {
        interiorImages.push(`images/${book.id}/page-${i + 1}.webp`);
      }
    }

    const entry = {
      id: book.id,
      title: book.title,
      coverImage: `images/${book.id}/cover.webp`,
      interiorImages,
    };

    // Capture cover dimensions from WebP header
    const coverPath = join(IMAGES_DIR, book.id, 'cover.webp');
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

  const outputPath = join(DATA_DIR, 'books.json');
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  logProgress(4, `Generated books.json with ${output.length} books at ${outputPath}`);
}
