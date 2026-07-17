exports.shorthands = undefined;

// A confirmed, successful (or failed) charge against a payment_order.
// Kept separate from payment_orders because one order should map to
// exactly one successful payment, but gateways can retry/send duplicate
// webhooks for the same order -- gateway_payment_id is unique so a retried
// webhook is a no-op insert, not a duplicate charge record.
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE payments (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      payment_order_id   UUID NOT NULL REFERENCES payment_orders(id) ON DELETE CASCADE,
      gateway            TEXT NOT NULL CHECK (gateway IN ('razorpay', 'stripe')),
      gateway_payment_id TEXT NOT NULL,
      amount             INTEGER NOT NULL CHECK (amount > 0),
      currency           TEXT NOT NULL DEFAULT 'INR',
      status             TEXT NOT NULL CHECK (status IN ('succeeded', 'failed', 'refunded', 'partially_refunded')),
      method             TEXT,
      raw_event          JSONB,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (gateway, gateway_payment_id)
    );
  `);

  pgm.sql("CREATE INDEX payments_payment_order_id_idx ON payments (payment_order_id);");
  pgm.sql("CREATE INDEX payments_status_idx ON payments (status);");
};

exports.down = async (pgm) => {
  pgm.sql("DROP TABLE IF EXISTS payments CASCADE;");
};
