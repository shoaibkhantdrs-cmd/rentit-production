import bcrypt from "bcrypt";
import { IHasher } from "@/domain/services/IHasher";

export class BcryptHasher implements IHasher {
  constructor(private readonly saltRounds: number) {}

  async hash(plainText: string): Promise<string> {
    return bcrypt.hash(plainText, this.saltRounds);
  }

  async verify(plainText: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plainText, hash);
  }
}
