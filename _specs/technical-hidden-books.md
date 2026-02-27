---
type: technical
status: implemented
created: 2026-02-27
depends-on: feature-hidden-books
---

# Hidden Books Flag — Technical Spec

## 1. Overview

Implementation plan for adding a `hidden: true` flag to books without interior images. Covers the one-off script, server API changes, scraper update, and admin UI modifications.

---

## 2. Files to Modify

| File | Change |
|------|--------|
| `scripts/flag-hidden-books.mjs` | **New** — one-off script to patch `books.json` |
| `package.json` | Add `flag-hidden` npm script |
| `server/routes/books.mjs` | Filter hidden books from student endpoint; expose flag in admin endpoint |
| `scraper/lib/download-images.mjs` | Set `hidden: true` in `generateBooksJson` |
| `client/src/components/AdminBookCard.jsx` | Add "Hidden" badge |
| `client/src/components/AdminBookCard.module.css` | Add `.badgeHidden` style |
| `client/src/screens/ManageBooks.jsx` | Add "Show Hidden" toggle, update stats and filter logic |

---

## 3. Implementation Steps

### Step 1: Create `scripts/flag-hidden-books.mjs`

Reads `data/books.json`, adds `hidden: true` to books with `interiorImages.length === 0`, removes `hidden` from books that have interior images (idempotent). Writes the file back and logs a summary.

Add to root `package.json` scripts: `"flag-hidden": "node scripts/flag-hidden-books.mjs"`

Run the script immediately after creating it.

### Step 2: Update `server/routes/books.mjs`

**`GET /` (line 13)** — add `!b.hidden` to filter:

```js
const activeBooks = books.filter((b) => !deletedIds.has(b.id) && !b.hidden);
```

**`GET /all` (lines 27-41)** — add `hidden` to mapped object, add `totalHidden` to response:

```js
const allBooks = books.map((b) => ({
  id: b.id,
  title: b.title,
  coverImage: b.coverImage,
  deleted: deletedIds.has(b.id),
  hidden: b.hidden || false,
}));

const totalDeleted = allBooks.filter((b) => b.deleted).length;
const totalHidden = allBooks.filter((b) => b.hidden).length;

res.json({
  books: allBooks,
  totalActive: allBooks.filter((b) => !b.deleted && !b.hidden).length,
  totalDeleted,
  totalHidden,
  totalAll: allBooks.length,
});
```

### Step 3: Update scraper `generateBooksJson`

In `scraper/lib/download-images.mjs` (lines 111-116), add `hidden: true` when `interiorImages` is empty:

```js
const entry = {
  id: book.id,
  title: book.title,
  coverImage: `images/${book.id}/cover.webp`,
  interiorImages,
};
if (interiorImages.length === 0) {
  entry.hidden = true;
}
return entry;
```

### Step 4: Update admin UI

**`AdminBookCard.jsx`** — add hidden badge after deleted badge:

```jsx
{book.hidden && <span className={styles.badgeHidden}>Hidden</span>}
```

**`AdminBookCard.module.css`** — add amber badge style:

```css
.badgeHidden {
  font-size: 12px;
  font-weight: 700;
  color: #e65100;
  background: #fff3e0;
  padding: 2px 8px;
  border-radius: 8px;
  flex-shrink: 0;
}
```

**`ManageBooks.jsx`:**
- Add `showHidden` state (default `false`)
- Add `totalHidden: 0` to initial stats state, populate from API response
- Update filter logic — `showDeleted`, `showHidden`, and default are mutually exclusive:
  - `showDeleted` → `b.deleted`
  - `showHidden` → `b.hidden && !b.deleted`
  - default → `!b.deleted && !b.hidden`
- Turning on one toggle turns off the other
- Add "Show Hidden" checkbox toggle in the controls area
- Show hidden count in status bar
- Hide Delete/Restore buttons when viewing hidden books

---

## 4. Verification

1. Run `npm run flag-hidden` — confirms ~1,576 books flagged
2. Run `npm run dev`
3. `curl localhost:3001/api/books | jq '.total'` — count should exclude hidden books
4. `curl localhost:3001/api/books/all | jq '{totalActive, totalDeleted, totalHidden, totalAll}'` — verify counts
5. Open `/admin/books` — verify "Show Hidden" toggle works, badges display correctly, status bar shows hidden count
