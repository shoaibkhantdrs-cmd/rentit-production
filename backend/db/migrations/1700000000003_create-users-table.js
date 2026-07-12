exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE users (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name               TEXT NOT NULL,
      email              CITEXT NOT NULL,
      phone              TEXT NULL,
      password_hash      TEXT NULL,
      status             TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'suspended', 'banned')),
      email_verified_at  TIMESTAMPTZ NULL,
      phone_verified_at  TIMESTAMPTZ NULL,
      last_login_at      TIMESTAMPTZ NULL,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at         TIMESTAMPTZ NULL
    );
  `);

  // Partial unique indexes: uniqueness only enforced among non-soft-deleted
  // rows, so a deleted account's email/phone can be reused on re-signup.
  pgm.sql(
    'CREATE UNIQUE INDEX users_email_unique_active ON users (email) WHERE deleted_at IS NULL;',
  );
  pgm.sql(
    'CREATE UNIQUE INDEX users_phone_unique_active ON users (phone) WHERE deleted_at IS NULL AND phone IS NOT NULL;',
  );
  pgm.sql('CREATE INDEX users_status_idx ON users (status);');
  pgm.sql('CREATE INDEX users_deleted_at_idx ON users (deleted_at);');

  pgm.sql(`
    CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS users CASCADE;');
};
