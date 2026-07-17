exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE refunds (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      payment_id        UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
      gateway_refund_id TEXT NOT NULL,
      amount            INTEGER NOT NULL CHECK (amount > 0),
      status            TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'processed', 'failed')),
      reason            TEXT,
      initiated_by      UUID REFERENCES users(id) ON DELETE SET NULL, -- admin who issued it; null for gateway-initiated
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (payment_id, gateway_refund_id)
    );
  `);

  pgm.sql("CREATE INDEX refunds_payment_id_idx ON refunds (payment_id);");
};

exports.down = async (pgm) => {
  pgm.sql("DROP TABLE IF EXISTS refunds CASCADE;");
};
