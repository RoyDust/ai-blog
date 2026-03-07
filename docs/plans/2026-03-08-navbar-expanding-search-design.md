# Navbar Expanding Search Design

**Goal**
- Make the desktop navbar search feel lighter and more editorial: compact at rest, expands on focus with motion, submits on Enter.

**Interaction**
- Desktop only keeps a single inline search field with a leading search icon.
- Default width stays visually compact to preserve the nav rhythm.
- On focus, the field expands smoothly to a wider width.
- Pressing `Enter` submits the `GET /search?q=...` request through the native form.
- The separate desktop search button is removed; mobile search entry remains unchanged.

**Visual Direction**
- Match the reference: soft surface, low-contrast shell, subtle icon, minimal borders.
- Use `var(--primary)` only for focus ring / active emphasis, not as a filled button.
- Animation should be restrained: width + shadow + border-color transitions around 180-240ms.

**Scope**
- `src/components/layout/Navbar.tsx`
- `src/components/search/SearchForm.tsx`
- related tests only
