import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { OfflineBanner } from "@/components/OfflineBanner";

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink to={to} end className={({ isActive }) => `navbar__link${isActive ? " navbar__link--active" : ""}`}>
      {children}
    </NavLink>
  );
}

const ADMIN_ROLES = ["admin", "super_admin"];

export function Layout() {
  const { isAuthenticated, user, logout } = useAuth();
  const { unreadCount } = useChat();
  const isAdmin = user?.roles.some((role) => ADMIN_ROLES.includes(role)) ?? false;

  return (
    <div className="app-shell">
      <OfflineBanner />
      <header className="navbar">
        <div className="container navbar__inner">
          <NavLink to="/" className="navbar__brand">
            RentIt
          </NavLink>
          <nav className="navbar__links">
            <NavItem to="/">Home</NavItem>
            <NavItem to="/search">Search</NavItem>
            <NavItem to="/properties/new">List a property</NavItem>
            <NavItem to="/my-properties">My properties</NavItem>
            <NavItem to="/favorites">Favorites</NavItem>
            {isAuthenticated ? (
              <NavItem to="/messages">
                Messages{unreadCount > 0 ? <span className="unread-badge unread-badge--nav">{unreadCount}</span> : null}
              </NavItem>
            ) : null}
            {isAuthenticated ? <NavItem to="/saved-searches">Saved searches</NavItem> : null}
            {isAuthenticated ? <NavItem to="/notification-preferences">Notifications</NavItem> : null}
            {isAuthenticated ? <NavItem to="/verification">Verification</NavItem> : null}
            {isAdmin ? (
              <NavLink to="/admin" className="navbar__link">
                Admin panel
              </NavLink>
            ) : null}
            {isAuthenticated ? (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => void logout()}>
                Sign out{user ? ` (${user.name})` : ""}
              </button>
            ) : null}
          </nav>
        </div>
      </header>
      <main className="main-content">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
