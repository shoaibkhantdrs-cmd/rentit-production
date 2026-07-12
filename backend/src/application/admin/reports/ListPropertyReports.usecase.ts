import { IPropertyReportRepository } from "@/domain/repositories/IPropertyReportRepository";
import { PropertyReportStatus } from "@/domain/entities/PropertyReport";

export interface ListPropertyReportsInput {
  status?: PropertyReportStatus;
  page: number;
  pageSize: number;
}

export class ListPropertyReportsUseCase {
  constructor(private readonly reportRepo: IPropertyReportRepository) {}

  async execute(input: ListPropertyReportsInput) {
    const result = await this.reportRepo.list({ status: input.status }, input.page, input.pageSize);
    return { items: result.items, total: result.total, page: input.page, pageSize: input.pageSize };
  }
}
