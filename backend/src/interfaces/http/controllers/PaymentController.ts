import { Request, Response } from "express";
import { z } from "zod";
import { CreateListingBoostOrderUseCase } from "@/application/payments/CreateListingBoostOrder.usecase";
import { CreatePremiumPlanOrderUseCase } from "@/application/payments/CreatePremiumPlanOrder.usecase";
import { ListPremiumPlansUseCase } from "@/application/payments/ListPremiumPlans.usecase";
import { GetPaymentHistoryUseCase } from "@/application/payments/GetPaymentHistory.usecase";
import { GetInvoiceUseCase, ListMyInvoicesUseCase } from "@/application/payments/GetInvoice.usecase";
import { UnauthorizedError } from "@/domain/errors/AppError";
import {
  createListingBoostOrderSchema,
  createPremiumPlanOrderSchema,
  paymentHistoryQuerySchema,
} from "@/interfaces/http/validators/payment.schemas";

export interface PaymentPublicConfig {
  razorpayKeyId: string;
  stripePublishableKey: string;
}

export class PaymentController {
  constructor(
    private readonly createListingBoostOrder: CreateListingBoostOrderUseCase,
    private readonly createPremiumPlanOrder: CreatePremiumPlanOrderUseCase,
    private readonly listPremiumPlans: ListPremiumPlansUseCase,
    private readonly getPaymentHistory: GetPaymentHistoryUseCase,
    private readonly getInvoice: GetInvoiceUseCase,
    private readonly listMyInvoices: ListMyInvoicesUseCase,
    private readonly publicConfig: PaymentPublicConfig,
  ) {}

  // Public, non-secret keys the frontend needs to initialize each
  // gateway's client SDK (Razorpay Checkout.js / Stripe.js) before it can
  // confirm a payment against the order created below. Kept as its own
  // endpoint rather than embedded in every order-creation response so the
  // frontend can initialize the SDK once at app startup instead of after
  // the user has already committed to a specific purchase.
  config = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(this.publicConfig);
  };

  plans = async (_req: Request, res: Response): Promise<void> => {
    const result = await this.listPremiumPlans.execute();
    res.status(200).json({ items: result });
  };

  createBoostOrder = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof createListingBoostOrderSchema>;
    const result = await this.createListingBoostOrder.execute({ userId: req.user.sub, ...body });
    res.status(201).json(result);
  };

  createPlanOrder = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof createPremiumPlanOrderSchema>;
    const result = await this.createPremiumPlanOrder.execute({ userId: req.user.sub, ...body });
    res.status(201).json(result);
  };

  history = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as unknown as z.infer<typeof paymentHistoryQuerySchema>;
    const result = await this.getPaymentHistory.execute({ userId: req.user.sub, ...query });
    res.status(200).json(result);
  };

  invoices = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as unknown as z.infer<typeof paymentHistoryQuerySchema>;
    const result = await this.listMyInvoices.execute({ userId: req.user.sub, ...query });
    res.status(200).json(result);
  };

  getInvoiceById = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const invoice = await this.getInvoice.execute({
      invoiceId: req.params.id,
      requesterId: req.user.sub,
    });
    res.status(200).json(invoice);
  };
}
