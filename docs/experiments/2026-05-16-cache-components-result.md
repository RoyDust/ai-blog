# Cache Components Experiment Result - 2026-05-16

## Decision

Do not enable `cacheComponents` or View Transitions in this delivery batch.

## Rationale

- The business upgrade already changes database schema, publishing state, public series pages, newsletter flows, RSS/OG output, and admin analytics. Mixing an experimental rendering/cache mode into the same release would widen rollback scope.
- The highest-traffic article detail route is currently `force-dynamic`, so enabling Cache Components without first isolating request-time data behind explicit cache boundaries is unlikely to be a clean switch.
- View Transitions remains an experimental UI behavior and was not required for the P0-P4 acceptance criteria.

## Result

- `next.config.ts` was left unchanged.
- No production code paths depend on Cache Components.
- No View Transition behavior was introduced.
- P5 remains a documented follow-up experiment with a clean rollback state: there is nothing to revert in runtime configuration.

## Follow-Up Entry Criteria

- Apply all database migrations in the target environment before collecting performance numbers.
- Add route-level profiling for `/`, `/posts`, and `/posts/[slug]`.
- Identify which data loaders can safely use `use cache` and which must stay request-time.
- Run screenshot and navigation checks after any experimental config change.
