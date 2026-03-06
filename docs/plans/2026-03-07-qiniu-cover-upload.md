# Qiniu Cover Upload Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add direct Qiniu upload for admin post cover images and automatically write the uploaded URL back into `coverImage`.

**Architecture:** Add a small server API route that signs upload tokens using server-only env vars. Update the admin editor UI to request a token, upload the selected file directly to Qiniu form upload, then store the final public URL in the existing post form state. Keep post save APIs unchanged.

**Tech Stack:** Next.js App Router, React client components, Vitest, Qiniu token signing via Node `crypto`.

---

### Task 1: Cover upload API contract

**Files:**
- Create: `src/app/api/admin/uploads/qiniu-token/route.ts`
- Create: `src/app/api/admin/uploads/__tests__/qiniu-token.test.ts`

**Step 1: Write the failing test**
- Verify the route returns a token payload when env vars exist.
- Verify the route rejects missing filename or missing config.

**Step 2: Run test to verify it fails**
- Run: `npm test -- src/app/api/admin/uploads/__tests__/qiniu-token.test.ts`

**Step 3: Write minimal implementation**
- Read server env vars.
- Build upload key.
- Sign Qiniu put policy into an upload token.
- Return `{ token, key, uploadUrl, domain }`.

**Step 4: Run test to verify it passes**
- Run the same Vitest command.

### Task 2: Admin cover uploader UI

**Files:**
- Modify: `src/components/posts/EditorWorkspace.tsx`
- Modify: `src/app/admin/__tests__/admin-editor.test.tsx`
- Possibly modify: `src/app/admin/posts/[id]/edit/page.tsx`

**Step 1: Write the failing test**
- Verify the admin editor shows an upload trigger for cover images.

**Step 2: Run test to verify it fails**
- Run: `npm test -- src/app/admin/__tests__/admin-editor.test.tsx`

**Step 3: Write minimal implementation**
- Add file input and upload button.
- Request token from the new API.
- Upload file to Qiniu.
- Write the final URL into the existing cover field.
- Show uploading/error state.

**Step 4: Run test to verify it passes**
- Run the same Vitest command.

### Task 3: Runtime support

**Files:**
- Modify: `next.config.ts`

**Step 1: Implement image host support**
- Allow the configured Qiniu domain host in Next image remote patterns.

**Step 2: Verify**
- Run focused tests again.
