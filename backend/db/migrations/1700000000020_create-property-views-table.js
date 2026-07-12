exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE property_views (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      viewer_user_id  UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      ip_address      INET NULL,
      user_agent      TEXT NULL,
      viewed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Immutable event log (same rationale as audit_logs/activity_logs in
  // Phase 2): no updated_at, no deleted_at.
  pgm.sql('CREATE INDEX property_views_property_id_idx ON property_views (property_id);');
  pgm.sql('CREATE INDEX property_views_viewed_at_idx ON property_views (viewed_at);');
  pgm.sql(
    'CREATE INDEX property_views_dedup_idx ON property_views (property_id, viewer_user_id, viewed_at);',
  );
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS property_views CASCADE;');
};
