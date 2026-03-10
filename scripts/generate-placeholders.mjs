import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'data');

const books = JSON.parse(readFileSync(join(dataDir, 'books-sample.json'), 'utf-8'));

/**
 * Generate a valid PNG image buffer with a solid color and simple text.
 * Pure Node.js — no external dependencies (uses built-in zlib).
 */
function createPNG(width, height, r, g, b) {
  // Build raw pixel data: each row starts with a filter byte (0 = None)
  const rawData = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 3 + 1);
    rawData[rowOffset] = 0; // filter byte
    for (let x = 0; x < width; x++) {
      const px = rowOffset + 1 + x * 3;
      rawData[px] = r;
      rawData[px + 1] = g;
      rawData[px + 2] = b;
    }
  }

  const compressed = deflateSync(rawData);

  // PNG file structure
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type (RGB)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  // IDAT chunk
  const idat = makeChunk('IDAT', compressed);

  // IEND chunk
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

const coverColors = [
  [233, 30, 99],   // pink
  [156, 39, 176],  // purple
  [103, 58, 183],  // deep purple
  [63, 81, 181],   // indigo
  [33, 150, 243],  // blue
  [0, 188, 212],   // cyan
  [0, 150, 136],   // teal
  [76, 175, 80],   // green
  [139, 195, 74],  // light green
  [255, 152, 0],   // orange
  [255, 87, 34],   // deep orange
  [121, 85, 72],   // brown
  [96, 125, 139],  // blue grey
  [244, 67, 54],   // red
  [233, 30, 99],   // pink
  [156, 39, 176],  // purple
  [103, 58, 183],  // deep purple
  [63, 81, 181],   // indigo
  [33, 150, 243],  // blue
  [0, 188, 212],   // cyan
];

const interiorColor = [144, 164, 174];

for (let i = 0; i < books.length; i++) {
  const book = books[i];
  const bookDir = join(dataDir, 'images', book.id);
  mkdirSync(bookDir, { recursive: true });

  const [r, g, b] = coverColors[i % coverColors.length];

  // Vary cover dimensions to test different aspect ratios
  const bookNum = parseInt(book.id.replace('mock-', ''), 10);
  let coverW = 300, coverH = 400; // default portrait 3:4
  if (bookNum === 11 || bookNum === 12) { coverW = 400; coverH = 400; } // square (board books)
  else if (bookNum === 13 || bookNum === 14) { coverW = 500; coverH = 350; } // landscape
  else if (bookNum === 15) { coverW = 250; coverH = 450; } // tall/narrow

  const coverPng = createPNG(coverW, coverH, r, g, b);
  writeFileSync(join(bookDir, 'cover.png'), coverPng);

  for (let p = 0; p < book.interiorImages.length; p++) {
    const pagePng = createPNG(400, 300, ...interiorColor);
    writeFileSync(join(bookDir, `page-${p + 1}.png`), pagePng);
  }
}

console.log(`Generated placeholder images for ${books.length} books.`);
