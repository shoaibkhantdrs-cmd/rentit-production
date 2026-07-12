import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { propertiesApi } from "@/api/properties";
import { savedSearchesApi } from "@/api/savedSearches";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/context/AuthContext";
import { PropertyCard } from "@/components/PropertyCard";
import { PropertyGridSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Pagination } from "@/components/Pagination";
import { ApiError } from "@/api/httpClient";
import { FurnishedStatus, PropertyCategory, PropertyType, SavedSearchFilters, SortOption } from "@/api/types";

const PROPERTY_TYPES: PropertyType[] = [
  "apartment",
  "house",
  "villa",
  "studio",
  "pg",
  "room",
  "commercial",
  "other",
];
const FURNISHED_OPTIONS: FurnishedStatus[] = ["unfurnished", "semi_furnished", "fully_furnished"];
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "most_viewed", label: "Most viewed" },
  { value: "price_low_to_high", label: "Price: low to high" },
  { value: "price_high_to_low", label: "Price: high to low" },
];

function num(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key);
  if (raw === null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isNaN(n) ? undefined : n;
}

export function SearchPage() {
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<PropertyCategory[]>([]);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    propertiesApi
      .categories()
      .then((res) => setCategories(res.items))
      .catch(() => setCategories([]));
  }, []);

  const filters = {
    category: searchParams.get("category") ?? undefined,
    propertyType: (searchParams.get("propertyType") as PropertyType | null) ?? undefined,
    rentMin: num(searchParams, "rentMin"),
    rentMax: num(searchParams, "rentMax"),
    bedroomsMin: num(searchParams, "bedroomsMin"),
    bathroomsMin: num(searchParams, "bathroomsMin"),
    parkingMin: num(searchParams, "parkingMin"),
    areaMin: num(searchParams, "areaMin"),
    areaMax: num(searchParams, "areaMax"),
    city: searchParams.get("city") ?? undefined,
    locality: searchParams.get("locality") ?? undefined,
    furnished: (searchParams.get("furnished") as FurnishedStatus | null) ?? undefined,
    availableFrom: searchParams.get("availableFrom") ?? undefined,
    lat: num(searchParams, "lat"),
    lng: num(searchParams, "lng"),
    radiusKm: num(searchParams, "radiusKm"),
    sort: (searchParams.get("sort") as SortOption | null) ?? "newest",
    page: num(searchParams, "page") ?? 1,
    pageSize: 20,
  };

  const { status, data, error, reload } = useAsync(
    () => propertiesApi.search(filters),
    [searchParams.toString()],
  );

  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(searchParams);
    if (value === undefined || value === "") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    next.delete("page"); // any filter change resets pagination
    setSearchParams(next);
  };

  const setPage = (page: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(page));
    setSearchParams(next);
  };

  const useNearby = () => {
    if (!navigator.geolocation) {
      setGeoStatus("Your browser doesn't support geolocation.");
      return;
    }
    setGeoStatus("Locating...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = new URLSearchParams(searchParams);
        next.set("lat", String(position.coords.latitude));
        next.set("lng", String(position.coords.longitude));
        if (!next.get("radiusKm")) next.set("radiusKm", "10");
        next.delete("page");
        setSearchParams(next);
        setGeoStatus("Showing listings near your current location.");
      },
      () => setGeoStatus("Could not get your location."),
    );
  };

  const clearNearby = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("lat");
    next.delete("lng");
    next.delete("radiusKm");
    setSearchParams(next);
    setGeoStatus(null);
  };

  const submitSaveSearch = async () => {
    if (!saveName.trim()) return;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const categoryId = categories.find((c) => c.slug === filters.category)?.id;
      const savedFilters: SavedSearchFilters = {
        categoryId,
        propertyType: filters.propertyType,
        rentMin: filters.rentMin,
        rentMax: filters.rentMax,
        bedroomsMin: filters.bedroomsMin,
        bathroomsMin: filters.bathroomsMin,
        parkingMin: filters.parkingMin,
        areaMin: filters.areaMin,
        areaMax: filters.areaMax,
        city: filters.city,
        locality: filters.locality,
        furnished: filters.furnished,
        availableFrom: filters.availableFrom,
        latitude: filters.lat,
        longitude: filters.lng,
        radiusKm: filters.radiusKm,
      };
      await savedSearchesApi.create(saveName.trim(), savedFilters, true);
      setSaveStatus("saved");
      setSaveName("");
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Could not save this search.");
      setSaveStatus("error");
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Search properties</h1>
          <p>Filter by budget, size, and location to find the right fit.</p>
        </div>
      </div>

      <div className="search-layout">
        <aside className="filters-panel">
          <h3>Filters</h3>

          <div className="field">
            <label htmlFor="f-category">Category</label>
            <select
              id="f-category"
              value={filters.category ?? ""}
              onChange={(e) => setParam("category", e.target.value || undefined)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="f-type">Property type</label>
            <select
              id="f-type"
              value={filters.propertyType ?? ""}
              onChange={(e) => setParam("propertyType", e.target.value || undefined)}
            >
              <option value="">Any type</option>
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Rent range (₹/mo)</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number"
                min={0}
                placeholder="Min"
                value={filters.rentMin ?? ""}
                onChange={(e) => setParam("rentMin", e.target.value || undefined)}
              />
              <input
                type="number"
                min={0}
                placeholder="Max"
                value={filters.rentMax ?? ""}
                onChange={(e) => setParam("rentMax", e.target.value || undefined)}
              />
            </div>
          </div>

          <div className="field">
            <label>Area (sqft)</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number"
                min={0}
                placeholder="Min"
                value={filters.areaMin ?? ""}
                onChange={(e) => setParam("areaMin", e.target.value || undefined)}
              />
              <input
                type="number"
                min={0}
                placeholder="Max"
                value={filters.areaMax ?? ""}
                onChange={(e) => setParam("areaMax", e.target.value || undefined)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="f-bedrooms">Bedrooms (min)</label>
            <input
              id="f-bedrooms"
              type="number"
              min={0}
              value={filters.bedroomsMin ?? ""}
              onChange={(e) => setParam("bedroomsMin", e.target.value || undefined)}
            />
          </div>

          <div className="field">
            <label htmlFor="f-bathrooms">Bathrooms (min)</label>
            <input
              id="f-bathrooms"
              type="number"
              min={0}
              value={filters.bathroomsMin ?? ""}
              onChange={(e) => setParam("bathroomsMin", e.target.value || undefined)}
            />
          </div>

          <div className="field">
            <label htmlFor="f-parking">Parking (min)</label>
            <input
              id="f-parking"
              type="number"
              min={0}
              value={filters.parkingMin ?? ""}
              onChange={(e) => setParam("parkingMin", e.target.value || undefined)}
            />
          </div>

          <div className="field">
            <label htmlFor="f-city">City</label>
            <input
              id="f-city"
              value={filters.city ?? ""}
              onChange={(e) => setParam("city", e.target.value || undefined)}
            />
          </div>

          <div className="field">
            <label htmlFor="f-locality">Locality</label>
            <input
              id="f-locality"
              value={filters.locality ?? ""}
              onChange={(e) => setParam("locality", e.target.value || undefined)}
            />
          </div>

          <div className="field">
            <label htmlFor="f-furnished">Furnished</label>
            <select
              id="f-furnished"
              value={filters.furnished ?? ""}
              onChange={(e) => setParam("furnished", e.target.value || undefined)}
            >
              <option value="">Any</option>
              {FURNISHED_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="f-available">Available from (or before)</label>
            <input
              id="f-available"
              type="date"
              value={filters.availableFrom ?? ""}
              onChange={(e) => setParam("availableFrom", e.target.value || undefined)}
            />
          </div>

          <div className="field">
            <label>Nearby</label>
            {filters.lat !== undefined ? (
              <div>
                <div className="field-hint">Within {filters.radiusKm ?? 10} km of your location</div>
                <button type="button" className="btn btn--secondary btn--sm" onClick={clearNearby}>
                  Clear
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn--secondary btn--sm" onClick={useNearby}>
                Use my current location
              </button>
            )}
            {geoStatus ? <p className="field-hint">{geoStatus}</p> : null}
          </div>
        </aside>

        <div>
          <div className="toolbar">
            <span className="field-hint">
              {status === "success" ? `${data.total} result${data.total === 1 ? "" : "s"}` : ""}
            </span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {isAuthenticated ? (
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => {
                    setShowSaveForm((v) => !v);
                    setSaveStatus("idle");
                  }}
                >
                  Save this search
                </button>
              ) : null}
              <div className="field" style={{ marginBottom: 0, minWidth: 200 }}>
                <select
                  aria-label="Sort by"
                  value={filters.sort}
                  onChange={(e) => setParam("sort", e.target.value)}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {showSaveForm ? (
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              {saveStatus === "saved" ? (
                <div className="alert alert--success">Saved -- we'll notify you about new matches.</div>
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <label htmlFor="save-search-name" className="field-hint">
                    Name this search
                  </label>
                  <input
                    id="save-search-name"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="e.g. 2BHK in Pune under 25k"
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={submitSaveSearch}
                    disabled={saveStatus === "saving" || !saveName.trim()}
                  >
                    {saveStatus === "saving" ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
              {saveError ? <div className="alert alert--error" style={{ marginTop: 8 }}>{saveError}</div> : null}
            </div>
          ) : null}

          {status === "loading" && <PropertyGridSkeleton count={6} />}

          {status === "error" && <ErrorState message={error} onRetry={reload} />}

          {status === "success" && data.items.length === 0 && (
            <EmptyState title="No properties match your filters" description="Try widening your search." />
          )}

          {status === "success" && data.items.length > 0 && (
            <>
              <div className="property-grid">
                {data.items.map((item) => (
                  <PropertyCard key={item.id} property={item} />
                ))}
              </div>
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
