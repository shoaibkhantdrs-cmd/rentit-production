import { IUserReportRepository } from "@/domain/repositories/IUserReportRepository";
import { UserReportStatus } from "@/domain/entities/UserReport";

export interface ListUserReportsInput {
  status?: UserReportStatus;
  page: number;
  pageSize: number;
}

export class ListUserReportsUseCase {
  constructor(private readonly reportRepo: IUserReportRepository) {}

  async execute(input: ListUserReportsInput) {
    const result = await this.reportRepo.list({ status: input.status }, input.page, input.pageSize);
    return { items: result.items, total: result.total, page: input.page, pageSize: input.pageSize };
  }
}
