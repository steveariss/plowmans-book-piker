-- Tracks which books the teacher has removed from the student view.
-- Presence of a row means the book is hidden.
CREATE TABLE IF NOT EXISTS deleted_books (
    book_id    TEXT PRIMARY KEY,
    deleted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Stores each student's two book selections.
CREATE TABLE IF NOT EXISTS selections (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    student_name TEXT NOT NULL,
    book1_id     TEXT NOT NULL,
    book1_title  TEXT NOT NULL,
    book2_id     TEXT NOT NULL,
    book2_title  TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
