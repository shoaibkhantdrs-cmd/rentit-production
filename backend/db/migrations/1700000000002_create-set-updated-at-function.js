/**
 * Generic trigger function attached (per-table) to any table that has an
 * updated_at column. Kept as a single shared function instead of
 * per-table logic (DRY, one place to fix if the convention ever changes).
 */
exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
};

exports.down = async (pgm) => {
  pgm.sql('DROP FUNCTION IF EXISTS set_updated_at();');
};
