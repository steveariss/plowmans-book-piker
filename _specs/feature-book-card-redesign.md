---
type: feature
status: draft
created: 2026-02-27
depends-on: product-book-picker
---

# Book Card Redesign — Product Spec

## 1. Overview

The book browsing grid is the heart of the student experience. Every child's book choice is driven entirely by the cover art — children ages 4–6 cannot read titles, so the illustration is everything.

The current card design forces all covers into a fixed 3:4 rectangle, cropping artwork that doesn't match that shape. This can hide important parts of illustrations — characters, borders, title art — that a child might use to decide.

This spec describes a redesign of book cards so that covers are always shown in full, and explores making books feel more like real, physical objects that children would want to pick up. A temporary exploration page will let the team compare design approaches side-by-side before committing to a final direction.

---

## 2. The Problem

### Cover cropping

The current design applies a fixed 3:4 aspect ratio to every cover image. Covers that are taller, wider, or square get cropped to fill the space. Real book covers from the library have significant variety:

- **Standard portrait** (~3:4) — fits the current frame well, minimal cropping
- **Square** (1:1) — common for board books and oversized picture books. Left and right edges are cut off
- **Landscape** (wider than tall) — significant top and bottom lost
- **Tall/narrow** — sides are cropped away

Board books, oversized picture books, and books with wraparound cover art are often square or landscape. These are extremely common in the ages 4–6 category — and they're arguably the books most affected by cropping.

### The grid feels sterile

The uniform rectangular grid is tidy, but it feels more like a database than a bookshelf. Children this age are used to books scattered on a carpet, propped up on a shelf, or held in their hands. The browsing experience should feel warmer and more physical.

---

## 3. Goals

- **No cover cropping.** Every book cover should be visible in its entirety, regardless of its aspect ratio. A child should see exactly what they'd see if they picked up the physical book.
- **Books should feel real.** The visual treatment should evoke the feeling of looking at real, physical books rather than flat digital thumbnails. Books have thickness, weight, and shadow.
- **Delight and fun.** The browsing experience should feel playful and inviting. Interactions (hovering, tapping, scrolling) should reward curiosity with small moments of delight.
- **Maintain usability.** Touch targets must remain large and clear. The "Pick Me!" button must stay visually distinct from the cover. The grid must remain easy to scan.
- **Performant on Chromebooks.** Any visual enhancements must remain smooth at 1366×768 on modest hardware. Prefer lightweight CSS approaches over heavy rendering.

---

## 4. Design Approaches to Explore

Each approach is described in terms of what the child sees and feels, not how it's built. The exploration page (Section 6) will show all of these side by side with real book data.

### Approach A: "Books on a Table"

Books are displayed at their natural proportions — no cropping. Each cover sits at a very slight random tilt, as if someone scattered books across a big table for children to browse.

The grid has a relaxed, organic feel. No two cards look exactly the same because covers are different shapes and each has a tiny rotation. Shadows fall as if the books are sitting on the warm cream surface — soft, directional shadows suggesting a physical object with thickness.

Tall books sit taller, wide books sit wider, square books sit square. The visual rhythm is varied and natural, like a real spread of books.

On hover/touch, a book lifts slightly off the surface — the shadow deepens and the book scales up a little, as if the child has picked it up to look more closely.

### Approach B: "3D Bookshelf"

Books are rendered to look like three-dimensional objects. Each card shows a front cover with a visible spine on the left edge and the suggestion of pages along the right edge and bottom.

The cover is shown at its full, natural proportions. The 3D treatment wraps around it rather than constraining it. Books sit on virtual "shelves" — horizontal rows that feel like wooden bookcase shelves. The warm cream background becomes the wall behind the bookcase.

The effect should be gentle and stylized, not photorealistic. Think of a children's illustration of a bookshelf rather than a photograph of one.

On hover/touch, the book tilts forward slightly toward the viewer, as if being pulled from the shelf. The spine and pages become more visible.

### Approach C: "Floating Books"

Books are shown at their full natural size with soft, rounded shadows beneath them, as if floating just above the surface.

Each book has a gentle continuous bobbing animation — very subtle, like floating on water. Different books bob at slightly different rates to create a lively, organic feel. The background could include very subtle decorative elements (tiny stars, dots, or swirls) to reinforce the magical, playful tone.

On hover/touch, the book rises higher and the shadow spreads, suggesting the child has "reached for" the book.

### Approach D: "Storybook Easels"

Each book is displayed propped up on a small easel or stand, angled slightly as if on display in a bookshop window or at a book fair.

The cover is shown at its full natural proportions. The easel or stand is a simple visual accent beneath or behind the cover. The grid feels like walking through a book fair or a library display — each book is individually "presented."

On hover/touch, the book stands up straighter (the tilt angle decreases), as if the child walked up to it for a closer look.

### Approach E: "Simple and Clean"

The simplest approach: remove the forced aspect ratio and let each cover display at its natural dimensions. No 3D, no rotation, no extra visual effects.

