# Cache Components Baseline - 2026-05-16

## Scope

Baseline for the blog top-tier upgrade P5 experiment. The baseline keeps the current production configuration:

- `next.config.ts` does not enable `cacheComponents`.
- `next.config.ts` does not enable `experimental.viewTransition`.
- Public content cache invalidation remains route/path based through `src/lib/cache.ts`.

## Commands

```text
pnpm exec prisma validate
pnpm exec prisma generate
pnpm exec tsc --noEmit --pretty false
pnpm lint
pnpm build
```

## Observed Build

- Next.js: 16.1.6 with Turbopack.
- Production build: passed.
- Compile time reported by Next.js: 8.1s.
- Static page generation: 84 pages in 2.7s.
- Route output includes the upgraded public paths: `/posts`, `/series`, `/series/[slug]`, `/rss.xml`, `/sitemap.xml`.

## Baseline Notes

- `src/app/(public)/posts/[slug]/page.tsx` is explicitly `force-dynamic`, so Cache Components would require a separate route-level data-boundary review before it can produce meaningful gains.
- The local database used during this build had not applied the new `series` migration, so `/series` logged a caught Prisma `P2021` during static generation. The build still exited successfully; this is an environment migration state issue, not a Cache Components result.
- No Playwright screenshot artifacts were generated for this baseline because P5 was not adopted into production configuration in this batch.
