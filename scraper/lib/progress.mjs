import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = join(__dirname, '..', 'state');
const STATE_FILE = join(STATE_DIR, 'scraper-state.json');

const DEFAULT_STATE = {
  discoveredApi: null,
  bookList: [],
  bookListComplete: false,
  detailsFetched: new Set(),
  imagesDownloaded: new Set(),
};

export function loadState() {
  if (!existsSync(STATE_FILE)) {
    return {
      ...DEFAULT_STATE,
      detailsFetched: new Set(),
      imagesDownloaded: new Set(),
    };
  }
  const raw = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
  return {
    ...raw,
    detailsFetched: new Set(raw.detailsFetched || []),
    imagesDownloaded: new Set(raw.imagesDownloaded || []),
  };
}

export function saveState(state) {
  mkdirSync(STATE_DIR, { recursive: true });
  const serializable = {
    ...state,
    detailsFetched: [...state.detailsFetched],
    imagesDownloaded: [...state.imagesDownloaded],
  };
  writeFileSync(STATE_FILE, JSON.stringify(serializable, null, 2));
}

export function resetState() {
  mkdirSync(STATE_DIR, { recursive: true });
  const serializable = {
    ...DEFAULT_STATE,
    detailsFetched: [],
    imagesDownloaded: [],
  };
  writeFileSync(STATE_FILE, JSON.stringify(serializable, null, 2));
}

export function logProgress(phase, message) {
  const timestamp = new Date().toISOString().slice(11, 19);
  console.log(`[${timestamp}] [Phase ${phase}] ${message}`);
}
