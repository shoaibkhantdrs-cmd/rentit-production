import { useEffect, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { PropertyImageDTO } from "@/api/types";
import { cloudinaryTransform, cloudinarySrcSet } from "@/utils/cloudinaryImage";

/**
 * Luxury gallery with a fullscreen lightbox viewer. There's no 360-tour or
 * video data anywhere in the backend (PropertyImageDTO is just url +
 * sortOrder + isPrimary), so rather than fabricate those controls, this
 * focuses on making the real photo set feel premium: large hero image,
 * thumbnail strip, and a true fullscreen viewer with keyboard navigation.
 */
export function ImageGallery({ images, title }: { images: PropertyImageDTO[]; title: string }) {
  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
  const [activeId, setActiveId] = useState<string | null>(sorted[0]?.id ?? null);
  const [fullscreen, setFullscreen] = useState(false);
  const activeIndex = Math.max(0, sorted.findIndex((img) => img.id === activeId));
  const active = sorted[activeIndex] ?? null;

  const go = (delta: number) => {
    if (sorted.length === 0) return;
    const next = (activeIndex + delta + sorted.length) % sorted.length;
    setActiveId(sorted[next].id);
  };

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen, activeIndex]);

  return (
    <div className="gallery-v2">
      <div className="gallery-v2__main">
        <AnimatePresence mode="wait">
          {active ? (
            <m.img
              key={active.id}
              src={cloudinaryTransform(active.url, { width: 1200 })}
              srcSet={cloudinarySrcSet(active.url, [800, 1200, 1600])}
              sizes="(max-width: 900px) 100vw, 1100px"
              alt={title}
              onClick={() => setFullscreen(true)}
              // Above-the-fold hero image (usually the page's LCP element) --
              // deliberately eager rather than lazy, unlike every
              // thumbnail/card image elsewhere in the app.
              loading="eager"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          ) : (
            <div className="gallery-v2__empty">No photos yet</div>
          )}
        </AnimatePresence>
        {sorted.length > 0 ? (
          <button
            type="button"
            className="gallery-v2__expand"
            onClick={() => setFullscreen(true)}
            aria-label="View fullscreen"
          >
            <Maximize2 size={16} /> View all photos ({sorted.length})
          </button>
        ) : null}
        {sorted.length > 1 ? (
          <>
            <button type="button" className="gallery-v2__nav gallery-v2__nav--prev" onClick={() => go(-1)} aria-label="Previous photo">
              <ChevronLeft size={20} />
            </button>
            <button type="button" className="gallery-v2__nav gallery-v2__nav--next" onClick={() => go(1)} aria-label="Next photo">
              <ChevronRight size={20} />
            </button>
          </>
        ) : null}
      </div>

      {sorted.length > 1 ? (
        <div className="gallery-v2__thumbs">
          {sorted.map((img) => (
            <button
              key={img.id}
              type="button"
              className={`gallery-v2__thumb${img.id === active?.id ? " gallery-v2__thumb--active" : ""}`}
              onClick={() => setActiveId(img.id)}
              aria-label={`View photo ${img.sortOrder + 1}`}
            >
              <img
                src={cloudinaryTransform(img.url, { width: 160, height: 118, crop: "fill" })}
                alt=""
                loading="lazy"
                decoding="async"
              />
            </button>
          ))}
        </div>
      ) : null}

      <AnimatePresence>
        {fullscreen && active ? (
          <m.div
            className="gallery-v2__lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={`${title} photos`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button type="button" className="gallery-v2__lightbox-close" onClick={() => setFullscreen(false)} aria-label="Close">
              <X size={22} />
            </button>
            <button type="button" className="gallery-v2__lightbox-nav gallery-v2__lightbox-nav--prev" onClick={() => go(-1)} aria-label="Previous photo">
              <ChevronLeft size={28} />
            </button>
            <AnimatePresence mode="wait">
              <m.img
                key={active.id}
                src={cloudinaryTransform(active.url, { width: 1600 })}
                srcSet={cloudinarySrcSet(active.url, [1200, 1600, 2000])}
                sizes="90vw"
                alt={title}
                className="gallery-v2__lightbox-img"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.18 }}
              />
            </AnimatePresence>
            <button type="button" className="gallery-v2__lightbox-nav gallery-v2__lightbox-nav--next" onClick={() => go(1)} aria-label="Next photo">
              <ChevronRight size={28} />
            </button>
            <div className="gallery-v2__lightbox-count">
              {activeIndex + 1} / {sorted.length}
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
