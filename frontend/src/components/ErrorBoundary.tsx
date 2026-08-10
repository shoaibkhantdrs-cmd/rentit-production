import { Component, ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * There was no React error boundary anywhere in this app (grep for
 * ErrorBoundary/componentDidCatch/getDerivedStateFromError across
 * frontend/src returned nothing) -- so any uncaught render-time error,
 * anywhere in the component tree, crashed the entire app to a blank white
 * screen with no recovery UI and no way back except manually retyping the
 * URL. That's a real production gap distinct from this session's earlier
 * metadata/SEO work (document titles, robots/sitemap, Open Graph tags).
 *
 * This fallback is deliberately self-contained -- plain inline styles, a
 * plain <a href="/"> (a full page load, not a router Link), no design
 * tokens, no framer-motion. It's mounted around the entire provider tree
 * in main.tsx (ThemeProvider, ToastProvider, AuthProvider, ChatProvider,
 * CompareProvider, App), so if the crash originates in one of those
 * providers themselves, the fallback still can't assume any of them
 * rendered successfully -- CSS custom properties, the router context, and
 * the animation engine are all things a boundary this high up shouldn't
 * depend on to display correctly.
 *
 * No error-monitoring service (Sentry or similar) exists in this frontend
 * to report to, so componentDidCatch falls back to console.error -- the
 * same level of observability every other catch block in this codebase
 * uses when nothing better is wired up.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Unhandled error caught by ErrorBoundary:", error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "24px",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          background: "#0b0f19",
          color: "#f5f5f5",
        }}
      >
        <div style={{ fontSize: "2.5rem", marginBottom: "12px" }} aria-hidden="true">
          ⚠️
        </div>
        <h1 style={{ fontSize: "1.25rem", margin: "0 0 8px", fontWeight: 700 }}>Something went wrong</h1>
        <p style={{ color: "#a1a1aa", maxWidth: 420, margin: "0 0 20px", lineHeight: 1.5 }}>
          RentIt hit an unexpected error. Reloading usually fixes it -- if it keeps happening, please let us know
          via the Contact page.
        </p>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.95rem",
              cursor: "pointer",
            }}
          >
            Reload page
          </button>
          <a
            href="/"
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "1px solid #3f3f46",
              color: "#f5f5f5",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "0.95rem",
            }}
          >
            Back to home
          </a>
        </div>
      </div>
    );
  }
}
