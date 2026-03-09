# GitHub Actions Manual Server Deploy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a CI/CD pipeline where GitHub Actions validates the Next.js app on every push/PR, then allows a manual deploy that packages the app and uploads it to the Alibaba Cloud Linux server over `scp/rsync`.

**Architecture:** Keep CI and CD separate. CI runs in GitHub Actions and performs dependency install, Prisma client generation, lint, unit tests, and `next build`. CD is a manually triggered GitHub Actions workflow that creates a deployment bundle, uploads it to the server, refreshes the app with `docker compose`, and runs `prisma migrate deploy` inside the application container. The server remains the runtime owner: Docker Compose runs the app, Nginx reverse-proxies traffic, and secrets stay on the server.

**Tech Stack:** Next.js 16, React 19, TypeScript, pnpm, Prisma, PostgreSQL, Docker, Docker Compose, Nginx, GitHub Actions, SSH, `rsync`/`scp`.

---

## Assumptions to lock before implementation

- Git hosting is GitHub.
- Deployment target is Alibaba Cloud Linux 3 with Docker already installed.
- Release policy is: CI on push/PR, deploy only from a manually triggered GitHub Actions workflow.
- Code is uploaded from GitHub Actions to the server instead of the server pulling from Git.
- The production database already exists or will be created on the server side before first release.
- Domain name, TLS certificate strategy, and final server directory are not yet fixed; use configurable placeholders in docs and workflow secrets.

## Required GitHub repository secrets

- `DEPLOY_HOST` — public IP or hostname of the server.
- `DEPLOY_PORT` — SSH port, typically `22`.
- `DEPLOY_USER` — Linux user used for deployment.
- `DEPLOY_SSH_KEY` — private key for the deploy user.
- `DEPLOY_PATH` — absolute remote directory, for example `/opt/my-next-app`.
- `APP_ENV_FILE` — full production `.env` contents written on the server during deploy.

## Required server-side prerequisites

- Create deploy directory, for example `/opt/my-next-app`.
- Install Docker Compose plugin and verify `docker compose version` works.
- Install Nginx and prepare a site config that proxies to the app container.
- Ensure the deploy user can write to `DEPLOY_PATH` and run Docker commands.
- Open firewall/security-group ports `80` and `443`.
- Prepare persistent directories such as `/opt/my-next-app/shared` if logs or uploads need to survive redeploys.

## File map

- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy.yml`
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `docker-compose.prod.yml`
- Create: `deploy/nginx.my-next-app.conf`
- Create: `scripts/deploy/deploy-remote.sh`
- Create: `.env.example` if it does not already exist
- Modify: `README.md`
- Create: `docs/deployment/github-actions-manual-deploy.md`

### Task 1: Add the production container definition

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

**Step 1: Write the failing build check locally**

Run: `docker build -t my-next-app:test .`
Expected: FAIL because no production Dockerfile exists yet.

**Step 2: Add a multi-stage Dockerfile**

Implement a Dockerfile that:
- uses a Node 20 base image compatible with Next.js 16
- enables `pnpm` through Corepack
- installs dependencies from `pnpm-lock.yaml`
- runs `pnpm prisma generate`
- runs `pnpm build`
- copies only runtime artifacts into the final image
- exposes port `3000`
- starts the app with `pnpm start`

**Step 3: Add `.dockerignore`**

Ignore at least:
- `.git`
- `.next`
- `node_modules`
- `test-results`
- `e2e`
- local env files that should not enter the image build context

**Step 4: Re-run the image build**

Run: `docker build -t my-next-app:test .`
Expected: PASS.

### Task 2: Add production compose orchestration

**Files:**
- Create: `docker-compose.prod.yml`
- Create: `scripts/deploy/deploy-remote.sh`

**Step 1: Define runtime topology**

Use a single `app` service that:
- builds from the local Dockerfile or references a local image tag
- loads variables from `.env`
- binds `3000:3000` only if Nginx will proxy from the host
- uses `restart: unless-stopped`
- sets `NODE_ENV=production`

If PostgreSQL is already managed outside Compose, do not add a database service.

**Step 2: Add remote deployment script**

Create `scripts/deploy/deploy-remote.sh` to run on the server and:
- switch into `DEPLOY_PATH/current`
- ensure `.env` exists
- run `docker compose -f docker-compose.prod.yml down --remove-orphans`
- run `docker compose -f docker-compose.prod.yml up -d --build`
- wait briefly for the app container to become ready
- run `docker compose -f docker-compose.prod.yml exec -T app pnpm prisma migrate deploy`
- optionally run `docker image prune -f`

**Step 3: Dry-run script lint**

Run: `bash -n scripts/deploy/deploy-remote.sh`
Expected: PASS.

### Task 3: Add CI workflow for push and pull request validation

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Define CI triggers**

Trigger on:
- `push`
- `pull_request`

Limit branches if desired to `main` and active feature branches.

**Step 2: Implement workflow jobs**

The workflow should:
- check out the repo
- set up Node 20
- enable pnpm caching
- run `pnpm install --frozen-lockfile`
- run `pnpm prisma generate`
- run `pnpm lint`
- run `pnpm test`
- run `pnpm build`

If tests need environment variables, write a small test-safe `.env` within the workflow using GitHub secrets or inert placeholders.

**Step 3: Validate workflow syntax**

Run: `git diff -- .github/workflows/ci.yml`
Expected: workflow structure includes valid YAML, named jobs, and the commands above.

### Task 4: Add manual deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

**Step 1: Define manual trigger**

Use `workflow_dispatch` with inputs such as:
- `environment` defaulting to `production`
- `ref` defaulting to the current branch or `main`

**Step 2: Implement deploy packaging**

The workflow should:
- check out the requested ref
- set up Node 20 and pnpm
- run `pnpm install --frozen-lockfile`
- run `pnpm prisma generate`
- optionally run `pnpm build` again as a safety gate before deployment
- create a release directory such as `release/`
- copy only deployment artifacts into it:
  - built application files required for runtime
  - `package.json`
  - `pnpm-lock.yaml`
  - `prisma/`
  - `Dockerfile`
  - `.dockerignore`
  - `docker-compose.prod.yml`
  - `scripts/deploy/deploy-remote.sh`

Do not upload `.git`, local test output, or local development env files.

**Step 3: Upload via SSH**

Use a trusted GitHub Action for SSH key setup and then:
- create `${DEPLOY_PATH}/releases/${GITHUB_SHA}` on the server
- upload the release bundle with `rsync -az --delete` or `scp -r`
- write `${DEPLOY_PATH}/shared/.env` from `APP_ENV_FILE`
- update `${DEPLOY_PATH}/current` to the new release
- execute `bash scripts/deploy/deploy-remote.sh`

**Step 4: Add deploy safety**

Add:
- `concurrency` so only one production deploy runs at a time
- GitHub environment protection for `production`
- clear job output for uploaded SHA and target host

### Task 5: Add Nginx production example and deployment docs

**Files:**
- Create: `deploy/nginx.my-next-app.conf`
- Create: `docs/deployment/github-actions-manual-deploy.md`
- Modify: `README.md`

**Step 1: Add Nginx example**

Create a host-level Nginx config that:
- listens on `80`
- proxies requests to `127.0.0.1:3000`
- forwards `Host`, `X-Forwarded-Proto`, and client IP headers
- supports websocket upgrade headers

Leave TLS commands to deployment docs unless the domain is already known.

**Step 2: Write deployment runbook**

Document:
- required GitHub secrets
- first-time server bootstrap steps
- deploy directory layout
- how to trigger manual deployment from Actions
- how to inspect logs with `docker compose logs -f app`
- rollback by repointing `current` to a previous release and rerunning the remote script

**Step 3: Update README**

Add a short “Deployment” section linking to `docs/deployment/github-actions-manual-deploy.md` and mention the required environment variables in `.env.example`.

### Task 6: Add production environment template

**Files:**
- Create: `.env.example` if missing
- Modify: `README.md`

**Step 1: Add environment placeholders**

Include at least:
- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_SITE_URL`
- optional GitHub auth vars if used in production
- optional Qiniu vars if production uploads need them

**Step 2: Verify docs align with runtime**

Check that every env var referenced by `src`, `prisma`, `next.config.ts`, or auth config is represented in `.env.example` or explicitly documented as optional.

### Task 7: Verify the complete deployment path

**Files:**
- Modify as needed: `.github/workflows/ci.yml`
- Modify as needed: `.github/workflows/deploy.yml`
- Modify as needed: `docker-compose.prod.yml`
- Modify as needed: `scripts/deploy/deploy-remote.sh`

**Step 1: Local verification**

Run:
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `docker build -t my-next-app:test .`

Expected: PASS.

**Step 2: Workflow verification**

Confirm both workflow files are present and visible in GitHub Actions.

**Step 3: Server smoke check after first deploy**

Run on server:
- `docker compose -f /opt/my-next-app/current/docker-compose.prod.yml ps`
- `docker compose -f /opt/my-next-app/current/docker-compose.prod.yml logs --tail=100 app`
- `curl -I http://127.0.0.1:3000`

Expected:
- container is healthy/running
- Prisma migrations complete without error
- application returns `200`, `302`, or another expected HTTP response

## Notes and constraints

- Keep secrets out of the repo; production `.env` must come from GitHub secrets and be written on the server.
- Prefer `rsync` over `scp` for repeat deploys because it is faster and easier to reason about.
- Do not run `prisma migrate dev` in CI/CD; production must use `prisma migrate deploy`.
- If the app depends on image uploads or local storage, map those directories explicitly in `docker-compose.prod.yml` before first production use.
- If Playwright e2e is too slow or brittle for every push, leave it out of initial CI and add it later behind a separate job.

## Suggested implementation order

1. `Dockerfile` and `.dockerignore`
2. `docker-compose.prod.yml` and remote deploy script
3. `.env.example`
4. CI workflow
5. manual deploy workflow
6. Nginx example and docs
7. full verification