Cards in the grid will have varying heights depending on cover proportions. The grid uses a masonry-style layout so books pack together naturally without large gaps. The card retains its white background, rounded corners, and subtle shadow — but the shadow could be made slightly deeper and warmer to add a touch more physical presence.

This is the safest, most predictable approach. It solves the cropping problem directly with no risk of visual effects feeling distracting.

---

## 5. Shared Interaction Details

These behaviors apply regardless of which visual approach is chosen:

- **Tapping the cover** still opens the book preview carousel. The tap target is the cover artwork itself.
- **The "Pick Me!" button** remains a separate, clearly labelled button below the cover. It must be visually distinct from the cover and never overlap the artwork. Its current size, colour (green), and behaviour (toggle, bounce on pick, shake at limit) are preserved.
- **The selection counter** at the top and the **"Done" button** at the bottom remain unchanged.
- **The carousel/preview modal** already shows covers at their natural proportions — no changes needed. If a 3D book effect is used on the grid, the carousel should show the flat cover only.

---

## 6. The Exploration Page

### Purpose

A temporary page where the team can see multiple design approaches rendered with real book data, side by side, to compare and make a decision. This page is for internal use only — students never see it.

### Layout

The page is divided into clearly labelled sections, one per design approach. Each section shows a small grid of 8–12 books rendered in that approach's style.

### Book selection

The same set of books should appear in every section so comparisons are apples-to-apples. The selection should deliberately stress-test each approach by including books with diverse aspect ratios: several standard portrait covers, a few square, one or two landscape, and one very tall/narrow.

### Interactivity

Hover and touch effects should be fully functional in each section so the team can experience the interactions, not just the static appearance.

### View modes

A toggle at the top to switch between:
- **Overview** — all approaches visible at once, stacked vertically, for quick comparison
- **Full-screen** — one approach at a time, filling the viewport, with prev/next navigation. This lets the team feel how an approach works at real browsing scale.

### Annotations

Each section has a brief heading naming the approach (e.g., "Books on a Table") and one sentence summarizing its character.

### Lifecycle

This page is temporary. Once a design direction is chosen, the exploration page and its components should be removed. It should be built in a way that makes it easy to delete cleanly.

---

## 7. Grid Layout Considerations

When covers have different proportions, the grid must accommodate them. There are three broad strategies worth exploring:

### Uniform row height

Each row of books has a fixed height. Books scale to fill that height, and their width varies based on cover proportions. Rows line up neatly. Some columns will be wider than others.

### Masonry / Pinterest-style

Covers maintain their natural width-to-height ratio within equal-width columns. Rows stagger because books have different heights. This is a common pattern for visual browsing.

### Centered with breathing room

Keep equal-width columns but centre each cover within its cell. Shorter or narrower covers simply have more whitespace around them. The whitespace becomes part of the visual feel — especially in the "Books on a Table" approach.

The exploration page should try at least two of these layout strategies so the team can see which feels best with real data.

---

## 8. Impact on Existing Screens

| Screen | Current behaviour | Needed change |
|--------|------------------|---------------|
| **Book Browsing Grid** (`/browse`) | 3:4 aspect ratio, `object-fit: cover` | Primary focus of this redesign |
| **Thank You** (`/thanks`) | Also crops covers to 3:4 | Should match the new card style |
| **Book Carousel** (preview modal) | Already shows covers at natural proportions | No change needed |
| **Manage Books** (`/admin/books`) | Teacher-facing, uses compact cards | Low priority; fix cropping for consistency if easy |

---

## 9. Out of Scope

- Changing the carousel/preview modal design
- Redesigning admin screens (Manage Books, Report)
- Changing the "Pick Me!" button design, selection logic, or Done button behaviour
- Backend or API changes
- Changes to the book data format or scraper output

---

## 10. Success Criteria

- Every book cover in the browsing grid is visible in its entirety. No part of any cover illustration is cropped or hidden.
- The browsing experience feels more physical, warm, and inviting than the current flat grid.
- A 4–6 year old can still browse, tap to preview, and pick books without confusion. Usability is preserved or improved.
- The exploration page shows at least 3 distinct design approaches with real book data, allowing a clear comparison.
- Performance on Chromebook hardware remains smooth — no dropped frames during scrolling, no perceptible lag on hover/touch animations.
- The final chosen approach is applied consistently to all student-facing screens where covers appear.

---

## 11. Open Questions

- Which grid layout strategy (uniform row height, masonry, or centered) works best with the real data?
- How much 3D effect is "enough" versus "distracting" for 4–6 year olds?
- Should the random rotation/scatter in "Books on a Table" be truly random (different each page load) or deterministic (same layout every time)?
- Should the column count change? With natural-proportion covers, wider covers need more horizontal space. The current 6/5/4 column breakpoints may need adjustment.
- Should the Thank You screen adopt the same decorative treatment as the grid, or keep a simpler presentation?
