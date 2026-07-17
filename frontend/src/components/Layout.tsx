import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, m } from "framer-motion";
import {
  Building2,
  CreditCard,
  Heart,
  Home as HomeIcon,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MessageCircle,
  PlusCircle,
  Search as SearchIcon,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { OfflineBanner } from "@/components/OfflineBanner";
import { PwaInstallBanner } from "@/components/PwaInstallBanner";
import { Footer } from "@/components/Footer";
import { CompareBar } from "@/components/CompareBar";
import { NotificationCenter } from "@/components/NotificationCenter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar } from "@/components/ui/Avatar";
import { Dropdown } from "@/components/ui/Dropdown";

const ADMIN_ROLES = ["admin", "super_admin"];

/** The primary center menu -- kept to the handful of destinations a
 * renter/owner reaches daily (Airbnb's own navbar does the same: everything
 * else lives behind the profile menu, not crammed into the top bar). See
 * design-decisions notes for why "Rent"/"Notifications"/"Support" aren't
 * separate top-level links: "Rent" has no distinct destination from
 * Search, there's no notifications *feed* page (only preferences, moved
 * into the profile menu), and there's no support/help page in this app yet. */
function NavItem({ to, children, icon }: { to: string; children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <NavLink to={to} end className={({ isActive }) => `nav-v2__link${isActive ? " nav-v2__link--active" : ""}`}>
      {icon}
      {children}
    </NavLink>
  );
}

export function Layout() {
  const { isAuthenticated, user, logout } = useAuth();
  const { unreadCount } = useChat();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isAdmin = user?.roles.some((role) => ADMIN_ROLES.includes(role)) ?? false;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <OfflineBanner />
      <PwaInstallBanner />
      <header className={`nav-v2${scrolled ? " nav-v2--scrolled" : ""}`}>
        <div className="nav-v2__inner">
          <NavLink to="/" className="nav-v2__brand">
            <span className="nav-v2__brand-mark">
              <Building2 size={18} />
            </span>
            RentIt
          </NavLink>

          <div className="nav-v2__center">
            <nav className="nav-v2__links">
              <NavItem to="/" icon={null}>
                Home
              </NavItem>
              <NavItem to="/search" icon={<SearchIcon size={15} />}>
                Search
              </NavItem>
              <NavItem to="/properties/new" icon={<PlusCircle size={15} />}>
                List Property
              </NavItem>
              <NavItem to="/my-properties" icon={<ListChecks size={15} />}>
                My Properties
              </NavItem>
              <NavItem to="/favorites" icon={<Heart size={15} />}>
                Favorites
              </NavItem>
              <NavItem to="/premium-plans" icon={<Sparkles size={15} />}>
                Premium
              </NavItem>
            </nav>
          </div>

          <div className="nav-v2__actions">
            <button
              type="button"
              className="nav-v2__icon-btn nav-v2__mobile-toggle"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <ThemeToggle />

            {isAuthenticated ? <NotificationCenter /> : null}

            {isAuthenticated ? (
              <NavLink to="/messages" className="nav-v2__icon-btn" aria-label="Messages">
                <MessageCircle size={19} />
                {unreadCount > 0 ? <span className="unread-badge unread-badge--nav">{unreadCount}</span> : null}
              </NavLink>
            ) : null}

            {isAdmin ? (
              <NavLink to="/admin" className="nav-v2__icon-btn" aria-label="Admin panel">
                <LayoutDashboard size={19} />
              </NavLink>
            ) : null}

            {isAuthenticated ? (
              <Dropdown
                align="right"
                trigger={({ toggle, open }) => (
                  <button
                    type="button"
                    className="nav-v2__profile"
                    onClick={toggle}
                    aria-expanded={open}
                    aria-haspopup="menu"
                  >
                    <Avatar name={user?.name ?? "?"} size={30} />
                    <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{user?.name?.split(" ")[0]}</span>
                  </button>
                )}
                items={[
                  { label: "Dashboard", icon: <User size={15} />, onClick: () => navigate("/profile") },
                  { label: "Saved Searches", icon: <SearchIcon size={15} />, onClick: () => navigate("/saved-searches") },
                  { label: "Notification Preferences", icon: <Settings size={15} />, onClick: () => navigate("/notification-preferences") },
                  { label: "Payment History", icon: <CreditCard size={15} />, onClick: () => navigate("/payment-history") },
                  { label: "Verification", icon: <ShieldCheck size={15} />, onClick: () => navigate("/verification") },
                  { label: "Sign out", icon: <LogOut size={15} />, onClick: () => void logout(), danger: true },
                ]}
              />
            ) : (
              // Bug fix (QA report #2): this used to link to /search, a
              // public route with no sign-in form on it. There's no
              // dedicated /login route -- AuthPanel only ever renders as
              // RequireAuth's signed-out fallback, so /profile (already
              // RequireAuth-gated) is the existing route that actually
              // shows a sign-in form for a logged-out visitor.
              <NavLink to="/profile" className="btn-v2 btn-v2--primary btn-v2--sm">
                Sign in
              </NavLink>
            )}
          </div>
        </div>

        {mobileOpen ? (
          <div className="nav-v2__mobile-panel">
            <NavItem to="/" icon={null}>
              Home
            </NavItem>
            <NavItem to="/search" icon={<SearchIcon size={15} />}>
              Search
            </NavItem>
            <NavItem to="/properties/new" icon={<PlusCircle size={15} />}>
              List Property
            </NavItem>
            <NavItem to="/my-properties" icon={<ListChecks size={15} />}>
              My Properties
            </NavItem>
            <NavItem to="/favorites" icon={<Heart size={15} />}>
              Favorites
            </NavItem>
            <NavItem to="/premium-plans" icon={<Sparkles size={15} />}>
              Premium
            </NavItem>
            {isAuthenticated ? (
              <NavItem to="/saved-searches" icon={null}>
                Saved Searches
              </NavItem>
            ) : null}
          </div>
        ) : null}
      </header>

      <main className="main-content" id="main-content" tabIndex={-1}>
        <div className="container-wide">
          {/* Page transition -- a quick fade+rise keyed by pathname so
              every route change (not just data loads within a page) feels
              like part of one continuous, polished product rather than a
              hard cut. Kept short (0.18s) so it never feels like it's in
              the way of navigation. */}
          <AnimatePresence mode="wait">
            <m.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <Outlet />
            </m.div>
          </AnimatePresence>
        </div>
      </main>

      <Footer />
      <CompareBar />

      <nav className="bottom-nav" aria-label="Primary">
        <BottomNavItem to="/" icon={<HomeIcon size={20} />} label="Home" />
        <BottomNavItem to="/search" icon={<SearchIcon size={20} />} label="Search" />
        <BottomNavItem to="/favorites" icon={<Heart size={20} />} label="Saved" />
        <BottomNavItem
          to="/messages"
          icon={
            <span style={{ position: "relative" }}>
              <MessageCircle size={20} />
              {unreadCount > 0 ? <span className="unread-badge unread-badge--nav" style={{ top: -6, right: -8 }}>{unreadCount}</span> : null}
            </span>
          }
          label="Chat"
        />
        {/* Bug fix (QA report #2): the signed-out fallback used to be
            /search, which has no sign-in form. /profile is RequireAuth-
            gated, so it correctly shows AuthPanel when signed out and
            the real profile when signed in -- no separate branch needed. */}
        <BottomNavItem to="/profile" icon={<User size={20} />} label="Profile" />
      </nav>
    </div>
  );
}

function BottomNavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink to={to} end className={({ isActive }) => `bottom-nav__item${isActive ? " bottom-nav__item--active" : ""}`}>
      {icon}
      {label}
    </NavLink>
  );
}

