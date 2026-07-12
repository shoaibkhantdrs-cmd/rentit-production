exports.shorthands = undefined;

const ROLES = [
  ['super_admin', 'Full, unrestricted access to every resource and admin capability.'],
  ['admin', 'Operational access to manage users, listings, and platform content.'],
  ['property_owner', 'Can create and manage their own property listings.'],
  ['customer', 'Default role for anyone who registers to browse and book properties.'],
  ['moderator', 'Can review and moderate user-generated content and reports.'],
];

exports.up = async (pgm) => {
  for (const [name, description] of ROLES) {
    pgm.sql(
      `INSERT INTO roles (name, description) VALUES ('${name}', '${description}')
       ON CONFLICT DO NOTHING;`,
    );
  }
};

exports.down = async (pgm) => {
  const names = ROLES.map(([name]) => `'${name}'`).join(', ');
  pgm.sql(`DELETE FROM roles WHERE name IN (${names});`);
};
