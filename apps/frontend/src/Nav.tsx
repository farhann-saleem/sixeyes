import { useEffect, useState } from "react";
import { BrandMark } from "./landing/BrandMark";

export const AUDIO_DESKS = [
  "tts",
  "voices",
  "change",
  "dub",
  "clone",
  "dialogue",
  "dictionary",
  "isolate",
  "stt",
  "sfx",
  "music",
] as const;

export type AudioDesk = (typeof AUDIO_DESKS)[number];

export type Route =
  | { name: "landing" }
  | { name: "projects" }
  | { name: "project"; id: string; step: "script" | "cast" | "studio" }
  | { name: "avatar" }
  | { name: "audio"; desk?: AudioDesk }
  | { name: "studio"; id?: string }
  | { name: "templates" }
  | { name: "template"; id: string }
  | { name: "videos" }
  | { name: "video"; id: string }
  | { name: "effects" }
  | { name: "effect"; id: string }
  | { name: "library" }
  | { name: "mcp" };

type MenuChild = {
  label: string;
  hint?: string;
  href?: string;
  route?: Route;
  soon?: boolean;
  library?: boolean;
};

type MenuGroup = {
  title: string;
  items: MenuChild[];
};

type Menu = {
  id: string;
  label: string;
  href?: string;
  route?: Route;
  soon?: boolean;
  wide?: boolean;
  groups: MenuGroup[];
};

function audio(desk: AudioDesk, label: string, hint: string): MenuChild {
  return { label, hint, href: `/audio?desk=${desk}`, route: { name: "audio", desk } };
}

