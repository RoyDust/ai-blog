# README Bilingual Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a complete English mirror README while preserving `README.md` as the primary Chinese document.

**Architecture:** Keep the Chinese README as the default landing page, add a top-level language switch in both files, and mirror the existing section structure into a new `README.en.md`. The translation should be faithful to the repository while reading naturally for English-speaking developers.

**Tech Stack:** Markdown, GitHub README conventions

---

### Task 1: Record the Bilingual README Design

**Files:**
- Create: `docs/plans/2026-03-28-readme-bilingual-design.md`

**Step 1: Write the design goals**

Document why the repo will use a dual-file approach instead of mixed-language sections.

**Step 2: Record the section contract**

List the shared section order that both README files should follow.

**Step 3: Record translation rules**

Define how natural English wording, commands, links, and product names should be handled.

### Task 2: Add Language Navigation to the Chinese README

**Files:**
- Modify: `README.md`

**Step 1: Add a language switch near the top**

Add `简体中文 | English` so readers can move between documents immediately.

**Step 2: Preserve existing Chinese content**

Keep the current Chinese README as the source-of-truth layout and only make the minimal structural additions needed for navigation.

### Task 3: Create the English Mirror README

**Files:**
- Create: `README.en.md`

**Step 1: Mirror the Chinese structure**

Recreate the same section order, commands, links, and tables.

**Step 2: Translate with natural wording**

Avoid literal machine translation. Use standard open-source README phrasing.

**Step 3: Add reciprocal language navigation**

Include `简体中文 | English` at the top and link back to `README.md`.

### Task 4: Verify README Consistency

**Files:**
- Modify: `README.md`
- Create: `README.en.md`

**Step 1: Check both files for matching sections**

Ensure the Chinese and English files cover the same major information.

**Step 2: Check internal links**

Confirm links to docs, workflows, and deployment files are present and correct.

**Step 3: Review final diff**

Confirm the bilingual addition improves navigation without bloating the primary README.
