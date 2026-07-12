import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";
import { NotFoundError, ValidationError } from "@/domain/errors/AppError";
import { Property } from "@/domain/entities/Property";
import { User } from "@/domain/entities/User";

export async function resolvePropertyAndOwner(
  propertyRepo: IPropertyRepository,
  userRepo: IUserRepository,
  propertyId: string,
): Promise<{ property: Property; owner: User }> {
  const property = await propertyRepo.findById(propertyId);
  if (!property || property.deletedAt) {
    throw new NotFoundError("Property not found");
  }
  const owner = await userRepo.findById(property.ownerId);
  if (!owner) {
    throw new NotFoundError("Property owner not found");
  }
  if (!owner.phone) {
    throw new ValidationError("This owner has not listed a phone number for WhatsApp contact");
  }
  return { property, owner };
}
