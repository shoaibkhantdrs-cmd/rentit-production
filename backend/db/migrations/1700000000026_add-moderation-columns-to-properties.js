exports.shorthands = undefined;

/**
 * Phase 4 (Admin / Moderation) additions to the existing `properties`
 * table from Phase 3. All additive -- no existing column is touched, and
 * the public property API/response shape from Phase 3 is unaffected
 * unless the new fields are explicitly requested by the admin endpoints.
 */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE properties
      ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN moderated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN moderated_at TIMESTAMPTZ NULL,
      ADD COLUMN rejection_reason TEXT NULL;
  `);

  // The Phase 3 status CHECK constraint didn't include "rejected" --
  // Property Moderation (Part 3) needs it. Postgres auto-names a single
  // inline column CHECK as "<table>_<column>_check"; dropped with IF
  // EXISTS so this migration is safe to re-run against a database where
  // the constraint was already renamed by hand.
  pgm.sql('ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_status_check;');
  pgm.sql(`
    ALTER TABLE properties
      ADD CONSTRAINT properties_status_check
      CHECK (status IN ('draft', 'pending_review', 'published', 'rented', 'inactive', 'removed', 'rejected'));
  `);

  // General-purpose status index for admin moderation queries across any
  // status (the Phase 3 "properties_published_active_idx" is a partial
  // index scoped to published listings only, for the public search path).
  pgm.sql('CREATE INDEX properties_status_idx ON properties (status);');
  pgm.sql('CREATE INDEX properties_featured_idx ON properties (is_featured) WHERE is_featured = true;');
  pgm.sql('CREATE INDEX properties_moderated_by_idx ON properties (moderated_by);');
};

exports.down = async (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS properties_moderated_by_idx;');
  pgm.sql('DROP INDEX IF EXISTS properties_featured_idx;');
  pgm.sql('DROP INDEX IF EXISTS properties_status_idx;');
  pgm.sql('ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_status_check;');
  pgm.sql(`
    ALTER TABLE properties
      ADD CONSTRAINT properties_status_check
      CHECK (status IN ('draft', 'pending_review', 'published', 'rented', 'inactive', 'removed'));
  `);
  pgm.sql(`
    ALTER TABLE properties
      DROP COLUMN IF EXISTS rejection_reason,
      DROP COLUMN IF EXISTS moderated_at,
      DROP COLUMN IF EXISTS moderated_by,
      DROP COLUMN IF EXISTS is_featured;
  `);
};
