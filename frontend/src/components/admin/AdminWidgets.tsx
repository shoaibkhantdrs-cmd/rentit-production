import { ReactNode } from "react";
import { Link } from "react-router-dom";

export function StatCard({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon: string;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  return (
    <div className={`admin-stat-card admin-stat-card--${tone}`}>
      <div className="admin-stat-card__icon" aria-hidden="true">
        {icon}
      </div>
      <div>
        <div className="admin-stat-card__value">{value}</div>
        <div className="admin-stat-card__label">{label}</div>
      </div>
    </div>
  );
}

export function QuickActionCard({ to, icon, label, description }: { to: string; icon: string; label: string; description: string }) {
  return (
    <Link to={to} className="admin-quick-action">
      <span className="admin-quick-action__icon" aria-hidden="true">
        {icon}
      </span>
      <span>
        <span className="admin-quick-action__label">{label}</span>
        <span className="admin-quick-action__description">{description}</span>
      </span>
    </Link>
  );
}

export function AdminPanel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel__header">
        <h2>{title}</h2>
        {action}
      </div>
      <div className="admin-panel__body">{children}</div>
    </section>
  );
}

const STATUS_TONE: Record<string, string> = {
  active: "success",
  published: "success",
  approved: "success",
  pending: "warning",
  pending_review: "warning",
  suspended: "warning",
  reviewed: "success",
  rejected: "danger",
  banned: "danger",
  dismissed: "default",
  action_taken: "success",
  inactive: "danger",
  removed: "danger",
  draft: "default",
};

export function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "default";
  return <span className={`status-pill status-pill--${tone}`}>{status.replace(/_/g, " ")}</span>;
}
