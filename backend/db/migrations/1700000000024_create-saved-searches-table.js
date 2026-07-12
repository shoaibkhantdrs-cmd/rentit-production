exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE saved_searches (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name               TEXT NOT NULL,
      filters            JSONB NOT NULL DEFAULT '{}'::jsonb,
      notify_on_match    BOOLEAN NOT NULL DEFAULT false,
      last_notified_at   TIMESTAMPTZ NULL,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at         TIMESTAMPTZ NULL
    );
  `);

  pgm.sql('CREATE INDEX saved_searches_user_id_idx ON saved_searches (user_id);');

  pgm.sql(`
    CREATE TRIGGER saved_searches_set_updated_at
    BEFORE UPDATE ON saved_searches
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS saved_searches CASCADE;');
};
