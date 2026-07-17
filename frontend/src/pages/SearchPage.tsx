import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bath,
  BedDouble,
  Building2,
  Car,
  Clock,
  Filter as FilterIcon,
  Grid2x2,
  List as ListIcon,
  Map as MapIcon,
  MapPin,
  Sofa,
  SlidersHorizontal,
} from "lucide-react";
import { propertiesApi } from "@/api/properties";
import { savedSearchesApi } from "@/api/savedSearches";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/context/AuthContext";
import { PropertyCard } from "@/components/PropertyCard";
import { PropertyGridSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { Chip } from "@/components/ui/Chip";
import { lazyNamed } from "@/utils/lazyNamed";
import { RangeSlider } from "@/components/ui/RangeSlider";
import { Accordion, AccordionItem } from "@/components/ui/Accordion";
import { Tabs } from "@/components/ui/Tabs";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/api/httpClient";
import { FurnishedStatus, PropertyCategory, PropertySummary, PropertyType, SavedSearchFilters, SortOption } from "@/api/types";
import { formatCurrency } from "@/utils/format";
import { clearRecentSearches, loadRecentSearches, RecentSearch, saveRecentSearch } from "@/utils/recentSearches";

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "apartment", label: "Apartment" },
  { value: "house", label: "House" },
  { value: "villa", label: "Villa" },
  { value: "studio", label: "Studio" },
  { value: "pg", label: "PG" },
  { value: "room", label: "Room" },
  { value: "commercial", label: "Commercial" },
  { value: "other", label: "Other" },
];
const FURNISHED_OPTIONS: { value: FurnishedStatus; label: string }[] = [
  { value: "unfurnished", label: "Unfurnished" },
  { value: "semi_furnished", label: "Semi-furnished" },
  { value: "fully_furnished", label: "Fully furnished" },
];
const MIN_COUNT_OPTIONS = [1, 2, 3, 4];
const RENT_MAX_CAP = 200000;
const AREA_MAX_CAP = 5000;
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "most_viewed", label: "Most viewed" },
  { value: "price_low_to_high", label: "Price: low to high" },
  { value: "price_high_to_low", label: "Price: high to low" },
];
type ViewMode = "grid" | "list" | "map";

// Perf fix: leaflet + react-leaflet (~40KB+ gzipped, plus CSS and marker
// images) used to be a static import here, so every visitor's bundle paid
// for the map stack even if they never switched to map view. lazyNamed is
// the same module-scope React.lazy() wrapper the admin section and every
// non-eager page already use -- declared once here, not inside the
// component (which would remount it every render).
const ResultsMap = lazyNamed<typeof import("@/components/ResultsMap").ResultsMap>(
  () => import("@/components/ResultsMap"),
  "ResultsMap",
);

function num(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key);
  if (raw === null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isNaN(n) ? undefined : n;
}

