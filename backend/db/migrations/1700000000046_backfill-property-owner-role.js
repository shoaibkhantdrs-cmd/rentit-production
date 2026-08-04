exports.shorthands = undefined;

/**
 * Backfill: grant every existing user the "property_owner" role.
 *
 * Root cause this fixes: commit c2e505a ("Grant property_owner role by
 * default so new signups can list immediately") changed
 * RegisterUserUseCase and LoginUserUseCase.autoRegister to assign
 * ["customer", "property_owner"] instead of just ["customer"] -- but that
 * code only runs at the moment a brand-new `users` row is INSERTed. Every
 * account created *before* that commit shipped still has only the
 * "customer" row in user_roles, because nothing ever re-evaluates an
 * existing user's role set after signup.
 *
 * Symptom this produced: a pre-existing account (e.g. "Zainabdmx") could
 * sign in, verify phone, and browse fine (none of that is role-gated),
 * but clicking "List Property" hit both the backend's
 * authorize("property_owner", "admin", "super_admin") gate on
 * POST /properties and the frontend's matching LISTING_ROLES check in
 * AddPropertyPage.tsx's RequireListingRole, landing on "Listing not
 * available for this account. Only property-owner accounts can list a
 * property." -- a permanent dead end with no self-serve fix, since
 * nothing in the app ever grants roles after initial registration.
 *
 * This is a one-time backfill, not a permanent behavioral change: it
 * brings every pre-existing user's role set up to parity with what a
 * brand-new signup already gets today, exactly once, via INSERT ...
 * WHERE NOT EXISTS (safe to run more than once -- already-granted users
 * are simply skipped, and the UNIQUE (user_id, role_id) constraint on
 * user_roles would reject a duplicate even if the WHERE NOT EXISTS guard
 * were somehow bypassed).
 *
 * Deliberately unconditional across all existing users (not just ones
 * with the "customer" role): RentIt users are both renters and owners
 * interchangeably (see c2e505a's reasoning), and granting property_owner
 * to an admin/super_admin/moderator who doesn't already have it is
 * harmless -- authorize() only checks "does the caller have at least one
 * of the allowed roles", so extending property_owner to accounts that
 * already pass via admin/super_admin changes nothing for them, and
 * moderator accounts gain the same self-serve listing ability regular
 * customers now get by default.
 */
exports.up = async (pgm) => {
  pgm.sql(`
    INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at)
    SELECT u.id, r.id, NULL, now()
    FROM users u
    CROSS JOIN roles r
    WHERE r.name = 'property_owner'
      AND NOT EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = u.id AND ur.role_id = r.id
      );
  `);
};

/**
 * Deliberately a no-op. This migration cannot be cleanly reversed: after
 * it (and after commit c2e505a) runs, every new registration and every
 * auto-registered login also assigns property_owner going forward, so by
 * the time anyone would run `migrate:down`, there is no reliable way to
 * tell "was granted by this backfill" apart from "was granted normally at
 * signup". Rolling back would either strip the role from users who
 * legitimately earned it since, or leave pre-existing users stuck in
 * exactly the broken state this migration exists to fix. Down is
 * intentionally a no-op rather than guessing.
 */
exports.down = async () => {};
