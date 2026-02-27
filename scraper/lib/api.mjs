const API_BASE = 'https://api.bookmanager.com/customer';
const CB = '7603827';
const STORE_ID = '168749';

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
      o: String(offset),
      l: String(limit),
      t: 'filter',
      a: 'a4to6',
      k: '',
    }),
  });
  if (!res.ok) throw new Error(`Browse request failed: ${res.status}`);
  return res.json();
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
