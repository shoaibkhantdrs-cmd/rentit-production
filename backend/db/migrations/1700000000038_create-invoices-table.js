exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE invoices (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      payment_id       UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
      user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invoice_number   TEXT NOT NULL UNIQUE,
      amount           INTEGER NOT NULL,
      currency         TEXT NOT NULL DEFAULT 'INR',
      line_description TEXT NOT NULL,
      issued_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql("CREATE INDEX invoices_user_id_idx ON invoices (user_id);");
  pgm.sql("CREATE INDEX invoices_payment_id_idx ON invoices (payment_id);");
};

exports.down = async (pgm) => {
  pgm.sql("DROP TABLE IF EXISTS invoices CASCADE;");
};
