/**
 * One-time production bootstrap: grants the super_admin (or admin) role to
 * an already-registered user, for deployments that have no admin account
 * yet.
 *
 * WHY THIS EXISTS
 * ----------------
 * RegisterUser.usecase.ts always assigns DEFAULT_ROLE = "customer" to new
 * accounts -- deliberately, so nobody can self-grant elevated access by
 * registering. The only endpoint that can change roles afterwards (PUT
 * /admin/users/:id/roles, UpdateUserRoles.usecase.ts) itself requires the
 * caller to already be an admin/super_admin. That's the correct design for
 * every admin *after* the first one, but it means a brand-new deployment
 * has no path to create its first admin at all -- confirmed during a QA
 * pass (2026-07-28): no seed migration inserts a user row, no
 * ADMIN_EMAIL/SEED_ADMIN env var exists, RegisterUser has no "first user
 * becomes admin" branch, and no CLI script promoted anyone. The only way
 * to break that circularity used to be a hand-written SQL statement run
 * directly against production -- error-prone (wrong role name, tripping
 * over roles.deleted_at, typoed email), unaudited, and different every
 * time someone has to do it. This script replaces that with one reviewed,
 * idempotent, audited path.
 *
 * SAFETY MODEL
 * ------------
 *   - Refuses to run if ANY admin or super_admin already exists, unless
 *     --force is passed. This is the only thing stopping this script from
 *     being an unlimited "grant yourself admin" backdoor if a deploy shell
 *     or this repo were ever compromised -- it can mint the FIRST admin
 *     only. Every admin after that must go through the normal Admin > Users
 *     page (PUT /admin/users/:id/roles), which requires a human who is
 *     already an admin to click it.
 *   - Requires the target user to already exist (registered normally
 *     through the app). This script never creates accounts or sets
 *     passwords -- it can only elevate an identity that already went
 *     through the app's own registration/validation, never plant a new one.
 *   - Dry-run by default. Nothing is written unless --yes is passed.
 *   - Reuses the app's own UserRepository / RoleRepository /
 *     UserRoleRepository / AuditLogRepository classes instead of hand-rolled
 *     SQL, so it can't drift from the real schema, and the grant lands in
 *     the same audit_logs table as every other admin action (queryable via
 *     the app's normal audit log search).
 *
 * USAGE (from backend/, with DATABASE_URL pointed at the target database)
 * -------------------------------------------------------------------------
 *   npx tsx scripts/bootstrap-admin.ts --email=you@yourcompany.com --yes
 * or, once added to package.json:
 *   npm run bootstrap:admin -- --email=you@yourcompany.com --yes
 *
 * Optional flags:
 *   --role=admin   Grant "admin" instead of the default "super_admin".
 *   --force        Proceed even though an admin/super_admin already exists
 *                  (only for recovering a deployment that's locked itself
 *                  out, e.g. every admin account got disabled/deleted).
 *
 * See docs/ADMIN_BOOTSTRAP.md for the full first-deploy walkthrough,
 * including how to run this without ever exposing the database password
 * outside Render (via Render Shell / a One-Off Job) versus the fallback
 * for free-tier services that don't support Shell.
 */
import { pool } from "@/config/database";
import { UserRepository } from "@/infrastructure/database/repositories/UserRepository";
import { RoleRepository } from "@/infrastructure/database/repositories/RoleRepository";
import { UserRoleRepository } from "@/infrastructure/database/repositories/UserRoleRepository";
import { AuditLogRepository } from "@/infrastructure/database/repositories/AuditLogRepository";

const ADMIN_ROLE_NAMES = ["admin", "super_admin"];

interface ParsedArgs {
  email?: string;
  role: string;
  yes: boolean;
  force: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  let email: string | undefined;
  let role = "super_admin";
  let yes = false;
  let force = false;

  for (const arg of argv) {
    if (arg.startsWith("--email=")) email = arg.slice("--email=".length).trim();
    else if (arg.startsWith("--role=")) role = arg.slice("--role=".length).trim();
    else if (arg === "--yes") yes = true;
    else if (arg === "--force") force = true;
  }

