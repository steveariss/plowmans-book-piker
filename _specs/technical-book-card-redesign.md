---
type: technical
status: draft
created: 2026-02-27
depends-on: feature-book-card-redesign
---

# Book Card Redesign — Technical Spec

## 1. Overview

This spec provides the implementation details for the book card redesign described in `feature-book-card-redesign.md`. The work has two phases: (1) build a temporary exploration page at `/explore` showing 5 design approaches side-by-side with real book data, and (2) after the team chooses a direction, apply that approach to the production screens.

This spec covers phase 1 — the exploration page — in full detail. Phase 2 (production application) is outlined but depends on which approach is chosen.

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

---

## 3. Goals

- **Build a comparison page** showing all 5 design approaches with real book data, fully interactive, togglable between overview and fullscreen views.
- **Zero cover cropping** in every approach — covers display at natural proportions.
- **CSS-only effects** — no JS animation libraries, no new dependencies.
- **Isolated code** — the exploration page and all its components can be deleted in 3 steps with zero side effects on production code.
- **Chromebook-smooth** — all effects performant at 1366x768 on modest hardware.

---

## 4. Proposed Solution

### 4.1 File Structure

All exploration code is isolated for clean deletion:

```
client/src/
  screens/
    Explore.jsx                     # NEW — exploration page
    Explore.module.css              # NEW
  components/
    explore/                        # NEW — entire dir deleted when done
      ExploreSection.jsx            # Section wrapper (heading + description + grid)
      ExploreSection.module.css
      ExploreNav.jsx                # View mode toggle + fullscreen prev/next
      ExploreNav.module.css
      TableBookCard.jsx             # Approach A: "Books on a Table"
      TableBookCard.module.css
      ShelfBookCard.jsx             # Approach B: "3D Bookshelf"
      ShelfBookCard.module.css
      FloatingBookCard.jsx          # Approach C: "Floating Books"
      FloatingBookCard.module.css
      EaselBookCard.jsx             # Approach D: "Storybook Easels"
      EaselBookCard.module.css
      CleanBookCard.jsx             # Approach E: "Simple and Clean"
      CleanBookCard.module.css
      MasonryGrid.jsx               # CSS column-count masonry layout
      MasonryGrid.module.css
      UniformRowGrid.jsx            # Fixed row height + flex layout
      UniformRowGrid.module.css
```

Files to modify:

| File | Change |
|------|--------|
| `client/src/App.jsx` | Add `/explore` route |
| `client/src/styles/global.css` | Add warm shadow design tokens |

### 4.2 Design Tokens

Add to `global.css` `:root` block:

```css
/* Warm shadows — book-like physical presence */
--shadow-warm-sm: 0 2px 8px rgba(139, 90, 43, 0.1), 0 4px 20px rgba(139, 90, 43, 0.06);
--shadow-warm-md: 0 4px 12px rgba(139, 90, 43, 0.14), 0 8px 28px rgba(139, 90, 43, 0.1);
--shadow-warm-lg: 0 8px 24px rgba(139, 90, 43, 0.18), 0 16px 40px rgba(139, 90, 43, 0.12);
```

### 4.3 Fixing Cover Aspect Ratio (CSS-only, no dimension metadata)

No changes to book data. The fix is purely CSS. Every exploration card component uses:

```css
.cover {
  width: 100%;
  height: auto;
  display: block;
}
```

The `<img>` renders at its natural proportions. Card heights vary per book. The grid layout strategy handles the varying heights.

The `.coverButton` retains `background: #f0f0f0` as a loading placeholder. Add `min-height: 120px` to prevent layout shift while images load.

### 4.4 Grid Layout Strategies

The spec requires at least 2 grid strategies. We implement all 3, paired with the approaches that best suit them.

#### Centered Grid (CSS Grid, equal-width columns)

**Used by:** Approaches A (Table), C (Floating), D (Easels)

Standard CSS Grid. Cards use `align-self: start` so they don't stretch to fill the tallest item in the row. Shorter covers have whitespace around them.

```css
.centeredGrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-lg);
}

@media (max-width: 1200px) {
  .centeredGrid { grid-template-columns: repeat(3, 1fr); }
}

@media (max-width: 900px) {
  .centeredGrid { grid-template-columns: repeat(2, 1fr); }
}
```

#### Masonry Grid (CSS multi-column)

**Used by:** Approach E (Simple and Clean)

CSS `column-count` for a Pinterest-style layout with no JS. Items fill top-to-bottom per column, which is acceptable for visual browsing.

```css
.masonryGrid {
  column-count: 4;
  column-gap: var(--spacing-lg);
}

.masonryItem {
  break-inside: avoid;
  margin-bottom: var(--spacing-lg);
}
```

