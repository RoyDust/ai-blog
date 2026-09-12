# README Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite the repository README so it presents the project professionally while staying faithful to the current codebase.

**Architecture:** Treat README work as a documentation refactor. First inventory verifiable project facts, then rebuild the document around a stronger information hierarchy, and finally validate commands, links, and claims against the repository.

**Tech Stack:** Markdown, Next.js 16, React 19, Prisma 7, PostgreSQL, NextAuth.js, GitHub Actions, Docker Compose

---

### Task 1: Inventory Verifiable Project Facts

**Files:**
- Modify: `README.md`
- Reference: `package.json`
- Reference: `prisma/schema.prisma`
- Reference: `.env.example`
- Reference: `docs/deployment/github-actions-manual-deploy.md`

**Step 1: Read the current repo metadata**

Check package scripts, dependencies, Prisma models, env vars, and deployment docs.

**Step 2: Extract only supported claims**

Record confirmed features such as:

- public reading pages
- admin back office
- markdown editor
- anonymous comments and likes
- local bookmark shelf
- RSS / sitemap / robots / manifest
- Qiniu upload support
- DashScope summary support

**Step 3: Remove risky claims**

Avoid promising screenshots, hosted auth providers, or production flows that are not clearly wired into the current app UX.

### Task 2: Redesign README Information Hierarchy

**Files:**
- Modify: `README.md`
- Create: `docs/plans/2026-03-28-readme-redesign-design.md`

**Step 1: Define the new section order**

Use:

1. Hero
2. Overview
3. Highlights
4. Feature panorama
5. Tech stack
6. Project structure
7. Quick start
8. Env vars
9. Testing
10. Deployment
11. Docs index

**Step 2: Write reader-first copy**

Prefer concise explanation over exhaustive prose. Each section should answer one user question quickly.

### Task 3: Rewrite README Content

**Files:**
- Modify: `README.md`

**Step 1: Replace the opening**

Add project title, positioning sentence, badges, and key links.

**Step 2: Group features by scenario**

Split features into:

- reader experience
- author and admin workflow
- engineering and platform support

**Step 3: Upgrade onboarding instructions**

Include installation, env setup, Prisma commands, local dev, test commands, and production deployment entry points.

### Task 4: Validate Links and Commands

**Files:**
- Modify: `README.md`

**Step 1: Check all referenced files exist**

Confirm linked docs and config files are present in the repository.

**Step 2: Check commands are runnable in this repo**

Confirm `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm test`, and `pnpm test:e2e` align with `package.json`.

**Step 3: Review final diff**

Ensure tone, formatting, and technical accuracy all match the repository.
