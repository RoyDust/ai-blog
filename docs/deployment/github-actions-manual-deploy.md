# GitHub Actions Manual Deploy

This project uses a split CI/CD flow:

- CI runs automatically on every push and pull request.
- CD is triggered manually from GitHub Actions.
- GitHub Actions uploads a release bundle to the server over SSH.
- The server rebuilds the Docker image with `docker compose` and applies Prisma migrations.

## GitHub secrets

Add these repository or environment secrets:

- `DEPLOY_HOST`: server public IP or hostname
- `DEPLOY_PORT`: SSH port, usually `22`
- `DEPLOY_USER`: SSH user with access to the deploy directory and Docker
- `DEPLOY_SSH_KEY`: private key for that user
- `DEPLOY_PATH`: remote app root, for example `/opt/my-next-app`
- `APP_ENV_FILE`: full production `.env` file contents

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
curl -I http://127.0.0.1:3000
```

## Rollback

1. Point `current` to an older release.
2. Re-run the remote deploy script.

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
