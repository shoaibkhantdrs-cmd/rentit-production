import { IPaymentGateway } from "@/domain/services/IPaymentGateway";
import { IWebhookEventRepository } from "@/domain/repositories/IWebhookEventRepository";
import { IPaymentOrderRepository } from "@/domain/repositories/IPaymentOrderRepository";
import { IPaymentRepository } from "@/domain/repositories/IPaymentRepository";
import { IRefundRepository } from "@/domain/repositories/IRefundRepository";
import { IInvoiceRepository } from "@/domain/repositories/IInvoiceRepository";
import { PaymentActivator } from "@/application/payments/shared/PaymentActivator";
import { UnauthorizedError } from "@/domain/errors/AppError";

// Matches pino's real call signature (mergingObject first, message
// second) rather than the more common `(message, meta)` shape, so the
// real logger can be passed straight through from container.ts and
// fields actually get merged into structured output instead of being
// silently used as util.format interpolation args.
export interface WebhookLogger {
  warn(mergingObject: unknown, message: string): void;
  error(mergingObject: unknown, message: string): void;
}

export interface HandlePaymentWebhookResult {
  duplicate: boolean;
  eventType: string;
}

/**
 * One implementation shared by both gateways -- it depends only on
 * IPaymentGateway, so "what a webhook does once verified" isn't
 * duplicated per provider. server wiring creates two instances of this
 * class in container.ts, one per concrete gateway (see
 * HandleRazorpayWebhook / HandleStripeWebhook there).
 *
 * Idempotency: every call is safe to retry. A redelivered webhook either
 * (a) fails the webhook_events unique insert and returns early as
 * `duplicate: true`, or (b) finds the payment_order already in a terminal
 * status and treats it as already-handled. Neither path double-activates
 * a purchase or double-writes an invoice.
 */
export class HandlePaymentWebhookUseCase {
  constructor(
    private readonly gateway: IPaymentGateway,
    private readonly webhookEventRepo: IWebhookEventRepository,
    private readonly paymentOrderRepo: IPaymentOrderRepository,
    private readonly paymentRepo: IPaymentRepository,
    private readonly refundRepo: IRefundRepository,
    private readonly invoiceRepo: IInvoiceRepository,
    private readonly paymentActivator: PaymentActivator,
    private readonly logger: WebhookLogger,
  ) {}

  async execute(rawBody: Buffer, signatureHeader: string | undefined): Promise<HandlePaymentWebhookResult> {
    if (!this.gateway.verifyWebhookSignature(rawBody, signatureHeader)) {
      throw new UnauthorizedError("Invalid webhook signature");
    }

    const event = this.gateway.parseWebhookEvent(rawBody);

    const stored = await this.webhookEventRepo.createIfNew({
      gateway: this.gateway.name,
      eventId: event.eventId,
      eventType: event.eventType,
      payload: event.raw,
    });

    if (!stored) {
      // Already recorded -- a gateway retry. Ack without reprocessing.
      return { duplicate: true, eventType: event.eventType };
    }

    try {
      await this.handleEvent(event);
      await this.webhookEventRepo.markProcessed(stored.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.webhookEventRepo.markFailed(stored.id, message);
      this.logger.error(
        { gateway: this.gateway.name, eventId: event.eventId, error: message },
        "Webhook processing failed",
      );
      throw err;
    }

    return { duplicate: false, eventType: event.eventType };
  }

  private async handleEvent(
    event: ReturnType<IPaymentGateway["parseWebhookEvent"]>,
  ): Promise<void> {
    switch (event.eventType) {
      case "payment.succeeded":
        await this.handlePaymentSucceeded(event);
        return;
      case "payment.failed":
        await this.handlePaymentFailed(event);
        return;
      case "refund.processed":
      case "refund.failed":
        await this.handleRefundEvent(event);
        return;
      default:
        this.logger.warn(
          { gateway: this.gateway.name, eventType: event.eventType },
          "Unhandled webhook event type",
        );
    }
  }

  private async handlePaymentSucceeded(
    event: ReturnType<IPaymentGateway["parseWebhookEvent"]>,
  ): Promise<void> {
    if (!event.gatewayOrderId || !event.gatewayPaymentId) {
      throw new Error("payment.succeeded event missing order/payment id");
    }

    const order = await this.paymentOrderRepo.findByGatewayOrderId(this.gateway.name, event.gatewayOrderId);
    if (!order) {
      throw new Error(`No payment_order found for gateway order ${event.gatewayOrderId}`);
    }

    if (order.status === "paid") {
      // Already processed by an earlier delivery of a *different* event id
      // for the same order (some gateways send more than one event per
      // charge) -- nothing left to do.
      return;
    }

    const payment = await this.paymentRepo.create({
      paymentOrderId: order.id,
      gateway: this.gateway.name,
      gatewayPaymentId: event.gatewayPaymentId,
      amount: event.amount ?? order.amount,
      currency: event.currency ?? order.currency,
      status: "succeeded",
      method: event.method,
      rawEvent: event.raw,
    });

    await this.paymentOrderRepo.updateStatus(order.id, "paid");
    await this.paymentActivator.activate(order.purchasableType, order.purchasableId);

    const sequence = (await this.invoiceRepo.countAll()) + 1;
    const invoiceNumber = `INV-${new Date().getUTCFullYear()}-${String(sequence).padStart(6, "0")}`;
    await this.invoiceRepo.create({
      paymentId: payment.id,
      userId: order.userId,
      invoiceNumber,
      amount: payment.amount,
      currency: payment.currency,
      lineDescription:
        order.purpose === "listing_boost" ? "Listing boost purchase" : "Premium plan subscription",
    });
  }

  private async handlePaymentFailed(
    event: ReturnType<IPaymentGateway["parseWebhookEvent"]>,
  ): Promise<void> {
    if (!event.gatewayOrderId) return;
    const order = await this.paymentOrderRepo.findByGatewayOrderId(this.gateway.name, event.gatewayOrderId);
    if (!order || order.status === "paid") return;
    await this.paymentOrderRepo.updateStatus(order.id, "failed");
  }

  private async handleRefundEvent(
    event: ReturnType<IPaymentGateway["parseWebhookEvent"]>,
  ): Promise<void> {
    if (!event.gatewayPaymentId || !event.gatewayRefundId) return;

    const payment = await this.paymentRepo.findByGatewayPaymentId(this.gateway.name, event.gatewayPaymentId);
    if (!payment) {
      throw new Error(`No payment found for gateway payment ${event.gatewayPaymentId}`);
    }

    const existing = await this.refundRepo.findByGatewayRefundId(payment.id, event.gatewayRefundId);
    const status = event.eventType === "refund.processed" ? "processed" : "failed";

    if (existing) {
      await this.refundRepo.updateStatus(existing.id, status);
    } else {
      await this.refundRepo.create({
        paymentId: payment.id,
        gatewayRefundId: event.gatewayRefundId,
        amount: event.amount ?? payment.amount,
        status,
        reason: null,
        initiatedBy: null,
      });
    }

    if (status === "processed") {
      const refundedAmount = event.amount ?? payment.amount;
      const newStatus = refundedAmount >= payment.amount ? "refunded" : "partially_refunded";
      await this.paymentRepo.updateStatus(payment.id, newStatus);
    }
  }
}
