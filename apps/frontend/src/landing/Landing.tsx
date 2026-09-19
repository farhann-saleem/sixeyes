import { useEffect, useState, type MouseEvent } from "react";
import { type Route } from "../Nav";
import { BrandMark, Icon, Squiggle, Wave } from "./BrandMark";
import { IMG } from "./media";
import { DeferredVideo, ImageCycle, VideoCycle } from "./StudioReel";
import "./landing.css";
import "./landing-motion.css";
import { useLandingMotion } from "./useLandingMotion";

const STUDIO_FILTERS = [
  { id: "i2i", label: "Image to Image" },
  { id: "t2i", label: "Text to Image" },
  { id: "t2v", label: "Text to Video" },
  { id: "i2v", label: "Image to Video" },
] as const;

const I2I_STILLS = [
  "/landing/studio/still-1.webp",
  "/landing/studio/still-2.webp",
  "/landing/studio/still-3.webp",
  "/landing/studio/still-7.webp",
  "/landing/studio/still-8.webp",
  "/landing/studio/still-14.webp",
];

const T2I_STILLS = [
  "/landing/studio/still-4.webp",
  "/landing/studio/still-5.webp",
  "/landing/studio/still-6.webp",
  "/landing/studio/still-9.webp",
  "/landing/studio/still-10.webp",
  "/landing/studio/still-15.webp",
];

const LOOK_STILLS = [
  "/landing/studio/still-11.webp",
  "/landing/studio/still-12.webp",
  "/landing/studio/still-13.webp",
  "/landing/studio/still-16.webp",
  "/landing/studio/still-7.webp",
  "/landing/studio/still-4.webp",
];

type StudioTile = {
  id: string;
  mode: "i2i" | "t2i" | "t2v" | "i2v";
  label: string;
  tag: string;
  tagClass: string;
  cap: string;
  href: string;
  route: Route;
  kind: "image" | "video";
  aspect: "hf-a-916" | "hf-a-43" | "hf-a-34" | "hf-a-vid";
  start?: number;
  interval?: number;
  media: string[];
};

const STUDIO_COLS: StudioTile[][] = [
  [
    {
      id: "i2i",
      mode: "i2i",
      label: "Image to Image",
      tag: "I2I",
      tagClass: "hf-tag-pink",
      cap: "Adjust scene styling while preserving character consistency.",
      href: "/images-templates",
      route: { name: "templates" },
      kind: "image",
      aspect: "hf-a-916",
      interval: 2400,
      media: I2I_STILLS,
    },
    {
      id: "i2i-look",
      mode: "i2i",
      label: "Wardrobe remap",
      tag: "I2I",
      tagClass: "hf-tag-pink",
      cap: "Update wardrobe and background in any frame.",
      href: "/images-templates",
      route: { name: "templates" },
      kind: "image",
      aspect: "hf-a-43",
      start: 2,
      interval: 3100,
      media: I2I_STILLS,
    },
  ],
  [
    {
      id: "t2i",
      mode: "t2i",
      label: "Text to Image",
      tag: "T2I",
      tagClass: "hf-tag-lime",
      cap: "Generate reference stills from text descriptions.",
      href: "/avatar",
      route: { name: "avatar" },
      kind: "image",
      aspect: "hf-a-43",
      interval: 2200,
      media: T2I_STILLS,
    },
    {
      id: "t2i-look",
      mode: "t2i",
      label: "Lookbook",
      tag: "T2I",
      tagClass: "hf-tag-lime",
      cap: "Build a collection of reusable visual assets.",
      href: "/avatar",
      route: { name: "avatar" },
      kind: "image",
      aspect: "hf-a-34",
      start: 1,
      interval: 2700,
      media: LOOK_STILLS,
    },
  ],
  [
    {
      id: "t2v",
      mode: "t2v",
      label: "Text to Video",
      tag: "T2V",
      tagClass: "hf-tag-dark",
      cap: "Turn story outlines into assembled video scenes.",
      href: "/projects",
      route: { name: "projects" },
      kind: "video",
      aspect: "hf-a-vid",
      interval: 3500,
      media: ["/landing/docs/coffee-1.mp4", "/landing/docs/coffee-2.mp4", "/landing/docs/coffee-3.mp4", "/landing/docs/coffee-4.mp4"],
    },
  ],
  [
    {
      id: "i2v",
      mode: "i2v",
      label: "Image to Video",
      tag: "I2V",
      tagClass: "hf-tag-lilac",
      cap: "Animate still images into realistic motion shots.",
      href: "/effects",
      route: { name: "effects" },
      kind: "video",
      aspect: "hf-a-916",
      media: [
        "/landing/studio/i2v-1.mp4",
        "/landing/studio/i2v-2.mp4",
        "/landing/studio/i2v-3.mp4",
        "/landing/studio/i2v-4.mp4",
      ],
    },
  ],
  [
    {
      id: "i2v-alt",
      mode: "i2v",
      label: "World lock",
      tag: "I2V",
      tagClass: "hf-tag-lilac",
      cap: "Cinematic camera movement around a steady subject.",
      href: "/effects",
      route: { name: "effects" },
      kind: "video",
      aspect: "hf-a-34",
      media: ["/landing/studio/i2v-5.mp4", "/landing/studio/i2v-2.mp4", "/landing/studio/i2v-1.mp4"],
    },
    {
      id: "t2v-wide",
      mode: "t2v",
      label: "Cutdown",
      tag: "T2V",
      tagClass: "hf-tag-dark",
      cap: "Wide-angle cut assembled for social video feeds.",
      href: "/projects",
      route: { name: "projects" },
      kind: "video",
      aspect: "hf-a-vid",
      media: ["/landing/docs/coffee-2.mp4", "/landing/docs/coffee-4.mp4", "/landing/docs/coffee-1.mp4"],
    },
  ],
];

