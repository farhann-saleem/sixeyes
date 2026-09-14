import { useEffect, useState } from "react";

export function ImageCycle({
  srcs,
  alt,
  interval = 2600,
  start = 0,
}: {
  srcs: string[];
  alt: string;
  interval?: number;
  start?: number;
}) {
  const [i, setI] = useState(start % Math.max(srcs.length, 1));

  useEffect(() => {
    if (srcs.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % srcs.length), interval);
    return () => window.clearInterval(id);
  }, [srcs.length, interval]);

  return (
    <div className="hf-reel">
      {srcs.map((src, idx) => (
        <img key={src} src={src} alt={idx === i ? alt : ""} className={idx === i ? "is-on" : undefined} />
      ))}
    </div>
  );
}

export function VideoCycle({ srcs }: { srcs: string[] }) {
  const [i, setI] = useState(0);

  return (
    <video
      key={srcs[i]}
      className="hf-reel-vid"
      src={srcs[i]}
      muted
      playsInline
      autoPlay
      onEnded={() => setI((n) => (n + 1) % srcs.length)}
    />
  );
}
