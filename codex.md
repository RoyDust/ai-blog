# codex.md

This file gives Codex a concise working guide for this repository.

## Project

Inkforge is a Next.js 16 AI content platform. It combines a public blog experience, an AI-assisted writing and news pipeline, and an observable admin console in one App Router application.

Core areas:

- Public blog: posts, categories, tags, series, archive, search, bookmarks, comments, likes, reading progress, table of contents, dark mode, RSS, sitemap, and SEO metadata.
- AI workflow: post summaries, SEO metadata, cover generation, AI news collection and drafting, external AI Agent draft access, AI task queue, and model management.
- Admin operations: content management, comments, covers, AI tasks, AI news, logs, notifications, settings, and reading analytics.

## Stack

- Framework: Next.js 16 App Router
- Runtime UI: React 19
- Language: TypeScript
- Styling: Tailwind CSS v4 with CSS variables and OKLCH theme tokens
- Database: PostgreSQL with Prisma 7 and `@prisma/adapter-pg`
- Auth: NextAuth.js v4 with Prisma Adapter, credentials login, and optional GitHub OAuth
- Tests: Vitest, Testing Library, and Playwright
- Package manager: pnpm

## Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm test
pnpm test:e2e
pnpm ai-news:check
```

Database commands:

```bash
pnpm prisma generate
pnpm prisma migrate dev
pnpm prisma migrate deploy
pnpm prisma db push
```

`pnpm dev` uses the Next.js default port unless the environment overrides it. The usual local URL is `http://localhost:3000`.

## Repository Map

```text
src/
├─ app/          App Router routes and route handlers
├─ components/   UI, layout, blog, admin, posts, motion, and search components
├─ lib/          Auth, Prisma, AI, SEO, rate limiting, logging, notifications, and shared utilities
└─ types/        Shared TypeScript types

prisma/          Prisma schema and migrations
scripts/         Seed, maintenance, AI token, and readiness scripts
docs/            Architecture, deployment, planning, and archived project docs
deploy/          Nginx and deployment configuration
e2e/             Playwright tests
tasks/           Working notes, plans, and lessons
```

Use the `@/*` path alias for imports from `src/*`.

## Important Files

- `AGENTS.md`: repository-level agent instructions; read and follow it before making changes.
- `README.md`: product overview, setup, environment variables, and test commands.
- `ARCHITECTURE.md`: broader implementation and system architecture notes.
- `prisma/schema.prisma`: source of truth for database models.
- `src/lib/auth.ts`: NextAuth configuration.
- `src/lib/prisma.ts`: Prisma client setup.
- `.env.example`: environment variable template.

## Working Rules

- Keep changes small, surgical, and tied directly to the task.
- Prefer existing utilities, components, route patterns, and data-access helpers.
- Do not add dependencies unless explicitly requested.
- Do not refactor unrelated code while solving a narrow task.
- Preserve user changes in the working tree; never reset or discard unrelated edits.
- Use `rg` / `rg --files` for repository search.
- Use `pnpm` for package, script, and Prisma commands.
- For manual edits, use patch-style edits and keep formatting consistent with nearby code.

## Frontend Rules

- Match the existing design system before inventing new visual patterns.
- Use existing UI primitives and `lucide-react` icons where suitable.
- Build actual usable screens, controls, states, and flows, not explanatory placeholder UI.
- Keep text responsive and prevent overflow or overlap on mobile and desktop.
- Verify visually with a browser or screenshots for meaningful UI work.

## Verification

Before claiming completion, run the checks that match the change:

- Documentation-only change: read the changed file and confirm content is present.
- TypeScript or React change: `pnpm lint` and targeted `pnpm test` when relevant.
- Shared logic, API, or data change: targeted tests plus broader `pnpm test` when risk warrants it.
- Database or Prisma change: `pnpm prisma generate` and the relevant migration command.
- User-facing route or flow: browser/manual check or Playwright where practical.
- Production-sensitive change: include `pnpm build` unless there is a real blocker.

If a check cannot be run, report the reason and the residual risk.

## Commit Guidance

When asked to commit, use a structured decision-record style message. The first line should explain why the change was made. Include useful trailers such as:

```text
Constraint: ...
Rejected: ...
Confidence: high
Scope-risk: narrow
Reversibility: clean
Directive: ...
Tested: ...
Not-tested: ...
```

The repository also accepts Chinese commit intent lines when that better matches the surrounding workflow.