const MENUS: Menu[] = [
  {
    id: "avatars",
    label: "Avatars",
    href: "/avatar",
    route: { name: "avatar" },
    groups: [
      {
        title: "Identity",
        items: [
          { label: "Create avatar", hint: "One face photo. Generate. Save the name.", href: "/avatar", route: { name: "avatar" } },
          { label: "Saved identities", hint: "Pick one when you generate a still or clip.", href: "/avatar", route: { name: "avatar" } },
        ],
      },
    ],
  },
  {
    id: "images",
    label: "Images",
    href: "/images-templates",
    route: { name: "templates" },
    groups: [
      {
        title: "Generate",
        items: [
          { label: "Create avatar", hint: "Upload a face. Generate. Name it.", href: "/avatar", route: { name: "avatar" } },
          { label: "Text to Image", hint: "Same desk — portrait from a reference photo.", href: "/avatar", route: { name: "avatar" } },
          { label: "Image to Image", hint: "Rewrite a still from a reference.", href: "/images-templates", route: { name: "templates" } },
        ],
      },
    ],
  },
  {
    id: "videos",
    label: "Videos",
    href: "/video-templates",
    route: { name: "videos" },
    groups: [
      {
        title: "Generate",
        items: [
          { label: "Text to Video", hint: "A documentary cut from a line of copy.", href: "/projects", route: { name: "projects" } },
          { label: "Image to Video", hint: "A still that already is the shot.", href: "/video-templates", route: { name: "videos" } },
          { label: "Effects", hint: "Baked motion packs — person holds, world moves.", href: "/effects", route: { name: "effects" } },
        ],
      },
    ],
  },
  {
    id: "docs",
    label: "Documentaries",
    href: "/projects",
    route: { name: "projects" },
    groups: [
      {
        title: "Story",
        items: [
          { label: "New documentary", hint: "Topic → script → cast → Studio.", href: "/projects", route: { name: "projects" } },
          { label: "Your projects", hint: "Open a story you already started.", href: "/projects", route: { name: "projects" } },
        ],
      },
    ],
  },
  {
    id: "audio",
    label: "Audio",
    href: "/audio",
    route: { name: "audio" },
    wide: true,
    groups: [
      {
        title: "Speak",
        items: [
          audio("tts", "Text to Speech", "Script or SRT in. Voice out."),
          audio("dialogue", "Dialogue", "Two speakers. Label lines A> and B>."),
          audio("clone", "Clone", "3–30s sample, consent required."),
        ],
      },
      {
        title: "Change",
        items: [
          audio("change", "Voice Change", "New speaker on the same picture."),
          audio("dub", "Translate", "Soundtrack + SRT. Not lip-sync."),
          audio("isolate", "Isolate", "Strip noise from a recording."),
          audio("stt", "Speech to Text", "Audio in. Text or SRT out."),
        ],
      },
      {
        title: "Make",
        items: [
          audio("music", "Suno Music", "Simple or custom. Up to two clips."),
          audio("sfx", "Sound Effects", "Describe the hit. 0.5–30s."),
        ],
      },
      {
        title: "Library",
        items: [
          audio("voices", "Voice Library", "Hover a cover. Previews are 0 credits."),
          audio("dictionary", "Dictionary", "Brand-name replacements on TTS."),
        ],
      },
    ],
  },
  {
    id: "studio",
    label: "Studio",
    href: "/projects",
    route: { name: "projects" },
    groups: [
      {
        title: "Edit",
        items: [
          { label: "Timeline", hint: "Narration on A1. Music / SFX on A2.", href: "/projects", route: { name: "projects" } },
          { label: "Audio bin", hint: "Make a clip, then drag it onto the timeline.", href: "/audio", route: { name: "audio" } },
        ],
      },
    ],
  },
  {
    id: "effects",
    label: "Effects",
    href: "/effects",
    route: { name: "effects" },
    wide: true,
    groups: [
      {
        title: "Packs",
        items: [
          { label: "All packs", hint: "Incline, Stop World, Clones, and the rest.", href: "/effects", route: { name: "effects" } },
          { label: "Incline", hint: "World tips. Person holds.", href: "/effects", route: { name: "effects" } },
          { label: "Stop World", hint: "Street freezes around the subject.", href: "/effects", route: { name: "effects" } },
          { label: "Clones", hint: "One person, many copies.", href: "/effects", route: { name: "effects" } },
        ],
      },
      {
        title: "More packs",
        items: [
          { label: "Vanish", hint: "Subject stays. Scene lets go.", href: "/effects", route: { name: "effects" } },
          { label: "Act Natural", hint: "Handheld, unposed motion.", href: "/effects", route: { name: "effects" } },
          { label: "Frozen in Motion", hint: "Hold the beat mid-move.", href: "/effects", route: { name: "effects" } },
          { label: "Studio Slide", hint: "Locked face, sliding set.", href: "/effects", route: { name: "effects" } },
        ],
      },
    ],
  },
  {
    id: "mcps",
    label: "MCPs",
    href: "/mcp",
    route: { name: "mcp" },
    groups: [
      {
        title: "Connect",
        items: [
          { label: "Setup", hint: "Cursor / Claude → this studio. JSON-RPC on :3001/mcp.", href: "/mcp", route: { name: "mcp" } },
          { label: "Tools", hint: "Films, looks, identities, library. Generate is async.", href: "/mcp", route: { name: "mcp" } },
        ],
      },
    ],
  },
];

function parseAudioDesk(search: string): AudioDesk | undefined {
  const raw = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("desk");
  return (AUDIO_DESKS as readonly string[]).includes(raw ?? "") ? (raw as AudioDesk) : undefined;
}

