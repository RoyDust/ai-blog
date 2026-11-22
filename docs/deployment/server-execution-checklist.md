# Server Execution Checklist

> Target server: `47.98.167.32`
> Domain: `roydust.top` (`https://roydust.top`)
> Deployment path: `/opt/my-next-app`
> Access mode: HTTPS domain terminated at Nginx (`deploy/nginx.my-next-app.conf`)

## Assumptions

- The project code is already pushed to GitHub.
- GitHub Actions workflows are already present in the repo.
- DNS `A` records for your domain (for example `roydust.top` and `www.roydust.top`) point to the server IP.
- The server OS is Alibaba Cloud Linux 3.
- Deployment uses `GitHub Actions + rsync/scp + Docker Compose + Nginx + Let's Encrypt TLS`.
- Host `node` (Node.js 20+) is installed on the server for release dotenv parsing and artifact pruning scripts.

## 1. Log in to the server

Run locally:

```bash
ssh your_user@47.98.167.32
```

## 2. Update the system and install base packages

```bash
sudo dnf update -y
sudo dnf install -y git nginx nodejs certbot python3-certbot-nginx
```

Verify:

```bash
git --version
nginx -v
node --version
```

## 3. Install and start Docker

If Docker is not installed yet:

```bash
sudo dnf install -y docker
sudo systemctl enable docker
sudo systemctl start docker
```

Verify:

```bash
docker --version
sudo docker ps
```

## 4. Install Docker Compose plugin

```bash
sudo dnf install -y docker-compose-plugin
```

Verify:

```bash
docker compose version
```

## 5. Allow the current user to run Docker

```bash
sudo usermod -aG docker $USER
```

Log out, then log back in:

```bash
exit
ssh your_user@47.98.167.32
```

Verify:

```bash
docker ps
```

## 6. Create deployment directories

```bash
sudo mkdir -p /opt/my-next-app/releases
sudo mkdir -p /opt/my-next-app/shared
sudo chown -R $USER:$USER /opt/my-next-app
```

Verify:

```bash
ls -la /opt/my-next-app
ls -la /opt/my-next-app/releases
ls -la /opt/my-next-app/shared
```

## 7. Issue TLS certificate and configure Nginx HTTPS gateway

Create the ACME webroot and obtain a Let's Encrypt certificate for your domain:

```bash
sudo mkdir -p /var/www/certbot
sudo certbot certonly --webroot -w /var/www/certbot -d roydust.top -d www.roydust.top
```

Copy `deploy/nginx.my-next-app.conf` to `/etc/nginx/conf.d/my-next-app.conf` and update `ssl_certificate` / `ssl_certificate_key` to your certificate directory (for example `/etc/letsencrypt/live/roydust.top/fullchain.pem` and `privkey.pem`):

```bash
sudo tee /etc/nginx/conf.d/my-next-app.conf > /dev/null <<'EOF'
server_tokens off;

map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      '';
}

upstream inkforge_upstream {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name roydust.top www.roydust.top;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name roydust.top www.roydust.top;

    ssl_certificate /etc/letsencrypt/live/roydust.top/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/roydust.top/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    proxy_hide_header Strict-Transport-Security;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    client_max_body_size 10m;

    location /api/admin/ai/ {
        proxy_pass http://inkforge_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
    }

    location /api/admin/covers/generate {
        proxy_pass http://inkforge_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
    }

    location /api/admin/posts/ {
        proxy_pass http://inkforge_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
    }

    location /api/ai/drafts {
        proxy_pass http://inkforge_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
    }

    location / {
        proxy_pass http://inkforge_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
EOF
```

Test and reload:

```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
sudo systemctl status nginx --no-pager
```

## 8. Open firewall ports

If `firewalld` is enabled:

```bash
sudo systemctl enable firewalld
sudo systemctl start firewalld
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --reload
sudo firewall-cmd --list-all
```

Also make sure the Alibaba Cloud security group allows:

- `22`
- `80`
- `443`

## 9. Generate the GitHub Actions deploy key

Run on your local machine:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ./deploy_key
```

This creates:

- `deploy_key`
- `deploy_key.pub`

## 10. Install the public key on the server

Run locally:

```bash
cat deploy_key.pub | ssh your_user@47.98.167.32 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

Test it and capture pinned host keys for `DEPLOY_KNOWN_HOSTS` (verify fingerprint on the server with `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`):

```bash
ssh -i ./deploy_key your_user@47.98.167.32
ssh-keyscan -p 22 -t ed25519,rsa 47.98.167.32 > deploy_known_hosts
```

## 11. Prepare the production database URL

Prepare a final database connection string like this:

```env
DATABASE_URL="postgresql://dbuser:dbpassword@dbhost:5432/my_next_app?schema=public"
```

Make sure this database is reachable from the app container.

## 12. Configure GitHub Actions secrets and variables

Go to:

- `GitHub`
- `Settings`
- `Secrets and variables` / `Environments` (`production`)
- `Actions`

Add the following secrets (and set environment variable `COMPOSE_PROJECT_NAME`, e.g. `current`):

