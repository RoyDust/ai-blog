# UI/UX Pro Max Design

**Date:** 2026-03-03  
**Scope:** Full redesign across reader, author, and admin experiences  
**Direction:** Productized Publishing (brand-level visual reset + task-oriented UX)

## 1. Goals And Non-goals

### Goals
- Deliver a coherent brand-grade interface across the whole product.
- Treat reader, author, and admin as equal-priority personas.
- Improve core task success: discover content, publish content, govern content.
- Introduce a scalable design system with tokens + reusable components.
- Add meaningful motion with strong perceived quality and no usability regression.

### Non-goals
- No schema/business-rule overhaul.
- No feature explosion outside existing product scope.
- No animation-only changes that hurt readability/performance/accessibility.

## 2. Experience Principles

- Content first: typography and rhythm must prioritize reading comfort.
- Task clarity: every screen should expose primary action within 1 glance.
- Predictable system: same components behave the same across all modules.
- Progressive density: reader UI is spacious; author/admin UI is information-dense.
- Calm motion: motion explains change and hierarchy, not decoration.

## 3. Information Architecture

### Top-level product map
- Explore (`/`, `/posts`, `/search`, `/categories`, `/tags`)
- Write (`/write`, `/posts/[slug]/edit`, author post management views)
- Manage (`/admin`, `/admin/posts`, `/admin/comments`, `/admin/categories`, `/admin/tags`)
- Profile (`/profile`, `/bookmarks`)

### Navigation model
- Global shell with role-aware top nav.
- Contextual secondary controls per module (filters, sort, bulk actions).
- Mobile: bottom nav for core routes + sheet/drawer for advanced controls.

## 4. Visual Language

### Typography
- Body: `Noto Sans SC`
- Display / metrics emphasis: `Manrope`
- Code/meta: `JetBrains Mono`

### Palette (light + dark)
- Neutral foundation: slate-based surfaces.
- Primary accent: teal range for links, focus, main actions.
- Secondary accent: amber for highlights and status emphasis.
- Status semantics: success/warn/error/info tokens, not raw colors in components.

### Atmosphere
- Layered backgrounds (subtle gradients + low-contrast texture/pattern).
- Distinct elevation scale (flat / raised / floating).
- Rounded but not overly soft geometry; refined editorial tone.

## 5. Design System Architecture

### Token layers
- Brand tokens: raw values (`--color-teal-600`, spacing scale, radius scale, shadows).
- Semantic tokens: contextual aliases (`--surface-default`, `--text-muted`, `--border-subtle`).
- Component tokens: local overrides per component family.

### Core component inventory
- Foundations: Button, Input, Select, Textarea, Checkbox, Switch, Badge, Avatar.
- Feedback: Toast, Alert, Skeleton, EmptyState.
- Layout: Card, Panel, Drawer, Modal, Tabs.
- Navigation: TopNav, SideNav, Breadcrumb, Pagination, CommandBar.
- Content: PostCard variants, MetaRow, TagChip, CommentThread, StatCard.
- Data-heavy admin: DataTable, FilterBar, BulkActionBar, StatusPill.

## 6. Motion System

### Libraries and approach
- Use `framer-motion` for route transitions, list enter animations, and micro interactions.
- Keep transforms + opacity first; avoid expensive layout animations on dense lists.

### Timing tokens
- Fast: 120ms (micro feedback)
- Standard: 220ms (state transitions)
- Slow: 320ms (section transitions)

### Motion patterns
- Page load: subtle fade + y-offset settle.
- List reveal: staggered cards for homepage/list pages.
- Action confirmation: scale/fade feedback on optimistic actions.
- Reduced motion mode: all essential interactions remain clear without animation.

## 7. Experience By Persona

### Reader
- Homepage becomes editorial landing with clear hierarchy: hero, featured, latest, topical rails.
- Search/listing pages gain persistent, composable filters.
- Article page adds reading progress, in-page TOC anchors, sticky interaction rail.

### Author
- `/write` converted to dual-pane workspace: editor + publish settings.
- Autosave state, publish checklist, and status badges reduce uncertainty.
- Author management pages support quick state filtering and batch actions.

### Admin
- Dashboard surfaces actionable metrics and queue state.
- All moderation screens standardized to DataTable patterns.
- Dangerous operations protected with explicit confirmations and clearer copy.

## 8. Data And State Interaction Pattern

- Server Components fetch primary content for fast first render and SEO.
- Client islands handle interactivity: filters, optimistic likes/bookmarks, table controls.
- Query params standardized for discoverability and deep-linking.
- Cache policy split: reader pages revalidate; admin/author pages bias to freshness.

## 9. Error/Empty/Loading Strategy

- Unified ErrorState templates with retry and contextual escape actions.
- Unified EmptyState templates tailored by module intent.
- Skeleton loading for list/detail/editor shells to avoid abrupt layout shifts.
- Form errors: field-level + action-level summary.

## 10. Accessibility And Quality Bar

- Keyboard-first navigation for all interactive controls.
- AA color contrast compliance for text/actions.
- Focus visibility standardized with tokenized focus ring.
- `prefers-reduced-motion` support across motion components.
- Performance guardrails: keep animation cheap, minimize client JS on content pages.

## 11. Delivery Strategy

1. Build tokens and base components.
2. Rebuild shared shell/navigation.
3. Rebuild reader flows.
4. Rebuild author flows.
5. Rebuild admin flows.
6. Add motion polish + accessibility + performance tuning.
7. Run full verification and visual regression pass.

## 12. Risks And Mitigations

- Risk: visual inconsistency during migration.
  - Mitigation: migrate via shared shell + token-first rollout.
- Risk: animation degrades perceived performance.
  - Mitigation: strict motion tokens and reduced-motion fallback.
- Risk: admin efficiency drops from visual-first changes.
  - Mitigation: preserve dense table UX and shortcut-first patterns.
