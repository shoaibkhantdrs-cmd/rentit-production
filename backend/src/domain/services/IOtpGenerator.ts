export interface IOtpGenerator {
  /** Numeric, zero-padded, fixed-length code (e.g. "042917"). */
  generate(length: number): string;
}
