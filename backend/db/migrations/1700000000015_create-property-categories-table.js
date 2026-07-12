exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE property_categories (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL,
      slug        TEXT NOT NULL,
      description TEXT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at  TIMESTAMPTZ NULL
    );
  `);

  pgm.sql(
    'CREATE UNIQUE INDEX property_categories_name_unique_active ON property_categories (name) WHERE deleted_at IS NULL;',
  );
  pgm.sql(
    'CREATE UNIQUE INDEX property_categories_slug_unique_active ON property_categories (slug) WHERE deleted_at IS NULL;',
  );

  pgm.sql(`
    CREATE TRIGGER property_categories_set_updated_at
    BEFORE UPDATE ON property_categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS property_categories CASCADE;');
};
