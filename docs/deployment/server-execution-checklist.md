# Server Execution Checklist

> Target server: `47.98.167.32`
> Deployment path: `/opt/my-next-app`
> Access mode: direct IP, no domain yet

## Assumptions

- The project code is already pushed to GitHub.
- GitHub Actions workflows are already present in the repo.
- The server OS is Alibaba Cloud Linux 3.
- Deployment uses `GitHub Actions + rsync/scp + Docker Compose + Nginx`.

## 1. Log in to the server

Run locally:

```bash
ssh your_user@47.98.167.32
```

## 2. Update the system and install base packages

```bash
sudo dnf update -y
sudo dnf install -y git nginx
```

Verify:

```bash
git --version
nginx -v
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

## 7. Configure Nginx

Write the Nginx config directly on the server:

```bash
sudo tee /etc/nginx/conf.d/my-next-app.conf > /dev/null <<'EOF'
server {
    listen 80;
    server_name 47.98.167.32;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
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

Test it:

```bash
ssh -i ./deploy_key your_user@47.98.167.32
```

## 11. Prepare the production database URL

Prepare a final database connection string like this:

```env
DATABASE_URL="postgresql://dbuser:dbpassword@dbhost:5432/my_next_app?schema=public"
```

Make sure this database is reachable from the app container.

## 12. Configure GitHub Actions secrets

Go to:

- `GitHub`
- `Settings`
- `Secrets and variables`
- `Actions`

Add the following secrets:

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

### `DEPLOY_PATH`

```text
/opt/my-next-app
```

### `APP_ENV_FILE`

Use full production env content, for example:

```env
DATABASE_URL="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@YOUR_DB_HOST:5432/YOUR_DB_NAME?schema=public"
AUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_URL="http://47.98.167.32"
NEXT_PUBLIC_SITE_URL="http://47.98.167.32"

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
- prisma db push
- lint
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
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 app
curl -I http://127.0.0.1:3000
curl -I http://47.98.167.32
```

Then open in a browser:

```text
http://47.98.167.32
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

List releases:

```bash
ls -la /opt/my-next-app/releases
```

Switch back to an older release:

```bash
cd /opt/my-next-app
ln -sfn /opt/my-next-app/releases/<older-git-sha> current
cd current
bash scripts/deploy/deploy-remote.sh
```

## 19. Common failure points

- `APP_ENV_FILE` contains a wrong `DATABASE_URL`
- `DEPLOY_USER` cannot run Docker
- Alibaba Cloud security group does not allow port `80`
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

