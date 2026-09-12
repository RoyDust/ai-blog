# Markdown Paste Image Upload Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Support pasting clipboard images inside the Markdown editor and upload them to Qiniu, then insert the Markdown image link at the cursor position.

**Architecture:** Reuse the existing Qiniu token route and shared upload logic in `MarkdownEditor`. Intercept textarea `paste` events, detect image files from clipboard items, prevent default text insertion only for image pastes, upload the image, and insert `![image](url)` using the cached textarea selection.

**Tech Stack:** React client component, Clipboard API via paste event, Vitest, Testing Library.

---

### Task 1: Paste image contract

**Files:**
- Modify: `src/components/posts/__tests__/markdown-editor.test.tsx`
- Modify: `src/components/posts/MarkdownEditor.tsx`

**Step 1: Write the failing test**
- Verify pasting a clipboard image uploads it and inserts Markdown at the cursor.
- Verify non-image paste still keeps default editor behavior untouched.

**Step 2: Run test to verify it fails**
- Run: `npm test -- src/components/posts/__tests__/markdown-editor.test.tsx`

**Step 3: Write minimal implementation**
- Add a shared upload helper for file uploads.
- Handle textarea `onPaste`.
- Detect image clipboard items and upload only those.
- Preserve cursor insertion behavior.

**Step 4: Run test to verify it passes**
- Run the same Vitest command.
