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
CMD ["serve", "-s", "dist", "-l", "5173"]
