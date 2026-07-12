import {
  IUserRepository,
  UserSearchFilters,
  UserSearchResult,
  UserUpdatePatch,
} from "@/domain/repositories/IUserRepository";
import { NewUser, User } from "@/domain/entities/User";
import { newId } from "./ids";
import { InMemoryUserRoleRepository } from "./InMemoryUserRoleRepository";

export class InMemoryUserRepository implements IUserRepository {
  public readonly users = new Map<string, User>();

  /** Optional -- only needed for search()'s role filter / roles-per-user
   * listing. Set via setUserRoleRepo() after both fakes exist (mirrors the
   * property/location fake wiring in buildPropertyTestContainer). */
  private userRoleRepo: InMemoryUserRoleRepository | null = null;

  setUserRoleRepo(repo: InMemoryUserRoleRepository): void {
    this.userRoleRepo = repo;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email && !user.deletedAt) return user;
    }
    return null;
  }

  async findByPhone(phone: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.phone === phone && !user.deletedAt) return user;
    }
    return null;
  }

  async create(data: NewUser): Promise<User> {
    const now = new Date();
    const user: User = {
      id: newId(),
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      passwordHash: data.passwordHash ?? null,
      status: "active",
      emailVerifiedAt: null,
      phoneVerifiedAt: null,
      identityVerifiedAt: null,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.users.set(user.id, user);
    return user;
  }

  async update(id: string, patch: UserUpdatePatch): Promise<User> {
    const existing = this.users.get(id);
    if (!existing) throw new Error(`User ${id} not found`);
    const updated: User = {
      ...existing,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      ...(patch.passwordHash !== undefined ? { passwordHash: patch.passwordHash } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.emailVerifiedAt !== undefined ? { emailVerifiedAt: patch.emailVerifiedAt } : {}),
      ...(patch.phoneVerifiedAt !== undefined ? { phoneVerifiedAt: patch.phoneVerifiedAt } : {}),
      ...(patch.identityVerifiedAt !== undefined ? { identityVerifiedAt: patch.identityVerifiedAt } : {}),
      ...(patch.lastLoginAt !== undefined ? { lastLoginAt: patch.lastLoginAt } : {}),
      updatedAt: new Date(),
    };
    this.users.set(id, updated);
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const existing = this.users.get(id);
    if (!existing) return;
    this.users.set(id, { ...existing, deletedAt: new Date() });
  }

  async search(filters: UserSearchFilters, page: number, pageSize: number): Promise<UserSearchResult> {
    let candidates = Array.from(this.users.values()).filter((u) => !u.deletedAt);

    if (filters.query) {
      const needle = filters.query.toLowerCase();
      candidates = candidates.filter(
        (u) =>
          u.name.toLowerCase().includes(needle) ||
          u.email.toLowerCase().includes(needle) ||
          (u.phone?.toLowerCase().includes(needle) ?? false),
      );
    }
    if (filters.status) {
      candidates = candidates.filter((u) => u.status === filters.status);
    }

    let withRoles = await Promise.all(
      candidates.map(async (user) => ({
        user,
        roles: this.userRoleRepo ? await this.userRoleRepo.listRoleNamesForUser(user.id) : [],
      })),
    );

    if (filters.role) {
      withRoles = withRoles.filter((row) => row.roles.includes(filters.role as string));
    }

    withRoles.sort((a, b) => b.user.createdAt.getTime() - a.user.createdAt.getTime());

    const total = withRoles.length;
    const offset = (page - 1) * pageSize;
    const items = withRoles.slice(offset, offset + pageSize);

    return { items, total, page, pageSize };
  }

  async countAll(): Promise<number> {
    return Array.from(this.users.values()).filter((u) => !u.deletedAt).length;
  }

  async countByStatus(status: User["status"]): Promise<number> {
    return Array.from(this.users.values()).filter((u) => !u.deletedAt && u.status === status).length;
  }

  async countCreatedBetween(from: Date, to: Date): Promise<number> {
    return Array.from(this.users.values()).filter(
      (u) => u.createdAt.getTime() >= from.getTime() && u.createdAt.getTime() < to.getTime(),
    ).length;
  }
}
