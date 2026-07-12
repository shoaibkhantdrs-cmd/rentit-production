exports.shorthands = undefined;

/** Mirrors property_reports (migration 022) exactly, for reporting a user
 * (e.g. a bad-faith owner/renter) instead of a listing. */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE user_reports (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reported_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reporter_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason             TEXT NOT NULL
                           CHECK (reason IN ('spam', 'harassment', 'fraud', 'fake_profile', 'inappropriate_behavior', 'other')),
      details            TEXT NULL,
      status             TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'reviewed', 'dismissed', 'action_taken')),
      reviewed_by        UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at        TIMESTAMPTZ NULL,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (reported_user_id <> reporter_user_id),
      UNIQUE (reported_user_id, reporter_user_id)
    );
  `);

  pgm.sql('CREATE INDEX user_reports_reported_user_id_idx ON user_reports (reported_user_id);');
  pgm.sql('CREATE INDEX user_reports_status_idx ON user_reports (status);');

  pgm.sql(`
    CREATE TRIGGER user_reports_set_updated_at
    BEFORE UPDATE ON user_reports
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS user_reports CASCADE;');
};
