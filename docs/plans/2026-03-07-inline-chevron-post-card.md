# Inline Chevron Post Card Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the post card chevron always visible and place it inline after the title text.

**Architecture:** Simplify the title link layout in `PostCard` by removing absolute-positioned chevrons and rendering a single inline chevron inside the title row. Update the existing frontend card test to assert inline layout classes rather than absolute centering classes.

**Tech Stack:** React, Tailwind CSS, Vitest, Testing Library.

---

### Task 1: Inline chevron title row

**Files:**
- Modify: `src/components/blog/PostCard.tsx`
- Modify: `src/app/__tests__/frontend-listing-style.test.tsx`

**Step 1: Write the failing test**
- Verify the title row renders a chevron with inline layout classes instead of absolute positioning.
- Verify the title text remains clamped to two lines.

**Step 2: Run test to verify it fails**
- Run: `npm test -- src/app/__tests__/frontend-listing-style.test.tsx`

**Step 3: Write minimal implementation**
- Remove the absolute chevron elements.
- Render a single inline chevron after the title text.
- Clamp title to two lines and excerpt to two lines.

**Step 4: Run test to verify it passes**
- Run the same Vitest command.
