import { memo, MouseEvent, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { m, PanInfo } from "framer-motion";
import { Bath, BedDouble, Heart, MapPin, MessageCircle, Phone, Ruler, Scale, Share2, Images } from "lucide-react";
import { PropertyDetail, PropertyStatus, PropertySummary } from "@/api/types";
import { propertiesApi } from "@/api/properties";
import { useAuth } from "@/context/AuthContext";
import { useCompare } from "@/context/CompareContext";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/api/httpClient";
import { formatCurrency } from "@/utils/format";
import { cloudinaryTransform, cloudinarySrcSet } from "@/utils/cloudinaryImage";

function StatusBadge({ status }: { status: PropertyStatus }) {
  // Public search results are always status="published" (enforced
  // server-side, see backend SearchPropertiesUseCase), so showing this
  // badge there would be redundant noise on every single card. Only
  // meaningful in owner-facing contexts (My Properties) where drafts /
  // pending / rented listings actually appear alongside published ones.
  if (status === "published") return null;
  return <span className="pill-badge pill-badge--status">{status.replace("_", " ")}</span>;
}

interface PropertyCardProps {
  property: PropertySummary | PropertyDetail;
  /** Set by My Properties / owner contexts where a status badge for
   * non-published listings is actually useful. Defaults to showing it --
   * StatusBadge itself no-ops for "published". */
  showStatus?: boolean;
}

/**
 * Renders either a search-result PropertySummary or a full PropertyDetail
 * (My Properties / Favorites return full detail DTOs) with a single shared
 * premium card layout. Reused across Home, Search, My Properties, and
 * Favorites.
 *
 * Design note: "Verified"/"Featured" badges, star ratings, deposit,
 * parking, and owner name are NOT shown here because PropertySummary (the
 * DTO every search/home listing actually uses) doesn't carry that data --
 * adding it would mean changing the backend DTO, which was explicitly out
 * of scope for this redesign. Rather than fabricate placeholder values,
 * the card only renders what's real. Deposit/parking/owner DO appear on
 * PropertyDetailsPage, which already receives the full PropertyDetail.
 */
const MotionLink = m(Link);

function PropertyCardImpl({ property, showStatus = true }: PropertyCardProps) {
  const { isAuthenticated } = useAuth();
  const { isComparing, toggleCompare, canAddMore } = useCompare();
  const { showToast } = useToast();
  const isDetail = "images" in property;
  const imageUrl = isDetail
    ? property.images.find((img) => img.isPrimary)?.url ?? property.images[0]?.url ?? null
    : property.primaryImageUrl;
  const imageCount = isDetail ? property.images.length : null;
  const city = isDetail ? property.location?.city ?? null : property.city;
  const locality = isDetail ? property.location?.locality ?? null : property.locality;

  const [favorited, setFavorited] = useState<boolean>(
    (isDetail ? property.isFavorited : null) ?? false,
  );
  const [favoriting, setFavoriting] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const comparing = isComparing(property.id);
  const justSwipedRef = useRef(false);

  const toggleFavorite = async () => {
    if (!isAuthenticated || favoriting) return;
    setFavoriting(true);
    const next = !favorited;
    setFavorited(next); // optimistic
    try {
      const result = next ? await propertiesApi.favorite(property.id) : await propertiesApi.unfavorite(property.id);
      setFavorited(result.favorited);
      showToast(result.favorited ? "Saved to favorites" : "Removed from favorites", "success");
    } catch (err) {
      setFavorited(!next); // roll back
      if (!(err instanceof ApiError)) throw err;
      showToast("Could not update favorites. Please try again.", "error");
    } finally {
      setFavoriting(false);
    }
  };

  const handleFavorite = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite();
  };

  // Swipe-to-favorite on the media thumbnail (mobile-native pattern) --
  // dragging the image left/right past a small threshold toggles the same
  // favorite action as the heart button, then snaps back. Doesn't touch
  // the rest of the card, so the click-through-to-details behavior on the
  // rest of the card is completely unaffected.
  const SWIPE_THRESHOLD = 60;
  const handleDrag = (_: unknown, info: PanInfo) => {
    setDragProgress(Math.max(-1, Math.min(1, info.offset.x / 120)));
  };
  const handleDragEnd = (_: unknown, info: PanInfo) => {
    setDragProgress(0);
    if (Math.abs(info.offset.x) < SWIPE_THRESHOLD || !isAuthenticated) return;
    justSwipedRef.current = true;
    window.setTimeout(() => {
      justSwipedRef.current = false;
    }, 300);
    toggleFavorite();
  };

  const handleShare = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/properties/${property.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: property.title, url });
        return;
      } catch {
        // user cancelled the native share sheet -- fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied to clipboard", "success");
    } catch {
      showToast("Could not copy the link.", "error");
    }
  };

  const handleCompare = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const wasComparing = comparing;
    toggleCompare(property.id);
    showToast(wasComparing ? "Removed from compare" : "Added to compare", "success");
  };

  return (
    <MotionLink
      to={`/properties/${property.id}`}
      className="property-card-v2"
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      onClickCapture={(e: MouseEvent) => {
        // A swipe gesture just fired the favorite toggle on this same
        // pointer interaction -- suppress the navigation click that would
        // otherwise follow, without touching normal click-to-view-details.
        if (justSwipedRef.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <m.div
        className="property-card-v2__media"
        drag={isAuthenticated ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.5}
        dragMomentum={false}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
      >
        {imageUrl ? (
          <img
            src={cloudinaryTransform(imageUrl, { width: 480 })}
            srcSet={cloudinarySrcSet(imageUrl, [480, 960])}
            sizes="(max-width: 640px) 92vw, 320px"
            alt={property.title}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="property-card-v2__media-placeholder">No photo yet</div>
        )}

        {dragProgress !== 0 ? (
          <div
            className="property-card-v2__swipe-hint"
            style={{ opacity: Math.min(Math.abs(dragProgress) * 1.5, 1) }}
            aria-hidden="true"
          >
            <Heart size={28} fill="currentColor" />
          </div>
        ) : null}

        {showStatus && property.status !== "published" ? (
          <div className="property-card-v2__badges">
            <StatusBadge status={property.status} />
          </div>
        ) : null}

        {imageCount !== null && imageCount > 1 ? (
          <span className="property-card-v2__gallery-count">
            <Images size={12} />
            {imageCount}
          </span>
        ) : null}

        <button
          type="button"
          className={`property-card-v2__fav${favorited ? " property-card-v2__fav--active" : ""}`}
          onClick={handleFavorite}
          aria-pressed={favorited}
          aria-label={favorited ? "Remove from favorites" : "Save to favorites"}
          title={isAuthenticated ? undefined : "Sign in to save favorites"}
        >
          <Heart size={17} fill={favorited ? "currentColor" : "none"} />
        </button>
      </m.div>

      <div className="property-card-v2__body">
        <div className="property-card-v2__price-row">
          <span className="property-card-v2__price">
            {formatCurrency(property.rentAmount)}
            <span>/mo</span>
          </span>
          {property.distanceKm !== null ? (
            <span className="property-card-v2__distance">{property.distanceKm.toFixed(1)} km away</span>
          ) : null}
        </div>

        <h3 className="property-card-v2__title">{property.title}</h3>

        <div className="property-card-v2__location">
          <MapPin size={13} />
          {[locality, city].filter(Boolean).join(", ") || "Location not set"}
        </div>

        <div className="property-card-v2__specs">
          <span>
            <BedDouble size={14} /> {property.bedrooms}
          </span>
          <span>
            <Bath size={14} /> {property.bathrooms}
          </span>
          <span>
            <Ruler size={14} /> {property.areaSqft} sqft
          </span>
        </div>

        <div className="property-card-v2__actions">
          <button
            type="button"
            className="icon-action"
            onClick={handleShare}
            aria-label="Share this listing"
            title="Share"
          >
            <Share2 size={15} />
          </button>
          <button
            type="button"
            className={`icon-action${comparing ? " icon-action--whatsapp" : ""}`}
            onClick={handleCompare}
            aria-pressed={comparing}
            aria-label={comparing ? "Remove from compare" : "Add to compare"}
            disabled={!comparing && !canAddMore}
            title={comparing ? "Remove from compare" : "Add to compare"}
          >
            <Scale size={15} />
          </button>
          {/* Call/WhatsApp intentionally route to the detail page rather
              than exposing a phone number here: PropertySummary never
              includes owner contact info (by design, for privacy), and the
              real Contact Owner / WhatsApp flow already lives on
              PropertyDetailsPage against real owner data. */}
          <Link
            to={`/properties/${property.id}#contact`}
            className="icon-action"
            aria-label="Call owner"
            title="View details to call"
          >
            <Phone size={15} />
          </Link>
          <Link
            to={`/properties/${property.id}#contact`}
            className="icon-action icon-action--whatsapp"
            aria-label="Message owner on WhatsApp"
            title="View details to message on WhatsApp"
          >
            <MessageCircle size={15} />
          </Link>
        </div>
      </div>
    </MotionLink>
  );
}

// Search/Home grids can render 20+ cards at once; memoizing avoids
// re-rendering every card when unrelated state elsewhere on the page
// changes (e.g. typing in a filter re-renders SearchPage, but card props
// here are unchanged).
export const PropertyCard = memo(PropertyCardImpl);
