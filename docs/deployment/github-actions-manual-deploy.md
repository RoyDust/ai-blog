# GitHub Actions Manual Deploy

This project uses a split CI/CD flow:

- CI runs automatically on every push and pull request.
- CD is triggered manually from GitHub Actions.
- GitHub Actions uploads a release bundle to the server over SSH.
- The server loads the uploaded image, or builds it when no image bundle is supplied, then validates configuration before Prisma migrations and service replacement.

## GitHub secrets

Add these repository or environment (`production`) secrets:

- `DEPLOY_HOST`: server public IP or hostname
- `DEPLOY_PORT`: SSH port, usually `22`
- `DEPLOY_USER`: SSH user with access to the deploy directory and Docker
- `DEPLOY_SSH_KEY`: private key for that user
- `DEPLOY_KNOWN_HOSTS`: verified SSH host key line(s) for `DEPLOY_HOST` (strictly required; the workflow never runs `ssh-keyscan` dynamically)
- `DEPLOY_PATH`: remote app root, for example `/opt/my-next-app`
- `APP_ENV_FILE`: full production `.env` file contents (`NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL` must use `https://` on non-loopback hosts)
- `CRON_SECRET`: Bearer secret for `/api/cron/log-retention` (and `/api/cron/publish-scheduled`)
- `AI_NEWS_CRON_SECRET`: Bearer secret for `/api/cron/ai-news`
- `PRODUCTION_BASE_URL`: public `https://` origin used by scheduled GitHub Actions workflows

Set the environment variable `COMPOSE_PROJECT_NAME` to the existing server's Compose project label (production currently uses `current`). The workflow persists this identity in the uploaded environment file so changing release directories does not create a different Compose project.

Production configuration is validated before image build and upload, without inheriting CI test defaults. Appended cron secrets are serialized as literal single-quoted dotenv entries (when free of single quotes) so `$` characters are never interpolated by either `dotenv.parse` or Docker Compose `env_file`. A missing or placeholder `NEXTAUTH_SECRET` is aligned with an existing valid `AUTH_SECRET`; the latter is never rotated by deployment. Two valid, distinct secrets are preserved. Invalid required values (including plaintext `http://` public URLs) stop deployment.

## Server bootstrap

1. Install Docker and verify `docker compose version` works.
2. Install Node.js 20+ on the host (`node --version`); `deploy-remote.sh`, `backup-production.sh`, `read-dotenv.cjs`, and `prune-artifacts.cjs` invoke host `node` directly.
3. Install Nginx and Certbot, and issue a TLS certificate for your domain.
4. Create the deploy directory:

```bash
sudo mkdir -p /opt/my-next-app/releases /opt/my-next-app/shared
sudo chown -R <deploy-user>:<deploy-user> /opt/my-next-app
```

5. Make sure the deploy user can run Docker commands.
6. Copy `deploy/nginx.my-next-app.conf` to `/etc/nginx/conf.d/my-next-app.conf` and update `server_name` and `ssl_certificate` / `ssl_certificate_key` for your production domain.
7. Reload Nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## First deploy

1. Fill `APP_ENV_FILE` with the production variables from `.env.example` (using `https://` URLs for `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL`), and configure `DEPLOY_KNOWN_HOSTS`, `CRON_SECRET`, `AI_NEWS_CRON_SECRET`, and `PRODUCTION_BASE_URL`.
2. Open GitHub Actions.
3. Run the `Deploy` workflow.
4. Use `ref=main` and `environment=production` unless you have a different target (historical `inputs.ref` commits prior to `#60` are also supported via inline `dotenv.parse` fallback).

## Runtime layout

- `${DEPLOY_PATH}/releases/<resolved-sha>`: uploaded release bundle
- `${DEPLOY_PATH}/releases/<resolved-sha>/.env`: isolated `0600` per-release env snapshot uploaded before activation
- `${DEPLOY_PATH}/shared/.env`: `0600` copy of the active release env file, updated only after health checks pass
- `${DEPLOY_PATH}/shared/last-healthy-release`: metadata (`RELEASE_SHA`, `IMAGE_ID`, `LAST_BACKUP_DIR`) written after health checks pass
- `${DEPLOY_PATH}/shared/backups`: validated `pg_dump` custom archives (`0700` dir, `0600` files)
- `${DEPLOY_PATH}/current`: symlink to the active healthy release, switched only after health checks pass

## Logs and health checks

On the server:

```bash
cd /opt/my-next-app/current
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
curl --fail http://127.0.0.1:3000/api/health/live
curl --fail http://127.0.0.1:3000/api/health/ready
```

Only `running healthy` passes deployment. Docker probes readiness every 10 seconds with a 3-second timeout, a 20-second startup grace period and 3 retries. The deploy script observes health up to 12 times at 5-second intervals. Missing, exited, unhealthy or unreadable services and an expired deadline fail with a nonzero exit code. Readiness checks required Web configuration and a database read with a 2-second budget. Health routes are not cached or audited.

Failures preserve the container and print bounded, allowlisted diagnostic signals. There is no automatic rollback. See [P2 release and recovery procedures](./p2-recovery-runbook.md) for image smoke checks, Newsletter recovery and log retention scheduling.

## Rollback

For recovery after an uploaded image passed the isolated smoke check but activation failed before migration, `PREBUILT_IMAGE_ID=sha256:<verified-image-id>` can reuse that exact local image. Identity mismatch stops deployment. Configuration validation, database backup, migration and final health checks still run. Never use this option for an unverified image.

The backup reuses a cached official `postgres:<server-major>` image. If the server cannot reach Docker Hub, pull the matching official image on the CI runner and transfer it with `docker save` / `docker load` before recovery. A missing or unavailable backup client fails before stopping the existing service.

1. Stop active senders and confirm the old image is compatible with applied migrations and stored Newsletter attempt states. Switching images does not reverse migrations.
2. Inspect `${DEPLOY_PATH}/shared/last-healthy-release` (`RELEASE_SHA`, `IMAGE_ID`, `LAST_BACKUP_DIR`) and retag the retained `my-next-app:pre-*` image.
3. Re-run `deploy-remote.sh` from `${DEPLOY_PATH}/current` (or `${DEPLOY_PATH}/releases/<older-sha>` with `RELEASE_DIR` set — `deploy-remote.sh` updates `shared/.env`, `shared/last-healthy-release`, and `current` only after readiness passes).

```bash
cat /opt/my-next-app/shared/last-healthy-release
PREV_TAG=$(docker image ls --format '{{.Repository}}:{{.Tag}}' 'my-next-app:pre-*' | head -n 1)
PREV_IMAGE_ID=$(docker image inspect "$PREV_TAG" --format '{{.Id}}')
docker tag "$PREV_TAG" my-next-app:latest
cd /opt/my-next-app/current
BACKUP_BEFORE_DEPLOY=0 DEPLOY_PATH=/opt/my-next-app PREBUILT_IMAGE_ID="$PREV_IMAGE_ID" bash scripts/deploy/deploy-remote.sh
```

## Notes

- Keep production secrets only in GitHub secrets and on the server.
- Use `prisma migrate deploy` in production; do not use `prisma migrate dev`.
- If you add file uploads that must persist locally, mount those directories in `docker-compose.prod.yml`.
