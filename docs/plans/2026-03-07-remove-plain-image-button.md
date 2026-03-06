# Remove Plain Image Toolbar Button Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the plain Markdown `Image` toolbar button and keep only the Qiniu upload entry in the shared Markdown editor.

**Architecture:** Update the toolbar snippet list so it no longer includes the manual image template button. Keep the Qiniu upload button unchanged and verify the editor tests assert the old button is absent.

**Tech Stack:** React client component, Vitest, Testing Library.

---

### Task 1: Toolbar behavior

**Files:**
- Modify: `src/components/posts/__tests__/markdown-editor.test.tsx`
- Modify: `src/components/posts/MarkdownEditor.tsx`

**Step 1: Write the failing test**
- Verify the plain `Image` toolbar button is not rendered.

**Step 2: Run test to verify it fails**
- Run: `npm test -- src/components/posts/__tests__/markdown-editor.test.tsx`

**Step 3: Write minimal implementation**
- Remove the `Image` snippet from the toolbar config.

**Step 4: Run test to verify it passes**
- Run the same Vitest command.
