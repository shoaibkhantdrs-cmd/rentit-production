/** Real external I/O (a DB ping) worth faking in tests -- unlike
 * process.uptime()/Node version, which are pure runtime reads the
 * use-case can call directly without an interface. */
export interface IHealthCheckService {
  isDatabaseHealthy(): Promise<boolean>;
}
