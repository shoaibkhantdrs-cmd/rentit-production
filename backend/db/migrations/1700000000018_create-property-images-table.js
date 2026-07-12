exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE property_images (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      property_id           UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      cloudinary_public_id  TEXT NOT NULL,
      url                   TEXT NOT NULL,
      width                 INTEGER NULL,
      height                INTEGER NULL,
      format                TEXT NULL,
      bytes                 INTEGER NULL,
      is_primary            BOOLEAN NOT NULL DEFAULT false,
      sort_order            SMALLINT NOT NULL DEFAULT 0,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at            TIMESTAMPTZ NULL
    );
  `);

  pgm.sql('CREATE INDEX property_images_property_id_idx ON property_images (property_id);');
  pgm.sql(
    'CREATE UNIQUE INDEX property_images_one_primary_per_property ON property_images (property_id) WHERE is_primary = true AND deleted_at IS NULL;',
  );

  pgm.sql(`
    CREATE TRIGGER property_images_set_updated_at
    BEFORE UPDATE ON property_images
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  // Defense-in-depth: the "max 10 images" rule is enforced in the
  // application layer (where it can return a clean 400 with a helpful
  // message), but a DB-level trigger backstops it in case that code path
  // is ever bypassed (a script, a future service, a bug).
  pgm.sql(`
    CREATE OR REPLACE FUNCTION enforce_property_image_limit()
    RETURNS TRIGGER AS $$
    DECLARE
      image_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO image_count
      FROM property_images
      WHERE property_id = NEW.property_id AND deleted_at IS NULL;

      IF image_count >= 10 THEN
        RAISE EXCEPTION 'Property % already has the maximum of 10 images', NEW.property_id
          USING ERRCODE = 'check_violation';
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  pgm.sql(`
    CREATE TRIGGER property_images_enforce_limit
    BEFORE INSERT ON property_images
    FOR EACH ROW EXECUTE FUNCTION enforce_property_image_limit();
  `);
};

exports.down = async (pgm) => {
  pgm.sql('DROP TRIGGER IF EXISTS property_images_enforce_limit ON property_images;');
  pgm.sql('DROP FUNCTION IF EXISTS enforce_property_image_limit();');
  pgm.sql('DROP TABLE IF EXISTS property_images CASCADE;');
};
