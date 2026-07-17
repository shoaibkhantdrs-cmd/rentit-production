exports.shorthands = undefined;

// Phase 6 Part 1 (Payments): a payment_order is created BEFORE money moves
// -- it records intent (what the user is trying to buy, for how much, with
// which gateway) and is later matched against a gateway webhook to confirm
// payment. purpose + purchasable_type/id are a light polymorphic
// reference (listing_boosts.id or user_subscriptions.id), same shape used
// nowhere else in this codebase but the simplest correct option for two
// very different purchasable kinds sharing one payment flow.
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE payment_orders (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      gateway            TEXT NOT NULL CHECK (gateway IN ('razorpay', 'stripe')),
      gateway_order_id   TEXT NOT NULL,
      purpose            TEXT NOT NULL CHECK (purpose IN ('listing_boost', 'premium_plan')),
      purchasable_type   TEXT NOT NULL CHECK (purchasable_type IN ('listing_boost', 'user_subscription')),
      purchasable_id     UUID NOT NULL,
      amount             INTEGER NOT NULL CHECK (amount > 0), -- smallest currency unit
      currency           TEXT NOT NULL DEFAULT 'INR',
      status             TEXT NOT NULL DEFAULT 'created'
                           CHECK (status IN ('created', 'paid', 'failed', 'cancelled')),
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (gateway, gateway_order_id)
    );
  `);

  pgm.sql("CREATE INDEX payment_orders_user_id_idx ON payment_orders (user_id);");
  pgm.sql("CREATE INDEX payment_orders_status_idx ON payment_orders (status);");
  pgm.sql(
    "CREATE INDEX payment_orders_purchasable_idx ON payment_orders (purchasable_type, purchasable_id);",
  );
};

exports.down = async (pgm) => {
  pgm.sql("DROP TABLE IF EXISTS payment_orders CASCADE;");
};
