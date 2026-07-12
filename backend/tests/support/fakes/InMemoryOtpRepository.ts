import { IOtpRepository, NewOtpInput } from "@/domain/repositories/IOtpRepository";
import { OtpCode, OtpPurpose } from "@/domain/entities/OtpCode";
import { FakeClock } from "./FakeClock";
import { newId } from "./ids";

export class InMemoryOtpRepository implements IOtpRepository {
  public readonly codes = new Map<string, OtpCode>();

  constructor(private readonly clock: FakeClock) {}

  async create(input: NewOtpInput): Promise<OtpCode> {
    const now = this.clock.now();
    const code: OtpCode = {
      id: newId(),
      userId: input.userId,
      purpose: input.purpose,
      channel: input.channel,
      codeHash: input.codeHash,
      attempts: 0,
      maxAttempts: input.maxAttempts,
      expiresAt: input.expiresAt,
      consumedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.codes.set(code.id, code);
    return code;
  }

  async findActive(userId: string, purpose: OtpPurpose): Promise<OtpCode | null> {
    const now = this.clock.now().getTime();
    const candidates = [...this.codes.values()]
      .filter(
        (c) => c.userId === userId && c.purpose === purpose && !c.consumedAt && c.expiresAt.getTime() > now,
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return candidates[0] ?? null;
  }

  async incrementAttempts(id: string): Promise<OtpCode> {
    const existing = this.codes.get(id);
    if (!existing) throw new Error(`OTP ${id} not found`);
    const updated = { ...existing, attempts: existing.attempts + 1, updatedAt: this.clock.now() };
    this.codes.set(id, updated);
    return updated;
  }

  async consume(id: string): Promise<void> {
    const existing = this.codes.get(id);
    if (!existing) return;
    this.codes.set(id, { ...existing, consumedAt: this.clock.now(), updatedAt: this.clock.now() });
  }
}