Responsive: 3 columns at <=1200px, 2 at <=900px.

Component props: `{ books, CardComponent, cardProps }`.

#### Uniform Row Height (Flexbox)

**Used by:** Approach B (3D Bookshelf)

Flex rows with a fixed height (280px). Each image scales to fill the row height; width varies by cover proportion. For Approach B, each row gets a decorative shelf border (6px solid warm brown + subtle shadow).

```css
.row {
  display: flex;
  align-items: flex-end;
  gap: var(--spacing-lg);
  padding-bottom: 8px;
  border-bottom: 6px solid #C4A35A;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: var(--spacing-xl);
}
```

Component props: `{ books, CardComponent, cardProps, rowHeight }`.

### 4.5 The Five Approach Card Components

All share the same props interface: `{ book, picked, onPick, onPreview, shake, index }`.

All reuse the existing `PickButton` component. All render: cover image button -> title -> PickButton.

---

#### Approach A: "Books on a Table" — `TableBookCard`

**Visual:** Slight random tilt per card, warm directional shadows, organic scattered-table feel.

**Tilt logic:** Deterministic hash of `book.id` to produce rotation in range -3 to +3 degrees. Set as `--tilt` CSS custom property inline.

```jsx
const rotation = useMemo(() => {
  let hash = 0;
  for (const ch of book.id) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return (hash % 7) - 3; // -3 to +3 degrees
}, [book.id]);

// Set on card div: style={{ '--tilt': `${rotation}deg` }}
```

**CSS highlights:**

```css
.card {
  transform: rotate(var(--tilt));
  box-shadow: var(--shadow-warm-sm);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}

.card:hover {
  transform: rotate(var(--tilt)) translateY(-6px) scale(1.03);
  box-shadow: var(--shadow-warm-lg);
}
```

---

#### Approach B: "3D Bookshelf" — `ShelfBookCard`

**Visual:** 3D book with visible spine (left edge) and page edges (right side). Sits on a virtual shelf.

**Structure:**

```jsx
<div className={styles.bookWrapper}>        {/* perspective: 800px */}
  <div className={styles.book}>             {/* preserve-3d, rotateY(-5deg) */}
    <button className={styles.coverButton}> {/* cover image */}
      <img className={styles.cover} ... />
    </button>
  </div>
  <div className={styles.info}>...</div>
  <div className={styles.pickWrapper}>...</div>
</div>
```

**CSS highlights:**

```css
.book {
  position: relative;
  transform-style: preserve-3d;
  transform: rotateY(-5deg);
  transition: transform 0.3s ease;
}

.book:hover {
  transform: rotateY(-15deg);
}

/* Spine — left edge */
.book::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 16px;
  height: 100%;
  background: linear-gradient(to right, #8B6914, #A0822A);
  transform: rotateY(90deg) translateZ(0px) translateX(-8px);
  transform-origin: left center;
  border-radius: 2px 0 0 2px;
}

/* Page edges — right side */
.book::after {
  content: '';
  position: absolute;
  top: 4px;
  right: -6px;
  width: 6px;
  height: calc(100% - 8px);
  background: repeating-linear-gradient(
    to bottom,
    #f5f0e6 0px, #f5f0e6 1px,
    #e8e0d0 1px, #e8e0d0 2px
  );
  border-radius: 0 2px 2px 0;
}
```

---

#### Approach C: "Floating Books" — `FloatingBookCard`

**Visual:** Continuous gentle bobbing animation, each card at different rates. Soft rounded shadows.

**Animation timing:** Varied per card using `index` prop:

```jsx
const bobDuration = 3 + (index % 5) * 0.4;  // 3s to 4.6s
const bobDelay = (index % 7) * 0.3;          // 0s to 1.8s
// Set as: style={{ '--bob-duration': `${bobDuration}s`, '--bob-delay': `-${bobDelay}s` }}
```

**CSS highlights:**

```css
@keyframes bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

.card {
  box-shadow: var(--shadow-warm-sm);
  animation: bob var(--bob-duration) ease-in-out var(--bob-delay) infinite;
  transition: box-shadow 0.3s ease;
}

.card:hover {
  animation-play-state: paused;
  transform: translateY(-12px);
  box-shadow: var(--shadow-warm-lg);
}
```

---

#### Approach D: "Storybook Easels" — `EaselBookCard`

**Visual:** Cover propped on a small easel stand, tilted slightly. Stands straighter on hover.

**Structure:**

