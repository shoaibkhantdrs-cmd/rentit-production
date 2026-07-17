import { NewUser, User } from "@/domain/entities/User";

export interface UserUpdatePatch {
  name?: string;
  phone?: string | null;
  passwordHash?: string | null;
  status?: User["status"];
  emailVerifiedAt?: Date | null;
  phoneVerifiedAt?: Date | null;
  identityVerifiedAt?: Date | null;
  lastLoginAt?: Date | null;
}

export interface UserSearchFilters {
  query?: string; // matches name/email/phone, substring, case-insensitive
  status?: User["status"];
  role?: string;
}

export interface UserSearchResultItem {
  user: User;
  roles: string[];
}

export interface UserSearchResult {
  items: UserSearchResultItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  /**
   * Batch lookup by ID -- additive, every existing call site is unaffected.
   * Added to let list-shaped use cases (property detail batching, chat
   * conversation listing) fetch N users in one query instead of looping
   * findById per row.
   */
  findManyByIds(ids: string[]): Promise<User[]>;
  findByEmail(email: string): Promise<User | null>;
  findByPhone(phone: string): Promise<User | null>;
  create(data: NewUser): Promise<User>;
  update(id: string, patch: UserUpdatePatch): Promise<User>;
  softDelete(id: string): Promise<void>;
  /**
   * Admin-facing user list/search (Phase 4 Part 2). Additive to the Phase 2
   * interface -- every existing call site is unaffected by this method's
   * presence.
   */
  search(filters: UserSearchFilters, page: number, pageSize: number): Promise<UserSearchResult>;
  countAll(): Promise<number>;
  countByStatus(status: User["status"]): Promise<number>;
  /** For the admin dashboard's user-growth chart. */
  countCreatedBetween(from: Date, to: Date): Promise<number>;
}
