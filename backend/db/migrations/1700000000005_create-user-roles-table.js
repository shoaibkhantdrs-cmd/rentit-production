exports.shorthands = undefined;

exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE user_roles (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id      UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      assigned_by  UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, role_id)
    );
  `);

  pgm.sql('CREATE INDEX user_roles_user_id_idx ON user_roles (user_id);');
  pgm.sql('CREATE INDEX user_roles_role_id_idx ON user_roles (role_id);');
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS user_roles CASCADE;');
};
