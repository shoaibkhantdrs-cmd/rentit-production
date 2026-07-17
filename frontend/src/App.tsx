import { ReactNode, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
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