type FxTile = {
  id: string;
  label: string;
  tag: string;
  tagClass: string;
  aspect: "hf-a-916" | "hf-a-43" | "hf-a-34" | "hf-a-vid";
  media: string[];
};

const EFFECT_COLS: FxTile[][] = [
  [
    {
      id: "incline",
      label: "Incline",
      tag: "INCLINE",
      tagClass: "hf-tag-lime",
      aspect: "hf-a-916",
      media: ["/landing/effects/incline-1.mp4", "/landing/effects/incline-2.mp4", "/landing/hero-1.mp4"],
    },
    {
      id: "vanish",
      label: "Vanish",
      tag: "VANISH",
      tagClass: "hf-tag-soft",
      aspect: "hf-a-43",
      media: ["/landing/effects/vanish-1.mp4", "/landing/effects/vanish-2.mp4"],
    },
  ],
  [
    {
      id: "stop",
      label: "Stop World",
      tag: "STOP WORLD",
      tagClass: "hf-tag-pink",
      aspect: "hf-a-43",
      media: ["/landing/effects/stop-1.mp4", "/landing/effects/stop-2.mp4", "/landing/hero-2.mp4"],
    },
    {
      id: "pigeons",
      label: "Pigeons",
      tag: "PIGEONS",
      tagClass: "hf-tag-lilac",
      aspect: "hf-a-34",
      media: ["/landing/effects/pigeons-1.mp4", "/landing/effects/pigeons-2.mp4"],
    },
  ],
  [
    {
      id: "clones",
      label: "Clones",
      tag: "CLONES",
      tagClass: "hf-tag-dark",
      aspect: "hf-a-916",
      media: ["/landing/effects/clones-1.mp4", "/landing/hero-3.mp4", "/landing/studio/i2v-2.mp4"],
    },
  ],
  [
    {
      id: "frozen",
      label: "Frozen in Motion",
      tag: "FROZEN",
      tagClass: "hf-tag-lime",
      aspect: "hf-a-916",
      media: ["/landing/effects/frozen-1.mp4", "/landing/effects/frozen-2.mp4"],
    },
  ],
  [
    {
      id: "act",
      label: "Act Natural",
      tag: "ACT NATURAL",
      tagClass: "hf-tag-pink",
      aspect: "hf-a-34",
      media: ["/landing/effects/act-1.mp4", "/landing/effects/act-2.mp4"],
    },
    {
      id: "slide",
      label: "Studio Slide",
      tag: "SLIDE",
      tagClass: "hf-tag-soft",
      aspect: "hf-a-vid",
      media: ["/landing/effects/slide-1.mp4", "/landing/effects/slide-2.mp4"],
    },
  ],
  [
    {
      id: "incline-cafe",
      label: "Cafe lock",
      tag: "INCLINE",
      tagClass: "hf-tag-lime",
      aspect: "hf-a-34",
      media: ["/landing/effects/incline-3.mp4", "/landing/effects/incline-4.mp4"],
    },
    {
      id: "stop-wide",
      label: "Hold the street",
      tag: "STOP WORLD",
      tagClass: "hf-tag-pink",
      aspect: "hf-a-vid",
      media: ["/landing/effects/stop-2.mp4", "/landing/effects/stop-1.mp4"],
    },
  ],
];

