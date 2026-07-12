exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE property_favorites (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      property_id  UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (property_id, user_id)
    );
  `);

  // Favoriting/unfavoriting is a toggle -- removal is a row delete, not a
  // soft delete (same pattern as user_roles / property_features).
  pgm.sql('CREATE INDEX property_favorites_user_id_idx ON property_favorites (user_id);');
  pgm.sql('CREATE INDEX property_favorites_property_id_idx ON property_favorites (property_id);');
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS property_favorites CASCADE;');
};
