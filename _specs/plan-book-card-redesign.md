---
type: technical
status: active
created: 2026-02-27
depends-on: technical-book-card-redesign
---

# Book Card Redesign — Implementation Plan

## Context

The current `BookCard` forces all covers into a fixed 3:4 rectangle (`aspect-ratio: 3/4; object-fit: cover`), cropping books with square, landscape, or tall covers. Since children ages 4-6 choose books by cover art, this undermines the core experience. The book preview is a flat embla-carousel slideshow — functional but not immersive.

This plan has two tracks: (1) CSS grid fixes for natural cover proportions + warm shadows, and (2) a 3D interactive book preview using React Three Fiber with page-flipping animation, adapted from [r3f-animated-book-slider-final](https://github.com/wass08/r3f-animated-book-slider-final).

---

## Phase 1: Image Dimension Preprocessing

**Goal**: Add `coverWidth`/`coverHeight` to book data so the grid can set aspect-ratio placeholders and the 3D book can compute geometry proportions.

### 1A. Create `scripts/add-cover-dimensions.mjs`

Zero-dependency Node.js script that reads image headers to get dimensions:
- PNG: width at bytes 16-19, height at bytes 20-23 (big-endian UInt32 in IHDR chunk)
- WebP VP8: width at VP8+14 (LE UInt16 & 0x3FFF), height at VP8+16
- WebP VP8L: bit-packed at VP8L+9

Processes both `data/books-sample.json` and `data/books.json`. Idempotent.

Add `"add-dimensions": "node scripts/add-cover-dimensions.mjs"` to root `package.json`.

### 1B. Update scraper's `generateBooksJson`

In `scraper/lib/download-images.mjs` (lines 111-116), after building the entry object, read the cover image dimensions and add `coverWidth`/`coverHeight` so future scraper runs auto-include them.

### 1C. Vary mock image dimensions

Currently `scripts/generate-placeholders.mjs` (line 107) generates all covers at 300x400. Change a few to test grid variety:
- mock-011, mock-012: 400x400 (square — board books)
- mock-013, mock-014: 500x350 (landscape)
- mock-015: 250x450 (tall/narrow)

Re-run placeholder generator, then dimension script.

---

## Phase 2: CSS Grid Fixes

### 2A. Add warm shadow tokens to `global.css`

Add to `:root` block in `client/src/styles/global.css`:

```css
--shadow-warm-sm: 0 2px 8px rgba(139, 90, 43, 0.1), 0 4px 20px rgba(139, 90, 43, 0.06);
--shadow-warm-md: 0 4px 12px rgba(139, 90, 43, 0.14), 0 8px 28px rgba(139, 90, 43, 0.1);
--shadow-warm-lg: 0 8px 24px rgba(139, 90, 43, 0.18), 0 16px 40px rgba(139, 90, 43, 0.12);
```

### 2B. Fix cover cropping in `BookCard.module.css`

In `client/src/components/BookCard.module.css`:
- `.card` — replace `box-shadow` with `var(--shadow-warm-sm)`, hover with `var(--shadow-warm-md)`
- `.coverButton` — add `min-height: 120px` to prevent collapse during image load
- `.cover` — change to `width: 100%; height: auto; display: block;` (remove `aspect-ratio` and `object-fit`)

### 2C. Add aspect-ratio placeholder to `BookCard.jsx`

In `client/src/components/BookCard.jsx`, add inline `style` to `.coverButton`:
```jsx
style={book.coverWidth && book.coverHeight
  ? { aspectRatio: `${book.coverWidth} / ${book.coverHeight}` }
  : undefined}
```
This reserves space before images load, preventing layout shift. Falls back to `min-height: 120px` if dimensions are missing.

### 2D. Fix grid alignment in `BookBrowsing.module.css`

In `client/src/screens/BookBrowsing.module.css`, add `align-items: start` to `.grid` to prevent cards stretching to the tallest card in each row.

### 2E. Fix cover cropping in `ThankYou.module.css`

In `client/src/screens/ThankYou.module.css`:
- `.cover` — change to `width: 100%; height: auto; display: block;`
- `.bookCard` — change `width: 200px` to `max-width: 240px; flex: 0 1 auto;`, replace shadow with `var(--shadow-warm-md)`

---

## Phase 3: Install R3F Dependencies

Run from `client/`:
```bash
npm install three @react-three/fiber @react-three/drei maath
```

Expected versions: `three` ^0.170, `@react-three/fiber` ^9.x (React 19 support), `@react-three/drei` ^10.x, `maath` ^0.10.8.

Verify `npm run dev` starts cleanly with no version conflicts.

---

## Phase 4: Build 3D Book Components (bottom-up)

All new files in `client/src/components/book3d/`.

### 4A. `pageGeometry.js` — Shared geometry builder

Exports `createPageGeometry(pageWidth, pageHeight)`. Builds a `BoxGeometry` with 30 horizontal segments (`PAGE_DEPTH = 0.003`), translates by `pageWidth/2`, and attaches `skinIndex`/`skinWeight` buffer attributes for bone-based deformation. A **function** (not constant) so dimensions adapt per book. Consumed via `useMemo` in `Book3D`.

### 4B. `Book3DPage.jsx` — Single page with bone animation

One physical page as a `SkinnedMesh` with 31 bones. Adapted from tutorial's `Page` component.

Key adaptations:
- **Props instead of jotai**: receives `opened`, `bookClosed`, `totalPages`, `onTurn` as props
- **Dynamic textures**: uses drei's `useTexture` for front/back images, integrates with React Suspense
- **Spread UV splitting**: receives `frontHalf`/`backHalf` indicators (`'left'`, `'right'`, `'full'`). After `useTexture` loads the spread, clones the texture and sets `offset`/`repeat` (left: `offset(0,0) repeat(0.5,1)`, right: `offset(0.5,0) repeat(0.5,1)`)
- **Null textures**: pages with no image (e.g., back cover) use a plain warm `MeshStandardMaterial`
- **Bone animation**: kept from tutorial — `useFrame` with `easing.dampAngle` per bone, curve intensity formulas preserved
- **Click-to-turn + emissive hover**: kept — emissive orange highlight on pointer enter, click calls `onTurn`

### 4C. `Book3D.jsx` — Page assembly + sequential turning

Takes `{ book, currentPage, onTurn }` props. Builds pages array from book data using the spread-to-page mapping:

| Physical Page | Front Face | Back Face |
|---|---|---|
| 0 (cover) | `coverImage` (full) | `interiorImages[0]` left half |
| 1 | `interiorImages[0]` right half | `interiorImages[1]` left half |
| ... | pattern continues | ... |
| last | `interiorImages[N-1]` right half | plain material (back cover) |

Dynamic dimensions: `PAGE_HEIGHT = 1.71`, `pageWidth = PAGE_HEIGHT * (coverWidth / coverHeight)` with fallback to 1.28.

Sequential page turning via delayed `setDelayedPage` — 150ms per single step, 50ms when jumping multiple pages.

### 4D. `Book3DScene.jsx` — Scene setup

Everything inside `<Canvas>`. Renders:
- `<Float floatIntensity={0.3} rotationIntensity={0}>` — gentle vertical bob only
- `<Book3D>` component
- `<Environment preset="studio">` — ambient HDRI lighting
- `<directionalLight>` at `[2, 5, 2]`, intensity 2.5, 2048x2048 shadow map
- Ground plane with `<shadowMaterial opacity={0.2}>`
- **No OrbitControls** — fixed camera (too complex for ages 4-6)

### 4E. `Book3DPreview.jsx` + `Book3DPreview.module.css` — Dialog wrapper

Drop-in replacement for `BookCarousel`. Same props: `{ book, picked, onPick, onClose, shake }`.

Structure:
- Same `<dialog>` pattern: `showModal()`, backdrop click closes, Escape closes, `cancel` event handler
- Title bar with close button (48px)
- Canvas wrapper (`height: 50vh; min-height: 300px; max-height: 500px`)
- Inner `<Suspense fallback={<Loading />}>` around `<Canvas>` for texture loading
- Navigation: prev/next arrow buttons (56px circles) + page indicator text
- `<PickButton>` at bottom
- Background: `var(--color-bg)` (warm cream) instead of white

---

## Phase 5: Integration + Testing

### 5A. Swap carousel for lazy-loaded 3D preview

In `client/src/screens/BookBrowsing.jsx`:
- Replace `import BookCarousel` with `const Book3DPreview = lazy(() => import('../components/book3d/Book3DPreview.jsx'))`
- Wrap in `<Suspense fallback={null}>` — outer Suspense for chunk loading (dialog not visible yet)
- Props remain identical

This code-splits Three.js (~150-200KB gzipped) so it only loads on first book tap, not on initial grid load.

### 5B. Test matrix

| Configuration | Expected behavior |
|---|---|
| 0 interior images | Single page: cover front, plain back. Arrows disabled. |
| 1 interior image | 2 pages. Spread split: left half on cover back, right half on page 1 front. |
| 2 interior images | 3 pages. Sequential flipping. |
| 5+ interior images | Many pages. Fast sequential delays (50ms) when jumping. |
| Missing `coverWidth/coverHeight` | Falls back to default 1.28x1.71 geometry. |

### 5C. Verification

1. `npm run dev` → navigate to `/browse`
2. Confirm no cover cropping — compare square, portrait, landscape covers
3. Confirm warm shadows on cards and hover
4. Confirm no layout shift as images lazy-load
5. Tap a book → 3D preview opens with loading indicator then 3D book
6. Arrow buttons flip pages with smooth page-curl animation
7. Click directly on a page to flip it — emissive highlight on hover
8. Verify spread images: left half on left page, right half on right page
9. PickButton works inside 3D dialog
10. Close dialog (X, backdrop, Escape) → return to grid
11. Navigate to `/thanks` → confirm no cover cropping, warm shadows
12. Resize to 1366x768 → verify smooth scrolling and page-flip

---

## Phase 6: Cleanup

1. Delete `client/src/components/BookCarousel.jsx` + `BookCarousel.module.css`
2. `cd client && npm uninstall embla-carousel-react`

---

## Commit Strategy

1. "Add cover dimension preprocessing and vary mock image sizes" (Phase 1)
2. "Remove cover cropping and add warm shadows" (Phase 2)
3. "Install React Three Fiber and Three.js dependencies" (Phase 3)
4. "Add 3D book geometry and page components" (Phase 4A-4C)
5. "Add 3D book scene and preview dialog" (Phase 4D-4E)
6. "Replace carousel with 3D book preview" (Phase 5)
7. "Remove embla-carousel and old BookCarousel" (Phase 6)

---

## Critical Files

| File | Action |
|---|---|
| `scripts/add-cover-dimensions.mjs` | Create (new) |
| `scripts/generate-placeholders.mjs` | Edit (vary dimensions) |
| `scraper/lib/download-images.mjs` | Edit (add dimension capture at line 111-116) |
| `data/books-sample.json` | Generated (dimensions added by script) |
| `client/src/styles/global.css` | Edit (add shadow tokens) |
| `client/src/components/BookCard.jsx` | Edit (aspect-ratio placeholder) |
| `client/src/components/BookCard.module.css` | Edit (remove cropping, warm shadows) |
| `client/src/screens/BookBrowsing.jsx` | Edit (swap carousel import) |
| `client/src/screens/BookBrowsing.module.css` | Edit (align-items: start) |
| `client/src/screens/ThankYou.module.css` | Edit (remove cropping, warm shadows) |
| `client/src/components/book3d/*.jsx` | Create (5 new files) |
| `client/src/components/BookCarousel.jsx` | Delete (Phase 6) |
| `client/src/components/BookCarousel.module.css` | Delete (Phase 6) |

## Risk Areas

- **R3F v9 + React 19**: Low risk — R3F v9 explicitly supports React 19.0-19.2
- **Bone animation on Chromebooks**: Medium risk — 31 bones x N pages. Mitigation: only one book rendered, shared geometry, can reduce segments from 30→20 if needed
- **Spread UV correctness**: Medium risk — needs visual verification that halves map to correct pages
- **Texture memory**: Low risk — Canvas unmount disposes textures automatically