export function SearchPage() {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<PropertyCategory[]>([]);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(() => loadRecentSearches());

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

  // Perf fix: city/locality used to write straight into the URL
  // (setParam) on every keystroke, which fired a full backend request +
  // results-grid skeleton flash per character. These two local, debounced
  // drafts let the input feel instant while the actual URL/network update
  // (and therefore the useAsync fetch below, which keys off
  // searchParams.toString()) only happens after a typing pause -- the
  // same 350-400ms debounce-with-cleanup pattern HomePage's hero search
  // suggestions already use.
  const [cityInput, setCityInput] = useState(filters.city ?? "");
  const [localityInput, setLocalityInput] = useState(filters.locality ?? "");

  // Re-sync the draft when the URL changes from somewhere other than this
  // debounce (a removed filter chip, Reset, browser back/forward).
  useEffect(() => {
    setCityInput(filters.city ?? "");
  }, [filters.city]);
  useEffect(() => {
    setLocalityInput(filters.locality ?? "");
  }, [filters.locality]);

  useEffect(() => {
    const trimmed = cityInput.trim();
    if (trimmed === (filters.city ?? "")) return;
    const timer = window.setTimeout(() => setParam("city", trimmed || undefined), 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityInput]);
  useEffect(() => {
    const trimmed = localityInput.trim();
    if (trimmed === (filters.locality ?? "")) return;
    const timer = window.setTimeout(() => setParam("locality", trimmed || undefined), 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localityInput]);

  const { status, data, error, reload } = useAsync(
    () => propertiesApi.search(filters),
    [searchParams.toString()],
  );

  const { pullDistance, refreshing } = usePullToRefresh(() => reload());

  // Infinite scroll for grid/list view -- the base `useAsync` search above
  // still fetches exactly the page encoded in the URL (so a bookmarked
  // `?page=3` link still works), and this layer appends further pages on
  // top of it as the user scrolls, using the same real paginated endpoint.
  const [extraItems, setExtraItems] = useState<PropertySummary[]>([]);
  const [loadedPage, setLoadedPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (status === "success") {
      setExtraItems([]);
      setLoadedPage(data.page);
    }
  }, [status, data]);

  const combinedItems = status === "success" ? [...data.items, ...extraItems] : [];
  const hasMore = status === "success" && combinedItems.length < data.total;

  const loadMore = async () => {
    if (status !== "success" || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = loadedPage + 1;
      const res = await propertiesApi.search({ ...filters, page: nextPage });
      setExtraItems((prev) => [...prev, ...res.items]);
      setLoadedPage(nextPage);
    } catch {
      showToast("Couldn't load more listings. Try again.", "error");
    } finally {
      setLoadingMore(false);
    }
  };

  // Bug fix (perf/architecture audit #16): the IntersectionObserver below
  // only re-subscribes when hasMore/loadedPage/viewMode's *values* change --
  // but it called `loadMore` directly, which closes over `filters` (a new
  // object literal every render, derived from searchParams) and other
  // per-render state. If a filter changed without hasMore/loadedPage/
  // viewMode happening to change value too (e.g. both the old and new
  // filters have more pages and both reset loadedPage to the same number),
  // the effect wouldn't rerun, and the observer kept firing a stale
  // `loadMore` closure built from the *previous* filters -- scrolling could
  // silently append results for a filter set the user had already changed
  // away from. `loadMoreRef` always points at the latest render's closure
  // (same ref-mirroring pattern as useChatSocket's onEventRef), so the
  // observer calls the current `loadMore` regardless of whether the effect
  // itself re-ran.
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    if (!hasMore || viewMode === "map") return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMoreRef.current();
      },
      { rootMargin: "600px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadedPage, viewMode]);

  // Regression fix (RC1 QA): this used to read `searchParams` via closure
  // and build `next` from that snapshot. The debounced city/locality
  // effects above call this from inside a setTimeout, so the closure they
  // capture is pinned to whatever render was current when the debounce
  // timer was scheduled -- if the user changed a different filter
  // (synchronously, via its own setParam call) within that 400ms window,
  // the timer later fired against its stale snapshot and reverted that
  // change. Passing an updater function to setSearchParams instead means
  // React Router evaluates `prev` against the live state at the moment the
  // update is actually applied, not at closure-creation time, which
  // eliminates the race for every setParam call site, not just the
  // debounced ones.
  const setParam = (key: string, value: string | undefined) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === undefined || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      next.delete("page");
      return next;
    });
  };

  const resetFilters = () => {
    setSearchParams(new URLSearchParams());
    setGeoStatus(null);
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
      showToast("Search saved -- we'll notify you about new matches.", "success");
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Could not save this search.");
      setSaveStatus("error");
    }
  };

  // Human-readable summary of every active URL filter, each individually
  // removable. Built directly from the real searchParams / category list --
  // nothing here is invented, it's just a friendlier view of what's
  // already in the URL.
  const activeChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (filters.category) {
    const cat = categories.find((c) => c.slug === filters.category);
    activeChips.push({ key: "category", label: cat?.name ?? filters.category, onRemove: () => setParam("category", undefined) });
  }
  if (filters.propertyType) {
    activeChips.push({ key: "propertyType", label: filters.propertyType, onRemove: () => setParam("propertyType", undefined) });
  }
  if (filters.rentMin || filters.rentMax) {
    activeChips.push({
      key: "rent",
      label: `${formatCurrency(filters.rentMin ?? 0)} - ${formatCurrency(filters.rentMax ?? RENT_MAX_CAP)}`,
      onRemove: () => {
        const next = new URLSearchParams(searchParams);
        next.delete("rentMin");
        next.delete("rentMax");
        setSearchParams(next);
      },
    });
  }
  if (filters.areaMin || filters.areaMax) {
    activeChips.push({
      key: "area",
      label: `${filters.areaMin ?? 0} - ${filters.areaMax ?? AREA_MAX_CAP} sqft`,
      onRemove: () => {
        const next = new URLSearchParams(searchParams);
        next.delete("areaMin");
        next.delete("areaMax");
        setSearchParams(next);
      },
    });
  }
  if (filters.bedroomsMin) activeChips.push({ key: "bed", label: `${filters.bedroomsMin}+ beds`, onRemove: () => setParam("bedroomsMin", undefined) });
  if (filters.bathroomsMin) activeChips.push({ key: "bath", label: `${filters.bathroomsMin}+ baths`, onRemove: () => setParam("bathroomsMin", undefined) });
  if (filters.parkingMin) activeChips.push({ key: "parking", label: `${filters.parkingMin}+ parking`, onRemove: () => setParam("parkingMin", undefined) });
  if (filters.furnished) activeChips.push({ key: "furnished", label: filters.furnished.replace("_", " "), onRemove: () => setParam("furnished", undefined) });
  if (filters.city) activeChips.push({ key: "city", label: filters.city, onRemove: () => setParam("city", undefined) });
  if (filters.locality) activeChips.push({ key: "locality", label: filters.locality, onRemove: () => setParam("locality", undefined) });
  if (filters.availableFrom) activeChips.push({ key: "availableFrom", label: `From ${filters.availableFrom}`, onRemove: () => setParam("availableFrom", undefined) });
  if (filters.lat !== undefined) activeChips.push({ key: "nearby", label: `Within ${filters.radiusKm ?? 10} km`, onRemove: clearNearby });

  // Record this as a recent search once results actually load -- only when
  // it carries a real filter (not just default page/sort), so the list
  // stays useful rather than filling up with "no filters" entries.
  useEffect(() => {
    if (status !== "success") return;
    const meaningful = new URLSearchParams(searchParams);
    meaningful.delete("page");
    meaningful.delete("sort");
    if (meaningful.toString() === "") return;
    const label = activeChips.length > 0 ? activeChips.map((c) => c.label).join(", ") : "All properties";
    setRecentSearches(saveRecentSearch(searchParams.toString(), label));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, searchParams.toString()]);

  const filterBody = (
    <Accordion>
      <AccordionItem id="category" title="Category" icon={<Building2 size={16} />}>
        <select
          aria-label="Category"
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
      </AccordionItem>

      <AccordionItem id="propertyType" title="Property type" icon={<Building2 size={16} />}>
        <div className="chip-row">
          {PROPERTY_TYPES.map((t) => (
            <Chip
              key={t.value}
              active={filters.propertyType === t.value}
              onClick={() => setParam("propertyType", filters.propertyType === t.value ? undefined : t.value)}
            >
              {t.label}
            </Chip>
          ))}
        </div>
      </AccordionItem>

      <AccordionItem id="budget" title="Budget" icon={<SlidersHorizontal size={16} />}>
        <RangeSlider
          label="Monthly rent"
          min={0}
          max={RENT_MAX_CAP}
          step={1000}
          valueMin={filters.rentMin ?? 0}
          valueMax={filters.rentMax ?? RENT_MAX_CAP}
          formatValue={formatCurrency}
          onChange={(minV, maxV) => {
            const next = new URLSearchParams(searchParams);
            minV > 0 ? next.set("rentMin", String(minV)) : next.delete("rentMin");
            maxV < RENT_MAX_CAP ? next.set("rentMax", String(maxV)) : next.delete("rentMax");
            next.delete("page");
            setSearchParams(next);
          }}
        />
      </AccordionItem>

      <AccordionItem id="area" title="Area (sqft)" icon={<SlidersHorizontal size={16} />}>
        <RangeSlider
          label="Carpet area"
          min={0}
          max={AREA_MAX_CAP}
          step={50}
          valueMin={filters.areaMin ?? 0}
          valueMax={filters.areaMax ?? AREA_MAX_CAP}
          formatValue={(v) => `${v} sqft`}
          onChange={(minV, maxV) => {
            const next = new URLSearchParams(searchParams);
            minV > 0 ? next.set("areaMin", String(minV)) : next.delete("areaMin");
            maxV < AREA_MAX_CAP ? next.set("areaMax", String(maxV)) : next.delete("areaMax");
            next.delete("page");
            setSearchParams(next);
          }}
        />
      </AccordionItem>

      <AccordionItem id="bedrooms" title="Bedrooms" icon={<BedDouble size={16} />}>
        <div className="chip-row">
          {MIN_COUNT_OPTIONS.map((n) => (
            <Chip
              key={n}
              active={filters.bedroomsMin === n}
              onClick={() => setParam("bedroomsMin", filters.bedroomsMin === n ? undefined : String(n))}
            >
              {n}+
            </Chip>
          ))}
        </div>
      </AccordionItem>

      <AccordionItem id="bathrooms" title="Bathrooms" icon={<Bath size={16} />}>
        <div className="chip-row">
          {MIN_COUNT_OPTIONS.map((n) => (
            <Chip
              key={n}
              active={filters.bathroomsMin === n}
              onClick={() => setParam("bathroomsMin", filters.bathroomsMin === n ? undefined : String(n))}
            >
              {n}+
            </Chip>
          ))}
        </div>
      </AccordionItem>

      <AccordionItem id="parking" title="Parking" icon={<Car size={16} />}>
        <div className="chip-row">
          {[0, 1, 2, 3].map((n) => (
            <Chip
              key={n}
              active={filters.parkingMin === n}
              onClick={() => setParam("parkingMin", filters.parkingMin === n ? undefined : String(n))}
            >
              {n}+
            </Chip>
          ))}
        </div>
      </AccordionItem>

      <AccordionItem id="furnishing" title="Furnishing" icon={<Sofa size={16} />}>
        <div className="chip-row">
          {FURNISHED_OPTIONS.map((f) => (
            <Chip
              key={f.value}
              active={filters.furnished === f.value}
              onClick={() => setParam("furnished", filters.furnished === f.value ? undefined : f.value)}
            >
              {f.label}
            </Chip>
          ))}
        </div>
      </AccordionItem>

      <AccordionItem id="location" title="Location" icon={<MapPin size={16} />}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="f-city">City</label>
          <input id="f-city" value={cityInput} onChange={(e) => setCityInput(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="f-locality">Locality</label>
          <input
            id="f-locality"
            value={localityInput}
            onChange={(e) => setLocalityInput(e.target.value)}
          />
        </div>
        <div>
          {filters.lat !== undefined ? (
            <div>
              <div className="field-hint">Within {filters.radiusKm ?? 10} km of your location</div>
              <button type="button" className="btn-v2 btn-v2--secondary btn-v2--sm" onClick={clearNearby}>
                Clear radius search
              </button>
            </div>
          ) : (
            <button type="button" className="btn-v2 btn-v2--secondary btn-v2--sm" onClick={useNearby}>
              <MapPin size={14} /> Search near my location
            </button>
          )}
          {geoStatus ? <p className="field-hint">{geoStatus}</p> : null}
        </div>
      </AccordionItem>

      <AccordionItem id="availableFrom" title="Available from" icon={<SlidersHorizontal size={16} />}>
        <input
          type="date"
          aria-label="Available from"
          value={filters.availableFrom ?? ""}
          onChange={(e) => setParam("availableFrom", e.target.value || undefined)}
        />
      </AccordionItem>
    </Accordion>
  );

  return (
    <div>
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />

      <div className="page-header">
        <div>
          <h1>Search properties</h1>
          <p>Filter by budget, size, and location to find the right fit.</p>
        </div>
        <button
          type="button"
          className="btn-v2 btn-v2--secondary btn-v2--sm filters-mobile-trigger"
          onClick={() => setMobileFiltersOpen(true)}
        >
          <FilterIcon size={15} /> Filters
        </button>
      </div>

      {recentSearches.length > 0 ? (
        <div className="recent-searches">
          <span className="field-hint" style={{ display: "flex", alignItems: "center" }}>
            Recent:
          </span>
          {recentSearches.map((s) => (
            <Chip key={s.query} onClick={() => setSearchParams(new URLSearchParams(s.query))} icon={<Clock size={13} />}>
              {s.label}
            </Chip>
          ))}
          <button
            type="button"
            className="active-filter-chip"
            style={{ background: "var(--color-bg)", color: "var(--color-text-muted)" }}
            onClick={() => {
              clearRecentSearches();
              setRecentSearches([]);
            }}
          >
            Clear
          </button>
        </div>
      ) : null}

      <div className="search-layout">
        <aside className="filters-v2">
          <div className="filters-v2__header">
            <span className="filters-v2__title">
              <FilterIcon size={17} /> Filters
            </span>
            <button type="button" className="filters-v2__reset" onClick={resetFilters}>
              Reset
            </button>
          </div>
          <div className="filters-v2__body">{filterBody}</div>
        </aside>

        <div>
          <div className="toolbar">
            <span className="field-hint">
              {status === "success" ? `${data.total} result${data.total === 1 ? "" : "s"}` : ""}
            </span>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <Tabs
                ariaLabel="View mode"
                value={viewMode}
                onChange={setViewMode}
                options={[
                  { value: "grid", label: "Grid", icon: <Grid2x2 size={14} /> },
                  { value: "list", label: "List", icon: <ListIcon size={14} /> },
                  { value: "map", label: "Map", icon: <MapIcon size={14} /> },
                ]}
              />
              {isAuthenticated ? (
                <button
                  type="button"
                  className="btn-v2 btn-v2--secondary btn-v2--sm"
                  onClick={() => {
                    setShowSaveForm((v) => !v);
                    setSaveStatus("idle");
                  }}
                >
                  Save this search
                </button>
              ) : null}
              <div className="field" style={{ marginBottom: 0, minWidth: 190 }}>
                <select aria-label="Sort by" value={filters.sort} onChange={(e) => setParam("sort", e.target.value)}>
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {activeChips.length > 0 ? (
            <div className="active-filters">
              {activeChips.map((chip) => (
                <button key={chip.key} type="button" className="active-filter-chip" onClick={chip.onRemove}>
                  {chip.label}
                  <span aria-hidden="true">&times;</span>
                </button>
              ))}
              <button type="button" className="active-filter-chip" style={{ background: "var(--color-bg)", color: "var(--color-text-muted)" }} onClick={resetFilters}>
                Clear all
              </button>
            </div>
          ) : null}

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
                    className="btn-v2 btn-v2--primary btn-v2--sm"
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
            <EmptyState
              title="No properties match your filters"
              description="Try widening your budget, clearing a filter, or searching a nearby locality."
              action={
                <button type="button" className="btn-v2 btn-v2--primary" onClick={resetFilters}>
                  Clear filters
                </button>
              }
              secondaryAction={
                <a href="/" className="btn-v2 btn-v2--secondary">
                  Browse categories
                </a>
              }
            />
          )}

          {status === "success" && data.items.length > 0 && viewMode === "map" && (
            <Suspense fallback={<div className="skeleton" style={{ height: 480 }} />}>
              <ResultsMap items={data.items} />
            </Suspense>
          )}

          {status === "success" && combinedItems.length > 0 && viewMode !== "map" && (
            <>
              <div className={`property-grid-v2${viewMode === "list" ? " property-grid-v2--list" : ""}`}>
                {combinedItems.map((item) => (
                  <PropertyCard key={item.id} property={item} />
                ))}
              </div>

              <div ref={sentinelRef} className="infinite-scroll-sentinel" aria-hidden="true" />

              {hasMore ? (
                <div className="infinite-scroll-more">
                  <button type="button" className="btn-v2 btn-v2--secondary" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? "Loading more..." : `Load more (${data.total - combinedItems.length} remaining)`}
                  </button>
                </div>
              ) : (
                <p className="field-hint infinite-scroll-end">
                  You've seen all {data.total} propert{data.total === 1 ? "y" : "ies"}.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <button type="button" className="filter-fab" onClick={() => setMobileFiltersOpen(true)}>
        <FilterIcon size={16} /> Filters{activeChips.length > 0 ? ` (${activeChips.length})` : ""}
      </button>

      <Drawer open={mobileFiltersOpen} onClose={() => setMobileFiltersOpen(false)} title="Filters" side="left">
        {filterBody}
        <button
          type="button"
          className="btn-v2 btn-v2--primary"
          style={{ width: "100%", marginTop: 16 }}
          onClick={() => setMobileFiltersOpen(false)}
        >
          Show {status === "success" ? data.total : ""} results
        </button>
      </Drawer>
    </div>
  );
}
