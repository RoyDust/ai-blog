# Anonymous Engagement and Profile Removal Design

**Date:** 2026-03-08

**Goal:** Remove the public profile surface, simplify authoring entry points, and support anonymous likes, local bookmarks, and anonymous comments without account login.

## Decisions

- Remove the public welcome hero from the home page and keep the homepage focused on content discovery.
- Decommission the `/profile` experience in favor of the admin workspace; legacy `/write` stays only as a compatibility redirect to `/admin/posts/new`.
- Use a browser-scoped anonymous identity for engagement, stored in `localStorage` and sent as a request header.
- Persist likes in the database by anonymous browser identity so counts remain shared across visitors.
- Keep bookmarks fully local in `localStorage` and render the bookmarks page from the saved slug list.
- Allow anonymous comments to persist in the database and label the author using the request IP in masked form.

## Data Flow

- Client generates a stable browser ID once and reuses it for later requests.
- Like requests send `x-browser-id`; the API toggles a row keyed by `postId + browserId`.
- Bookmark actions never call the server; the client stores a small bookmark record locally.
- Anonymous comment requests send `x-browser-id`; the API stores `browserId`, `authorLabel`, and comment content.
- Article pages render comments from stored anonymous metadata and use the browser ID to compute the initial liked state.

## Route Strategy

- `/profile` and `/profile/edit` redirect to `/admin` to retire the public profile UI without leaving dead links.
- `/write` continues redirecting to `/admin/posts/new` for compatibility.
- `/bookmarks` becomes a client-driven archive page backed by local bookmark storage.

## Safety

- Keep the existing interaction rate limiter in place for likes and comments.
- Mask IPv4 and IPv6 addresses before display to avoid exposing the full address.
- Treat browser ID as a lightweight anonymous credential, not a secure authentication method.

