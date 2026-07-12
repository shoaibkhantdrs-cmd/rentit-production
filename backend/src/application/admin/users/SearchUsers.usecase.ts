import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { toPublicUser, User } from "@/domain/entities/User";

export interface SearchUsersInput {
  query?: string;
  status?: User["status"];
  role?: string;
  page: number;
  pageSize: number;
}

export class SearchUsersUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(input: SearchUsersInput) {
    const result = await this.userRepo.search(
      { query: input.query, status: input.status, role: input.role },
      input.page,
      input.pageSize,
    );

    return {
      items: result.items.map(({ user, roles }) => toPublicUser(user, roles)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}
