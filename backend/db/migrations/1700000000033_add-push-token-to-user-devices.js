exports.shorthands = undefined;

/**
 * Phase 5 Part 2 (Push Notifications / FCM). Additive column on the
 * existing Phase 2 user_devices table -- a device that has registered an
 * FCM token is the same "device" concept already tracked for session
 * management, so this reuses that table instead of introducing a new one.
 */
exports.up = async (pgm) => {
  pgm.sql("ALTER TABLE user_devices ADD COLUMN push_token TEXT NULL;");
  pgm.sql(
    "CREATE INDEX user_devices_push_token_idx ON user_devices (push_token) WHERE push_token IS NOT NULL;",
  );
};

exports.down = async (pgm) => {
  pgm.sql("DROP INDEX IF EXISTS user_devices_push_token_idx;");
  pgm.sql("ALTER TABLE user_devices DROP COLUMN IF EXISTS push_token;");
};
