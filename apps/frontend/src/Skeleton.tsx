import { type ReactNode } from "react";

export function SkeletonCard() {
  return (
    <div className="ms-skeleton-card" aria-hidden="true">
      <div className="ms-skeleton ms-skeleton-media" />
      <div className="ms-skeleton ms-skeleton-line ms-skeleton-line-title" />
      <div className="ms-skeleton ms-skeleton-line ms-skeleton-line-sub" />
      <div className="ms-skeleton-actions">
        <div className="ms-skeleton ms-skeleton-btn" />
        <div className="ms-skeleton ms-skeleton-btn" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "20px",
        width: "100%",
        paddingBlock: "12px",
      }}
      aria-label="Loading content..."
      role="status"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
