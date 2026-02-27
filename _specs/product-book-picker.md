---
type: product
status: active
created: 2025-01-01
---

# Book Picker – Product Spec

## Overview

A single-page web application that allows students aged 4–6 to browse picture book covers and select 2 books they like. The app is hosted online and accessed via Chrome on individual student Chromebooks. A teacher sets up each student's name before handing the device over, and a simple report tracks every student's selections.

---

## Users & Workflow

### Teacher Flow
1. Teacher opens the app URL in Chrome on a Chromebook.
2. Teacher enters (or selects) a student's name on a setup screen.
3. Teacher hands the Chromebook to the student.

### Student Flow
1. Student sees a grid of book covers — large, visual, no reading required.
2. Student can **tap a book cover** to open a carousel and see a few pages from inside the book.
3. Student closes the carousel and returns to the grid (or selects from within the carousel).
4. Student taps the **"Pick This Book" button** on a card (or inside the carousel) to select it. The button changes to show it's picked.
5. Tapping the button again on a picked book deselects it.
6. Once exactly 2 books are selected, a large "Done" / "All Done! ✓" button appears.
7. Student taps the button. A confirmation/thank-you screen appears.
8. The selection is saved. The app returns to the teacher setup screen, ready for the next student.

### Teacher Curation Flow (Admin — done before giving students access)
The teacher curates the book list **once** after a scrape. This is a global action — it determines which books all students see on every device.

1. From the setup screen, the teacher taps a "Manage Books" button.
2. The teacher sees the full grid of all scraped books (5,000+), each with a **checkbox overlay**.
3. The teacher checks the books they want to **remove**.
4. The teacher taps a "Delete Selected" button. A confirmation prompt appears (e.g. "Remove 12 books?").
5. Confirmed deletions apply **globally on the server** — removed books no longer appear for any student on any device.
6. The curation screen should include:
   - A **"Select All" / "Deselect All"** toggle for convenience.
   - A **search/filter bar** so the teacher can find books by title (the teacher is an adult — text search is fine here).
   - A count showing how many books are currently in the active list (e.g. "Showing 43 of 5,174 books").
7. Curation state is saved on the server. All Chromebooks see the same curated list. If the scraper is re-run and fresh data is loaded, previously deleted books stay deleted (matched by book ID).

### Teacher Report Flow
1. From the setup screen, the teacher can tap a "View Report" button.
2. The report shows a simple table: **Student Name → Book 1 Title, Book 2 Title**.
3. The teacher can export/download the report as a CSV.
4. The teacher can clear all data to start fresh.

---

## Data & Scraping

All book data comes from **Another Story Bookshop**. A scraping step must run before (or as part of) the build to produce a local JSON data file the app uses at runtime. The app must NOT make live requests to the bookshop site during student use.

### Source URL (book list)
```
https://anotherstoryedu.ca/browse/filter/a/a4to6
```
- Scrape every book listed on this page (handle pagination if present).
- For each book, capture:
  - **Title**
  - **Cover image URL** (download the image locally)
  - **Detail page URL** (e.g. `https://anotherstoryedu.ca/item/zb7C99cVE0ylBN2EXIzC2Q`)

### Source URL (book detail / inside pages)
For each book's detail page:
- On the left side of the page there is a set of thumbnail images (cover + interior pages).
- These thumbnails link to larger images, typically viewable in a carousel/lightbox on the original site.
- Scrape **all available images** for each book (cover + interior page images).
- Download them locally and associate them with their book in the data file.

### Output Data Format (suggestion)
```json
[
  {
    "id": "zb7C99cVE0ylBN2EXIzC2Q",
    "title": "Book Title Here",
    "coverImage": "images/zb7C99cVE0ylBN2EXIzC2Q/cover.jpg",
    "interiorImages": [
      "images/zb7C99cVE0ylBN2EXIzC2Q/page-1.jpg",
      "images/zb7C99cVE0ylBN2EXIzC2Q/page-2.jpg"
    ]
  }
]
```

