exports.shorthands = undefined;

// Performance audit finding: property search (city/locality), admin
// property search (same columns), and admin user search (name/email/phone)
// all filter with a leading-wildcard ILIKE '%term%'. A plain btree index
// (already present on property_locations.city/locality) can't serve a
// leading-wildcard pattern -- Postgres has to sequential-scan the table for
// every one of those searches. pg_trgm's GIN trigram indexes are exactly
// the tool for this: they can serve ILIKE '%term%' without a table scan,
// with no change to the query text itself (buildPropertySearchQuery.ts,
// buildAdminPropertySearchQuery.ts, and UserRepository.search's ILIKE
// clauses all work unmodified once these indexes exist -- the planner picks
// them up automatically). Purely additive: no table/column changes, no API
// change, existing btree indexes are untouched.
exports.up = async (pgm) => {
  pgm.sql("CREATE EXTENSION IF NOT EXISTS pg_trgm;");

  pgm.sql(
    "CREATE INDEX property_locations_city_trgm_idx ON property_locations USING GIN (city gin_trgm_ops);",
  );
  pgm.sql(
    "CREATE INDEX property_locations_locality_trgm_idx ON property_locations USING GIN (locality gin_trgm_ops);",
  );
  pgm.sql("CREATE INDEX users_name_trgm_idx ON users USING GIN (name gin_trgm_ops);");
  pgm.sql("CREATE INDEX users_email_trgm_idx ON users USING GIN (email gin_trgm_ops);");
  // phone is nullable; a GIN trgm index over NULLs is fine (NULLs are
  // simply never matched by ILIKE), no partial-index special-casing needed.
  pgm.sql("CREATE INDEX users_phone_trgm_idx ON users USING GIN (phone gin_trgm_ops);");
};

exports.down = async (pgm) => {
  pgm.sql("DROP INDEX IF EXISTS property_locations_city_trgm_idx;");
  pgm.sql("DROP INDEX IF EXISTS property_locations_locality_trgm_idx;");
  pgm.sql("DROP INDEX IF EXISTS users_name_trgm_idx;");
  pgm.sql("DROP INDEX IF EXISTS users_email_trgm_idx;");
  pgm.sql("DROP INDEX IF EXISTS users_phone_trgm_idx;");
  // Not dropping the pg_trgm extension itself here: extensions are a
  // database-wide, shared resource -- another migration or a manual index
  // could reasonably depend on it later, and DROP EXTENSION would cascade-
  // fail loudly if anything else still uses it. Leaving it installed on
  // rollback is the safe default (mirrors how this project never drops
  // pgcrypto/uuid-ossp-style extensions in any other migration's down()).
};
