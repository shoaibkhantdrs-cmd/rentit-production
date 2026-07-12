exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE property_features (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      property_id  UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      feature_key  TEXT NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (property_id, feature_key)
    );
  `);

  // No updated_at/deleted_at: a feature tag either applies to a listing or
  // it doesn't -- toggling it is an insert/delete, not an edit, same as
  // user_roles in Phase 2. The allowed vocabulary (gym, lift, security,
  // ...) is validated at the API layer (zod enum), not a DB CHECK, so new
  // amenities can be added without a migration.
  pgm.sql('CREATE INDEX property_features_property_id_idx ON property_features (property_id);');
  pgm.sql('CREATE INDEX property_features_feature_key_idx ON property_features (feature_key);');
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS property_features CASCADE;');
};
