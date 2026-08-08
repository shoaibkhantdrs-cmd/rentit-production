exports.shorthands = undefined;

/**
 * One-time backfill: null out the 8 shop-only columns on every property
 * whose property_type is not "shop".
 *
 * Root cause: commit c2fe84b (UpdateProperty.usecase.ts) made every future
 * update correctly clear front_width_ft, shop_depth_ft, road_width_ft,
 * power_load, is_corner_shop, has_washroom, ready_to_move, and
 * suitable_for whenever a property's resulting propertyType leaves "shop".
 * That fix only runs when UpdatePropertyUseCase.execute() is called,
 * though -- it does nothing for rows that were already sitting in the
 * database with a non-shop property_type but populated shop columns
 * *before* c2fe84b was deployed (e.g. a shop that had been edited to
 * "apartment" back when the old code path just copied whatever the
 * caller sent for these fields and never cleared them). Those legacy
 * rows are exactly what the Phase 3 Part 1 shop search filters were
 * built to match on unconditionally (no propertyType guard, because a
 * non-shop row should structurally never have them populated) -- so a
 * plain residential listing with leftover suitable_for/isCornerShop/etc.
 * data can incorrectly resurface in a shop-filtered search
 * (e.g. propertyType=apartment&suitableFor=retail). Confirmed live in
 * production: property 1e9db1bb-b59e-4334-ad42-3e68ee9d8584 ("flat for
 * rent", propertyType=apartment) still had all 8 shop fields populated
 * from before c2fe84b shipped.
 *
 * This migration is the one-time cleanup pass for exactly that class of
 * pre-existing row. It does not touch schema (no ALTER TABLE, no new
 * tables/columns/indexes) and does not touch search logic -- it is a
 * pure UPDATE against data already covered by the existing nullable
 * columns added in migration 1700000000049.
 *
 * Idempotent: the WHERE clause requires property_type <> 'shop' AND at
 * least one of the 8 columns to be NOT NULL, so a second run matches zero
 * rows (every row it could have touched is already fully NULL) and is a
 * safe no-op. Genuine shop listings are structurally excluded by the
 * same WHERE clause (property_type = 'shop' never matches), so this
 * cannot null out a real shop's own data.
 *
 * Uses pgm.db.query (not pgm.sql) purely so the affected row count can be
 * logged to stdout at migration-run time (visible in Render's boot logs,
 * since migrate:up now runs from `npm start` on every deploy per
 * c68dc1d) -- there is no other way to observe "rows updated" for a
 * one-off data migration running unattended on a Render Free instance
 * with no Shell/One-Off Jobs access.
 */
exports.up = async (pgm) => {
  const result = await pgm.db.query(`
    UPDATE properties
    SET
      front_width_ft = NULL,
      shop_depth_ft = NULL,
      road_width_ft = NULL,
      power_load = NULL,
      is_corner_shop = NULL,
      has_washroom = NULL,
      ready_to_move = NULL,
      suitable_for = NULL
    WHERE property_type <> 'shop'
      AND (
        front_width_ft IS NOT NULL
        OR shop_depth_ft IS NOT NULL
        OR road_width_ft IS NOT NULL
        OR power_load IS NOT NULL
        OR is_corner_shop IS NOT NULL
        OR has_washroom IS NOT NULL
        OR ready_to_move IS NOT NULL
        OR suitable_for IS NOT NULL
      )
  `);
  // eslint-disable-next-line no-console -- intentional: only way to observe
  // the affected row count for this one-off backfill (see doc-comment above).
  console.log(`[backfill-null-shop-fields] Updated ${result.rowCount} row(s).`);
};

/**
 * Deliberately a no-op -- cannot be cleanly reversed. Once this runs,
 * there is no way to tell "a shop field that was legitimately NULL
 * already" apart from "a shop field this backfill just cleared", so a
 * real rollback would have no original values to restore (the whole
 * point of the bug being fixed is that these values were never supposed
 * to survive a propertyType change away from "shop" in the first place).
 */
exports.down = async () => {};
