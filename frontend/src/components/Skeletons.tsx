export function PropertyCardSkeleton() {
  return (
    <div className="property-card-v2" aria-hidden="true">
      <div className="skeleton property-card-v2__media" style={{ borderRadius: 0 }} />
      <div className="property-card-v2__body">
        <div className="skeleton skeleton--title" style={{ width: "45%" }} />
        <div className="skeleton skeleton--text" style={{ width: "85%" }} />
        <div className="skeleton skeleton--text" style={{ width: "60%" }} />
      </div>
    </div>
  );
}

export function PropertyGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="property-grid-v2">
      {Array.from({ length: count }).map((_, i) => (
        <PropertyCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function PropertyDetailSkeleton() {
  return (
    <div className="details-layout" aria-hidden="true">
      <div>
        <div className="skeleton gallery" style={{ aspectRatio: "16 / 10", borderRadius: "16px" }} />
        <div className="skeleton skeleton--title" style={{ marginTop: 20, width: "50%" }} />
        <div className="skeleton skeleton--text" />
        <div className="skeleton skeleton--text" />
        <div className="skeleton skeleton--text" style={{ width: "70%" }} />
      </div>
      <div className="skeleton" style={{ height: 220, borderRadius: "16px" }} />
    </div>
  );
}