### Scraping Notes
- The source list contains **~5,174 books**. The scraper must handle full pagination to capture all of them.
- Be respectful: add a small delay between requests (1–2 seconds). At 5,000+ books with detail pages, a full scrape will take significant time — the scraper should show progress and be resumable if interrupted.
- The scraper should be a standalone script (e.g. Node or Python) that can be re-run if the book list changes.
- All images should be saved at reasonable quality/resolution (they only need to look good on a Chromebook screen — roughly 1366×768).

---

## UI / UX Requirements

### General Principles
- **Designed for 4–6 year olds.** Everything must be tappable, visual, and use minimal text.
- **Fun and whimsical.** The app should feel playful and delightful — bright colours, friendly illustrations or icons, gentle animations (e.g. a little bounce on selection, confetti on the thank-you screen). It should feel like a game, not a form.
- Large touch targets (book covers should be big).
- Bright, friendly colours. Simple shapes.
- No scrolling if possible — or if the grid requires scrolling, make it a simple vertical scroll with large items.
- No confusing UI elements. No hamburger menus, no tiny buttons.

### Screens

#### 1. Teacher Setup Screen
- A text input for the student's name (teacher types it).
- A "Start" button to enter the browsing experience.
- A "Manage Books" button to access the curation/admin screen.
- A "View Report" button to access the report.
- Simple and clean — this screen is for the teacher, not the student.

#### 2. Book Browsing Grid (Main Screen)
- Display only **non-deleted** book covers in a grid layout.
- Each cover should be a large, tappable card.
- Images should **lazy-load** as the student scrolls to keep initial load fast, especially if the teacher has kept a large number of books active.
- **Tapping the book cover image opens the carousel** (see Book Preview below) so students can look inside.
- Each card has a **separate, clearly distinct "Pick This Book" button** below or beside the cover image. This is the only way to select a book. The button should be:
  - Large and easy to tap (friendly colour, e.g. a green or blue rounded button).
  - Labelled with a simple icon and/or short text (e.g. a star icon + "Pick Me!" or a heart icon).
  - Visually distinct from the cover image so kids don't accidentally select when they just want to look inside.
