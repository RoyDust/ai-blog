FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV HTTP_PROXY="" \
 HTTPS_PROXY="" \
 ALL_PROXY="" \
 http_proxy="" \
 https_proxy="" \
 all_proxy="" \
 npm_config_proxy="" \
 npm_config_https_proxy="" \
 NPM_CONFIG_PROXY="" \
 NPM_CONFIG_HTTPS_PROXY=""
RUN unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy npm_config_proxy npm_config_https_proxy NPM_CONFIG_PROXY NPM_CONFIG_HTTPS_PROXY \
 && corepack disable \
 && npm config set registry https://registry.npmmirror.com/ \
 && npm install -g pnpm@10 --registry=https://registry.npmmirror.com/
RUN unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy npm_config_proxy npm_config_https_proxy NPM_CONFIG_PROXY NPM_CONFIG_HTTPS_PROXY \
 && pnpm config set registry https://registry.npmmirror.com/ \
 && pnpm config set @fontsource:registry https://registry.npmjs.org/ \
 && pnpm config set fetch-retries 5 \
 && pnpm config set fetch-retry-factor 2 \
 && pnpm config set fetch-retry-mintimeout 20000 \
 && pnpm config set fetch-retry-maxtimeout 120000 \
 && pnpm config set network-timeout 300000

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy npm_config_proxy npm_config_https_proxy NPM_CONFIG_PROXY NPM_CONFIG_HTTPS_PROXY \
 && pnpm install --frozen-lockfile

FROM deps AS prisma-cli
WORKDIR /opt/prisma-cli
RUN printf '{"name":"inkforge-prisma-cli","private":true,"pnpm":{"onlyBuiltDependencies":["@prisma/engines","prisma"]}}\n' > package.json \
 && unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy npm_config_proxy npm_config_https_proxy NPM_CONFIG_PROXY NPM_CONFIG_HTTPS_PROXY \
 && pnpm add --prefer-offline prisma@7.4.2 dotenv@17.3.1 pg@8.19.0 \
 && ./node_modules/.bin/prisma --version

FROM deps AS builder
ARG NEXTAUTH_URL
ARG NEXT_PUBLIC_SITE_URL
COPY . .
RUN pnpm prisma generate
RUN node scripts/build-web-health.cjs
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:1/build" \
 NEXTAUTH_URL="$NEXTAUTH_URL" \
 NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_SITE_URL" \
 pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
 HOSTNAME="0.0.0.0" \
 PORT=3000 \
 HOME="/home/node" \
 NPM_CONFIG_CACHE="/home/node/.npm"
COPY --chown=node:node --from=prisma-cli /opt/prisma-cli /opt/prisma-cli
COPY --chown=node:node --from=builder /app/.next/standalone ./
COPY --chown=node:node --from=builder /app/.next/static ./.next/static
COPY --chown=node:node --from=builder /app/public ./public
COPY --chown=node:node --from=builder /app/prisma ./prisma
COPY --chown=node:node --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --chown=node:node --from=builder /app/.generated/web-health ./.generated/web-health
COPY --chown=node:node --from=builder /app/scripts/check-web-readiness.cjs ./scripts/check-web-readiness.cjs
RUN mkdir -p /app/.next/cache /app/node_modules/.bin /home/node/.cache /home/node/.local/share/pnpm \
 && rm -f /app/node_modules/.bin/prisma \
 && printf '#!/bin/sh\nexport NODE_PATH="/opt/prisma-cli/node_modules:/app/node_modules${NODE_PATH:+:$NODE_PATH}"\nexec node /opt/prisma-cli/node_modules/prisma/build/index.js "$@"\n' > /app/node_modules/.bin/prisma \
 && chmod +x /app/node_modules/.bin/prisma \
 && if [ ! -e /app/node_modules/prisma ]; then rm -rf /app/node_modules/prisma && ln -s /opt/prisma-cli/node_modules/prisma /app/node_modules/prisma; fi \
 && if [ ! -e /app/node_modules/dotenv ]; then rm -rf /app/node_modules/dotenv && ln -s /opt/prisma-cli/node_modules/dotenv /app/node_modules/dotenv; fi \
 && if [ ! -e /app/node_modules/pg ]; then rm -rf /app/node_modules/pg && ln -s /opt/prisma-cli/node_modules/pg /app/node_modules/pg; fi \
 && chown -R node:node /app /home/node
USER node
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:1/build" pnpm prisma validate
EXPOSE 3000
CMD ["node", "server.js"]
