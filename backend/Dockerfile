# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# ---- dev: tsx watch mode, used by docker-compose ----
FROM base AS dev
RUN npm install
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]

# ---- deps: production dependency install ----
FROM base AS deps
RUN npm ci --omit=dev

# ---- build: compile TypeScript ----
FROM base AS build
RUN npm install
COPY . .
RUN npm run build

# ---- prod: minimal runtime image ----
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./
EXPOSE 4000
# Phase 6 Part 6 (CI/CD): run as the non-root `node` user the base image
# already ships (not root, the Dockerfile default) -- a compromised
# process gets far less to work with. Also gives the orchestrator (Docker
# Swarm/Kubernetes/plain `docker run --health-cmd`) a way to know the
# container is actually serving traffic, not just that the process is
# alive -- hits the liveness endpoint added in Part 4, no external tool
# needed since Node itself can make the request.
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/health/live').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/server.js"]
