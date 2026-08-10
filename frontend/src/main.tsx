import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { LazyMotion, MotionConfig } from "framer-motion";
import App from "./App";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ChatProvider } from "@/context/ChatContext";
import { CompareProvider } from "@/context/CompareContext";
import { ToastProvider } from "@/components/ui/Toast";
import { registerServiceWorker } from "@/registerServiceWorker";
import "./index.css";

registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* reducedMotion="user" makes every Framer Motion animation in the
          app automatically honor the OS-level prefers-reduced-motion
          setting -- transform-based motion (scale/x/y/rotate) collapses to
          instant or opacity-only, without having to thread useReducedMotion
          through each of the ~15 animated components individually. This is
          Framer Motion's own documented mechanism for this exact case. */}
      {/* Perf fix: the ~12 always-mounted components that animate (Toast,
          Layout's nav, HomePage, PropertyCard, Reveal, Accordion,
          EmptyState, Tabs, Drawer, Popover, ImageGallery -- everything
          reachable from the eager route set) now import the tree-shakeable
          `m` component instead of `motion`, and this LazyMotion boundary
          supplies the animation engine those `m` components need. The
          `features` loader is a function (not the imported `domMax` value
          directly), so Vite code-splits the ~25KB feature bundle into its
          own chunk that's fetched async right after mount, instead of
          being parsed as part of the main bundle -- this is the difference
          between "smaller main bundle" and "no change at all" for this
          fix. domMax (not the smaller domAnimation) is used because Toast
          uses `layout` and PropertyCard uses `drag`, both of which need
          it.
          Regression fix (RC1 QA): `strict` was removed here. LazyMotion's
          `strict` prop throws at render time for ANY descendant `motion.*`
          component in the tree, regardless of whether that component is
          lazy-loaded -- code-splitting only defers when its JS chunk is
          fetched, not where it sits in the React tree. AddPropertyPage.tsx
          and components/ui/Modal.tsx are both still on plain `motion`
          (their own lazy chunks, not on the eager-load list this fix
          targeted), so `strict` crashed both of them the moment they
          rendered. Every eager-path component listed above already imports
          `m`, so dropping `strict` costs nothing there -- it only removes
          an enforcement guard that was incompatible with the two
          intentionally-unconverted files. */}
      {/* Mounted around the whole provider tree (not just <App />) so a
          crash inside any provider -- Theme/Toast/Auth/Chat/Compare -- is
          caught too, not just crashes inside routed pages. See
          ErrorBoundary.tsx for why its fallback UI deliberately avoids
          depending on any of what it's wrapping. */}
      <ErrorBoundary>
        <LazyMotion features={() => import("framer-motion").then((mod) => mod.domMax)}>
          <MotionConfig reducedMotion="user">
            <ThemeProvider>
              <ToastProvider>
                <AuthProvider>
                  <ChatProvider>
                    <CompareProvider>
                      <App />
                    </CompareProvider>
                  </ChatProvider>
                </AuthProvider>
              </ToastProvider>
            </ThemeProvider>
          </MotionConfig>
        </LazyMotion>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>,
);
