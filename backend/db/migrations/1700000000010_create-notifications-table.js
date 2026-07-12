exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE notifications (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type        TEXT NOT NULL,
      title       TEXT NOT NULL,
      body        TEXT NOT NULL,
      data        JSONB NOT NULL DEFAULT '{}'::jsonb,
      read_at     TIMESTAMPTZ NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at  TIMESTAMPTZ NULL
    );
  `);

  pgm.sql(
    'CREATE INDEX notifications_user_unread_idx ON notifications (user_id, read_at) WHERE deleted_at IS NULL;',
  );
  pgm.sql('CREATE INDEX notifications_created_at_idx ON notifications (created_at);');

  pgm.sql(`
    CREATE TRIGGER notifications_set_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS notifications CASCADE;');
};
