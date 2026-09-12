# Frontend BlogT3 Style Replication Design

Date: 2026-03-03
Status: Approved
Scope: Frontend only (no admin/author/backend refactor)

## 1. Objective
Replicate the visual and interaction style of `F:\Code\NewProject\BlogT3` for the frontend of `my-next-app` with near 1:1 fidelity, while keeping existing business data sources and route semantics where practical.

## 2. Non-Goals
- No backend architecture migration from BlogT3.
- No admin (`/admin*`) redesign in this effort.
- No author workflow (`/admin/posts/new`, `/posts/[slug]/edit`) redesign in this effort.
- No API contract changes unless required by frontend adaptation.

## 3. Chosen Approach
Chosen approach: full frontend style layer replacement (recommended option from discussion).

Why:
- Highest visual consistency with BlogT3.
- Clean style semantics for long-term maintenance.
- Avoids dual-style technical debt from compatibility-only mapping.

## 4. Visual System Design
### 4.1 Tokens and Theme
- Adopt BlogT3-style OKLCH token model with `--hue` as dynamic accent driver.
- Keep light/dark themes with shared semantic variables.
- Preserve reduced-motion support globally.

### 4.2 Component Style Semantics
Frontend surfaces converge to BlogT3 class semantics:
- `card-base`
- `btn-plain`
- `btn-regular`
- `float-panel`
- text opacity helpers (`text-90`, `text-75`, etc.)
- onload and stagger animation classes

Existing `ui-*` classes may remain for non-frontend areas but should not be the primary frontend style language after migration.

### 4.3 Motion
- Use onload staggered reveal and card/button interaction transitions aligned with BlogT3.
- Respect `prefers-reduced-motion` as a hard accessibility fallback.

## 5. Frontend Layout and Route Design
### 5.1 Public Shell
Replicate BlogT3 public shell pattern:
- Sticky navbar (with scroll-hide behavior)
- Desktop sidebar (sticky block)
- Main content container
- Footer card section

Layout rhythm and width:
- `--page-width` based container (75rem baseline)
- spacing cadence aligned to BlogT3 (`pt-4`, `gap-4`, card spacing)

### 5.2 Route Mapping (semantic parity, not forced URL parity)
- Home: `/` (retain path, replicate layout/feel)
- Post list: keep `/posts` path, replicate BlogT3 listing structure
- Post detail: keep `/posts/[slug]`, replicate reading experience styling
- Additional frontend pages by priority: `/categories*`, `/tags*`, `/search`, `/bookmarks`

### 5.3 Isolation Strategy
Introduce/maintain a public route-group shell boundary (e.g. `(public)`) so frontend style replication does not unintentionally affect admin/author pages.

## 6. Components and Data Flow
### 6.1 Components in Scope
- Layout: `Navbar`, `Sidebar`, `Footer`, public shell
- Content: post card and metadata presentation
- Reading helpers: TOC/progress (reuse existing capability where present)
- Interaction: theme switch, hue picker (new), search entry affordance

### 6.2 Data Strategy
- Reuse current `my-next-app` data source and API routes.
- Add frontend adapter mapping from current data shape to BlogT3-style component props.
- Do not copy BlogT3 server action layer into this project.

## 7. Interaction and UX Boundaries
Must-have interactions:
- Scroll-hide navbar
- Theme switch
- Hue switch
- Button/card tactile hover-active transitions
- List stagger entry transitions

Can be phased after core parity:
- Keyboard search modal (`Ctrl/Cmd + K`) if not stable in first pass
- Complex scroll reveal variants beyond baseline needs

## 8. Error Handling and Fallbacks
- Empty-data fallback cards to preserve layout stability.
- Motion disabled for reduced-motion users.
- Mobile-first readability for navigation and cards.

## 9. Verification Strategy
- Contract tests for key style classes/tokens on navbar/card/button/theme containers.
- Page-level tests for `/`, `/posts`, `/posts/[slug]`.
- Manual QA checklist:
  - light/dark theme
  - hue switching
  - desktop/mobile nav behavior
  - empty states
  - reduced motion behavior

## 10. Deliverable Boundary
This design covers frontend style replication only. Implementation planning and execution will follow in a dedicated implementation plan.
