export interface PropertyView {
  id: string;
  propertyId: string;
  viewerUserId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  viewedAt: Date;
}
