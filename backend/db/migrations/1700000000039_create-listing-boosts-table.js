exports.shorthands = undefined;

// Covers both "Featured Listing" and "Boost Listing" from one table --
// they're the same purchase shape (a property + a time window + a
// payment), differing only in boost_type and how the frontend/search
// ranking treats it. Created in 'pending' status by
// CreateListingBoostOrder.usecase, flipped to 'active' by the webhook
// handler once the gateway confirms payment.
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE listing_boosts (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      property_id        UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      boost_type         TEXT NOT NULL CHECK (boost_type IN ('featured', 'boost')),
      status             TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
      starts_at          TIMESTAMPTZ,
      ends_at            TIMESTAMPTZ,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql("CREATE INDEX listing_boosts_property_id_idx ON listing_boosts (property_id);");
  pgm.sql("CREATE INDEX listing_boosts_user_id_idx ON listing_boosts (user_id);");
  // Used by search ranking to find currently-active boosts for a set of
  // property ids without a full table scan (Part 3: performance).
  pgm.sql(
    "CREATE INDEX listing_boosts_active_window_idx ON listing_boosts (property_id, status, ends_at) WHERE status = 'active';",
  );
};

exports.down = async (pgm) => {
  pgm.sql("DROP TABLE IF EXISTS listing_boosts CASCADE;");
};
