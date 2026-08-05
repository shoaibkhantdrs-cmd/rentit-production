import { Property } from "@/domain/entities/Property";

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
  owner: {
    id: string;
    name: string;
    identityVerified: boolean;
    /** Always present when the owner has a phone on file, e.g. "+91 98XXXX3210" -- safe to show to anonymous visitors. */
    maskedPhone: string | null;
    /** Only populated when the viewer is authenticated (viewerUserId truthy) -- normalized digits with country code, e.g. "919876543210". Null for anonymous requests even if the owner has a phone. */
    phone: string | null;
    /** Only populated when the viewer is authenticated -- same reasoning as `phone`. */
    email: string | null;
  } | null;
  location: {
    addressLine: string;
    city: string;
    locality: string | null;
    district: string | null;
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
