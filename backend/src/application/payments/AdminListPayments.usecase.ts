import { IPaymentRepository } from "@/domain/repositories/IPaymentRepository";
import { IRefundRepository } from "@/domain/repositories/IRefundRepository";

export interface AdminListPaymentsInput {
  page: number;
  pageSize: number;
}

export class AdminListPaymentsUseCase {
  constructor(private readonly paymentRepo: IPaymentRepository) {}

  async execute(input: AdminListPaymentsInput) {
    const { items, total } = await this.paymentRepo.listAll(input.page, input.pageSize);
    return { items, total, page: input.page, pageSize: input.pageSize };
  }
}

export class AdminListRefundsForPaymentUseCase {
  constructor(private readonly refundRepo: IRefundRepository) {}

  async execute(paymentId: string) {
    return this.refundRepo.listForPayment(paymentId);
  }
}
