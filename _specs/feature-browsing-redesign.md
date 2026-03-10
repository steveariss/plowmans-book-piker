---
type: feature
status: implemented
created: 2026-03-03
depends-on:
---

# Browsing Redesign: Bookshelf UX — Feature Spec

## 1. Overview

Redesign the student book browsing page from a flat card grid into a virtual **bookshelf** — books standing on shelves, leaning against a wall, with hanging signs as pick buttons. The goal is a more physical, relatable experience for the 4-6 age demographic. This spec covers the UX and visual design; a separate technical spec will detail implementation.

Inspired by [Animated CSS Bookshelf](https://codepen.io/ekfuhrmann/pen/OJmRVPj) (CodePen by ekfuhrmann).

---

## 2. The Problem

The current browsing grid displays books as flat cards floating in a CSS grid. While functional, the layout feels generic — it looks like a digital catalog, not a place kids would naturally look for books. Young children associate books with **physical bookshelves** in their classrooms and libraries. The current design misses an opportunity to create that connection.

Additionally, the "Pick Me!" button is large (72px) and occupies significant vertical space below each card, making rows feel stretched and reducing the number of books visible at once.

---

## 3. Goals

- **Feel like a real bookshelf.** The browsing page should evoke the experience of standing in front of a classroom bookshelf and choosing a book.
- **Maximize visible covers.** By removing titles and shrinking the pick action, more books are visible per screen without scrolling.
- **Keep interactions obvious.** Despite the visual changes, picking a book should remain effortless for a young child — no hidden affordances.
- **Maintain responsive behavior.** The existing media queries controlling how many books appear per row must be preserved.
- **Preserve existing flows.** The 3D book preview, selection counter, done button, and admin pages are unchanged.

---

## 4. Proposed Solution

### 4.1 The Shelf

Each row of books sits on a **shelf**. The shelf is a horizontal visual element that spans the full width of the browsing area, creating the appearance of a physical ledge the books rest on.

**Appearance:**
- Warm cream color, matching the app's existing palette
- Subtle depth — a visible front face and top surface using shadow or gradient
- Soft shadow below each shelf for grounding

The shelf is purely decorative and structural — it visually groups a row of books and provides an anchor point for the hanging signs below.

### 4.2 Books on the Shelf

Books are displayed as **cover images standing upright on the shelf**, with no title text visible. Titles are only shown inside the 3D book preview modal.

**Default state (at rest):**
- The book leans slightly backward, as if resting against the wall behind the shelf
- Achieved with a subtle 3D tilt (imagine the top edge of the cover tilting slightly away from the viewer)
- A soft shadow beneath the book grounds it on the shelf surface

**Hover / tap state:**
- The book leans forward slightly, as if the child has tipped it toward themselves to get a better look
- This is a gentle, subtle movement — not the aggressive pull-out effect from the CodePen reference
- The shadow adjusts to reflect the new angle

**Tap action:**
- Tapping a book cover opens the existing 3D book preview modal (no change to this behavior)

### 4.3 The Hanging Sign (Pick Button)

Below each book, a small **sign hangs from the shelf ledge** — like a miniature shop sign hanging by chains or short ropes.

**Unpicked state:**
- Small rectangular sign with rounded corners
- White/cream background with a thin border
- Star icon + "Pick Me!" text
- Two small decorative chains/ropes connecting the sign's top corners to the shelf edge above

**Picked state (3D flip animation):**
- When tapped, the sign **flips over** with a 3D rotation animation (like flipping a real hanging sign from "Open" to "Closed")
- The reverse side is green with a white checkmark and "Picked!" text
- The sign may sway slightly after flipping, like a sign settling after being turned

**At pick limit (3rd pick attempt):**
- The sign shakes side to side briefly (consistent with existing shake feedback pattern)
- Selection is prevented

**Size:**
- Smaller than the current 72px pick button — sized to feel proportional to a hanging sign, not a big action button
- Still meets minimum 48px touch target requirement

### 4.4 Responsive Shelf Rows

The existing responsive breakpoints determine how many books appear per shelf row:

| Viewport Width | Books per Shelf |
|---------------|-----------------|
| < 500px       | 2               |
| 500–800px     | 3               |
| 800–1200px    | 4               |
| 1200–1600px   | 5               |
| > 1600px      | 6               |

Each shelf row wraps naturally — when the grid wraps to a new row, a new shelf appears beneath it.

### 4.5 Scrolling Experience

As the student scrolls down, they see shelf after shelf of books — like scanning a tall bookcase. The selection counter remains sticky at the top, and the done button remains fixed at the bottom when 2 books are picked.

---

## 5. Impact on Existing Screens

| Screen / Area | Current Behaviour | Change Needed |
|---------------|-------------------|---------------|
| Book Browsing (`/browse`) | Flat card grid with title + Pick button per card | Bookshelf layout with leaning books + hanging signs |
| BookCard component | Card with cover, title, and PickButton | Replaced by shelf book (cover only) + hanging sign |
| PickButton component | Large green/white button (72px) below card | Restyled as hanging sign with flip animation |
| SelectionCounter | Sticky counter at top | No change |
| DoneButton | Fixed at bottom when 2 picked | No change |
| 3D Book Preview Modal | Opens on cover tap | No change |
| Thank You (`/thanks`) | Shows selected book covers | No change (could adopt shelf look later, out of scope) |
| Admin pages | Teacher-facing card grid | No change |

---

## 6. Out of Scope

- Changes to the 3D book preview modal or page-turn experience
- Changes to admin pages (Manage Books, Report)
- Changes to the Thank You page
- Technical implementation details (CSS transforms, component refactoring) — covered in a separate technical spec
- Adding book spines or other 3D book geometry to the shelf view
- Drag-and-drop or reordering books on shelves
- Shelf categories or labels

---

## 7. Success Criteria

- The browsing page visually reads as a bookshelf, not a card grid
- Books appear to lean against a wall and respond to hover with a gentle forward tilt
- The pick action is a hanging sign that flips on selection
- Responsive breakpoints produce the correct number of books per shelf at each viewport size
- Touch targets for the hanging sign meet the 48px minimum
- The 3D preview modal still opens on cover tap
- The full pick flow works: browse → pick 2 → done → thank you
- Performance remains smooth on Chromebook hardware (1366x768)

---

## 8. Open Questions

- **Sign hanging detail**: Should the chains/ropes be simple CSS lines, or small SVG/image decorations? (Resolve during technical spec)
- **Shelf edge detail**: Should the shelf have a visible lip/front face, or just a top surface with shadow? (Resolve during visual prototyping)
- **Last row handling**: If the last shelf row is partially filled (e.g., 3 books on a 5-book shelf), should the shelf still span full width? (Likely yes, for visual consistency)
