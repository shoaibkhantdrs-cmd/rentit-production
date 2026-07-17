import { ChevronLeft, ChevronRight } from "lucide-react";
import { ReactNode, useRef, useState, useEffect } from "react";

interface CarouselProps {
  children: ReactNode;
  /** Accessible label for the scroll region, e.g. "Most viewed properties". */
  ariaLabel: string;
}

/**
 * A lightweight, dependency-free horizontal carousel (native CSS scroll-snap
 * + JS scrollBy for the arrow buttons) -- used for the Home page's curated
 * rows (Most viewed, Recently viewed) instead of a fixed grid, matching the
 * "featured collection" feel of premium listing sites without pulling in a
 * carousel library for something this simple. Each child is expected to be
 * one card-sized item; wrap PropertyCard usages directly as children.
 */
export function Carousel({ children, ariaLabel }: CarouselProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateArrows();
    const el = trackRef.current;
    if (!el) return;
    const onResize = () => updateArrows();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [children]);

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div className="carousel-v2">
      {canScrollLeft ? (
        <button type="button" className="carousel-v2__nav carousel-v2__nav--prev" onClick={() => scrollBy(-1)} aria-label="Scroll left">
          <ChevronLeft size={18} />
        </button>
      ) : null}
      <div className="carousel-v2__track" ref={trackRef} onScroll={updateArrows} role="region" aria-label={ariaLabel}>
        {children}
      </div>
      {canScrollRight ? (
        <button type="button" className="carousel-v2__nav carousel-v2__nav--next" onClick={() => scrollBy(1)} aria-label="Scroll right">
          <ChevronRight size={18} />
        </button>
      ) : null}
    </div>
  );
}
