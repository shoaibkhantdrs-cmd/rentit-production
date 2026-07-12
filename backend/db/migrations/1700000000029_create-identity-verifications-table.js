exports.shorthands = undefined;

/** Owner Verification (Part 5): a user submits an ID document (stored via
 * the existing Cloudinary IImageStorageService, same as property images),
 * an admin reviews and approves/rejects it. Users may resubmit after a
 * rejection, so there's no uniqueness constraint on user_id -- "current"
 * status is whichever row is newest for that user. */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE identity_verifications (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      document_type         TEXT NOT NULL
                              CHECK (document_type IN ('government_id', 'passport', 'driving_license', 'other')),
      document_image_url    TEXT NOT NULL,
      status                TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'rejected')),
      reviewed_by           UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at           TIMESTAMPTZ NULL,
      rejection_reason      TEXT NULL,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql('CREATE INDEX identity_verifications_user_id_idx ON identity_verifications (user_id, created_at DESC);');
  pgm.sql('CREATE INDEX identity_verifications_status_idx ON identity_verifications (status);');

  pgm.sql(`
    CREATE TRIGGER identity_verifications_set_updated_at
    BEFORE UPDATE ON identity_verifications
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS identity_verifications CASCADE;');
};
