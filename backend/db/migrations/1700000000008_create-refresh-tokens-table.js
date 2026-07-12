exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE refresh_tokens (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      token_hash      TEXT NOT NULL,
      family_id       UUID NOT NULL,
      replaced_by     UUID NULL REFERENCES refresh_tokens(id) ON DELETE SET NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at      TIMESTAMPTZ NOT NULL,
      revoked_at      TIMESTAMPTZ NULL,
      revoked_reason  TEXT NULL
    );
  `);

  pgm.sql(
    'CREATE UNIQUE INDEX refresh_tokens_token_hash_unique ON refresh_tokens (token_hash);',
  );
  pgm.sql('CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens (user_id);');
  pgm.sql('CREATE INDEX refresh_tokens_session_id_idx ON refresh_tokens (session_id);');
  pgm.sql('CREATE INDEX refresh_tokens_family_id_idx ON refresh_tokens (family_id);');
  pgm.sql('CREATE INDEX refresh_tokens_expires_at_idx ON refresh_tokens (expires_at);');

  pgm.sql(`
    CREATE TRIGGER refresh_tokens_set_updated_at
    BEFORE UPDATE ON refresh_tokens
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS refresh_tokens CASCADE;');
};