```jsx
<div className={styles.card}>
  <div className={styles.easelWrapper}>     {/* perspective: 600px */}
    <button className={styles.coverButton}> {/* rotateX(8deg), transform-origin: bottom center */}
      <img className={styles.cover} ... />
    </button>
    <div className={styles.easel} aria-hidden="true" />  {/* decorative stand */}
  </div>
  <div className={styles.info}>...</div>
  <div className={styles.pickWrapper}>...</div>
</div>
```

**CSS highlights:**

```css
.coverButton {
  transform: rotateX(8deg);
  transform-origin: bottom center;
  transition: transform 0.3s ease;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.coverButton:hover {
  transform: rotateX(2deg);  /* stands straighter */
}

/* Easel stand bar */
.easel {
  width: 40%;
  height: 12px;
  background: #C4A35A;
  border-radius: 0 0 4px 4px;
  margin-top: -2px;
  position: relative;
}

/* Easel legs */
.easel::before, .easel::after {
  content: '';
  position: absolute;
  bottom: -16px;
  width: 3px;
  height: 16px;
  background: #A0822A;
}
.easel::before { left: 20%; }
.easel::after { right: 20%; }
```

---

#### Approach E: "Simple and Clean" — `CleanBookCard`

**Visual:** No transforms, no animation. Natural cover dimensions with warmer, deeper shadow.

**CSS highlights:**

```css
.card {
  box-shadow: var(--shadow-warm-sm);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  break-inside: avoid;  /* for masonry column layout */
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-warm-md);
}
```

---

### 4.6 ExploreSection Component

Wrapper for one approach section. Renders:

1. **Heading** — approach name (e.g., "A: Books on a Table")
2. **Description** — one sentence summarizing the approach's character
3. **Grid** — the appropriate grid component with the approach's card component

Props: `{ name, description, books, CardComponent, GridComponent, gridProps, cardProps }`.

The section renders a `<section>` element with a heading and then either the centered grid (inline CSS grid styles), the MasonryGrid component, or the UniformRowGrid component, depending on the approach.

### 4.7 ExploreNav Component

Fixed bar at the top of the exploration page.

**View toggle:** Two buttons — "Overview" (all sections stacked) and "Full Screen" (one at a time).

**Fullscreen mode nav:** Previous/Next arrow buttons + section indicator (e.g., "2 of 5 — 3D Bookshelf"). Only visible in fullscreen mode.

Props: `{ viewMode, onViewModeChange, activeSection, onSectionChange, totalSections, activeName }`.

### 4.8 Explore Screen

**Route:** `/explore` in `App.jsx`.

**State:**
- `viewMode`: `'overview'` | `'fullscreen'`
- `activeSection`: `0`-`4` (index into approaches array)

**Books:** Loads via existing `useBooks()` hook. Selects first 12 books from the loaded set via `useMemo`. Real library data naturally includes diverse aspect ratios. If the first 12 don't provide enough variety, substitute a hardcoded list of specific book IDs.

**Interactivity:** Each section gets its own independent pick state from `useSelections()` so the team can test the pick/shake interactions in each approach without them interfering with each other.

**Approaches array:**

```jsx
const approaches = [
  { id: 'table', name: 'Books on a Table',
    desc: 'Covers scattered at slight random tilts, as if browsing books spread across a big table.',
    Card: TableBookCard, grid: 'centered' },
  { id: 'shelf', name: '3D Bookshelf',
    desc: 'Books rendered as 3D objects with visible spines and page edges, sitting on wooden shelves.',
    Card: ShelfBookCard, grid: 'uniform' },
  { id: 'floating', name: 'Floating Books',
    desc: 'Books float gently above the surface with a subtle bobbing animation.',
    Card: FloatingBookCard, grid: 'centered' },
  { id: 'easel', name: 'Storybook Easels',
    desc: 'Each book propped on a small easel stand, like a bookshop window display.',
    Card: EaselBookCard, grid: 'centered' },
  { id: 'clean', name: 'Simple and Clean',
    desc: 'No effects. Natural cover proportions in a masonry layout with warm shadows.',
    Card: CleanBookCard, grid: 'masonry' },
];
```

**Overview mode:** All 5 `ExploreSection` components stacked vertically with generous spacing.

**Fullscreen mode:** Single `ExploreSection` filling the viewport. Prev/next arrows navigate between approaches.

---

## 5. Impact on Existing Screens

Phase 1 (exploration page) only modifies 2 existing files:

| File | Change |
|------|--------|
| `client/src/App.jsx` | Add `import Explore` + `/explore` route |
| `client/src/styles/global.css` | Add 3 warm shadow custom properties |

No production screens are modified. The `/browse`, `/thanks`, and `/admin/books` pages are unchanged.

