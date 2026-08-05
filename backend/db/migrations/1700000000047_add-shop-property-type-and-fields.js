exports.shorthands = undefined;

/**
 * Phase 1: adds "shop" as a legal `property_type` value. Widens the CHECK
 * constraint only -- no new columns. Shop-specific fields (carpet area,
 * frontage, etc.) and the PIN-first/map UX are deferred to a later phase.
 * Same drop-and-recreate approach already used in 1700000000026 for the
 * `status` CHECK.
 */
exports.up = async (pgm) => {
  pgm.sql('ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_property_type_check;');
  pgm.sql(`
    ALTER TABLE properties
      ADD CONSTRAINT properties_property_type_check
      CHECK (property_type IN ('apartment', 'house', 'villa', 'studio', 'pg', 'room', 'commercial', 'shop', 'other'));
  `);
};

exports.down = async (pgm) => {
  pgm.sql('ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_property_type_check;');
  pgm.sql(`
    ALTER TABLE properties
      ADD CONSTRAINT properties_property_type_check
      CHECK (property_type IN ('apartment', 'house', 'villa', 'studio', 'pg', 'room', 'commercial', 'other'));
  `);
};
