import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  hint?: string;
  /** Optional trend, e.g. "+12% vs last week" -- purely presentational, the
   * caller decides tone (positive/negative aren't inferred here). */
  trend?: ReactNode;
}

/** A single metric tile -- reuses the `.profile-stat-card` visual language
 * that ProfilePage already established (Phase 2), extended with an
 * optional icon/hint/trend slot, so the owner performance panel and the
 * admin analytics dashboard share one component instead of each
 * hand-rolling its own number-in-a-box markup. */
export function StatCard({ label, value, icon, hint, trend }: StatCardProps) {
  return (
    <div className="profile-stat-card stat-card--v2">
      {icon ? <div className="stat-card__icon">{icon}</div> : null}
      <div className="profile-stat-card__value">{value}</div>
      <div className="profile-stat-card__label">{label}</div>
      {hint ? <div className="stat-card__hint">{hint}</div> : null}
      {trend ? <div className="stat-card__trend">{trend}</div> : null}
    </div>
  );
}
