import { Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { HomePage } from "@/pages/HomePage";
import { SearchPage } from "@/pages/SearchPage";
import { PropertyDetailsPage } from "@/pages/PropertyDetailsPage";
import { AddPropertyPage } from "@/pages/AddPropertyPage";
import { EditPropertyPage } from "@/pages/EditPropertyPage";
import { MyPropertiesPage } from "@/pages/MyPropertiesPage";
import { FavoritesPage } from "@/pages/FavoritesPage";
import { VerificationStatusPage } from "@/pages/VerificationStatusPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { ConversationsPage } from "@/pages/ConversationsPage";
import { ConversationThreadPage } from "@/pages/ConversationThreadPage";
import { SavedSearchesPage } from "@/pages/SavedSearchesPage";
import { NotificationPreferencesPage } from "@/pages/NotificationPreferencesPage";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { DashboardPage } from "@/pages/admin/DashboardPage";
import { UsersPage } from "@/pages/admin/UsersPage";
import { UserDetailPage } from "@/pages/admin/UserDetailPage";
import { PropertiesPage } from "@/pages/admin/PropertiesPage";
import { PropertyModerationHistoryPage } from "@/pages/admin/PropertyModerationHistoryPage";
import { ReportsPage } from "@/pages/admin/ReportsPage";
import { VerificationPage } from "@/pages/admin/VerificationPage";
import { NotificationsPage } from "@/pages/admin/NotificationsPage";
import { AnalyticsPage } from "@/pages/admin/AnalyticsPage";
import { AuditLogsPage } from "@/pages/admin/AuditLogsPage";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/properties/new" element={<AddPropertyPage />} />
        <Route path="/properties/:id" element={<PropertyDetailsPage />} />
        <Route path="/properties/:id/edit" element={<EditPropertyPage />} />
        <Route path="/my-properties" element={<MyPropertiesPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/verification" element={<VerificationStatusPage />} />
        <Route path="/messages" element={<ConversationsPage />} />
        <Route path="/messages/:id" element={<ConversationThreadPage />} />
        <Route path="/saved-searches" element={<SavedSearchesPage />} />
        <Route path="/notification-preferences" element={<NotificationPreferencesPage />} />
      </Route>

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:id" element={<UserDetailPage />} />
        <Route path="properties" element={<PropertiesPage />} />
        <Route path="properties/moderation-history" element={<PropertyModerationHistoryPage />} />
        <Route path="properties/:id/history" element={<PropertyModerationHistoryPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="verification" element={<VerificationPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
      </Route>

      <Route element={<Layout />}>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
