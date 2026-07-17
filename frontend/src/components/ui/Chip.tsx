import { ReactNode } from "react";

interface ChipProps {
  active?: boolean;
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
  ariaLabel?: string;
}

/** A single selectable pill -- used for property type / furnishing / quick
 * filters throughout the redesign, replacing plain <select> dropdowns
 * wherever the option list is short, static, and benefits from being
 * visually scannable rather than hidden behind a click. */
export function Chip({ active, onClick, icon, children, ariaLabel }: ChipProps) {
  return (
    <button
      type="button"
      className={`chip${active ? " chip--active" : ""}`}
      onClick={onClick}
      aria-pressed={active ?? false}
      aria-label={ariaLabel}
    >
      {icon}
      {children}
    </button>
  );
}
