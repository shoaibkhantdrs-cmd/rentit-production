exports.shorthands = undefined;

/**
 * Adds a `district` column to `property_locations`, needed by the new
 * PIN-code-first location workflow: entering a PIN code auto-fills State,
 * District, City, and Area via reverse/postal-code geocoding. Nullable and
 * additive -- every existing location row keeps working with district simply
 * unset, and nothing reads/writes this column until the new geocoding flow
 * populates it.
 */
exports.up = async (pgm) => {
  pgm.sql('ALTER TABLE property_locations ADD COLUMN district TEXT NULL;');
};

exports.down = async (pgm) => {
  pgm.sql('ALTER TABLE property_locations DROP COLUMN IF EXISTS district;');
};
