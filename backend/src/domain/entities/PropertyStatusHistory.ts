import { PropertyStatus } from "@/domain/entities/Property";

export interface PropertyStatusHistory {
  id: string;
  propertyId: string;
  previousStatus: PropertyStatus | null;
  newStatus: PropertyStatus;
  changedBy: string | null;
  reason: string | null;
  createdAt: Date;
}
