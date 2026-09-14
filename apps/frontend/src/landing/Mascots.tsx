export function MascotAstronaut({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 160 176" fill="none" aria-hidden="true">
      <ellipse cx="80" cy="164" rx="38" ry="7" fill="#150f23" opacity="0.45" />
      <path
        d="M48 78c-2-28 16-54 40-56 26-2 46 20 46 48 0 18-6 34-18 46l6 28c1 6-4 12-10 11l-16-4-8 14c-2 4-8 4-10 0l-8-14-16 4c-6 1-12-5-10-11l6-28c-10-12-16-28-16-38z"
        fill="#f7f4ee"
        stroke="#1f1633"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <path
        d="M58 86c0-22 12-38 30-38s30 16 30 38c0 10-4 18-10 24H68c-6-6-10-14-10-24z"
        fill="#150f23"
        stroke="#1f1633"
        strokeWidth="3"
      />
      <path d="M66 90c4-10 14-16 24-14" stroke="#c2ef4e" strokeWidth="3" strokeLinecap="round" />
      <circle cx="92" cy="92" r="4.5" fill="#fa7faa" />
      <path d="M44 96c-12 2-20 12-18 22 2 8 12 12 22 8" stroke="#fa7faa" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M116 98c12 4 20 14 16 24-3 8-14 10-24 6" stroke="#c2ef4e" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M70 54c8-10 22-12 32-4" stroke="#1f1633" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function MascotCone({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 128 150" fill="none" aria-hidden="true">
      <ellipse cx="64" cy="140" rx="32" ry="6" fill="#150f23" opacity="0.4" />
      <path
        d="M22 128c2 6 10 8 42 8s40-2 42-8c0-4-8-8-42-8s-42 4-42 8z"
        fill="#c2ef4e"
        stroke="#1f1633"
        strokeWidth="3"
      />
      <path
        d="M40 120 58 28c2-8 10-8 12 0l18 92"
        fill="#fa7faa"
        stroke="#1f1633"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <path d="M44 96h40M46 78h36M50 60h28" stroke="#f7f4ee" strokeWidth="7" strokeLinecap="round" />
      <path d="M44 96h40M46 78h36M50 60h28" stroke="#1f1633" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="54" cy="46" r="4" fill="#1f1633" />
      <circle cx="74" cy="46" r="4" fill="#1f1633" />
      <path d="M56 56c4 4 12 4 16 0" stroke="#1f1633" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function MascotCritter({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 150 140" fill="none" aria-hidden="true">
      <ellipse cx="76" cy="128" rx="36" ry="6" fill="#150f23" opacity="0.4" />
      <path
        d="M28 78c-8-28 10-58 44-62 30-4 58 18 62 48 4 28-12 52-40 58-22 4-48-2-58-16-8 10-24 8-30-4-6-12 4-22 22-24z"
        fill="#6a5fc1"
        stroke="#1f1633"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <path d="M58 28c2-16 12-24 20-14M96 32c6-14 18-18 22-6" stroke="#1f1633" strokeWidth="3" strokeLinecap="round" />
      <circle cx="62" cy="70" r="10" fill="#f7f4ee" stroke="#1f1633" strokeWidth="2.6" />
      <circle cx="96" cy="72" r="10" fill="#f7f4ee" stroke="#1f1633" strokeWidth="2.6" />
      <circle cx="64" cy="72" r="4.5" fill="#1f1633" />
      <circle cx="98" cy="74" r="4.5" fill="#1f1633" />
      <path d="M70 92c8 8 20 8 28-2" stroke="#c2ef4e" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M24 86c-8 6-8 16 2 18" stroke="#fa7faa" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
