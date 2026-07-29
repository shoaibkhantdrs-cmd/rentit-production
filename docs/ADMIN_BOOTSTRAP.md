# Bootstrapping the first admin account

## The gap this closes

Every new RentIt account is registered with the `customer` role only
(`RegisterUser.usecase.ts`, `DEFAULT_ROLE = "customer"`) — deliberately, so
nobody can grant themselves elevated access just by signing up. The only
endpoint that changes a user's roles afterwards, `PUT
/admin/users/:id/roles` (`UpdateUserRoles.usecase.ts`), itself requires the
caller to already hold the `admin` or `super_admin` role.

That's the right design for the second admin onward, but it leaves a brand
new deployment with no path to create its *first* admin at all. Confirmed
during a production-readiness QA pass (2026-07-28):

- No seed migration inserts a row into `users` — only `roles` is seeded
  (`db/migrations/1700000000014_seed-roles.js`).
- No `ADMIN_EMAIL` / `SEED_ADMIN_*` environment variable exists anywhere
  (checked `.env.example` and the full repo).
- `RegisterUser.usecase.ts` has no "first user in the system becomes
  admin" branch.
- No CLI/npm script promoted anyone (the only pre-existing scripts were
  `backup-db.sh`, `restore-db.sh`, `test-smtp.ts`).

Before this doc, the only way past that was a hand-written SQL statement
run directly against production — easy to get wrong (typoed email, wrong
role name, tripping over `roles.deleted_at`), unaudited, and improvised
fresh every time someone needed it.

## The fix: `scripts/bootstrap-admin.ts`

A one-time, idempotent, audited bootstrap script that reuses the app's own
`UserRepository` / `RoleRepository` / `UserRoleRepository` /
`AuditLogRepository` classes — no hand-rolled SQL, no risk of drifting from
the real schema, and the grant lands in the same `audit_logs` table
(`admin.bootstrap.role_granted`) as every other admin action, visible later
in `/admin/audit-logs`.

**Safety guarantees, by design:**

- **Refuses to run if an admin/super_admin already exists**, unless you
  pass `--force`. This is what stops it from being a standing "grant
  yourself admin" backdoor — it can only mint the *first* admin. Every
  admin after that must be added the normal way, through `/admin/users` by
  someone who's already an admin.
- **Requires the target account to already exist.** The script never
  creates a user or sets a password — it only elevates an identity that
  already went through the app's own registration and validation.
- **Dry-run by default.** It prints what it would do and makes no changes
  unless you pass `--yes`.

## Step-by-step: bootstrapping a new deployment

1. **Register a normal account** through the live app, using the email
   address you want to be the first admin (e.g.
   `https://your-frontend.example.com` → Create an account).

2. **Run the script against that deployment's database:**

   ```bash
   cd backend
   npm run bootstrap:admin -- --email=you@yourcompany.com --yes
   ```

   (Omit `--yes` first if you want to see the dry-run output before
   committing.) Defaults to granting `super_admin`; pass `--role=admin`
   for the lesser role instead.

3. **Sign in again** (or wait for your next automatic token refresh —
   roles are embedded in the access token and only refresh on
   `POST /auth/refresh`, per `ADMINISTRATOR_MANUAL.md`). The Admin nav item
   and `/admin` routes are now reachable.

4. **Add every other admin through the UI from here on** — `/admin/users`
   → open the account → toggle the `admin`/`super_admin` checkbox. Don't
   re-run this script for routine admin additions; it will refuse once it
   sees an existing admin, exactly as designed.

## Where to actually run it, per hosting tier

`scripts/` is intentionally excluded from the TypeScript build
(`tsconfig.json`'s `include` is `["src"]` only, so `dist/` never contains
it) and only runs via `tsx`. That means "run it in production" means one of
two things depending on what your Render plan supports:

- **Paid Render instance (or any host with Shell/exec access):** open the
  service's Shell and run `npx tsx scripts/bootstrap-admin.ts
  --email=... --yes` directly against the running service. `DATABASE_URL`
  is already in that environment — the database password never has to
  leave Render, and no external network access is needed.

- **Free-tier Render (no Shell support):** run it from your own machine
  with `DATABASE_URL` (or `BOOTSTRAP_ADMIN_EMAIL` + `DATABASE_URL`)
  temporarily pointed at the database's **External Database URL** (Render
  dashboard → your Postgres service → Info → Connections), **and**
  `DATABASE_SSL=true`:

  ```bash
  cd backend
  DATABASE_URL="<External Database URL from Render>" \
  DATABASE_SSL=true \
  npm run bootstrap:admin -- --email=you@yourcompany.com --yes
  ```

  `DATABASE_SSL=true` is required here: the shared pool (`database.ts`)
  doesn't attempt SSL by default (the deployed app connects over Render's
  private network via the *Internal* Database URL and has never needed
  it), but Render's Postgres requires SSL on the External URL, which
  crosses the public internet — without this you'll see the connection
  fail with `SSL/TLS required`. This does not weaken anything for the
  deployed app: `DATABASE_SSL` is unset there, so its behavior is
  unchanged; the flag only takes effect for this one-off invocation.

  This is the one unavoidable manual step on free tier — there is no
  Render-hosted alternative today (Postgres services don't expose a web
  SQL console or a "One-Off Jobs" feature the way some paid web-service
  plans do). It is, however, a single scripted command instead of
  hand-typed SQL: it's idempotent, guarded against misuse, validated
  against the real schema, TLS-encrypted, and leaves an audit trail —
  meaningfully safer than the ad hoc SQL statement it replaces, even
  though it still requires temporary network access to the database from
  wherever you run it.

## Recovering a locked-out deployment

If every admin account is ever deleted, suspended, or otherwise
inaccessible, re-run the script with `--force` to mint a new one, using the
same steps above.
