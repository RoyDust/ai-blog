# roydust.top HTTPS + HTTP/2 部署指南

> 目标域名：`roydust.top`
> 目标服务器：`47.98.167.32`
> 应用上游：`http://127.0.0.1:3000`
> 目标：由 Nginx 终止 HTTPS，并让浏览器侧流量走 HTTP/2。

## 1. 前置条件

- `roydust.top` 的 DNS `A` 记录已指向 `47.98.167.32`。
- 可选：`www.roydust.top` 的 DNS `A` 记录也已指向 `47.98.167.32`。
- 阿里云安全组已放行入站 TCP `80` 和 TCP `443`。
- 服务器防火墙已放行 HTTP 和 HTTPS。
- 应用已经通过 Nginx 反代到 `127.0.0.1:3000`。
- Nginx 已包含 HTTP/2 模块。

检查 Nginx：

```bash
nginx -v
nginx -V 2>&1 | grep -o -- '--with-http_v2_module' || true
```

如果第二条命令没有输出，说明当前 Nginx 包可能不带 HTTP/2 支持，需要先安装支持 HTTP/2 的 Nginx 版本。

## 2. 确认当前 HTTP 站点可访问

在本地机器执行：

```bash
curl -I http://roydust.top
curl -I http://47.98.167.32
```

预期结果：

- `http://roydust.top` 能访问到 Nginx。
- Nginx 能把请求转发到 Next.js 应用。

HTTP 站点先可访问，Certbot 的 Nginx 签证书流程会更顺。

## 3. 放行防火墙端口

在服务器执行：

```bash
sudo systemctl enable firewalld
sudo systemctl start firewalld
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
sudo firewall-cmd --list-all
```

同时确认阿里云安全组已放行：

- TCP `80`
- TCP `443`

## 4. 安装 Certbot

Certbot 官方当前更推荐使用 snap 安装路径。

在服务器执行：

```bash
sudo dnf install -y snapd
sudo systemctl enable --now snapd.socket
sudo ln -s /var/lib/snapd/snap /snap 2>/dev/null || true
sudo snap install core
sudo snap refresh core
sudo dnf remove -y certbot python3-certbot-nginx || true
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/local/bin/certbot 2>/dev/null || true
certbot --version
```

如果当前服务器镜像不可用 snapd，可以使用系统包兜底：

```bash
sudo dnf install -y certbot python3-certbot-nginx
certbot --version
```

只选择一种安装方式即可；snap 可用时优先用 snap。

## 5. 保守签发证书

先使用 `certonly`，让 Certbot 只申请证书，不自动改写项目的 Nginx 配置。

```bash
sudo certbot certonly --nginx -d roydust.top -d www.roydust.top
```

如果没有配置 `www.roydust.top` 的 DNS，先只签主域名：

```bash
sudo certbot certonly --nginx -d roydust.top
```

确认证书文件存在：

```bash
sudo ls -la /etc/letsencrypt/live/roydust.top/
```

## 6. 替换 Nginx 配置

先备份当前配置：

```bash
sudo cp /etc/nginx/conf.d/my-next-app.conf /etc/nginx/conf.d/my-next-app.conf.bak.$(date +%Y%m%d%H%M%S)
```

写入 HTTPS + HTTP/2 配置：

```bash
sudo tee /etc/nginx/conf.d/my-next-app.conf > /dev/null <<'EOF'
server {
    listen 80;
    server_name roydust.top www.roydust.top;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    http2 on;

    server_name roydust.top www.roydust.top;

    ssl_certificate /etc/letsencrypt/live/roydust.top/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/roydust.top/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
```

如果 Nginx 版本较老，不支持 `http2 on;`，把：

```nginx
listen 443 ssl;
http2 on;
```

替换成：

```nginx
listen 443 ssl http2;
```

## 7. 测试并重载 Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl status nginx --no-pager
```

如果 `nginx -t` 失败，恢复备份：

```bash
sudo cp /etc/nginx/conf.d/my-next-app.conf.bak.<timestamp> /etc/nginx/conf.d/my-next-app.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 8. 更新生产环境变量

HTTPS 上线后，SEO canonical、RSS、sitemap 都应该输出 HTTPS 地址，所以需要更新服务器上的生产 `.env`。

先备份：

```bash
cd /opt/my-next-app/shared
cp .env .env.bak.$(date +%Y%m%d%H%M%S)
```

设置为：

```env
NEXT_PUBLIC_SITE_URL=https://roydust.top
NEXTAUTH_URL=https://roydust.top
SITE_URL=https://roydust.top
```

然后重新部署或重启应用容器，让 Next.js 构建期和运行期 metadata 都使用 HTTPS：

```bash
cd /opt/my-next-app/current
bash scripts/deploy/deploy-remote.sh
```

## 9. 验证 HTTPS 和 HTTP/2

在本地执行：

```bash
curl -I http://roydust.top
curl -I --http2 https://roydust.top
curl -I https://roydust.top/sitemap.xml
curl -I https://roydust.top/rss.xml
```

预期结果：

- HTTP 返回 `301`，跳转到 HTTPS。
- HTTPS 返回 `200`。
- `curl -I --http2` 显示 `HTTP/2 200`。
- 重新部署后，`sitemap.xml` 和 `rss.xml` 内部 URL 使用 `https://roydust.top`。

浏览器检查：

- 打开 `https://roydust.top`。
- 确认地址栏有锁标识。
- 在 DevTools Network 面板中显示 `Protocol` 列，确认文档和静态资源使用 `h2`。

## 10. 测试证书自动续期

```bash
sudo certbot renew --dry-run
```

如果 dry run 通过，后续证书续期通常会由 Certbot 的 timer 或 cron 自动处理。

检查 timer：

```bash
systemctl list-timers | grep -i certbot || true
```

## 11. 回滚

如果 HTTPS 配置影响生产访问，恢复 Nginx 备份：

```bash
sudo cp /etc/nginx/conf.d/my-next-app.conf.bak.<timestamp> /etc/nginx/conf.d/my-next-app.conf
sudo nginx -t
sudo systemctl reload nginx
```

如有需要，再恢复旧 `.env`：

```bash
cd /opt/my-next-app/shared
cp .env.bak.<timestamp> .env
cd /opt/my-next-app/current
bash scripts/deploy/deploy-remote.sh
```

## 参考资料

- Nginx HTTP/2 模块：https://nginx.org/en/docs/http/ngx_http_v2_module.html
- Certbot Nginx 指南：https://certbot.eff.org/instructions?os=centosrhel8&tab=standard&ws=nginx
