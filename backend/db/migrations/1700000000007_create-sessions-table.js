exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE sessions (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_id        UUID NOT NULL REFERENCES user_devices(id) ON DELETE CASCADE,
      ip_address       INET NULL,
      user_agent       TEXT NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_active_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at       TIMESTAMPTZ NOT NULL,
      revoked_at       TIMESTAMPTZ NULL,
      revoked_reason   TEXT NULL
    );
  `);

  pgm.sql('CREATE INDEX sessions_user_id_idx ON sessions (user_id);');
  pgm.sql('CREATE INDEX sessions_device_id_idx ON sessions (device_id);');
  pgm.sql(
    'CREATE INDEX sessions_user_active_idx ON sessions (user_id, revoked_at, expires_at);',
  );

  pgm.sql(`
    CREATE TRIGGER sessions_set_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS sessions CASCADE;');
};
