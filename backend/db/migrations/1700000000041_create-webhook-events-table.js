exports.shorthands = undefined;

// Idempotency + audit log for inbound payment webhooks. Gateways
// routinely redeliver the same event (at-least-once delivery); the unique
// (gateway, event_id) constraint is what makes replays a harmless no-op
// insert instead of double-crediting a payment. Also gives us a real
// record to show in the admin panel and to replay/debug against.
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE webhook_events (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      gateway      TEXT NOT NULL CHECK (gateway IN ('razorpay', 'stripe')),
      event_id     TEXT NOT NULL,
      event_type   TEXT NOT NULL,
      payload      JSONB NOT NULL,
      processed_at TIMESTAMPTZ,
      error        TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (gateway, event_id)
    );
  `);

  pgm.sql("CREATE INDEX webhook_events_created_at_idx ON webhook_events (created_at DESC);");
};

exports.down = async (pgm) => {
  pgm.sql("DROP TABLE IF EXISTS webhook_events CASCADE;");
};
