import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    // RC1 production build optimization: react/react-dom/react-router-dom
    // change far less often than the app's own code, so splitting them
    // into their own vendor chunk lets browsers cache that chunk across
    // deploys (it only invalidates when a dependency version bumps, not on
    // every app release) instead of re-downloading it inside the main
    // bundle every time any application file changes. This is additive
    // Rollup output configuration only -- it doesn't change, remove, or
    // add any application code/behavior, and is orthogonal to the
    // route/component-level lazy-loading (React.lazy/LazyMotion) already
    // in place elsewhere.
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
