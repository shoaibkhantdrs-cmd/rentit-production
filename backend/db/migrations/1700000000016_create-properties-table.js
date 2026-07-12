exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE properties (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id       UUID NOT NULL REFERENCES property_categories(id) ON DELETE RESTRICT,
      title             TEXT NOT NULL,
      description       TEXT NOT NULL,
      property_type     TEXT NOT NULL
                          CHECK (property_type IN ('apartment', 'house', 'villa', 'studio', 'pg', 'room', 'commercial', 'other')),
      status            TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'pending_review', 'published', 'rented', 'inactive', 'removed')),
      rent_amount       NUMERIC(12, 2) NOT NULL CHECK (rent_amount >= 0),
      security_deposit  NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (security_deposit >= 0),
      area_sqft         NUMERIC(10, 2) NOT NULL CHECK (area_sqft > 0),
      bedrooms          SMALLINT NOT NULL DEFAULT 0 CHECK (bedrooms >= 0),
      bathrooms         SMALLINT NOT NULL DEFAULT 0 CHECK (bathrooms >= 0),
      parking_spaces    SMALLINT NOT NULL DEFAULT 0 CHECK (parking_spaces >= 0),
      floor_number      SMALLINT NULL,
      total_floors      SMALLINT NULL,
      facing            TEXT NULL
                          CHECK (facing IS NULL OR facing IN ('north', 'south', 'east', 'west', 'north_east', 'north_west', 'south_east', 'south_west')),
      furnished_status  TEXT NOT NULL DEFAULT 'unfurnished'
                          CHECK (furnished_status IN ('unfurnished', 'semi_furnished', 'fully_furnished')),
      available_from    DATE NOT NULL,
      view_count        INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
      favorite_count    INTEGER NOT NULL DEFAULT 0 CHECK (favorite_count >= 0),
      published_at      TIMESTAMPTZ NULL,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at        TIMESTAMPTZ NULL,
      CHECK (total_floors IS NULL OR floor_number IS NULL OR floor_number <= total_floors)
    );
  `);

  pgm.sql('CREATE INDEX properties_owner_id_idx ON properties (owner_id);');
  pgm.sql('CREATE INDEX properties_category_id_idx ON properties (category_id);');
  pgm.sql('CREATE INDEX properties_property_type_idx ON properties (property_type);');
  pgm.sql('CREATE INDEX properties_rent_amount_idx ON properties (rent_amount);');
  pgm.sql('CREATE INDEX properties_bedrooms_idx ON properties (bedrooms);');
  pgm.sql('CREATE INDEX properties_bathrooms_idx ON properties (bathrooms);');
  pgm.sql('CREATE INDEX properties_available_from_idx ON properties (available_from);');
  pgm.sql('CREATE INDEX properties_created_at_idx ON properties (created_at);');
  pgm.sql('CREATE INDEX properties_view_count_idx ON properties (view_count);');
  // The set of "browsable" listings is filtered on this combination on
  // almost every search request -- a dedicated partial index keeps that
  // hot path fast as the table grows.
  pgm.sql(
    "CREATE INDEX properties_published_active_idx ON properties (status, deleted_at) WHERE status = 'published' AND deleted_at IS NULL;",
  );

  pgm.sql(`
    CREATE TRIGGER properties_set_updated_at
    BEFORE UPDATE ON properties
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS properties CASCADE;');
};
