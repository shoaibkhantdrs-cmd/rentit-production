import { PropertyCategory } from "@/domain/entities/PropertyCategory";

export interface IPropertyCategoryRepository {
  findById(id: string): Promise<PropertyCategory | null>;
  findBySlug(slug: string): Promise<PropertyCategory | null>;
  findAll(): Promise<PropertyCategory[]>;
}
