import { GrowthPoint } from "@/api/types";

const CHART_HEIGHT = 160;
const CHART_WIDTH = 560;
const PADDING = 24;

/**
 * A dependency-free SVG line chart. No charting library is installed in
 * this project (see docs/phase-4.md's "what remains" note), so Part 7's
 * "Charts for Users/Properties/Views/Favorites/Reports/Growth" are
 * rendered with a small, real, hand-rolled SVG renderer rather than a
 * placeholder image or a table pretending to be a chart.
 */
export function LineChart({ points, label }: { points: GrowthPoint[]; label: string }) {
  if (points.length === 0) {
    return <p className="field-hint">No data yet.</p>;
  }

  const max = Math.max(1, ...points.map((p) => p.count));
  const stepX = points.length > 1 ? (CHART_WIDTH - PADDING * 2) / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = PADDING + i * stepX;
    const y = CHART_HEIGHT - PADDING - (p.count / max) * (CHART_HEIGHT - PADDING * 2);
    return { x, y, ...p };
  });

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPath = `${path} L${coords[coords.length - 1].x.toFixed(1)},${CHART_HEIGHT - PADDING} L${coords[0].x.toFixed(1)},${CHART_HEIGHT - PADDING} Z`;

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      className="admin-chart"
      role="img"
      aria-label={`${label} over time`}
    >
      <line
        x1={PADDING}
        y1={CHART_HEIGHT - PADDING}
        x2={CHART_WIDTH - PADDING}
        y2={CHART_HEIGHT - PADDING}
        className="admin-chart__axis"
      />
      <path d={areaPath} className="admin-chart__area" />
      <path d={path} className="admin-chart__line" fill="none" />
      {coords.map((c) => (
        <circle key={c.date} cx={c.x} cy={c.y} r={2.5} className="admin-chart__point">
          <title>
            {c.date}: {c.count}
          </title>
        </circle>
      ))}
    </svg>
  );
}

export function BarChart<T extends object>({
  items,
  labelKey,
  valueKey,
}: {
  items: T[];
  labelKey: keyof T;
  valueKey: keyof T;
}) {
  if (items.length === 0) {
    return <p className="field-hint">No data yet.</p>;
  }
  const max = Math.max(1, ...items.map((item) => Number(item[valueKey]) || 0));

  return (
    <div className="admin-barchart">
      {items.map((item, i) => {
        const value = Number(item[valueKey]) || 0;
        const label = String(item[labelKey] ?? "");
        const widthPct = (value / max) * 100;
        return (
          <div className="admin-barchart__row" key={i}>
            <div className="admin-barchart__label" title={label}>
              {label}
            </div>
            <div className="admin-barchart__track">
              <div className="admin-barchart__bar" style={{ width: `${widthPct}%` }} />
            </div>
            <div className="admin-barchart__value">{value}</div>
          </div>
        );
      })}
    </div>
  );
}
