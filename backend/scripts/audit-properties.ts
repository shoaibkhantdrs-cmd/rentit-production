/**
 * Read-only audit of the `properties` table -- Phase 1 of the "populate
 * homepage with real data" task (2026-07-31). Answers exactly what was
 * asked: total / published / draft / archived counts, plus every other
 * status the schema actually supports, and an explicit explanation for why
 * the homepage was showing empty states.
 *
 * WHY A SEPARATE SCRIPT FROM seed-properties.ts
 * ----------------------------------------------
 * This never writes anything -- it's safe to run at any time, before or
 * after seeding, to see the real current state of the table without
 * guessing from application-layer symptoms (which is exactly what the
 * prior browser-evidence investigation already ruled out as the cause).
 *
 * USAGE (from backend/, with DATABASE_URL pointed at your local Postgres)
 * -------------------------------------------------------------------------
 *   npx tsx scripts/audit-properties.ts
 * or:
 *   npm run db:audit:properties
 */
import { pool } from "@/config/database";

// Every status the `properties_status_check` constraint actually allows
// (see db/migrations/1700000000016_create-properties-table.js and the
// later 1700000000026_add-moderation-columns-to-properties.js which added
// "rejected"). Listed explicitly rather than inferred from data, so a
// status with zero rows still shows up as "0" instead of silently vanishing.
const ALL_STATUSES = [
  "draft",
  "pending_review",
  "published",
  "rented",
  "inactive",
  "removed",
  "rejected",
] as const;

async function main(): Promise<void> {
  try {
    const totalResult = await pool.query<{ count: string }>(
      "SELECT COUNT(*) FROM properties",
    );
    const total = parseInt(totalResult.rows[0].count, 10);

    const notDeletedResult = await pool.query<{ count: string }>(
      "SELECT COUNT(*) FROM properties WHERE deleted_at IS NULL",
    );
    const notDeleted = parseInt(notDeletedResult.rows[0].count, 10);

    const softDeletedResult = await pool.query<{ count: string }>(
      "SELECT COUNT(*) FROM properties WHERE deleted_at IS NOT NULL",
    );
    const softDeleted = parseInt(softDeletedResult.rows[0].count, 10);

    const byStatusResult = await pool.query<{ status: string; count: string }>(
      "SELECT status, COUNT(*) AS count FROM properties WHERE deleted_at IS NULL GROUP BY status",
    );
    const byStatus = new Map(byStatusResult.rows.map((r) => [r.status, parseInt(r.count, 10)]));

    // What the live homepage stats endpoint and search actually query --
    // see PlatformStatsRepository.getStats() / properties_published_active_idx.
    const publishedActiveResult = await pool.query<{ count: string }>(
      "SELECT COUNT(*) FROM properties WHERE status = 'published' AND deleted_at IS NULL",
    );
    const publishedActive = parseInt(publishedActiveResult.rows[0].count, 10);

    const categoriesResult = await pool.query<{ count: string }>(
      "SELECT COUNT(*) FROM property_categories WHERE deleted_at IS NULL",
    );
    const categories = parseInt(categoriesResult.rows[0].count, 10);

    console.log("=== Properties table audit ===");
    console.log(`Total rows (including soft-deleted):        ${total}`);
    console.log(`  Soft-deleted (deleted_at IS NOT NULL):     ${softDeleted}`);
    console.log(`  Not deleted (deleted_at IS NULL):          ${notDeleted}`);
    console.log("");
    console.log("Breakdown by status (deleted_at IS NULL only):");
    for (const status of ALL_STATUSES) {
      // The task's requested buckets map onto this schema's real status
      // values as: "published" = published, "draft" = draft, and
      // "archived" has no exact match here -- the closest real statuses are
      // "removed" (owner/admin took it down) and "inactive" (temporarily
      // off-market); both are reported individually below rather than
      // invented into a single "archived" number.
      console.log(`  ${status.padEnd(16)} ${byStatus.get(status) ?? 0}`);
    }
    console.log("");
    console.log(`Published AND not deleted (what the public homepage/search actually shows): ${publishedActive}`);
    console.log(`Active property categories: ${categories}`);
    console.log("");

    if (publishedActive === 0) {
      console.log(
        "ROOT CAUSE: the homepage's Newest Listings / Most Viewed / Near You rails all " +
          "query `status = 'published' AND deleted_at IS NULL` (PropertySearchOptions, backed " +
          "by the properties_published_active_idx partial index). That count is 0, so every one " +
          "of those queries legitimately returns an empty page, and HomePage.tsx's own EmptyState " +
          "component renders correctly -- this is NOT a rendering bug (already confirmed with live " +
          "browser DOM evidence: the empty-state-v2 element is fully visible, containing " +
          `"No listings yet"). ${total === 0 ? "The table has zero rows at all -- nothing was ever created." : `${total} row(s) exist, but none have status='published' and deleted_at IS NULL.`}`,
      );
    } else {
      console.log(
        `Published listings exist (${publishedActive}) -- if the homepage still shows an empty ` +
          "state after this, the cause is no longer \"no data\" and needs fresh browser evidence.",
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((err: Error) => {
  console.error("Audit FAILED:", err.message);
  process.exitCode = 1;
});
