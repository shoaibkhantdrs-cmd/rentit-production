# RentIt — QA Bug Fixes: Final Verification

All 23 items from `qa-full-bug-report.md` addressed. No new features, no redesign — every fix stays within existing routes, existing API contracts, and existing visual language.

## Build health

- `tsc -p tsconfig.app.json --pretty false` — **0 errors**
- `eslint src --ext ts,tsx --max-warnings 0` — **0 warnings**

## Status of each bug

| # | Bug | Status | Fix |
|---|-----|--------|-----|
| 1 | Search page unusable ≤900px (unclosable filter overlay) | **Fixed** | `.filters-v2` hidden at ≤900px (`index.css`) — the mobile `Drawer` + `mobileFiltersOpen` trigger already covered mobile filtering; the old fixed-position sidebar was dead weight left rendering on top of it. |
| 2 | "Sign in" CTA / mobile Profile tab link to `/search` (no login form) | **Fixed** | Both now point to `/profile`, the existing `RequireAuth`-gated route that renders `AuthPanel` when signed out (`Layout.tsx`). |
| 3 | *(class of bug, not a separate item)* | — | Covered by #1/#2 above plus the already-fixed PATCH→PUT bug from RC1. |
| 4 | `SavedSearchesPage` delete button stuck disabled after a slow reload | **Fixed** | `remove()` now clears `busy` in a `finally`. |
| 5 | Unreachable "Saving your draft..." branch in `AddPropertyPage` | **Fixed** | Removed the dead branch; the footer's "Saving..." button label already covers this state. |
| 6 | `ConversationThreadPage` "Load earlier messages" — no guard, no error handling | **Fixed** | Added busy guard + disabled state + error message. |
| 7 | Per-message delete — no guard against concurrent double-delete | **Fixed** | Added a `deletingMessageId` guard + disabled state on the button. |
| 8 | `AddPropertyPage` categories fetch failure left step 1 stuck silently | **Fixed** | Added `categoriesError` state + inline message, matching `PropertyForm.tsx`'s existing pattern. |
| 9 | Home hero search-suggestion race condition (stale response overwrite) | **Fixed** | Added a `cancelled` guard so only the latest request's result can apply. |
| 10 | `PaymentHistoryPage` invoices section had no loading/error states | **Fixed** | Added both, matching the payments table above it on the same page. |
| 11 | "Similar properties" silently vanished on error | **Fixed** | Added an inline error branch. |
| 12 | Conversation header/property-chip lost for accounts with 100+ conversations | **Fixed** | Walks subsequent pages of the existing `listConversations` endpoint (bounded to 20 pages) instead of giving up after page 1. |
| 13 | WhatsApp share phone field accepted any string | **Fixed** | Added the same E.164 check the backend enforces, with inline feedback. |
| 14 | `UpdatePropertyPayload.status` allowed `"rejected"` (backend rejects it) | **Fixed** | Narrowed to `UpdatablePropertyStatus = Exclude<PropertyStatus, "rejected">`; `EditPropertyPage`'s status-change handler updated to match. |
| 15 | Type gap: couldn't clear `floorNumber`/`totalFloors`/`facing` via the typed client | **Fixed** | Those three fields now accept `null`, matching the backend's schema. |
| 16 | `CompareBar` obscured by the mobile bottom-nav | **Fixed** | Moved from inline styles to a `.compare-bar` class with a mobile override that lifts it above the nav's real height. |
| 17 | `body` bottom padding didn't account for the safe-area inset | **Fixed** | Now `calc(56px + env(safe-area-inset-bottom))`, matching the nav's own padding. |
| 18 | Home search-suggestion dropdown clipped by the hero's `overflow: hidden` | **Fixed** | Dropdown now matches the field's width (`right: 0`) instead of overhanging past it; removed the now-redundant mobile-only override. |
| 19 | Notification popover could overflow narrow phones | **Fixed** | `.popover-panel` now has `max-width: calc(100vw - 24px)`. |
| 20 | Toast stack could overflow the left edge on narrow phones | **Fixed** | `max-width` now `min(360px, calc(100vw - 40px))` — unchanged on desktop, clamped on narrow screens. |
| 21 | Three touch targets under the ~40px guideline | **Fixed** | Property-card favorite button grown to 40px; footer social icons and the chat image-remove button keep their visual size but get an invisible expanded hit area. |
| 22 | No frontend API coverage for `/admin/payments*` routes | **Not fixed — out of scope** | Building the client functions with no admin UI to call them is dead code; building the UI too would be a new feature. Left as a documented gap, not a defect in reachable code. |
| 23 | Dev-only auth flash (RequireAuth/RequireAdmin flash before dev auto-login resolves) | **Fixed** | Added `authReady` to `AuthContext` (always `true` synchronously in production — zero behavior change for real users); `RequireAuth`/`RequireAdmin` wait for it before rendering. |

## Net result

22 of 23 bugs fixed. #22 is intentionally left as a documented gap rather than "fixed," since either possible fix (dead client code or new admin UI) would violate the "no new features" constraint for this pass.
