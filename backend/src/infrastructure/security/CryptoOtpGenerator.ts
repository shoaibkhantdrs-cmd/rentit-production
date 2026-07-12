import { randomInt } from "node:crypto";
import { IOtpGenerator } from "@/domain/services/IOtpGenerator";

export class CryptoOtpGenerator implements IOtpGenerator {
  generate(length: number): string {
    const max = 10 ** length;
    const value = randomInt(0, max); // cryptographically strong, unlike Math.random()
    return value.toString().padStart(length, "0");
  }
}
