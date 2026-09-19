import { useEffect, useState } from "react";
import { DeferredVideo, useMediaVisibility } from "../viewport-media";

export { DeferredVideo };

export function ImageCycle({ srcs, alt, interval = 2600, start = 0 }: {
  srcs: string[]; alt: string; interval?: number; start?: number;
}) {
  const [i, setI] = useState(start % Math.max(srcs.length, 1));
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  const { ref, near, active, reduced } = useMediaVisibility<HTMLDivElement>();
  const next = (i + 1) % srcs.length;
  useEffect(() => {
    if (!active || srcs.length < 2 || !loaded.has(srcs[next])) return;
    const timer = window.setInterval(() => setI(next), interval);
    return () => window.clearInterval(timer);
  }, [active, srcs, next, interval, loaded]);
  return (
    <div className="hf-reel" ref={ref}>
      {srcs.map((src, idx) => (
        <img key={src}
          src={near && (idx === i || (!reduced && idx === next) || loaded.has(src)) ? src : undefined}
          alt={idx === i ? alt : ""} decoding="async"
          onLoad={() => setLoaded((previous) => previous.has(src) ? previous : new Set(previous).add(src))}
          className={idx === i ? "is-on" : undefined} />
      ))}
    </div>
  );
}

export function VideoCycle({ srcs }: { srcs: string[] }) {
  const [i, setI] = useState(0);
  if (!srcs || srcs.length === 0) return null;
  if (srcs.length === 1) {
    return <DeferredVideo className="hf-reel-vid" src={srcs[0]} muted playsInline loop autoPlay />;
  }
  const safeIndex = i % srcs.length;
  const next = (safeIndex + 1) % srcs.length;
  return (
    <div className="hf-reel">
      {srcs.map((src, idx) => {
        const isCurrent = idx === safeIndex;
        const isNext = idx === next;
        return (
          <DeferredVideo
            key={src}
            className={`hf-reel-vid ${isCurrent ? "is-on" : ""}`}
            src={isCurrent || isNext ? src : undefined}
            preload={isCurrent ? "auto" : isNext ? "auto" : "none"}
            muted
            playsInline
            autoPlay={isCurrent}
            onEnded={() => {
              if (isCurrent) setI(next);
            }}
            style={{
              opacity: isCurrent ? 1 : 0,
              pointerEvents: isCurrent ? "auto" : "none",
              transition: "opacity 500ms ease",
            }}
          />
        );
      })}
    </div>
  );
}
