# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# ---- dev: hot-reloading Vite dev server, used by docker-compose ----
FROM base AS dev
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# ---- deps: production dependency install ----
FROM base AS deps
RUN npm ci --omit=dev

# ---- build: compile static assets ----
FROM base AS build
RUN npm install
COPY . .
RUN npm run build

# ---- prod: serve built assets with a minimal static server ----
FROM node:20-alpine AS prod
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
EXPOSE 5173
# Phase 6 Part 6 (CI/CD): non-root + healthcheck, same reasoning as the
# backend Dockerfile. Serving static files never needs write access to
# anything, so there's no permissions fixup required for the `node` user
# to run this correctly.
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:5173').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["serve", "-s", "dist", "-l", "5173"]
