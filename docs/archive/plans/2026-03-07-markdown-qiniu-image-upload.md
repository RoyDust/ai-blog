# Markdown Qiniu Image Upload Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Qiniu image upload support inside the shared Markdown editor and insert uploaded image Markdown into the editor content.

**Architecture:** Reuse the existing admin Qiniu token route. Extend the shared `MarkdownEditor` client component with an upload trigger, direct browser upload to Qiniu, and insertion logic that writes `![image](url)` into the textarea content at the current cursor location or appends at the end.

**Tech Stack:** Next.js App Router, React client components, Vitest, Testing Library, Qiniu direct form upload.

---

### Task 1: Markdown editor upload contract

**Files:**
- Modify: `src/components/posts/__tests__/markdown-editor.test.tsx`

**Step 1: Write the failing test**
- Verify the Markdown editor renders an image upload trigger.
- Verify a successful upload inserts image Markdown into the editor output.

**Step 2: Run test to verify it fails**
- Run: `npm test -- src/components/posts/__tests__/markdown-editor.test.tsx`

**Step 3: Write minimal implementation**
- Add upload button and hidden file input.
- Request the existing Qiniu token route.
- Upload the selected file to Qiniu.
- Insert image Markdown into the current content.
- Show upload error state when needed.

**Step 4: Run test to verify it passes**
- Run the same Vitest command.

### Task 2: Focused verification

**Files:**
- Modify: `src/components/posts/MarkdownEditor.tsx`

**Step 1: Re-run focused tests and lint**
- Run Markdown editor tests.
- Run ESLint on touched files.
