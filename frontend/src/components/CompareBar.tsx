import { useNavigate } from "react-router-dom";
import { Scale, X } from "lucide-react";
import { useCompare } from "@/context/CompareContext";

/** Floating bar shown across every page once 1+ properties are queued for
 * comparison via PropertyCard's compare button. Rendered once in Layout.tsx
 * rather than per-page. */
export function CompareBar() {
  const { ids, clear } = useCompare();
  const navigate = useNavigate();

  if (ids.length === 0) return null;

  return (
    // Bug fix (QA report #16): position/offset used to be inline styles
    // (fixed at bottom: 20px, z-index: 60) with no responsive override.
    // The mobile bottom-nav is also fixed at the bottom (z-index: 90) and
    // its own height overlaps that 20px offset at <=860px, so it always
    // rendered on top of this bar there, obscuring the Compare/clear
    // buttons. Moved position/offset into a real CSS class so a mobile
    // media query can lift it clear of the nav's height.
    <div className="card compare-bar">
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: "0.88rem" }}>
        <Scale size={16} />
        {ids.length} {ids.length === 1 ? "property" : "properties"} selected
      </span>
      <button
        type="button"
        className="btn-v2 btn-v2--primary btn-v2--sm"
        disabled={ids.length < 2}
        onClick={() => navigate("/compare")}
      >
        Compare
      </button>
      <button
        type="button"
        className="nav-v2__icon-btn"
        style={{ width: 32, height: 32 }}
        onClick={clear}
        aria-label="Clear comparison"
      >
        <X size={16} />
      </button>
    </div>
  );
}
