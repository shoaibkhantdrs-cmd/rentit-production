import { ReactNode } from "react";
import { Popover } from "@/components/ui/Popover";

export interface DropdownItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
}

interface DropdownProps {
  trigger: (args: { open: boolean; toggle: () => void }) => ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
}

/**
 * Simple menu-item dropdown built on Popover -- used for the profile menu.
 * Kept intentionally minimal (a flat list of items) since nothing in this
 * app needs nested submenus.
 */
export function Dropdown({ trigger, items, align = "right" }: DropdownProps) {
  return (
    <Popover trigger={trigger} align={align} width={220}>
      {(close) => (
        <div className="dropdown-list">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`dropdown-list__item${item.danger ? " dropdown-list__item--danger" : ""}`}
              onClick={() => {
                item.onClick();
                close();
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}
