# RentIt — Release Candidate 1 (RC1) Bug Report

Scope per request: fix bugs, remove dead code/duplicate CSS, fix lint/TS warnings, verify every route/API/page. No new features, no redesign. No backend, API contract, auth, routing, or business-logic changes.

Final verification (both clean):
- `tsc -p tsconfig.app.json --pretty false` — 0 errors
- `eslint src --ext ts,tsx --max-warnings 0` — 0 warnings

## 1. Bugs fixed

| # | File | Bug | Fix |
|---|------|-----|-----|
| 1 | `src/api/admin.ts`, `src/api/httpClient.ts` | `adminApi.updateUserRoles` called `httpClient.patch()`, but the backend route (`admin.routes.ts:111`) is registered as `router.put(...)`. Frontend had no `put()` method at all — every role-update request from the admin panel would 404/405. | Added a `put()` method to `httpClient` and switched the call site to it. Verified request body shape already matched `admin.schemas.ts`'s `updateUserRolesSchema`. No backend change. |
| 2 | `src/pages/admin/UserDetailPage.tsx` | `runAction()` swallowed errors internally and never rethrew. Both call sites chained `.then(() => sideEffect())`, so a **failed** delete-user or role-update still ran its success side effect (navigating away / clearing selection) as if it had succeeded. | `runAction` now returns `Promise<boolean>` (`true` on success, `false` on caught error); both call sites check the resolved value before running the side effect. |
| 3 | `src/pages/admin/ReportsPage.tsx` | Same pattern: `ban()` swallowed errors, so a failed ban still resolved the report as "action_taken". | Same fix — `ban()` returns `Promise<boolean>`, call site checks it before resolving the report. |
| 4 | `src/pages/ComparePage.tsx` | `Promise.all(ids.map(propertiesApi.getById))` had no `.catch()`. Any single failed fetch (e.g. a deleted/404 property still in the compare list) produced an unhandled promise rejection and left the page stuck silently loading. | Added `.catch()`, an `error` state, and an `ErrorState` + retry render branch, matching the pattern already used elsewhere in the app. |
| 5 | `src/pages/AddPropertyPage.tsx` | The list-property wizard had no role check. A signed-in renter (no `property_owner`/`admin`/`super_admin` role) could open `/properties/new` and fill out the entire wizard before hitting a backend 403 on submit. | Added a `RequireListingRole` gate (mirrors the existing `RequireAdmin` pattern) that shows an `EmptyState` instead of the wizard for accounts without a listing-capable role. |
| 6 | `src/pages/PropertyDetailsPage.tsx` | `submitReport` had no auth guard, unlike the sibling `toggleFavorite`/`startChat` actions on the same page — an unauthenticated user clicking "Report" got a raw API error toast instead of a sign-in prompt. | Added the same `isAuthenticated` early-return + "Sign in to report this listing." toast used by the other two actions. |

## 2. Dead code removed

Four component files confirmed to have zero importers anywhere in `src` (verified by grep, not assumption):

- `src/components/ui/Alert.tsx`
- `src/components/ui/Button.tsx`
- `src/components/ui/Progress.tsx`
- `src/components/ui/Tooltip.tsx`

The Downloads folder's filesystem doesn't allow deleting files from this environment (cross-device `rm` is blocked), so these were renamed to `*.tsx.removed`, which excludes them from both the TS build and ESLint's scope. You can delete the four `.removed` files directly on your Mac whenever convenient.

`src/components/ui/Badge.tsx` was flagged as dead by one internal audit pass but that was wrong — it's imported live by `pages/ProfilePage.tsx:24`. Verified independently and left in place.

## 3. Duplicate CSS removed

- `src/index.css` — two `:focus-visible` rule blocks existed. Removed the older, thinner duplicate; kept the fuller one (which additionally sets `border-radius: 4px`) and left a comment pointing to it.

### Duplication found but intentionally NOT touched

Consolidating these would mean changing which components/classes pages actually render — that's a redesign, not a bugfix, so it's left for a future pass:

- **Three parallel pill/badge systems**: `.status-pill` (CSS + component), inline `.pill-badge` markup, and the unused `Badge.tsx` component.
- **Three `StatCard` implementations**: `components/ui/StatCard.tsx`, a separately-defined `StatCard` inside `admin/AdminWidgets.tsx`, and hand-rolled inline markup in `ProfilePage.tsx` that never adopted `ui/StatCard.tsx` despite that component's doc comment saying it would.
- Softer near-duplicate card styling across `.card` / `.testimonial-card` / `.wizard-card`.

## 4. Lint / TypeScript warnings

All 5 pre-existing `react-refresh/only-export-components` warnings fixed (`Toast.tsx`, `AuthContext.tsx`, `ChatContext.tsx`, `CompareContext.tsx`, `ThemeContext.tsx`) using the project's existing `eslint-disable-next-line` pattern — each hook is intentionally colocated with its provider, so the directive documents that rather than forcing a file split. `tsc` had 0 errors before and after; `eslint` now reports 0 warnings (was 5).

## 5. Bundle size

- Checked for unused dependencies: `@capacitor/core` has zero direct source imports in `src`, but `@capacitor/android` and `@capacitor/ios` (used by the real `cap:sync`/`cap:add:*`/`cap:open:*` npm scripts already in `package.json`) both declare `@capacitor/core@^6.2.0` as a `peerDependency`. It's required native-build tooling, not dead weight — left in place.
- Route-level code splitting verified intact: `App.tsx` still lazy-loads every page except Home/Search/PropertyDetails (deliberately kept eager for direct/cold links) and the entire `/admin` subtree. None of the RC1 fixes above added new eager imports.
- Real bundle measurement (`vite build` stats) isn't possible in this sandbox — no `npm install`/build execution available here. Recommend running `npm run build -- --mode production` with a bundle analyzer locally before shipping RC1 to confirm chunk sizes.

## 6. Route / API / page verification

- Every route declared in `App.tsx` resolves to an existing page component with a matching lazy or eager import — no broken imports, no orphaned routes.
- Every page-level `api/*.ts` call was cross-checked against its backend route file; the PATCH/PUT mismatch above (#1) was the only contract break found. All other calls match their backend route method, path, and request/response shape.
- All pages typecheck and lint clean as part of the full-tree passes above (a type error or unresolved import in any page would surface in the whole-tree `tsc`/`eslint` run, so this doubles as a page-level check).

## Known gaps (not bugs — out of scope for RC1)

A handful of backend endpoints exist with no frontend consumer yet (forgot/reset-password, `GET/PATCH/DELETE /users/me`, admin payments/refunds view). These are incomplete feature coverage, not defects, and weren't touched — building UI for them would be a new feature, which this pass explicitly excludes.
