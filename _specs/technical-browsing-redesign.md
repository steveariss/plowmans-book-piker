---
type: technical
status: implemented
created: 2026-03-03
depends-on: feature-browsing-redesign
---

# Browsing Redesign: Bookshelf UX — Technical Spec

## 1. Overview

Implementation plan for the bookshelf browsing redesign described in `feature-browsing-redesign.md`. This spec covers the virtualization strategy, component architecture, CSS approach, and phased implementation order. The goal is to transform the flat book grid into a virtualized bookshelf while preserving all existing selection logic and the 3D preview modal.

---

## 2. The Problem

The current browsing page renders every book (~973 now, up to ~5,174 after full scrape) in a single CSS grid with no virtualization. Each `BookCard` includes a cover image, title text, and a 72px `PickButton` — all multiplied across every book in the DOM. The bookshelf redesign adds even more DOM per book (shelf planks, decorative chains, two-sided flip signs), making virtualization essential for acceptable performance on Chromebook hardware.

Additionally, `@tanstack/react-virtual` is already a project dependency (used in ManageBooks) but is not leveraged on the browsing page. This redesign corrects that.

---

## 3. Goals

- **Virtualize the browsing page.** Only render shelf rows visible in the viewport plus a small overscan buffer, using `@tanstack/react-virtual`.
- **Match the existing virtualizer pattern.** Follow the `useVirtualizer` setup already established in `ManageBooks.jsx` (container ref, `estimateSize`, `overscan`, absolute positioning).
- **Preserve all existing hooks and selection logic.** `useBooks`, `useSelections`, and `saveSelections` remain unchanged — the new components consume the same interfaces.
- **No deletions.** `BookCard` and `PickButton` are still used by ThankYou and Book3DPreview respectively. New shelf components are additions, not replacements.
- **Support all 5 responsive breakpoints.** The shelf layout adapts from 2 to 6 books per row across viewport sizes.

---

## 4. Architecture

### 4.1 Virtualization Strategy

Virtualize **shelf rows**, not individual books. Each virtual item represents one complete shelf row containing N book slots, the wooden shelf graphic, and N hanging signs. This matches the standard `useVirtualizer` flat-list pattern — each item is a row.

**Why row-based:** `@tanstack/react-virtual` virtualizes a flat list. To create a grid, each virtual item must represent one full row. The alternative (nested horizontal + vertical virtualizers) is complex and unnecessary.

### 4.2 New Hook: `useShelfLayout`

**File:** `client/src/hooks/useShelfLayout.js`

Responsible for measuring the scroll container, computing the responsive column count, chunking the book array into rows, and providing the estimated row height for the virtualizer.

**Signature:**

```js
function useShelfLayout(containerRef, books) {
  // Returns:
  //   rows:              Array<Array<book>>  — books chunked into shelf rows
  //   booksPerRow:       number              — current column count
  //   estimatedRowHeight: number             — pixel height for virtualizer
}
```

**Responsive breakpoints** (matching the feature spec §4.4):

| Container Width | Books Per Row |
| --------------- | ------------- |
| >= 1600px       | 6             |
| >= 1200px       | 5             |
| >= 800px        | 4             |
| >= 500px        | 3             |
| < 500px         | 2             |

**Implementation details:**

- Use `ResizeObserver` on `containerRef` to read container width
- Debounce the observer callback at 100ms to avoid thrashing during window resize
- Row chunking: `Array.from({ length: Math.ceil(books.length / booksPerRow) }, (_, i) => books.slice(i * booksPerRow, (i + 1) * booksPerRow))`
- Estimated row height formula: `coverHeight + shelfHeight + chainHeight + signHeight + rowGap` where `coverHeight = (containerWidth / booksPerRow) * 1.33` (3:4 aspect ratio). At 1366px Chromebook width with 5 columns, this is roughly `(1366 / 5) * 1.33 + 20 + 8 + 48 + 16 ≈ 455px`
- When `booksPerRow` changes (resize), the `rows` array and `estimatedRowHeight` update, which triggers virtualizer re-layout automatically since `count` and `estimateSize` are reactive

### 4.3 Virtualizer Setup

Located inside the `BookShelf` component. Follows the same pattern as `ManageBooks.jsx` lines 55-60:

```js
const virtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => estimatedRowHeight,
  overscan: 3,
});
```

