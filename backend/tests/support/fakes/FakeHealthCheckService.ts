import { IHealthCheckService } from "@/domain/services/IHealthCheckService";

export class FakeHealthCheckService implements IHealthCheckService {
  public healthy = true;

  async isDatabaseHealthy(): Promise<boolean> {
    return this.healthy;
  }
}
