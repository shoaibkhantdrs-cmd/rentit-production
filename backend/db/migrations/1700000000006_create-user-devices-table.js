exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE user_devices (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_id      TEXT NOT NULL,
      platform       TEXT NOT NULL DEFAULT 'unknown'
                       CHECK (platform IN ('web', 'ios', 'android', 'unknown')),
      user_agent     TEXT NULL,
      is_trusted     BOOLEAN NOT NULL DEFAULT false,
      first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at     TIMESTAMPTZ NULL
    );
  `);

  pgm.sql(
    'CREATE UNIQUE INDEX user_devices_user_device_unique_active ON user_devices (user_id, device_id) WHERE deleted_at IS NULL;',
  );
  pgm.sql('CREATE INDEX user_devices_user_id_idx ON user_devices (user_id);');

  pgm.sql(`
    CREATE TRIGGER user_devices_set_updated_at
    BEFORE UPDATE ON user_devices
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS user_devices CASCADE;');
};
