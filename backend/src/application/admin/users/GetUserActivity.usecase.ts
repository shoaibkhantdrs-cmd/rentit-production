import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IActivityLogRepository } from "@/domain/repositories/IActivityLogRepository";
import { NotFoundError } from "@/domain/errors/AppError";

export interface GetUserActivityInput {
  targetUserId: string;
  page: number;
  pageSize: number;
}

export class GetUserActivityUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly activityLogRepo: IActivityLogRepository,
  ) {}

  async execute(input: GetUserActivityInput) {
    const user = await this.userRepo.findById(input.targetUserId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const result = await this.activityLogRepo.listForUser(input.targetUserId, input.page, input.pageSize);
    return { items: result.items, total: result.total, page: input.page, pageSize: input.pageSize };
  }
}
