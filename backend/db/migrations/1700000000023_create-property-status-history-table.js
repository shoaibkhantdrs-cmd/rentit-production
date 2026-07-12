exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE property_status_history (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      property_id       UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      previous_status   TEXT NULL,
      new_status        TEXT NOT NULL,
      changed_by        UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      reason            TEXT NULL,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Immutable audit trail of status transitions -- no updated_at/deleted_at,
  // written once per transition by the application layer, never edited.
  pgm.sql('CREATE INDEX property_status_history_property_id_idx ON property_status_history (property_id);');
  pgm.sql('CREATE INDEX property_status_history_created_at_idx ON property_status_history (created_at);');
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS property_status_history CASCADE;');
};