**Why `useVirtualizer` (not `useWindowVirtualizer`):** The browsing page has a sticky SelectionCounter at the top and a fixed DoneButton at the bottom. A container-based virtualizer with a scroll ref gives precise control over the scrollable area between these fixed elements. This matches the ManageBooks pattern.

**Overscan of 3:** Each shelf row contains 2-6 books. With 3 extra rows above and below, roughly 6-18 extra books are pre-rendered off-screen. This ensures smooth scrolling without over-rendering.

**Rendering pattern** (same as ManageBooks lines 198-227):

```jsx
<div ref={scrollRef} className={styles.scrollContainer}>
  <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
    {virtualizer.getVirtualItems().map((virtualItem) => (
      <div
        key={virtualItem.index}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          transform: `translateY(${virtualItem.start}px)`,
        }}
      >
        <ShelfRow books={rows[virtualItem.index]} ... />
      </div>
    ))}
  </div>
</div>
```

### 4.4 Component Hierarchy

```text
BookBrowsing (screen — modified)
├── SelectionCounter          (unchanged, sticky)
├── BookShelf                 (NEW — virtualized scroll container)
│   └── ShelfRow              (NEW — one per virtual row)
│       ├── div.booksZone     (CSS grid of ShelfBook components)
│       │   └── ShelfBook[]   (NEW — cover image only, 3D lean)
│       ├── div.shelf         (CSS-only shelf plank visual)
│       └── div.signsZone     (CSS grid of HangingSign components)
│           └── HangingSign[] (NEW — replaces PickButton on shelf)
├── DoneButton                (unchanged, fixed at bottom)
└── Book3DPreview             (unchanged, opened via onPreview callback)
```

### 4.5 Component Contracts

**BookShelf** — `client/src/components/shelf/BookShelf.jsx`

```js
function BookShelf({ books, selectedIds, shakeId, onPick, onPreview })
```

- Creates scroll container ref
- Calls `useShelfLayout(scrollRef, books)` to get `rows`, `booksPerRow`, `estimatedRowHeight`
- Calls `useVirtualizer` with row count, estimated size, overscan 3
- Renders virtual list wrapper with absolutely-positioned `ShelfRow` children
- Scroll container fills available vertical space between SelectionCounter and DoneButton

**ShelfRow** — `client/src/components/shelf/ShelfRow.jsx`

```js
function ShelfRow({ books, selectedIds, shakeId, onPick, onPreview, booksPerRow })
```

- `books` is the subset for this row (1 to N items; last row may be partial)
- `booksPerRow` sets the CSS grid column count via inline style so partial rows don't stretch
- Renders three zones vertically: books grid, shelf plank, signs grid
- Books grid and signs grid share the same `grid-template-columns: repeat(booksPerRow, 1fr)` so signs align directly below their books
- Wrap in `React.memo` with a custom comparator that checks: `books` reference, `booksPerRow`, and whether any book in this row is affected by `selectedIds` or `shakeId`

**ShelfBook** — `client/src/components/shelf/ShelfBook.jsx`

```js
function ShelfBook({ book, onPreview })
```

- Cover image inside a `<button>` — tapping opens the 3D preview modal
- No title text visible (titles only appear in the modal)
- `aria-label={`Preview ${book.title}`}` for accessibility since title is visually hidden
- CSS 3D lean-back at rest, lean-forward on hover (see §5.1)
- `loading="lazy"` and `decoding="async"` on the `<img>`
- Wrap in `React.memo` — props are stable (book object, onPreview callback)

**HangingSign** — `client/src/components/shelf/HangingSign.jsx`

```js
function HangingSign({ bookId, title, picked, shake, onPick })
```

- Two decorative chain elements at top (CSS pseudo-elements or small divs)
- Two-sided sign body with front face and back face
- **Front face (unpicked):** Star icon only (no text) — large enough for pre-readers to recognize
- **Back face (picked):** Green background with white checkmark icon
- 3D flip animation (`rotateY(180deg)`) when `picked` is true (see §5.3)
- Shake animation when `shake` is true (see §5.4)
- `aria-pressed={picked}` and `aria-label={picked ? `Remove ${title} from picks` : `Pick ${title}`}` for accessibility
- `min-height: 48px` and `min-width: 48px` to meet touch target requirement
- `onClick={() => onPick(bookId)}`
- Wrap in `React.memo` — re-renders only when `picked` or `shake` changes

### 4.6 Props Flow

