exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE property_locations (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      property_id        UUID NOT NULL UNIQUE REFERENCES properties(id) ON DELETE CASCADE,
      address_line       TEXT NOT NULL,
      city               TEXT NOT NULL,
      locality           TEXT NULL,
      state              TEXT NULL,
      country            TEXT NULL,
      postal_code        TEXT NULL,
      latitude           NUMERIC(9, 6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
      longitude          NUMERIC(9, 6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
      formatted_address  TEXT NULL,
      place_id           TEXT NULL,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // No deleted_at: 1:1 with its property, cascades on hard delete, and has
  // no independent lifecycle -- same reasoning as user_preferences (see
  // backend/db/README.md).
  pgm.sql('CREATE INDEX property_locations_city_idx ON property_locations (city);');
  pgm.sql('CREATE INDEX property_locations_locality_idx ON property_locations (locality);');
  // Supports the bounding-box pre-filter used by radius search (see
  // PropertyRepository.search / docs/phase-3.md).
  pgm.sql('CREATE INDEX property_locations_lat_lng_idx ON property_locations (latitude, longitude);');

  pgm.sql(`
    CREATE TRIGGER property_locations_set_updated_at
    BEFORE UPDATE ON property_locations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS property_locations CASCADE;');
};
