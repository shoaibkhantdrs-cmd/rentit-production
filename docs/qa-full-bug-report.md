# RentIt — Full QA Bug Report

Static, read-only QA pass across every page, form, button, API call, nav target, and responsive breakpoint. No fixes applied — bugs only, per request. Findings marked "possible" need visual/browser confirmation (this pass had no running dev server available); everything else is confirmed by tracing the actual code paths, and the three most severe items below were independently re-verified line-by-line.

## Critical

**1. Search page is unusable on any screen ≤900px wide.**
`frontend/src/pages/SearchPage.tsx:518` renders `<aside className="filters-v2">` unconditionally — there's no state or CSS class toggling it. `frontend/src/index.css:2821-2830` then turns `.filters-v2` into a fixed, full-bleed panel at ≤900px (`position: fixed; inset: 0; max-height: 85vh; z-index: 50`) with no close button anywhere in that markup and no `display: none`. The app already built a working mobile solution — a `Drawer` component wired to a `mobileFiltersOpen` state (`SearchPage.tsx:667`, `82`) — but the old fixed-position filter panel was never removed alongside it. Net effect: on any phone or small tablet, opening Search shows a permanent bottom sheet covering the bottom 85% of the screen, on top of the results, with no way to dismiss it.

**2. The header "Sign in" button doesn't lead to a sign-in form.**
`frontend/src/components/Layout.tsx:159-161` — the primary "Sign in" CTA shown to every logged-out visitor is `<NavLink to="/search">`. There is no `/login` route in the app; the only place `AuthPanel` (the actual login/OTP form) ever renders is as the fallback inside `RequireAuth`/`RequireAdmin`-gated pages (`RequireAuth.tsx:10`, `RequireAdmin.tsx:15`). `/search` is not gated. Clicking "Sign in" just navigates to Search with no login form anywhere on it. The mobile bottom-nav "Profile" tab has the same bug (`Layout.tsx:233`, also routes to `/search` when logged out).

## High

**3. Admin role-management screen has no protection against double-clicks racing with failed requests being reported as success.** *(class of bug — already fixed once for delete/role-update; two more confirmed instances below.)*

**4. `SavedSearchesPage.tsx:36-47`** — `remove()` clears its `busy` (disabled) state only in the `catch` branch, not in a `finally`. On success it relies entirely on the parent re-fetch removing the row; if that re-fetch is slow or doesn't remove the row, the Delete button is stuck disabled with no way to retry. (`toggleNotify` in the same file, lines 23-34, does this correctly with `finally`.)

**5. `ComparePage`-adjacent: `AddPropertyPage.tsx:386-407`** — a "Saving your draft..." loading message is gated on `step === 4 && creating`, but `setStep(step + 1)` and `setCreating(false)` are set inside the same async continuation (`goNext`, lines 174-193) and get batched into one React 18 render — `step` never equals 4 while `creating` is still true. This loading message can never actually appear on screen; users see nothing during the draft-save request.

**6. `ConversationThreadPage.tsx:170-176`** — "Load earlier messages" (button at 244-246) has no disabled/loading guard and no error handling. Rapid clicks fire concurrent, unordered page-2/3/4 requests that can interleave and land messages out of order; a failed request becomes a silent unhandled rejection with no user feedback.

**7. `ConversationThreadPage.tsx:197-207`** — per-message delete button has no busy state either; repeated clicks on the same message can fire multiple concurrent delete requests for the same message ID.

**8. `AddPropertyPage.tsx:119-121`** — if the categories fetch fails, it's swallowed to an empty array with no error UI (`PropertyForm.tsx`'s equivalent flow does show a `categoriesError`). Since step-1 validation requires a category to be selected, a failed fetch leaves the user stuck on step 1 with an empty dropdown, "Next" permanently disabled, and no explanation why.

**9. `HomePage.tsx:127-146`** — the hero search-suggestions fetch only cancels the pending `setTimeout`, not the in-flight request itself. If an earlier keystroke's request resolves after a later one, its results overwrite the dropdown with suggestions for a city the user already typed past.

**10. `PaymentHistoryPage.tsx:20, 59-84`** — the invoices section only handles `status === "success"`. While loading it shows nothing (no skeleton, unlike the payments table above it on the same page); on error it renders completely blank with no message and no retry.

## Medium

**11. `PropertyDetailsPage.tsx:561-577`** — "Similar properties" recommendations have no error branch; a failed request makes the whole section silently vanish (contrast with the main property fetch on the same page, which does show `ErrorState` + retry).

