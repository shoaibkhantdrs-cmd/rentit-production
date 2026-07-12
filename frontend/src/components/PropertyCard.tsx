import { Link } from "react-router-dom";
import { PropertyDetail, PropertyStatus, PropertySummary } from "@/api/types";

function StatusBadge({ status }: { status: PropertyStatus }) {
  return <span className={`badge badge--${status}`}>{status.replace("_", " ")}</span>;
}

function formatRent(amount: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount);
}

/**
 * Renders either a search-result PropertySummary or a full PropertyDetail
 * (used by My Properties / Favorites, which return full detail DTOs) with
 * a single shared card layout -- reused across Home, Search, My
 * Properties, and Favorites pages.
 */
export function PropertyCard({ property }: { property: PropertySummary | PropertyDetail }) {
  const isDetail = "images" in property;
  const imageUrl = isDetail
    ? property.images.find((img) => img.isPrimary)?.url ?? property.images[0]?.url ?? null
    : property.primaryImageUrl;
  const city = isDetail ? property.location?.city ?? null : property.city;
  const locality = isDetail ? property.location?.locality ?? null : property.locality;

  return (
    <Link to={`/properties/${property.id}`} className="card property-card">
      <div className="property-card__image">
        {imageUrl ? <img src={imageUrl} alt={property.title} loading="lazy" /> : <span>No photo yet</span>}
      </div>
      <div className="property-card__body">
        <div className="property-card__footer" style={{ marginTop: 0, paddingTop: 0 }}>
          <StatusBadge status={property.status} />
          {property.distanceKm !== null ? (
            <span className="property-card__location">{property.distanceKm.toFixed(1)} km away</span>
          ) : null}
        </div>
        <h3 className="property-card__title">{property.title}</h3>
        <div className="property-card__location">
          {[locality, city].filter(Boolean).join(", ") || "Location not set"}
        </div>
        <div className="property-card__rent">₹{formatRent(property.rentAmount)}/mo</div>
        <div className="property-card__meta">
          <span>{property.bedrooms} bed</span>
          <span>{property.bathrooms} bath</span>
          <span>{property.areaSqft} sqft</span>
        </div>
        <div className="property-card__footer">
          <span className="field-hint">{property.viewCount} views</span>
          <span className="field-hint">{property.favoriteCount} favorites</span>
        </div>
      </div>
    </Link>
  );
}
