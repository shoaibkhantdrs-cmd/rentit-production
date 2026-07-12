export interface IPropertyFavoriteRepository {
  add(propertyId: string, userId: string): Promise<boolean>; // false if already favorited
  remove(propertyId: string, userId: string): Promise<boolean>; // false if it wasn't favorited
  exists(propertyId: string, userId: string): Promise<boolean>;
  listPropertyIdsForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ ids: string[]; total: number }>;
}
