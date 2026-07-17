# RentIt — Performance Audit

Senior-engineer read-only audit of the frontend (React 18 + Vite + TypeScript) and backend (Express + TypeScript + raw `pg`, Clean Architecture). No code was modified. Two of the highest-severity findings (the favorites/my-properties N+1 loop and the unbounded admin growth-chart query) were independently re-verified against the actual source below, not just taken from sub-audit output. Estimated bundle-size figures are qualitative — no build was run in this environment, so no real gzipped numbers exist; this is flagged inline wherever it applies.

## Top 10, ranked by impact

1. **Favorites / My Properties / Recently Viewed / Recommendations issue up to ~300 concurrent queries per page load.** `PropertyDetailLoader.load()` fires 6 queries per property; its own doc comment explicitly says it exists to be avoided in list contexts "to avoid an N+1 query per row," yet `GetMyFavorites`, `GetMyProperties`, `GetRecentlyViewed`, and `GetRecommendations` all loop it over a page of results anyway. A full 50-item page is 300 queries against a 10-connection pool, from one HTTP request. `SearchProperties.usecase.ts` already proves the batched alternative exists in this codebase (3 queries for a whole page) — it just wasn't reused here.
2. **Admin dashboard's growth chart full-table-scans on every load, uncached.** `AdminAnalyticsRepository.getGrowth()`'s inner aggregate subquery has no date-range `WHERE` clause — it aggregates the entire history of `users`/`properties`/`property_views` (append-only) every single call, then discards everything outside the requested window only after the fact. Combined with zero caching anywhere on this endpoint, every dashboard visit re-scans growing tables in full.
3. **Property search/browse/admin-user-search all use leading-wildcard `ILIKE '%term%'` with no trigram index.** No `pg_trgm` extension is enabled anywhere in the migrations. The existing btree indexes on `city`/`locality`/`name`/`email` cannot serve a leading-wildcard `LIKE`, so every text search sequential-scans the table.
4. **Toast notifications silently re-render every `PropertyCard` on the page.** `ToastContext`'s value is a new object literal every render, and `ToastProvider` re-renders on every `showToast()` call — which fires on every favorite/share/compare action. `PropertyCard` is wrapped in `React.memo()` with a comment claiming this protects it, but `memo()` doesn't stop context-triggered re-renders; only prop-identity checks. Favoriting one card on a 20-card grid re-renders all 20.
5. **Property images ship at one resolution for every context.** Cloudinary stores a single upload-time-capped (2000×2000) master URL per image with no delivery-time transform (`w_`, `c_fill`, etc.) ever constructed. A 300px card thumbnail, an 80px gallery thumbnail, and the full detail hero all download the identical file. No `srcset`/`sizes` anywhere in the app compounds this for high-DPR displays.
6. **Leaflet (~40KB+ gzipped, plus CSS and marker images) ships in the eager main bundle for every visitor**, including ones who never open Search or the map tab. `SearchPage.tsx` is one of only three pages deliberately kept out of the app's own lazy-loading system, and it statically imports `ResultsMap`, which statically imports the full `leaflet`/`react-leaflet` stack — conditional *rendering* of the map (`viewMode === "map"`) doesn't achieve conditional *loading*.
7. **Search page filter inputs (city/locality) and the admin Users search box fire a full backend request on every keystroke, with no debounce.** Typing a 9-character city name fires 9 search requests and 9 full-grid skeleton-flashes. The codebase already has the correct pattern next door — `HomePage.tsx`'s hero search suggestions are properly debounced (350ms) and cancellation-safe — it just wasn't applied to these two inputs.
8. **`BroadcastNotification` inserts up to 5,000 rows sequentially, one `await`ed INSERT at a time**, on a single admin HTTP request, instead of one bulk insert.
9. **Framer Motion's full API surface (not the tree-shakeable `LazyMotion`/`m` subset) is imported from the app root (`main.tsx`), `Layout.tsx`, `HomePage.tsx`, and `PropertyCard.tsx` — all eager** — so its full weight (commonly ~40-55KB gzipped) is unavoidably in every visitor's initial payload, including someone landing directly on a shared property link.
10. **Approving a property synchronously blocks on a platform-wide, unindexed saved-search scan.** `NotifySavedSearchesForProperty` loads every notifiable saved search with no LIMIT and no supporting index on `notify_on_match`, filters in Node, then does 3 more queries per match — and `ApproveProperty.usecase.ts` awaits the entire chain before the admin's request completes.

---

## Frontend: React render performance

**High**

