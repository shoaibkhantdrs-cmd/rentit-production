import { Property } from "@/domain/entities/Property";
import { PropertyLocation } from "@/domain/entities/PropertyLocation";
import { PropertyImage } from "@/domain/entities/PropertyImage";

export interface PropertyDetailDTO {
  id: string;
  title: string;
  description: string;
  propertyType: Property["propertyType"];
  status: Property["status"];
  rentAmount: number;
  securityDeposit: number;
  areaSqft: number;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  floorNumber: number | null;
  totalFloors: number | null;
  facing: Property["facing"];
  furnishedStatus: Property["furnishedStatus"];
  availableFrom: string;
  viewCount: number;
  favoriteCount: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; name: string; slug: string } | null;
  owner: { id: string; name: string } | null;
  location: {
    addressLine: string;
    city: string;
    locality: string | null;
    state: string | null;
    country: string | null;
    postalCode: string | null;
    latitude: number;
    longitude: number;
    formattedAddress: string | null;
  } | null;
  images: Array<{
    id: string;
    url: string;
    isPrimary: boolean;
    sortOrder: number;
    width: number | null;
    height: number | null;
  }>;
  features: string[];
  isFavorited: boolean | null; // null when the viewer is anonymous
  distanceKm: number | null;
}

export interface PropertySummaryDTO {
  id: string;
  title: string;
  propertyType: Property["propertyType"];
  status: Property["status"];
  rentAmount: number;
  areaSqft: number;
  bedrooms: number;
  bathrooms: number;
  furnishedStatus: Property["furnishedStatus"];
  availableFrom: string;
  viewCount: number;
  favoriteCount: number;
  createdAt: Date;
  city: string | null;
  locality: string | null;
  latitude: number | null;
  longitude: number | null;
  primaryImageUrl: string | null;
  categoryName: string | null;
  distanceKm: number | null;
}
