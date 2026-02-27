import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'data');

const books = JSON.parse(readFileSync(join(dataDir, 'books-sample.json'), 'utf-8'));

// Generate a minimal valid JPEG placeholder (colored SVG converted to a simple colored rectangle)
// We'll use a simple SVG approach since we just need visual placeholders
function createPlaceholderSVG(text, color, width = 300, height = 400) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${color}" rx="8"/>
  <text x="50%" y="45%" text-anchor="middle" fill="white" font-family="sans-serif" font-size="20" font-weight="bold">
    ${text.length > 25 ? text.substring(0, 22) + '...' : text}
  </text>
  <text x="50%" y="55%" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="sans-serif" font-size="14">
    PLACEHOLDER
  </text>
</svg>`;
}

const coverColors = [
  '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3',
  '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#FF9800',
  '#FF5722', '#795548', '#607D8B', '#F44336', '#E91E63',
  '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#00BCD4',
];

const interiorColor = '#90A4AE';

for (let i = 0; i < books.length; i++) {
  const book = books[i];
  const bookDir = join(dataDir, 'images', book.id);
  mkdirSync(bookDir, { recursive: true });

  // Cover image (SVG saved as .jpg extension for compatibility — server will serve it fine)
  const coverSVG = createPlaceholderSVG(book.title, coverColors[i % coverColors.length]);
  writeFileSync(join(bookDir, 'cover.jpg'), coverSVG);

  // Interior page images
  for (let p = 0; p < book.interiorImages.length; p++) {
    const pageSVG = createPlaceholderSVG(`Page ${p + 1}`, interiorColor, 400, 300);
    writeFileSync(join(bookDir, `page-${p + 1}.jpg`), pageSVG);
  }
}

console.log(`Generated placeholder images for ${books.length} books.`);
