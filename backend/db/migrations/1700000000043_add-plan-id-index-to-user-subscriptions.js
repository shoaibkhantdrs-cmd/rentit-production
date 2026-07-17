exports.shorthands = undefined;

// Phase 6 Part 3 (performance audit): user_subscriptions.plan_id is a
// foreign key with no covering index -- Postgres only auto-indexes the
// referenced side (premium_plans.id), not this referencing column. Matters
// for the FK constraint's own lookup cost as the table grows, and for any
// "how many active subscribers does plan X have" admin query.
exports.up = async (pgm) => {
  pgm.sql("CREATE INDEX user_subscriptions_plan_id_idx ON user_subscriptions (plan_id);");
};

exports.down = async (pgm) => {
  pgm.sql("DROP INDEX IF EXISTS user_subscriptions_plan_id_idx;");
};
