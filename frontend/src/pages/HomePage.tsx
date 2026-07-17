import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { m } from "framer-motion";
import {
  Building2,
  Eye,
  Home as HomeIcon,
  Mic,
  MapPin,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { propertiesApi } from "@/api/properties";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/context/AuthContext";
import { PropertyCard } from "@/components/PropertyCard";
import { PropertyGridSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Reveal } from "@/components/ui/Reveal";
import { Carousel } from "@/components/ui/Carousel";
import { AccordionItem } from "@/components/ui/Accordion";
import { PropertyCategory, PropertySummary } from "@/api/types";

const POPULAR_CITIES = ["Mumbai", "Pune", "Bengaluru", "Delhi", "Hyderabad", "Chennai"];

const CATEGORY_ICON_KEYWORDS: [string, React.ReactNode][] = [
  ["apartment", <Building2 size={24} key="a" />],
  ["flat", <Building2 size={24} key="f" />],
  ["villa", <HomeIcon size={24} key="v" />],
  ["house", <HomeIcon size={24} key="h" />],
  ["pg", <Sparkles size={24} key="p" />],
  ["commercial", <TrendingUp size={24} key="c" />],
];

function categoryIcon(name: string): React.ReactNode {
  const match = CATEGORY_ICON_KEYWORDS.find(([keyword]) => name.toLowerCase().includes(keyword));
  return match ? match[1] : <HomeIcon size={24} />;
}

/** Minimal, self-contained Web Speech API wrapper -- a real browser
 * capability (Chrome/Edge), not a stub. On browsers without support (e.g.
 * Firefox) `recognitionSupported` is false and the mic button simply isn't
 * rendered, rather than showing a broken affordance. */
function useVoiceSearch(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const SpeechRecognitionCtor =
    (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;

  const start = () => {
    if (!SpeechRecognitionCtor) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SpeechRecognitionCtor as any)();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) onResult(transcript);
    };
    recognition.start();
  };

  return { start, listening, supported: Boolean(SpeechRecognitionCtor) };
}

