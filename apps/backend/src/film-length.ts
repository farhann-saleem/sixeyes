export const FILM_LENGTHS = [30, 45, 60, 90] as const;
export type FilmLengthSec = (typeof FILM_LENGTHS)[number];

export type FilmLengthPlan = {
  target: FilmLengthSec;
  scenesMin: number;
  scenesMax: number;
  sceneMin: number;
  sceneMax: number;
  totalMin: number;
  totalMax: number;
  /** Minimum words for generated scripts so spoken length can fill the film (~2.5 wps). */
  wordsMin: number;
  wordsMax: number;
  wordsAim: string;
};

export function isFilmLength(value: unknown): value is FilmLengthSec {
  return value === 30 || value === 45 || value === 60 || value === 90;
}

export function parseFilmLength(value: unknown): FilmLengthSec {
  const n = typeof value === "string" && value.trim() ? Number(value) : value;
  if (isFilmLength(n)) return n;
  if (value == null || value === "") return 60;
  throw new Error("Film length must be 30, 45, 60, or 90 seconds");
}

export function filmLengthPlan(sec: FilmLengthSec): FilmLengthPlan {
  // Word budgets track ~2.5 words/sec documentary TTS so narration fills the chosen length.
  if (sec === 30) {
    return { target: 30, scenesMin: 4, scenesMax: 6, sceneMin: 4, sceneMax: 8, totalMin: 24, totalMax: 36, wordsMin: 55, wordsMax: 100, wordsAim: "65–85" };
  }
  if (sec === 45) {
    return { target: 45, scenesMin: 5, scenesMax: 7, sceneMin: 4, sceneMax: 8, totalMin: 38, totalMax: 52, wordsMin: 85, wordsMax: 140, wordsAim: "100–120" };
  }
  if (sec === 90) {
    return { target: 90, scenesMin: 8, scenesMax: 12, sceneMin: 5, sceneMax: 15, totalMin: 70, totalMax: 90, wordsMin: 180, wordsMax: 270, wordsAim: "210–240" };
  }
  return { target: 60, scenesMin: 6, scenesMax: 8, sceneMin: 4, sceneMax: 8, totalMin: 45, totalMax: 65, wordsMin: 110, wordsMax: 180, wordsAim: "140–160" };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Stretch or shrink scene timings to the chosen film length. Used for coffee presets. */
export function scaleScriptToLength(raw: unknown, length: FilmLengthSec): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const script = raw as { scenes?: unknown[] };
  if (!Array.isArray(script.scenes) || !script.scenes.length) return raw;
  const plan = filmLengthPlan(length);
  const n = script.scenes.length;
  const each = clamp(Math.round((length / n) * 10) / 10, plan.sceneMin, plan.sceneMax);
  const leftover = Math.round((length - each * (n - 1)) * 10) / 10;
  return {
    ...script,
    scenes: script.scenes.map((scene, i) => {
      if (!scene || typeof scene !== "object") return scene;
      const duration = i === n - 1 && leftover >= plan.sceneMin && leftover <= plan.sceneMax ? leftover : each;
      return { ...scene, duration_sec: duration };
    }),
  };
}

export function fitGeneratedDurations(scenes: { duration_sec: number }[], plan: FilmLengthPlan) {
  const n = scenes.length;
  if (n < plan.scenesMin || n > plan.scenesMax) return;
  const total = scenes.reduce((sum, s) => sum + Number(s.duration_sec), 0);
  const badScene = scenes.some((s) => {
    const d = Number(s.duration_sec);
    return !Number.isFinite(d) || d < plan.sceneMin || d > plan.sceneMax;
  });
  if (Number.isFinite(total) && total >= plan.totalMin && total <= plan.totalMax && !badScene) return;
  const each = clamp(Math.round((plan.target / n) * 10) / 10, plan.sceneMin, plan.sceneMax);
  for (const scene of scenes) scene.duration_sec = each;
  let next = each * n;
  if (next > plan.totalMax) {
    scenes[n - 1].duration_sec = clamp(Math.round((each - (next - plan.totalMax)) * 10) / 10, plan.sceneMin, plan.sceneMax);
  } else if (next < plan.totalMin) {
    scenes[n - 1].duration_sec = clamp(Math.round((each + (plan.totalMin - next)) * 10) / 10, plan.sceneMin, plan.sceneMax);
  }
}
