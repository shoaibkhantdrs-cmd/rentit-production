export interface IPropertyFavoriteRepository {
  add(propertyId: string, userId: string): Promise<boolean>; // false if already favorited
  remove(propertyId: string, userId: string): Promise<boolean>; // false if it wasn't favorited
  exists(propertyId: string, userId: string): Promise<boolean>;
  /**
   * Batch equivalent of `exists` -- given a candidate list of property IDs,
   * returns the subset this user has favorited. Used by
   * PropertyDetailLoader.loadMany so a page of N properties needs one
   * favorites query instead of N calls to `exists`.
   */
  listFavoritedPropertyIds(userId: string, propertyIds: string[]): Promise<string[]>;
  listPropertyIdsForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ ids: string[]; total: number }>;
}
