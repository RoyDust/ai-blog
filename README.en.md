# Inkforge

<div align="center">

[简体中文](./README.md) | [English](./README.en.md)

**An AI content platform that forges raw material into finished articles.**

Inkforge is not a display-only Markdown theme. It packs a *polished blog frontend*, an *AI-assisted writing and curation pipeline*, and an *auditable operations backend* into a single Next.js application.

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-111111?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.3-149ECA?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.4.2-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791?logo=postgresql)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38BDF8?logo=tailwindcss)](https://tailwindcss.com/)

[Live Demo](http://47.98.167.32) · [Architecture](./ARCHITECTURE.md) · [Deployment Guide](./docs/deployment/github-actions-manual-deploy.md)

</div>

## Preview

Screenshots are placeholders for now. Drop images into `docs/assets/readme/` and replace the paths below.

| Reading Home | Post Detail | AI Task Center |
| --- | --- | --- |
| `docs/assets/readme/public-home.png` | `docs/assets/readme/post-detail.png` | `docs/assets/readme/admin-ai-tasks.png` |

## What Inkforge Is

A typical blog project only solves "render the Markdown." But running a content site long-term means dealing with topic selection, drafting, cover art, SEO, review, publishing, comments, subscriptions, observability, and deployment. Inkforge wires all of these together and brings AI in wherever the work can be automated:

- **Blog frontend** — home, posts, categories, tags, series, archives, search, and bookmarks, with reading progress, a table of contents, code highlighting, and dark mode.
- **AI writing & curation pipeline** — from multi-source fetching to dedupe, scoring, topic selection, drafting, review, and publishing, paired with AI summaries, SEO, and cover generation, and opened up to external AI agents.
- **Observable operations backend** — management for posts / categories / tags / series / comments / covers / AI models, layered with operation audit logs, in-app notifications, and reading-behavior analytics.

## Core Capabilities

### 1. AI Writing & Curation Pipeline (the heart of the project)

Turns "AI can write" into an operable workflow, not just a chat box:

- **AI content assist** — one-click generation of post summaries, SEO titles/descriptions, and cover images; the summary state machine (queued → generating → done / failed) is trackable and retryable.
- **AI news digest** — fetch candidates from RSS, Hacker News, GitHub Releases / Trending, and Reddit → normalize & dedupe → AI scoring & topic selection → automated drafting → AI review scoring → publish, with both manual and Cron-triggered runs.
- **External AI agent access** — scoped API tokens let external agents create / update drafts (draft bindings + an OpenAPI descriptor + a metadata endpoint), plugging third-party writing agents into the publishing flow.
- **AI task center** — every AI operation flows through a task queue with requested / succeeded / failed counts, supporting batch runs, partial-failure retries, and result application, with in-app notifications at key milestones.
- **AI model management** — configure OpenAI-compatible models in the admin (DashScope / Qwen-compatible by default), set per-capability default models (summary / cover), and test connectivity with one click.

### 2. Reading & Interaction Frontend

- Home and featured section, post detail, archives, categories, tags, series, on-site search, and bookmarks
- Reading progress, table of contents, code highlighting with line numbers, dark mode, a mobile TOC drawer, and reduced-motion support
- Anonymous likes, comments with nested replies, local bookmarks, sharing, and back-to-top
- RSS, `sitemap.xml`, `robots.txt`, `manifest`, Open Graph images, and JSON-LD structured data

### 3. Content Production & Operations Backend

- Markdown authoring workspace and post editor, with Qiniu image uploads + client-side compression
- Drafts, publishing, scheduled publishing, featuring, reading time, series grouping, soft deletion, and public-path revalidation
- Admin management for posts / categories / tags / series / comments, with moderation states (`APPROVED` / `PENDING` / `REJECTED` / `SPAM`)
- Cover library, system settings, newsletter subscriptions, and contact-page configuration
- **Observability** — API operation audit logs, an in-app notification center, visit logs, and reading-behavior (duration / scroll depth) analytics

## Tech Stack

| Layer | Stack |
| --- | --- |
| Framework | Next.js 16 App Router + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + CSS Variables + OKLCH theme tokens |
| Data | Prisma 7 + PostgreSQL (`@prisma/adapter-pg` driver adapter) |
| Auth | NextAuth.js v4 + Prisma Adapter (local accounts + GitHub OAuth) |
| Content | react-markdown + remark-gfm + rehype-highlight + rehype-highlight-code-lines |
| AI | OpenAI-compatible interface (DashScope / Qwen-compatible by default), visual model management in the admin |
| Storage & Images | Qiniu object storage + compressorjs client-side compression |
| Motion | motion/react + View Transitions |
| Forms & Validation | react-hook-form + Zod |
| UI | Radix UI / Base UI + lucide-react + sonner + cmdk + recharts |
| Testing | Vitest + Testing Library + Playwright |
| Deployment | Docker + Docker Compose + Nginx + GitHub Actions |

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Minimum required values:

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/my_next_app?schema=public"
AUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

### 3. Initialize the database

```bash
pnpm prisma generate
pnpm prisma migrate dev
```

### 4. Start the dev server

```bash
pnpm dev
```

The default local address is `http://localhost:3000`.

## Common Commands

```bash
pnpm dev            # Start local development (default http://localhost:3000)
pnpm build          # Production build
pnpm start          # Start the production server
pnpm lint           # ESLint
pnpm test           # Vitest unit / component tests
pnpm test:e2e       # Playwright end-to-end tests
pnpm ai-news:check  # Check AI news pipeline readiness
```

## Environment Variables

See [.env.example](./.env.example) for the full template. The most common variables:

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | App auth signing secret |
| `NEXTAUTH_SECRET` | Yes | NextAuth session secret |
| `NEXTAUTH_URL` | Yes | Auth callback base URL |
| `NEXT_PUBLIC_SITE_URL` | Yes | Public site URL |
| `NEXT_PUBLIC_CONTACT_EMAIL` | No | Default contact-page email |
| `GOOGLE_SITE_VERIFICATION` / `BING_SITE_VERIFICATION` | No | Search engine site verification |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | No | GitHub OAuth credentials |
| `QINIU_ACCESS_KEY` / `QINIU_SECRET_KEY` / `QINIU_BUCKET` / `QINIU_DOMAIN` / `QINIU_UPLOAD_URL` | No | Qiniu image uploads |
| `AI_OPENAI_COMPAT_API_KEY` / `AI_OPENAI_COMPAT_BASE_URL` / `AI_OPENAI_COMPAT_MODEL` | No | OpenAI-compatible AI model (takes precedence when set) |
| `AI_POST_SUMMARY_TIMEOUT_MS` / `AI_POST_SUMMARY_MAX_INPUT_CHARS` | No | AI summary timeout and input character cap |
| `DASHSCOPE_API_KEY` / `DASHSCOPE_BASE_URL` / `DASHSCOPE_MODEL` | No | DashScope-compatible fallback |

## Project Structure

```text
.
├─ src/app
│  ├─ (public)         # Frontend: home, posts, categories, tags, series, search, archives, bookmarks, about, contact
│  ├─ (auth)           # Login, registration, auth callbacks
│  ├─ admin            # Admin: posts/categories/tags/series/comments/covers/AI models/AI tasks/AI news/logs/notifications/settings
│  ├─ api              # Route Handlers (incl. /api/ai/* agent access and /api/cron/* scheduled jobs)
│  ├─ profile          # User profile
│  └─ write            # Authoring entry
├─ src/components       # admin / blog / layout / motion / posts / search / ui components
├─ src/lib             # Auth, Prisma, SEO, AI (summary/news/cover/tasks), rate limiting, logging, subscriptions
├─ prisma              # Data model and migrations
├─ scripts             # Data seeding and ops scripts (seed, AI token, readiness checks)
├─ docs                # Design, implementation, deployment, and planning docs
├─ deploy              # Deployment support files such as Nginx config
└─ .github/workflows   # CI / Deploy workflows
```

## Data Model

Core models, grouped into four areas:

- **Accounts & permissions**: `User` / `Account` / `Session` / `VerificationToken` (roles `USER` / `ADMIN`)
- **Content**: `Post` / `Category` / `Tag` / `Series` / `Comment` / `Like` / `Bookmark`
- **AI**: `AiModel` / `AiTask` / `AiTaskItem` / `AiApiClient` / `AiDraftBinding` / `AiNewsRun` / `AiNewsSource` / `AiNewsCandidate` / `CoverAsset`
- **Operations & observability**: `Notification` / `NotificationRecipient` / `VisitLog` / `ReadingEvent` / `ApiOperationLog` / `SystemSetting` / `NewsletterSubscriber`

Posts, categories, tags, series, comments, and covers all use soft deletion (`deletedAt`). Posts support featuring, reading time, scheduled publishing, series ordering, SEO fields, AI summary status, and cover-asset linkage.

## Deployment

The project ships with production deployment entry points:

- Dockerfile: [Dockerfile](./Dockerfile)
- Compose: [docker-compose.prod.yml](./docker-compose.prod.yml)
- Nginx: [deploy/nginx.my-next-app.conf](./deploy/nginx.my-next-app.conf)
- Manual deploy flow: [docs/deployment/github-actions-manual-deploy.md](./docs/deployment/github-actions-manual-deploy.md)

The production flow is roughly:

```bash
pnpm build
docker compose -f docker-compose.prod.yml up -d --build
pnpm prisma migrate deploy
```

For real deployments, follow the deployment docs and the GitHub Actions workflows as the source of truth.

## Testing & Quality

```bash
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

Coverage spans public reading flows, post detail, search, RSS, SEO metadata, admin management, comments, likes, bookmarks, AI tasks and article-info generation, AI news dedupe / scoring, deployment scripts, and key component contracts.

## Roadmap

- [ ] Add README screenshots and a live demo recording
- [ ] Expand topic-subscription feeds and a JSON Feed
- [ ] Strengthen Lighthouse / accessibility automation
- [ ] Improve multilingual content and i18n routing
- [ ] Add more AI writing and editing assist flows

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [Cleanup Audit](./docs/plans/2026-06-04-project-cleanup-audit.md)
- [Archived Project Docs](./docs/archive/PROJECT_DOCS.md)
- [Archived Test Report](./docs/archive/TEST_REPORT.md)
- [Server Execution Checklist](./docs/deployment/server-execution-checklist.md)
- [HTTPS / HTTP2 Deployment Notes](./docs/deployment/https-http2-roydust-top.md)

## License

This repository does not currently declare an open-source license. Add a `LICENSE` before public distribution or commercial reuse.
