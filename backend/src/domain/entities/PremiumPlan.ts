export interface PremiumPlan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceAmount: number; // smallest currency unit (paise/cents)
  currency: string;
  durationDays: number;
  features: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
