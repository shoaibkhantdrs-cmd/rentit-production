/**
 * Every use-case asks the clock for "now" instead of calling `new Date()`
 * directly, so tests can inject a fixed/fake clock instead of relying on
 * wall-clock time (critical for testing expiry logic deterministically).
 */
export interface IClock {
  now(): Date;
}