  // BOOTSTRAP_ADMIN_EMAIL lets this run from a Render One-Off Job / Shell
  // without needing to hand-type the email into the command each time.
  return { email: email ?? process.env.BOOTSTRAP_ADMIN_EMAIL, role, yes, force };
}

function printUsage(): void {
  console.error(
    "Usage: npx tsx scripts/bootstrap-admin.ts --email=you@yourcompany.com --yes\n" +
      "(or set BOOTSTRAP_ADMIN_EMAIL instead of --email)\n" +
      "See docs/ADMIN_BOOTSTRAP.md for the full walkthrough.",
  );
}

async function main(): Promise<void> {
  const { email, role, yes, force } = parseArgs(process.argv.slice(2));

  if (!email) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (!ADMIN_ROLE_NAMES.includes(role)) {
    console.error(`--role must be one of: ${ADMIN_ROLE_NAMES.join(", ")} (got "${role}")`);
    process.exitCode = 1;
    return;
  }

  const userRepo = new UserRepository(pool);
  const roleRepo = new RoleRepository(pool);
  const userRoleRepo = new UserRoleRepository(pool);
  const auditLogRepo = new AuditLogRepository(pool);

  try {
    const user = await userRepo.findByEmail(email);
    if (!user) {
      console.error(
        `No account found for "${email}". This script only elevates an EXISTING account -- ` +
          "register normally through the app first (so it goes through the same validation as " +
          "every other user), then re-run this script.",
      );
      process.exitCode = 1;
      return;
    }

    // Refuse once the deployment already has an admin, unless explicitly
    // forced -- see the "SAFETY MODEL" doc comment above for why this is
    // the load-bearing guard that keeps this a one-time bootstrap tool
    // rather than a standing backdoor.
    const existingAdminCheck = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
       JOIN users u ON u.id = ur.user_id AND u.deleted_at IS NULL
       WHERE r.name = ANY($1::text[])`,
      [ADMIN_ROLE_NAMES],
    );
    const existingAdminCount = parseInt(existingAdminCheck.rows[0].count, 10);

    if (existingAdminCount > 0 && !force) {
      console.error(
        `This deployment already has ${existingAdminCount} admin/super_admin account(s). ` +
          "Refusing to run again -- add further admins through the Admin > Users page in the " +
          "app instead, using an existing admin account. If you're deliberately recovering a " +
          "deployment that's lost all admin access, re-run with --force.",
      );
      process.exitCode = 1;
      return;
    }

    const currentRoles = await userRoleRepo.listRoleNamesForUser(user.id);
    if (currentRoles.includes(role)) {
      console.log(`${email} already has the "${role}" role. Nothing to do.`);
      return;
    }

    const roleRecord = await roleRepo.findByName(role);
    if (!roleRecord) {
      console.error(
        `Role "${role}" was not found in the roles table (expected to be pre-seeded by ` +
          "migration 1700000000014_seed-roles.js). Run pending migrations first.",
      );
      process.exitCode = 1;
      return;
    }

    console.log(`About to grant "${role}" to ${email} (user id ${user.id}).`);
    console.log(`Current roles: ${currentRoles.length ? currentRoles.join(", ") : "(none)"}`);

    if (!yes) {
      console.log("\nDry run only -- no changes made. Re-run with --yes to apply this.");
      return;
    }

    await userRoleRepo.assign(user.id, roleRecord.id, null);
    await auditLogRepo.record({
      userId: null,
      action: "admin.bootstrap.role_granted",
      entityType: "user",
      entityId: user.id,
      metadata: { role, grantedTo: email, viaScript: "bootstrap-admin.ts" },
    });

    console.log(`Done. ${email} now has the "${role}" role -- sign in and check the Admin nav.`);
  } finally {
    await pool.end();
  }
}

main().catch((err: Error) => {
  console.error("Bootstrap FAILED:", err.message);
  process.exitCode = 1;
});