### `DEPLOY_HOST`

```text
47.98.167.32
```

### `DEPLOY_PORT`

```text
22
```

### `DEPLOY_USER`

```text
your server username
```

### `DEPLOY_SSH_KEY`

```text
the full contents of deploy_key
```

### `DEPLOY_KNOWN_HOSTS`

```text
the verified contents of deploy_known_hosts
```

### `DEPLOY_PATH`

```text
/opt/my-next-app
```

### `PRODUCTION_BASE_URL`

```text
https://roydust.top
```

### `CRON_SECRET` and `AI_NEWS_CRON_SECRET`

```text
strong random 32-byte secrets (injected safely by deploy.yml into each release .env)
```

### `APP_ENV_FILE`

Use full production env content (`NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL` MUST use `https://` for non-loopback hosts; plaintext `http://` public URLs fail production readiness preflight):

```env
DATABASE_URL="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@YOUR_DB_HOST:5432/YOUR_DB_NAME?schema=public"
AUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_URL="https://roydust.top"
NEXT_PUBLIC_SITE_URL="https://roydust.top"
OPERATION_LOG_INGEST_SECRET="replace-with-a-long-random-secret"

AUTH_GITHUB_ID=""
AUTH_GITHUB_SECRET=""

QINIU_ACCESS_KEY=""
QINIU_SECRET_KEY=""
QINIU_BUCKET=""
QINIU_DOMAIN=""
QINIU_UPLOAD_URL="https://up-z2.qiniup.com"

DASHSCOPE_API_KEY=""
DASHSCOPE_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
DASHSCOPE_MODEL="qwen3.5-flash"
```

## 13. Push the code to GitHub

Run locally in the project directory:

```bash
git status
git add .
git commit -m "chore: add CI/CD deployment pipeline"
git push origin main
```

## 14. Wait for the CI workflow to pass

In GitHub Actions, confirm that `CI` passes:

- install dependencies
- prisma generate
- prisma migrate deploy
- lint & typecheck
- test
- build

## 15. Run the Deploy workflow manually

In GitHub Actions:

- open `Deploy`
- click `Run workflow`

Inputs:

- `ref`: `main`
- `environment`: `production`

## 16. Verify the deployment on the server

SSH back into the server and run:

```bash
cd /opt/my-next-app/current
ls -la
cat /opt/my-next-app/shared/last-healthy-release
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 app
curl --fail http://127.0.0.1:3000/api/health/live
curl --fail http://127.0.0.1:3000/api/health/ready
curl -I http://roydust.top
curl -I https://roydust.top
```

Then open in a browser:

```text
https://roydust.top
```

## 17. Troubleshooting commands

If deployment fails, check:

```bash
cd /opt/my-next-app/current
docker compose -f docker-compose.prod.yml logs --tail=200 app
sudo systemctl status nginx --no-pager
sudo tail -n 100 /var/log/nginx/error.log
```

## 18. Rollback

Stop active senders and verify schema and stored attempt-state compatibility before switching releases. Image rollback does not reverse migrations. A deployment updates `shared/.env`, `shared/last-healthy-release`, and `current` only after `running healthy`; see [P2 release and recovery procedures](./p2-recovery-runbook.md) for required checks and recovery boundaries.

Inspect the last healthy release metadata and retained `pre-*` images:

```bash
cat /opt/my-next-app/shared/last-healthy-release
ls -la /opt/my-next-app/releases
docker image ls 'my-next-app:pre-*'
```

Recover using the retained pre-deploy image and the untouched release directory (`current` still points to the last healthy release when a deploy fails):

```bash
PREV_TAG=$(docker image ls --format '{{.Repository}}:{{.Tag}}' 'my-next-app:pre-*' | head -n 1)
PREV_IMAGE_ID=$(docker image inspect "$PREV_TAG" --format '{{.Id}}')
docker tag "$PREV_TAG" my-next-app:latest
cd /opt/my-next-app/current
BACKUP_BEFORE_DEPLOY=0 DEPLOY_PATH=/opt/my-next-app PREBUILT_IMAGE_ID="$PREV_IMAGE_ID" bash scripts/deploy/deploy-remote.sh
```

## 19. Common failure points

- `APP_ENV_FILE` contains a wrong `DATABASE_URL` or uses `http://` instead of `https://` for `NEXTAUTH_URL` / `NEXT_PUBLIC_SITE_URL`
- `DEPLOY_KNOWN_HOSTS` is missing or does not match the server SSH host key
- Host `node` is not installed on the server
- `DEPLOY_USER` cannot run Docker
- Alibaba Cloud security group does not allow ports `80` and `443`
- `DEPLOY_SSH_KEY` is not the full private key content
- the database is not reachable from inside the container
- `docker compose` is not available on the server

## 20. Recommended execution order

1. Complete server setup: sections `2` to `8`
2. Configure GitHub secrets: sections `9` to `12`
3. Push code: section `13`
4. Wait for CI: section `14`
5. Trigger deployment: section `15`
6. Verify and debug if needed: sections `16` to `19`
