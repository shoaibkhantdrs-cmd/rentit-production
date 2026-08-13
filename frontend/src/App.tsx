import { ReactNode, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { HomePage } from "@/pages/HomePage";
import { SearchPage } from "@/pages/SearchPage";
import { PropertyDetailsPage } from "@/pages/PropertyDetailsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { lazyNamed } from "@/utils/lazyNamed";

// Phase 2 (performance): Home, Search, and a property's own detail page are
// the three most-trafficked, most-often-directly-linked-to destinations in
// the app (search engines and shared links land on Property Details
// directly), so they stay in the main bundle -- lazy-loading them would add
// a network round-trip to the very pages where that round-trip is most
// visible. Every other page below is reached by clicking through the app
// first (never a cold direct load), so it's fair game to split into its
// own chunk and fetch on demand.
const AddPropertyPage = lazyNamed(() => import("@/pages/AddPropertyPage"), "AddPropertyPage");
const EditPropertyPage = lazyNamed(() => import("@/pages/EditPropertyPage"), "EditPropertyPage");
const MyPropertiesPage = lazyNamed(() => import("@/pages/MyPropertiesPage"), "MyPropertiesPage");
const FavoritesPage = lazyNamed(() => import("@/pages/FavoritesPage"), "FavoritesPage");
const VerificationStatusPage = lazyNamed(() => import("@/pages/VerificationStatusPage"), "VerificationStatusPage");
const ConversationsPage = lazyNamed(() => import("@/pages/ConversationsPage"), "ConversationsPage");
const ConversationThreadPage = lazyNamed(() => import("@/pages/ConversationThreadPage"), "ConversationThreadPage");
const SavedSearchesPage = lazyNamed(() => import("@/pages/SavedSearchesPage"), "SavedSearchesPage");
const NotificationPreferencesPage = lazyNamed(
  () => import("@/pages/NotificationPreferencesPage"),
  "NotificationPreferencesPage",
);
const PremiumPlansPage = lazyNamed(() => import("@/pages/PremiumPlansPage"), "PremiumPlansPage");
const PaymentHistoryPage = lazyNamed(() => import("@/pages/PaymentHistoryPage"), "PaymentHistoryPage");
const BoostListingPage = lazyNamed(() => import("@/pages/BoostListingPage"), "BoostListingPage");
const ComparePage = lazyNamed(() => import("@/pages/ComparePage"), "ComparePage");
const ProfilePage = lazyNamed(() => import("@/pages/ProfilePage"), "ProfilePage");
// Roadmap Item 1: static legal/support pages -- low-traffic, never a cold
// direct-load target the way Home/Search/Property Details are, so they
// follow the same lazy-split pattern as every other secondary page above.
const PrivacyPolicyPage = lazyNamed(() => import("@/pages/PrivacyPolicyPage"), "PrivacyPolicyPage");
const TermsOfServicePage = lazyNamed(() => import("@/pages/TermsOfServicePage"), "TermsOfServicePage");
const ContactPage = lazyNamed(() => import("@/pages/ContactPage"), "ContactPage");
const CookiePolicyPage = lazyNamed(() => import("@/pages/CookiePolicyPage"), "CookiePolicyPage");
// Pre-launch footer audit: the COMPANY footer column (About/Careers/Press/
// Blog) previously linked all four to href="/" -- these are the real pages
// that fix that. Same lazy-split treatment as the legal pages above, since
// none of these are a cold direct-load target either.
const AboutPage = lazyNamed(() => import("@/pages/AboutPage"), "AboutPage");
const CareersPage = lazyNamed(() => import("@/pages/CareersPage"), "CareersPage");
const PressPage = lazyNamed(() => import("@/pages/PressPage"), "PressPage");
const BlogPage = lazyNamed(() => import("@/pages/BlogPage"), "BlogPage");

function PageFallback() {
  return (
    <div className="page-header">
      <div className="skeleton skeleton--title" style={{ width: "30%" }} />
    </div>
  );
}

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

// Phase 6 Part 3 (performance): the entire admin section is code-split
// into its own chunk. It's only ever reached by admin users behind
// AdminLayout's own role gate, so every regular renter/owner's initial
// bundle no longer has to download or parse it. A single Suspense
// boundary around the whole /admin subtree (below) shows one loading
// state for the chunk fetch rather than one per page.
const AdminLayout = lazyNamed(() => import("@/components/admin/AdminLayout"), "AdminLayout");
const DashboardPage = lazyNamed(() => import("@/pages/admin/DashboardPage"), "DashboardPage");
const UsersPage = lazyNamed(() => import("@/pages/admin/UsersPage"), "UsersPage");
const UserDetailPage = lazyNamed(() => import("@/pages/admin/UserDetailPage"), "UserDetailPage");
const PropertiesPage = lazyNamed(() => import("@/pages/admin/PropertiesPage"), "PropertiesPage");
const PropertyModerationHistoryPage = lazyNamed(
  () => import("@/pages/admin/PropertyModerationHistoryPage"),
  "PropertyModerationHistoryPage",
);
const ReportsPage = lazyNamed(() => import("@/pages/admin/ReportsPage"), "ReportsPage");
const VerificationPage = lazyNamed(() => import("@/pages/admin/VerificationPage"), "VerificationPage");
const NotificationsPage = lazyNamed(() => import("@/pages/admin/NotificationsPage"), "NotificationsPage");
const AnalyticsPage = lazyNamed(() => import("@/pages/admin/AnalyticsPage"), "AnalyticsPage");
const AuditLogsPage = lazyNamed(() => import("@/pages/admin/AuditLogsPage"), "AuditLogsPage");

function AdminSectionFallback() {
  return (
    <div className="page-header">
      <div className="skeleton skeleton--title" style={{ width: "30%" }} />
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/properties/new" element={<Lazy><AddPropertyPage /></Lazy>} />
        {/* Production bug fix: "My Properties" has always lived at
            /my-properties (see the route below and every in-app Link/
            navigate() to it -- Layout.tsx, AddPropertyPage.tsx,
            PropertyDetailsPage.tsx, ProfilePage.tsx). No route ever existed
            for /properties/mine, so that literal path fell through to
            /properties/:id below with id="mine", which made
            PropertyDetailsPage call GET /properties/mine expecting a single
            PropertyDetail -- but the backend resolves that exact path to
            the *list* endpoint (GetMyPropertiesUseCase), returning a
            paginated {items, total, ...} body instead. PropertyDetailsPage
            then rendered that mismatched shape as if it were a property
            (e.g. property.status.replace(...) with no `status` key present),
            throwing and white-screening. Nothing in the app ever links to
            /properties/mine, so real users never hit this via normal
            navigation, but the exact URL is a live production crash if
            reached directly (bookmark, shared link, crawler). Redirecting
            it to the real route closes that gap without touching the
            PropertyDetailsPage rendering logic or any backend code. */}
        <Route path="/properties/mine" element={<Navigate to="/my-properties" replace />} />
        <Route path="/properties/:id" element={<PropertyDetailsPage />} />
        <Route path="/properties/:id/edit" element={<Lazy><EditPropertyPage /></Lazy>} />
        <Route path="/my-properties" element={<Lazy><MyPropertiesPage /></Lazy>} />
        <Route path="/favorites" element={<Lazy><FavoritesPage /></Lazy>} />
        <Route path="/verification" element={<Lazy><VerificationStatusPage /></Lazy>} />
        <Route path="/messages" element={<Lazy><ConversationsPage /></Lazy>} />
        <Route path="/messages/:id" element={<Lazy><ConversationThreadPage /></Lazy>} />
        <Route path="/saved-searches" element={<Lazy><SavedSearchesPage /></Lazy>} />
        <Route path="/notification-preferences" element={<Lazy><NotificationPreferencesPage /></Lazy>} />
        <Route path="/premium-plans" element={<Lazy><PremiumPlansPage /></Lazy>} />
        <Route path="/payment-history" element={<Lazy><PaymentHistoryPage /></Lazy>} />
        <Route path="/properties/:id/boost" element={<Lazy><BoostListingPage /></Lazy>} />
        <Route path="/compare" element={<Lazy><ComparePage /></Lazy>} />
        <Route path="/profile" element={<Lazy><ProfilePage /></Lazy>} />
        <Route path="/privacy-policy" element={<Lazy><PrivacyPolicyPage /></Lazy>} />
        <Route path="/terms" element={<Lazy><TermsOfServicePage /></Lazy>} />
        <Route path="/contact" element={<Lazy><ContactPage /></Lazy>} />
        <Route path="/cookie-policy" element={<Lazy><CookiePolicyPage /></Lazy>} />
        <Route path="/about" element={<Lazy><AboutPage /></Lazy>} />
        <Route path="/careers" element={<Lazy><CareersPage /></Lazy>} />
        <Route path="/press" element={<Lazy><PressPage /></Lazy>} />
        <Route path="/blog" element={<Lazy><BlogPage /></Lazy>} />
      </Route>

      <Route
        path="/admin"
        element={
          <Suspense fallback={<AdminSectionFallback />}>
            <AdminLayout />
          </Suspense>
        }
      >
        <Route
          index
          element={
            <Suspense fallback={<AdminSectionFallback />}>
              <DashboardPage />
            </Suspense>
          }
        />
        <Route
          path="users"
          element={
            <Suspense fallback={<AdminSectionFallback />}>
              <UsersPage />
            </Suspense>
          }
        />
        <Route
          path="users/:id"
          element={
            <Suspense fallback={<AdminSectionFallback />}>
              <UserDetailPage />
            </Suspense>
          }
        />
        <Route
          path="properties"
          element={
            <Suspense fallback={<AdminSectionFallback />}>
              <PropertiesPage />
            </Suspense>
          }
        />
        <Route
          path="properties/moderation-history"
          element={
            <Suspense fallback={<AdminSectionFallback />}>
              <PropertyModerationHistoryPage />
            </Suspense>
          }
        />
        <Route
          path="properties/:id/history"
          element={
            <Suspense fallback={<AdminSectionFallback />}>
              <PropertyModerationHistoryPage />
            </Suspense>
          }
        />
        <Route
          path="reports"
          element={
            <Suspense fallback={<AdminSectionFallback />}>
              <ReportsPage />
            </Suspense>
          }
        />
        <Route
          path="verification"
          element={
            <Suspense fallback={<AdminSectionFallback />}>
              <VerificationPage />
            </Suspense>
          }
        />
        <Route
          path="notifications"
          element={
            <Suspense fallback={<AdminSectionFallback />}>
              <NotificationsPage />
            </Suspense>
          }
        />
        <Route
          path="analytics"
          element={
            <Suspense fallback={<AdminSectionFallback />}>
              <AnalyticsPage />
            </Suspense>
          }
        />
        <Route
          path="audit-logs"
          element={
            <Suspense fallback={<AdminSectionFallback />}>
              <AuditLogsPage />
            </Suspense>
          }
        />
      </Route>

      <Route element={<Layout />}>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
