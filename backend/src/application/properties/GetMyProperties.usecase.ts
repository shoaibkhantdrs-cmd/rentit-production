import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";
import { PropertyDetailLoader } from "./shared/PropertyDetailLoader";

export interface GetMyPropertiesInput {
  ownerId: string;
  page: number;
  pageSize: number;
}

export class GetMyPropertiesUseCase {
  constructor(
    private readonly propertyRepo: IPropertyRepository,
    private readonly detailLoader: PropertyDetailLoader,
  ) {}

  async execute(input: GetMyPropertiesInput) {
    const { items, total } = await this.propertyRepo.findByOwner(
      input.ownerId,
      input.page,
      input.pageSize,
    );

    const details = await Promise.all(items.map((p) => this.detailLoader.load(p, input.ownerId)));

    return { items: details, total, page: input.page, pageSize: input.pageSize };
  }
}
