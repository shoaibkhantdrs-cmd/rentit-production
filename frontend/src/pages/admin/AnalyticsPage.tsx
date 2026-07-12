import { useState } from "react";
import { adminApi } from "@/api/admin";
import { useAsync } from "@/hooks/useAsync";
import { ErrorState } from "@/components/ErrorState";
import { AdminPanel } from "@/components/admin/AdminWidgets";
import { LineChart, BarChart } from "@/components/admin/AdminCharts";
import { GrowthMetric, TopPropertiesMetric } from "@/api/types";

const METRICS: Array<{ value: GrowthMetric; label: string }> = [
  { value: "users", label: "Users" },
  { value: "properties", label: "Properties" },
  { value: "views", label: "Views" },
  { value: "favorites", label: "Favorites" },
  { value: "reports", label: "Reports" },
];

function GrowthCard({ metric }: { metric: GrowthMetric }) {
  const { status, data, error, reload } = useAsync(() => adminApi.growth(metric, 30), [metric]);
  const label = METRICS.find((m) => m.value === metric)?.label ?? metric;

  return (
    <AdminPanel title={label}>
      {status === "loading" && <div className="skeleton" style={{ height: 160 }} />}
      {status === "error" && <ErrorState message={error} onRetry={reload} />}
      {status === "success" && <LineChart points={data.points} label={label} />}
    </AdminPanel>
  );
}

function TopPropertiesCard() {
  const [metric, setMetric] = useState<TopPropertiesMetric>("most_viewed");
  const { status, data, error, reload } = useAsync(() => adminApi.topProperties(metric, 10), [metric]);

  return (
    <AdminPanel
      title="Top properties"
      action={
        <select value={metric} onChange={(e) => setMetric(e.target.value as TopPropertiesMetric)}>
          <option value="most_viewed">Most viewed</option>
          <option value="most_favorited">Most favorited</option>
        </select>
      }
    >
      {status === "loading" && <div className="skeleton" style={{ height: 200 }} />}
      {status === "error" && <ErrorState message={error} onRetry={reload} />}
      {status === "success" && (
        <BarChart
          items={data.items}
          labelKey="title"
          valueKey={metric === "most_viewed" ? "viewCount" : "favoriteCount"}
        />
      )}
    </AdminPanel>
  );
}

export function AnalyticsPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Analytics</h1>
          <p>Growth trends and top-performing listings.</p>
        </div>
      </div>

      <div className="admin-analytics-grid">
        {METRICS.map((m) => (
          <GrowthCard key={m.value} metric={m.value} />
        ))}
      </div>

      <TopPropertiesCard />
    </div>
  );
}
