import { useEffect, useMemo, useState } from "react";
import { CoverArt, togglePreview, usePlayingId, WaveBars } from "./audio-ui";
import { json } from "./studio";

export type SfxStarter = {
  id: string;
  label: string;
  prompt: string;
  duration_seconds?: number;
  loop?: boolean;
};

export type MusicStarter = {
  id: string;
  label: string;
  create_mode: "simple" | "custom";
  gpt_description_prompt?: string;
  make_instrumental?: boolean;
  title?: string;
  lyrics?: string;
  tags?: string;
  vocal_gender?: "f" | "m";
};

export type LibraryClip = {
  id: string;
  source: "studio" | "vendor";
  kind: "sfx" | "music";
  title: string;
  play_url: string;
  alt_url: string | null;
  cover_url: string | null;
  prompt: string | null;
};

type Shelf = {
  starters: Array<SfxStarter | MusicStarter>;
  clips: LibraryClip[];
};

function durationLabel(seconds?: number) {
  if (seconds == null) return "auto";
  return `${seconds}s`;
}

function MusicClipTile({ clip }: { clip: LibraryClip }) {
  const playing = usePlayingId() === clip.id;
  return (
    <article className={playing ? "album-tile on" : "album-tile"}>
      <CoverArt
        src={clip.cover_url}
        seed={clip.title}
        playing={playing}
        label={clip.title}
        size="lg"
        onPlay={() => togglePreview(clip.id, clip.play_url, { title: clip.title, cover: clip.cover_url })}
      />
      <div className="album-copy">
        <strong>{clip.title}</strong>
        <span>Your clip</span>
      </div>
    </article>
  );
}

function ClipRow({ clip }: { clip: LibraryClip }) {
  const playing = usePlayingId() === clip.id;
  const altId = `${clip.id}-alt`;
  const playingAlt = usePlayingId() === altId;
  return (
    <article className={playing || playingAlt ? "track-row on" : "track-row"}>
      <CoverArt
        src={clip.cover_url}
        seed={clip.title}
        playing={playing}
        label={clip.title}
        onPlay={() => togglePreview(clip.id, clip.play_url, { title: clip.title, cover: clip.cover_url })}
      />
      <div className="track-copy">
        <strong>{clip.title}</strong>
        <span>{clip.source === "studio" ? "Your clip" : "Account history"}</span>
        {playing ? <WaveBars active /> : null}
      </div>
      <span className="dur">Ready</span>
      {clip.alt_url ? (
        <button
          type="button"
          className="add-btn ghost"
          onClick={() => togglePreview(altId, clip.alt_url!, { title: `${clip.title} B`, cover: clip.cover_url })}
        >
          {playingAlt ? "Stop B" : "B"}
        </button>
      ) : null}
    </article>
  );
}

export function AssetLibraryBrowse({
  pane,
  onUseSfx,
  onUseMusic,
}: {
  pane: "sfx" | "music";
  onUseSfx: (starter: SfxStarter) => void;
  onUseMusic: (starter: MusicStarter) => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sfx, setSfx] = useState<Shelf>({ starters: [], clips: [] });
  const [music, setMusic] = useState<Shelf>({ starters: [], clips: [] });

  useEffect(() => {
    json<{ sfx?: Shelf; music?: Shelf }>("/api/audio/asset-library")
      .then((body) => {
        setSfx(body.sfx || { starters: [], clips: [] });
        setMusic(body.music || { starters: [], clips: [] });
        setErr(null);
      })
      .catch((e: Error) => setErr(e.message));
  }, []);

  const shelf = pane === "sfx" ? sfx : music;
  const q = query.trim().toLowerCase();
  const starters = useMemo(() => {
    const rows = shelf.starters;
    if (!q) return rows;
    return rows.filter((s) => JSON.stringify(s).toLowerCase().includes(q));
  }, [shelf.starters, q]);
  const clips = useMemo(() => {
    if (!q) return shelf.clips;
    return shelf.clips.filter((c) => `${c.title} ${c.prompt || ""}`.toLowerCase().includes(q));
  }, [shelf.clips, q]);

  return (
    <div className="audio-bin">
      <input
        type="search"
        className="audio-search"
        placeholder={pane === "sfx" ? "Search effects" : "Search music"}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {err ? <p className="notice">{err}</p> : null}

      {pane === "sfx" ? (
        <>
          <p className="shelf-label">Sound library</p>
          <div className="track-list wide">
            {(starters as SfxStarter[]).map((s) => (
              <article key={s.id} className="track-row">
                <CoverArt seed={s.label} label={s.label} />
                <div className="track-copy">
                  <strong>{s.label}</strong>
                  <span>{s.prompt}</span>
                </div>
                <span className="dur">{durationLabel(s.duration_seconds)}</span>
                <button type="button" className="add-btn" onClick={() => onUseSfx(s)} aria-label={`Use ${s.label}`}>
                  +
                </button>
              </article>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="shelf-label">Music</p>
          <div className="album-grid">
            {(starters as MusicStarter[]).map((s) => {
              const title = s.title || s.label;
              const sub =
                s.create_mode === "simple"
                  ? s.gpt_description_prompt || "Simple"
                  : s.tags || "Custom lyrics";
              return (
                <article key={s.id} className="album-tile">
                  <CoverArt seed={title} label={title} size="lg" />
                  <button type="button" className="album-copy" onClick={() => onUseMusic(s)}>
                    <strong>{title}</strong>
                    <span>{sub}</span>
                  </button>
                  <button type="button" className="add-btn on-tile" onClick={() => onUseMusic(s)}>
                    +
                  </button>
                </article>
              );
            })}
          </div>
        </>
      )}

      <p className="shelf-label">Your audio</p>
      {clips.length === 0 ? (
        <p className="bin-empty">Nothing generated yet. Hit + to fill the form, then Generate. Preview only plays after a clip exists.</p>
      ) : pane === "music" ? (
        <div className="album-grid">
          {clips.map((clip) => (
            <MusicClipTile key={clip.id} clip={clip} />
          ))}
        </div>
      ) : (
        <div className="track-list wide">
          {clips.map((clip) => (
            <ClipRow key={clip.id} clip={clip} />
          ))}
        </div>
      )}
    </div>
  );
}

export function PromptStarters({
  kind,
  onUseSfx,
  onUseMusic,
}: {
  kind: "sfx" | "music";
  onUseSfx: (starter: SfxStarter) => void;
  onUseMusic: (starter: MusicStarter) => void;
}) {
  const [sfx, setSfx] = useState<SfxStarter[]>([]);
  const [music, setMusic] = useState<MusicStarter[]>([]);

  useEffect(() => {
    json<{ sfx?: { starters?: SfxStarter[] }; music?: { starters?: MusicStarter[] } }>("/api/audio/asset-library")
      .then((body) => {
        setSfx((body.sfx?.starters as SfxStarter[]) || []);
        setMusic((body.music?.starters as MusicStarter[]) || []);
      })
      .catch(() => undefined);
  }, []);

  const rows = kind === "sfx" ? sfx : music;
  if (rows.length === 0) return null;
  return (
    <div className="chip-row wrap">
      {kind === "sfx"
        ? sfx.map((s) => (
            <button key={s.id} type="button" className="chip" onClick={() => onUseSfx(s)}>
              {s.label}
            </button>
          ))
        : music.map((s) => (
            <button key={s.id} type="button" className="chip" onClick={() => onUseMusic(s)}>
              {s.label}
            </button>
          ))}
    </div>
  );
}
