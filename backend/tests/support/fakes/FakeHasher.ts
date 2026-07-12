import { createHash } from "node:crypto";
import { IHasher } from "@/domain/services/IHasher";

/**
 * Deterministic sha256-based stand-in for BcryptHasher, used only in
 * tests. It satisfies the exact same IHasher contract the real bcrypt
 * implementation does, so every use-case that depends on IHasher is
 * exercised identically either way -- what differs is cost/algorithm,
 * which is BcryptHasher's own concern (and outside what these tests, or
 * this sandbox, can exercise without the real `bcrypt` package installed).
 */
export class FakeHasher implements IHasher {
  async hash(plainText: string): Promise<string> {
    return createHash("sha256").update(plainText).digest("hex");
  }

  async verify(plainText: string, hash: string): Promise<boolean> {
    return (await this.hash(plainText)) === hash;
  }
}
