import { useEffect, useRef } from "react";

/** Motion is progressive enhancement: no content is hidden before JS runs. */
export function useLandingMotion() {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations = new Set<Animation>();
    const seen = new WeakSet<Element>();
    const animate = (element: HTMLElement, delay = 0, lift = true) => {
      if (preference.matches || document.hidden) return;
      const animation = element.animate(
        lift
          ? [{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "translateY(0)" }]
          : [{ opacity: 0 }, { opacity: 1 }],
        { duration: 560, delay, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "backwards" },
      );
      animations.add(animation);
      animation.onfinish = () => animations.delete(animation);
    };
    root.querySelectorAll<HTMLElement>(".hf-badge, .hf-hero-your, .hf-hero h1 > .chip-lime-keyword, .hf-hero p, .hf-hero-ctas, .hf-telem")
      .forEach((element, index) => animate(element, index * 65));

    const reveal = new IntersectionObserver((entries) => {
      const entering = entries.filter((entry) => entry.isIntersecting && !seen.has(entry.target));
      entering.forEach((entry, index) => {
        seen.add(entry.target);
        reveal.unobserve(entry.target);
        // Cards keep their existing hover transforms; entrance affects only opacity.
        const card = entry.target.matches("a, .hf-footer-grid > *, .hf-why-read li");
        animate(entry.target as HTMLElement, Math.min(index, 4) * 55, !card);
      });
    }, { threshold: 0.08 });
    root.querySelectorAll(".hf-why-head, .hf-sec-head, .hf-center-copy, .hf-dir-head, .hf-pipe-intro, .hf-why-film, .hf-why-read li, .hf-why-shot, .hf-card, .hf-av, .hf-var, .hf-viewport, .hf-dir-side, .hf-enterprise, .hf-footer-grid > *")
      .forEach((element) => reveal.observe(element));

    const ambient = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.classList.toggle("hf-motion-visible", entry.isIntersecting));
    });
    root.querySelectorAll(".hf-hero-band, section, .hf-wave, .hf-squiggle, .hf-footer")
      .forEach((element) => ambient.observe(element));
    const sync = () => {
      root.classList.toggle("hf-motion-paused", document.hidden || preference.matches);
      if (preference.matches) animations.forEach((animation) => animation.cancel());
      else animations.forEach((animation) => document.hidden ? animation.pause() : animation.play());
    };
    // Keyboard focus must be immediate, even while a section is entering.
    const finishEntrances = () => animations.forEach((animation) => animation.finish());
    sync();
    root.classList.add("hf-motion-ready");
    root.addEventListener("keydown", finishEntrances);
    document.addEventListener("visibilitychange", sync);
    preference.addEventListener("change", sync);
    return () => {
      reveal.disconnect();
      ambient.disconnect();
      animations.forEach((animation) => animation.cancel());
      root.classList.remove("hf-motion-ready", "hf-motion-paused");
      root.removeEventListener("keydown", finishEntrances);
      document.removeEventListener("visibilitychange", sync);
      preference.removeEventListener("change", sync);
    };
  }, []);
  return rootRef;
}
