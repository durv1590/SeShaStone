# syntax=docker/dockerfile:1
# Production images for SeSha Stone. Built by deploy/docker-compose.yml:
#   target "api"   – NestJS API (runs database migrations on start)
#   target "web"   – Next.js storefront
#   target "admin" – Next.js admin panel
ARG NODE_IMAGE=node:22-alpine

# ── All workspace dependencies (for building the Next.js apps) ──────
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/admin/package.json apps/admin/
COPY apps/api/prisma apps/api/prisma
RUN npm ci --no-audit --no-fund

# ── API ─────────────────────────────────────────────────────────────
# Only the API workspace's dependencies, including the Prisma CLI (migrations) and ts-node (seed).
FROM ${NODE_IMAGE} AS api-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma
RUN npm ci --no-audit --no-fund -w @seshastone/api

FROM api-deps AS api-build
COPY apps/api apps/api
RUN npm run build -w @seshastone/api

FROM ${NODE_IMAGE} AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=api-build /app/node_modules node_modules
COPY --from=api-build /app/package.json ./
COPY --from=api-build /app/apps/api apps/api
# The original UPI QR, imported by the first seed after it is verified.
COPY --chown=node:node public/payment/upi-qr/current-upi-qr.png public/payment/upi-qr/current-upi-qr.png
RUN mkdir -p /data/media && chown -R node:node /data
USER node
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main"]

# ── Storefront ──────────────────────────────────────────────────────
FROM deps AS web-build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
COPY apps/web apps/web
RUN npm run build -w @seshastone/web

FROM ${NODE_IMAGE} AS web
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=web-build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=web-build --chown=node:node /app/apps/web/.next/static apps/web/.next/static
COPY --from=web-build --chown=node:node /app/apps/web/public apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# ── Admin panel ─────────────────────────────────────────────────────
FROM deps AS admin-build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_STORE_URL
COPY apps/admin apps/admin
RUN npm run build -w @seshastone/admin

FROM ${NODE_IMAGE} AS admin
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3001
COPY --from=admin-build --chown=node:node /app/apps/admin/.next/standalone ./
COPY --from=admin-build --chown=node:node /app/apps/admin/.next/static apps/admin/.next/static
USER node
EXPOSE 3001
CMD ["node", "apps/admin/server.js"]