**12. `ConversationThreadPage.tsx:42`** — the current conversation's header/property-chip lookup hardcodes a 100-item page (`chatApi.listConversations(1, 100)`) to find the open thread's summary by ID. Accounts with more than 100 conversations will silently lose the thread header name, property chip, and rent display for any conversation outside that first page.

**13. `PropertyDetailsPage.tsx:487-494`** — the "share via WhatsApp" phone number field only checks for non-empty (`!sharePhone.trim()`); despite a `+91XXXXXXXXXX`-formatted placeholder, any string is accepted and sent to the backend, with whatever error the backend returns as the only feedback.

**14. `frontend/src/api/types.ts:202-205`** — `UpdatePropertyPayload`'s `status` field is typed as the full `PropertyStatus` union, which includes `"rejected"` — but the backend's `updatePropertySchema` (`backend/.../validators/property.schemas.ts:27`) does not accept `"rejected"` on update. Nothing currently constructs this payload with that value (`EditPropertyPage.tsx` uses its own narrower local list), but the shared type allows a call that would 400 at runtime for any future caller.

**15. `frontend/src/api/types.ts:202-205`** — the same `UpdatePropertyPayload` type can't express clearing `floorNumber`, `totalFloors`, or `facing` back to empty (typed as `number | undefined` / `Facing | undefined`, no `null`), even though the backend's schema explicitly accepts `null` for all three to support clearing them on edit. There's no way through the typed API client to clear these fields once set.

**16. `frontend/src/components/CompareBar.tsx:15-29` vs `.bottom-nav`** — CompareBar is fixed at `bottom: 20px` with `z-index: 60`; the mobile bottom-nav (`index.css:3841-3853`) is fixed at `bottom: 0` with a taller real footprint and `z-index: 90`. On any mobile page where both are visible (e.g. Search or Favorites with items queued to compare), the bottom-nav renders on top of CompareBar, obscuring its Compare/clear buttons.

**17. `index.css:3841-3875`** — `.bottom-nav`'s own padding accounts for `env(safe-area-inset-bottom)`, but `body`'s reserved `padding-bottom: 56px` does not. On notched/home-indicator phones the real nav bar is taller than 56px, so the last ~30-some px of scrollable page content renders behind it.

**18. `index.css:1999-2015` + `HomePage.tsx:216-249`** — the home hero's search-suggestions dropdown (`.search-suggest`, `index.css:2085-2099`) is positioned with `right: -140px` inside `.hero-v2`, which has `overflow: hidden`. Only viewports ≤640px get a corrective override (`right: 0` at `index.css:2158-2162`); at every width from 641px up to desktop, part of the autocomplete list/thumbnails is clipped by the hero's rounded edge instead of extending past it as intended.

## Low / needs visual confirmation

**19.** `frontend/src/components/NotificationCenter.tsx:80` — notification popover is a fixed 340px wide (`Popover.tsx:32-41`) with no max-width clamp or mobile override; on ~360px-wide phones it likely overflows past the left edge of the screen. *(possible — exact overflow depends on the trigger icon's position in the header.)*

**20.** `index.css:3519-3528` — `.toast-stack` is fixed at `right: 20px` with `max-width: 360px` and no `left` bound; on a 375px viewport a toast approaching its max width would extend a few pixels past the left edge. *(possible — depends on message length.)*

**21.** Touch targets below the ~40px guideline: `.chat-image-preview__remove` at 24×24px (`index.css:4180-4192`, chat composer's "remove attached image" button), `.footer-v2__social a` at 34×34px (`index.css:3092-3101`), `.property-card-v2__fav` at 36×36px (`index.css:2412-2432`, used on every property card at every breakpoint).

**22.** `frontend/src/api/admin.ts` has no client functions for the backend's `/admin/payments`, `/admin/payments/:id/refunds`, `/admin/payments/:id/refund` routes (`admin.routes.ts:232-247`). Not a broken call — just a real gap between what the backend exposes and what any admin screen can currently reach.

**23.** `AuthContext.tsx:39-63` — the dev-only auto-login effect runs asynchronously after mount, so `RequireAuth`/`RequireAdmin`-gated routes render their signed-out fallback for one frame before the dev auto-login resolves. Explicitly scoped to `import.meta.env.DEV` (dead in production builds) — flagged for completeness only.

---

**Total: 23 findings** — 2 critical, 8 high, 8 medium, 5 low/needs-confirmation. Independently re-verified line-by-line: #1 (filters overlay), #2 (Sign in → /search), #5 (unreachable loading state). All others carry the confidence level noted by the auditing pass; nothing here has been fixed.
