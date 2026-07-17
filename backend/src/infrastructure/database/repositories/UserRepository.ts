import { Pool } from "pg";
import {
  IUserRepository,
  UserSearchFilters,
  UserSearchResult,
  UserUpdatePatch,
} from "@/domain/repositories/IUserRepository";
import { NewUser, User } from "@/domain/entities/User";

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  password_hash: string | null;
  status: User["status"];
  email_verified_at: Date | null;
  phone_verified_at: Date | null;
  identity_verified_at: Date | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

function toEntity(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    passwordHash: row.password_hash,
    status: row.status,
    emailVerifiedAt: row.email_verified_at,
    phoneVerifiedAt: row.phone_verified_at,
    identityVerifiedAt: row.identity_verified_at,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class UserRepository implements IUserRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  // Regression fix (RC1 QA): this used to filter `deleted_at IS NULL`,
  // while `findById` above (the single-item method this batches) does not.
  // PropertyDetailLoader.loadMany() documents itself as producing a
  // "byte-for-byte identical" shape to calling load() per item -- with the
  // filter, a property owned by a soft-deleted user showed the real owner
  // via the single-item path (PropertyDetailsPage) but `owner: null` via
  // the batched path (Favorites/MyProperties/RecentlyViewed/
  // Recommendations). Dropping the filter here (rather than adding it to
  // findById, which is used far more broadly, including admin flows that
  // intentionally need to see soft-deleted users) matches the narrower,
  // already-correct scope of this specific N+1 fix.
  async findManyByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    const result = await this.pool.query<UserRow>(
      "SELECT * FROM users WHERE id = ANY($1::uuid[])",
      [ids],
    );
    return result.rows.map(toEntity);
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      "SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL",
      [email],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async findByPhone(phone: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      "SELECT * FROM users WHERE phone = $1 AND deleted_at IS NULL",
      [phone],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async create(data: NewUser): Promise<User> {
    const result = await this.pool.query<UserRow>(
      `INSERT INTO users (name, email, phone, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.name, data.email, data.phone ?? null, data.passwordHash ?? null],
    );
    return toEntity(result.rows[0]);
  }

  async update(id: string, patch: UserUpdatePatch): Promise<User> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    const columnMap: Record<string, unknown> = {
      name: patch.name,
      phone: patch.phone,
      password_hash: patch.passwordHash,
      status: patch.status,
      email_verified_at: patch.emailVerifiedAt,
      phone_verified_at: patch.phoneVerifiedAt,
      identity_verified_at: patch.identityVerifiedAt,
      last_login_at: patch.lastLoginAt,
    };

    for (const [column, value] of Object.entries(columnMap)) {
      if (value !== undefined) {
        fields.push(`${column} = $${i}`);
        values.push(value);
        i += 1;
      }
    }

    if (fields.length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error(`User ${id} not found`);
      return existing;
    }

    values.push(id);
    const result = await this.pool.query<UserRow>(
      `UPDATE users SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
      values,
    );

    if (!result.rows[0]) {
      throw new Error(`User ${id} not found`);
    }

    return toEntity(result.rows[0]);
  }

  async softDelete(id: string): Promise<void> {
    await this.pool.query("UPDATE users SET deleted_at = now() WHERE id = $1", [id]);
  }

  async search(filters: UserSearchFilters, page: number, pageSize: number): Promise<UserSearchResult> {
    const conditions: string[] = ["u.deleted_at IS NULL"];
    const values: unknown[] = [];
    let i = 1;

    if (filters.query) {
      conditions.push(`(u.name ILIKE $${i} OR u.email ILIKE $${i} OR u.phone ILIKE $${i})`);
      values.push(`%${filters.query}%`);
      i += 1;
    }
    if (filters.status) {
      conditions.push(`u.status = $${i}`);
      values.push(filters.status);
      i += 1;
    }
    if (filters.role) {
      conditions.push(
        `EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id AND r.name = $${i})`,
      );
      values.push(filters.role);
      i += 1;
    }

    const whereClause = conditions.join(" AND ");
    const offset = (page - 1) * pageSize;

    const [itemsResult, countResult] = await Promise.all([
      this.pool.query<UserRow>(
        `SELECT u.* FROM users u WHERE ${whereClause} ORDER BY u.created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
        [...values, pageSize, offset],
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*) FROM users u WHERE ${whereClause}`,
        values,
      ),
    ]);

    const users = itemsResult.rows.map(toEntity);
    const ids = users.map((u) => u.id);

    const rolesResult = ids.length
      ? await this.pool.query<{ user_id: string; name: string }>(
          `SELECT ur.user_id, r.name FROM user_roles ur
           JOIN roles r ON r.id = ur.role_id
           WHERE ur.user_id = ANY($1::uuid[])`,
          [ids],
        )
      : { rows: [] as { user_id: string; name: string }[] };

    const rolesByUserId = new Map<string, string[]>();
    for (const row of rolesResult.rows) {
      const list = rolesByUserId.get(row.user_id) ?? [];
      list.push(row.name);
      rolesByUserId.set(row.user_id, list);
    }

    return {
      items: users.map((user) => ({ user, roles: rolesByUserId.get(user.id) ?? [] })),
      total: parseInt(countResult.rows[0].count, 10),
      page,
      pageSize,
    };
  }

  async countAll(): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      "SELECT COUNT(*) FROM users WHERE deleted_at IS NULL",
    );
    return parseInt(result.rows[0].count, 10);
  }

  async countByStatus(status: User["status"]): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      "SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND status = $1",
      [status],
    );
    return parseInt(result.rows[0].count, 10);
  }

  async countCreatedBetween(from: Date, to: Date): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      "SELECT COUNT(*) FROM users WHERE created_at >= $1 AND created_at < $2",
      [from, to],
    );
    return parseInt(result.rows[0].count, 10);
  }
}
