exports.shorthands = undefined;

/** Mirrors email_verified_at / phone_verified_at from Phase 2 -- set once an
 * admin approves a submitted identity_verifications row (see migration 029). */
exports.up = async (pgm) => {
  pgm.sql('ALTER TABLE users ADD COLUMN identity_verified_at TIMESTAMPTZ NULL;');
};

exports.down = async (pgm) => {
  pgm.sql('ALTER TABLE users DROP COLUMN IF EXISTS identity_verified_at;');
};
