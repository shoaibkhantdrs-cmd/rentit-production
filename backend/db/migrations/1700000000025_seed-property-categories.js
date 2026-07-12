exports.shorthands = undefined;

const CATEGORIES = [
  ['Residential Rental', 'residential-rental', 'Apartments, houses, and villas for long-term rent.'],
  ['Commercial Rental', 'commercial-rental', 'Office, retail, and other commercial space for rent.'],
  ['PG / Hostel', 'pg-hostel', 'Paying-guest accommodation and hostel rooms.'],
  ['Vacation Rental', 'vacation-rental', 'Short-term and vacation stays.'],
];

exports.up = async (pgm) => {
  for (const [name, slug, description] of CATEGORIES) {
    pgm.sql(
      `INSERT INTO property_categories (name, slug, description)
       VALUES ('${name}', '${slug}', '${description}')
       ON CONFLICT DO NOTHING;`,
    );
  }
};

exports.down = async (pgm) => {
  const slugs = CATEGORIES.map(([, slug]) => `'${slug}'`).join(', ');
  pgm.sql(`DELETE FROM property_categories WHERE slug IN (${slugs});`);
};
