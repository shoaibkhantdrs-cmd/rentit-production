exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE user_subscriptions (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id        UUID NOT NULL REFERENCES premium_plans(id) ON DELETE RESTRICT,
      status         TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
      starts_at      TIMESTAMPTZ,
      ends_at        TIMESTAMPTZ,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql("CREATE INDEX user_subscriptions_user_id_idx ON user_subscriptions (user_id);");
  // "does this user currently have an active premium plan" is checked on
  // most listing-creation requests (to decide featured-slot allowances
  // etc.) -- a partial index keeps that check cheap.
  pgm.sql(
    "CREATE INDEX user_subscriptions_active_idx ON user_subscriptions (user_id, status, ends_at) WHERE status = 'active';",
  );
};

exports.down = async (pgm) => {
  pgm.sql("DROP TABLE IF EXISTS user_subscriptions CASCADE;");
};