const AVATARS = [
  {
    name: "Chloe",
    tag: "CHLOE",
    tagClass: "hf-tag-soft",
    meta: "Studio lock",
    interval: 2400,
    media: ["/landing/avatars/chloe/01.webp", "/landing/avatars/chloe/02.webp", "/landing/avatars/chloe/03.webp", "/landing/avatars/chloe/04.webp"],
  },
  {
    name: "Fox",
    tag: "FOX",
    tagClass: "hf-tag-lime",
    meta: "Beauty stills",
    interval: 2800,
    start: 1,
    media: [
      "/landing/avatars/fox/01.webp",
      "/landing/avatars/fox/02.webp",
      "/landing/avatars/fox/03.webp",
      "/landing/avatars/fox/04.webp",
      "/landing/avatars/fox/05.webp",
    ],
  },
  {
    name: "Jennie",
    tag: "JENNIE",
    tagClass: "hf-tag-pink",
    meta: "Multi-angle",
    interval: 2600,
    start: 2,
    media: ["/landing/avatars/jennie/01.webp", "/landing/avatars/jennie/02.webp", "/landing/avatars/jennie/03.webp", "/landing/avatars/jennie/04.webp"],
  },
  {
    name: "Shawn",
    tag: "SHAWN",
    tagClass: "hf-tag-dark",
    meta: "ID lock",
    interval: 3000,
    media: ["/landing/avatars/shawn/01.webp", "/landing/avatars/shawn/02.webp", "/landing/avatars/shawn/03.webp", "/landing/avatars/shawn/04.webp"],
  },
];

const COFFEE_SCENES = [
  { src: "/landing/docs/coffee-1.mp4", n: "01", label: "Dawn", hint: "Espresso at first light" },
  { src: "/landing/docs/coffee-2.mp4", n: "02", label: "Baristas", hint: "Each drink is made" },
  { src: "/landing/docs/coffee-3.mp4", n: "03", label: "Friends", hint: "A table fills up" },
  { src: "/landing/docs/coffee-4.mp4", n: "04", label: "Cups", hint: "The hold at the end" },
];

const HERO_CLIPS = [
  { src: "/landing/hero-1.mp4", label: "Incline: studio coffees" },
  { src: "/landing/hero-2.mp4", label: "Stop World" },
  { src: "/landing/hero-3.mp4", label: "Clones" },
];

function warmupLandingMedia() {
  if (typeof window === "undefined") return;
  const clips = [
    "/landing/docs/coffee-1.mp4",
    "/landing/docs/coffee-2.mp4",
    "/landing/docs/coffee-3.mp4",
    "/landing/docs/coffee-4.mp4",
    "/landing/hero-2.mp4",
  ];
  const run = () => {
    clips.forEach((url) => {
      try {
        fetch(url, { priority: "low" } as RequestInit).catch(() => {});
      } catch {
        // Ignore background pre-warm failures
      }
    });
  };
  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(run, { timeout: 2000 });
  } else {
    setTimeout(run, 1200);
  }
}

