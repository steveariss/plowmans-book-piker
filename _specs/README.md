# Specs

Specification documents for the Book Picker project. Read this index first to find the right spec for your task.

## Naming Convention

| Prefix | Purpose | Example |
|--------|---------|---------|
| `product-*` | High-level product specs (what and why) | `product-book-picker.md` |
| `technical-*` | Architecture and implementation (how) | `technical-book-picker.md` |
| `feature-*` | Individual feature explorations | `feature-book-card-redesign.md` |

## Status Key

| Status | Meaning |
|--------|---------|
| `draft` | Being written, not ready for implementation |
| `active` | Approved and ready for (or in) implementation |
| `implemented` | Fully built and shipped |
| `deprecated` | No longer relevant, kept for reference |

## Spec Index

| File | Type | Status | Description |
|------|------|--------|-------------|
| [product-book-picker.md](product-book-picker.md) | product | active | Core product requirements, user flows, and UI/UX details |
| [technical-book-picker.md](technical-book-picker.md) | technical | active | Tech stack, architecture, API contract, DB schema, implementation phases |
| [feature-book-card-redesign.md](feature-book-card-redesign.md) | feature | draft | Redesign book cards to stop cropping covers, make books feel more real |
| [feature-image-webp-conversion.md](feature-image-webp-conversion.md) | feature | draft | Convert scraped JPEG images to WebP to reduce storage and bandwidth |

## Creating a New Spec

1. Copy `_template.md` and rename it with the appropriate prefix
2. Fill in the frontmatter (type, status, created date, dependencies)
3. Add an entry to the Spec Index table above
4. If agents should read the spec before working, reference it in `CLAUDE.md`
