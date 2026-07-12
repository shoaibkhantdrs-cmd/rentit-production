export interface PropertyLocation {
  id: string;
  propertyId: string;
  addressLine: string;
  city: string;
  locality: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: number;
  longitude: number;
  formattedAddress: string | null;
  placeId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NewPropertyLocation = Omit<
  PropertyLocation,
  "id" | "createdAt" | "updatedAt"
>;
