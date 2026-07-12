import { useState } from "react";
import { adminApi } from "@/api/admin";
import { useAsync } from "@/hooks/useAsync";
import { ErrorState } from "@/components/ErrorState";
import { StatCard, QuickActionCard, AdminPanel } from "@/components/admin/AdminWidgets";
import { LineChart } from "@/components/admin/AdminCharts";
import { GrowthMetric } from "@/api/types";

const GROWTH_METRICS: Array<{ value: GrowthMetric; label: string }> = [
  { value: "users", label: "Users" },
  { value: "properties", label: "Properties" },
  { value: "views", label: "Views" },
  { value: "favorites", label: "Favorites" },
  { value: "reports", label: "Reports" },
];

function SystemHealthCard() {
  const { status, data, error, reload } = useAsync(() => adminApi.systemHealth(), []);

  if (status === "loading") return <div className="skeleton skeleton--text" style={{ width: 220 }} />;
  if (status === "error") return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className={`system-health system-health--${data.status}`}>
      <div>
        <strong>Database:</strong> {data.database}
      </div>
      <div>
        <strong>Uptime:</strong> {Math.floor(data.uptimeSeconds / 60)}m {data.uptimeSeconds % 60}s
      </div>
      <div>
        <strong>Node:</strong> {data.nodeVersion}
      </div>
      <div className={`badge badge--${data.status === "ok" ? "published" : "removed"}`}>
        {data.status === "ok" ? "All systems operational" : "Degraded"}
      </div>
    </div>
  );
}

function GrowthChartCard() {
  const [metric, setMetric] = useState<GrowthMetric>("users");
  const { status, data, error, reload } = useAsync(() => adminApi.growth(metric, 30), [metric]);

  return (
    <AdminPanel
      title="Growth (last 30 days)"
      action={
        <select value={metric} onChange={(e) => setMetric(e.target.value as GrowthMetric)}>
          {GROWTH_METRICS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      }
    >
      {status === "loading" && <div className="skeleton" style={{ height: 160 }} />}
      {status === "error" && <ErrorState message={error} onRetry={reload} />}
      {status === "success" && <LineChart points={data.points} label={metric} />}
    </AdminPanel>
  );
}

export function DashboardPage() {
  const { status, data, error, reload } = useAsync(() => adminApi.dashboardStats(), []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>A snapshot of RentIt right now.</p>
        </div>
      </div>

      {status === "loading" && (
        <div className="admin-stat-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 84 }} />
          ))}
        </div>
      )}

      {status === "error" && <ErrorState message={error} onRetry={reload} />}

      {status === "success" && (
        <>
          <div className="admin-stat-grid">
            <StatCard label="Total users" value={data.totalUsers} icon="👥" />
            <StatCard label="Active users" value={data.activeUsers} icon="✅" tone="success" />
            <StatCard label="Suspended users" value={data.suspendedUsers} icon="⏸️" tone="warning" />
            <StatCard label="Banned users" value={data.bannedUsers} icon="⛔" tone="danger" />
            <StatCard label="Total properties" value={data.totalProperties} icon="🏠" />
            <StatCard label="Published" value={data.publishedProperties} icon="📢" tone="success" />
            <StatCard label="Pending review" value={data.pendingProperties} icon="🕓" tone="warning" />
            <StatCard label="Rejected" value={data.rejectedProperties} icon="🚫" tone="danger" />
            <StatCard label="Hidden" value={data.hiddenProperties} icon="🙈" tone="warning" />
            <StatCard label="Featured" value={data.featuredProperties} icon="⭐" />
            <StatCard label="Total views" value={data.totalViews} icon="👁️" />
            <StatCard label="Total favorites" value={data.totalFavorites} icon="❤️" />
            <StatCard
              label="Pending property reports"
              value={data.pendingPropertyReports}
              icon="🚩"
              tone={data.pendingPropertyReports > 0 ? "warning" : "default"}
            />
            <StatCard
              label="Pending user reports"
              value={data.pendingUserReports}
              icon="🚩"
              tone={data.pendingUserReports > 0 ? "warning" : "default"}
            />
            <StatCard
              label="Pending verifications"
              value={data.pendingVerifications}
              icon="🪪"
              tone={data.pendingVerifications > 0 ? "warning" : "default"}
            />
          </div>

          <div className="admin-two-col">
            <GrowthChartCard />

            <AdminPanel title="System health">
              <SystemHealthCard />
            </AdminPanel>
          </div>

          <AdminPanel title="Quick actions">
            <div className="admin-quick-actions">
              <QuickActionCard
                to="/admin/properties?status=pending_review"
                icon="🕓"
                label="Review pending properties"
                description={`${data.pendingProperties} awaiting review`}
              />
              <QuickActionCard
                to="/admin/reports"
                icon="🚩"
                label="Resolve reports"
                description={`${data.pendingPropertyReports + data.pendingUserReports} pending`}
              />
              <QuickActionCard
                to="/admin/verification"
                icon="🪪"
                label="Review identity verifications"
                description={`${data.pendingVerifications} pending`}
              />
              <QuickActionCard
                to="/admin/notifications"
                icon="📣"
                label="Send a broadcast"
                description="Notify all users or a specific role"
              />
              <QuickActionCard to="/admin/users" icon="👥" label="Manage users" description="Search, suspend, assign roles" />
              <QuickActionCard to="/admin/audit-logs" icon="🧾" label="View audit logs" description="Every admin action, searchable" />
            </div>
          </AdminPanel>
        </>
      )}
    </div>
  );
}
