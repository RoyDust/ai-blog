# Bookmarks Minimal Luxury Design

**Date:** 2026-03-08

**Goal:** Reframe the public bookmarks page as a private reading archive with a calm, premium, editorial feel instead of a standard post grid.

## Direction

The page should feel like a personal library rather than a dashboard. It should use strong whitespace, restrained color, clean typography hierarchy, and light structural framing. The interaction model stays simple: scan, revisit, and continue reading.

## Layout

- Use a narrow main container instead of the current broad 3-column blog grid.
- Keep a quiet header block at the top with:
  - primary title: `我的收藏`
  - one-sentence supporting copy about saving worthwhile reads
  - a subtle count of saved posts
- Present bookmarks in a reading-list layout instead of generic blog cards.
- Default to a single-column flow; optionally allow a comfortable two-column layout on very wide screens only if spacing remains generous.

## Item Design

Each saved item should read like an archive entry:

- Top row: category, date, and lightweight metadata
- Core: title with strong hierarchy, then a short excerpt/snippet
- Bottom row: soft utility info and a refined link/button to open the article
- Visual tone: low-noise border, subtle hover lift, minimal shadow, quiet separators

The design should not use bright chips, dense controls, or promotional card treatments.

## Empty State

The empty state should feel intentional and elegant:

- clear title indicating no saved posts yet
- a short sentence encouraging the user to collect pieces worth revisiting
- a single CTA to go browse articles, preferably `/posts`

Avoid loud illustration-heavy or dashboard-like empty states.

## Interaction

- Hover: slight border and shadow refinement only
- Focus: visible ring for keyboard users
- Motion: short and understated, respecting reduced-motion defaults
- Primary action stays obvious but visually restrained

## Scope

First implementation pass should focus on presentation only:

- redesign `src/app/(public)/bookmarks/page.tsx`
- introduce a dedicated bookmarks item component if needed
- preserve current data loading and auth flow
- do not expand into sorting, bulk actions, or organizer features yet

## Implementation Notes

- Reuse existing tokens and surface styles where possible
- Prefer neutral palette and brand accent only in small amounts
- Keep copy concise and human
- Ensure responsive quality at mobile, tablet, and desktop widths
