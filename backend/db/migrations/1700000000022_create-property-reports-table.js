exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE property_reports (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      property_id        UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      reporter_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason             TEXT NOT NULL
                           CHECK (reason IN ('spam', 'fraud', 'incorrect_information', 'duplicate_listing', 'offensive_content', 'already_rented', 'other')),
      details            TEXT NULL,
      status             TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'reviewed', 'dismissed', 'action_taken')),
      reviewed_by        UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at        TIMESTAMPTZ NULL,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (property_id, reporter_user_id)
    );
  `);

  // Moderation record, not user-owned content -- no soft delete; the admin
  // panel (Phase 4) manages its lifecycle via the status column instead.
  pgm.sql('CREATE INDEX property_reports_property_id_idx ON property_reports (property_id);');
  pgm.sql('CREATE INDEX property_reports_status_idx ON property_reports (status);');

  pgm.sql(`
    CREATE TRIGGER property_reports_set_updated_at
    BEFORE UPDATE ON property_reports
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS property_reports CASCADE;');
};
