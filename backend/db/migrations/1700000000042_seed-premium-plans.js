exports.shorthands = undefined;

// Seed data, same pattern as 1700000000025_seed-property-categories.js.
// Prices are illustrative INR amounts in paise -- change via a normal
// UPDATE once real pricing is decided; nothing in the app hardcodes these.
exports.up = async (pgm) => {
  pgm.sql(`
    INSERT INTO premium_plans (slug, name, description, price_amount, currency, duration_days, features) VALUES
      ('silver', 'Silver', 'Get more visibility for your listings.', 49900, 'INR', 30,
        '["3 featured listing slots", "Priority support"]'::jsonb),
      ('gold', 'Gold', 'Our most popular plan for active owners.', 129900, 'INR', 30,
        '["10 featured listing slots", "Boost included for every listing", "Priority support", "Verified badge"]'::jsonb),
      ('platinum', 'Platinum', 'For agencies and high-volume owners.', 349900, 'INR', 90,
        '["Unlimited featured listing slots", "Boost included for every listing", "Dedicated support", "Verified badge", "Early access to new areas"]'::jsonb)
    ON CONFLICT (slug) DO NOTHING;
  `);
};

exports.down = async (pgm) => {
  pgm.sql("DELETE FROM premium_plans WHERE slug IN ('silver', 'gold', 'platinum');");
};
