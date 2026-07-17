# RentIt — Release Candidate RC1

**Status:** Feature freeze. No new features are in scope from this point forward — only Critical/High-severity bug fixes may still land before final sign-off.
**Base:** builds on `docs/release-v1.0/` (git `master`, last commit `c3e9e77`, 2026-07-12) plus everything below.

## What's in RC1 beyond v1.0

**Design refresh (Phases 2–4).** A full visual redesign on top of v1.0's functionality: a shared design-token/primitive system, Framer Motion micro-interactions, a rebuilt Search experience (accordion filters, removable filter chips, grid/list/map view toggle), a real Notification Center, light/dark/auto theme toggle, sticky translucent header, richer chat (image previews, inline property cards in threads), recent-searches memory, an expanded component library (Avatar, Dropdown, Popover, Progress, Alert, Carousel, StatCard), an accessibility pass (focus-visible, reduced-motion, ARIA sweep), owner-facing analytics, admin analytics charts, "sign out of all devices," live instant search suggestions, a PWA install prompt, infinite scroll with image lazy-loading, and swipe-to-favorite/pull-to-refresh gestures. Purely additive to v1.0's feature set — no backend contract changes.

**Full QA and audit pass.** Independent sweeps across the whole app: page/form/button logic, every frontend API module against backend routes, navigation/route-guard correctness, responsive layout, performance (React render behavior, bundle size/code-splitting, image loading, backend query patterns), security (auth/JWT/rate-limiting, uploads/payments, authorization/CORS/CSRF/headers, XSS/SSRF/SQLi), leaked-secrets, logging hygiene, and cryptographic usage. Findings were merged into a single deduped backlog and triaged by severity.

**Critical/High fixes applied this cycle** (16 items, full detail in `docs/master-backlog.md`):

- JWT boot guard closed a fail-open gap: any `NODE_ENV` other than `development` now requires `JWT_ACCESS_SECRET` to be set, not just `production`.
- Closed a self-publish authorization bypass on property status changes — publishing and reactivating an admin-hidden listing now require an admin role.
- Fixed N+1 query loops on Favorites, My Properties, Recently Viewed, and Recommendations (batched owner/image/feature/favorite lookups instead of one round trip per property).
- Bounded the admin growth-chart query to its actual date window instead of scanning the full history table on every request.
- Added trigram (`pg_trgm`) indexes so leading-wildcard city/name/email/phone searches can use an index instead of a full scan.
- Batched `BroadcastNotification`'s up-to-5,000-row insert into one bulk `INSERT ... unnest()` instead of 5,000 sequential round trips.
- Indexed and batched `NotifySavedSearchesForProperty` so approving a listing no longer synchronously blocks on an unindexed full-table scan.
- Fixed a chat-list N+1 (2 extra queries per conversation) with batched, Map-joined lookups.
- Memoized `ToastContext`'s value so favoriting one property card no longer re-renders every other card on the page.
- Debounced the Search page's city/locality inputs and the admin Users search box (were firing a network request per keystroke).
- Converted the Search page's Leaflet map to a lazy-loaded chunk, out of the eager bundle.
- Converted Framer Motion usage on every always-mounted component to its tree-shakeable `m`/`LazyMotion` form, splitting the animation engine into its own async chunk.
- Added Cloudinary delivery-time transforms and `srcset`/`sizes` so a card thumbnail no longer downloads the same master-resolution file as the full detail hero.
- Memoized `ChatContext`'s value and its `send` function (was re-rendering the nav and any open thread on every unread-count change).
- Extracted chat message bubbles into a memoized component so typing in the composer no longer re-formats every message's timestamp.
- Fixed a stale-closure bug in Search's infinite-scroll `IntersectionObserver` that could fetch more results against a filter set the user had already changed away from.

**Regressions found and fixed during RC1 hardening.** A dedicated regression audit of the 16 fixes above (plus a follow-up type-check pass) turned up five real issues, all fixed before this release candidate:

1. **Critical** — `LazyMotion`'s `strict` mode crashed `AddPropertyPage` and the `Modal` component (used by Profile) in dev, because two intentionally-unconverted files still used plain `motion.*` inside the strict boundary. Fixed by dropping `strict` (the async code-splitting benefit is unaffected).
2. **Medium** — the admin growth chart's new date filter used an exact timestamp lower bound while its `generate_series` used a day-floored one, silently undercounting the oldest day in every chart. Fixed by aligning both bounds.
3. **Medium** — the Search page's debounced city/locality inputs could revert an unrelated filter change made within the 400ms debounce window, due to a stale closure. Fixed by switching to `setSearchParams`'s functional-updater form.
4. **Medium** — the new batched owner lookup (`findManyByIds`) filtered out soft-deleted users while the single-item lookup it replaced didn't, breaking the documented "identical output" guarantee between the two code paths for that edge case. Fixed by aligning the filters.
5. **High** — a follow-up full `tsc` pass (see Verification below) caught that `lazyNamed`'s loosely-typed return silently dropped the `items` prop from the lazy-loaded Search map component. Fixed by making the utility properly generic; no other call site needed changes.

## Verification

- **Backend TypeScript:** `npx tsc --noEmit` — clean, 0 errors.
- **Backend production build:** `npm run build` — succeeds.
- **Backend ESLint / tests:** 31 test files, all type-check cleanly against the real compiler. The test *runner* cannot execute in this build environment specifically (a pre-existing `esbuild` native-binary platform mismatch — `@esbuild/darwin-arm64` is installed but this sandbox needs `@esbuild/linux-arm64`, and it has no package-registry access to correct it). **Run `npm run test:unit` for real in the target environment before final sign-off** — this is a build-environment gap, not a code issue.
- **Frontend TypeScript:** `npx tsc -b --noEmit` — 0 errors beyond `lucide-react`/`framer-motion`/`leaflet`/`react-leaflet` module-resolution errors, which are a pre-existing gap (these packages are declared in `package.json` but a real `npm install` has never been run in this build environment — see "No committed npm lockfiles" below, carried over from v1.0). No other type errors.
- **Frontend ESLint:** `npx eslint src --ext ts,tsx --max-warnings 0` — clean, 0 warnings.
- **Frontend production build:** `npm run build` chains `tsc -b && vite build`; blocked at the `tsc -b` step by the same missing-package gap, so `vite build` has not actually run in this environment. Added a vendor chunk split (`react`/`react-dom`/`react-router-dom`) to `vite.config.ts` as a safe, additive build-config optimization; **actual bundle output and chunk sizes need to be confirmed with a real `npm install` + `npm run build`.**

## Known limitations going into RC1 (carried over from v1.0, still true)

- **No committed npm lockfiles.** Every phase of this build, including RC1, has run in a sandbox with no package-registry access, so `npm install` has never actually been run for real in `backend/` or `frontend/`. This is the root cause of every "can't verify" item above. Run a real `npm install` in both directories and commit the resulting lockfiles before anything further.
- **No real Android/iOS builds.** Capacitor is configured but generating native projects needs Android Studio/Xcode.
- **App icon is still a placeholder**, not a designed brand asset.
- **No real browser/Lighthouse/axe pass**, and specific to RC1: **Framer Motion animations have not been visually confirmed** and the two new database migrations (trigram indexes, saved-searches partial index) have not been run against a live Postgres instance — both are low-risk (an import-path change and additive, non-destructive index migrations respectively) but should get a quick manual check in a real environment before shipping.

See `DEPLOYMENT_CHECKLIST.md` for the concrete steps to take this from "code complete" to "actually deployed."
