import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDateOnly } from "@/infrastructure/database/repositories/PropertyRepository";

// Phase 3 Part 2, Part 1: regression test for the availableFrom bug.
//
// node-postgres returns a Postgres DATE column as a JS Date object, not a
// string. PropertyRepository.toEntity() previously normalized
// available_from with `typeof row.available_from === "string" ? ... :
// row.available_from` -- a check that never matched a real Date object,
// so the raw Date fell through unnormalized and later serialized (via
// JSON.stringify's implicit toISOString()) into a full ISO datetime
// string, which native `<input type="date">` elements reject outright.
//
// Timezone follow-up (found in code review): the `postgres-date` package
// (node-postgres's DATE parser) builds that Date object with the
// *local-time* multi-arg constructor -- `new Date(year, month, day)` --
// not a UTC-anchored ISO string. The Date-handling tests below construct
// dates the same way, so they actually exercise the real driver behavior
// instead of a UTC-anchored stand-in that would mask a timezone bug.

test("formatDateOnly: normalizes a Date built the way node-postgres builds a DATE column to YYYY-MM-DD", () => {
  // Mirrors postgres-date's getDate(): new Date(year, monthIndex, day),
  // local time, no timezone/offset component at all.
  const pgStyleDate = new Date(2026, 7, 10); // August 10, 2026
  assert.equal(formatDateOnly(pgStyleDate), "2026-08-10");
});

test("formatDateOnly: zero-pads single-digit month and day for a node-postgres-style Date", () => {
  const pgStyleDate = new Date(2026, 0, 5); // January 5, 2026
  assert.equal(formatDateOnly(pgStyleDate), "2026-01-05");
});

test("formatDateOnly: a node-postgres-style Date normalizes correctly under a positive UTC offset (Asia/Kolkata), unlike the old toISOString() implementation", () => {
  // This is the exact regression the timezone fix addresses. Under IST
  // (UTC+5:30), local midnight on the 10th is 18:30 UTC on the *9th* --
  // the old `value.toISOString().slice(0, 10)` implementation would
  // therefore have returned "2026-08-09" here, silently rolling the date
  // back by one day. Reading the Date back out via its own local getters
  // (getFullYear/getMonth/getDate) is the correct, timezone-safe inverse
  // of how postgres-date constructs it, and is unaffected by the process
  // timezone.
  //
  // TZ is changed for the duration of this test only and restored in
  // `finally` so it doesn't leak into any other test running in this
  // process -- no global/system configuration is modified.
  const originalTz = process.env.TZ;
  process.env.TZ = "Asia/Kolkata";
  try {
    const pgStyleDate = new Date(2026, 7, 10); // August 10, 2026, IST local time
    assert.equal(formatDateOnly(pgStyleDate), "2026-08-10");

    // Sanity check that this test is actually exercising a positive UTC
    // offset (and not silently no-op-ing because the environment doesn't
    // honor process.env.TZ) -- if this assertion fails, the test above
    // isn't proving what it claims to prove.
    assert.equal(pgStyleDate.toISOString().slice(0, 10), "2026-08-09");
  } finally {
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  }
});

test("formatDateOnly: an already-correct YYYY-MM-DD string is left unchanged", () => {
  assert.equal(formatDateOnly("2026-08-10"), "2026-08-10");
});

test("formatDateOnly: a longer ISO datetime string is truncated to just the date portion", () => {
  assert.equal(formatDateOnly("2026-08-10T00:00:00.000Z"), "2026-08-10");
});

test("formatDateOnly: null and undefined are handled safely", () => {
  assert.equal(formatDateOnly(null), "");
  assert.equal(formatDateOnly(undefined), "");
});
