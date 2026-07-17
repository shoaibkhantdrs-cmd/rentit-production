import { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "neutral" | "success" | "warning" | "danger" | "primary";
  icon?: ReactNode;
}

/**
 * Generic small pill badge -- a typed wrapper around the existing
 * `.pill-badge` styles so new call sites don't have to remember raw class
 * name combinations. Existing `pill-badge--status` usages are left as-is
 * (they predate this component and work fine).
 */
export function Badge({ children, variant = "neutral", icon }: BadgeProps) {
  return (
    <span className={`badge-v2 badge-v2--${variant}`}>
      {icon}
      {children}
    </span>
  );
}