function CategoryStrip({ categories }: { categories: PropertyCategory[] }) {
  const navigate = useNavigate();
  if (categories.length === 0) return null;
  return (
    <Reveal className="section-v2">
      <div className="section-v2__header">
        <div>
          <h2 className="section-v2__title">Browse by category</h2>
          <p className="section-v2__subtitle">Find the right kind of space for your next move.</p>
        </div>
      </div>
      <div className="category-scroll">
        {categories.map((category, i) => (
          <m.button
            key={category.id}
            type="button"
            className="category-card"
            onClick={() => navigate(`/search?category=${encodeURIComponent(category.slug)}`)}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.96 }}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
          >
            <span className="category-card__icon">{categoryIcon(category.name)}</span>
            <span className="category-card__label">{category.name}</span>
          </m.button>
        ))}
      </div>
    </Reveal>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [city, setCity] = useState("");
  const [categories, setCategories] = useState<PropertyCategory[]>([]);
  const [nearby, setNearby] = useState<{ status: "idle" | "loading" | "done" | "error"; items: PropertySummary[] | null }>(
    { status: "idle", items: null },
  );
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [suggestions, setSuggestions] = useState<PropertySummary[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const searchFieldRef = useRef<HTMLDivElement | null>(null);

  const voice = useVoiceSearch((text) => setCity(text));

  // Google-like instant suggestions -- rather than fabricating a city/
  // locality autocomplete list (no such endpoint exists on the backend),
  // this debounces the real search endpoint itself and previews actual
  // matching listings as the user types.
  useEffect(() => {
    const query = city.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }
    setSuggestLoading(true);
    // Bug fix (QA report #9): only the pending setTimeout used to be
    // cancelled on the next keystroke -- once a request was actually in
    // flight, nothing stopped it. A slower earlier request resolving
    // after a faster later one could overwrite the dropdown with results
    // for a city the user had already typed past. `cancelled` guards the
    // state updates so only the most recent request for this effect run
    // can apply its results.
    let cancelled = false;
    const timer = window.setTimeout(() => {
      propertiesApi
        .search({ city: query, page: 1, pageSize: 5, sort: "newest" })
        .then((res) => {
          if (cancelled) return;
          setSuggestions(res.items);
          setSuggestOpen(true);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setSuggestLoading(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [city]);

  // Close the suggestion panel on outside click / Escape.
  useEffect(() => {
    if (!suggestOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (searchFieldRef.current && !searchFieldRef.current.contains(e.target as Node)) setSuggestOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSuggestOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [suggestOpen]);

  useEffect(() => {
    propertiesApi
      .categories()
      .then((res) => setCategories(res.items))
      .catch(() => setCategories([]));
  }, []);

  const newest = useAsync(() => propertiesApi.search({ sort: "newest", page: 1, pageSize: 8 }), []);
  const popular = useAsync(() => propertiesApi.search({ sort: "most_viewed", page: 1, pageSize: 8 }), []);
  const recentlyViewed = useAsync(
    () => (isAuthenticated ? propertiesApi.recentlyViewed() : Promise.resolve({ items: [] })),
    [isAuthenticated],
  );

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (city.trim()) params.set("city", city.trim());
    navigate(`/search${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const loadNearby = () => {
    if (!navigator.geolocation) {
      setNearby({ status: "error", items: null });
      return;
    }
    setNearby({ status: "loading", items: null });
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const result = await propertiesApi.search({
            sort: "newest",
            page: 1,
            pageSize: 8,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            radiusKm: 15,
          });
          setNearby({ status: "done", items: result.items });
        } catch {
          setNearby({ status: "error", items: null });
        }
      },
      () => setNearby({ status: "error", items: null }),
    );
  };

  return (
    <div>
      {/* ---------- Hero + search ---------- */}
      <m.section
        className="hero-v2"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <span className="hero-v2__eyebrow">
          <Sparkles size={14} />
          India's premium rental marketplace
        </span>
        <h1 className="hero-v2__title">Find your next place to rent, without the noise.</h1>
        <p className="hero-v2__subtitle">
          Verified listings, direct owner contact, and zero brokerage games. Search apartments, houses,
          PGs, and commercial spaces across every major city.
        </p>

        <form className="search-bar-v2" onSubmit={handleSearch}>
          <div className="search-bar-v2__field-wrap" ref={searchFieldRef}>
            <label className="search-bar-v2__field" htmlFor="hero-city">
              <MapPin size={18} />
              <input
                id="hero-city"
                placeholder="Search by city or locality, e.g. Koramangala, Bengaluru"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                onFocus={() => suggestions.length > 0 && setSuggestOpen(true)}
                autoComplete="off"
                role="combobox"
                aria-expanded={suggestOpen}
                aria-controls="hero-search-suggestions"
              />
            </label>

            {suggestOpen && (suggestLoading || suggestions.length > 0) ? (
              <div className="search-suggest" id="hero-search-suggestions" role="listbox">
                {suggestLoading ? (
                  <div className="search-suggest__loading">Searching...</div>
                ) : (
                  <>
                    {suggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={false}
                        className="search-suggest__item"
                        onClick={() => navigate(`/properties/${item.id}`)}
                      >
                        {item.primaryImageUrl ? (
                          <img src={item.primaryImageUrl} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <span className="search-suggest__item-placeholder" aria-hidden="true" />
                        )}
                        <span>
                          <strong>{item.title}</strong>
                          <span className="field-hint">
                            {[item.locality, item.city].filter(Boolean).join(", ")}
                          </span>
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      className="search-suggest__see-all"
                      onClick={() => navigate(`/search?city=${encodeURIComponent(city.trim())}`)}
                    >
                      See all results for &ldquo;{city.trim()}&rdquo;
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>
          {voice.supported ? (
            <button
              type="button"
              className={`btn-v2 btn-v2--icon search-bar-v2__voice${voice.listening ? " search-bar-v2__voice--active" : ""}`}
              onClick={voice.start}
              aria-label="Search by voice"
              title="Search by voice"
            >
              <Mic size={18} />
            </button>
          ) : null}
          <button type="submit" className="btn-v2 btn-v2--primary">
            Search
          </button>
        </form>

        <div className="trending-row">
          <span className="trending-row__label">Popular searches:</span>
          {POPULAR_CITIES.map((c) => (
            <button key={c} type="button" className="trending-chip" onClick={() => navigate(`/search?city=${encodeURIComponent(c)}`)}>
              {c}
            </button>
          ))}
        </div>
      </m.section>

      <CategoryStrip categories={categories} />

      {/* ---------- Newest listings ---------- */}
      <Reveal className="section-v2">
        <div className="section-v2__header">
          <div>
            <h2 className="section-v2__title">Newest listings</h2>
            <p className="section-v2__subtitle">Fresh properties added to RentIt.</p>
          </div>
          <a href="/search?sort=newest" className="section-v2__link">
            View all &rarr;
          </a>
        </div>

        {newest.status === "loading" && <PropertyGridSkeleton count={8} />}
        {newest.status === "error" && <ErrorState message={newest.error} onRetry={newest.reload} />}
        {newest.status === "success" && newest.data.items.length === 0 && (
          <EmptyState
            title="No listings yet"
            description="Be the first to list a property on RentIt."
            action={
              <a href="/properties/new" className="btn-v2 btn-v2--primary">
                List a property
              </a>
            }
          />
        )}
        {newest.status === "success" && newest.data.items.length > 0 && (
          <div className="property-grid-v2">
            {newest.data.items.map((item) => (
              <PropertyCard key={item.id} property={item} />
            ))}
          </div>
        )}
      </Reveal>

      {/* ---------- Most viewed (real "most_viewed" sort -- an honest proxy
          for "popular", since the API has no separate featured/boosted flag
          to surface here) ---------- */}
      {popular.status === "success" && popular.data.items.length > 0 && (
        <Reveal className="section-v2">
          <div className="section-v2__header">
            <div>
              <h2 className="section-v2__title">Most viewed right now</h2>
              <p className="section-v2__subtitle">What other renters are looking at this week.</p>
            </div>
            <a href="/search?sort=most_viewed" className="section-v2__link">
              View all &rarr;
            </a>
          </div>
          <Carousel ariaLabel="Most viewed properties this week">
            {popular.data.items.map((item) => (
              <PropertyCard key={item.id} property={item} />
            ))}
          </Carousel>
        </Reveal>
      )}

      {/* ---------- Recently viewed (signed-in users only) ---------- */}
      {isAuthenticated && recentlyViewed.status === "success" && recentlyViewed.data.items.length > 0 && (
        <Reveal className="section-v2">
          <div className="section-v2__header">
            <div>
              <h2 className="section-v2__title">Recently viewed</h2>
            </div>
          </div>
          <Carousel ariaLabel="Properties you recently viewed">
            {recentlyViewed.data.items.map((item) => (
              <PropertyCard key={item.id} property={item} />
            ))}
          </Carousel>
        </Reveal>
      )}

      {/* ---------- Properties near you ---------- */}
      <Reveal className="section-v2">
        <div className="section-v2__header">
          <div>
            <h2 className="section-v2__title">Properties near you</h2>
            <p className="section-v2__subtitle">Uses your device location -- nothing is shared until you allow it.</p>
          </div>
          {nearby.status === "idle" ? (
            <button type="button" className="btn-v2 btn-v2--secondary btn-v2--sm" onClick={loadNearby}>
              <MapPin size={15} /> Use my location
            </button>
          ) : null}
        </div>

        {nearby.status === "loading" && <PropertyGridSkeleton count={4} />}
        {nearby.status === "error" && (
          <EmptyState title="Couldn't get your location" description="Check your browser's location permission and try again." />
        )}
        {nearby.status === "done" && nearby.items && nearby.items.length === 0 && (
          <EmptyState title="Nothing nearby yet" description="Try widening your search radius from the Search page." />
        )}
        {nearby.status === "done" && nearby.items && nearby.items.length > 0 && (
          <div className="property-grid-v2">
            {nearby.items.map((item) => (
              <PropertyCard key={item.id} property={item} />
            ))}
          </div>
        )}
      </Reveal>

      {/* ---------- Trust / value props (no fabricated review data --
          see design notes: real testimonials would need a reviews
          system this app doesn't have) ---------- */}
      <Reveal className="section-v2">
        <div className="section-v2__header">
          <div>
            <h2 className="section-v2__title">Why renters and owners choose RentIt</h2>
          </div>
        </div>
        <div className="testimonial-grid">
          <div className="testimonial-card">
            <ShieldCheck size={22} color="var(--color-primary)" />
            <p className="testimonial-card__quote">
              Every owner goes through an identity verification review before their first listing goes
              live, so you know who you're actually renting from.
            </p>
          </div>
          <div className="testimonial-card">
            <TrendingUp size={22} color="var(--color-primary)" />
            <p className="testimonial-card__quote">
              Message or call owners directly -- no broker fees, no middlemen relaying offers back and
              forth.
            </p>
          </div>
          <div className="testimonial-card">
            <Eye size={22} color="var(--color-primary)" />
            <p className="testimonial-card__quote">
              Save searches and get notified the moment a matching listing goes live, instead of
              refreshing the same search every day.
            </p>
          </div>
        </div>
      </Reveal>

      {/* ---------- Stats (only real, fetched numbers -- no invented
          "50,000 happy customers" style figures) ---------- */}
      {newest.status === "success" ? (
        <Reveal className="section-v2">
          <div className="stats-v2">
            <div className="stat-v2">
              <div className="stat-v2__value">{newest.data.total.toLocaleString("en-IN")}+</div>
              <div className="stat-v2__label">Live listings</div>
            </div>
            <div className="stat-v2">
              <div className="stat-v2__value">{categories.length || "--"}</div>
              <div className="stat-v2__label">Property categories</div>
            </div>
            <div className="stat-v2">
              <div className="stat-v2__value">0%</div>
              <div className="stat-v2__label">Brokerage fees</div>
            </div>
          </div>
        </Reveal>
      ) : null}

      {/* ---------- Install as an app (real PWA, not fake store links) ---------- */}
      <Reveal className="section-v2">
        <div className="download-app-v2">
          <div>
            <h2 className="section-v2__title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Smartphone size={26} /> Take RentIt with you
            </h2>
            <p className="section-v2__subtitle">
              Install RentIt as an app on your phone for a faster, full-screen experience -- no app
              store required.
            </p>
          </div>
          <div className="download-app-v2__badges">
            <span className="store-badge">
              <Smartphone size={16} /> Add to Home Screen
            </span>
          </div>
        </div>
      </Reveal>

      {/* ---------- FAQ ---------- */}
      <Reveal className="section-v2">
        <div className="section-v2__header">
          <div>
            <h2 className="section-v2__title">Frequently asked questions</h2>
          </div>
        </div>
        <div className="accordion" style={{ maxWidth: 720 }}>
          {[
            {
              q: "Is there any brokerage fee?",
              a: "No. RentIt connects you directly with property owners -- there's no broker in the middle and no brokerage fee to use the platform.",
            },
            {
              q: "How do I contact a property owner?",
              a: "Open any listing and use the Contact Owner, Call, or WhatsApp options on the details page to reach out directly.",
            },
            {
              q: "How does owner verification work?",
              a: "Owners submit identity documents for review from their Verification page; an admin reviews and approves before certain listing privileges unlock.",
            },
            {
              q: "Can I list more than one property?",
              a: "Yes -- once you're signed in as a property owner, List a Property and My Properties let you manage multiple listings, drafts, and their photos.",
            },
          ].map((item, i) => (
            <AccordionItem key={item.q} id={item.q} title={item.q} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? null : i)}>
              <p style={{ margin: 0, color: "var(--color-text-muted)" }}>{item.a}</p>
            </AccordionItem>
          ))}
        </div>
      </Reveal>
    </div>
  );
}
