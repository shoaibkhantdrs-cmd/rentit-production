import { useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { adminApi } from "@/api/admin";
import { useAsync } from "@/hooks/useAsync";
import { ErrorState } from "@/components/ErrorState";
import { AdminPanel } from "@/components/admin/AdminWidgets";
import { LineChart, BarChart } from "@/components/admin/AdminCharts";
import { GrowthMetric, GrowthPoint, TopPropertiesMetric } from "@/api/types";

const METRICS: Array<{ value: GrowthMetric; label: string }> = [
  { value: "users", label: "Users" },
  { value: "properties", label: "Properties" },
  { value: "views", label: "Views" },
  { value: "favorites", label: "Favorites" },
  { value: "reports", label: "Reports" },
];

/** First-half vs second-half average of the same real series already
 * rendered by the line chart -- not a separate metric, just a plain-English
 * read on the trend so the admin doesn't have to eyeball the curve. */
function trendOf(points: GrowthPoint[]): { pct: number; up: boolean } | null {
  if (points.length < 4) return null;
  const mid = Math.floor(points.length / 2);
  const firstHalf = points.slice(0, mid);
  const secondHalf = points.slice(mid);
  const avg = (arr: GrowthPoint[]) => arr.reduce((s, p) => s + p.count, 0) / arr.length;
  const a = avg(firstHalf);
  const b = avg(secondHalf);
  if (a === 0 && b === 0) return null;
  const pct = a === 0 ? 100 : ((b - a) / a) * 100;
  return { pct: Math.round(Math.abs(pct)), up: b >= a };
}

function GrowthCard({ metric }: { metric: GrowthMetric }) {
  const { status, data, error, reload } = useAsync(() => adminApi.growth(metric, 30), [metric]);
  const label = METRICS.find((m) => m.value === metric)?.label ?? metric;
  const trend = status === "success" ? trendOf(data.points) : null;

  return (
    <AdminPanel
      title={label}
      action={
        trend ? (
          <span
            className={`admin-trend-badge${trend.up ? " admin-trend-badge--up" : " admin-trend-badge--down"}`}
            title="Second half vs first half of the last 30 days"
          >
            {trend.up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {trend.pct}%
          </span>
        ) : null
      }
    >
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
