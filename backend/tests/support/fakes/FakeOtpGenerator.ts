import { IOtpGenerator } from "@/domain/services/IOtpGenerator";

/** Returns a fixed, predictable code so tests can assert on it directly. */
export class FakeOtpGenerator implements IOtpGenerator {
  constructor(private readonly fixedCode: string = "123456") {}

  generate(_length: number): string {
    return this.fixedCode;
  }
}
