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
  // Gentle seam shared by all waves. Flip used to use a harsher path that kinked under stretch.
  const line = "M0,24 C320,70 480,4 720,44 C960,84 1200,10 1440,48";
  const d = `${line} L1440,90 L0,90 Z`;
  // flip = cream section → night. Without a cream underlay, the SVG’s clear top shows the dark page canvas as a broken band.
  const underlay = flip ? "#f7f5f0" : undefined;
  return (
    <div
      className={`hf-wave${glow === "pink" ? " hf-wave-pink" : ""}`}
      style={underlay ? { background: underlay } : undefined}
      aria-hidden="true"
    >
      <svg viewBox="0 0 1440 90" preserveAspectRatio="none">
        <path d={d} fill={fill} />
        <path className={glow === "pink" ? "hf-pink-glow" : "hf-lime-glow"} d={line} fill="none" stroke={stroke} strokeWidth="3" />
      </svg>
    </div>
  );
}

export function Squiggle({ fill }: { fill: string }) {
  // Same seam as Wave. Background = fill so cream→cream does not leak the dark page canvas above the stroke.
  const line = "M0,24 C320,70 480,4 720,44 C960,84 1200,10 1440,48";
  return (
    <div className="hf-wave hf-squiggle" style={{ background: fill }} aria-hidden="true">
      <svg viewBox="0 0 1440 90" preserveAspectRatio="none">
        <path d={`${line} L1440,90 L0,90 Z`} fill={fill} />
        <path
          className="hf-lime-glow"
          d={line}
          fill="none"
          stroke="#c2ef4e"
          strokeWidth="3"
        />
      </svg>
    </div>
  );
}
