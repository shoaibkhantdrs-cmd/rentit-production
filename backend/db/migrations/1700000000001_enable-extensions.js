/**
 * Enables Postgres extensions used across later migrations.
 * gen_random_uuid() is core since PG13, but pgcrypto is enabled anyway for
 * other crypto helpers, and citext gives us case-insensitive unique emails
 * without hand-rolling lower() indexes everywhere.
 */
exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
  pgm.sql('CREATE EXTENSION IF NOT EXISTS citext;');
};

exports.down = async (pgm) => {
  pgm.sql('DROP EXTENSION IF EXISTS citext;');
  pgm.sql('DROP EXTENSION IF EXISTS pgcrypto;');
};
