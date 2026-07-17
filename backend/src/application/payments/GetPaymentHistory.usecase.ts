import { IPaymentRepository } from "@/domain/repositories/IPaymentRepository";
import { Payment } from "@/domain/entities/Payment";

export interface GetPaymentHistoryInput {
  userId: string;
  page: number;
  pageSize: number;
}

export interface GetPaymentHistoryResult {
  items: Payment[];
  total: number;
  page: number;
  pageSize: number;
}

export class GetPaymentHistoryUseCase {
  constructor(private readonly paymentRepo: IPaymentRepository) {}

  async execute(input: GetPaymentHistoryInput): Promise<GetPaymentHistoryResult> {
    const { items, total } = await this.paymentRepo.listForUser(
      input.userId,
      input.page,
      input.pageSize,
    );
    return { items, total, page: input.page, pageSize: input.pageSize };
  }
}
