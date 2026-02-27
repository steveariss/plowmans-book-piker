const BASE_URL = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `Request failed: ${res.status}`);
  }

  if (res.headers.get('content-type')?.includes('text/csv')) {
    return res.blob();
  }

  return res.json();
}

export function getBooks() {
  return request('/books');
}

export function getAllBooks() {
  return request('/books/all');
}

export function deleteBooks(bookIds) {
  return request('/books/delete', {
    method: 'POST',
    body: JSON.stringify({ bookIds }),
  });
}

export function restoreBooks(bookIds) {
  return request('/books/restore', {
    method: 'POST',
    body: JSON.stringify({ bookIds }),
  });
}

export function saveSelections(studentName, books) {
  return request('/selections', {
    method: 'POST',
    body: JSON.stringify({ studentName, books }),
  });
}

export function getSelections() {
  return request('/selections');
}

export function downloadSelectionsCSV() {
  return request('/selections/csv');
}

export function clearSelections() {
  return request('/selections', { method: 'DELETE' });
}
