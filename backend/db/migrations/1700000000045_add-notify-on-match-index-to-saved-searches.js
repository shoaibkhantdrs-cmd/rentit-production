exports.shorthands = undefined;

// Performance audit finding: NotifySavedSearchesForProperty.usecase.ts
// (invoked synchronously from ApprovePropertyUseCase -- the admin's approve
// request awaits it) calls ISavedSearchRepository.listAllNotifiable(),
// which runs `WHERE notify_on_match = true AND deleted_at IS NULL` with no
// supporting index -- only saved_searches_user_id_idx exists, which this
// query doesn't use at all. A partial index matching this exact predicate
// turns it from a full-table scan into a direct index scan, and stays tiny
// since it only indexes the (typically small) subset of searches that
// actually opted into notifications. No table/column/API change.
exports.up = async (pgm) => {
  pgm.sql(
    `CREATE INDEX saved_searches_notifiable_idx ON saved_searches (notify_on_match)
     WHERE notify_on_match = true AND deleted_at IS NULL;`,
  );
};

exports.down = async (pgm) => {
  pgm.sql("DROP INDEX IF EXISTS saved_searches_notifiable_idx;");
};
