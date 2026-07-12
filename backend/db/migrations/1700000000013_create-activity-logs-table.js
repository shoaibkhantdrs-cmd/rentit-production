exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE activity_logs (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      action      TEXT NOT NULL,
      metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
      ip_address  INET NULL,
      user_agent  TEXT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Same immutability rationale as audit_logs. The distinction between the
  // two tables is *purpose*, not schema: audit_logs is for security /
  // compliance-relevant events (login, password reset, role change);
  // activity_logs is general product usage telemetry (profile viewed,
  // notifications listed). Keeping them separate lets each grow its own
  // retention policy later without one polluting the other.
  pgm.sql('CREATE INDEX activity_logs_user_id_idx ON activity_logs (user_id);');
  pgm.sql('CREATE INDEX activity_logs_action_idx ON activity_logs (action);');
  pgm.sql('CREATE INDEX activity_logs_created_at_idx ON activity_logs (created_at);');
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS activity_logs CASCADE;');
};
