import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";
import { IPropertyFavoriteRepository } from "@/domain/repositories/IPropertyFavoriteRepository";
import { PropertyDetailLoader } from "./shared/PropertyDetailLoader";

export interface GetMyFavoritesInput {
  userId: string;
  page: number;
  pageSize: number;
}

export class GetMyFavoritesUseCase {
  constructor(
    private readonly propertyRepo: IPropertyRepository,
    private readonly favoriteRepo: IPropertyFavoriteRepository,
    private readonly detailLoader: PropertyDetailLoader,
  ) {}

  async execute(input: GetMyFavoritesInput) {
    const { ids, total } = await this.favoriteRepo.listPropertyIdsForUser(
      input.userId,
      input.page,
      input.pageSize,
    );

    const properties = await this.propertyRepo.findManyByIds(ids);
    const byId = new Map(properties.map((p) => [p.id, p]));
    // Preserve the favorited-order returned by the repository (most
    // recently favorited first), not whatever order findManyByIds happens
    // to return.
    const ordered = ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));

    const details = await this.detailLoader.loadMany(ordered, input.userId);

    return { items: details, total, page: input.page, pageSize: input.pageSize };
  }
}
