export const ROLE_NAMES = [
  "super_admin",
  "admin",
  "property_owner",
  "customer",
  "moderator",
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

export interface Role {
  id: string;
  name: RoleName | string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  assignedBy: string | null;
  assignedAt: Date;
}