```text
BookBrowsing
  └→ BookShelf: books, selectedIds, shakeId, onPick, onPreview
       └→ ShelfRow: books (row subset), selectedIds, shakeId, onPick, onPreview, booksPerRow
            ├→ ShelfBook: book, onPreview
            └→ HangingSign: bookId, title, picked, shake, onPick
```

Three levels of prop drilling. Context is unnecessary at this depth. The `selectedIds` Set passes by reference and only changes on toggle. The `shakeId` changes briefly (400ms) and only affects one HangingSign.

### 4.7 Integration into BookBrowsing

The `BookBrowsing.jsx` screen changes minimally:

**Before:**

```jsx
import BookCard from '../components/BookCard.jsx';
// ...
<div className={styles.grid}>
  {books.map((book) => (
    <BookCard key={book.id} book={book} picked={...} shake={...} onPick={...} onPreview={...} />
  ))}
</div>
```

**After:**

```jsx
import BookShelf from '../components/shelf/BookShelf.jsx';
// ...
<BookShelf
  books={books}
  selectedIds={selectedIds}
  shakeId={shakeId}
  onPick={toggleSelection}
  onPreview={handlePreview}
/>
```

Everything else in `BookBrowsing.jsx` stays the same: `useBooks`, `useSelections`, `handleDone`, `handlePreview`, `SelectionCounter`, `DoneButton`, `Book3DPreview`.

---

## 5. CSS Architecture

All new styles use CSS Modules (`.module.css` files alongside their components), consistent with the existing codebase pattern.

### 5.1 ShelfBook — 3D Lean Effect

The book leans slightly backward at rest (propped on shelf) and forward on hover (child pulling it toward them).

```css
.bookWrapper {
  perspective: 600px;
  display: flex;
  justify-content: center;
}

.coverButton {
  display: block;
  border: none;
  background: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transform-style: preserve-3d;
  transform-origin: bottom center;
  transform: rotateX(6deg);
  transition: transform 0.3s ease;
}

.coverButton:hover,
.coverButton:active {
  transform: rotateX(-3deg) scale(1.03);
}

.cover {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 4px;
  box-shadow:
    0 10px 20px -5px rgba(0, 0, 0, 0.3),
    0 4px 8px -4px rgba(0, 0, 0, 0.2);
}
```

- `perspective: 600px` — moderate depth creates subtle 3D without extreme foreshortening
- `rotateX(6deg)` — gentle backward lean, doesn't obscure cover art
- `rotateX(-3deg) scale(1.03)` on hover — book tips forward slightly, feels like pulling it off the shelf
- `transform-origin: bottom center` — pivots at the shelf surface where the book sits

### 5.2 Shelf Plank

A CSS-only wooden ledge with a front face and top surface, spanning full row width.

```css
.shelf {
  position: relative;
  width: 100%;
  height: var(--shelf-height);
  background: linear-gradient(180deg, var(--shelf-front-start) 0%, var(--shelf-front-end) 100%);
  border-radius: 0 0 4px 4px;
  box-shadow: var(--shelf-shadow);
}

.shelf::before {
  content: '';
  position: absolute;
  top: -8px;
  left: -2px;
  right: -2px;
  height: 10px;
  background: linear-gradient(180deg, var(--shelf-top-highlight) 0%, var(--shelf-top) 100%);
  border-radius: 2px 2px 0 0;
}
```

The shelf is purely decorative. No interactivity, no ARIA roles needed.

### 5.3 HangingSign — Chain + 3D Flip

Two short chains connect the sign to the shelf edge. The sign flips 180 degrees on the Y axis when picked.

```css
.signContainer {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.chains {
  display: flex;
  justify-content: center;
  gap: 20px;
  height: var(--chain-height);
}

.chain {
  width: 2px;
  height: var(--chain-height);
  background: var(--chain-color);
  border-radius: 1px;
}

.sign {
  perspective: 800px;
  min-width: var(--sign-min-size);
  min-height: var(--sign-min-size);
}

.signInner {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.5s ease;
  transform-style: preserve-3d;
}

.picked .signInner {
  transform: rotateY(180deg);
}

.signFront,
.signBack {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  backface-visibility: hidden;
  border-radius: 8px;
  font-size: 24px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  padding: var(--spacing-xs) var(--spacing-md);
  min-height: var(--sign-min-size);
}

.signFront {
  background: var(--sign-bg);
  border: 2px solid var(--sign-border);
}

.signBack {
  transform: rotateY(180deg);
  background: var(--sign-picked-bg);
  color: white;
  border: 2px solid var(--sign-picked-border);
}
```

