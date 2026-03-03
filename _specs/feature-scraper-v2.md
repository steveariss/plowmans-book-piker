---
type: feature
status: implemented
created: 2026-03-01
depends-on: technical-book-picker
---

# Scraper V2 — Feature Spec

## 1. Overview

The original scraper pulled ~5,200 books using only an age filter (ages 4–6). We now have a significantly narrower URL with subject, date, and language filters already applied by the teacher. This spec describes re-running the scraper against the new filtered list and capturing additional metadata (author, age/audience, subjects) in the output so the app can support richer filtering in the future.

---

## 2. The Problem

- **Too many books.** The current dataset has ~5,200 books. After the teacher hid irrelevant ones, only ~3,600 remained visible — but the teacher still had to manually review thousands of titles. The new filtered URL dramatically reduces the starting set.
- **Missing metadata.** The current `books.json` only stores `id`, `title`, cover/interior images, dimensions, and a hidden flag. Author, age range, and subject information are available from the API but are thrown away during the final export. Without this data, future filtering features (by author, subject, age) are impossible without re-scraping.

---

## 3. Goals

- **Use the new filtered source URL.** The scraper should target the teacher's curated filter set, which includes specific subjects, date ranges (2020–2026), age group (4–6), and English language — producing a much smaller, more relevant book list.
- **Capture author in the output.** Each book in `books.json` should include the author name(s) so they can be displayed or filtered on.
- **Capture age/audience in the output.** Each book should include its target audience or age range string for future filtering.
- **Capture subjects in the output.** Each book should include its subject categories (e.g., "Fiction", "Juvenile Fiction — Animals", etc.) for future filtering.
- **Replace the existing dataset.** The new scrape replaces `data/books.json` and the `data/images/` directory entirely. Old data is discarded.
- **Preserve existing scraper qualities.** Resumability, rate limiting, WebP conversion, cover dimension extraction, and the hidden-books flag should all continue to work as they do today.

---

## 4. What Changes

### 4.1 New Source URL

The scraper should use this filtered browse URL as its source:

```
https://anotherstoryedu.ca/browse/filter/s/fic/juv/jnf/juv039/juv002/juv013/juv019/juv011/juv051/juv017/juv001/jnf071/jnf003/juv010/jnf007/juv081/juv006/juv048/juv089/juv050/juv009/juv074/juv082/juv083/juv060/juv077/juv031/juv030/juv056/juv035/jnf051/d/2020z01z01/2021z01z01/2022z01z01/2023z01z01/2024z01z01/2025z01z01/2025z02z01/2025z03z01/2025z04z01/2025z05z01/2025z06z01/2025z07z01/2025z08z01/2025z09z01/2025z10z01/2025z11z01/2025z12z01/2026z01z01/2026z02z01/2026z03z01/2026z04z01/a/a4to6/r/0xy/g/en
```

The URL segments encode these filters:

| Segment | Meaning | Values |
|---------|---------|--------|
| `/s/...` | Subject codes | fic, juv, jnf, juv039, juv002, juv013, juv019, juv011, juv051, juv017, juv001, jnf071, jnf003, juv010, jnf007, juv081, juv006, juv048, juv089, juv050, juv009, juv074, juv082, juv083, juv060, juv077, juv031, juv030, juv056, juv035, jnf051 |
| `/d/...` | Date ranges | 2020 through April 2026 (encoded as `YYYYz01z01`) |
| `/a/...` | Age group | a4to6 (ages 4–6) |
| `/r/...` | Display/sort | 0xy |
| `/g/...` | Language | en (English) |

The technical spec must determine how these URL filter segments map to the BookManager API's `browse/get` request parameters. The current scraper only passes `a: 'a4to6'` as a filter — the new version needs to also pass subject, date, and language filters.

### 4.2 Additional Fields in books.json

The final `books.json` output should include three new fields per book:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `authors` | `string` | Comma-separated author name(s) | `"Eric Carle"` or `"Mo Willems, Tony DiTerlizzi"` |
| `audience` | `string` | Age range or audience label from the API | `"Ages 4-6"` or `"Juvenile"` |
| `subjects` | `string[]` | Array of subject/category labels | `["Juvenile Fiction", "Animals — General", "Humorous Stories"]` |

**Note:** The scraper already captures `authors` and `audience` from the browse API response during Phase 2 (book list fetching) but currently discards them when generating the final `books.json` in Phase 4. Subjects may come from the browse response or may require the detail endpoint — this needs investigation during technical spec writing.

### 4.3 Updated books.json Shape

Current:
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

New:
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

### 4.4 Fresh Scrape

This is a full re-scrape, not an incremental update. The scraper state should be reset before running. The old `data/images/` directory and `data/books.json` will be replaced entirely.

---

## 5. Impact on Existing Screens

| Screen / Area | Current behaviour | Change needed |
|---------------|-------------------|---------------|
| Book browsing (student) | Shows title + images only | No change required now. Authors/subjects available for future features. |
| Manage Books (admin) | Shows title, hidden badge | Could optionally show author — but this is out of scope for the scraper spec. |
| Report (admin) | Shows student name + book title | Could optionally show author — but this is out of scope. |
| Server `/api/books` | Returns book objects from books.json | Will automatically include new fields since it serves the JSON as-is. No server changes needed. |
| Database | `deleted_books` references book IDs | Must be cleared since book IDs will change with the new dataset. |

---

## 6. Out of Scope

- **UI changes to display the new fields.** This spec only covers capturing the data. Displaying authors, subjects, or audience in the UI is a separate feature.
- **Filtering UI.** Building filter controls for subjects/authors/audience in the student or admin views is a future feature.
- **Changing the scraper's architecture.** The 4-phase pipeline (discover → list → details → images) should remain the same. We're updating parameters and output, not restructuring.
- **Updating `books-sample.json`.** The mock data file can be updated separately if needed.

---

## 7. Success Criteria

- The scraper runs against the new filtered URL and completes without errors.
- The resulting `books.json` is significantly smaller than the previous ~5,200 books (exact count depends on the filtered results).
- Every book in `books.json` includes `authors`, `audience`, and `subjects` fields.
- Cover and interior images are downloaded and converted to WebP as before.
- Books without interior images are still flagged as `hidden: true`.
- The app loads and works correctly with the new dataset (browsing, book preview, selections all functional).

---

## 8. Open Questions

- **How do the URL filter segments map to API parameters?** The current scraper only passes `a: 'a4to6'` to the browse/get API. The technical spec needs to investigate how subject codes (`s`), date ranges (`d`), language (`g`), and the `r` parameter translate to API request body fields. This may require inspecting network traffic on the live site.
- **Where do subjects come from in the API?** The browse/get response includes basic metadata. Subjects may be in the browse response or may require the detail endpoint (title/getItem). The technical spec should investigate both.
- **What format are subjects returned in?** They could be BISAC codes (like `JUV039000`), human-readable labels, or both. The spec should decide what to store.
