---
type: technical
status: draft
created: 2026-03-01
depends-on: feature-scraper-v2
---

# Scraper V2 — Technical Spec

## 1. Overview

This spec describes the implementation changes needed to re-run the scraper against a filtered source URL and capture additional metadata (author, audience, subjects) in the output. It covers API parameter mapping, pipeline changes, and the final `books.json` output shape.

---

## 2. Current State

The scraper is a 4-phase Node.js pipeline in `scraper/` that makes direct HTTP calls to the BookManager API (no Playwright at runtime):

| Phase | File | What it does |
| ----- | ---- | ------------ |
| 1 — Discover | `lib/discover-api.mjs` | Gets a `session_id` from `session/get` |
| 2 — List | `lib/fetch-books.mjs` | Paginates `browse/get` (100 books/page), parses each row via `parseBook()` |
| 3 — Details | `lib/fetch-detail.mjs` | Calls `title/getItem` per book for interior images |
| 4 — Images | `lib/download-images.mjs` | Downloads cover + interiors, converts to WebP, generates `books.json` |

**Key finding:** Phase 2's `parseBook()` (fetch-books.mjs:91-106) already extracts `authors` and `audience` from the API response and stores them in the scraper state. Phase 4's `generateBooksJson()` (download-images.mjs:111-116) discards them when building the final output — it only writes `id`, `title`, `coverImage`, `interiorImages`, dimensions, and `hidden`.

**Current browse API call** (api.mjs:27-43):

```js
fetchBrowsePage(sessionId, offset, limit = 100)
// POST https://api.bookmanager.com/customer/browse/get?_cb=7603827
// Body: uuid, session_id, store_id, o, l, t: 'filter', a: 'a4to6', k: ''
```

Only `a: 'a4to6'` is sent as a filter. No subject, date, or language params.

---

## 3. Implementation Steps

### Step 1: Investigate API Parameters

**Goal:** Answer three open questions before writing production code.

Write a throwaway script `scraper/investigate.mjs` (not committed) that:

1. Gets a session via existing `getSession()`
2. Makes a `browse/get` call with all filter params and logs `max_offset` + full first row
3. Makes a `title/getItem` call for one book and logs the full response

```js
// scraper/investigate.mjs (throwaway, not committed)
import { getSession, fetchBookDetail } from './lib/api.mjs';

const sessionId = await getSession();

// Test browse/get with new filters
const params = new URLSearchParams({
  uuid: crypto.randomUUID(),
  session_id: sessionId,
  store_id: '168749',
  o: '0',
  l: '5',
  t: 'filter',
  a: 'a4to6',
  s: 'fic/juv/jnf/juv039/juv002/juv013/juv019/juv011/juv051/juv017/juv001/jnf071/jnf003/juv010/jnf007/juv081/juv006/juv048/juv089/juv050/juv009/juv074/juv082/juv083/juv060/juv077/juv031/juv030/juv056/juv035/jnf051',
  d: '2020z01z01/2021z01z01/2022z01z01/2023z01z01/2024z01z01/2025z01z01/2025z02z01/2025z03z01/2025z04z01/2025z05z01/2025z06z01/2025z07z01/2025z08z01/2025z09z01/2025z10z01/2025z11z01/2025z12z01/2026z01z01/2026z02z01/2026z03z01/2026z04z01',
  r: '0xy',
  g: 'en',
  k: '',
});

const res = await fetch(
  'https://api.bookmanager.com/customer/browse/get?_cb=7603827',
  { method: 'POST', body: params }
);
const data = await res.json();
console.log('max_offset:', data.max_offset);
console.log('Row count:', data.rows?.length);
console.log('First row (full):', JSON.stringify(data.rows?.[0], null, 2));

// Test title/getItem for subjects
if (data.rows?.[0]) {
  const eisbn = data.rows[0].eisbn;
  const detail = await fetchBookDetail(sessionId, eisbn);
  console.log('Detail response (full):', JSON.stringify(detail, null, 2));
}
```

**What to look for:**

