import { useEffect, useRef, useState, type VideoHTMLAttributes } from "react";

export function useMediaVisibility<T extends HTMLElement>(eager = false) {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(eager);
  const [visible, setVisible] = useState(eager);
  const [foreground, setForeground] = useState(!document.hidden);
  const [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const proximity = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNear(true); proximity.disconnect(); }
    }, { rootMargin: "300px" });
    const viewport = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    proximity.observe(element);
    viewport.observe(element);
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { setForeground(!document.hidden); setReduced(preference.matches); };
    document.addEventListener("visibilitychange", sync);
    preference.addEventListener("change", sync);
    return () => {
      proximity.disconnect(); viewport.disconnect();
      document.removeEventListener("visibilitychange", sync);
      preference.removeEventListener("change", sync);
    };
  }, []);
  return { ref, near, active: visible && foreground && !reduced, reduced };
}

export function DeferredVideo({ src, eager = false, autoPlay = true, ...props }: VideoHTMLAttributes<HTMLVideoElement> & { eager?: boolean }) {
  const { ref, near, active, reduced } = useMediaVisibility<HTMLVideoElement>(eager);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (near && active && autoPlay) void video.play().catch(() => { /* Browser autoplay policy; keep the reserved frame. */ });
    else video.pause();
  }, [near, active, autoPlay, src]);
  return <video {...props} ref={ref} src={near && !reduced ? src : undefined} preload={near ? "metadata" : "none"} />;
}
