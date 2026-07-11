# Database

- `init/` — SQL run once by Postgres on first container start (extensions, roles). Not for schema/tables.
- `migrations/` — versioned schema migrations, added in Phase 2 once a migration tool is wired in (e.g. node-pg-migrate).

No tables exist yet — schema design is part of Phase 2.