### 5.4 Animations

**Bounce on pick** (reuse concept from existing PickButton):

```css
.picked .signInner {
  animation: signBounce 0.3s ease, signFlip 0.5s ease forwards;
}

@keyframes signBounce {
  0%, 100% { scale: 1; }
  50% { scale: 1.1; }
}
```

**Shake at limit** (same pattern as existing PickButton shake):

```css
.shake .signInner {
  animation: signShake 0.4s ease;
}

@keyframes signShake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}
```

**Combined picked + shake** (shake while flipped — need combined transform):

```css
.picked.shake .signInner {
  animation: signShakePicked 0.4s ease;
}

@keyframes signShakePicked {
  0%, 100% { transform: rotateY(180deg) translateX(0); }
  25% { transform: rotateY(180deg) translateX(-5px); }
  75% { transform: rotateY(180deg) translateX(5px); }
}
```

### 5.5 ShelfRow Layout

```css
.row {
  padding: 0 var(--spacing-md);
}

.booksZone {
  display: grid;
  gap: var(--spacing-md);
  align-items: end;
  padding: 0 var(--spacing-sm);
}

.signsZone {
  display: grid;
  gap: var(--spacing-md);
  padding: var(--spacing-xs) var(--spacing-sm) 0;
  justify-items: center;
}

.rowBottom {
  height: var(--spacing-md);
}
```

Both `.booksZone` and `.signsZone` receive `grid-template-columns: repeat(N, 1fr)` via inline style from the `booksPerRow` prop. This ensures each hanging sign aligns directly below its book.

### 5.6 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .coverButton {
    transform: none;
    transition: none;
  }

  .signInner {
    transition: none;
  }

  .picked .signInner,
  .shake .signInner,
  .picked.shake .signInner {
    animation: none;
  }
}
```

---

## 6. Design Token Additions

Add to `:root` in `client/src/styles/global.css`:

```css
/* Bookshelf tokens */
--shelf-height: 20px;
--shelf-front-start: #c9a66b;
--shelf-front-end: #8b6914;
--shelf-top: #c9a66b;
--shelf-top-highlight: #d4b07a;
--shelf-shadow: 0 4px 8px rgba(139, 90, 43, 0.15);
--chain-color: #8b8b8b;
--chain-height: 8px;
--sign-bg: #f5e6c8;
--sign-border: #a87d45;
--sign-picked-bg: var(--color-primary);
--sign-picked-border: var(--color-primary-hover);
--sign-min-size: 48px;
```

These warm brown/cream tones complement the existing `--color-bg: #FFF8E1` warm cream background. The implementer should adjust exact hex values if the shelf feels too dark or too light against the background — visual tuning is expected.

---

## 7. File Changes

### New Files

| File | Purpose |
| ---- | ------- |
| `client/src/hooks/useShelfLayout.js` | Responsive row chunking + estimated height |
| `client/src/components/shelf/BookShelf.jsx` | Virtualized scroll container |
| `client/src/components/shelf/BookShelf.module.css` | Scroll container + virtual wrapper styles |
| `client/src/components/shelf/ShelfRow.jsx` | One row: books grid + plank + signs grid |
| `client/src/components/shelf/ShelfRow.module.css` | Row layout, shelf plank CSS |
| `client/src/components/shelf/ShelfBook.jsx` | Single book cover with 3D lean |
| `client/src/components/shelf/ShelfBook.module.css` | Perspective transforms, hover effects |
| `client/src/components/shelf/HangingSign.jsx` | Flip sign replacing PickButton |
| `client/src/components/shelf/HangingSign.module.css` | Chain, sign faces, flip/shake animations |

### Modified Files

| File | Change |
| ---- | ------ |
| `client/src/screens/BookBrowsing.jsx` | Replace `BookCard` import and grid `<div>` with `<BookShelf>` component |
| `client/src/screens/BookBrowsing.module.css` | Remove `.grid` rule; adjust `.container` to flex column layout for scroll container |
| `client/src/styles/global.css` | Add bookshelf design tokens to `:root` (see §6) |

### Unchanged Files (Do Not Modify)