export function pathToRoute(path: string, search = ""): Route {
  if (path === "/" || path === "") return { name: "landing" };
  if (/^\/projects\/?$/.test(path)) return { name: "projects" };
  const project = path.match(/^\/projects\/([^/]+)(?:\/(cast|studio))?\/?$/);
  if (project) return { name: "project", id: decodeURIComponent(project[1]), step: (project[2] || "script") as "script" | "cast" | "studio" };
  if (path.startsWith("/library")) return { name: "library" };
  if (path.startsWith("/mcp")) return { name: "mcp" };
  if (path.startsWith("/audio")) {
    const desk = parseAudioDesk(search);
    return desk ? { name: "audio", desk } : { name: "audio" };
  }
  if (path === "/studio" || path === "/studio/") return { name: "projects" };
  if (path.startsWith("/studio/")) {
    const id = decodeURIComponent(path.slice("/studio/".length).replace(/\/+$/, ""));
    return id ? { name: "project", id, step: "studio" } : { name: "projects" };
  }
  if (path.startsWith("/video-templates/")) {
    const id = decodeURIComponent(path.slice("/video-templates/".length).replace(/\/+$/, ""));
    return id ? { name: "video", id } : { name: "videos" };
  }
  if (path.startsWith("/video-templates")) return { name: "videos" };
  if (path.startsWith("/effects/")) {
    const id = decodeURIComponent(path.slice("/effects/".length).replace(/\/+$/, ""));
    return id ? { name: "effect", id } : { name: "effects" };
  }
  if (path.startsWith("/effects")) return { name: "effects" };
  if (path.startsWith("/images-templates/")) {
    const id = decodeURIComponent(path.slice("/images-templates/".length).replace(/\/+$/, ""));
    return id ? { name: "template", id } : { name: "templates" };
  }
  if (path.startsWith("/images-templates")) return { name: "templates" };
  return { name: "avatar" };
}

export function routeToPath(route: Route): string {
  if (route.name === "landing") return "/";
  if (route.name === "projects") return "/projects";
  if (route.name === "project") return `/projects/${encodeURIComponent(route.id)}${route.step === "script" ? "" : `/${route.step}`}`;
  if (route.name === "library") return "/library";
  if (route.name === "mcp") return "/mcp";
  if (route.name === "audio") return route.desk ? `/audio?desk=${route.desk}` : "/audio";
  if (route.name === "studio") {
    return route.id ? `/projects/${encodeURIComponent(route.id)}/studio` : "/projects";
  }
  if (route.name === "videos") return "/video-templates";
  if (route.name === "video") return `/video-templates/${encodeURIComponent(route.id)}`;
  if (route.name === "effects") return "/effects";
  if (route.name === "effect") return `/effects/${encodeURIComponent(route.id)}`;
  if (route.name === "templates") return "/images-templates";
  if (route.name === "template") return `/images-templates/${encodeURIComponent(route.id)}`;
  return "/avatar";
}

export function routeTitle(route: Route): string {
  if (route.name === "landing") return "Marketing Studio — Your Imagination Engine";
  if (route.name === "projects" || route.name === "project") return "Projects — Marketing Studio";
  if (route.name === "library") return "Your library — Marketing Studio";
  if (route.name === "mcp") return "MCP — Marketing Studio";
  if (route.name === "audio") return "Audio — Marketing Studio";
  if (route.name === "studio") return "Video Studio — Marketing Studio";
  if (route.name === "videos" || route.name === "video") return "Videos — Marketing Studio";
  if (route.name === "effects" || route.name === "effect") return "Effects — Marketing Studio";
  if (route.name === "templates" || route.name === "template") return "Images — Marketing Studio";
  return "Create avatar — Marketing Studio";
}

function menuActive(menu: Menu, route: Route): boolean {
  if (menu.id === "images") return route.name === "templates" || route.name === "template";
  if (menu.id === "avatars") return route.name === "avatar";
  if (menu.id === "videos") return route.name === "videos" || route.name === "video";
  if (menu.id === "docs") {
    return route.name === "projects" || (route.name === "project" && route.step !== "studio");
  }
  if (menu.id === "audio") return route.name === "audio";
  if (menu.id === "studio") {
    return route.name === "studio" || (route.name === "project" && route.step === "studio");
  }
  if (menu.id === "effects") return route.name === "effects" || route.name === "effect";
  if (menu.id === "mcps") return route.name === "mcp";
  return false;
}