| Question | Where to look | Expected |
| -------- | ------------- | -------- |
| Do `s`, `d`, `r`, `g` params work? | `max_offset` should be much less than 5,200 | Yes — URL prefix letters match API params (confirmed by `a: 'a4to6'` pattern) |
| Are subjects in browse response? | `data.rows[0]` — look for `subjects`, `bisac`, `categories` fields | Unknown |
| Are subjects in detail response? | Full `title/getItem` response — look for `subjects`, `bisac`, `classifications` | Likely yes |
| What format are subjects? | The field value | BISAC labels like `"JUVENILE FICTION / Animals / Marine Life"` |

**Fallback:** If the direct param approach fails, use Playwright to load the filtered URL and intercept the `browse/get` network request to capture the exact parameters the SPA sends.

---

### Step 2: Add Filter Parameters to Browse API

**File:** `scraper/lib/api.mjs`

Add filter constants after existing constants (line 3):

```js
const FILTER_SUBJECTS =
  'fic/juv/jnf/juv039/juv002/juv013/juv019/juv011/juv051/juv017/juv001/jnf071/jnf003/juv010/jnf007/juv081/juv006/juv048/juv089/juv050/juv009/juv074/juv082/juv083/juv060/juv077/juv031/juv030/juv056/juv035/jnf051';
const FILTER_DATES =
  '2020z01z01/2021z01z01/2022z01z01/2023z01z01/2024z01z01/2025z01z01/2025z02z01/2025z03z01/2025z04z01/2025z05z01/2025z06z01/2025z07z01/2025z08z01/2025z09z01/2025z10z01/2025z11z01/2025z12z01/2026z01z01/2026z02z01/2026z03z01/2026z04z01';
const FILTER_AGE = 'a4to6';
const FILTER_SORT = '0xy';
const FILTER_LANG = 'en';
```

Update `fetchBrowsePage()` body (lines 30-39) to include new params:

```js
body: makeFormData({
  uuid: uuid(),
  session_id: sessionId,
  store_id: STORE_ID,
  o: String(offset),
  l: String(limit),
  t: 'filter',
  a: FILTER_AGE,
  s: FILTER_SUBJECTS,
  d: FILTER_DATES,
  r: FILTER_SORT,
  g: FILTER_LANG,
  k: '',
}),
```

> Exact parameter names subject to Step 1 investigation results.

---

### Step 3: Add Subjects to Scraper Pipeline

Depends on Step 1 findings. Two possible paths:

**Path A (preferred) — Subjects in `browse/get` response:**

- **File:** `scraper/lib/fetch-books.mjs` (lines 91-106)
- Add `subjects` field to `parseBook()`:

```js
subjects: (row.subjects || [])
  .map((s) => s.description || s.name || s)
  .filter(Boolean),
```

**Path B — Subjects only in `title/getItem` response:**

- **File:** `scraper/lib/fetch-detail.mjs` (after line 36)
- Extract subjects alongside the existing interior image extraction:

```js
// Extract subjects from detail response
const rawSubjects = data.subjects || data.bisac || data.classifications || [];
book.subjects = rawSubjects
  .map((s) => s.description || s.name || (typeof s === 'string' ? s : null))
  .filter(Boolean);
```

Path A is preferred because it avoids adding work to the slow detail-fetching phase. Path B adds no extra API calls since we already fetch details for every book anyway.

---

### Step 4: Include New Fields in books.json Output

**File:** `scraper/lib/download-images.mjs` (lines 111-116)

Modify `generateBooksJson()` to include the three new fields:

```js
const entry = {
  id: book.id,
  title: book.title,
  authors: book.authors || '',
  audience: book.audience || '',
  subjects: book.subjects || [],
  coverImage: `images/${book.id}/cover.webp`,
  interiorImages,
};
```

`authors` and `audience` already exist on every book object in `state.bookList` (captured by `parseBook()` at fetch-books.mjs:97 and :102). They just need to be included in the output. `subjects` will be populated by Step 3.

---

### Step 5: Run Fresh Scrape

```bash
npm run scrape -- --reset
```

The `--reset` flag clears all saved state. The scraper runs all 4 phases with the new filters. The filtered dataset should be significantly smaller than 5,200 books.

