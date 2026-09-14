export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 56 56" aria-hidden="true">
      <circle cx="28" cy="28" r="26" stroke="#362d59" strokeWidth="2" />
      <polygon fill="#c2ef4e" points="28,8 39,22 28,28 17,22" />
      <polygon fill="#fa7faa" points="48,28 34,39 28,28 34,17" />
      <polygon fill="#c2ef4e" points="28,48 17,34 28,28 39,34" />
      <polygon fill="#6a5fc1" points="8,28 22,17 28,28 22,39" />
      <circle cx="28" cy="28" fill="#150f23" r="5" stroke="#c2ef4e" strokeWidth="2" />
      <circle cx="28" cy="28" fill="#ffffff" r="2" />
    </svg>
  );
}

export function Icon({ name }: { name: string }) {
  return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;
}

export function Wave({
  fill,
  stroke,
  glow,
  flip,
}: {
  fill: string;
  stroke: string;
  glow: "lime" | "pink";
  flip?: boolean;
}) {
  const d = flip
    ? "M0,48 C240,10 480,84 720,44 C960,4 1200,70 1440,24 L1440,90 L0,90 Z"
    : "M0,24 C320,70 480,4 720,44 C960,84 1200,10 1440,48 L1440,90 L0,90 Z";
  const line = flip
    ? "M0,48 C240,10 480,84 720,44 C960,4 1200,70 1440,24"
    : "M0,24 C320,70 480,4 720,44 C960,84 1200,10 1440,48";
  return (
    <div className={`hf-wave${glow === "pink" ? " hf-wave-pink" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 1440 90" preserveAspectRatio="none">
        <path d={d} fill={fill} />
        <path className={glow === "pink" ? "hf-pink-glow" : "hf-lime-glow"} d={line} fill="none" stroke={stroke} strokeWidth="3" />
      </svg>
    </div>
  );
}

export function Squiggle({ fill }: { fill: string }) {
  return (
    <div className="hf-wave hf-squiggle" aria-hidden="true">
      <svg viewBox="0 0 1440 60" preserveAspectRatio="none">
        <path d="M0,20 C360,45 720,5 1080,35 L1440,15 L1440,60 L0,60 Z" fill={fill} />
        <path
          className="hf-lime-glow"
          d="M0,20 C360,45 720,5 1080,35 L1440,15"
          fill="none"
          stroke="#c2ef4e"
          strokeWidth="2.5"
        />
      </svg>
    </div>
  );
}
