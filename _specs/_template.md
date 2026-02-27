---
type: product | technical | feature
status: draft | active | implemented | deprecated
created: YYYY-MM-DD
depends-on: filename-without-extension (optional, omit if none)
---

# Title — Spec Type

## 1. Overview

A brief paragraph framing what this spec covers, why it exists, and what outcome it aims for. Keep it to 2-4 sentences.

---

## 2. The Problem

What's wrong today? What gap or pain point does this address? Be concrete — describe what the user sees or experiences, not implementation details.

---

## 3. Goals

- **Goal one.** One sentence explaining what success looks like.
- **Goal two.** Another measurable or observable outcome.
- Keep this list short (3-6 items). Each goal should be verifiable.

---

## 4. Proposed Solution

Describe the solution in terms of what the user sees and does, not how it's built. For feature specs, this is the core section — walk through the experience step by step.

For product specs, this may describe the full product. For technical specs, replace this section with architecture, API contracts, schemas, etc.

---

## 5. Impact on Existing Screens

| Screen / Area | Current behaviour | Change needed |
|---------------|-------------------|---------------|
| Example screen | What it does now | What changes |

Omit this section if the spec is for a brand-new feature with no existing touchpoints.

---

## 6. Out of Scope

Bullet list of things this spec explicitly does NOT cover. Helps agents and contributors avoid scope creep.

---

## 7. Success Criteria

How do we know this is done and working? List observable, testable outcomes.

---

## 8. Open Questions

Decisions that haven't been made yet. Remove this section once all questions are resolved.

<!--
TEMPLATE INSTRUCTIONS (delete this block when using):

File naming:
  product-*.md   — High-level product specs (what and why)
  technical-*.md — Architecture and implementation (how)
  feature-*.md   — Individual feature explorations

Status values:
  draft        — Being written, not ready for implementation
  active       — Approved and ready for (or in) implementation
  implemented  — Fully built and shipped
  deprecated   — No longer relevant, kept for reference

After creating a new spec:
  1. Add it to _specs/README.md
  2. Update CLAUDE.md if agents need to read it before working
-->