| File | Reason |
| ---- | ------ |
| `client/src/components/BookCard.jsx` + CSS | Still used by ThankYou screen |
| `client/src/components/PickButton.jsx` + CSS | Still used inside Book3DPreview modal |
| `client/src/hooks/useSelections.js` | Interface unchanged — same outputs consumed by BookShelf |
| `client/src/hooks/useBooks.js` | Interface unchanged |
| `client/src/components/SelectionCounter.jsx` | Unchanged, still sticky at top |
| `client/src/components/DoneButton.jsx` | Unchanged, still fixed at bottom |
| `client/src/components/BookCarousel.jsx` | Unchanged, still opened on cover tap |
| `client/src/screens/ManageBooks.jsx` | Admin page, unrelated to this redesign |

### No New Dependencies

`@tanstack/react-virtual@^3.13.19` is already in `client/package.json`.

---

## 8. Performance

### 8.1 DOM Reduction

**Before (no virtualization):** ~973 books x (img + cover button + h3 + PickButton) = ~4,800+ DOM nodes.

**After (virtualized, 5 books/row, ~3 visible + 6 overscan rows = 9 rows):** 9 rows x 5 books x ~6 elements each = ~270 DOM nodes. An **18x reduction**.

### 8.2 GPU Layers

Each element with `transform` or `perspective` creates a compositing layer. With ~45 visible books:

- 45 book cover layers (perspective + rotateX)
- 45 sign layers (perspective + rotateY on flip)
- ~90 total GPU layers

This is well within Chromebook GPU capabilities. Without virtualization, it would be ~2,000 layers.

### 8.3 Image Loading

- Keep `loading="lazy"` on all `<img>` tags — the virtualizer only mounts images when the row enters the overscan zone
- Add `decoding="async"` to avoid blocking the main thread during image decode
- Cover images are already WebP format (per the image-webp-conversion spec)

### 8.4 Memoization

- `ShelfRow`: `React.memo` with custom comparator. Only re-render when a book in this row is affected by `selectedIds` or `shakeId` changes. Most rows skip re-render on pick.
- `ShelfBook`: `React.memo` — receives stable `book` object and `onPreview` callback. Rarely re-renders.
- `HangingSign`: `React.memo` — re-renders only when its specific `picked` or `shake` prop changes.

### 8.5 Scroll Performance

- Virtualizer uses `transform: translateY()` for row positioning — GPU-composited, no layout recalculation
- Shelf plank uses `box-shadow` and gradients, which are composited once and cached
- Avoid `filter: drop-shadow()` on shelf elements (forces per-frame recompositing)
- Do NOT set `will-change: transform` permanently on all books — only let the browser auto-promote elements with active transitions

### 8.6 ResizeObserver

Debounced at 100ms. When `booksPerRow` changes, the rows array is re-sliced (slicing 973 items into ~195 rows takes microseconds) and the virtualizer re-measures automatically.

---

## 9. Accessibility

### 9.1 Keyboard Navigation

Two focusable targets per book (same as current BookCard pattern):

1. **ShelfBook cover button:** `<button aria-label="Preview {book.title}">` — Enter/Space opens 3D modal
2. **HangingSign button:** `<button aria-pressed={picked} aria-label="...">` — Enter/Space toggles selection

### 9.2 ARIA Labels

Since book titles are visually hidden (not rendered on the shelf), both the cover button and the hanging sign **must** include the book title in their `aria-label`. This is critical — without visible titles, accessibility depends entirely on ARIA.

- Cover button: `aria-label="Preview {book.title}"`
- HangingSign (unpicked): `aria-label="Pick {book.title}"`
- HangingSign (picked): `aria-label="Remove {book.title} from picks"`

### 9.3 Virtual List Structure

- Scroll container: `role="list"`
- Each ShelfRow wrapper: `role="listitem"`
- This gives screen readers structural context for the virtualized content

### 9.4 Focus and Virtualization

When rows are virtualized, focus can be lost if the focused element scrolls out of the DOM. The overscan of 3 rows mitigates this for normal use. For the ages 4-6 audience, touch/mouse is the primary interaction mode, so this is an acceptable trade-off.

### 9.5 Reduced Motion

All 3D transforms and flip/shake/bounce animations are disabled via `prefers-reduced-motion: reduce` (see §5.6). The sign still changes visually (color/icon swap) without animation.

---

## 10. Implementation Phases

Each phase should be completed, tested, and committed before moving to the next.

### Phase 1: `useShelfLayout` Hook

Create `client/src/hooks/useShelfLayout.js`:

- `ResizeObserver` with 100ms debounce on container ref
- Breakpoint logic (5 breakpoints: 6/5/4/3/2 columns)
- Row chunking from flat book array
- Estimated row height calculation
- Edge cases: empty books array, container not yet mounted
- **Verify:** Log output from BookBrowsing at different window widths — row counts and booksPerRow should match breakpoints

