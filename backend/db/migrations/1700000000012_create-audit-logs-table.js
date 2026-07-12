exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE audit_logs (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      action       TEXT NOT NULL,
      entity_type  TEXT NULL,
      entity_id    UUID NULL,
      ip_address   INET NULL,
      user_agent   TEXT NULL,
      metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Deliberately immutable: no updated_at, no deleted_at. An audit trail
  // that can be edited or soft-deleted is not an audit trail. See
  // backend/db/README.md for the full rationale.
  pgm.sql('CREATE INDEX audit_logs_user_id_idx ON audit_logs (user_id);');
  pgm.sql('CREATE INDEX audit_logs_action_idx ON audit_logs (action);');
  pgm.sql('CREATE INDEX audit_logs_created_at_idx ON audit_logs (created_at);');
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS audit_logs CASCADE;');
};
