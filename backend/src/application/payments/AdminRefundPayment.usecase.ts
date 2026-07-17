import { IPaymentRepository } from "@/domain/repositories/IPaymentRepository";
import { IRefundRepository } from "@/domain/repositories/IRefundRepository";
import { IPaymentGateway } from "@/domain/services/IPaymentGateway";
import { PaymentGateway as GatewayName } from "@/domain/entities/PaymentOrder";
import { ConflictError, NotFoundError, ValidationError } from "@/domain/errors/AppError";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";

export interface AdminRefundPaymentInput {
  paymentId: string;
  adminUserId: string;
  amount?: number; // defaults to full remaining amount
  reason?: string;
}

export class AdminRefundPaymentUseCase {
  constructor(
    private readonly paymentRepo: IPaymentRepository,
    private readonly refundRepo: IRefundRepository,
    private readonly gateways: Record<GatewayName, IPaymentGateway>,
    private readonly auditLogRepo: IAuditLogRepository,
  ) {}

  async execute(input: AdminRefundPaymentInput) {
    const payment = await this.paymentRepo.findById(input.paymentId);
    if (!payment) throw new NotFoundError("Payment not found");
    if (payment.status === "refunded") {
      throw new ConflictError("This payment has already been fully refunded");
    }
    if (payment.status !== "succeeded" && payment.status !== "partially_refunded") {
      throw new ValidationError("Only a succeeded payment can be refunded");
    }

    // Security/correctness fix (Phase 6 Part 2 audit): the original check
    // here only validated `amount > payment.amount`, which allows
    // over-refunding a payment that's already been partially refunded --
    // e.g. a 1000 payment with 600 already refunded would still accept a
    // second 900 refund (total 1500 > the original charge). The correct
    // ceiling is the amount still outstanding, not the original total.
    const existingRefunds = await this.refundRepo.listForPayment(payment.id);
    const alreadyRefunded = existingRefunds
      .filter((r) => r.status === "processed")
      .reduce((sum, r) => sum + r.amount, 0);
    const remaining = payment.amount - alreadyRefunded;

    const amount = input.amount ?? remaining;
    if (amount <= 0 || amount > remaining) {
      throw new ValidationError(
        `Refund amount must be between 1 and the remaining refundable amount (${remaining})`,
      );
    }

    const gateway = this.gateways[payment.gateway];
    const gatewayRefund = await gateway.createRefund(payment.gatewayPaymentId, amount, input.reason);

    const refund = await this.refundRepo.create({
      paymentId: payment.id,
      gatewayRefundId: gatewayRefund.gatewayRefundId,
      amount,
      status: gatewayRefund.status,
      reason: input.reason ?? null,
      initiatedBy: input.adminUserId,
    });

    if (gatewayRefund.status === "processed") {
      const newStatus = amount >= remaining ? "refunded" : "partially_refunded";
      await this.paymentRepo.updateStatus(payment.id, newStatus);
    }

    await this.auditLogRepo.record({
      userId: input.adminUserId,
      action: "payment.refund",
      entityType: "payment",
      entityId: payment.id,
      metadata: { amount, reason: input.reason ?? null, refundId: refund.id },
    });

    return refund;
  }
}
