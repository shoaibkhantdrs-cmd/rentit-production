import { Pool } from "pg";
import { IHealthCheckService } from "@/domain/services/IHealthCheckService";

/** Real DB ping for the admin "System Health" panel (Phase 4 Part 1). */
export class PostgresHealthCheckService implements IHealthCheckService {
  constructor(private readonly pool: Pool) {}

  async isDatabaseHealthy(): Promise<boolean> {
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }
}
