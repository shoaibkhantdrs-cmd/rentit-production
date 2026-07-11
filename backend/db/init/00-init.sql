-- Runs once, automatically, the first time the postgres container's data
-- volume is created (docker-entrypoint-initdb.d convention).
-- Safe to extend with extensions/roles needed before migrations run.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