export function Landing({ onGo }: { onGo: (next: Route) => void }) {
  const motionRef = useLandingMotion();
  const [studioOn, setStudioOn] = useState("i2i");

  useEffect(() => {
    document.documentElement.classList.add("lp-root");
    warmupLandingMedia();
    return () => document.documentElement.classList.remove("lp-root");
  }, []);

  function go(route: Route) {
    return (e: MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      onGo(route);
    };
  }

  return (
    <div className="hf" ref={motionRef}>
      <div className="hf-hero-band">
        <div className="hf-hero-vids" aria-hidden="true">
          {HERO_CLIPS.map((clip) => (
            <DeferredVideo
              key={clip.src}
              eager
              src={clip.src}
              muted
              loop
              playsInline
              autoPlay
            />
          ))}
        </div>
        <div className="hf-hero-veil" aria-hidden="true" />
        <div className="hf-ambient" aria-hidden="true">
          <div className="hf-orb hf-orb-a" />
          <div className="hf-orb hf-orb-b" />
          <div className="hf-orb hf-orb-c" />
        </div>
        <section className="hf-hero">
          <div className="hf-wrap-hero">
            <div className="hf-hero-brand-lockup">
              <span className="hf-badge">MARKETING STUDIO</span>
              <span className="hf-hero-tagline">Your Imagination Engine</span>
            </div>
            <h1>
              Turn your script into a video you can{" "}
              <span className="chip-lime-keyword">shape scene by scene</span>.
            </h1>
            <p>
              Choose the footage, add your narration, and refine the timeline in one workspace.
              Create reusable avatars, images, and audio for your next story.
            </p>
            <div className="hf-hero-ctas">
              <a className="hf-btn-lime" href="/projects" onClick={go({ name: "projects" })}>
                Create your first video
              </a>
              <a
                className="hf-btn-ghost-dark"
                href="#why-us"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("why-us")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Watch the product demo
              </a>
            </div>
            <div className="hf-telem" aria-label="Workflow: Script, Scene Selection, Timeline, Sound">
              <span className="hf-telem-step">SCRIPT</span>
              <span className="hf-telem-sep" aria-hidden="true">·</span>
              <span className="hf-telem-step">SCENE SELECTION</span>
              <span className="hf-telem-sep" aria-hidden="true">·</span>
              <span className="hf-telem-step">TIMELINE</span>
              <span className="hf-telem-sep" aria-hidden="true">·</span>
              <span className="hf-telem-step">SOUND</span>
            </div>
          </div>
        </section>
      </div>

      <Wave fill="#f7f5f0" stroke="#c2ef4e" glow="lime" />

      <section className="hf-cream hf-why" id="why-us">
        <div className="hf-wrap-hero">
          <div className="hf-why-head">
            <div className="hf-kicker rose">CONNECTED CREATIVE WORKFLOW</div>
            <h2>
              Your script, scene choices, narration, and edit stay together in{" "}
              <span className="chip-lime-keyword">one project</span>.
            </h2>
            <p>
              Review your script, compare footage options for each scene, and bring your selections into an editable timeline. Keep making changes as your story develops.
            </p>
          </div>

          <div className="hf-why-stage">
            <a className="hf-why-film" href="/projects" onClick={go({ name: "projects" })}>
              <div className="hf-frame hf-a-vid">
                <VideoCycle srcs={COFFEE_SCENES.map((s) => s.src)} />
                <span className="hf-tag hf-tag-lime">COFFEE SHOP MORNING</span>
              </div>
              <div className="hf-why-film-meta">
                <strong>A finished story example</strong>
                <span>Script in the editor. These four scenes assembled into one finished story.</span>
              </div>
            </a>
            <div className="hf-why-copy">
              <ol className="hf-why-read">
                <li>
                  <strong>Review your script.</strong>
                  <span>Read the draft and edit any voiceover line before generating footage.</span>
                </li>
                <li>
                  <strong>Choose your shots.</strong>
                  <span>Compare footage options for each scene and keep the ones you like.</span>
                </li>
                <li>
                  <strong>Refine the timeline.</strong>
                  <span>Adjust timing, trim clips, and shape the story in the built-in editor.</span>
                </li>
                <li>
                  <strong>Add your sound.</strong>
                  <span>Mix full narration with background audio and music beds.</span>
                </li>
              </ol>
              <a className="hf-btn-lime" href="/projects" onClick={go({ name: "projects" })}>
                Create your first video
              </a>
            </div>
          </div>

          <div className="hf-why-board" aria-label="Scenes from Coffee shop morning">
            {COFFEE_SCENES.map((scene) => (
              <a
                key={scene.src}
                className="hf-why-shot"
                href="/projects"
                onClick={go({ name: "projects" })}
              >
                <div className="hf-frame hf-a-vid">
                  <DeferredVideo src={scene.src} muted loop playsInline autoPlay />
                </div>
                <div className="hf-why-shot-meta">
                  <em>{scene.n}</em>
                  <strong>{scene.label}</strong>
                  <span>{scene.hint}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <Squiggle fill="#f7f5f0" />

      <section className="hf-cream hf-studio" id="visual-effects">
        <div className="hf-wrap">
          <div className="hf-sec-head">
            <div>
              <div className="hf-kicker rose">
                <span className="hf-dot hf-dot-ping" style={{ background: "#821f4a" }} />
                LOOKS
              </div>
              <h2 className="hf-display">GENERATE A LOOK</h2>
              <p className="hf-sub">
                Still image and video desks work alongside your story projects. Create character portraits, style references, and motion clips.
              </p>
            </div>
            <a className="hf-btn-lime" href="/images-templates" onClick={go({ name: "templates" })}>
              Open Images
            </a>
          </div>

          <div className="hf-filters">
            {STUDIO_FILTERS.map((desk) => (
              <button
                key={desk.id}
                type="button"
                className={studioOn === desk.id ? "is-on" : undefined}
                onClick={() => setStudioOn(desk.id)}
              >
                {desk.label}
              </button>
            ))}
          </div>

          <div className="hf-studio-masonry">
            {STUDIO_COLS.map((col, colIdx) => (
              <div key={colIdx} className="hf-col">
                {col.map((desk) => (
                  <a
                    key={desk.id}
                    className={`hf-card hf-studio-card shimmer-mask${studioOn === desk.mode ? " is-focus" : ""}`}
                    href={desk.href}
                    onClick={go(desk.route)}
                    onMouseEnter={() => setStudioOn(desk.mode)}
                  >
                    <div className={`hf-frame ${desk.aspect}`}>
                      {desk.kind === "image" ? (
                        <ImageCycle
                          srcs={desk.media}
                          alt={desk.label}
                          interval={desk.interval}
                          start={desk.start}
                        />
                      ) : (
                        <VideoCycle srcs={desk.media} />
                      )}
                      <span className={`hf-tag ${desk.tagClass}`}>{desk.tag}</span>
                      <div className="hf-studio-label">{desk.label}</div>
                      <div className="hf-cap">{desk.cap}</div>
                    </div>
                  </a>
                ))}
              </div>
            ))}
          </div>

          <div className="hf-center">
            <a className="hf-btn-ink" href="/effects" onClick={go({ name: "effects" })}>
              <span>Open Effects</span>
              <Icon name="arrow_forward" />
            </a>
          </div>
        </div>
      </section>

      <Wave fill="#150f23" stroke="#fa7faa" glow="pink" flip />

      <section className="hf-night" id="studio-nodes">
        <div className="hf-wrap">
          <div className="hf-center-copy">
            <span className="hf-badge">REFERENCE STILL</span>
            <h2>
              Save a <span className="chip-lime-keyword">character look</span>
            </h2>
            <p>
              Generate a portrait, name it, and reuse it as a consistent character reference across images, videos, and effects.
            </p>
          </div>

          <div className="hf-avatars">
            {AVATARS.map((a) => (
              <a key={a.name} className="hf-av shimmer-mask" href="/avatar" onClick={go({ name: "avatar" })}>
                <div className="hf-frame hf-a-34">
                  <ImageCycle srcs={a.media} alt={a.name} interval={a.interval} start={a.start} />
                  <span className={`hf-tag ${a.tagClass}`}>{a.tag}</span>
                  <div className="hf-av-meta">
                    <strong>{a.name}</strong>
                    <em>{a.meta}</em>
                  </div>
                </div>
              </a>
            ))}
          </div>

          <div className="hf-fx">
            <div className="hf-sec-head">
              <div>
                <div className="hf-kicker lime">
                  <span className="hf-dot hf-dot-ping" />
                  EFFECTS LIBRARY
                </div>
                <h2 className="hf-display">EFFECTS</h2>
                <p className="hf-sub">
                  Incline, Stop World, Clones, and Vanish: motion packs where camera angles shift around a steady subject.
                </p>
              </div>
              <a className="hf-btn-lime" href="/effects" onClick={go({ name: "effects" })}>
                Open Effects
              </a>
            </div>
            <div className="hf-fx-masonry">
              {EFFECT_COLS.map((col, colIdx) => (
                <div key={colIdx} className="hf-col">
                  {col.map((tile) => (
                    <a
                      key={tile.id}
                      className="hf-card hf-fx-card shimmer-mask"
                      href="/effects"
                      onClick={go({ name: "effects" })}
                    >
                      <div className={`hf-frame ${tile.aspect}`}>
                        <VideoCycle srcs={tile.media} />
                        <span className={`hf-tag ${tile.tagClass}`}>{tile.tag}</span>
                        <div className="hf-studio-label">{tile.label}</div>
                      </div>
                    </a>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Wave fill="#f7f5f0" stroke="#c2ef4e" glow="lime" />

      <section className="hf-cream" id="director-mode">
        <div className="hf-wrap-hero">
          <div className="hf-dir-head">
            <div>
              <div className="hf-kicker rose">
                <Icon name="cloud" />
                CLOUD RENDER QUEUE
              </div>
              <h2>
                Render on the <span className="chip-lime-keyword">cloud</span>
              </h2>
            </div>
            <p>
              Submit a job. We write a row and poll. Images on RunPod. Video on Modal. Look generate
              and stitch on RunPod CPU. The browser never waits on the model.
            </p>
          </div>

          <div className="hf-bento">
            <div className="hf-viewport">
              <div className="hf-vp-bar">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="hf-live">
                    <i /> JOB::RUNNING
                  </span>
                  <span className="hf-orbit">ASYNC POLL</span>
                </div>
                <div style={{ fontFamily: "Space Mono, monospace", fontSize: 11, color: "#4d445c" }}>
                  <strong style={{ color: "#150f23" }}>EU-RO-1</strong>
                  {" • "}
                  <span style={{ background: "rgba(194,239,78,0.4)", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>
                    METERED
                  </span>
                </div>
              </div>
              <div className="hf-screen">
                <DeferredVideo src="/landing/hero-2.mp4" muted loop playsInline autoPlay />
                <div className="hf-hud">
                  <div className="hf-hud-row">
                    <span className="hf-hud-chip" style={{ color: "#c2ef4e", border: "1px solid rgba(194,239,78,0.5)" }}>
                      QUEUED → RUN → DONE
                    </span>
                    <span className="hf-hud-chip" style={{ color: "#ffb1c8", border: "1px solid rgba(255,177,200,0.5)" }}>
                      NO BLOCKING HTTP
                    </span>
                  </div>
                  <div className="hf-reticle">
                    <svg fill="none" height="64" viewBox="0 0 48 48" width="64">
                      <circle className="hf-radar" cx="24" cy="24" r="18" stroke="#c2ef4e" strokeDasharray="4 4" strokeWidth="1.5" />
                      <path d="M24 2V10M24 38V46M2 24H10M38 24H46" stroke="#c2ef4e" strokeWidth="1.5" />
                      <circle cx="24" cy="24" fill="#c2ef4e" r="3" />
                    </svg>
                  </div>
                  <div className="hf-hud-row">
                    <span className="hf-hud-chip" style={{ color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}>
                      RUNPOD · MODAL · CPU
                    </span>
                    <span className="hf-hud-chip" style={{ background: "#c2ef4e", color: "#150f23", fontWeight: 700 }}>
                      POLL /STATUS
                    </span>
                  </div>
                </div>
              </div>
              <div className="hf-sliders">
                <div className="hf-slider">
                  <div className="hf-slider-lab">
                    <span>IMAGE · RUNPOD GPU</span>
                    <span style={{ color: "#150f23", fontWeight: 700 }}>KREA / QWEN</span>
                  </div>
                  <div className="hf-bar">
                    <i style={{ width: "72%", background: "#aad636", boxShadow: "0 0 8px #aad636" }} />
                  </div>
                </div>
                <div className="hf-slider">
                  <div className="hf-slider-lab">
                    <span>VIDEO · MODAL</span>
                    <span style={{ color: "#821f4a", fontWeight: 700 }}>LTX DESK</span>
                  </div>
                  <div className="hf-bar">
                    <i style={{ width: "48%", background: "#fa7faa", boxShadow: "0 0 8px #fa7faa" }} />
                  </div>
                </div>
                <div className="hf-slider">
                  <div className="hf-slider-lab">
                    <span>LOOK + STITCH · CPU</span>
                    <span style={{ color: "#150f23", fontWeight: 700 }}>GENERATE</span>
                  </div>
                  <div className="hf-bar">
                    <i style={{ width: "84%", background: "#422082" }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="hf-dir-side">
              <div className="hf-render-card">
                <div className="hf-render-card-head">
                  <span className="hf-card-icon">
                    <Icon name="bolt" />
                  </span>
                  <div>
                    <h4>Async Job Pipeline</h4>
                    <p className="hf-card-sub">Instant response · Background execution</p>
                  </div>
                </div>
                <p className="hf-card-desc">
                  Every generation writes an asynchronous job row and returns immediately. Your browser never hangs or waits on heavy models.
                </p>
                <div className="hf-render-status-row">
                  <span className="hf-status-tag">POLL /STATUS</span>
                  <span className="hf-status-ready">
                    <span className="hf-dot hf-dot-ping" /> QUEUE READY
                  </span>
                </div>
              </div>

              <div className="hf-render-card">
                <div className="hf-render-card-head">
                  <span className="hf-card-icon">
                    <Icon name="cloud_queue" />
                  </span>
                  <div>
                    <h4>Dedicated Cloud Desks</h4>
                    <p className="hf-card-sub">Targeted hardware per task</p>
                  </div>
                </div>
                <ul className="hf-cloud-list">
                  <li>
                    <strong>RunPod GPU:</strong> Krea & Qwen for high-fidelity images
                  </li>
                  <li>
                    <strong>Modal H200:</strong> LTX Video inference engine
                  </li>
                  <li>
                    <strong>RunPod CPU:</strong> Look generation & FFmpeg timeline stitch
                  </li>
                </ul>
              </div>

              <div className="hf-note">
                <h4>
                  <Icon name="tune" />
                  Never block the model
                </h4>
                <p>
                  We poll until the cloud desk completes, keeping heavy GPU inference off your laptop while keeping your local workspace fast and responsive.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Wave fill="#150f23" stroke="#c2ef4e" glow="lime" flip />

      <section className="hf-night" id="audio-studio">
        <div className="hf-wrap-hero">
          <div className="hf-pipe-intro hf-audio-compact">
            <div className="hf-kicker lime" style={{ justifyContent: "center" }}>
              <Icon name="graphic_eq" />
              AUDIO STUDIO
            </div>
            <h2>
              Voices, music, <span className="chip-lime-keyword">sound</span>
            </h2>
            <p className="hf-audio-summary">
              Generate studio-grade narration, realistic character dialogue, voice conversion, audio isolation, sound effects, and full Suno background music. Every track generates asynchronously in the cloud and drops directly onto your documentary timeline.
            </p>
            <div className="hf-audio-cta-row">
              <a className="hf-btn-lime" href="/audio" onClick={go({ name: "audio" })} style={{ color: "#150f23" }}>
                Open Audio Studio
              </a>
              <a className="hf-btn-ghost-dark" href="/projects" onClick={go({ name: "projects" })}>
                Start a documentary
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="hf-wave" aria-hidden="true">
        <svg viewBox="0 0 1440 90" preserveAspectRatio="none">
          <path d="M0,24 C320,70 480,4 720,44 C960,84 1200,10 1440,48 L1440,90 L0,90 Z" fill="#f6f4ee" />
          <path className="hf-lime-glow" d="M0,24 C320,70 480,4 720,44 C960,84 1200,10 1440,48" fill="none" stroke="#c2ef4e" strokeWidth="3" />
        </svg>
      </div>

      <section className="hf-cream hf-cream-2" id="start-a-film">
        <div className="hf-wrap-hero">
          <div className="hf-enterprise">
            <div>
              <h3>Start with a script. Finish with a complete edit.</h3>
              <p>
                Review your script, compare footage options for each scene, and bring your selections into an editable timeline. Keep making changes as your story develops.
              </p>
            </div>
            <div className="hf-ent-btns">
              <a className="hf-btn-lime" href="/projects" onClick={go({ name: "projects" })}>
                Create your first video
              </a>
              <a className="hf-btn-ghost-dark" href="/pricing" onClick={go({ name: "pricing" })}>
                View pricing plans
              </a>
            </div>
          </div>
        </div>
      </section>

      <Squiggle fill="#f0eee6" />

      <footer className="hf-footer">
        <div className="hf-wrap-hero">
          <div className="hf-footer-grid">
            <div className="hf-footer-brand-col">
              <div className="hf-brand">
                <span className="hf-brand-mark">
                  <BrandMark />
                </span>
                <span className="hf-brand-word">
                  <strong style={{ color: "#150f23" }}>
                    MARKETING<em style={{ color: "#422082" }}>STUDIO</em>
                  </strong>
                </span>
              </div>
              <p className="hf-footer-tagline">Your Imagination Engine</p>
              <p className="hf-footer-blurb">Connected video creation with scene-by-scene control.</p>
            </div>
            <nav className="hf-footer-col" aria-label="Start creating">
              <p className="hf-footer-col-title">Start creating</p>
              <a href="/projects" onClick={go({ name: "projects" })}>
                Documentaries
              </a>
              <a href="/avatar" onClick={go({ name: "avatar" })}>
                Avatar
              </a>
              <a href="/images-templates" onClick={go({ name: "templates" })}>
                Images
              </a>
              <a href="/video-templates" onClick={go({ name: "videos" })}>
                Videos
              </a>
              <a href="/effects" onClick={go({ name: "effects" })}>
                Effects
              </a>
              <a href="/audio" onClick={go({ name: "audio" })}>
                Audio
              </a>
            </nav>
            <nav className="hf-footer-col" aria-label="Product">
              <p className="hf-footer-col-title">Product</p>
              <a href="/library" onClick={go({ name: "library" })}>
                Library
              </a>
              <a href="/pricing" onClick={go({ name: "pricing" })}>
                Pricing
              </a>
              <a href="/mcp" onClick={go({ name: "mcp" })}>
                MCP
              </a>
            </nav>
            <nav className="hf-footer-col" aria-label="Legal">
              <p className="hf-footer-col-title">Legal</p>
              <a href="/terms" onClick={go({ name: "terms" })}>
                Terms
              </a>
              <a href="/refund" onClick={go({ name: "refund" })}>
                Refunds
              </a>
              <a href="/delivery" onClick={go({ name: "delivery" })}>
                Delivery
              </a>
              <a href="/cancellation" onClick={go({ name: "cancellation" })}>
                Cancellation
              </a>
              <a href="/contact" onClick={go({ name: "contact" })}>
                Contact Us
              </a>
            </nav>
          </div>
          <div className="hf-footer-bot">
            <p>© 2026 Marketing Studio.</p>
            <div className="hf-live-clusters">
              <span className="hf-dot hf-dot-ping" style={{ background: "#aad636" }} />
              TOPIC → SCRIPT → CAST → MIX
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
