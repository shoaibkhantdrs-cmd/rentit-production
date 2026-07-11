# RentIt

Property rental platform. Monorepo: `frontend` (React + Vite + TS), `backend`
(Node + Express + TS), Postgres via Docker.

Phase 1 status: architecture, tooling, and dev environment only. No product
features are implemented yet.

## Run with Docker (recommended)

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend health check: http://localhost:4000/health
- Postgres: localhost:5432 (credentials in `.env`)

## Run without Docker

Requires Node 20+ and a local/remote Postgres instance.

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
npm run install:all
npm run dev
```

This starts both dev servers concurrently (frontend on 5173, backend on 4000).
Update `backend/.env`'s `DATABASE_URL` to point at your Postgres instance.

## Scripts (root)

| Command | Description |
|---|---|
| `npm run install:all` | Install frontend + backend dependencies |
| `npm run dev` | Run frontend + backend dev servers together |
| `npm run lint` | Lint both packages |
| `npm run format` | Format both packages with Prettier |
| `npm run docker:up` | `docker compose up --build` |
| `npm run docker:down` | Stop and remove containers |

## Structure

```
rentit/
├── frontend/   React + Vite + TypeScript
├── backend/    Node + Express + TypeScript, Postgres client
└── docker-compose.yml
```

See `backend/db/README.md` for database/migration conventions.
