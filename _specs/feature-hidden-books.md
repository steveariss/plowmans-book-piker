---
type: feature
status: implemented
created: 2026-02-27
depends-on: technical-book-picker
---

# Hidden Books Flag — Feature Spec

## 1. Overview

Add a `hidden: true` property to book objects in `data/books.json` for books that have no interior images. These books are excluded from the student browsing view by default but remain visible and filterable in the admin interface.

---

## 2. The Problem

Approximately 1,576 of ~5,196 scraped books have no interior images (empty `interiorImages` array). These books offer a poor browsing experience for students since there's nothing to preview beyond the cover. They should be hidden from the student-facing grid without being permanently deleted from the data.

---

## 3. Goals

- **Flag books without interior images.** Any book with `interiorImages.length === 0` gets `hidden: true` in `books.json`.
- **Exclude hidden books from student browsing.** `GET /api/books` filters them out alongside deleted books.
- **Expose hidden status in admin.** `GET /api/books/all` includes the `hidden` flag and a `totalHidden` count.
- **Let teachers view hidden books.** A "Show Hidden" toggle in ManageBooks, similar to the existing "Show Deleted" toggle.
- **Automate for future scrapes.** The scraper sets the flag automatically when generating `books.json`.

---

## 4. Proposed Solution

### Data format

Books without interior images get a `hidden: true` property. Books with interior images have no `hidden` property (absence means not hidden). This keeps the JSON clean.

```json
{
  "id": "abc123",
  "title": "Some Book",
  "coverImage": "images/abc123/cover.webp",
  "interiorImages": [],
  "hidden": true
}
```

### One-off script

A Node script (`scripts/flag-hidden-books.mjs`) patches the existing `books.json`. It's idempotent — running it again removes `hidden` from books that now have interior images and adds it to books that don't. Available via `npm run flag-hidden`.

### API changes

- `GET /api/books` — adds `&& !b.hidden` to the existing filter (one-line change)
- `GET /api/books/all` — includes `hidden: b.hidden || false` on each book and adds `totalHidden` to the response summary. `totalActive` is computed as books that are neither deleted nor hidden.

### Admin UI

- **AdminBookCard** — shows an amber "Hidden" badge (similar to the red "Deleted" badge)
- **ManageBooks** — adds a "Show Hidden" toggle, mutually exclusive with "Show Deleted". When viewing hidden books, the Delete/Restore action buttons are not shown since the hidden status is data-driven, not a teacher action.

### Scraper

The `generateBooksJson` function in `scraper/lib/download-images.mjs` sets `hidden: true` on books with empty `interiorImages` arrays, so future scraper runs produce correctly flagged data.

---

## 5. Impact on Existing Screens

| Screen / Area | Current behaviour | Change needed |
|---------------|-------------------|---------------|
| Student browse (`/browse`) | Shows all non-deleted books | Also excludes hidden books |
| Admin ManageBooks (`/admin/books`) | Toggle between active and deleted books | Add "Show Hidden" toggle; show "Hidden" badge on cards; display `totalHidden` in status bar |
| Admin Report (`/admin/report`) | Lists selections | No change — students can't pick hidden books |

---

## 6. Out of Scope

- Allowing teachers to manually override the hidden flag (unhide a book without interior images)
- Adding a database table for hidden state — the flag lives in `books.json` only
- Changing the scraper to skip downloading books without interior images

---

## 7. Success Criteria

- Running `npm run flag-hidden` patches `books.json` and reports ~1,576 books flagged
- `GET /api/books` returns only books that are neither deleted nor hidden
- `GET /api/books/all` includes `hidden: true/false` on every book and `totalHidden` in summary
- Admin ManageBooks page shows the hidden count in the status bar
- "Show Hidden" toggle displays only hidden books with an amber badge
- Future scraper runs produce `books.json` with the `hidden` flag pre-set
