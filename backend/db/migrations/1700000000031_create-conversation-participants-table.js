exports.shorthands = undefined;

/**
 * Join table rather than two participant columns on conversations: it
 * naturally carries per-participant read state (last_read_at), which
 * drives both "unread message count" and "read receipts" without a
 * separate message_reads table, and it doesn't hard-code the chat to
 * exactly two people if that ever needs to change.
 */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE conversation_participants (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      last_read_at    TIMESTAMPTZ NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (conversation_id, user_id)
    );
  `);

  pgm.sql(
    'CREATE INDEX conversation_participants_user_id_idx ON conversation_participants (user_id);',
  );
  pgm.sql(
    'CREATE INDEX conversation_participants_conversation_id_idx ON conversation_participants (conversation_id);',
  );
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS conversation_participants CASCADE;');
};
