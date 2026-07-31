/**
 * One-off cleanup: strips the "[Seeded by RentIt data-population script
 * v1]" marker that an earlier version of seed-properties.ts appended to
 * every seeded property's `description` -- found via live browser
 * evidence on PropertyDetailsPage, where it was rendered verbatim at the
 * bottom of a real listing's description (e.g. "Sea-facing 2BHK in Bandra
 * West"). seed-properties.ts no longer writes this marker (idempotency is
 * now checked via the seed owners' email domain instead), but the 26
 * properties already inserted into your local DB before that fix still
 * carry it. This script removes it from any row that has it; it is a
 * no-op (0 rows affected) if you re-seed fresh or already ran this once.
 *
 * USAGE (from backend/, with DATABASE_URL pointed at your local Postgres)
 * -------------------------------------------------------------------------
 *   npx tsx scripts/cleanup-seed-marker.ts
 */
import { pool } from "@/config/database";

const MARKER = "\n\n[Seeded by RentIt data-population script v1]";

async function main(): Promise<void> {
  try {
    const result = await pool.query(
      `UPDATE properties
       SET description = REPLACE(description, $1, '')
       WHERE description LIKE $2`,
      [MARKER, `%${MARKER}%`],
    );
    console.log(`Cleaned marker from ${result.rowCount ?? 0} propert${result.rowCount === 1 ? "y" : "ies"}.`);
  } finally {
    await pool.end();
  }
}

main().catch((err: Error) => {
  console.error("Cleanup FAILED:", err.message);
  process.exitCode = 1;
});
