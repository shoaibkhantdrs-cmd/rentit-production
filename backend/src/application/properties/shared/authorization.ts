import { Property } from "@/domain/entities/Property";
import { ForbiddenError } from "@/domain/errors/AppError";

export const PROPERTY_ADMIN_ROLES = ["admin", "super_admin"] as const;

export function isOwnerOrAdmin(
  property: Property,
  requesterId: string,
  requesterRoles: string[],
): boolean {
  return (
    property.ownerId === requesterId ||
    requesterRoles.some((role) => (PROPERTY_ADMIN_ROLES as readonly string[]).includes(role))
  );
}

export function assertOwnerOrAdmin(
  property: Property,
  requesterId: string,
  requesterRoles: string[],
): void {
  if (!isOwnerOrAdmin(property, requesterId, requesterRoles)) {
    throw new ForbiddenError("You do not have permission to manage this property");
  }
}
