const API_BASE = 'https://api.bookmanager.com/customer';
const CB = '7603827';
const STORE_ID = '168749';

// Browse filters — values are sent as JSON arrays to the API
const FILTER_SUBJECTS = ['fic','juv','jnf','juv039','juv002','juv013','juv019','juv011','juv051','juv017','juv001','jnf071','jnf003','juv010','jnf007','juv081','juv006','juv048','juv089','juv050','juv009','juv074','juv082','juv083','juv060','juv077','juv031','juv030','juv056','juv035','jnf051'];
const FILTER_DATES = ['2020z01z01','2021z01z01','2022z01z01','2023z01z01','2024z01z01','2025z01z01','2025z02z01','2025z03z01','2025z04z01','2025z05z01','2025z06z01','2025z07z01','2025z08z01','2025z09z01','2025z10z01','2025z11z01','2025z12z01','2026z01z01','2026z02z01','2026z03z01','2026z04z01'];
const FILTER_AGE = 'a4to6';
const FILTER_SORT = '0xy';
const FILTER_LANG = 'en';

function makeFormData(params) {
  const fd = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    fd.append(k, v);
  }
  return fd;
}

function uuid() {
  return crypto.randomUUID();
}

export async function getSession() {
  const res = await fetch(`${API_BASE}/session/get?_cb=${CB}`, {
    method: 'POST',
    body: makeFormData({ uuid: uuid(), store_id: STORE_ID }),
  });
  if (!res.ok) throw new Error(`Session request failed: ${res.status}`);
  const data = await res.json();
  return data.session_id;
}

export async function fetchBrowsePage(sessionId, offset = 0, limit = 100) {
  const res = await fetch(`${API_BASE}/browse/get?_cb=${CB}`, {
    method: 'POST',
    body: makeFormData({
      uuid: uuid(),
      session_id: sessionId,
      store_id: STORE_ID,
      b: '[]',
      s: JSON.stringify(FILTER_SUBJECTS),
      n: '[]',
      d: JSON.stringify(FILTER_DATES),
      f: '[]',
      a: JSON.stringify([FILTER_AGE]),
      o: String(offset),
      l: String(limit),
      t: '',
      k: '',
      v: '',
      x: '',
      r: JSON.stringify([FILTER_SORT]),
      c: '[]',
      g: JSON.stringify([FILTER_LANG]),
      j: '[]',
    }),
  });
  if (!res.ok) throw new Error(`Browse request failed: ${res.status}`);
  return res.json();
}

/**
 * Look up a book by its 13-digit ISBN. The BookManager browse endpoint's
 * `t` param is a full-text search that also matches ISBNs, so we use it as
 * an ISBN→eisbn resolver with l=5 (usually returns one exact hit).
 * Returns the raw first row whose `isbn` matches exactly, or null.
 */
export async function searchByIsbn(sessionId, isbn) {
  const res = await fetch(`${API_BASE}/browse/get?_cb=${CB}`, {
    method: 'POST',
    body: makeFormData({
      uuid: uuid(),
      session_id: sessionId,
      store_id: STORE_ID,
      b: '[]',
      s: '[]',
      n: '[]',
      d: '[]',
      f: '[]',
      a: '[]',
      o: '0',
      l: '5',
      t: isbn,
      k: '',
      v: '',
      x: '',
      r: '[]',
      c: '[]',
      g: '[]',
      j: '[]',
    }),
  });
  if (!res.ok) throw new Error(`Search request failed: ${res.status}`);
  const data = await res.json();
  const rows = data.rows || [];
  return rows.find((r) => r.isbn === isbn || r.eisbn === isbn) || rows[0] || null;
}

export async function fetchBookDetail(sessionId, eisbn) {
  const res = await fetch(`${API_BASE}/title/getItem?_cb=${CB}`, {
    method: 'POST',
    body: makeFormData({
      uuid: uuid(),
      session_id: sessionId,
      store_id: STORE_ID,
      eisbn,
    }),
  });
  if (!res.ok) throw new Error(`Detail request failed: ${res.status}`);
  return res.json();
}

export function coverUrl(eisbn, cache) {
  return `https://cdn1.bookmanager.com/i/m?b=${eisbn}&cb=${cache}`;
}

export function interiorUrl(eisbn, key, cb, b2b) {
  let url = `https://cdn1.bookmanager.com/i/m?b=${eisbn}&imgp=${key}&cb=${cb}`;
  if (b2b) url += `&b2b=${b2b}`;
  return url;
}
