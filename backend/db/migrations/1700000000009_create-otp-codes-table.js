exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE otp_codes (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose       TEXT NOT NULL
                      CHECK (purpose IN ('login', 'email_verification', 'phone_verification', 'password_reset')),
      channel       TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
      code_hash     TEXT NOT NULL,
      attempts      INTEGER NOT NULL DEFAULT 0,
      max_attempts  INTEGER NOT NULL DEFAULT 5,
      expires_at    TIMESTAMPTZ NOT NULL,
      consumed_at   TIMESTAMPTZ NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql(
    'CREATE INDEX otp_codes_user_purpose_idx ON otp_codes (user_id, purpose, consumed_at);',
  );
  pgm.sql('CREATE INDEX otp_codes_expires_at_idx ON otp_codes (expires_at);');

  pgm.sql(`
    CREATE TRIGGER otp_codes_set_updated_at
    BEFORE UPDATE ON otp_codes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS otp_codes CASCADE;');
};