---

### Step 6: Clear Database

Book IDs will change with the new dataset, so old records in `deleted_books` and `selections` are stale:

```bash
sqlite3 server/db/bookpicker.db "DELETE FROM deleted_books; DELETE FROM selections;"
```

---

## 4. Files Modified

| File | Change |
| ---- | ------ |
| `scraper/lib/api.mjs` | Add filter constants + new params (`s`, `d`, `r`, `g`) in `fetchBrowsePage()` |
| `scraper/lib/fetch-books.mjs` | Possibly add `subjects` to `parseBook()` (if in browse response) |
| `scraper/lib/fetch-detail.mjs` | Possibly extract `subjects` from detail response (if not in browse) |
| `scraper/lib/download-images.mjs` | Add `authors`, `audience`, `subjects` to `generateBooksJson()` output |
| `server/db/bookpicker.db` | Clear `deleted_books` and `selections` tables (manual SQL) |

**No server code changes needed.** `GET /api/books` in `server/routes/books.mjs` passes book objects through without transformation — new fields will appear in the API response automatically.

**Note:** `GET /api/books/all` (admin endpoint, books.mjs:22-45) explicitly maps to a limited set of fields and does NOT include the new fields. This is fine — the feature spec says UI changes are out of scope.

---

## 5. Output Shape

### Current books.json entry

```json
{
  "id": "abc123",
  "title": "Don't Trust Fish",
  "coverImage": "images/abc123/cover.webp",
  "interiorImages": ["images/abc123/page-1.webp"],
  "coverWidth": 933,
  "coverHeight": 1200
}
```

### New books.json entry

```json
{
  "id": "abc123",
  "title": "Don't Trust Fish",
  "authors": "Marissa Kiley",
  "audience": "Ages 4-6",
  "subjects": ["Juvenile Fiction", "Animals — Marine Life", "Humorous Stories"],
  "coverImage": "images/abc123/cover.webp",
  "interiorImages": ["images/abc123/page-1.webp"],
  "coverWidth": 933,
  "coverHeight": 1200
}
```

---

## 6. Verification

1. **Data check** — Open `data/books.json` and verify:
   - Total count is significantly less than 5,200
   - Every book has `authors`, `audience`, and `subjects` fields
   - `hidden: true` is set on books with no interior images

   Quick validation:

   ```bash
   node -e "
     const books = JSON.parse(require('fs').readFileSync('data/books.json','utf8'));
     console.log('Total books:', books.length);
     console.log('With authors:', books.filter(b => b.authors).length);
     console.log('With audience:', books.filter(b => b.audience).length);
     console.log('With subjects:', books.filter(b => b.subjects?.length > 0).length);
     console.log('Hidden:', books.filter(b => b.hidden).length);
     console.log('Sample:', JSON.stringify(books[0], null, 2));
   "
   ```

2. **Server check** — Start `npm run dev`, hit `GET /api/books`, verify new fields appear in response.

3. **App check** — Browse all screens (student browsing, book preview, manage books, report) to verify the app works with the new dataset.

4. **Image check** — Spot-check 5-10 book directories in `data/images/` for cover and interior WebP files.

---

## 7. Risks and Fallbacks

| Risk | Mitigation |
| ---- | ---------- |
| API param names are wrong (filters don't reduce count) | Fall back to Playwright network interception to capture exact params |
| Subjects not in either API response | Use BISAC codes from filter URL as fallback, or call a different BookManager endpoint |
| Session expiration during long scrape | Already handled — scraper retries with fresh session on 401/403 |
| `cwebp` not installed for WebP conversion | Already a requirement of the current scraper — no change |

---

## 8. Open Questions

- **Exact API parameter names for filters.** Resolved by Step 1 investigation. High confidence they match URL prefixes (`s`, `d`, `r`, `g`).
- **Source of subjects data.** Resolved by Step 1 investigation. Will determine Path A vs Path B for Step 3.
- **Subject format.** Resolved by Step 1 investigation. Likely BISAC labels that need light formatting (e.g., replace ` / ` with ` — `).
