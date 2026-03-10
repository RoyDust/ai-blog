FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN pnpm config set registry https://registry.npmmirror.com/ \
 && pnpm config set fetch-retries 5 \
 && pnpm config set fetch-retry-factor 2 \
 && pnpm config set fetch-retry-mintimeout 20000 \
 && pnpm config set fetch-retry-maxtimeout 120000 \
 && pnpm config set network-timeout 300000

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS builder
ARG DATABASE_URL
ARG AUTH_SECRET
ARG NEXTAUTH_SECRET
ARG NEXTAUTH_URL
ARG NEXT_PUBLIC_SITE_URL
COPY . .
RUN pnpm prisma generate
RUN DATABASE_URL="$DATABASE_URL" \
 AUTH_SECRET="$AUTH_SECRET" \
 NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
 NEXTAUTH_URL="$NEXTAUTH_URL" \
 NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_SITE_URL" \
 pnpm build

FROM base AS runner
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/middleware.ts ./middleware.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/next-env.d.ts ./next-env.d.ts
RUN pnpm prisma generate
EXPOSE 3000
CMD ["pnpm", "start"]
