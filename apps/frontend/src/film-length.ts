export const FILM_LENGTHS = [30, 45, 60, 90] as const;
export type FilmLengthSec = (typeof FILM_LENGTHS)[number];

export const FILM_LENGTH_OPTIONS: Array<{ sec: FilmLengthSec; label: string; hint: string }> = [
  { sec: 30, label: "30s", hint: "Short. About 4–6 shots." },
  { sec: 45, label: "45s", hint: "A tight story." },
  { sec: 60, label: "60s", hint: "Usual documentary length." },
  { sec: 90, label: "90s", hint: "Longest we stitch." },
];

export function isFilmLength(value: unknown): value is FilmLengthSec {
  return value === 30 || value === 45 || value === 60 || value === 90;
}

export function sceneDurationBounds(sec: FilmLengthSec | undefined): { min: number; max: number } {
  return sec === 90 ? { min: 5, max: 15 } : { min: 4, max: 8 };
}
