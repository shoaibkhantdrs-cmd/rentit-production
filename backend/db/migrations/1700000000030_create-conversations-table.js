exports.shorthands = undefined;

/**
 * Phase 5 Part 1 (Real-time Chat). A conversation is always exactly
 * between two users (see conversation_participants, the next migration)
 * and is optionally scoped to a property -- "Property-specific
 * conversations" from the spec. property_id is ON DELETE SET NULL rather
 * than CASCADE: the message history is worth keeping even if the listing
 * is later removed.
 */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE conversations (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      property_id          UUID NULL REFERENCES properties(id) ON DELETE SET NULL,
      last_message_at      TIMESTAMPTZ NULL,
      last_message_preview TEXT NULL,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at           TIMESTAMPTZ NULL
    );
  `);

  pgm.sql('CREATE INDEX conversations_property_id_idx ON conversations (property_id);');
  pgm.sql(
    'CREATE INDEX conversations_last_message_at_idx ON conversations (last_message_at DESC NULLS LAST);',
  );

  pgm.sql(`
    CREATE TRIGGER conversations_set_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS conversations CASCADE;');
};
