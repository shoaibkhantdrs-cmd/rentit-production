import { IHealthCheckService } from "@/domain/services/IHealthCheckService";

export interface SystemHealthReport {
  status: "ok" | "degraded";
  database: "ok" | "error";
  uptimeSeconds: number;
  nodeVersion: string;
  timestamp: string;
}

export class GetSystemHealthUseCase {
  constructor(private readonly healthCheckService: IHealthCheckService) {}

  async execute(): Promise<SystemHealthReport> {
    const databaseHealthy = await this.healthCheckService.isDatabaseHealthy();

    return {
      status: databaseHealthy ? "ok" : "degraded",
      database: databaseHealthy ? "ok" : "error",
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    };
  }
}
