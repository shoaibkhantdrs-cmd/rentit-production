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
CMD ["node", "dist/server.js"]
