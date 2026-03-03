# 2026-03-04 Admin UI + Markdown Editor Design

## Scope
- Optimize admin UI pages with a denser and more consistent management style:
  - `/admin`
  - `/admin/posts`
  - `/admin/comments`
  - `/admin/categories`
  - `/admin/tags`
- Add Markdown editor as the dominant editing area for both:
  - `/write`
  - admin-side post editing workflow

## Confirmed Decisions
- Editor mode: Markdown source + realtime preview.
- Editor should be the visual center of edit pages (large area), while publish controls remain in a secondary side panel.
- Keep existing token system and component language; improve density and hierarchy rather than replacing design direction.

## UX Architecture
### 1. Unified Markdown Editing Surface
- Introduce a reusable `MarkdownEditor` component.
- Two-column layout on desktop:
  - Left: Markdown source editor
  - Right: Live preview
- Mobile fallback:
  - Vertical stacking with editor first
- Add lightweight formatting toolbar:
  - H2, bold, italic, quote, inline code, code block, link, image, list

### 2. Write Page (`/write`)
- Replace raw content textarea in `EditorWorkspace` with `MarkdownEditor`.
- Keep existing draft autosave and publish checklist behavior.
- Preserve side panel for publish options and validation checklist.

### 3. Admin Post Editing Workflow
- Add admin editor route for editing a post with same `MarkdownEditor` experience.
- Keep `/admin/posts` as list and operations hub; add direct `编辑` and `新建` entries into editor workflow.
- Support loading existing post data and saving updates.

### 4. Admin Visual Upgrade
- Apply consistent dense layout primitives:
  - section headers
  - action bars
  - table shell
  - status chips/buttons
- Improve readability and action affordance while preserving current tokens (`--surface`, `--border`, `--brand`, etc.).

## Data Flow
- Read posts from existing API and post detail endpoint where applicable.
- Update actions through API route for admin-safe post updates.
- Keep current auth guard behavior (ADMIN only for admin pages).

## Test Strategy (TDD)
1. Add failing tests first:
   - Markdown editor renders source + preview.
   - `/write` uses Markdown editor.
   - Admin post editor page renders and uses Markdown editor.
2. Implement minimal code to pass tests.
3. Run full regression:
   - `pnpm test`
   - `pnpm build`

## Risks and Mitigation
- Risk: style drift between public and admin pages.
  - Mitigation: preserve existing tokens and shared primitives.
- Risk: markdown preview security concerns.
  - Mitigation: use `react-markdown` defaults (no raw HTML execution).
- Risk: API mismatch for update operations.
  - Mitigation: add explicit admin update route contract and test path.
