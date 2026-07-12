exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE user_preferences (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id        UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      language       TEXT NOT NULL DEFAULT 'en',
      timezone       TEXT NOT NULL DEFAULT 'UTC',
      notify_email   BOOLEAN NOT NULL DEFAULT true,
      notify_sms     BOOLEAN NOT NULL DEFAULT false,
      notify_push    BOOLEAN NOT NULL DEFAULT true,
      extra          JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // No deleted_at: this is a 1:1 config row cascading with its user, not an
  // independently soft-deletable entity (see backend/db/README.md).

  pgm.sql(`
    CREATE TRIGGER user_preferences_set_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS user_preferences CASCADE;');
};
