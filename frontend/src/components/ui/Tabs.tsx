import { ReactNode } from "react";
import { m } from "framer-motion";

interface TabOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface TabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: TabOption<T>[];
  ariaLabel: string;
}

/**
 * Small segmented-control style tab switcher (used for Search's
 * Grid / List / Map view toggle). Not a routing/content Tabs system --
 * this app doesn't need tabbed page content anywhere else, so this stays
 * intentionally simple rather than building a generic unused abstraction.
 */
export function Tabs<T extends string>({ value, onChange, options, ariaLabel }: TabsProps<T>) {
  return (
    <div className="tabs" role="tablist" aria-label={ariaLabel}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`tabs__tab${active ? " tabs__tab--active" : ""}`}
            onClick={() => onChange(opt.value)}
          >
            {active ? (
              <m.span layoutId="tabs-active-pill" className="tabs__pill" transition={{ type: "spring", stiffness: 500, damping: 35 }} />
            ) : null}
            <span className="tabs__label">
              {opt.icon}
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
