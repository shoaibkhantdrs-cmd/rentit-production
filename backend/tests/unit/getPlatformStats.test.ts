import { test } from "node:test";
import assert from "node:assert/strict";
import { GetPlatformStatsUseCase } from "@/application/properties/GetPlatformStats.usecase";
import { IPlatformStatsRepository, PlatformStats } from "@/domain/repositories/IPlatformStatsRepository";

// GetPlatformStatsUseCase is a thin pass-through (see its own doc comment)
// -- all the real logic lives in PlatformStatsRepository's raw SQL, which
// talks directly to a pg Pool and (like every other raw-SQL repository in
// this codebase, e.g. PropertyRepository) has no fake/in-memory
// implementation to unit test against here. This test only proves the
// use-case layer's contract: it returns exactly what the repository
// gives it, with no silent transformation, filtering, or default-ing of
// the numbers. It does NOT exercise the actual SQL -- see the "verified
// owners returns 0" investigation in PlatformStatsRepository.ts's
// comments for why that query specifically needs live-DB verification,
// which isn't possible from this test environment (no reachable
// Postgres instance).
class FakePlatformStatsRepository implements IPlatformStatsRepository {
  constructor(private readonly stats: PlatformStats) {}
  calls = 0;

  async getStats(): Promise<PlatformStats> {
    this.calls += 1;
    return this.stats;
  }
}

test("GetPlatformStatsUseCase: returns exactly what the repository provides, unmodified", async () => {
  const stats: PlatformStats = {
    activeListings: 12,
    totalCategories: 5,
    citiesCovered: 3,
    verifiedOwners: 1,
  };
  const repo = new FakePlatformStatsRepository(stats);
  const useCase = new GetPlatformStatsUseCase(repo);

  const result = await useCase.execute();

  assert.deepEqual(result, stats);
  assert.equal(repo.calls, 1);
});

test("GetPlatformStatsUseCase: does not mask a genuine zero (e.g. verifiedOwners) as missing/undefined", async () => {
  const stats: PlatformStats = {
    activeListings: 4,
    totalCategories: 2,
    citiesCovered: 1,
    verifiedOwners: 0,
  };
  const repo = new FakePlatformStatsRepository(stats);
  const useCase = new GetPlatformStatsUseCase(repo);

  const result = await useCase.execute();

  assert.equal(result.verifiedOwners, 0);
  assert.equal(typeof result.verifiedOwners, "number");
});
