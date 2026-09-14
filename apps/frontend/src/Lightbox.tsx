import { useEffect, useState } from "react";

export type LightboxItem = {
  id: string;
  src: string;
  download: string;
  title: string;
  subtitle: string;
  kind?: "image" | "video";
};

export function Lightbox({
  items,
  index,
  onIndex,
  onClose,
  onDelete,
}: {
  items: LightboxItem[];
  index: number;
  onIndex: (next: number) => void;
  onClose: () => void;
  onDelete?: (id: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const item = items[index];

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < items.length - 1) onIndex(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, onClose, onIndex]);

  if (!item) return null;

  return (
    <div
      className="lightbox"
      data-mounted={mounted}
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      onClick={onClose}
    >
      <div className="lightbox-bar" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-title">
          <strong>{item.title}</strong>
          <span className="muted">{item.subtitle}</span>
        </div>
        <div className="lightbox-actions">
          <a className="btn ghost" href={item.download} download>
            Download
          </a>
          {onDelete ? (
            <button
              type="button"
              className="btn ghost"
              onClick={() => onDelete(item.id)}
            >
              Delete
            </button>
          ) : null}
          <button type="button" className="btn icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
      </div>

      <figure className="lightbox-stage" onClick={(e) => e.stopPropagation()}>
        {item.kind === "video" ? (
          <video key={item.id} src={item.src} controls playsInline autoPlay />
        ) : (
          <img src={item.src} alt={item.title} />
        )}
      </figure>

      {items.length > 1 ? (
        <div className="lightbox-nav" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="btn icon"
            disabled={index === 0}
            onClick={() => onIndex(index - 1)}
            aria-label="Previous"
          >
            ‹
          </button>
          <span className="muted">
            {index + 1} / {items.length}
          </span>
          <button
            type="button"
            className="btn icon"
            disabled={index === items.length - 1}
            onClick={() => onIndex(index + 1)}
            aria-label="Next"
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
}