function Choice({
  item,
  libraryCount,
  onGo,
}: {
  item: MenuChild;
  libraryCount: number;
  onGo: (next: Route) => void;
}) {
  const body = (
    <>
      <strong>
        {item.label}
        {item.library && libraryCount > 0 ? <span className="tab-count">{libraryCount}</span> : null}
      </strong>
      {item.hint ? <span>{item.hint}</span> : null}
    </>
  );

  if (item.soon || !item.route || !item.href) {
    return (
      <span className="nav-choice is-soon" role="menuitem" aria-disabled="true">
        {body}
      </span>
    );
  }

  return (
    <a
      className="nav-choice"
      href={item.href}
      role="menuitem"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onGo(item.route!);
      }}
    >
      {body}
    </a>
  );
}

export function Nav({
  route,
  onGo,
  libraryCount,
}: {
  route: Route;
  onGo: (next: Route) => void;
  libraryCount: number;
}) {
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    setOpen(null);
  }, [route]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest(".nav-drop")) setOpen(null);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  return (
    <header className={`nav${route.name === "landing" ? " nav-landing" : ""}`}>
      <a
        className="brand"
        href="/"
        onClick={(e) => {
          e.preventDefault();
          onGo({ name: "landing" });
        }}
      >
        <span className="brand-mark" aria-hidden="true">
          <BrandMark />
        </span>
        <span className="brand-word">
          Marketing<em>Studio</em>
        </span>
      </a>
      <nav aria-label="Primary">
        {MENUS.map((menu) => {
          const active = menuActive(menu, route);
          const shown = open === menu.id;
          return (
            <div
              key={menu.id}
              className={`nav-drop${menu.wide ? " is-wide" : ""}${active ? " is-active" : ""}${shown ? " is-open" : ""}${menu.soon ? " is-soon" : ""}`}
              onMouseEnter={() => setOpen(menu.id)}
              onMouseLeave={() => setOpen((cur) => (cur === menu.id ? null : cur))}
            >
              {menu.soon || !menu.route || !menu.href ? (
                <button
                  type="button"
                  className="nav-top"
                  aria-expanded={shown}
                  aria-haspopup="true"
                  onClick={() => setOpen(shown ? null : menu.id)}
                >
                  {menu.label}
                  <span className="nav-soon">Soon</span>
                  <span className="nav-caret" aria-hidden="true" />
                </button>
              ) : (
                <a
                  href={menu.href}
                  className="nav-top"
                  aria-current={active ? "page" : undefined}
                  aria-expanded={shown}
                  aria-haspopup="true"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (shown) onGo(menu.route!);
                    else setOpen(menu.id);
                  }}
                >
                  {menu.label}
                  <span className="nav-caret" aria-hidden="true" />
                </a>
              )}
              <div className={`nav-menu${menu.wide ? " is-wide" : ""}`} role="menu">
                {menu.groups.map((group) => (
                  <div key={group.title} className="nav-col">
                    <p className="nav-col-kicker">{group.title}</p>
                    {group.items.map((item) => (
                      <Choice key={item.label} item={item} libraryCount={libraryCount} onGo={onGo} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="nav-end">
        <a
          className={`nav-top nav-library${route.name === "library" ? " is-current" : ""}`}
          href="/library"
          aria-current={route.name === "library" ? "page" : undefined}
          onClick={(e) => {
            e.preventDefault();
            onGo({ name: "library" });
          }}
        >
          Library
          {libraryCount > 0 ? <span className="nav-count">{libraryCount}</span> : null}
        </a>
        {route.name === "landing" ? (
          <a
            className="nav-cta"
            href="/projects"
            onClick={(e) => {
              e.preventDefault();
              onGo({ name: "projects" });
            }}
          >
            Start Creating
          </a>
        ) : route.name === "avatar" ? (
          <a
            className="nav-cta"
            href="/projects"
            onClick={(e) => {
              e.preventDefault();
              onGo({ name: "projects" });
            }}
          >
            New documentary
          </a>
        ) : (
          <a
            className="nav-cta"
            href="/avatar"
            onClick={(e) => {
              e.preventDefault();
              onGo({ name: "avatar" });
            }}
          >
            Create Avatar
          </a>
        )}
      </div>
    </header>
  );
}
