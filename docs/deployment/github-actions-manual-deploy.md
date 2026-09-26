# GitHub Actions Manual Deploy

This project uses a split CI/CD flow:

- CI runs automatically on every push and pull request.
- CD is triggered manually from GitHub Actions.
- GitHub Actions uploads a release bundle to the server over SSH.
- The server loads the uploaded image, or builds it when no image bundle is supplied, then validates configuration before Prisma migrations and service replacement.

## GitHub secrets

Add these repository or environment secrets:

- `DEPLOY_HOST`: server public IP or hostname
- `DEPLOY_PORT`: SSH port, usually `22`
- `DEPLOY_USER`: SSH user with access to the deploy directory and Docker
- `DEPLOY_SSH_KEY`: private key for that user
- `DEPLOY_PATH`: remote app root, for example `/opt/my-next-app`
- `APP_ENV_FILE`: full production `.env` file contents

Set the environment variable `COMPOSE_PROJECT_NAME` to the existing server's Compose project label (production currently uses `current`). The workflow persists this identity in the uploaded environment file so changing release directories does not create a different Compose project.

Production configuration is validated before image build and upload, without inheriting CI test defaults. A missing or placeholder `NEXTAUTH_SECRET` is aligned with an existing valid `AUTH_SECRET`; the latter is never rotated by deployment. Two valid, distinct secrets are preserved. Invalid required values stop deployment.

## Server bootstrap

1. Install Docker and verify `docker compose version` works.
2. Install Nginx.
3. Create the deploy directory:

```bash
sudo mkdir -p /opt/my-next-app/releases /opt/my-next-app/shared
sudo chown -R <deploy-user>:<deploy-user> /opt/my-next-app
```

4. Make sure the deploy user can run Docker commands.
5. Copy `deploy/nginx.my-next-app.conf` to `/etc/nginx/conf.d/my-next-app.conf`. It is already prepared for server IP `47.98.167.32`.
6. Reload Nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## First deploy

1. Fill `APP_ENV_FILE` with the production variables from `.env.example`.
2. Open GitHub Actions.
3. Run the `Deploy` workflow.
4. Use `ref=main` and `environment=production` unless you have a different target.

## Runtime layout

- `${DEPLOY_PATH}/releases/<git-sha>`: uploaded release bundle
- `${DEPLOY_PATH}/shared/.env`: production env file
- `${DEPLOY_PATH}/current`: symlink to the active release

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

1. Stop active senders and confirm the old image is compatible with applied migrations and stored Newsletter attempt states. Switching images does not reverse migrations.
2. Point `current` to an older release.
3. Re-run the remote deploy script and verify readiness.

```bash
cd /opt/my-next-app
ln -sfn /opt/my-next-app/releases/<older-sha> current
cd current
bash scripts/deploy/deploy-remote.sh
```

## Notes

- Keep production secrets only in GitHub secrets and on the server.
- Use `prisma migrate deploy` in production; do not use `prisma migrate dev`.
- If you add file uploads that must persist locally, mount those directories in `docker-compose.prod.yml`.