### Phase 2: ShelfBook Component

Create `client/src/components/shelf/ShelfBook.jsx` + `ShelfBook.module.css`:

- Cover image in a `<button>` with `aria-label`
- 3D perspective lean-back at rest, lean-forward on hover
- `loading="lazy"`, `decoding="async"` on img
- `React.memo` wrapper
- `prefers-reduced-motion` support
- **Verify:** Temporarily render a few ShelfBooks in BookBrowsing to confirm the lean effect

### Phase 3: HangingSign Component

Create `client/src/components/shelf/HangingSign.jsx` + `HangingSign.module.css`:

- Two chain elements + two-sided sign body
- Front face: star icon (no text)
- Back face: checkmark icon on green background
- 3D flip animation on `picked`
- Shake animation on `shake`
- Combined picked+shake keyframes
- `aria-pressed`, `aria-label` with book title
- 48px minimum touch target
- `React.memo` wrapper
- **Verify:** Render a few HangingSigns with toggle state to confirm flip and shake

### Phase 4: ShelfRow Component

Create `client/src/components/shelf/ShelfRow.jsx` + `ShelfRow.module.css`:

- Books grid zone (ShelfBook children)
- Shelf plank (CSS gradient wood with top surface pseudo-element)
- Signs grid zone (HangingSign children)
- Inline grid-template-columns from `booksPerRow` prop
- `React.memo` with custom comparator
- Handle partial last row (empty grid cells leave natural space)
- **Verify:** Render a few ShelfRows with mock data to confirm alignment of signs under books

### Phase 5: BookShelf Component

Create `client/src/components/shelf/BookShelf.jsx` + `BookShelf.module.css`:

- Scroll container div with ref
- Call `useShelfLayout` for rows and layout info
- Call `useVirtualizer` with row count, estimated size, overscan 3
- Render virtual list wrapper (relative container with total height)
- Map virtual items to absolutely-positioned ShelfRow components
- Scroll container: `overflow-y: auto`, fills remaining vertical space
- **Verify:** Render BookShelf standalone with the full books array — scroll through all shelves, confirm virtualization works

### Phase 6: Integration

Modify `client/src/screens/BookBrowsing.jsx`:

- Replace `import BookCard` with `import BookShelf`
- Replace grid div + BookCard map with `<BookShelf>` component
- Adjust container CSS to `display: flex; flex-direction: column; height: 100vh` so BookShelf fills remaining space

Modify `client/src/screens/BookBrowsing.module.css`:

- Remove `.grid` rule entirely
- Adjust `.container` for flex column layout

Modify `client/src/styles/global.css`:

- Add bookshelf design tokens to `:root` (§6)

**Verify full flow:**

- SelectionCounter stays sticky at top
- DoneButton stays fixed at bottom and slides up when 2 picked
- Tapping a book cover opens 3D preview modal
- Picking from the hanging sign updates the sign (flip) and counter
- Picking from inside the 3D modal updates the corresponding hanging sign
- Shake on 3rd pick attempt
- Navigate to /thanks works with selected books

### Phase 7: Polish + Chromebook Testing

- Test at 1366x768 resolution (Chromebook target)
- Verify smooth scrolling with all ~973 books
- Verify all touch targets >= 48px
- Test `prefers-reduced-motion` disables animations
- Test keyboard tab navigation through visible books
- Verify partial last row looks correct (books left-aligned, shelf spans full width)
- Tune shelf wood color against the warm cream background
- Test rapid scroll (fling gesture) — virtualizer should keep up
- Test window resize — rows reflow, shelf rows adjust column count
- Verify no console errors or React warnings

---

## 11. Open Questions

- **Shelf color tuning:** The proposed wood gradient (`#c9a66b` → `#8b6914`) should be tested against the warm cream background (`#FFF8E1`). Adjust during Phase 7 if the contrast feels wrong.
- **Shelf top surface:** The `::before` pseudo-element creates a 3D-looking top surface via perspective transform. If this looks odd at certain sizes, a simpler flat rectangle with a lighter shade is an acceptable fallback.
- **6 columns at 1600px+:** On the Chromebook target (1366px) this breakpoint never triggers, so it only applies on larger monitors. Consider whether 6 columns makes books too small. Test during Phase 7 and potentially cap at 5 if needed.
