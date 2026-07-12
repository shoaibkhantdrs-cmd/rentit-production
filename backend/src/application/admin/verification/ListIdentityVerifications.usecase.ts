import { IIdentityVerificationRepository } from "@/domain/repositories/IIdentityVerificationRepository";
import { IdentityVerificationStatus } from "@/domain/entities/IdentityVerification";

export interface ListIdentityVerificationsInput {
  status?: IdentityVerificationStatus;
  page: number;
  pageSize: number;
}

export class ListIdentityVerificationsUseCase {
  constructor(private readonly verificationRepo: IIdentityVerificationRepository) {}

  async execute(input: ListIdentityVerificationsInput) {
    const result = await this.verificationRepo.list({ status: input.status }, input.page, input.pageSize);
    return { items: result.items, total: result.total, page: input.page, pageSize: input.pageSize };
  }
}