- **`ToastContext` value unmemoized, defeats `PropertyCard`'s `memo()` app-wide.** `components/ui/Toast.tsx:33-50` — `value={{ showToast }}` is a fresh object every `ToastProvider` render, which itself re-renders on every toast shown or auto-dismissed. Every mounted `PropertyCard` re-renders on every toast anywhere on the page. *(Top 10 #4.)*
- **`SearchPage` city/locality inputs have no debounce.** `pages/SearchPage.tsx:437-446` — every keystroke updates `searchParams`, which `useAsync` depends on directly, firing a new network request and swapping the results grid for a skeleton mid-typing. *(Top 10 #7.)*
- **Admin `UsersPage` search box has the identical no-debounce bug.** `pages/admin/UsersPage.tsx:41-49`.
- **`ChatContext` value and its `send` function are both unmemoized, and it transitively re-renders whenever `AuthContext` does.** `context/ChatContext.tsx:23,63` + `hooks/useChatSocket.ts` — `Layout.tsx` (mounted on every route) and any open chat thread re-render on every unread-count change or upstream Auth re-render.
- **`ConversationThreadPage` reformats every message's timestamp on every keystroke in the composer.** `pages/ConversationThreadPage.tsx:313-349` — `setDraft` on each character re-renders the whole thread, re-executing `messages.map()` and re-parsing `Date`/`toLocaleTimeString` for every loaded message (up to 50+). Message bubbles aren't extracted into a memoized child, so nothing can be skipped.
- **`SearchPage`'s infinite-scroll `IntersectionObserver` effect has an incomplete dependency array** (`pages/SearchPage.tsx:141-169`, lint-suppressed) — `loadMore` and the `filters` it closes over are excluded. If a filter changes without `hasMore`/`loadedPage` changing value, the observer keeps calling a stale closure. Moderate confidence — needs a specific timing window to reproduce, but the mechanism is a textbook stale-closure setup.

**Medium**

- `AuthContext`'s value isn't memoized (`context/AuthContext.tsx:134-149`), cascading to 20 consumer files on every login/logout/auth-ready transition — mitigated somewhat by `httpClient.ts` reusing the same user object reference on silent token refresh, so it's not continuous, but still real.
- `Layout`'s `AnimatePresence mode="wait"` blocks mounting the next route until the previous route's 180ms exit animation finishes, on every navigation app-wide — a deliberate tradeoff, but a universal tax worth knowing about.
- `PropertyCard`'s swipe-to-favorite drag calls `setState` on every pointer-move frame instead of driving the visual feedback off a Framer Motion `MotionValue` — localized to the card being dragged, but real jank risk on lower-end mobile, exactly where this gesture is used.
- `ThemeContext`'s value is unmemoized — same pattern as Auth/Chat/Toast, smaller blast radius.
- An `eslint-disable` in `ThemeContext.tsx:71-74` suppresses a real missing dependency (`setPreference`); currently harmless only because that setter happens to be stable, with no lint protection if that ever changes.
- `ResultsMap`'s `FitBounds` helper uses `useMemo` to run a side effect (`map.setView`/`fitBounds`) instead of `useEffect` — works today, but `useMemo` isn't guaranteed to preserve results and shouldn't be used for side effects.

**Low**

- `NotificationCenter`'s today/earlier split recomputes unmemoized every render — bounded to ≤20 items, negligible.
- `MyPropertiesPage`'s owner-metric `reduce()`s run unmemoized — bounded to a page of 20, negligible.
- `SearchPage`'s `filters`/`activeChips` are rebuilt every render but verified not to actually break `PropertyCard` memoization (the underlying property objects keep stable references).

## Frontend: bundle size and code-splitting

**High**

- **Leaflet + react-leaflet ship eagerly via `SearchPage`.** *(Top 10 #6.)*
- **Framer Motion's full (non-tree-shaken) API is imported from eager-path files:** `main.tsx`, `Layout.tsx`, `HomePage.tsx`, `PropertyCard.tsx`, plus most `ui/` primitives reachable from them. 16 files import it total; none use `LazyMotion`/`m`. *(Top 10 #9.)*

**Medium**

- **No `manualChunks` / bundle-splitting config in `vite.config.ts`**, and no bundle-analyzer plugin installed — every KB figure in this report is a qualitative estimate, not a measurement, and there's currently no way to get a real one without wiring in `rollup-plugin-visualizer` or equivalent and running a real build.
- **`index.css` is a single 4,424-line, 84KB global stylesheet** with no critical-CSS or per-route splitting — ships in full on first paint regardless of which lazy-loaded page the user is on.

**Low / confirmed non-issues**

- `lucide-react` imports are consistently named/tree-shakeable across all 26 files — no wildcard imports found.
- `@capacitor/core` has zero source imports — confirmed not to enter the web build graph.
- No barrel/`index.ts` re-export files under `components/` or `api/` — no tree-shaking risk from that pattern.
- Minor duplicated date-formatting calls across 4 files (native `Intl`/`Date`, not a library) — negligible bundle cost, a maintainability note more than a performance one.

## Frontend: images and asset loading

**High**

- **No context-specific Cloudinary delivery transforms** — one resolution serves cards, gallery, thumbnails, chat chips, and lightbox alike. *(Top 10 #5.)*
- **No responsive images anywhere** — zero `srcset`/`sizes` usage in the codebase, compounding the above for high-DPR screens.

**Medium**

- **No client-side compression/resize before upload** — a 12MP phone photo (commonly 4-9MB) uploads at full size before Cloudinary ever downsizes it, for both property listing photos and chat image attachments. Only a 10MB server-side size cap exists.
- **Admin verification document images are missing `loading="lazy"`/`decoding="async"`** (`pages/admin/VerificationPage.tsx:88`) — the one inconsistent spot in an otherwise-consistent pattern everywhere else in the app.

**Low**

- CLS mitigation relies on CSS `aspect-ratio` rather than HTML width/height attributes — generally effective, but the list-view property card and the gallery thumbnail strip weren't confirmed to have an explicit ratio and are worth a targeted look.
- A couple of small, low-traffic thumbnails (home search-suggestion dropdown, single chat property chip) are marked `loading="lazy"` despite rendering immediately in view — harmless, just inconsistent with lazy-loading's intent.

**Confirmed correct / non-issues:** the property detail gallery's hero image is explicitly `loading="eager"` (correct — it's the likely LCP element); no oversized static/PWA assets found (48KB total in `public/`); no CSS data-URI bloat.

## Backend: queries, indexing, and caching

**High**

- **`PropertyDetailLoader` N+1 loop across four list endpoints.** *(Top 10 #1 — independently re-verified.)*
- **`BroadcastNotification` — up to 5,000 sequential single-row inserts** on one request. *(Top 10 #8.)*
- **Admin growth chart ignores its date-range parameter, full-scans on every call.** *(Top 10 #2 — independently re-verified.)*
- **`NotifySavedSearchesForProperty` — unbounded, unindexed platform-wide scan, awaited synchronously inside property approval.** *(Top 10 #10.)*
- **`ListConversations` — 2 extra queries per conversation row** (other-participant + property lookup), up to ~200 extra round trips on a full 100-item page. A batch method (`PropertyRepository.findManyByIds`) already exists for one side of this; `UserRepository` has no batch-by-IDs method at all.
- **Leading-wildcard `ILIKE` text search with no `pg_trgm` index**, across property search, admin property search, and admin user search. *(Top 10 #3.)*

**Medium**

- No composite index matching the dominant "published, sorted by newest" query shape — the existing partial index on `(status, deleted_at)` doesn't include `created_at`, so a sort step still runs after filtering. Degrades gradually rather than a hard scan, unlike the `ILIKE` issue above.
- Zero caching on the hottest read endpoints — `GET /properties` (search), `GET /properties/:id`, and every admin analytics endpoint have no cache headers and no server-side cache layer (no Redis/in-memory cache found anywhere), despite a `cacheControl` middleware already existing and being used on 3 lower-traffic routes.
- Chat typing indicator does 4 DB round trips per keystroke-relayed WebSocket event (conversation lookup, participant check, participant list — none cached) even though conversation membership rarely changes mid-conversation.
- The four N+1'd list endpoints (favorites, my-properties, recently-viewed, recommendations) also return full `PropertyDetailDTO` payloads (full description, entire image array) instead of the slim `PropertySummaryDTO` the search endpoint correctly uses — same root-cause fix resolves both the query count and the payload size.
- Connection pool is `max: 10` — not wrong in isolation, but combined with the N+1 and uncached-dashboard findings above, concurrent admin + user traffic will queue on it. Worth load-testing before resizing, not a standalone defect.

**Confirmed correct / non-issues:** `SearchProperties.usecase.ts` and `UserRepository.search()` both correctly batch related data; geo radius search uses a proper bounding-box pre-filter before the exact Haversine calculation; every list endpoint's page size is server-side capped via zod validators (no unbounded-query gap); the WebSocket gateway targets specific recipients, not broadcast-to-all; bcrypt cost factor (12) is reasonable and non-blocking.

---

## Suggested execution order

The four fixes with the best impact-to-risk ratio, in order: (1) reuse `SearchProperties`' batched-fetch pattern for the four N+1'd list endpoints instead of looping `PropertyDetailLoader` — same fix resolves both the query explosion and the oversized payloads; (2) add the missing date-range `WHERE` to the growth-chart subquery and put a short-TTL cache in front of the three uncached analytics endpoints; (3) enable `pg_trgm` and add GIN indexes for the three `ILIKE` search paths; (4) memoize `ToastContext`'s value and debounce the two un-debounced search inputs — both small, contained frontend changes with an immediately visible effect on every property grid and every search keystroke in the app.
