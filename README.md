# RentIt

Property rental platform. Monorepo: `frontend` (React + Vite + TS), `backend`
(Node + Express + TS), Postgres via Docker.

Phase 2 status: database schema, authentication (JWT + OTP + password),
user management, and RBAC are implemented. Property listings and the admin
panel are not built yet. Full Phase 2 documentation (ER diagram, API
reference, migration list, test coverage) is in `docs/phase-2.md`.

## Run with Docker (recommended)

```bash
cp .env.example .env
docker compose up --build
docker compose exec backend npm run migrate:up
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
npm run migrate:up --prefix backend
npm run dev
```

This starts both dev servers concurrently (frontend on 5173, backend on 4000).
Update `backend/.env`'s `DATABASE_URL` to point at your Postgres instance, and
set a real `JWT_ACCESS_SECRET` before running anywhere near production
(`node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`).

## Testing

```bash
cd backend
npm install
npm test
```

56 tests covering the full auth/user/notification business logic via
in-memory fakes -- see `docs/phase-2.md` §7 for exactly what is and isn't
executable inside this build environment.

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

See `backend/db/README.md` for database/migration conventions and
`docs/phase-2.md` for the full Phase 2 reference.

 DATABASE_URL="postgresql://neondb_owner:npg_iRrEIXlhaK56@ep-lingering-mode-awx3vmz5.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require"
