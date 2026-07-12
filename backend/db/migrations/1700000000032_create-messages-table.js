exports.shorthands = undefined;

/**
 * body and image_url are both nullable but a CHECK enforces at least one
 * is present -- a message is either text, an image, or both (a captioned
 * image), never neither. Soft delete (deleted_at) backs the spec's
 * "Soft delete" bullet: a deleted message's content is cleared from the
 * API response ("This message was deleted") but the row (and everyone
 * else's ability to see *that* something was sent) is preserved, mirroring
 * how every other Phase 2-4 soft delete in this codebase behaves.
 */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE messages (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body             TEXT NULL,
      image_url        TEXT NULL,
      image_public_id  TEXT NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at       TIMESTAMPTZ NULL,
      CONSTRAINT messages_body_or_image_chk CHECK (body IS NOT NULL OR image_url IS NOT NULL)
    );
  `);

  pgm.sql(
    'CREATE INDEX messages_conversation_id_created_at_idx ON messages (conversation_id, created_at);',
  );
  pgm.sql('CREATE INDEX messages_sender_id_idx ON messages (sender_id);');

  pgm.sql(`
    CREATE TRIGGER messages_set_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS messages CASCADE;');
};
