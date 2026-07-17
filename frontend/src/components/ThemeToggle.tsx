import { Check, Moon, Sun, SunMoon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { Popover } from "@/components/ui/Popover";

const OPTIONS = [
  { value: "light" as const, label: "Light", icon: Sun },
  { value: "dark" as const, label: "Dark", icon: Moon },
  { value: "auto" as const, label: "System", icon: SunMoon },
];

/** Three-way light/dark/auto switcher in the navbar. "Auto" genuinely
 * follows the OS setting live (see ThemeContext) rather than only reading
 * it once. */
export function ThemeToggle() {
  const { preference, theme, setPreference } = useTheme();
  const CurrentIcon = theme === "dark" ? Moon : Sun;

  return (
    <Popover
      align="right"
      width={170}
      trigger={({ toggle, open }) => (
        <button
          type="button"
          className="nav-v2__icon-btn"
          onClick={toggle}
          aria-label={`Theme: ${preference}`}
          aria-expanded={open}
        >
          <CurrentIcon size={18} />
        </button>
      )}
    >
      {(close) => (
        <div className="dropdown-list">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="dropdown-list__item"
              onClick={() => {
                setPreference(opt.value);
                close();
              }}
            >
              <opt.icon size={15} />
              {opt.label}
              {preference === opt.value ? <Check size={14} style={{ marginLeft: "auto" }} /> : null}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}
