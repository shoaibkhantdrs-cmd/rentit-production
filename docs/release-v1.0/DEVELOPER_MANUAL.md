# RentIt Developer Manual (v1.0)

## Getting started locally

```bash
git clone <repo> && cd rentit-production
cp .env.example backend/.env   # and fill in what you have (everything has a working dev default or fallback)
cp .env.example .env           # root .env, consumed by docker-compose.yml
docker compose up --build      # postgres + backend (hot reload) + frontend (hot reload)
```

Or without Docker: `npm run install:all` (root `package.json`) then `npm run dev` (runs backend + frontend concurrently). Either way, migrations need to be applied once: `cd backend && npm run migrate:up`.

**Known gap**: no `package-lock.json` is committed in either `backend/` or `frontend/` — every phase of this project's build ran in a sandbox with no npm registry access. Run a real `npm install` in both directories and commit the resulting lockfiles as your first real contribution; `.github/workflows/ci.yml` documents exactly where to flip `npm install` back to `npm ci` once that's done.

## Project layout

See `ARCHITECTURE.md` for the full picture. The one rule that matters most day-to-day: **`container.ts` is the only file allowed to import a concrete infrastructure class.** If you're writing a use-case and find yourself importing `pg` or `express` directly, you're in the wrong layer — depend on the `domain/` interface instead and let `container.ts` wire in the real implementation.

## Adding a new feature (the established pattern)

1. **Domain**: add/extend an entity in `domain/entities/`, and a repository interface in `domain/repositories/` if it needs persistence.
2. **Migration**: `cd backend && npm run migrate:create -- descriptive-name`, write the `up`/`down`.
3. **Infrastructure**: implement the repository against Postgres in `infrastructure/database/repositories/`.
4. **Application**: write the use-case in `application/<area>/YourAction.usecase.ts` — constructor-injected with only the interfaces it needs.
5. **Interfaces**: a Zod schema in `interfaces/http/validators/`, a controller method, a route.
6. **Container**: wire the new repository/use-case/controller into `container.ts`, add it to the returned object, thread it through `app.ts` → `routes/index.ts` if it's a new top-level resource.
7. **Tests**: an in-memory fake repository in `tests/support/fakes/` (mirroring the real interface), then a test in `tests/integration/` using `buildTestContainer()` (or a feature-specific builder, see `tests/support/build*TestContainer.ts`).

## Running tests

```bash
cd backend
npm test              # everything: tests/**/*.test.ts (unit + integration + e2e)
npm run test:unit
npm run test:integration
```

All 184 tests run against in-memory fakes — no real Postgres connection needed for the test suite itself (only for `npm run migrate:up`, which is a separate, real-database step). If `tsx`/`typescript` aren't on your `PATH` yet, `npm test` (via package.json's own `node --import tsx` invocation) handles that automatically once `node_modules` is installed.

## Code style and conventions

- **Hand-rolled infrastructure over SDKs** where a Node built-in or one HTTP endpoint suffices (see `ARCHITECTURE.md`) — don't reach for a new npm dependency without checking whether this pattern already covers it.
- **`import type` for type-only imports** where the codebase's newer files use it (Phase 6 payment/observability files) — not universally applied to pre-existing files, and that's fine; it doesn't affect real `tsc` behavior, only matters for certain restricted execution modes.
- **Every secret comparison uses `timingSafeEqual`**, not `===`/`!==` — see `JwtTokenService.ts`, the payment gateways' webhook verification, and `metrics.routes.ts` for the pattern (a plain string comparison here was a real bug found and fixed in Part 9).
- **Rate limiters are keyed appropriately**: by IP for unauthenticated/webhook endpoints, by user ID for authenticated ones that could be abused to run up cost (payment order creation) or spam (messaging).

## Frontend conventions

Page components use **named exports**, not default exports — `lazyNamed()` (`src/utils/lazyNamed.ts`) exists specifically to code-split them anyway despite `React.lazy` requiring a default export. `httpClient` (`src/api/httpClient.ts`) is the only place that should ever call `fetch` directly for backend calls — it handles auth token attachment, refresh-on-401, and a small GET cache.

## CI/CD

Every push runs lint + typecheck + the real test suite + a real migration dry-run against a throwaway Postgres (`.github/workflows/ci.yml`). Merges to `main` additionally build and push versioned Docker images to GHCR. See `backend/docs/phase-6-part6-cicd.md`.
