# Neutral Gray Scrollbar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the global branded scrollbar styling with a subtle neutral gray appearance.

**Architecture:** Update only the global scrollbar selectors in `src/app/globals.css` so all scrollable surfaces inherit the same understated visual treatment. Keep the scrollbar thin and visible, but reduce emphasis by using neutral gray tones instead of theme-brand colors.

**Tech Stack:** Next.js, global CSS, WebKit scrollbar selectors, Firefox `scrollbar-color`

---

### Task 1: Update global scrollbar colors

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Replace Firefox scrollbar colors**
- Change `html { scrollbar-color: ... }` to use subtle neutral gray values instead of `var(--primary)`.

**Step 2: Replace WebKit thumb styling**
- Remove the branded gradient from `*::-webkit-scrollbar-thumb` and use a low-contrast neutral gray fill.

**Step 3: Keep hover understated**
- Make `*::-webkit-scrollbar-thumb:hover` only slightly darker so the scrollbar remains visible without drawing attention.

**Step 4: Preserve track contrast**
- Keep the track very subtle so the thumb remains distinguishable in both light and dark themes.

### Task 2: Verify visual consistency

**Files:**
- Check: `src/app/globals.css`

**Step 1: Review final values**
- Confirm there are no remaining scrollbar references to `var(--primary)`.

**Step 2: Sanity-check impact scope**
- Ensure only global scrollbar selectors changed and no unrelated theme tokens were modified.
