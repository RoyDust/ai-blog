# Image Fallback Design

## Goal

Add a shared `next/image` wrapper so every image in the app falls back to `/imgs/Error.png` when loading fails.

## Approach

Create a client component named `FallbackImage` in `src/components/ui`. It keeps the active `src` in local state, swaps to `/imgs/Error.png` on `onError`, and ignores repeated failures once already on the fallback asset.

## Rollout

Replace direct `next/image` imports in app code with `FallbackImage` for article covers, avatars, and markdown-rendered images.

## Testing

Add a component test that renders the wrapper, triggers an image error event, and verifies the `src` changes to `/imgs/Error.png`.
