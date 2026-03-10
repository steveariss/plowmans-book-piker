import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');

function getImageDimensions(filePath) {
  const buf = readFileSync(filePath);
  const ext = extname(filePath).toLowerCase();

  if (ext === '.png') {
    // IHDR chunk: width at bytes 16-19, height at bytes 20-23 (big-endian)
    return {
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20),
    };
  }

  if (ext === '.webp') {
    // VP8 (lossy)
    const vp8Start = buf.indexOf('VP8 ');
    if (vp8Start >= 0) {
      return {
        width: buf.readUInt16LE(vp8Start + 14) & 0x3fff,
        height: buf.readUInt16LE(vp8Start + 16) & 0x3fff,
      };
    }

    // VP8L (lossless)
    const vp8lStart = buf.indexOf('VP8L');
    if (vp8lStart >= 0) {
      const signature = buf.readUInt32LE(vp8lStart + 9);
      return {
        width: (signature & 0x3fff) + 1,
        height: ((signature >> 14) & 0x3fff) + 1,
      };
    }
  }

  return null;
}

function processBookFile(jsonPath) {
  if (!existsSync(jsonPath)) return;
  const books = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  let updated = 0;

  for (const book of books) {
    const coverPath = join(dataDir, book.coverImage);
    if (existsSync(coverPath)) {
      const dims = getImageDimensions(coverPath);
      if (dims) {
        book.coverWidth = dims.width;
        book.coverHeight = dims.height;
        updated++;
      }
    }
  }

  writeFileSync(jsonPath, JSON.stringify(books, null, 2));
  console.log(`Updated ${updated} of ${books.length} books in ${jsonPath}`);
}

processBookFile(join(dataDir, 'books-sample.json'));
processBookFile(join(dataDir, 'books.json'));
