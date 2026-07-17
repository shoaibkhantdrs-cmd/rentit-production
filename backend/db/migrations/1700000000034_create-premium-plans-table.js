exports.shorthands = undefined;

// Phase 6 Part 1 (Payments): premium subscription plans. Kept as a table
// (not a hardcoded enum) so plans/pricing can change without a deploy --
// mirrors property_categories' seed-table pattern.
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE premium_plans (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug           TEXT NOT NULL UNIQUE,
      name           TEXT NOT NULL,
      description    TEXT,
      price_amount   INTEGER NOT NULL CHECK (price_amount >= 0), -- smallest currency unit (paise/cents)
      currency       TEXT NOT NULL DEFAULT 'INR',
      duration_days  INTEGER NOT NULL CHECK (duration_days > 0),
      features       JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_active      BOOLEAN NOT NULL DEFAULT true,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql("CREATE INDEX premium_plans_is_active_idx ON premium_plans (is_active);");
};

exports.down = async (pgm) => {
  pgm.sql("DROP TABLE IF EXISTS premium_plans CASCADE;");
};
