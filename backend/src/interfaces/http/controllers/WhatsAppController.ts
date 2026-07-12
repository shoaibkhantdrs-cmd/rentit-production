import { Request, Response } from "express";
import { z } from "zod";
import { ContactOwnerUseCase } from "@/application/whatsapp/ContactOwner.usecase";
import { SharePropertyUseCase } from "@/application/whatsapp/ShareProperty.usecase";
import { SendInquiryUseCase } from "@/application/whatsapp/SendInquiry.usecase";
import { UnauthorizedError } from "@/domain/errors/AppError";
import {
  contactOwnerSchema,
  sharePropertySchema,
  sendInquirySchema,
} from "@/interfaces/http/validators/whatsapp.schemas";

export class WhatsAppController {
  constructor(
    private readonly contactOwner: ContactOwnerUseCase,
    private readonly shareProperty: SharePropertyUseCase,
    private readonly sendInquiry: SendInquiryUseCase,
    private readonly frontendBaseUrl: string,
  ) {}

  contact = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof contactOwnerSchema>;
    await this.contactOwner.execute({ propertyId: body.propertyId, requesterId: req.user.sub });
    res.status(200).json({ message: "The owner has been notified on WhatsApp." });
  };

  share = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as z.infer<typeof sharePropertySchema>;
    await this.shareProperty.execute({
      propertyId: body.propertyId,
      toPhone: body.toPhone,
      frontendBaseUrl: this.frontendBaseUrl,
    });
    res.status(200).json({ message: "Shared via WhatsApp." });
  };

  inquiry = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const body = req.body as z.infer<typeof sendInquirySchema>;
    await this.sendInquiry.execute({
      propertyId: body.propertyId,
      requesterId: req.user.sub,
      message: body.message,
    });
    res.status(200).json({ message: "Inquiry sent via WhatsApp." });
  };
}