- When a book is selected, the button changes state to indicate it's picked (e.g. turns into a filled star, changes colour, shows a checkmark). Tapping it again **deselects** the book.
- A counter or visual indicator at the top showing how many books are selected (e.g. "⭐ 1 of 2 picked").
- When 2 books are selected, a large "Done" / "All Done! ✓" button appears or becomes enabled.
- If a student tries to select a 3rd book, gently prevent it (e.g. shake animation, or just don't allow it — don't show an error message they can't read).

#### 3. Book Preview / Carousel (Modal or Overlay)
- Opens when the student **taps a book cover image** in the grid.
- Shows the book's images (cover + interior pages) in a swipeable carousel or lightbox.
- Large left/right arrows for navigation (or swipe on touch).
- A clear, large "X" or "Close" button to return to the grid.
- Include the same **"Pick This Book" button** inside the carousel so the student can select the book after previewing it, without having to close first.

#### 4. Confirmation / Thank You Screen
- Appears after the student taps "Done."
- Shows the 2 selected book covers with a friendly message (e.g. "Great choices! 🎉").
- The teacher can see the result.
- After a few seconds (or on tap), returns to the Teacher Setup Screen for the next student.

#### 5. Manage Books Screen (Teacher Admin)
- Displays all scraped books in a compact grid or list (optimised for scanning many items quickly, not for children).
- Each book has a **checkbox** for selection.
- **Search/filter bar** at the top — filters the visible list by title as the teacher types.
- **"Select All" / "Deselect All"** button that applies to the currently filtered/visible set.
- A persistent status bar showing: "X selected · Y books active out of Z total".
- A **"Delete Selected"** button (prominent, red/warning colour). Tapping it shows a confirmation dialog: "Remove X books from the student list? This can be undone from this screen."
- A **"Show Deleted"** toggle or tab that reveals previously removed books, each with a "Restore" action, so the teacher can undo mistakes.
- A **"Back"** button to return to the setup screen.
- Because the full list is 5,000+ books, the grid should use **virtualised scrolling / lazy rendering** (or simple pagination) to keep performance smooth on Chromebook hardware.

#### 6. Report Screen
- Simple table: Student Name | Book 1 | Book 2
- "Download CSV" button.
- "Clear All Data" button (with a confirmation prompt).
- "Back" button to return to the setup screen.

---

## Data Storage

- The app needs a **lightweight backend** (or serverless functions) with a simple database to persist selections and curation state across all Chromebooks.
- Recommended approach: a small server (e.g. Node/Express, Python/Flask) with a SQLite or JSON-file database, or a hosted service like Firebase/Supabase if preferred.
- Data structure (suggestion):

**Selections table/collection:**
```json
{
  "studentName": "Emma",
  "books": ["Book Title 1", "Book Title 2"],
  "timestamp": "2025-02-26T10:30:00Z"
}
```

**Curation state (deleted books):**
```json
{
  "deletedBookIds": ["id1", "id2", "id3"]
}
```

- The student browsing grid filters out any book whose ID is in the deleted list.
- If the scraper is re-run and the book data is refreshed, the curation state still applies — deleted books remain hidden as long as the IDs match.
- All Chromebooks share the same data — if one teacher curates the list or views the report, all devices reflect the same state.

---

## Tech Stack (Recommendation)

- **Frontend**: A single-page app — HTML + CSS + vanilla JavaScript, OR a lightweight framework like React/Vue if preferred.
- **Backend**: A lightweight server (e.g. Node/Express or Python/Flask) to serve the app, the book data/images, and a small API for saving/retrieving selections and curation state. Alternatively, a serverless/BaaS approach (Firebase, Supabase) could replace the custom backend.
- **Database**: SQLite, a JSON file, or a hosted DB — whatever is simplest. The data volume is tiny (dozens of student selections, one list of deleted book IDs).
- **Hosting**: Deploy to any simple hosting platform (e.g. a VPS, Railway, Render, Fly.io, Vercel + serverless functions, etc.). The teacher accesses the same URL from every Chromebook.
- **Scraper**: A standalone Python or Node.js script that outputs the JSON + downloaded images. Runs once (or on-demand) and the results are deployed alongside the app.
- The book images should be served as **static assets** from the hosted server — the app should NOT make live requests to the bookshop site during student use.

---

## File Structure (Suggestion)

```
book-picker/
├── scraper/
│   ├── scrape.py (or scrape.js)
│   └── README.md              # Instructions to run the scraper
├── server/
│   ├── index.js (or app.py)   # Backend API + static file serving
│   ├── db/                    # Database file(s)
│   └── package.json (or requirements.txt)
├── public/                    # Static frontend assets
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── data/
│   │   └── books.json         # Generated by scraper
│   └── images/
│       └── {bookId}/
│           ├── cover.jpg
│           ├── page-1.jpg
│           └── page-2.jpg
└── README.md                  # Setup, deployment & usage instructions
```

---

## Out of Scope

- User authentication or login (the app is accessed via a known URL — no password protection needed).
- Mobile phone support (Chromebook only).
- Editing the book list within the app (re-run the scraper instead).
- Complex user management — the teacher simply types a student name each time.

---

## Success Criteria

1. A teacher can enter a student name and hand off the device in under 10 seconds.
2. A 4–6 year old can browse covers, peek inside books, and select 2 books without adult help.
3. Selections are reliably saved and visible in the report from any Chromebook.
4. The teacher can curate the book list from any Chromebook and all devices reflect the changes.
5. The scraper successfully pulls all book covers and interior images from the source site.
6. The app loads quickly on Chromebook hardware over a typical school network.
