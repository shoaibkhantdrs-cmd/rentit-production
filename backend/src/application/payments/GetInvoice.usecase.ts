import { IInvoiceRepository } from "@/domain/repositories/IInvoiceRepository";
import { Invoice } from "@/domain/entities/Invoice";
import { ForbiddenError, NotFoundError } from "@/domain/errors/AppError";

export interface GetInvoiceInput {
  invoiceId: string;
  requesterId: string;
}

export class GetInvoiceUseCase {
  constructor(private readonly invoiceRepo: IInvoiceRepository) {}

  async execute(input: GetInvoiceInput): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice) throw new NotFoundError("Invoice not found");
    if (invoice.userId !== input.requesterId) {
      throw new ForbiddenError("This invoice does not belong to you");
    }
    return invoice;
  }
}

export interface ListMyInvoicesInput {
  userId: string;
  page: number;
  pageSize: number;
}

export class ListMyInvoicesUseCase {
  constructor(private readonly invoiceRepo: IInvoiceRepository) {}

  async execute(input: ListMyInvoicesInput) {
    const { items, total } = await this.invoiceRepo.listForUser(
      input.userId,
      input.page,
      input.pageSize,
    );
    return { items, total, page: input.page, pageSize: input.pageSize };
  }
}
