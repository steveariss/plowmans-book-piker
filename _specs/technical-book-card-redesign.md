---
type: technical
status: draft
created: 2026-02-27
depends-on: feature-book-card-redesign
---

# Book Card Redesign — Technical Spec

## 1. Overview

This spec provides the implementation details for the book card redesign. The work has two tracks: (1) CSS grid fixes to remove cover cropping and add warmer, more physical shadows, and (2) a 3D interactive book preview built with React Three Fiber to replace the current flat embla-carousel modal. The R3F implementation is adapted from [wass08/r3f-animated-book-slider-final](https://github.com/wass08/r3f-animated-book-slider-final), which creates a 3D book with flippable pages using bone-based page-curl animation.

---

## 2. The Problem

The current `BookCard` component forces all covers into a fixed 3:4 rectangle:

```css
/* BookCard.module.css lines 27-31 */
.cover {
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
}
```

The `ThankYou` screen has the same problem:

```css
/* ThankYou.module.css lines 40-44 */
.cover {
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
}
```

Books with square, landscape, or tall/narrow covers are cropped. Children ages 4-6 choose books entirely by cover art, so this directly undermines the product experience.

The current book preview (embla-carousel in a `<dialog>` modal) is functional but flat — it shows cover and interior images as a horizontal slideshow. A 3D book with page-flipping would be more immersive and delightful for young children.

---

## 3. Goals

- **Zero cover cropping** in the browsing grid — covers display at natural proportions.
- **3D book preview** — replace the flat carousel with an interactive 3D book using React Three Fiber, where children can flip through pages.
- **Performant on Chromebooks** — Three.js is only loaded when a child taps a book (code-split). The grid itself uses plain CSS.
- **Maintain usability** — touch targets >= 48px, PickButton stays accessible, dialog pattern preserved.
- **CSS-only grid improvements** — no new dependencies for the browsing grid. Warmer shadows and natural proportions.

---

## 4. Proposed Solution

### 4.1 Dependencies

Add to `client/package.json`:

| Package | Version | Purpose |
|---------|---------|---------|
| `three` | ^0.170.0 | Core 3D graphics library |
| `@react-three/fiber` | ^9.x | React renderer for Three.js (v9 for React 19) |
| `@react-three/drei` | ^10.x | Reusable R3F components (Environment, Float, useTexture) |
| `maath` | ^0.10.8 | Math utilities for easing (easing.dampAngle) |

Remove after verification: `embla-carousel-react`.

### 4.2 File Structure

All new 3D book code lives in a dedicated `book3d/` directory:

```
client/src/
  components/
    book3d/                          # NEW — all 3D book preview code
      Book3DPreview.jsx              # Top-level: dialog + Canvas + controls + PickButton
      Book3DPreview.module.css       # Dialog and overlay styling
      Book3DScene.jsx                # R3F scene: lights, environment, Float, Book
      Book3DPage.jsx                 # Single page: SkinnedMesh + bone animation
      Book3D.jsx                     # Book assembly: pages array, sequential turning
      pageGeometry.js                # Shared BoxGeometry + skin weights builder
```

### 4.3 Design Tokens

Add to `global.css` `:root` block:

```css
/* Warm shadows — book-like physical presence */
--shadow-warm-sm: 0 2px 8px rgba(139, 90, 43, 0.1), 0 4px 20px rgba(139, 90, 43, 0.06);
--shadow-warm-md: 0 4px 12px rgba(139, 90, 43, 0.14), 0 8px 28px rgba(139, 90, 43, 0.1);
--shadow-warm-lg: 0 8px 24px rgba(139, 90, 43, 0.18), 0 16px 40px rgba(139, 90, 43, 0.12);
```

### 4.4 CSS Grid Fixes

**BookCard.module.css** — remove forced aspect ratio, add warm shadows:

```css
.cover {
  width: 100%;
  height: auto;
  display: block;
}

.card {
  box-shadow: var(--shadow-warm-sm);
}

.card:hover {
  box-shadow: var(--shadow-warm-md);
}

.coverButton {
  min-height: 120px; /* prevent layout shift while images load */
}
```

**BookBrowsing.module.css** — prevent cards stretching to tallest in row:

```css
.grid {
  align-items: start;
}
```

**ThankYou.module.css** — same cover fix:

```css
.cover {
  width: 100%;
  height: auto;
  display: block;
}

.bookCard {
  max-width: 240px;
  flex: 0 1 auto;
}
```

### 4.5 Image Dimension Preprocessing

Add `coverWidth` and `coverHeight` to each book entry in `books.json`. Benefits:

- **Grid**: set proper aspect-ratio placeholders before images load, eliminating layout shift
- **3D book**: build page geometry at correct proportions immediately
- **Scraper**: already processes images — capturing dimensions during scraping is natural
- **Mock data**: a small script reads existing mock images and patches `books-sample.json`

Grid cards use the dimensions for placeholders:

```jsx
<div style={{ aspectRatio: `${book.coverWidth} / ${book.coverHeight}` }}>
  <img src={...} loading="lazy" />
</div>
```

### 4.6 Interior Images Are Spreads

Each interior image (`page-1.png`, `page-2.png`, etc.) is a **spread** — it shows two facing pages side-by-side. In the 3D book, the left half appears on the back of the left page and the right half on the front of the right page.

**Solution: Three.js texture UV manipulation.** Load each spread image as one texture, then use `texture.offset` and `texture.repeat` to show each half on the correct face:

```js
// Left half — shown on back face of page N
const leftHalf = spreadTexture.clone();
leftHalf.offset.set(0, 0);
leftHalf.repeat.set(0.5, 1);

// Right half — shown on front face of page N+1
const rightHalf = spreadTexture.clone();
rightHalf.offset.set(0.5, 0);
rightHalf.repeat.set(0.5, 1);
```

No image preprocessing or splitting needed. Each spread loads once.

### 4.7 Page Mapping From Book Data

Book data: `{ coverImage, interiorImages: ["spread-1", "spread-2", ...], coverWidth, coverHeight }`

| Physical Page | Front Face | Back Face |
|--------------|------------|-----------|
| 0 (cover) | `coverImage` (full) | `interiorImages[0]` left half |
| 1 | `interiorImages[0]` right half | `interiorImages[1]` left half |
| 2 | `interiorImages[1]` right half | `interiorImages[2]` left half |
| ... | pattern continues | ... |
| last | `interiorImages[N-1]` right half | plain warm material (back cover) |

For a book with 0 interior images: single physical page with cover on front, back cover material on back.

### 4.8 3D Book Components

#### Book3DPreview (top-level wrapper)

Replaces `BookCarousel`. Renders a `<dialog>` modal containing the R3F Canvas, navigation controls, and the PickButton.

**Props** (identical to current BookCarousel):

```jsx
{ book, picked, onPick, onClose, shake }
```

**Internal state**: `currentPage` (number), `isLoading` (boolean).

**Dialog layout:**

```
+------------------------------------------+
|  [Book Title]                        [X]  |
|                                           |
|  +---------------------------------------+|
|  |                                       ||
|  |          R3F Canvas (3D Book)         ||
|  |                                       ||
|  +---------------------------------------+|
|                                           |
|       [<]    Page 1 of 3    [>]           |
|                                           |
|          [ Pick Me! / Picked! ]           |
+------------------------------------------+
```

Same `<dialog>` pattern as current BookCarousel: `showModal()`, backdrop click closes, Escape closes, native focus trapping.

#### Book3DScene (R3F scene setup)

Everything inside `<Canvas>`. Sets up lighting, environment, and renders the Book3D component.

- **No OrbitControls** — children ages 4-6 cannot use orbit controls. Camera is fixed at a good viewing angle.
- **Float** — `floatIntensity={0.3}`, `rotationIntensity={0}` (gentle vertical bob only, no rotation).
- **Directional light** — position `[2, 5, 2]`, intensity 2.5, 2048x2048 shadow map.
- **Studio environment** — HDRI from drei for ambient lighting.
- **Ground plane** — shadow-receiving mesh at Y=-1.5, 20% opacity shadow material.

#### Book3D (book assembly)

Assembles the pages from book data and manages sequential page turning with delays.

**Dynamic dimensions** from book data:

```js
const PAGE_HEIGHT = 1.71; // fixed scale
const PAGE_WIDTH = PAGE_HEIGHT * (book.coverWidth / book.coverHeight);
```

**Sequential page turning**: When `currentPage` changes, pages flip one at a time with 150ms delay (single step) or 50ms (jumping multiple pages).

#### Book3DPage (single page with bone animation)

One physical page. Adapted from the tutorial's `Page` component.

- Uses `useTexture` from drei to load front/back images dynamically
- For pages with no image (blank interior), use a white material
- Cover (page 0) and back cover (last page) get roughness maps; interior pages get `roughness: 0.1`
- **Click-to-turn kept** — tapping a page flips it. Emissive orange highlight on hover provides visual feedback. Arrow buttons remain as alternative navigation
- **Bone animation** — SkinnedMesh with 31 bones per page. Inside/outside/turning curve intensities create realistic page-curl. Easing via `maath/easing.dampAngle`

#### pageGeometry.js (shared geometry builder)

Exports `createPageGeometry(pageWidth, pageHeight)`:

- `BoxGeometry` with 30 horizontal segments, `PAGE_DEPTH = 0.003`
- Skin indices and weights for bone-based deformation
- Function (not constant) so dimensions match each book's cover proportions
- Created once per book preview via `useMemo`

### 4.9 Key Adaptations From Tutorial

| Tutorial | Our Implementation |
|----------|-------------------|
| Hardcoded page dimensions (1.28 x 1.71) | Dynamic from `coverWidth/coverHeight` |
| Hardcoded pages array | Built dynamically from book data |
| OrbitControls for camera | Fixed camera position (too complex for ages 4-6) |
| Jotai for state management | Local React state + props |
| Single-page textures | Spread UV splitting (half-textures via offset/repeat) |
| Static texture list with preload | Dynamic `useTexture` with `<Suspense>` loading |
| Click-to-turn on pages | Kept — plus large arrow buttons as alternative |
| Emissive hover highlight | Kept — provides feedback that pages are tappable |
| Float (intensity 1, rotation 2) | Subtle float (intensity 0.3, rotation 0) |
| Bone animation physics | Kept as-is — core realism |

---

## 5. Impact on Existing Screens

| Screen | Current behaviour | Change needed |
|--------|------------------|---------------|
| **Book Browsing Grid** (`/browse`) | 3:4 aspect ratio, `object-fit: cover`, embla carousel preview | Remove cropping, warm shadows, replace carousel with 3D book |
| **Thank You** (`/thanks`) | Also crops covers to 3:4 | Remove cropping, warm shadows |
| **Book Carousel** (preview modal) | Flat embla-carousel in `<dialog>` | Replaced by Book3DPreview |
| **Manage Books** (`/admin/books`) | Teacher-facing, uses compact cards | Low priority; fix cropping for consistency if easy |

---

## 6. Out of Scope

- Using Three.js for the browsing grid itself (performance with ~5000 books)
- Redesigning admin screens (Manage Books, Report)
- Changing the PickButton design, selection logic, or Done button behaviour
- Backend or API changes (beyond adding `coverWidth`/`coverHeight` to book data)
- Multi-book 3D slider (only one book rendered at a time)
- Photorealistic rendering (stylized, lightweight approach)

---

## 7. Implementation Order

### Phase 1: Image Dimension Preprocessing

1. Write a small script to read each mock image's dimensions and add `coverWidth`/`coverHeight` to `data/books-sample.json`
2. Update the scraper to capture dimensions during real scraping runs

### Phase 2: CSS Grid Fixes

1. Add warm shadow tokens to `global.css`
2. Fix cover cropping in `BookCard.module.css` + apply warm shadows
3. Use `coverWidth/coverHeight` for aspect-ratio placeholders in `BookCard.jsx`
4. Add `align-items: start` to grid in `BookBrowsing.module.css`
5. Fix cover cropping in `ThankYou.module.css`
6. Visual verification at `/browse` and `/thanks`

### Phase 3: Install R3F Dependencies

Install `three`, `@react-three/fiber` (v9 for React 19), `@react-three/drei`, `maath`. Verify Vite dev server starts cleanly.

### Phase 4: Build 3D Book Components (bottom-up)

1. `pageGeometry.js` — geometry builder
2. `Book3DPage.jsx` — single page with bone animation + click-to-turn + emissive hover
3. `Book3D.jsx` — page assembly, spread UV splitting, sequential turning
4. `Book3DScene.jsx` — scene setup
5. `Book3DPreview.jsx` + CSS — dialog wrapper with arrow nav + PickButton

### Phase 5: Integration + Testing

1. Swap `BookCarousel` for `Book3DPreview` in `BookBrowsing.jsx` (lazy-loaded)
2. Test books with 0, 1, 2, and many interior spreads
3. Verify spread images display correctly (left half on left page, right half on right page)
4. Verify click-to-turn works alongside arrow buttons
5. Verify 1366x768 performance
6. Verify touch targets (arrows, pick, close all >= 48px)

### Phase 6: Cleanup

1. Delete `BookCarousel.jsx` + `BookCarousel.module.css`
2. Remove `embla-carousel-react` from `package.json`

Each phase is a commit point.

---

## 8. Performance

- **Code-split the 3D bundle** — `React.lazy(() => import('./components/book3d/Book3DPreview.jsx'))` so Three.js (~150-200KB gzipped) only loads on first book tap, not on initial grid load
- **One book at a time** — only one 3D book is ever rendered. Grid uses plain `<img>` tags with `loading="lazy"`
- **Texture cleanup** — when the dialog closes and Canvas unmounts, textures are disposed to prevent memory leaks
- **Shadow map** — 2048x2048 (reduce to 1024 if Chromebook testing shows issues)
- **Shared geometry** — all pages in one book share a single `BoxGeometry` instance via `useMemo`
- **CSS-only grid** — all grid transforms, transitions, and shadows use CSS. No JS animation libraries.

---

## 9. Cleanup Strategy

When the old carousel is no longer needed:

1. Delete `client/src/components/BookCarousel.jsx` + `BookCarousel.module.css`
2. Remove `embla-carousel-react` from `client/package.json`

Two touch points. The Book3DPreview is a drop-in replacement with identical props.

---

## 10. Success Criteria

- Every book cover in the browsing grid is visible in its entirety — no cropping.
- Tapping a book cover opens a 3D book dialog with realistic page-curl animation.
- Children can flip pages by tapping on them or using arrow buttons.
- Interior spread images display correctly — left half on left page, right half on right page.
- The PickButton works inside the 3D preview dialog.
- Performance on Chromebook hardware remains smooth — no dropped frames during page flipping.
- The browsing grid loads fast (Three.js is code-split, not in initial bundle).
- All student-facing screens show covers at their natural proportions.

---

## 11. Verification Steps

1. Run `npm run dev` and navigate to `/browse`
2. Confirm no cover cropping — compare square, portrait, and landscape covers
3. Confirm warm shadows on cards and hover effects
4. Confirm no layout shift as images load (aspect-ratio placeholders from `coverWidth/coverHeight`)
5. Tap a book cover — 3D book dialog should open with loading indicator then 3D book
6. Use arrow buttons to flip through pages — page-curl animation should be smooth
7. Click directly on a page to flip it — emissive highlight should appear on hover
8. Verify spread images: left half on left page, right half on right page when open
9. Verify PickButton works inside the 3D preview dialog
10. Close dialog (X button, backdrop click, Escape) — return to grid
11. Resize to 1366x768 — verify smooth scrolling and page-flip animation
12. Navigate to `/thanks` — confirm no cover cropping
13. Check browser console for errors/warnings
