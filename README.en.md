# Blog System

<div align="center">

[简体中文](./README.md) | [English](./README.en.md)

A modern blog system built with `Next.js 16`, `React 19`, `Prisma 7`, and `PostgreSQL`, covering the full workflow from public reading experience to content creation, admin management, and production deployment.

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-111111?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.3-149ECA?logo=react)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-7.4.2-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791?logo=postgresql)](https://www.postgresql.org/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?logo=pnpm)](https://pnpm.io/)

[Live Demo](http://47.98.167.32) · [Architecture](./ARCHITECTURE.md) · [Deployment Guide](./docs/deployment/github-actions-manual-deploy.md)

</div>

## Overview

This project is more than a simple article listing template. It is a full blog application with a connected public reading experience, content publishing workflow, taxonomy system, interaction features, site metadata generation, and a deployment path based on GitHub Actions and Docker Compose. It works well as a foundation for a personal blog, content site, or lightweight knowledge base.

## Highlights

- A complete `App Router` structure with clear boundaries between the public site, auth pages, writing area, admin console, and API routes.
- A full article workflow with drafts, publishing, categories, tags, reading time, cover images, soft deletion, and admin maintenance.
- A polished reading experience including the homepage, post listing, post detail pages, archives, tag pages, category pages, on-site search, RSS, sitemap, and robots metadata.
- Interaction features already wired in, including anonymous comments, anonymous likes, a local bookmark shelf, and admin-side comment moderation.
- A Markdown-based editor with Qiniu image uploads and optional DashScope summary generation for ongoing content production.
- Solid engineering foundations with Vitest, Playwright, CI workflows, manual deploy workflows, and production Docker configuration.

## Feature Overview

### Reader Experience

- Homepage and latest post feed
- Post detail pages with Markdown rendering
- Categories, tags, archives, and site search
- Reading time, likes, comments, and bookmarks
- RSS feed, `sitemap.xml`, `robots.txt`, and `manifest`

### Author and Admin Workflow

- Login, registration, and session handling
- Dedicated writing page and admin-side post editing
- Admin panels for categories, tags, and comments
- Comment moderation statuses: `APPROVED`, `PENDING`, `REJECTED`, and `SPAM`
- Soft-delete handling for posts, categories, tags, and comments

### Engineering and Deployment

- Prisma schema backed by PostgreSQL
- GitHub Actions CI with manual CD
- Docker Compose production deployment
- Optional Qiniu upload support
- Optional DashScope article summary generation

## Tech Stack

| Category | Stack |
| --- | --- |
| Frontend | Next.js 16 + React 19 + TypeScript |
| Styling | Tailwind CSS 4 |
| Data Layer | Prisma 7 + PostgreSQL |
| Authentication | NextAuth.js |
| Content | react-markdown + remark-gfm + rehype-highlight |
| Motion and Feedback | Framer Motion + Sonner |
| Testing | Vitest + Testing Library + Playwright |
| Deployment | GitHub Actions + Docker Compose + Nginx |

## Project Structure

```text
.
├─ src/app
│  ├─ (public)         # Public-facing pages: home, posts, categories, tags, search, archives, bookmarks
│  ├─ (auth)           # Login and registration
│  ├─ admin            # Admin console
│  ├─ api              # Route Handlers
│  ├─ profile          # User profile
│  └─ write            # Authoring entry
├─ src/components
│  ├─ admin            # Admin UI components
│  ├─ blog             # Blog reading components
│  ├─ layout           # Site layout
│  ├─ posts            # Editor and publishing workflow
│  ├─ search           # Search experience
│  └─ ui               # Reusable UI primitives
├─ src/lib             # Auth, Prisma, SEO, cache, validation, rate limit, and utilities
├─ prisma              # Data model and migrations
├─ docs                # Design, implementation, deployment, and planning docs
├─ deploy              # Deployment support files such as Nginx config
└─ .github/workflows   # CI and deploy workflows
```

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in at least the database and auth-related values.

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

### 3. Initialize the database

```bash
pnpm prisma generate
pnpm prisma migrate dev
```

### 4. Start the development server

```bash
pnpm dev
```

The default local address is `http://localhost:3000`.

## Environment Variables

See `.env.example` for the full template. The most important variables are listed below:

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Auth signing secret |
| `NEXTAUTH_SECRET` | Yes | NextAuth secret |
| `NEXTAUTH_URL` | Yes | Auth callback base URL |
| `NEXT_PUBLIC_SITE_URL` | Yes | Public site URL |
| `AUTH_GITHUB_ID` | No | GitHub OAuth Client ID |
| `AUTH_GITHUB_SECRET` | No | GitHub OAuth Client Secret |
| `QINIU_ACCESS_KEY` | No | Qiniu Access Key |
| `QINIU_SECRET_KEY` | No | Qiniu Secret Key |
| `QINIU_BUCKET` | No | Qiniu bucket name |
| `QINIU_DOMAIN` | No | Qiniu asset domain |
| `QINIU_UPLOAD_URL` | No | Qiniu upload endpoint |
| `DASHSCOPE_API_KEY` | No | DashScope API key |
| `DASHSCOPE_BASE_URL` | No | DashScope-compatible base URL |
| `DASHSCOPE_MODEL` | No | DashScope model name |

## Common Commands

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm test
pnpm test:e2e
```

## Data Model Overview

The core Prisma models in the project are:

- `User` / `Account` / `Session` / `VerificationToken`
- `Post` / `Category` / `Tag`
- `Comment` / `Like` / `Bookmark`

`Post`, `Category`, `Tag`, and `Comment` all support soft deletion through `deletedAt`. `Comment` supports nested replies and moderation states, while `Post` includes `readingTimeMinutes` for reading-time estimation.

## Testing and Quality

The repository already includes unit, component, and end-to-end testing support:

```bash
pnpm test
pnpm test:e2e
pnpm build
```

Coverage includes public reading flows, admin pages, search, comments, likes, image fallback handling, and the Markdown editor workflow.

## Deployment

The project currently uses a split CI/CD flow:

- CI runs automatically on every push and pull request
- CD is triggered manually through GitHub Actions
- Production deployment rebuilds the app with `docker-compose.prod.yml` and applies Prisma migrations on the server

Key entry points:

- CI workflow: `.github/workflows/ci.yml`
- Deploy workflow: `.github/workflows/deploy.yml`
- Production compose file: `docker-compose.prod.yml`
- Nginx config: `deploy/nginx.my-next-app.conf`
- Deployment guide: `docs/deployment/github-actions-manual-deploy.md`

Current public server address:

```text
http://47.98.167.32
```

## Additional Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [PROJECT_DOCS.md](./PROJECT_DOCS.md)
- [Deployment Guide](./docs/deployment/github-actions-manual-deploy.md)
- [Server Execution Checklist](./docs/deployment/server-execution-checklist.md)

## Good Fit For

This repository is a good fit if you want:

- a personal blog or content site that is ready for continued iteration
- an integrated frontend and admin workflow instead of a display-only template
- self-hosted deployment with full operational control
- a Markdown publishing flow with image uploads and optional AI-generated summaries
