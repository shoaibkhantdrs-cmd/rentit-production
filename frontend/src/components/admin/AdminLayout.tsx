import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { RequireAdmin } from "@/components/RequireAdmin";

const NAV_SECTIONS: Array<{ label: string; items: Array<{ to: string; label: string; icon: string }> }> = [
  {
    label: "Overview",
    items: [{ to: "/admin", label: "Dashboard", icon: "📊" }],
  },
  {
    label: "Moderation",
    items: [
      { to: "/admin/properties", label: "Properties", icon: "🏠" },
      { to: "/admin/reports", label: "Reports", icon: "🚩" },
      { to: "/admin/verification", label: "Verification", icon: "🪪" },
    ],
  },
  {
    label: "People",
    items: [{ to: "/admin/users", label: "Users", icon: "👥" }],
  },
  {
    label: "Comms & Insights",
    items: [
      { to: "/admin/notifications", label: "Notifications", icon: "📣" },
      { to: "/admin/analytics", label: "Analytics", icon: "📈" },
      { to: "/admin/audit-logs", label: "Audit Logs", icon: "🧾" },
    ],
  },
];

function SidebarNavItem({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink
      to={to}
      end={to === "/admin"}
      className={({ isActive }) => `admin-sidebar__link${isActive ? " admin-sidebar__link--active" : ""}`}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </NavLink>
  );
}

function AdminShell() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <NavLink to="/">RentIt</NavLink>
          <span className="admin-sidebar__brand-tag">Admin</span>
        </div>
        <nav className="admin-sidebar__nav">
          {NAV_SECTIONS.map((section) => (
            <div className="admin-sidebar__section" key={section.label}>
              <div className="admin-sidebar__section-label">{section.label}</div>
              {section.items.map((item) => (
                <SidebarNavItem key={item.to} {...item} />
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar__title">Admin Panel</div>
          <div className="admin-topbar__actions">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              title="Toggle dark mode"
            >
              {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
            </button>
            <NavLink to="/" className="btn btn--secondary btn--sm">
              View site
            </NavLink>
            <span className="admin-topbar__user">{user?.name}</span>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => void logout()}>
              Sign out
            </button>
          </div>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AdminLayout() {
  return (
    <RequireAdmin>
      <AdminShell />
    </RequireAdmin>
  );
}