### Phase 2 Changes (after direction is chosen)

| File | Current | Change |
|------|---------|--------|
| `BookCard.module.css` | `aspect-ratio: 3/4; object-fit: cover` | `height: auto; display: block` + chosen approach's visual treatment |
| `BookBrowsing.module.css` | `repeat(6, 1fr)` CSS Grid | Chosen grid strategy + adjusted column counts |
| `ThankYou.module.css` | Fixed 200px width + 3:4 crop | `max-width: 240px; flex: 0 1 auto` + `height: auto` |
| `AdminBookCard.module.css` | `48x64, object-fit: cover` | `width: 48px; height: auto; max-height: 64px; object-fit: contain` |

---

## 6. Out of Scope

- Changing the carousel/preview modal design
- Redesigning admin screens (Manage Books, Report)
- Changing the Pick button design, selection logic, or Done button behaviour
- Backend or API changes
- Changes to the book data format or scraper output
- Phase 2 production rollout (separate work item after team review)

---

## 7. Performance

- **CSS-only effects.** All transforms, transitions, and animations use CSS. No JS animation libraries.
- **GPU-composited properties.** Animations use only `transform` and `opacity`. Box-shadow changes happen on hover only (one card at a time).
- **`loading="lazy"`** on every `<img>` tag — follow existing `BookCard` pattern.
- **No new dependencies.** Masonry uses CSS `column-count`. All effects are CSS Modules + custom properties.
- **Exploration page scope.** With only 12 books per section, performance is not a concern. Continuous bobbing (Approach C) and 3D compositing (Approach B) are fine at this scale.
- **Production considerations** (for Phase 2): Approach C's bobbing should be paused for off-screen cards via `IntersectionObserver` or `content-visibility: auto`. Approach B's `preserve-3d` stacking contexts should be tested with the full ~5k book dataset on Chromebook hardware.

---

## 8. Cleanup Strategy

When the exploration page is no longer needed:

1. Delete `client/src/components/explore/` (entire directory — all approach cards, grids, section, nav)
2. Delete `client/src/screens/Explore.jsx` + `Explore.module.css`
3. Remove `/explore` route + import from `App.jsx`

Three touch points. No exploration code leaks into production components. The exploration cards import `PickButton` and `useBooks` (read-only), but nothing imports from them.

---

## 9. Implementation Order

| Step | Task | Files |
|------|------|-------|
| 1 | Add warm shadow tokens | `global.css` |
| 2 | Build MasonryGrid + UniformRowGrid | `explore/MasonryGrid.*`, `explore/UniformRowGrid.*` |
| 3 | Build Approach A: TableBookCard | `explore/TableBookCard.*` |
| 4 | Build Approach B: ShelfBookCard | `explore/ShelfBookCard.*` |
| 5 | Build Approach C: FloatingBookCard | `explore/FloatingBookCard.*` |
| 6 | Build Approach D: EaselBookCard | `explore/EaselBookCard.*` |
| 7 | Build Approach E: CleanBookCard | `explore/CleanBookCard.*` |
| 8 | Build ExploreSection + ExploreNav | `explore/ExploreSection.*`, `explore/ExploreNav.*` |
| 9 | Build Explore screen + add route | `screens/Explore.*`, `App.jsx` |
| 10 | Test with real data at `/explore` | — |

Each step is a commit point.

---

## 10. Success Criteria

- Every cover in every approach section is displayed in full — no cropping.
- All 5 approaches are visible on the exploration page with real book data including diverse aspect ratios.
- Hover/touch interactions work in every section (lift, tilt, bob, shadow changes, pick/shake).
- The Overview / Full Screen toggle works correctly.
- Performance is smooth at 1366x768 — no dropped frames during scrolling or hover animations.
- The existing `/browse`, `/thanks`, and admin screens are completely unchanged.
- The exploration page can be cleanly removed by deleting the 3 touch points listed in Section 8.

---

## 11. Verification Steps

1. Run `npm run dev` and navigate to `http://localhost:5173/explore`
2. Confirm all 5 sections render 12 books with diverse cover shapes
3. In each section, verify no cover artwork is cropped — compare visually with the same books at `/browse`
4. Test hover effects in each section: A (lift + scale), B (tilt forward), C (pause bob + rise), D (stand straighter), E (lift)
5. Test pick/shake interactions in each section
6. Toggle between Overview and Full Screen modes; navigate between approaches in fullscreen
7. Resize browser to 1366x768; verify smooth scrolling and animations
8. Navigate to `/browse` and `/thanks` — confirm they are unchanged
9. Verify no console errors or warnings
