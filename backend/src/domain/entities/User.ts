export type UserStatus = "active" | "suspended" | "banned";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  passwordHash: string | null;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  /** Phase 4 (Owner Verification) addition -- set when an admin approves an identity_verifications row. */
  identityVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type NewUser = Pick<User, "name" | "email"> &
  Partial<Pick<User, "phone" | "passwordHash">>;

/** Fields a client is ever allowed to see. Never spread a raw User onto a response. */
export function toPublicUser(user: User, roles: string[]) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    status: user.status,
    emailVerified: user.emailVerifiedAt !== null,
    phoneVerified: user.phoneVerifiedAt !== null,
    identityVerified: user.identityVerifiedAt !== null,
    roles,
    createdAt: user.createdAt,
  };
}
