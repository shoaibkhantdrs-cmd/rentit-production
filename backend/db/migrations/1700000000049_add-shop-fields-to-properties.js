exports.shorthands = undefined;

/**
 * Phase 2 Part 2 (Shop Listing UI): adds the shop-specific measurement/
 * amenity columns deferred by migration 1700000000047 ("Shop-specific
 * fields (carpet area, frontage, etc.)... are deferred to a later phase").
 *
 * Two of the fields called for in the Shop Listing spec -- "Shop Carpet
 * Area" and "Floor" -- deliberately do NOT get new columns here: they
 * reuse the existing `area_sqft` (already NOT NULL) and `floor_number`
 * columns that every property type already has, just relabelled in the UI
 * for shop listings. Every column added below is nullable and additive --
 * existing (non-shop) rows are completely unaffected, and the columns are
 * simply left NULL for every property type other than "shop".
 */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE properties
      ADD COLUMN front_width_ft NUMERIC(8, 2) NULL,
      ADD COLUMN shop_depth_ft NUMERIC(8, 2) NULL,
      ADD COLUMN road_width_ft NUMERIC(8, 2) NULL,
      ADD COLUMN power_load TEXT NULL,
      ADD COLUMN is_corner_shop BOOLEAN NULL,
      ADD COLUMN has_washroom BOOLEAN NULL,
      ADD COLUMN ready_to_move BOOLEAN NULL,
      ADD COLUMN suitable_for TEXT[] NULL;
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE properties
      DROP COLUMN IF EXISTS front_width_ft,
      DROP COLUMN IF EXISTS shop_depth_ft,
      DROP COLUMN IF EXISTS road_width_ft,
      DROP COLUMN IF EXISTS power_load,
      DROP COLUMN IF EXISTS is_corner_shop,
      DROP COLUMN IF EXISTS has_washroom,
      DROP COLUMN IF EXISTS ready_to_move,
      DROP COLUMN IF EXISTS suitable_for;
  `);
};
