export function BrandMark({ className = "" }: { className?: string }) {
  return <img className={className} src="/brand/marketing-studio-logo.svg" width="56" height="56" alt="" aria-hidden="true" />;
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
