import { useState } from "react";
import { PropertyImageDTO } from "@/api/types";

export function ImageGallery({ images, title }: { images: PropertyImageDTO[]; title: string }) {
  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
  const [activeId, setActiveId] = useState<string | null>(sorted[0]?.id ?? null);
  const active = sorted.find((img) => img.id === activeId) ?? sorted[0] ?? null;

  return (
    <div className="gallery">
      <div className="gallery__main">
        {active ? <img src={active.url} alt={title} /> : <span>No photos yet</span>}
      </div>
      {sorted.length > 1 ? (
        <div className="gallery__thumbs">
          {sorted.map((img) => (
            <button
              key={img.id}
              type="button"
              className={`gallery__thumb${img.id === active?.id ? " gallery__thumb--active" : ""}`}
              onClick={() => setActiveId(img.id)}
              aria-label={`View photo ${img.sortOrder + 1}`}
            >
              <img src={img.url} alt="" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
