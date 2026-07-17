import { Request, Response } from "express";
import { z } from "zod";
import { AdminRefundPaymentUseCase } from "@/application/payments/AdminRefundPayment.usecase";
import {
  AdminListPaymentsUseCase,
  AdminListRefundsForPaymentUseCase,
} from "@/application/payments/AdminListPayments.usecase";
import { UnauthorizedError } from "@/domain/errors/AppError";
import { paymentHistoryQuerySchema, adminRefundPaymentSchema } from "@/interfaces/http/validators/payment.schemas";

export class AdminPaymentController {
  constructor(
    private readonly adminListPayments: AdminListPaymentsUseCase,
    private readonly adminListRefundsForPayment: AdminListRefundsForPaymentUseCase,
    private readonly adminRefundPayment: AdminRefundPaymentUseCase,
  ) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as z.infer<typeof paymentHistoryQuerySchema>;
    const result = await this.adminListPayments.execute(query);
    res.status(200).json(result);
  };

  refunds = async (req: Request, res: Response): Promise<void> => {
    const result = await this.adminListRefundsForPayment.execute(req.params.id);
    res.status(200).json({ items: result });
  };

  refund = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof adminRefundPaymentSchema>;
    const result = await this.adminRefundPayment.execute({
      paymentId: req.params.id,
      adminUserId: req.user.sub,
      ...body,
    });
    res.status(200).json(result);
  };
}
